const { cmd } = require('../ahmad-core');
const axios = require('axios');

// 1. STALK COMMAND
cmd({
    pattern: "stalk",
    alias: ["wsstalk", "profileinfo"],
    desc: "Stalk a WhatsApp profile with Ahmad Simulation",
    category: "tools",
    use: ".stalk 92304xxxxxxx",
    react: "👁️"
}, async (conn, mek, m, { args, reply }) => {
    try {
        const target = args[0] ? args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net' : m.quoted ? m.quoted.sender : m.mentionedJid[0] ? m.mentionedJid[0] : null;
        if (!target) return reply("❌ *Please tag someone or provide a number!*");

        const { key } = await conn.sendMessage(m.chat, { text: "🕵️ *𝐀𝐡𝐦𝐚𝐝 𝐈𝐬 𝐒𝐭𝐚𝐥𝐤𝐢𝐧𝐠 𝐓𝐡𝐞 𝐓𝐚𝐫𝐠𝐞𝐭...*" });
        await new Promise(resolve => setTimeout(resolve, 1000));
        await conn.sendMessage(m.chat, { text: "📸 *𝐅𝐞𝐭𝐜𝐡𝐢𝐧𝐠 𝐏𝐫𝐨𝐟𝐢𝐥𝐞 𝐏𝐢𝐜𝐭𝐮𝐫𝐞...*", edit: key });
        await new Promise(resolve => setTimeout(resolve, 1000));
        await conn.sendMessage(m.chat, { text: "📝 *𝐑𝐞𝐚𝐝𝐢𝐧𝐠 𝐁𝐢𝐨 & 𝐒𝐭𝐚𝐭𝐮𝐬...*", edit: key });
        await new Promise(resolve => setTimeout(resolve, 1000));

        let ppUrl;
        try { ppUrl = await conn.profilePictureUrl(target, 'image'); } catch { ppUrl = 'https://i.ibb.co/yBVVkT2G/1000199611.png'; }
        
        const status = await conn.fetchStatus(target).catch(() => ({ status: 'N/A', setAt: 'N/A' }));
        const num = target.split('@')[0];

        const stalkMsg = `
╭━━━━━━━〔 🕵️ 𝐒𝐓𝐀𝐋𝐊 𝐑𝐄𝐏𝐎𝐑𝐓 〕━━━━━━━┈⊷
┃
┃ 👤 **𝐔𝐒𝐄𝐑:** @${num}
┃ 📝 **𝐁𝐈𝐎:** ${status.status || 'N/A'}
┃ 📅 **𝐒𝐄𝐓 𝐎𝐍:** ${status.setAt || 'N/A'}
┃ 📱 **𝐍𝐔𝐌𝐁𝐄𝐑:** ${num}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┈⊷

🔥 *𝐀𝐡𝐦𝐚𝐝 𝐊𝐧𝐨𝐰𝐬 𝐄𝐯𝐞𝐫𝐲𝐭𝐡𝐢𝐧𝐠 𝐀𝐛𝐨𝐮𝐭 𝐘𝐨𝐮!*

> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝒂𝒉𝒎𝒂𝒅`.trim();

        await conn.sendMessage(m.chat, { image: { url: ppUrl }, caption: stalkMsg, mentions: [target] });
        await conn.sendMessage(m.chat, { delete: key });

    } catch (e) { reply("❌ *Error:* " + e.message); }
});

// 2. TRACE COMMAND
cmd({
    pattern: "trace",
    alias: ["location", "network"],
    desc: "Trace number network and region (Simulation)",
    category: "tools",
    use: ".trace 0324xxxxxxx",
    react: "📍"
}, async (conn, mek, m, { args, reply }) => {
    try {
        const num = args[0];
        if (!num) return reply("❌ *Please provide a number!*");

        const { key } = await conn.sendMessage(m.chat, { text: "📡 *𝐀𝐡𝐦𝐚𝐝 𝐈𝐬 𝐓𝐫𝐚𝐜𝐢𝐧𝐠 𝐒𝐢𝐠𝐧𝐚𝐥 𝐓𝐨𝐰𝐞𝐫𝐬...*" });
        await new Promise(resolve => setTimeout(resolve, 1000));
        await conn.sendMessage(m.chat, { text: "📍 *𝐋𝐨𝐜𝐚𝐭𝐢𝐧𝐠 𝐆𝐒𝐌 𝐂𝐨𝐨𝐫𝐝𝐢𝐧𝐚𝐭𝐞𝐬...*", edit: key });
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Basic Network Logic based on prefix
        const prefix = num.substring(0, 4);
        let network = "Unknown";
        if (prefix.startsWith("030")) network = "Mobilink/Jazz";
        else if (prefix.startsWith("031")) network = "Zong";
        else if (prefix.startsWith("032")) network = "Warid";
        else if (prefix.startsWith("033")) network = "Ufone";
        else if (prefix.startsWith("034")) network = "Telenor";

        const traceMsg = `
╭━━━━━━━〔 📍 𝐓𝐑𝐀𝐂𝐄 𝐑𝐄𝐏𝐎𝐑𝐓 〕━━━━━━━┈⊷
┃
┃ 📱 **𝐍𝐔𝐌𝐁𝐄𝐑:** ${num}
┃ 📡 **𝐍𝐄𝐓𝐖𝐎𝐑𝐊:** ${network}
┃ 🌍 **𝐑𝐄𝐆𝐈𝐎𝐍:** Pakistan (Punjab/Sindh)
┃ 🛰️ **𝐒𝐓𝐀𝐓𝐔𝐒:** Active
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┈⊷

😈 *𝐀𝐡𝐦𝐚𝐝 𝐘𝐨𝐮𝐫 𝐃𝐚𝐝 𝐅𝐨𝐮𝐧𝐝 𝐘𝐨𝐮𝐫 𝐋𝐨𝐜𝐚𝐭𝐢𝐨𝐧!*

> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝒂𝒉𝒎𝒂𝒅`.trim();

        await conn.sendMessage(m.chat, { text: traceMsg, edit: key });

    } catch (e) { reply("❌ *Error:* " + e.message); }
});

// 3. IDENTITY COMMAND
cmd({
    pattern: "identity",
    alias: ["cnicinfo", "ownerinfo"],
    desc: "Check identity details (Ahmad Special Simulation)",
    category: "tools",
    use: ".identity 35201xxxxxxxx",
    react: "🪪"
}, async (conn, mek, m, { args, reply }) => {
    try {
        const cnic = args[0];
        if (!cnic) return reply("❌ *Please provide a CNIC number!*");

        const { key } = await conn.sendMessage(m.chat, { text: "🪪 *𝐀𝐡𝐦𝐚𝐝 𝐈𝐬 𝐀𝐜𝐜𝐞𝐬𝐬𝐢𝐧𝐠 𝐆𝐨𝐯𝐭 𝐃𝐚𝐭𝐚𝐛𝐚𝐬𝐞...*" });
        await new Promise(resolve => setTimeout(resolve, 1200));
        await conn.sendMessage(m.chat, { text: "🔓 *𝐃𝐞𝐜𝐫𝐲𝐩𝐭𝐢𝐧𝐠 𝐂𝐍𝐈𝐂 𝐑𝐞𝐜𝐨𝐫𝐝𝐬...*", edit: key });
        await new Promise(resolve => setTimeout(resolve, 1200));

        // Using the same API but searching by CNIC if supported, or simulation
        const apiUrl = `https://sim-info-api.wasif-ali.workers.dev/?search=${cnic}`;
        const { data } = await axios.get(apiUrl).catch(() => ({ data: null }));

        let resMsg;
        if (data && data.status && data.data !== "No record found") {
            const res = data.data;
            resMsg = `
╭━━━━━━━〔 🪪 𝐈𝐃𝐄𝐍𝐓𝐈𝐓𝐘 𝐑𝐄𝐏𝐎𝐑𝐓 〕━━━━━━━┈⊷
┃
┃ 👤 **𝐍𝐀𝐌𝐄:** ${res.name}
┃ 🆔 **𝐂𝐍𝐈𝐂:** ${res.cnic}
┃ 🏠 **𝐀𝐃𝐃𝐑𝐄𝐒𝐒:** ${res.address}
┃ 📱 **𝐋𝐈𝐍𝐊𝐄𝐃 𝐍𝐔𝐌:** ${res.number}
┃
╰━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┈⊷`.trim();
        } else {
            resMsg = "❌ *𝐀𝐡𝐦𝐚𝐝 𝐒𝐚𝐲𝐬: 𝐍𝐨 𝐝𝐢𝐫𝐞𝐜𝐭 𝐫𝐞𝐜𝐨𝐫𝐝 𝐟𝐨𝐮𝐧𝐝 𝐢𝐧 𝐭𝐡𝐢𝐬 𝐝𝐚𝐭𝐚𝐛𝐚𝐬𝐞!*";
        }

        await conn.sendMessage(m.chat, { text: resMsg + "\n\n🔥 *𝐀𝐡𝐦𝐚𝐝 𝐎𝐰𝐧𝐬 𝐓𝐡𝐢𝐬 𝐃𝐚𝐭𝐚!*\n\n> © ᴘᴏᴡᴇʀᴇᴅ ʙʏ 𝒂𝒉𝒎𝒂𝒅", edit: key });

    } catch (e) { reply("❌ *Error:* " + e.message); }
});
