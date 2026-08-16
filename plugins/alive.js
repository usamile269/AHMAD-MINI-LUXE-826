const { cmd } = require("../arslan");
const moment = require("moment");
const { fakevCard } = require('../lib/fakevCard');

let botStartTime = Date.now();
const ALIVE_IMG = "https://i.ibb.co/GhTS8dZ/jawadmd.jpg";

cmd({
    pattern: "alive",
    desc: "Check if the bot is active.",
    category: "owner",
    react: "👑",
    filename: __filename
}, async (conn, mek, m, { reply, from }) => {
    try {
        const pushname = m.pushName || "User";
        const currentTime = moment().tz("Asia/Karachi").format("hh:mm A");
        const currentDate = moment().tz("Asia/Karachi").format("dddd, Do MMMM YYYY");

        const ms = Date.now() - botStartTime;
        const secs  = Math.floor((ms / 1000) % 60);
        const mins  = Math.floor((ms / (1000 * 60)) % 60);
        const hours = Math.floor(ms / (1000 * 60 * 60));

        const formattedInfo = `
╔══〘 *𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 — 𝑺𝑻𝑨𝑻𝑼𝑺* 〙══╗
║
║  👋  𝗛𝗲𝘆, *${pushname}!*
║
║  🕐  𝗧𝗶𝗺𝗲    ➠  ${currentTime}
║  📅  𝗗𝗮𝘁𝗲    ➠  ${currentDate}
║  ⏳  𝗨𝗽𝘁𝗶𝗺𝗲  ➠  ${hours}h ${mins}m ${secs}s
║
╚════════════════════╝

✅  *𝘼𝙃𝙈𝘼𝘿 𝙈𝙄𝙉𝙄 𝙞𝙨 𝘼𝙇𝙄𝙑𝙀 & 𝙍𝙀𝘼𝘿𝙔!* 🚀

🏆  *𝙋𝙊𝙒𝙀𝙍𝙀𝘿 𝘽𝙔 𝘼𝙃𝙈𝘼𝘿 𝙈𝙄𝙉𝙄*
        `.trim();

        await conn.sendMessage(from, {
            image: { url: ALIVE_IMG },
            caption: formattedInfo,
            contextInfo: {
                mentionedJid: [m.sender],
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: '120363407376142647@newsletter',
                    newsletterName: '𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰',
                    serverMessageId: 143
                }
            }
        }, { quoted: fakevCard });

    } catch (error) {
        console.error("Alive Error:", error);
        return reply(`❌ *𝗘𝗿𝗿𝗼𝗿:* ${error.message}`);
    }
});
