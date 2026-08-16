const { cmd } = require('../ahmad-core');

// 3. TAGALL COMMAND (Heavy Attitude Style)
cmd({
    pattern: "tagall",
    alias: ["everyone", "all"],
    desc: "Tag everyone in the group with heavy attitude",
    category: "group",
    use: ".tagall [message]",
    react: "📣"
}, async (conn, mek, m, { isGroup, isAdmins, isOwner, reply, text, participants, from }) => {
    try {
        if (!isGroup) return reply("❌ *Group only command!*");
        if (!isAdmins && !isOwner) return reply("❌ *Admins or Ahmad only!*");

        let header = `
╭━━━━━━━〔 📣 𝐀𝐇𝐌𝐀𝐃 𝐓𝐀𝐆 𝐀𝐋𝐋 〕━━━━━━━┈⊷
┃
┃ 📢 **𝐌𝐄𝐒𝐒𝐀𝐆𝐄:** ${text || 'Wake Up Everyone!'}
┃ 👑 **𝐒𝐔𝐌𝐌𝐎𝐍𝐄𝐑:** 𝐀𝐡𝐦𝐚𝐝 𝐒𝐭𝐲𝐥𝐞
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┈⊷

🔥 *𝐃𝐨𝐧'𝐭 𝐈𝐠𝐧𝐨𝐫𝐞 𝐀𝐡𝐦𝐚𝐝'𝐬 𝐂𝐚𝐥𝐥!*

`;
        let body = "";
        let mentions = [];
        for (let mem of participants) {
            body += `┃ ⚡ @${mem.id.split('@')[0]}\n`;
            mentions.push(mem.id);
        }
        body += `╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┈⊷\n\n> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝒂𝒉𝒎𝒂𝒅`;

        await conn.sendMessage(from, { text: header + body, mentions: mentions });
    } catch (e) { reply("❌ *Error:* " + e.message); }
});

// 4. FAKECALL COMMAND (Prank Visual)
cmd({
    pattern: "fakecall",
    alias: ["pcall", "prankcall"],
    desc: "Generate a fake calling visual (Prank)",
    category: "prank",
    use: ".fakecall @user",
    react: "📞"
}, async (conn, mek, m, { reply, mentionedJid, quoted }) => {
    try {
        const target = mentionedJid[0] || (quoted ? quoted.sender : null);
        if (!target) return reply("❌ *Tag someone for fake call!*");
        const num = target.split('@')[0];

        const fakeCallMsg = `
╭━━━━━━━〔 📞 𝐈𝐍𝐂𝐎𝐌𝐈𝐍𝐆 𝐂𝐀𝐋𝐋 〕━━━━━━━┈⊷
┃
┃ 👤 **𝐂𝐀𝐋𝐋𝐄𝐑:** ${num}
┃ ⚡ **𝐒𝐓𝐀𝐓𝐔𝐒:** Calling...
┃ ⏳ **𝐃𝐔𝐑𝐀𝐓𝐈𝐎𝐍:** 00:00
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┈⊷

🚨 *𝐀𝐡𝐦𝐚𝐝 𝐈𝐬 𝐂𝐚𝐥𝐥𝐢𝐧𝐠 𝐘𝐨𝐮... 𝐏𝐢𝐜𝐤 𝐔𝐩!*

[ 🟢 𝐀𝐜𝐜𝐞𝐩𝐭 ]      [ 🔴 𝐑𝐞𝐣𝐞𝐜𝐭 ]

> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝒂𝒉𝒎𝒂𝒅`.trim();

        await reply(fakeCallMsg);
    } catch (e) { reply("❌ *Error:* " + e.message); }
});
