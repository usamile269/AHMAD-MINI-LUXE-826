const { cmd } = require('../arslan');
const axios = require('axios');

cmd({
  pattern: "fb",
  react: "🎬",
  alias: ["facebook", "fbdl"],
  category: "download",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply(
      `*🎬 𝗙𝗮𝗰𝗲𝗯𝗼𝗼𝗸 𝗩𝗶𝗱𝗲𝗼 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱𝗲𝗿*\n\n` +
      `*𝗨𝘀𝗮𝗴𝗲:*  .fb <facebook video link>\n` +
      `*𝗘𝘅𝗮𝗺𝗽𝗹𝗲:*  .fb https://fb.com/video/...`
    );

    const apiUrl = `https://movanest.xyz/v2/fbdown?url=${encodeURIComponent(q)}`;
    const res = await axios.get(apiUrl);
    const data = res.data;

    if (data.status !== true) return reply("*❌ 𝗔𝗣𝗜 𝗘𝗿𝗿𝗼𝗿. 𝗣𝗹𝗲𝗮𝘀𝗲 𝘁𝗿𝘆 𝗮𝗴𝗮𝗶𝗻.*");
    if (!Array.isArray(data.results) || data.results.length === 0) return reply("*❌ 𝗩𝗶𝗱𝗲𝗼 𝗻𝗼𝘁 𝗳𝗼𝘂𝗻𝗱. 𝗖𝗵𝗲𝗰𝗸 𝗹𝗶𝗻𝗸 𝗮𝗻𝗱 𝘁𝗿𝘆 𝗮𝗴𝗮𝗶𝗻.*");

    const result = data.results[0];
    const videoUrl = result.hdQualityLink ? result.hdQualityLink : result.normalQualityLink;

    if (!videoUrl) return reply("*❌ 𝗣𝗹𝗲𝗮𝘀𝗲 𝗽𝗿𝗼𝘃𝗶𝗱𝗲 𝗮 𝘃𝗮𝗹𝗶𝗱 𝗙𝗮𝗰𝗲𝗯𝗼𝗼𝗸 𝘃𝗶𝗱𝗲𝗼 𝗹𝗶𝗻𝗸.*");

    const caption = `
╔══〘 *𝑭𝑩 𝑽𝑰𝑫𝑬𝑶* 〙══╗
║  ⏱️  𝗗𝘂𝗿𝗮𝘁𝗶𝗼𝗻  ➠  ${result.duration}
║  👤  𝗖𝗿𝗲𝗮𝘁𝗼𝗿   ➠  ${data.creator}
╚══════════════════╝

*🏆 𝘼𝙃𝙈𝘼𝘿 𝙈𝙄𝙉𝙄 👑*`.trim();

    await conn.sendMessage(from, {
      video: { url: videoUrl },
      mimetype: "video/mp4",
      caption
    }, { quoted: mek });

  } catch (err) {
    console.log(err);
    reply("*❌ 𝗗𝗼𝘄𝗻𝗹𝗼𝗮𝗱 𝗳𝗮𝗶𝗹𝗲𝗱. 𝗣𝗹𝗲𝗮𝘀𝗲 𝘁𝗿𝘆 𝗮𝗴𝗮𝗶𝗻.*");
  }
});
