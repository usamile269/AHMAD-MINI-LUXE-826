const { cmd } = require("../ahmad-core");
const fetch = require("node-fetch");
const yts = require("yt-search");
const axios = require("axios");
const { fakevCard } = require('../lib/fakevCard');

cmd({
pattern: "song",
alias: ["ytmp3", "play", "mp3", "gana", "music", "audio"],
react: "🎵",
desc: "YouTube search & MP3 play",
category: "download",
use: ".play ",
filename: __filename
},
async (conn, mek, m, { from, args, reply }) => {

try {

const query = args.join(" ");
if (!query) return reply("❌ Please Provide Me A song Query or Link");

await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

/* 🔍 YouTube Search */
const search = await yts(query);

if (!search.videos || !search.videos.length) {
return reply("❌ No result Found");
}

const video = search.videos[0];

/* 🎧 MP3 API (Rocket Speed) */
const apiUrl = `https://api.giftedtech.my.id/api/download/ytmp3?url=${encodeURIComponent(video.url)}&apikey=gifted`;

const res = await axios.get(apiUrl, { timeout: 30000 });

if (!res.data || !res.data.success || !res.data.result || !res.data.result.download_url) {
    return reply("❌ Audio generation failed. Try again.");
}

const dlUrl = res.data.result.download_url;
const title = res.data.result.title || video.title;

/* 🎵 SEND AUDIO */
await conn.sendMessage(from, {
audio: { url: dlUrl },
mimetype: "audio/mpeg",
ptt: false,
fileName: `${title}.mp3`,
caption:
`╭═══ 🎵 𝗬𝗢𝗨𝗧𝗨𝗕𝗘 𝗠𝗣𝟯 ═══⊷\n` +
`┃❃│ 🎵 *${title}*\n` +
`┃❃│ 👤 *${video.author.name}*\n` +
`┃❃│ ⏱️ *${video.timestamp}*\n` +
`┃❃│ 🚀 *Rocketing to you...*\n` +
`╰═════════════════⊷\n\n` +
`> 𝙊𝘽𝙎𝙄𝘿𝙄𝘼𝙉 𝙇𝙐𝙓𝙀 𝘼𝙃𝙈𝘼𝘿 𝙈𝙄𝙉𝙄`,
contextInfo: {
externalAdReply: {
title: meta.title
? meta.title.substring(0, 40)
: "YouTube Song",
body: "▶︎ •၊၊||၊|။||||။‌‌‌‌‌၊|• ★彡𝗔𝗛𝗠𝗔𝗗 𝗠𝗜𝗡𝗜 𝗕𝗘𝗔𝗧𝗦彡★",
thumbnailUrl: video.thumbnail,
sourceUrl: video.url,
mediaType: 1,
renderLargerThumbnail: true
}
}
}, { quoted: fakevCard });

await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

} catch (err) {

console.error("PLAY ERROR:", err);

reply("❌ Error Found Please Try Later");

await conn.sendMessage(from, { react: { text: "❌", key: m.key } });

}

});


cmd({
  'pattern': 'video1',
  'alias': ["vid", "ytv"],
  'desc': "Download YouTube Video",
  'category': 'downloader',
  'react': '🪄',
  'filename': __filename
}, async (_0x291138, _0x40711d, _0x320efe, {
  from: _0x3764b7,
  q: _0x247990,
  reply: _0x5286ec
}) => {
  try {
    if (!_0x247990) {
      return _0x5286ec("Please provide a YouTube link or search query.\n\nExample: .video Pasoori");
    }
    let _0x3460a4;
    if (_0x247990.includes("youtube.com") || _0x247990.includes('youtu.be')) {
      _0x3460a4 = _0x247990;
    } else {
      let _0x145978 = await yts(_0x247990);
      if (!_0x145978 || !_0x145978.videos || _0x145978.videos.length === 0x0) {
        return _0x5286ec("No results found.");
      }
      _0x3460a4 = _0x145978.videos[0x0].url;
    }
    const apiUrl = `https://api.giftedtech.my.id/api/download/ytmp4?url=${encodeURIComponent(_0x3460a4)}&apikey=gifted`;
    const res = await axios.get(apiUrl, { timeout: 45000 });
    
    if (!res.data || !res.data.success || !res.data.result || !res.data.result.download_url) {
      return _0x5286ec("❌ Video generation failed. Try again.");
    }
    
    const dlUrl = res.data.result.download_url;
    const title = res.data.result.title || "Video";

    await _0x291138.sendMessage(_0x3764b7, {
      'video': { 'url': dlUrl },
      'caption': `╭═══ 🎬 𝗬𝗢𝗨𝗧𝗨𝗕𝗘 𝗠𝗣𝟰 ═══⊷\n┃❃│ 🎬 *${title}*\n┃❃│ 🚀 *Rocketing to you...*\n╰═════════════════⊷\n\n> ✦﹒𝙊𝘽𝙎𝙄𝘿𝙄𝘼𝙉 𝙇𝙐𝙓𝙀 𝘼𝙃𝙈𝘼𝘿 𝙈𝙄𝙉𝙄`
    }, {
      'quoted': fakevCard
    });
  } catch (_0x4a5abf) {
    _0x5286ec("Error while fetching video.");
    console.log(_0x4a5abf);
  }
});
