const { cmd } = require('../ahmad-core');
const { sleep } = require('../lib/functions');
const config = require('../config');
const os = require('os');
const { randomFooter, ownerOnlyDenied, toSansBoldItalic } = require('../lib/menu-styles');
const { updateUserConfig, getUserConfigFromMongoDB } = require('../lib/database');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

// 🆕 (Bunty: ".owner mein video bhi ho, owner apna naam/video khud set kar
// sakay") — 4 default videos to rotate randomly through when the owner
// hasn't set a custom one. Owner can override with .setownervideo.
const DEFAULT_OWNER_VIDEOS = [
    // 🆕 (Bunty: "all link owner videos ke remove, yeh lagao ab") — fully
    // replaced qu.ax + catbox with Bunty's own Cloudinary-hosted videos.
    // Both circle (ptv, via transcodeToVideoNote) and the normal-video
    // fallback (if transcoding ever fails) already work with any source
    // here — no extra logic needed for these specifically.
    "https://res.cloudinary.com/qdskwzyn/video/upload/v1785306179/AhmadHosting_ms5p7bh8fsfwdk.mp4",
    "https://res.cloudinary.com/qdskwzyn/video/upload/v1785306230/AhmadHosting_ms5p8fdm3lufxd.mp4",
    "https://res.cloudinary.com/qdskwzyn/video/upload/v1785306239/AhmadHosting_ms5p8lnzov25ax.mp4",
    "https://res.cloudinary.com/qdskwzyn/video/upload/v1785306283/AhmadHosting_ms5p9kh6lr7mom.mp4",
    "https://res.cloudinary.com/qdskwzyn/video/upload/v1785306305/AhmadHosting_ms5pa1bpv7dd21.mp4",
];

// 🚨 FIX (Bunty screenshot: ".owner video circle mein sahi mein nahi aa
// rahi") — ptv:true alone was never enough. WhatsApp's round video-note
// format has real requirements (square aspect ratio, H.264 video, AAC
// audio, specific container flags) — handing it a random source MP4
// (whatever aspect ratio/codec the source happens to be) with just the
// ptv flag set produces something WhatsApp can't render as a proper
// circle, which is exactly the "not playing / looks wrong" symptom.
// This crops/scales to a centered square and re-encodes to a clean H.264
// + AAC mp4 first — the same transformation a real phone does when you
// record a round video note.
async function transcodeToVideoNote(buffer) {
    const inPath = path.join(tmpdir(), `ownervid_in_${Date.now()}.mp4`);
    const outPath = path.join(tmpdir(), `ownervid_out_${Date.now()}.mp4`);
    fs.writeFileSync(inPath, buffer);
    try {
        await new Promise((resolve, reject) => {
            ffmpeg(inPath)
                .videoFilters([
                    // Crop to a centered square, then scale to a standard
                    // video-note resolution.
                    "crop='min(iw,ih)':'min(iw,ih)'",
                    'scale=480:480'
                ])
                .videoCodec('libx264')
                .audioCodec('aac')
                .outputOptions(['-preset veryfast', '-movflags +faststart', '-pix_fmt yuv420p'])
                .format('mp4')
                .on('end', resolve)
                .on('error', reject)
                .save(outPath);
        });
        const result = fs.readFileSync(outPath);
        return result;
    } finally {
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
    }
}

// =================================================================
// 🏓 UPTIME COMMAND
// =================================================================
cmd({
    pattern: "uptime",
    alias: ["speed"],
    desc: "Check bot latency and resources",
    category: "general",
    react: "👑",
    filename: __filename
}, async (conn, mek, m, { from, reply, myquoted }) => {
    try {
        await conn.sendMessage(from, {
            react: { text: "⚡", key: m.key }
        });

        const start = Date.now();

        const msg = await conn.sendMessage(from, {
            text: `╭═══ ⏳ TESTING ═══⊷\n┃❃╭──────────────\n┃❃│ ⏳ Please wait...\n┃❃╰───────────────\n╰═════════════════⊷`
        }, { quoted: myquoted });

        await sleep(500);

        const end = Date.now();
        const latency = end - start;

        // RAM Calculation
        const totalMem = (os.totalmem() / 1024 / 1024).toFixed(0);
        const freeMem = (os.freemem() / 1024 / 1024).toFixed(0);
        const usedMem = (totalMem - freeMem).toFixed(0);

        // Uptime
        const uptimeSeconds = process.uptime();
        const uptimeHours = Math.floor(uptimeSeconds / 3600);
        const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
        const uptimeSecs = Math.floor(uptimeSeconds % 60);

        // 🎨 Final Output
        const display = `╭═══ 👑 UPTIME ═══⊷
┃❃╭──────────────
┃❃│ ⚡ Latency: ${latency}ms
┃❃│ ⏳ Uptime: ${uptimeHours}h ${uptimeMinutes}m ${uptimeSecs}s
┃❃│ 💾 RAM: ${usedMem}MB / ${totalMem}MB
┃❃│ 🤖 Bot: ™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 ᥫᩣ
┃❃╰───────────────
╰═════════════════⊷

> ${randomFooter()}`;

        await conn.sendMessage(from, {
            text: display,
            edit: msg.key
        });

        await conn.sendMessage(from, {
            react: { text: "✅", key: m.key }
        });

    } catch (e) {
        console.error("Uptime Error:", e);
        await conn.sendMessage(from, {
            react: { text: "❌", key: m.key }
        });
        reply("❌ Error: " + e.message);
    }
});

// =================================================================
// 👑 OWNER COMMAND (Contact Card + Video)
// =================================================================
cmd({
    pattern: "owner",
    alias: ["creator"],
    desc: "Get bot owner contact",
    category: "general",
    react: "👑",
    filename: __filename
}, async (conn, mek, m, { from, reply, myquoted, botNumber }) => {
    try {
        await conn.sendMessage(from, {
            react: { text: "👑", key: m.key }
        });

        const ownerNumber = config.OWNER_NUMBER || "923044975027";
        const userConfig = await getUserConfigFromMongoDB(botNumber);
        const ownerDisplayName = userConfig.OWNER_NAME || 'Ahmad-Mini (Owner)';

        // 🚀 SPEED FIX (Bunty: "speed increase karo") — the video fetch used
        // to only START after the contact card had already been sent
        // (fully sequential: card → then fetch → then video). Kicking the
        // fetch off immediately, in parallel with the card send, means the
        // network round-trip for the video overlaps with that instead of
        // stacking after it — the video is often already downloaded and
        // ready by the time the card finishes sending.
        let videoFetchPromise;
        if (userConfig.OWNER_VIDEO_B64) {
            videoFetchPromise = Promise.resolve(Buffer.from(userConfig.OWNER_VIDEO_B64, 'base64'));
        } else {
            const pickVideoUrl = () => DEFAULT_OWNER_VIDEOS[Math.floor(Math.random() * DEFAULT_OWNER_VIDEOS.length)];
            const fetchVideo = async (videoUrl) => {
                let vidRes;
                try {
                    vidRes = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 10000, family: 4 });
                } catch (e1) {
                    console.log('[OWNER] video fetch attempt 1 failed:', videoUrl, e1.message);
                    await new Promise((res) => setTimeout(res, 1200));
                    vidRes = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 10000, family: 4 });
                }
                return Buffer.from(vidRes.data);
            };
            videoFetchPromise = (async () => {
                const firstUrl = userConfig.OWNER_VIDEO_URL || pickVideoUrl();
                try {
                    return await fetchVideo(firstUrl);
                } catch (e2) {
                    console.log('[OWNER] first video URL failed twice, trying a different pool entry:', e2.message);
                    // 🆕 (Bunty: "catbox extra option ke taur pe add kar do") —
                    // if the picked URL (from either the qu.ax or catbox
                    // entries now mixed in the pool) is genuinely dead, try
                    // one different URL from the pool before giving up —
                    // this is what makes it a real fallback, not just
                    // random variety.
                    let secondUrl = pickVideoUrl();
                    let guard = 0;
                    while (secondUrl === firstUrl && guard++ < 5) secondUrl = pickVideoUrl();
                    try {
                        return await fetchVideo(secondUrl);
                    } catch (e3) {
                        console.log('[OWNER] second video URL also failed:', e3.message);
                        return null;
                    }
                }
            })();
        }

        // Send Contact Card
        const vcard = 'BEGIN:VCARD\n' +
                      'VERSION:3.0\n' +
                      `FN:${ownerDisplayName}\n` +
                      'ORG:Ahmad-Mini Corp;\n' +
                      `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:${ownerNumber}\n` +
                      'END:VCARD';

        await conn.sendMessage(from, {
            contacts: {
                displayName: ownerDisplayName,
                contacts: [{ vcard }]
            }
        }, { quoted: myquoted });

        const attitudeLines = [
            "💀 No feelings, no weakness.",
            "🖤 Alone but never lonely — that's the difference.",
            "💀 Silence is power. I don't explain myself.",
            "🚫 No girl, no drama, no problem.",
            "💀 Built for the grind, not for the noise.",
            "🖤 Emotions are a bug, not a feature.",
            "💀 I don't chase. I don't reply twice either.",
            "🥶 Cold heart, warm hustle.",
            "💀 Sigma doesn't wait for replies.",
            "🖤 Loyalty to the grind only.",
            "💀 No distractions. No relationships. Just results.",
            "😎 Unbothered. Focused. Different."
        ];
        const line = attitudeLines[Math.floor(Math.random() * attitudeLines.length)];

        // 🆕 Video: owner's custom override wins if set (URL or an uploaded
        // buffer), otherwise a random pick from the 4 defaults — different
        // one nearly every time, matching "har baar random" ask.
        // 🎨 REDESIGN (Bunty: "puray bot ko full attractive, max emoji nahi
        // cheap nahi bas attractive, fonts kaafi achay" — reference card
        // shared): Sans Bold Italic headers (same font as .ping), one
        // accent emoji per line, shared LUXE+small-Ahmad footer instead of
        // a separate hardcoded double-line brand block.
        const B = toSansBoldItalic;
        const caption = `╭━━━〔 👑 ${B('OWNER PROFILE')} 〕━━━╮\n\n` +
            `🤌🏻 *${ownerDisplayName}*\n` +
            `━━━━━━━━━━━━━━━━━━\n` +
            `👤 ${B('Owner')}  ➜ Ahmad\n` +
            `📱 ${B('Contact')} ➜ +${ownerNumber}\n` +
            `🛠️ ${B('Position')} ➜ Founder & Developer\n` +
            `🟢 ${B('Status')} ➜ ${B('Online')}\n\n` +
            `«${line}»\n\n` +
            `╰━━━━━━━━━━━━━━━━━━╯\n\n` +
            `> ${randomFooter()}`;
        const videoSource = await videoFetchPromise;

        if (videoSource) {
            try {
                // 🚨 FIX (Bunty: "circle mein aati, too late aati — simple HD
                // video mein aaye usi time"): the video-note (ptv) path
                // needed an ffmpeg transcode to the square/round format
                // first, which is the main reason the video showed up late.
                // It also meant WhatsApp dropped the caption, forcing a
                // separate follow-up text message. Sending the fetched
                // buffer straight through as a normal video is both faster
                // (no transcode step) and keeps the caption attached to the
                // video itself.
                await conn.sendMessage(from, {
                    video: videoSource,
                    caption,
                    quoted: myquoted
                });
            } catch (videoErr) {
                // If the video ever fails to send (dead link, huge file, etc.)
                // don't let the whole command die silently — fall back to text.
                console.log('[OWNER] video send failed, falling back to text:', videoErr.message);
                await conn.sendMessage(from, { text: caption, quoted: myquoted });
            }
        } else {
            await conn.sendMessage(from, { text: caption, quoted: myquoted });
        }

        await conn.sendMessage(from, {
            react: { text: "✅", key: m.key }
        });

    } catch (e) {
        console.error("Owner Error:", e);
        await conn.sendMessage(from, {
            react: { text: "❌", key: m.key }
        });
        reply("❌ Error: " + e.message);
    }
});

// OWNER: set the display name shown in .owner (contact card + caption)
cmd({
    pattern: "setownername",
    desc: "OWNER: set the name shown in .owner",
    category: "owner",
    react: "👑",
    filename: __filename
}, async (conn, mek, m, { isOwner, reply, botNumber, text, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const name = (text || args.join(' ')).trim();
    if (!name) return reply('❌ Usage: .setownername Bunty Ahmad');
    if (name.length > 40) return reply('❌ Naam 40 characters se kam rakho.');
    const currentConfig = await getUserConfigFromMongoDB(botNumber);
    await updateUserConfig(botNumber, { ...currentConfig, OWNER_NAME: name });
    reply(`✅ Owner name set to: ${name}`);
});

// OWNER: set a custom .owner video — either a direct URL, or reply to a
// video to upload it (converted/stored once, reused every time after).
cmd({
    pattern: "setownervideo",
    desc: "OWNER: set a custom .owner video (URL, or reply to a video)",
    category: "owner",
    react: "🎬",
    filename: __filename
}, async (conn, mek, m, { isOwner, reply, botNumber, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    try {
        const currentConfig = await getUserConfigFromMongoDB(botNumber);
        const urlArg = (args[0] || '').trim();

        if (urlArg && /^https?:\/\//i.test(urlArg)) {
            await updateUserConfig(botNumber, { ...currentConfig, OWNER_VIDEO_URL: urlArg, OWNER_VIDEO_B64: null });
            return reply(`✅ Owner video set from URL.`);
        }

        if (m.quoted && m.quoted.mtype === 'videoMessage') {
            const buffer = await m.quoted.download();
            if (buffer.length > 15 * 1024 * 1024) return reply('❌ Video too large — send one under 15MB, or use a direct URL instead.');
            await updateUserConfig(botNumber, { ...currentConfig, OWNER_VIDEO_B64: buffer.toString('base64'), OWNER_VIDEO_URL: null });
            return reply(`✅ Owner video updated.`);
        }

        return reply('❌ Usage: .setownervideo <direct video URL>\n💡 Or reply to a video with .setownervideo (under 15MB)');
    } catch (e) {
        reply('❌ Failed: ' + e.message);
    }
});

// OWNER: revert .owner video back to the random default rotation
cmd({
    pattern: "resetownervideo",
    desc: "OWNER: revert .owner video back to the default random rotation",
    category: "owner",
    react: "♻️",
    filename: __filename
}, async (conn, mek, m, { isOwner, reply, botNumber }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const currentConfig = await getUserConfigFromMongoDB(botNumber);
    await updateUserConfig(botNumber, { ...currentConfig, OWNER_VIDEO_URL: null, OWNER_VIDEO_B64: null });
    reply('✅ Owner video reset — back to the default random rotation.');
});
