const { cmd } = require("../ahmad-core");
const axios = require('axios');
const yts = require('yt-search');

// 🚀 SPEED FIX — original tried 5 APIs (EliteProTech, Yupra, Okatsu, Alya,
// Vreden) one at a time, retrying EACH up to 3 times before moving on.
// Worst case: 5 x 3 x up to 120s timeout = could take 10+ minutes to
// finally fail. Fixed the same way as video3.js: race all 5 at once with a
// single short timeout each, first success wins, dead ones just get
// ignored instead of retried.
const AXIOS_DEFAULTS = {
    timeout: 10000,
    headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json, text/plain, */*' }
};

async function getEliteProTech(url) {
    const res = await axios.get(`https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}&format=mp3`, AXIOS_DEFAULTS);
    if (res?.data?.success && res?.data?.downloadURL) return { download: res.data.downloadURL, title: res.data.title };
    throw new Error('EliteProTech failed');
}
async function getYupra(url) {
    const res = await axios.get(`https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(url)}`, AXIOS_DEFAULTS);
    if (res?.data?.success && res?.data?.data?.download_url) return { download: res.data.data.download_url, title: res.data.data.title };
    throw new Error('Yupra failed');
}
async function getOkatsu(url) {
    const res = await axios.get(`https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(url)}`, AXIOS_DEFAULTS);
    if (res?.data?.dl) return { download: res.data.dl, title: res.data.title };
    throw new Error('Okatsu failed');
}
async function getAlya(url) {
    const res = await axios.get(`https://api.alyachan.pro/api/ytmp3?url=${encodeURIComponent(url)}&apikey=G7I6X7`, AXIOS_DEFAULTS);
    if (res?.data?.status && res?.data?.data?.url) return { download: res.data.data.url, title: res.data.data.title };
    throw new Error('Alya failed');
}
async function getVreden(url) {
    const res = await axios.get(`https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(url)}`, AXIOS_DEFAULTS);
    if (res?.data?.status && res?.data?.result?.download?.url) return { download: res.data.result.download.url, title: res.data.result.metadata.title };
    throw new Error('Vreden failed');
}

async function raceAudioApis(url) {
    return Promise.any([getEliteProTech(url), getYupra(url), getOkatsu(url), getAlya(url), getVreden(url)]);
}

// 🚨 CRASH FIX: original had ZERO size limit on the audio buffer download —
// straight OOM risk on a memory-tight host. Capped at 20MB (comfortably
// covers a normal-length song).
const MAX_AUDIO_BYTES = 20 * 1024 * 1024;

function dlBox(title, lines, emoji = '⬇️') {
    return `╭═══ ${emoji} ${title} ═══⊷\n┃❃╭──────────────\n${lines.map(l => `┃❃│ ${l}`).join('\n')}\n┃❃╰───────────────\n╰═════════════════⊷\n\n> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ ™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 ᥫᩣ`;
}

cmd({
    pattern: "song2",
    alias: ["mp3dl", "audio2"],
    react: "🎵",
    desc: "YouTube Audio Downloader (fast, multi-API)",
    category: "download",
    use: ".song2 <song name or link>",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix, command }) => {
    try {
        if (!q) return reply(dlBox('AUDIO DL', [`⚠️ Use: ${prefix + command} <song name or link>`], '🎵'));

        await conn.sendMessage(from, { react: { text: '🔍', key: m.key } });

        let video;
        if (/youtube\.com|youtu\.be/i.test(q)) {
            video = { url: q, title: 'YouTube Audio', thumbnail: '' };
        } else {
            const search = await yts(q);
            if (!search?.videos?.length) return reply('❌ No results found.');
            video = search.videos[0];
        }

        await conn.sendMessage(from, {
            image: { url: video.thumbnail || 'https://i.postimg.cc/y6GV9P3H/file-000000004c307206bc366893b817568c-(1).png' },
            caption: dlBox('AUDIO DOWNLOADER', [`🎵 ${video.title}`, `⏱ ${video.timestamp || 'N/A'}`, `⏳ Downloading...`])
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '⏳', key: m.key } });

        let audioData;
        try {
            audioData = await raceAudioApis(video.url);
        } catch {
            return reply('❌ All download sources failed. Try `.ytmp3`/`.play` instead.');
        }

        try {
            const audioRes = await axios.get(audioData.download, {
                responseType: 'arraybuffer',
                timeout: 60000,
                maxContentLength: MAX_AUDIO_BYTES,
                maxBodyLength: MAX_AUDIO_BYTES,
                headers: { 'User-Agent': 'Mozilla/5.0' }
            });

            await conn.sendMessage(from, {
                audio: Buffer.from(audioRes.data),
                mimetype: 'audio/mpeg',
                fileName: `${(audioData.title || video.title).replace(/[^\w\s-]/g, '')}.mp3`,
                ptt: false
            }, { quoted: mek });

            await conn.sendMessage(from, { react: { text: '✅', key: m.key } });
        } catch (e) {
            return reply('❌ Audio send failed (file too large — over 20MB — or invalid link).');
        }

    } catch (e) {
        console.log('SONG2 ERROR:', e);
        await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
        reply('⚠️ Something went wrong!');
    }
});
