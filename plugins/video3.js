const { cmd } = require("../ahmad-core");
const axios = require('axios');
const yts = require('yt-search');

// 🚀 SPEED FIX (Ahmad: "yeh dekho working slow but fast kar do") — the
// original tried EliteProTech, then Yupra, then Okatsu ONE AT A TIME, and
// retried EACH one up to 3 times with backoff before giving up on it and
// moving to the next. Worst case: 3 APIs x 3 attempts x 60s timeout = up to
// ~9 minutes before the command finally failed. Fixed by firing all three
// at once (Promise.any-style) with a single short timeout each — whichever
// responds first wins, dead ones are simply ignored instead of retried.
const AXIOS_DEFAULTS = {
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json, text/plain, */*' }
};

async function getEliteProTech(youtubeUrl) {
    const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(youtubeUrl)}&format=mp4`;
    const res = await axios.get(apiUrl, AXIOS_DEFAULTS);
    if (res?.data?.success && res?.data?.downloadURL) return { download: res.data.downloadURL, title: res.data.title };
    throw new Error('EliteProTech failed');
}

async function getYupra(youtubeUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await axios.get(apiUrl, AXIOS_DEFAULTS);
    if (res?.data?.success && res?.data?.data?.download_url) return { download: res.data.data.download_url, title: res.data.data.title };
    throw new Error('Yupra failed');
}

async function getOkatsu(youtubeUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(youtubeUrl)}`;
    const res = await axios.get(apiUrl, AXIOS_DEFAULTS);
    if (res?.data?.result?.mp4) return { download: res.data.result.mp4, title: res.data.result.title };
    throw new Error('Okatsu failed');
}

async function raceVideoApis(youtubeUrl) {
    return Promise.any([
        getEliteProTech(youtubeUrl),
        getYupra(youtubeUrl),
        getOkatsu(youtubeUrl)
    ]);
}

// 🚨 CRASH FIX: cap the buffer download so one big video can't OOM the
// process (same class of fix already applied in downloaders.js / video2.js)
const MAX_VIDEO_BYTES = 20 * 1024 * 1024; // 20MB

function dlBox(title, lines, emoji = '⬇️') {
    return `╭═══ ${emoji} ${title} ═══⊷\n┃❃╭──────────────\n${lines.map(l => `┃❃│ ${l}`).join('\n')}\n┃❃╰───────────────\n╰═════════════════⊷\n\n> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ ™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 ᥫᩣ`;
}

cmd({
    pattern: "video3",
    alias: ["ytmp6", "vdl3"],
    react: "🎥",
    desc: "YouTube Video Downloader (fast, multi-API)",
    category: "download",
    use: ".video3 <name or link>",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix, command }) => {
    try {
        if (!q) return reply(dlBox('VIDEO DL', [`⚠️ Use: ${prefix + command} <name or link>`], '🎥'));

        await conn.sendMessage(from, { react: { text: '🔍', key: m.key } });

        let video;
        if (/youtube\.com|youtu\.be/i.test(q)) {
            const search = await yts(q);
            video = search?.videos?.[0] || { url: q, title: 'YouTube Video', thumbnail: '' };
        } else {
            const search = await yts(q);
            if (!search?.videos?.length) return reply('❌ No video found!');
            video = search.videos[0];
        }

        await conn.sendMessage(from, {
            image: { url: video.thumbnail || 'https://i.postimg.cc/y6GV9P3H/file-000000004c307206bc366893b817568c-(1).png' },
            caption: dlBox('VIDEO DOWNLOADER', [
                `📌 ${video.title}`,
                `🎬 ${video.author?.name || 'Unknown'}`,
                `⏱ ${video.timestamp || 'N/A'}`,
                `⏳ Downloading...`
            ])
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

        let videoData;
        try {
            videoData = await raceVideoApis(video.url);
        } catch {
            return reply('❌ All download sources failed. Try `.ytmp4` instead (has a yt-dlp fallback).');
        }

        try {
            const videoBuffer = await axios.get(videoData.download, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: MAX_VIDEO_BYTES,
                maxBodyLength: MAX_VIDEO_BYTES,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            await conn.sendMessage(from, {
                video: Buffer.from(videoBuffer.data),
                mimetype: 'video/mp4',
                caption: dlBox('DONE', [`📌 ${videoData.title || video.title}`], '✅')
            }, { quoted: mek });

            await conn.sendMessage(from, { react: { text: '✅', key: m.key } });
        } catch (e) {
            return reply('❌ Video send failed (file too large — over 20MB — or invalid link).');
        }

    } catch (e) {
        console.log('VIDEO3 ERROR:', e);
        await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
        reply('⚠️ Something went wrong!');
    }
});
