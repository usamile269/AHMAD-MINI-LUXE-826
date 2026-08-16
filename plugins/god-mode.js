const { cmd } = require('../ahmad-core');
const config = require('../config');

// 1. AHMAD GOD MODE COMMAND
cmd({
    pattern: "godmode",
    alias: ["extreme", "ahmadmode"],
    desc: "Activate/Deactivate Ahmad God Mode (Ultimate Protection)",
    category: "owner",
    react: "👑"
}, async (conn, mek, m, { args, isOwner, reply }) => {
    if (!isOwner) return reply("❌ *Owner Only Command!*");
    
    const status = args[0]?.toLowerCase();
    if (status === 'on') {
        config.ANTIDELETE = 'true';
        config.ANTIEDIT = 'true';
        config.AUTO_READ_STATUS = 'true';
        config.AUTO_TYPING = 'true';
        config.AD_REPLY = 'true';
        
        const godMsg = `
╭━━━━━━━〔 👑 𝐆𝐎𝐃 𝐌𝐎𝐃𝐄: 𝐎𝐍 〕━━━━━━━┈⊷
┃
┃ 🛡️ **𝐀𝐍𝐓𝐈-𝐃𝐄𝐋𝐄𝐓𝐄:** Active
┃ 🛡️ **𝐀𝐍𝐓𝐈-𝐄𝐃𝐈𝐓:** Active
┃ 👁️ **𝐒𝐓𝐀𝐓𝐔𝐒 𝐕𝐈𝐄𝐖:** Auto
┃ ⌨️ **𝐓𝐘𝐏𝐈𝐍𝐆:** Stealth
┃ ⚡ **𝐒𝐘𝐒𝐓𝐄𝐌:** Ahmad Extreme God Mode
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┈⊷

🔥 *𝐀𝐡𝐦𝐚𝐝 𝐇𝐚𝐬 𝐁𝐞𝐜𝐨𝐦𝐞 𝐔𝐧𝐬𝐭𝐨𝐩𝐩𝐚𝐛𝐥𝐞!*

> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝒂𝒉𝒎𝒂𝒅`.trim();
        await reply(godMsg);
    } else if (status === 'off') {
        config.ANTIDELETE = 'false';
        config.ANTIEDIT = 'false';
        await reply("❌ *𝐆𝐎𝐃 𝐌𝐎𝐃𝐄: 𝐃𝐄𝐀𝐂𝐓𝐈𝐕𝐀𝐓𝐄𝐃*");
    } else {
        reply("💡 *Usage:* .godmode on/off");
    }
});
