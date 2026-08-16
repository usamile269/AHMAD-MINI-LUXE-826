const { cmd } = require('../ahmad-core');
const { toSansBoldItalic, toBoldItalicSerif, randomFooter } = require('../lib/menu-styles');
const config = require('../config');
const axios = require('axios');

cmd({
    pattern: 'banchk',
    alias: ['numcheck', 'checkban'],
    desc: 'Check if a number is banned or active on WhatsApp',
    category: 'tools',
    filename: __filename
}, async (conn, mek, m, { from, q, reply, mentionedJid, sender }) => {
    let target = q ? q.replace(/[^0-9]/g, '') : (mentionedJid && mentionedJid[0] ? mentionedJid[0].split('@')[0] : null);
    if (!target) return reply("❌ Usage: .banchk 923xxxxxxxxx");

    try {
        await conn.sendMessage(from, { react: { text: '🔎', key: mek.key } });
        const jid = `${target}@s.whatsapp.net`;
        
        let status = 'UNKNOWN';
        let banType = 'N/A';
        let exists = false;

        // 1. Try Meta Graph API (if configured)
        if (config.META_ACCESS_TOKEN && config.PHONE_NUMBER_ID) {
            try {
                const res = await axios.post(
                    `https://graph.facebook.com/v17.0/${config.PHONE_NUMBER_ID}/messages`,
                    { messaging_product: 'whatsapp', to: target, type: 'text', text: { body: 'ping' } },
                    { headers: { Authorization: `Bearer ${config.META_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }, timeout: 10000 }
                ).catch(e => e.response);
                
                const code = res?.data?.error?.code || 0;
                if (res.status === 200) { exists = true; status = 'ACTIVE'; }
                else if (code === 131026) { exists = false; status = 'NOT REGISTERED'; }
                else if ([368, 131031].includes(code)) { exists = false; status = 'BANNED'; banType = 'PERMANENT'; }
                else if (code === 131047) { exists = true; status = 'RESTRICTED'; banType = 'TEMPORARY'; }
            } catch (e) { console.log("Meta API Error:", e.message); }
        }

        // 2. Fallback to Baileys onWhatsApp
        if (status === 'UNKNOWN') {
            const result = await conn.onWhatsApp(jid);
            exists = result && result[0] && result[0].exists;
            status = exists ? 'ACTIVE' : 'BANNED / INACTIVE';
        }

        const B = toSansBoldItalic;
        const S = toBoldItalicSerif;
        const botName = config.BOT_NAME || 'AHMAD MINI';

        const bannedMsgs = [
            "Ahmad your dad fuck the number stay away from bunty",
            "Target Down! Ahmad your dad destroyed this number",
            "Ahmad your dad already banned this number. Don't touch bunty!",
            "Number Fucked by Ahmad your dad! Stay away or you're next"
        ];

        const activeMsgs = [
            "Soon Ahmad ban the number keep away hacker",
            "Target spotted! Ahmad will ban this number soon",
            "Ahmad is tracking this number. Ban coming soon...",
            "Number is active but Ahmad your dad is coming for it"
        ];

        const randomBanned = bannedMsgs[Math.floor(Math.random() * bannedMsgs.length)];
        const randomActive = activeMsgs[Math.floor(Math.random() * activeMsgs.length)];

        let messageText = `*↳ ❝ [🔎 ${B('AHMAD BAN CHECK')} 🔎] ¡! ❞*\n\n` +
            `┌──────────────────\n` +
            `│ 🎯 ${B('TARGET')} : +${target}\n` +
            `│ ⚙️ ${B('STATUS')} : ${B(status)}\n` +
            `│ 🚫 ${B('TYPE')}   : ${B(banType)}\n` +
            `└──────────────────\n\n` +
            `*${S(exists ? randomActive : randomBanned)}* 💀🔥\n\n` +
            `> ${randomFooter()}`;

        await conn.sendMessage(from, {
            text: messageText,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.CHANNEL_JID || "120363427856127926@newsletter",
                    newsletterName: botName,
                    serverMessageId: 2,
                },
                mentionedJid: [sender]
            }
        }, { quoted: mek });

    } catch (e) {
        reply("❌ Ahmad Check failed: " + e.message);
    }
});
