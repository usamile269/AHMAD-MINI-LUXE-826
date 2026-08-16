const { cmd } = require('../arslan')
const yts = require('yt-search')

cmd({
    pattern: "yts",
    alias: ["ytsearch"],
    react: "🔍",
    desc: "Search videos on YouTube",
    category: "search",
    use: ".yts <video name>",
    filename: __filename
},
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return reply(
            `*🔍 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 𝗦𝗲𝗮𝗿𝗰𝗵*\n\n` +
            `*𝗨𝘀𝗮𝗴𝗲:*  .yts <video name>\n` +
            `*𝗘𝘅𝗮𝗺𝗽𝗹𝗲:*  .yts Tajdar e Haram`
        );

        const search = await yts(q)
        const videos = search.videos.slice(0, 10)

        if (videos.length === 0) return reply("*❌ 𝗡𝗼 𝗿𝗲𝘀𝘂𝗹𝘁𝘀 𝗳𝗼𝘂𝗻𝗱 𝗳𝗼𝗿 𝘆𝗼𝘂𝗿 𝗾𝘂𝗲𝗿𝘆.*");

        let text = `*📺 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 𝗦𝗲𝗮𝗿𝗰𝗵 𝗥𝗲𝘀𝘂𝗹𝘁𝘀*\n\n`;

        for (let i = 0; i < videos.length; i++) {
            const v = videos[i]
            text += `*${i + 1}.  ${v.title}*\n`;
            text += `  ⏱️  ${v.timestamp}  │  👁️  ${v.views} views\n`;
            text += `  🔗  ${v.url}\n\n`;
        }

        text += `*🏆 𝘼𝙃𝙈𝘼𝘿 𝙈𝙄𝙉𝙄 𝙒𝙃𝘼𝙏𝙎𝘼𝙋𝙋 𝘽𝙊𝙏 👑*`;

        await conn.sendMessage(from, { text }, { quoted: mek });

    } catch (e) {
        console.log("YTS ERROR:", e)
        reply("*❌ 𝗬𝗼𝘂𝗧𝘂𝗯𝗲 𝘀𝗲𝗮𝗿𝗰𝗵 𝗳𝗮𝗶𝗹𝗲𝗱. 𝗣𝗹𝗲𝗮𝘀𝗲 𝘁𝗿𝘆 𝗮𝗴𝗮𝗶𝗻.*")
    }
})
