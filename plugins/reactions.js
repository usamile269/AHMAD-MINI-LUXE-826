const { cmd } = require('../ahmad-core');
const axios = require('axios');
const { gifToVideoGif } = require('../lib/sticker-utils');
const { toFancyBold } = require('../lib/text-style');
const { randomFooter } = require('../lib/menu-styles');

const FOOTER = "\n\n> " + randomFooter();

// 📌 CURRENT APPROACH (Ahmad wants: animated GIF, big size, WITH the
// "gave a hug to @user" text — all in ONE message): sent as a `video`
// message with gifPlayback:true and caption set, which WhatsApp renders
// as an animated/looping gif bubble that also carries the caption text
// (unlike stickers, which loop nicely but can't have any text on them).
// The source gif is pre-downloaded and converted to MP4 via ffmpeg
// (scaled up, original aspect kept, no crop) instead of streaming the
// raw CDN url straight to WhatsApp — streaming the url directly was
// what caused the old "static/broken thumbnail until tapped" bug.
//
// nekos.best needs no API key and isn't shared/rate-limited like public
// Tenor keys, and covers most of these categories directly — tried first.
// otakugifs.xyz then waifu.pics remain as fallbacks exactly as before if
// nekos.best doesn't have that category or is briefly down.
// 🚨 BUG FIX (Ahmad: ".glomp — Reaction fetch failed, tried 3 sources"):
// nekos.best had no "glomp" category at all (NEKO_CATEGORY_MAP below never
// included it, so that source always failed instantly for it), and
// otakugifs.xyz/waifu.pics don't reliably support every less-common tag
// either — some categories just aren't available everywhere. Rather than
// fail outright when a specific tag isn't supported anywhere, this maps a
// few less-common tags to the closest well-supported equivalent as a final
// fallback, so the command still sends SOMETHING relevant instead of an
// error.
const CATEGORY_FALLBACK = {
    glomp: 'hug', cringe: 'smug', bully: 'poke', kill: 'slap',
    nom: 'bite', bonk: 'bite', awoo: 'happy', lick: 'bite',
    // 🚨 FIX (Bunty: "jo working nahi unko working se replace karo") —
    // boop/cheer/stab had NO fallback mapping at all (unlike glomp/bully/
    // etc above), so if otakugifs/waifu.pics didn't happen to support
    // these exact made-up category names either, they'd hard-fail with
    // zero backup — the exact same failure mode baka/lurk had. Mapped to
    // real, confirmed-valid nekos.best categories as a guaranteed last
    // resort, same pattern as the others on this list.
    boop: 'poke', cheer: 'happy', stab: 'slap'
};

const NEKO_CATEGORY_MAP = {
    hug: 'hug', kiss: 'kiss', pat: 'pat', cuddle: 'cuddle', cry: 'cry',
    dance: 'dance', wink: 'wink', poke: 'poke', bite: 'bite', happy: 'happy',
    smile: 'smile', smug: 'smug', wave: 'wave', yeet: 'yeet', blush: 'blush',
    highfive: 'highfive', slap: 'slap', laugh: 'laugh', think: 'think'
};

async function getNekoGifUrl(pattern) {
    const category = NEKO_CATEGORY_MAP[pattern];
    if (!category) throw new Error('no nekos.best category for this reaction');
    // 🚨 FIX: this was the only one of the 3 sources with no User-Agent
    // header — same "picky CDN on this host" pattern seen with catbox.
    const { data } = await axios.get(`https://nekos.best/api/v2/${category}?amount=1`, {
        timeout: 10000, family: 4,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
    });
    const url = data?.results?.[0]?.url;
    if (!url) throw new Error('No GIF found on nekos.best');
    return url;
}

const reactions = [
    { pattern: "hug", emoji: "🤗", verb: "gave a hug to" },
    { pattern: "kiss", emoji: "😘", verb: "kissed" },
    { pattern: "pat", emoji: "🫳", verb: "patted" },
    { pattern: "cuddle", emoji: "🥰", verb: "cuddled" },
    { pattern: "cry", emoji: "😢", verb: "is crying" },
    { pattern: "dance", emoji: "💃", verb: "is dancing" },
    { pattern: "wink", emoji: "😉", verb: "winked at" },
    { pattern: "poke", emoji: "👉", verb: "poked" },
    { pattern: "bite", emoji: "😬", verb: "bit" },
    { pattern: "glomp", emoji: "🤼", verb: "glomped" },
    { pattern: "awoo", emoji: "🐺", verb: "awoo!" },
    { pattern: "happy", emoji: "😄", verb: "is happy" },
    { pattern: "smile", emoji: "😊", verb: "smiled at" },
    { pattern: "smug", emoji: "😏", verb: "gave a smug look to" },
    { pattern: "cringe", emoji: "😬", verb: "cringed at" },
    { pattern: "wave", emoji: "👋", verb: "waved at" },
    { pattern: "bully", emoji: "😈", verb: "is bullying" },
    { pattern: "kill", emoji: "🔪", verb: "killed (just kidding 😂)" },
    { pattern: "nom", emoji: "😋", verb: "is nom-nomming" },
    { pattern: "lick", emoji: "👅", verb: "licked" },
    { pattern: "bonk", emoji: "🔨", verb: "bonked" },
    { pattern: "yeet", emoji: "🚀", verb: "yeeted" },
    { pattern: "blush", emoji: "😊", verb: "is blushing at" },
    { pattern: "highfive", emoji: "🙌", verb: "gave a high-five to" },
    { pattern: "boop", emoji: "👆", verb: "booped" },
    { pattern: "cheer", emoji: "📣", verb: "cheered for" },
    { pattern: "stab", emoji: "🔪", verb: "stabbed (just kidding 😂)" },
];

for (const r of reactions) {
    cmd({
        pattern: r.pattern,
        desc: `${r.emoji} Anime reaction: ${r.pattern}`,
        category: "fun",
        filename: __filename
    }, async (conn, mek, m, { from, q, reply, mentionedJid }) => {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        // Try nekos.best first, then otakugifs.xyz, then waifu.pics.
        let imageUrl = null;
        // 🚨 FIX (Bunty: "kiss/happy/blush 100% working, bully fail hota
        // hai") — same nekos.best rate-limit pattern as batch2: a single
        // shot with zero retry meant one brief hiccup was an instant,
        // guaranteed drop to otakugifs/waifu.pics instead of just trying
        // again a moment later. One retry with a short delay now happens
        // here too before falling through.
        try { imageUrl = await getNekoGifUrl(r.pattern); }
        catch (e) {
            console.log(`[REACTION:${r.pattern}] nekos.best attempt 1 failed:`, e.message);
            await new Promise((res) => setTimeout(res, 1200));
            try { imageUrl = await getNekoGifUrl(r.pattern); }
            catch (e2) { console.log(`[REACTION:${r.pattern}] nekos.best attempt 2 failed:`, e2.message); }
        }

        if (!imageUrl) {
            try {
                const { data } = await axios.get(`https://api.otakugifs.xyz/gif`, {
                    params: { reaction: r.pattern },
                    timeout: 12000, family: 4,
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
                });
                if (data && data.url) imageUrl = data.url;
            } catch (e) { console.log(`[REACTION:${r.pattern}] otakugifs failed:`, e.message); }
        }

        if (!imageUrl) {
            // Retried once — a single slow/dropped response here shouldn't
            // fail the whole reaction when this is the last fallback source.
            for (let attempt = 1; attempt <= 2 && !imageUrl; attempt++) {
                try {
                    const { data } = await axios.get(`https://api.waifu.pics/sfw/${r.pattern}`, {
                        timeout: 12000, family: 4,
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                    });
                    if (data && data.url) imageUrl = data.url;
                } catch (e) { console.log(`[REACTION:${r.pattern}] waifu.pics attempt ${attempt} failed:`, e.message); }
            }
        }

        if (!imageUrl && CATEGORY_FALLBACK[r.pattern]) {
            const altPattern = CATEGORY_FALLBACK[r.pattern];
            console.log(`[REACTION:${r.pattern}] all 3 sources failed for exact tag — trying fallback category "${altPattern}"`);
            try { imageUrl = await getNekoGifUrl(altPattern); }
            catch (e) { console.log(`[REACTION:${r.pattern}] nekos.best fallback(${altPattern}) failed:`, e.message); }
            if (!imageUrl) {
                try {
                    const { data } = await axios.get(`https://api.waifu.pics/sfw/${altPattern}`, {
                        timeout: 12000, family: 4,
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                    });
                    if (data && data.url) imageUrl = data.url;
                } catch (e) { console.log(`[REACTION:${r.pattern}] waifu.pics fallback(${altPattern}) failed:`, e.message); }
            }
        }

        if (!imageUrl) {
            console.log(`[REACTION:${r.pattern}] all sources (incl. fallback) failed`);
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply(`❌ Reaction fetch failed (tried 3 sources).${FOOTER}`);
        }

        const target = (mentionedJid && mentionedJid.length) ? ` @${mentionedJid[0].split('@')[0]}` : (q ? ` ${q}` : '');
        const caption = `${r.emoji} ${r.verb}${target}${FOOTER}`;
        const mentions = (mentionedJid && mentionedJid.length) ? [mentionedJid[0]] : undefined;

        try {
            // 🚨 CHANGE (Ahmad wants GIF + text combined, big size, ONE
            // message — not a sticker+separate-text pair): stickers can't
            // carry captions, so this now converts the source gif to an
            // MP4 and sends it as a `video` message with gifPlayback:true,
            // which DOES support a caption. Sending a pre-downloaded +
            // ffmpeg-converted buffer (instead of streaming the raw url
            // straight to WhatsApp, which is what caused the old
            // "static/broken thumbnail" bug) makes the animated playback
            // reliable.
            const res = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 20000, family: 4 });
            const mp4 = await gifToVideoGif(Buffer.from(res.data));
            await conn.sendMessage(from, {
                video: mp4, gifPlayback: true, caption: toFancyBold(caption), mentions
            }, { quoted: mek });
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        } catch (e1) {
            console.log(`[REACTION:${r.pattern}] gif conversion failed, falling back to direct url:`, e1.message);
            try {
                await conn.sendMessage(from, {
                    video: { url: imageUrl }, gifPlayback: true, caption: toFancyBold(caption), mentions
                }, { quoted: mek });
                await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            } catch (e2) {
                // 🚨 RESILIENCE FIX (Ahmad: ".blush" etc → "❌ Reaction send
                // failed" on Katabump): if BOTH video attempts fail (ffmpeg
                // missing/broken on this host, or the video/gifPlayback
                // message type itself being rejected/timing out on a
                // constrained host's network), the command used to give up
                // completely with nothing sent. A plain static image is a
                // far simpler, far more reliable WhatsApp message type —
                // this sends that as a last resort so the user still gets
                // SOMETHING instead of a hard failure. Real errors are
                // logged so the actual root cause (ffmpeg vs network vs
                // WA upload) can be diagnosed from server logs.
                console.log(`[REACTION:${r.pattern}] video fallback also failed:`, e2.message);
                try {
                    await conn.sendMessage(from, {
                        image: { url: imageUrl }, caption: toFancyBold(caption), mentions
                    }, { quoted: mek });
                    await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
                } catch (e3) {
                    console.log(`[REACTION:${r.pattern}] image fallback also failed:`, e3.message);
                    await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
                    reply(`❌ Reaction send failed. (${e3.message || e2.message})${FOOTER}`);
                }
            }
        }
    });
}

module.exports = {};
