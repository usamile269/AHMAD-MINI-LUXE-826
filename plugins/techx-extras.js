const { cmd } = require('../ahmad-core');
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const os = require('os');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);
const { randomFooter, renderError, ownerOnlyDenied } = require('../lib/menu-styles');
const { uploadToCloudinary, isConfigured: cloudinaryConfigured } = require('../lib/cloudinary');

const FOOTER = "\n\n> " + randomFooter();
const fail = (reply, msg) => reply(renderError(msg));

// 🆕 (.emojimix sticker output): PNG -> WhatsApp-ready webp sticker, same
// scale/pad/palette settings the rest of this bot's sticker commands use.
async function pngToWebpSticker(pngBuffer) {
    const inPath = path.join(os.tmpdir(), `emojimix_${Date.now()}.png`);
    const outPath = path.join(os.tmpdir(), `emojimix_${Date.now()}.webp`);
    fs.writeFileSync(inPath, pngBuffer);
    try {
        await new Promise((resolve, reject) => {
            ffmpeg(inPath)
                .on('end', resolve).on('error', reject)
                .addOutputOptions([
                    "-vcodec", "libwebp",
                    "-vf", "scale='min(512,iw)':min'(512,ih)':force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000",
                    "-loop", "0", "-preset", "default", "-an", "-vsync", "0"
                ])
                .toFormat('webp').save(outPath);
        });
        return fs.readFileSync(outPath);
    } finally {
        fs.unlink(inPath, () => {}); fs.unlink(outPath, () => {});
    }
}

cmd({
    pattern: "emojimix",
    desc: "🎴 Mix two emoji into one fused sticker",
    category: "sticker",
    react: "🎴",
    use: ".emojimix 😎+🔥",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q || !q.includes('+')) return fail(reply, "Usage: .emojimix 😎+🔥");
        let [e1, e2] = q.split('+').map(s => s.trim());
        const codepoint = (e) => [...e].map(c => c.codePointAt(0).toString(16)).join('-');
        const imageUrl = `https://emojik.vercel.app/s/${codepoint(e1)}_${codepoint(e2)}?size=512`;
        // Pre-fetch as a buffer so an invalid/unsupported combo (this API
        // returns a 404, not an empty result) fails here with a clean
        // message instead of sending WhatsApp a broken image link.
        const imgRes = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000, validateStatus: () => true });
        if (imgRes.status !== 200 || !imgRes.data || imgRes.data.length < 500) {
            return fail(reply, "This emoji combo doesn't mix, try another one.");
        }
        // 🆕 (Bunty: saw a reference bot's .emojimix send a STICKER instead
        // of a plain image — more useful since it's instantly reusable in
        // any chat). Converted via the same fluent-ffmpeg pipeline every
        // other sticker command in this bot already uses.
        const stickerBuffer = await pngToWebpSticker(Buffer.from(imgRes.data));
        await conn.sendMessage(from, { sticker: stickerBuffer }, { quoted: mek });
    } catch (e) { fail(reply, "Emoji mix failed."); }
});

cmd({
    pattern: "block",
    desc: "🚫 Block a user (reply or provide number)",
    category: "owner",
    use: ".block 923001234567 (or reply to their message)",
    filename: __filename
}, async (conn, mek, m, { isOwner, args, reply }) => {
    try {
        if (!isOwner) return fail(reply, ownerOnlyDenied());
        const target = m.quoted?.sender || (args[0] ? args[0].replace(/[^0-9]/g, '') + "@s.whatsapp.net" : null);
        if (!target) return fail(reply, "Reply to a user or provide their number.");
        await conn.updateBlockStatus(target, "block");
        reply(`✅ Blocked @${target.split('@')[0]}${FOOTER}`);
    } catch (e) { fail(reply, "Block failed: " + e.message); }
});

cmd({
    pattern: "unblock",
    desc: "✅ Unblock a user",
    category: "owner",
    use: ".unblock 923001234567",
    filename: __filename
}, async (conn, mek, m, { isOwner, args, reply }) => {
    try {
        if (!isOwner) return fail(reply, ownerOnlyDenied());
        const target = m.quoted?.sender || (args[0] ? args[0].replace(/[^0-9]/g, '') + "@s.whatsapp.net" : null);
        if (!target) return fail(reply, "Reply to a user or provide their number.");
        await conn.updateBlockStatus(target, "unblock");
        reply(`✅ Unblocked @${target.split('@')[0]}${FOOTER}`);
    } catch (e) { fail(reply, "Unblock failed: " + e.message); }
});

// 🚨 ROOT-CAUSE FIX ("tourl link gives 404"): some of these hosts (esp.
// envs.sh/qu.ax on flagged VPS IP ranges) were silently accepting the
// upload and handing back a valid-LOOKING URL, but never actually storing
// the file — so the link 404'd the moment it was opened. Just checking
// "does the response look like a URL" wasn't enough; now every candidate
// URL is verified with a real HEAD request before it's trusted, and if
// that fails, the next host in the chain is tried automatically.
// 🚨 FIX (Bunty: ".url — upload failed on all hosts" every time): HEAD
// requests aren't reliably supported by every one of these free hosts —
// some return 405/403 on HEAD even though the file uploaded fine and a
// normal GET would work — so a real successful upload was being thrown
// away as "dead" by this check alone. Now falls back to a ranged GET
// (Range: bytes=0-0, fetches 1 byte) before giving up, which almost every
// host handles correctly even when HEAD doesn't.
async function verifyUrlIsLive(url) {
    const ua = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' };
    try {
        const res = await axios.head(url, { timeout: 6000, validateStatus: () => true, headers: ua });
        if (res.status >= 200 && res.status < 400) return true;
    } catch (e) {}
    try {
        const res = await axios.get(url, { timeout: 8000, validateStatus: () => true, headers: { ...ua, Range: 'bytes=0-0' } });
        return res.status >= 200 && res.status < 400;
    } catch (e) {
        return false;
    }
}


// 🚨 ROOT-CAUSE FIX (Bunty: "link kabhi permanent kabhi kuch hours mein
// mar jata hai"): the previous "speed fix" raced catbox (permanent, never
// expires) AGAINST the temporary hosts (pixeldrain/0x0.st/envs.sh/qu.ax)
// via Promise.any — whichever host simply RESPONDED FASTER won, even if
// that was a short-lived temporary link and catbox would have succeeded
// a second later. That's why the result was inconsistent: sometimes
// permanent, sometimes a link that quietly died in a few hours/days.
// Fix: catbox now gets tried FIRST and ALONE (with one quick retry, since
// it occasionally hiccups with a transient 412/timeout) before anything
// else is even attempted. Only if catbox genuinely fails BOTH times do we
// fall back to racing the temporary-host pool — so a working permanent
// link is always preferred over a faster temporary one.
async function uploadToAnyHost(buffer, ext) {
    const browserUA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
    const headers = (form) => ({ ...form.getHeaders(), 'User-Agent': browserUA });
    const HOST_TIMEOUT = 15000;

    // 🚨 REMOVED (Bunty: ".url mein jitni catbox APIs sab remove karo") —
    // catbox.moe (and its litterbox sibling below) have been unreliable
    // from this hosting throughout — timeouts, 404s, and outright blocks
    // seen across .menu, .owner, and here too. Dropped entirely. The
    // remaining 5 hosts (telegra.ph, pixeldrain, 0x0.st, envs.sh, qu.ax)
    // don't share catbox's infra and haven't shown the same issues.
    const fallbackAttempts = [
        // pixeldrain.com — anonymous upload, files expire 60 days after
        // their LAST view/download (active links stay alive indefinitely).
        async () => {
            const form = new FormData();
            form.append('file', buffer, `file.${ext}`);
            const res = await axios.post('https://pixeldrain.com/api/file', form, { headers: headers(form), timeout: HOST_TIMEOUT });
            const id = res.data?.id;
            if (id) {
                const url = `https://pixeldrain.com/api/file/${id}`;
                if (await verifyUrlIsLive(url)) return url;
            }
            throw new Error('pixeldrain failed');
        },
        // 🚨 REPLACED (Bunty: "sab farig hain, naya lagao" — verified via
        // search: 0x0.st has uploads DISABLED since April 2026 due to AI
        // botnet spam abuse, no ETA to return — genuinely dead, not just
        // flaky). Swapped for temp.sh (confirmed reachable, same simple
        // curl-style API, returns a plain-text URL) — files last 3 days,
        // used here only as one of several backup hosts, not primary.
        async () => {
            const form = new FormData();
            form.append('file', buffer, `file.${ext}`);
            const res = await axios.post('https://temp.sh/upload', form, { headers: headers(form), timeout: HOST_TIMEOUT });
            if (res.data && String(res.data).trim().startsWith('http')) {
                const url = String(res.data).trim();
                if (await verifyUrlIsLive(url)) return url;
            }
            throw new Error('temp.sh failed');
        },
        // envs.sh (0x0.st mirror) — simple single-field upload
        async () => {
            const form = new FormData();
            form.append('file', buffer, `file.${ext}`);
            const res = await axios.post('https://envs.sh', form, { headers: headers(form), timeout: HOST_TIMEOUT });
            if (res.data && String(res.data).trim().startsWith('http')) {
                const url = String(res.data).trim();
                if (await verifyUrlIsLive(url)) return url;
            }
            throw new Error('envs.sh failed');
        },
        // qu.ax — pomf-style, JSON response
        async () => {
            const form = new FormData();
            form.append('files[]', buffer, `file.${ext}`);
            const res = await axios.post('https://qu.ax/upload.php', form, { headers: headers(form), timeout: HOST_TIMEOUT });
            const url = res.data?.files?.[0]?.url;
            if (url && await verifyUrlIsLive(url)) return url;
            throw new Error('qu.ax failed');
        },
    ];

    // telegra.ph (Telegram's own image/video host) — genuinely permanent,
    // no expiry, and critically: NOT known to block datacenter/cloud IP
    // ranges the way catbox.moe sometimes does (root cause of the
    // "upload failed on all hosts" reports from Railway). Only supports
    // image/video though (jpg/png/gif/mp4) — not arbitrary audio formats
    // — so it's skipped for audio uploads.
    const isTelegraphCompatible = ['jpg', 'jpeg', 'png', 'gif', 'mp4'].includes(ext);
    const telegraphAttempt = async () => {
        const form = new FormData();
        form.append('file', buffer, `file.${ext}`);
        const res = await axios.post('https://telegra.ph/upload', form, { headers: headers(form), timeout: HOST_TIMEOUT });
        const path = res.data?.[0]?.src;
        if (path) {
            const url = `https://telegra.ph${path}`;
            if (await verifyUrlIsLive(url)) return url;
        }
        throw new Error('telegra.ph failed');
    };

    // 🚨 REMOVED AGAIN (Bunty: "sirf .owner wali video mein catbox chahiye
    // thi, baki (.url/.tourl) se remove karo") — catbox stays only in
    // .owner's video pool now, not here.
    // 🆕 (Bunty: "Cloudinary use karein jo kabhi band bhi nahi hogi") —
    // a real cloud service, not a random free anonymous host, so this is
    // now the FIRST thing tried — genuinely permanent, and (unlike every
    // other host in this file) backed by an account Bunty controls
    // directly rather than someone else's free tier that can vanish.
    const cloudinaryAttempt = async () => {
        if (!cloudinaryConfigured()) throw new Error('Cloudinary not configured');
        const url = await uploadToCloudinary(buffer, ext);
        return url;
    };

    const permanentAttempts = [
        cloudinaryAttempt().then(url => {
            console.log('[URL host cloudinary] success');
            return url;
        }).catch(e => { console.log('[URL host cloudinary] failed:', e.message); throw e; })
    ];
    if (isTelegraphCompatible) {
        permanentAttempts.push(telegraphAttempt().then(url => {
            console.log('[URL host telegra.ph] success');
            return url;
        }).catch(e => { console.log('[URL host telegra.ph] failed:', e.message); throw e; }));
    }

    try {
        return await Promise.any(permanentAttempts);
    } catch (e) {
        // AggregateError — every permanent host failed
    }

    console.log('[URL host] all permanent hosts failed — falling back to temporary hosts (link will expire eventually)');
    try {
        return await Promise.any(fallbackAttempts.map((fn, i) =>
            fn().catch(e => { console.log(`[URL host fallback ${i}] failed:`, e.message); throw e; })
        ));
    } catch (e) {
        // AggregateError — every host failed/timed out
        return null;
    }
}

// 🚨 REMOVED (Bunty: "jitni catbox APIs sab remove karo") — dead/unused
// catbox-only upload path (superseded by the multi-host uploadToAnyHost
// below, which now excludes catbox entirely).

// 🔧 UPDATE (Bunty: "url ko bhi fallback do, sab hosts try ho") — .url and
// .tourl are now aliases of each other again, both using the full
// multi-host fallback chain. uguu.se (3hr expiry) was replaced with
// pixeldrain (60 days since last view) so a fallback link is much more
// likely to actually still be "lifetime-ish" instead of dying in hours.
function tourlHandler() {
    return async (conn, mek, m, { reply }) => {
        try {
            if (!m.quoted || !m.quoted.message) return fail(reply, "Reply to an image/video/audio with .tourl.");

            // 🚨 BUG FIX (Bunty: ".url audio pe error deta"): this used to
            // re-derive the message type itself via Object.keys(m.quoted.message)[0]
            // on the RAW quoted proto — but voice notes/audio replied to from a
            // disappearing-messages chat (or forwarded/view-once) arrive wrapped
            // in an outer ephemeralMessage/viewOnceMessage key, so that raw key
            // was "ephemeralMessage", not "audioMessage" — mediaType came back
            // null and it failed with "This media type isn't supported." every
            // time, even on perfectly normal audio. m.quoted.mtype (set in
            // main.js via Baileys' own getContentType, and already correctly
            // used this same way by every other command in the bot) is the
            // trusted, already-unwrapped type — use that first.
            const type = m.quoted.mtype || Object.keys(m.quoted.message)[0];
            const mediaType = type === 'imageMessage' ? 'image' : type === 'videoMessage' ? 'video' : type === 'audioMessage' ? 'audio' : null;
            if (!mediaType) return fail(reply, "This media type isn't supported.");

            // Reuse the already-built, size-capped download() helper (same one
            // every other media command in the bot uses) instead of duplicating
            // the download loop here with a possibly-different `type` — keeps
            // both places from ever disagreeing about which content to pull.
            const buffer = await m.quoted.download();

            // 🚨 BUG FIX: audio was always labeled "file.mp3" regardless of the
            // actual encoding — a WhatsApp voice note is really OGG/OPUS, not
            // MP3. Some upload hosts sniff/validate content against the given
            // extension and reject (or mangle) a mismatched file, and even when
            // accepted, players trust the .mp3 extension and can fail to decode
            // real OGG bytes. Pull the real mimetype off the message itself and
            // pick a matching extension instead of hardcoding one.
            let ext = mediaType === 'image' ? 'jpg' : mediaType === 'video' ? 'mp4' : 'mp3';
            if (mediaType === 'audio') {
                const mime = m.quoted.message?.audioMessage?.mimetype || '';
                if (mime.includes('ogg')) ext = 'ogg';
                else if (mime.includes('mp4') || mime.includes('m4a') || mime.includes('aac')) ext = 'm4a';
                else if (mime.includes('mpeg') || mime.includes('mp3')) ext = 'mp3';
            }

            const url = await uploadToAnyHost(buffer, ext);
            if (!url) return fail(reply, "Upload failed on all hosts, try again in a bit.");
            const isPermanent = url.includes('telegra.ph') || url.includes('cloudinary.com');
            const note = isPermanent
                ? ''
                : '\n⚠️ Ye ek temporary link hai (pixeldrain/temp.sh/envs.sh/qu.ax) — telegra.ph is waqt down tha ya ye file type support nahi karta.';
            reply(`✅ Link: ${url}${note}${FOOTER}`);
        } catch (e) { fail(reply, "Upload failed: " + e.message); }
    };
}

cmd({
    pattern: "url",
    alias: ["tourl"],
    desc: "🔗 Upload replied media and get a direct link (multi-host fallback)",
    category: "tools",
    use: "Reply to an image/video/audio with .url",
    filename: __filename
}, tourlHandler());

module.exports = {};
