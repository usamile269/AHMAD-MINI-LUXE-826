const config = require('../config')
const { cmd, commands } = require('../arslan')
const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('../lib/functions')

cmd({
    pattern: "tagall",
    react: "👑",
    alias: ["gc_tagall"],
    desc: "Tag all members in the group",
    category: "group",
    use: '.tagall [message]',
    filename: __filename
},
async (conn, mek, m, { from, participants, reply, isGroup, senderNumber, groupAdmins, prefix, command, args, body }) => {
    try {
        if (!isGroup) return reply("*❌ 𝗧𝗵𝗶𝘀 𝗰𝗼𝗺𝗺𝗮𝗻𝗱 𝗶𝘀 𝗳𝗼𝗿 𝗴𝗿𝗼𝘂𝗽𝘀 𝗼𝗻𝗹𝘆.*");

        const botOwner = conn.user.id.split(":")[0];
        const senderJid = senderNumber + "@s.whatsapp.net";

        if (!groupAdmins.includes(senderJid) && senderNumber !== botOwner) {
            return reply("*❌ 𝗢𝗻𝗹𝘆 𝗮𝗱𝗺𝗶𝗻𝘀 𝗰𝗮𝗻 𝘂𝘀𝗲 𝘁𝗵𝗶𝘀 𝗰𝗼𝗺𝗺𝗮𝗻𝗱.*");
        }

        let groupInfo = await conn.groupMetadata(from).catch(() => null);
        if (!groupInfo) return reply("*❌ 𝗙𝗮𝗶𝗹𝗲𝗱 𝘁𝗼 𝗳𝗲𝘁𝗰𝗵 𝗴𝗿𝗼𝘂𝗽 𝗶𝗻𝗳𝗼.*");

        let groupName   = groupInfo.subject || "Unknown Group";
        let totalMembers = participants ? participants.length : 0;
        if (totalMembers === 0) return reply("❌ *𝗡𝗼 𝗺𝗲𝗺𝗯𝗲𝗿𝘀 𝗳𝗼𝘂𝗻𝗱.*");

        let message = body.slice(body.indexOf(command) + command.length).trim();
        if (!message) message = "📢 Attention Everyone!";

        let teks = `
╔══〘 *𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 — 𝑻𝑨𝑮 𝑨𝑳𝑳* 〙══╗
║
║  🫂  𝗚𝗿𝗼𝘂𝗽   ➠  ${groupName}
║  👥  𝗠𝗲𝗺𝗯𝗲𝗿𝘀 ➠  ${totalMembers}
║  📢  𝗠𝗲𝘀𝘀𝗮𝗴𝗲 ➠  ${message}
║
╚════════════════════╝

*👥 𝗠𝗲𝗺𝗯𝗲𝗿𝘀 𝗟𝗶𝘀𝘁:*\n`;

        for (let mem of participants) {
            if (!mem.id) continue;
            teks += `  ◈ @${mem.id.split('@')[0]}\n`;
        }

        teks += `\n*🏆 𝘼𝙃𝙈𝘼𝘿 𝙈𝙄𝙉𝙄 𝙒𝙃𝘼𝙏𝙎𝘼𝙋𝙋 𝘽𝙊𝙏 👑*`;

        conn.sendMessage(from, { text: teks, mentions: participants.map(a => a.id) }, { quoted: mek });

    } catch (e) {
        console.error("TagAll Error:", e);
        reply(`❌ *𝗘𝗿𝗿𝗼𝗿:* ${e.message || e}`);
    }
});
