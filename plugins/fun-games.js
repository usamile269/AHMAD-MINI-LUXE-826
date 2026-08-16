const { cmd } = require('../ahmad-core');
const config = require('../config');
const { getStatsForNumber } = require('../lib/database');
const { toFancyBold } = require('../lib/text-style');
const { randomFooter } = require('../lib/menu-styles');

// ══════════════════════════════════════════════════════════════════════════
// 🎲 FUN GAMES PACK — quick text-based fun commands, same harmless-joke
// spirit as the hack-fun pack. No external APIs, instant replies.
// ══════════════════════════════════════════════════════════════════════════

const FOOTER = "\n\n> " + randomFooter();
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const targetOf = (mentionedJid, q) => (mentionedJid && mentionedJid.length) ? `@${mentionedJid[0].split('@')[0]}` : (q || 'you');
const mentionsOf = (mentionedJid) => (mentionedJid && mentionedJid.length) ? [mentionedJid[0]] : undefined;
// Sent directly (not via the shared reply()) whenever a message needs an
// actual clickable @mention — reply() doesn't forward a `mentions` array,
// same reason reactions.js sends its captions this way.
const sendTagged = (conn, from, mek, text, mentions) =>
    conn.sendMessage(from, { text: toFancyBold(text), mentions }, { quoted: mek });

// ── .roast ───────────────────────────────────────────────────────────────
const roasts = [
    "you're the reason WhatsApp added the 'delete for everyone' button 💀",
    "you have the confidence of a main character in a side character's life 😭",
    "even your WiFi disconnects to avoid you 📶💔",
    "you're proof that not every download completes successfully 📉",
    "you type '...' more than you actually finish sentences ⌛",
    "you're like a software update — nobody asked, but here you are 🔄",
    "your best angle is a screenshot from 2019 📸",
    "you give off 'left on read but still typing' energy ✍️"
];
cmd({ pattern: "roast", alias: ["roastme"], desc: "😈 Savage roast generator — for fun only", category: "fun", react: "😈", filename: __filename },
async (conn, mek, m, { from, reply, mentionedJid, q }) => {
    const target = targetOf(mentionedJid, q);
    const text = `😈 *ROAST INCOMING*\n\n${target}, ${pick(roasts)}${FOOTER}`;
    mentionedJid && mentionedJid.length ? sendTagged(conn, from, mek, text, mentionsOf(mentionedJid)) : reply(text);
});

// ── .iq / .simp meters ──────────────────────────────────────────────────
function meterBox(title, emoji, target, pct, verdictArr) {
    const filled = Math.round(pct / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    const verdict = verdictArr[Math.min(verdictArr.length - 1, Math.floor(pct / (100 / verdictArr.length)))];
    return `╭═══ ${emoji} ${title} ═══⊷\n┃❃│ Target : ${target}\n┃❃│ [${bar}] ${pct}%\n┃❃│ Verdict: ${verdict}\n╰═════════════════⊷${FOOTER}`;
}
cmd({ pattern: "iq", alias: ["iqtest"], desc: "🧠 Random IQ meter — for fun only", category: "fun", react: "🧠", filename: __filename },
async (conn, mek, m, { from, reply, mentionedJid, q }) => {
    const target = targetOf(mentionedJid, q);
    const text = meterBox('IQ METER', '🧠', target, Math.floor(Math.random() * 101), ['brick 🧱', 'still loading... 🔄', 'average human 🙂', 'big brain 🧠', 'certified genius 🎓']);
    mentionedJid && mentionedJid.length ? sendTagged(conn, from, mek, text, mentionsOf(mentionedJid)) : reply(text);
});
cmd({ pattern: "simp", alias: ["simpmeter"], desc: "💘 Random simp meter — for fun only", category: "fun", react: "💘", filename: __filename },
async (conn, mek, m, { from, reply, mentionedJid, q }) => {
    const target = targetOf(mentionedJid, q);
    const text = meterBox('SIMP METER', '💘', target, Math.floor(Math.random() * 101), ['ice cold 🧊', 'a little soft 🥺', 'certified simp 💘', 'end-stage simp 🚨', 'legendary simp 👑']);
    mentionedJid && mentionedJid.length ? sendTagged(conn, from, mek, text, mentionsOf(mentionedJid)) : reply(text);
});

// ── .shipmeter ───────────────────────────────────────────────────────────
cmd({ pattern: "shipmeter", alias: ["ship"], desc: "💞 Compatibility meter between two people", category: "fun", react: "💞", filename: __filename },
async (conn, mek, m, { from, reply, mentionedJid }) => {
    if (!mentionedJid || mentionedJid.length < 2) return reply(`❌ Tag 2 people: *.shipmeter @person1 @person2*${FOOTER}`);
    const p1 = `@${mentionedJid[0].split('@')[0]}`, p2 = `@${mentionedJid[1].split('@')[0]}`;
    const pct = Math.floor(Math.random() * 101);
    const filled = Math.round(pct / 10);
    const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
    const verdict = pct > 80 ? 'soulmates 💍' : pct > 50 ? 'cute couple 🌸' : pct > 25 ? 'just friends 🤝' : 'run 🏃💨';
    const text = `╭═══ 💞 SHIP METER ═══⊷\n┃❃│ ${p1} × ${p2}\n┃❃│ [${bar}] ${pct}%\n┃❃│ Verdict: ${verdict}\n╰═════════════════⊷${FOOTER}`;
    sendTagged(conn, from, mek, text, [mentionedJid[0], mentionedJid[1]]);
});

// ── .liedetector ─────────────────────────────────────────────────────────
cmd({ pattern: "liedetector", desc: "🚨 Fake lie detector — for fun only", category: "fun", react: "🚨", filename: __filename },
async (conn, mek, m, { reply, q }) => {
    const pct = Math.floor(Math.random() * 101);
    const verdict = pct > 70 ? 'LIE DETECTED 🚨' : pct > 30 ? 'suspicious... 🤨' : 'seems legit ✅';
    reply(`🚨 *LIE DETECTOR*\n\n┃❃│ Statement: "${q || 'your last message'}"\n┃❃│ Truth score: ${100 - pct}%\n┃❃│ Result: ${verdict}${FOOTER}`);
});

// ── .8ball ───────────────────────────────────────────────────────────────
const ballAnswers = ["Yes, definitely ✅", "No way ❌", "Ask again later 🔄", "Absolutely 💯", "Very doubtful 😬", "It is certain 🔮", "My sources say no 📉", "Without a doubt ✨"];
cmd({ pattern: "8ball", alias: ["magic8"], desc: "🎱 Magic 8-ball — ask it a yes/no question", category: "fun", react: "🎱", filename: __filename },
async (conn, mek, m, { reply, q }) => {
    if (!q) return reply(`❌ Ask a question: *.8ball will I pass my exam?*${FOOTER}`);
    reply(`🎱 ${q}\n\n➜ ${pick(ballAnswers)}${FOOTER}`);
});

// ── .rate ────────────────────────────────────────────────────────────────
cmd({ pattern: "rate", desc: "⭐ Rate anything out of 10 — for fun only", category: "fun", react: "⭐", filename: __filename },
async (conn, mek, m, { from, reply, q, mentionedJid }) => {
    const target = targetOf(mentionedJid, q);
    const score = (Math.random() * 10).toFixed(1);
    const text = `⭐ *RATING*\n\n${target} → ${score}/10 ⭐${FOOTER}`;
    mentionedJid && mentionedJid.length ? sendTagged(conn, from, mek, text, mentionsOf(mentionedJid)) : reply(text);
});

// ── .topcmds ─────────────────────────────────────────────────────────────
// Reads the last 30 days of Stats docs (saved via incrementStats in main.js
// as `cmd_<name>` fields) for this bot number and shows the most-used
// commands. Works with both Mongo and the local-JSON fallback.
cmd({ pattern: "topcmds", alias: ["cmdstats", "usagestats"], desc: "📊 Most-used commands leaderboard", category: "info", react: "📊", filename: __filename },
async (conn, mek, m, { reply, botNumber }) => {
    try {
        const number = (botNumber || '').replace(/[^0-9]/g, '');
        const days = await getStatsForNumber(number);
        const totals = {};
        for (const day of days) {
            for (const [field, value] of Object.entries(day)) {
                if (!field.startsWith('cmd_')) continue;
                const name = field.slice(4);
                totals[name] = (totals[name] || 0) + (Number(value) || 0);
            }
        }
        const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]).slice(0, 10);
        if (!sorted.length) return reply(`📊 No command usage recorded yet.${FOOTER}`);
        const lines = sorted.map(([name, count], i) => `┃❃│ ${i + 1}. ${config.PREFIX || '.'}${name} — ${count} uses`).join('\n');
        reply(`╭═══ 📊 TOP COMMANDS ═══⊷\n${lines}\n╰═════════════════⊷${FOOTER}`);
    } catch (e) {
        console.log('[TOPCMDS] error:', e.message);
        reply(`❌ Couldn't load stats right now.${FOOTER}`);
    }
});

module.exports = {};
