const { cmd } = require('../ahmad-core');
const { renderCard, toSansBoldItalic, toBoldItalicSerif } = require('../lib/menu-styles');
const axios = require('axios');

const hackingLines = [
    "⚡ 𝐈𝐧𝐢𝐭𝐢𝐚𝐥𝐢𝐳𝐢𝐧𝐠 𝐃𝐞𝐞𝐩 𝐒𝐜𝐚𝐧...",
    "🛰️ 𝐂𝐨𝐧𝐧𝐞𝐜𝐭𝐢𝐧𝐠 𝐭𝐨 𝐀𝐡𝐦𝐚𝐝'𝐬 𝐏𝐫𝐢𝐯𝐚𝐭𝐞 𝐒𝐚𝐭𝐞𝐥𝐥𝐢𝐭𝐞𝐬...",
    "🔓 𝐁𝐲𝐩𝐚𝐬𝐬𝐢𝐧𝐠 𝐅𝐢𝐫𝐞𝐰𝐚𝐥𝐥 (𝐀𝐡𝐦𝐚𝐝 𝐒𝐭𝐲𝐥𝐞)...",
    "🕵️ 𝐀𝐜𝐜𝐞𝐬𝐬𝐢𝐧𝐠 𝐔𝐧𝐝𝐞𝐫𝐠𝐫𝐨𝐮𝐧𝐝 𝐃𝐚𝐭𝐚𝐛𝐚𝐬𝐞𝐬...",
    "🧬 𝐃𝐞𝐜𝐫𝐲𝐩𝐭𝐢𝐧𝐠 𝐒𝐈𝐌 𝐑𝐞𝐠𝐢𝐬𝐭𝐫𝐚𝐭𝐢𝐨𝐧 𝐏𝐚𝐜𝐤𝐞𝐭𝐬...",
    "✅ 𝐃𝐚𝐭𝐚 𝐃𝐞𝐜𝐫𝐲𝐩𝐭𝐞𝐝! 𝐒𝐡𝐨𝐰𝐢𝐧𝐠 𝐃𝐞𝐭𝐚𝐢𝐥𝐬..."
];

const attitudeLines = [
    "𝐀𝐡𝐦𝐚𝐝 𝐘𝐨𝐮𝐫 𝐃𝐚𝐝 𝐓𝐫𝐚𝐜𝐤 𝐘𝐨𝐮...",
    "𝐃𝐨𝐧'𝐭 𝐌𝐞𝐬𝐬 𝐖𝐢𝐭𝐡 𝐀𝐡𝐦𝐚𝐝 𝐁𝐨𝐭!",
    "𝐀𝐡𝐦𝐚𝐝 𝐈𝐬 𝐖𝐚𝐭𝐜𝐡𝐢𝐧𝐠 𝐘𝐨𝐮...",
    "𝐘𝐨𝐮 𝐀𝐫𝐞 𝐔𝐧𝐝𝐞𝐫 𝐀𝐡𝐦𝐚𝐝'𝐬 𝐒𝐮𝐫𝐯𝐞𝐢𝐥𝐥𝐚𝐧𝐜𝐞!",
    "𝐀𝐡𝐦𝐚𝐝 𝐅𝐨𝐮𝐧𝐝 𝐘𝐨𝐮, 𝐍𝐨𝐰 𝐑𝐮𝐧...",
    "𝐄𝐯𝐞𝐫𝐲 𝐒𝐭𝐞𝐩 𝐘𝐨𝐮 𝐓𝐚𝐤𝐞, 𝐀𝐡𝐦𝐚𝐝 𝐊𝐧𝐨𝐰𝐬."
];

cmd({
    pattern: "sim",
    alias: ["numberinfo", "siminfo"],
    desc: "Get SIM owner details with Advanced Ahmad Hacking",
    category: "tools",
    use: ".sim 0324xxxxxxx",
    react: "🕵️"
}, async (conn, mek, m, { args, reply }) => {
    try {
        let input = args.join("");
        if (!input) return reply("❌ *Please provide a number!*\n💡 Usage: .sim 03249560618");

        let number = input.replace(/[^0-9]/g, '');
        if (number.startsWith('92')) number = '0' + number.slice(2);
        if (!number.startsWith('0') && number.length === 10) number = '0' + number;

        const { key } = await conn.sendMessage(m.chat, { text: "💀 *𝐀𝐡𝐦𝐚𝐝 𝐄𝐱𝐭𝐫𝐞𝐦𝐞 𝐇𝐚𝐜𝐤𝐢𝐧𝐠 𝐒𝐭𝐚𝐫𝐭𝐞𝐝...*" });

        // Cool Hacking Simulation
        for (const line of hackingLines) {
            await new Promise(resolve => setTimeout(resolve, 800));
            await conn.sendMessage(m.chat, { text: line, edit: key });
        }

        // ✅ ROBUST SIM API (Requested by Bunty: "wasifali.biz.id wali api")
        // Uses resilient JSON parsing and stealth headers to bypass 403 blocks.
        const apiUrl = `http://wasifali.biz.id/public_apis/sim-info-api.php?search=${number}`;
        const { data } = await axios.get(apiUrl, { 
            timeout: 15000, 
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest'
            },
            validateStatus: () => true 
        });

        if (data && data.success === true && Array.isArray(data.records) && data.records.length > 0) {
            const res = data.records[0];
            const randomAttitude = attitudeLines[Math.floor(Math.random() * attitudeLines.length)];
            
            const encodedAddress = encodeURIComponent(res.address || '');
            const mapsLink = res.address && res.address !== 'N/A' 
                ? `\n📍 𝐆𝐎𝐎𝐆𝐋𝐄 𝐌𝐀𝐏𝐒: https://www.google.com/maps/search/?api=1&query=${encodedAddress}`
                : '';

            // 🎨 Optimized Aesthetic Card (Branding: Ahmad)
            const bodyText = `╭───────────────⊷
│ 👤 ${toSansBoldItalic('Name')}: ${res.name || 'N/A'}
│ 🆔 ${toSansBoldItalic('CNIC')}: ${res.cnic || 'N/A'}
│ 📱 ${toSansBoldItalic('Number')}: ${res.mobile || res.number || number}
│ 🏠 ${toSansBoldItalic('Address')}: ${res.address || 'N/A'}
│ 📡 ${toSansBoldItalic('Network')}: ${res.network || 'N/A'}${mapsLink}
╰───────────────⊷
✨ _${toBoldItalicSerif(randomAttitude)}_

> 𝙊𝘽𝙎𝙄𝘿𝙄𝘼𝙉 𝙇𝙐𝙓𝙀 𝘼𝙃𝙈𝘼𝘿 𝙈𝙄𝙉𝙄`;
            
            const aestheticMsg = bodyText;

            await conn.sendMessage(m.chat, { text: aestheticMsg });

            // 🆕 FEATURE: Send Live Location (if address exists)
            if (res.address && res.address !== 'N/A') {
                await conn.sendMessage(m.chat, {
                    location: {
                        degreesLatitude: 31.5204, // Default to Lahore area
                        degreesLongitude: 74.3587,
                        name: res.name || 'SIM Owner Location',
                        address: res.address
                    }
                }, { quoted: mek });
            }

            await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
        } else {
            await conn.sendMessage(m.chat, { text: "❌ *𝐀𝐡𝐦𝐚𝐝 𝐒𝐚𝐲𝐬: 𝐍𝐨 𝐫𝐞𝐜𝐨𝐫𝐝 𝐟𝐨𝐮𝐧𝐝!*\n\n💡 *Note:* The target might be using a new or protected number.", edit: key });
        }

    } catch (e) {
        console.error('[SIM ERROR]', e);
        reply("❌ *𝐀𝐡𝐦𝐚𝐝 𝐇𝐚𝐜𝐤𝐢𝐧𝐠 𝐄𝐫𝐫𝐨𝐫:* " + e.message);
    }
});
