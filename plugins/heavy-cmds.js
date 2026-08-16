const { cmd } = require('../ahmad-core');

// 1. CLONE COMMAND (Owner Only)
cmd({
    pattern: "clone",
    desc: "Clone target's DP and Bio (Owner Only)",
    category: "owner",
    use: ".clone @user",
    react: "👥"
}, async (conn, mek, m, { isOwner, reply, mentionedJid, quoted }) => {
    try {
        if (!isOwner) return reply("❌ *Ahmad Only Command!*");
        const target = mentionedJid[0] || (quoted ? quoted.sender : null);
        if (!target) return reply("❌ *Tag someone to clone!*");

        await reply("🔄 *𝐀𝐡𝐦𝐚𝐝 𝐈𝐬 𝐂𝐥𝐨𝐧𝐢𝐧𝐠 𝐓𝐡𝐞 𝐈𝐝𝐞𝐧𝐭𝐢𝐭𝐲...*");

        // Clone DP
        let ppUrl;
        try {
            ppUrl = await conn.profilePictureUrl(target, 'image');
            const buffer = await axios.get(ppUrl, { responseType: 'arraybuffer' }).then(res => Buffer.from(res.data));
            await conn.updateProfilePicture(conn.user.id, buffer);
        } catch { await reply("⚠️ *Could not clone DP (Privacy).*"); }

        // Clone Bio
        try {
            const status = await conn.fetchStatus(target);
            if (status && status.status) await conn.updateProfileStatus(status.status);
        } catch { await reply("⚠️ *Could not clone Bio.*"); }

        await reply("✅ *𝐈𝐝𝐞𝐧𝐭𝐢𝐭𝐲 𝐂𝐥𝐨𝐧𝐞𝐝 𝐒𝐮𝐜𝐜𝐞𝐬𝐬𝐟𝐮𝐥𝐥𝐲!* \n\n> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝒂𝒉𝒎𝒂𝒅");
    } catch (e) { reply("❌ *Error:* " + e.message); }
});

// 2. SHOUT COMMAND (Owner Only)
cmd({
    pattern: "shout",
    alias: ["broadcast", "bc"],
    desc: "Broadcast a heavy message to all groups (Owner Only)",
    category: "owner",
    use: ".shout [message]",
    react: "📢"
}, async (conn, mek, m, { isOwner, reply, text }) => {
    try {
        if (!isOwner) return reply("❌ *Ahmad Only Command!*");
        if (!text) return reply("❌ *Provide a message to shout!*");

        const groups = Object.keys(await conn.groupFetchAllParticipating());
        await reply(`📢 *𝐀𝐡𝐦𝐚𝐝 𝐈𝐬 𝐒𝐡𝐨𝐮𝐭𝐢𝐧𝐠 𝐓𝐨 ${groups.length} 𝐆𝐫𝐨𝐮𝐩𝐬...*`);

        const shoutMsg = `
╭━━━━━━━〔 📢 𝐀𝐇𝐌𝐀𝐃 𝐒𝐇𝐎𝐔𝐓 〕━━━━━━━┈⊷
┃
┃ 📣 **𝐌𝐄𝐒𝐒𝐀𝐆𝐄:** ${text}
┃ 👑 **𝐒𝐄𝐍𝐃𝐄𝐑:** 𝐀𝐡𝐦𝐚𝐝 (𝐎𝐰𝐧𝐞𝐫)
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┈⊷

🔥 *𝐀𝐡𝐦𝐚𝐝 𝐈𝐬 𝐈𝐧 𝐂𝐨𝐧𝐭𝐫𝐨𝐥 — 𝐋𝐢𝐬𝐭𝐞𝐧 𝐔𝐩!*

> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝒂𝒉𝒎𝒂𝒅`.trim();

        for (let jid of groups) {
            await conn.sendMessage(jid, { text: shoutMsg });
            await new Promise(resolve => setTimeout(resolve, 1000)); // Delay to avoid ban
        }

        await reply("✅ *𝐒𝐡𝐨𝐮𝐭 𝐂𝐨𝐦𝐩𝐥𝐞𝐭𝐞𝐝 𝐒𝐮𝐜𝐜𝐞𝐬𝐬𝐟𝐮𝐥𝐥𝐲!*");
    } catch (e) { reply("❌ *Error:* " + e.message); }
});
