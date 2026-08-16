const { cmd } = require('../ahmad-core');
const axios = require('axios');
const crypto = require('crypto');
const moment = require('moment-timezone');
const { randomFooter, renderError } = require('../lib/menu-styles');

const FOOTER = "\n\n> " + randomFooter();
const fail = (reply, msg) => reply(renderError(msg));

// ================= DOWNLOADER =================

cmd({ pattern: "reddit", desc: "Download Reddit video/image", category: "download", filename: __filename },
async (conn, mek, m, { from, args, reply }) => {
    try {
        const link = args[0];
        if (!link || !link.includes('reddit.com')) return fail(reply, "Reddit post link do. Usage: .reddit <link>");
        const jsonUrl = link.split('?')[0].replace(/\/$/, '') + '.json';
        const { data } = await axios.get(jsonUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 20000 });
        const post = data[0]?.data?.children?.[0]?.data;
        if (!post) return fail(reply, "Post not found, check the link.");

        if (post.is_video && post.media?.reddit_video?.fallback_url) {
            const videoUrl = post.media.reddit_video.fallback_url;
            const vRes = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 40000 });
            await conn.sendMessage(from, {
                video: Buffer.from(vRes.data),
                caption: `✅ *REDDIT VIDEO*\n${post.title || ''}\n\n_⚠️ Reddit kabhi kabhi video ka audio alag track mein deta hai, isliye sound missing ho sakti hai._${FOOTER}`
            }, { quoted: mek });
        } else if (post.url && /\.(jpg|jpeg|png|gif)(\?|$)/i.test(post.url)) {
            await conn.sendMessage(from, { image: { url: post.url }, caption: `✅ *REDDIT IMAGE*\n${post.title || ''}${FOOTER}` }, { quoted: mek });
        } else {
            fail(reply, "Is post mein downloadable media nahi mila.");
        }
    } catch (e) { fail(reply, "Reddit fetch failed: " + e.message); }
});

// ================= GUARANTEED-WORKING LOCAL TOOLS (no external API = can't go down) =================

cmd({ pattern: "md5", desc: "Generate MD5 hash", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .md5 <text>");
    reply(`🔐 *MD5:* ${crypto.createHash('md5').update(q).digest('hex')}${FOOTER}`);
});

cmd({ pattern: "sha256", desc: "Generate SHA256 hash", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .sha256 <text>");
    reply(`🔐 *SHA256:* ${crypto.createHash('sha256').update(q).digest('hex')}${FOOTER}`);
});

cmd({ pattern: "password", alias: ["genpass"], desc: "Generate a random secure password", category: "tools", filename: __filename },
async (conn, mek, m, { args, reply }) => {
    const len = Math.min(Math.max(parseInt(args[0]) || 12, 6), 64);
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*";
    let pass = "";
    for (let i = 0; i < len; i++) pass += chars[crypto.randomInt(chars.length)];
    reply(`🔑 *PASSWORD (${len} chars):*\n\`${pass}\`${FOOTER}`);
});

cmd({ pattern: "lorem", desc: "Generate lorem ipsum placeholder text", category: "tools", filename: __filename },
async (conn, mek, m, { args, reply }) => {
    const words = ["lorem","ipsum","dolor","sit","amet","consectetur","adipiscing","elit","sed","do","eiusmod","tempor","incididunt","ut","labore","et","dolore","magna","aliqua","enim","ad","minim","veniam"];
    const count = Math.min(Math.max(parseInt(args[0]) || 30, 5), 200);
    let out = [];
    for (let i = 0; i < count; i++) out.push(words[Math.floor(Math.random() * words.length)]);
    reply(`📝 ${out.join(' ')}.${FOOTER}`);
});

cmd({ pattern: "binary", desc: "Text <-> Binary converter", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .binary <text>  ya  .binary 01001000 01101001");
    const isBinary = /^[01\s]+$/.test(q);
    if (isBinary) {
        const out = q.trim().split(/\s+/).map(b => String.fromCharCode(parseInt(b, 2))).join('');
        reply(`🔤 *DECODED:* ${out}${FOOTER}`);
    } else {
        const out = q.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
        reply(`💻 *BINARY:* ${out}${FOOTER}`);
    }
});

cmd({ pattern: "palindrome", desc: "Check if text is a palindrome", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .palindrome <text>");
    const clean = q.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isPalin = clean === clean.split('').reverse().join('');
    reply(`${isPalin ? '✅ Yes, this is a palindrome!' : '❌ No, this is not a palindrome.'}${FOOTER}`);
});

cmd({ pattern: "bmi", desc: "Calculate BMI", category: "tools", filename: __filename },
async (conn, mek, m, { args, reply }) => {
    try {
        if (args.length < 2) return fail(reply, "Usage: .bmi <weight_kg> <height_cm>  e.g. .bmi 70 175");
        const weight = parseFloat(args[0]);
        const heightM = parseFloat(args[1]) / 100;
        if (!weight || !heightM) return fail(reply, "Valid numbers do.");
        const bmi = (weight / (heightM * heightM)).toFixed(1);
        let category = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
        reply(`⚖️ *BMI: ${bmi}*\n📊 Category: ${category}${FOOTER}`);
    } catch (e) { fail(reply, e.message); }
});

cmd({ pattern: "age", desc: "Calculate age from date of birth", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    try {
        if (!q) return fail(reply, "Usage: .age DD-MM-YYYY  e.g. .age 15-08-2000");
        const parts = q.split(/[-\/]/);
        if (parts.length !== 3) return fail(reply, "Format: .age DD-MM-YYYY");
        const [d, mo, y] = parts.map(Number);
        const dob = new Date(y, mo - 1, d);
        const now = new Date();
        let years = now.getFullYear() - dob.getFullYear();
        const m1 = now.getMonth() - dob.getMonth();
        if (m1 < 0 || (m1 === 0 && now.getDate() < dob.getDate())) years--;
        reply(`🎂 *AGE:* ${years} saal${FOOTER}`);
    } catch (e) { fail(reply, "Valid date do: DD-MM-YYYY"); }
});

cmd({ pattern: "leet", desc: "Convert text to leetspeak", category: "fun", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .leet <text>");
    const map = { a: '4', e: '3', i: '1', o: '0', s: '5', t: '7', A: '4', E: '3', I: '1', O: '0', S: '5', T: '7' };
    const out = q.split('').map(c => map[c] || c).join('');
    reply(`🕶️ ${out}${FOOTER}`);
});

cmd({ pattern: "emojify", desc: "Convert text to regional-indicator emoji letters", category: "fun", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .emojify <text>");
    const out = q.toUpperCase().split('').map(c => {
        if (c >= 'A' && c <= 'Z') return String.fromCodePoint(0x1F1E6 + (c.charCodeAt(0) - 65)) + ' ';
        if (c === ' ') return '   ';
        return c + ' ';
    }).join('');
    reply(out + FOOTER);
});

cmd({ pattern: "trivia", desc: "Random trivia question", category: "fun", filename: __filename },
async (conn, mek, m, { reply }) => {
    try {
        const { data } = await axios.get("https://opentdb.com/api.php?amount=1", { timeout: 15000 });
        const q = data.results[0];
        const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
        const options = [...q.incorrect_answers, q.correct_answer].sort(() => Math.random() - 0.5).map(decode);
        reply(`🧩 *TRIVIA (${decode(q.category)})*\n${decode(q.question)}\n\n${options.map((o, i) => `${i + 1}. ${o}`).join('\n')}\n\n||✅ Answer: ${decode(q.correct_answer)}||${FOOTER}`);
    } catch (e) { fail(reply, "Trivia fetch failed."); }
});

cmd({ pattern: "number2words", alias: ["num2words"], desc: "Convert a number to words", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q || isNaN(q)) return fail(reply, "Usage: .number2words <number>");
    const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    function toWords(n) {
        if (n < 20) return ones[n];
        if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
        if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + toWords(n % 100) : '');
        if (n < 1000000) return toWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + toWords(n % 1000) : '');
        return toWords(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 ? ' ' + toWords(n % 1000000) : '');
    }
    const num = parseInt(q);
    reply(`🔢 ${num} = ${num === 0 ? 'Zero' : toWords(Math.abs(num))}${FOOTER}`);
});

cmd({ pattern: "countdown", desc: "Days remaining until a date", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .countdown DD-MM-YYYY");
    const parts = q.split(/[-\/]/);
    if (parts.length !== 3) return fail(reply, "Format: .countdown DD-MM-YYYY");
    const [d, mo, y] = parts.map(Number);
    const target = new Date(y, mo - 1, d);
    const diffDays = Math.ceil((target - new Date()) / (1000 * 60 * 60 * 24));
    reply(`📅 ${diffDays >= 0 ? `${diffDays} din baaki hain.` : `Ye date ${Math.abs(diffDays)} din pehle guzar chuki hai.`}${FOOTER}`);
});

cmd({ pattern: "timezone", alias: ["tz"], desc: "Current time in a given timezone", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .timezone Asia/Karachi");
    try {
        const t = moment().tz(q);
        if (!t.isValid()) throw new Error();
        reply(`🌍 ${q}: ${t.format("hh:mm:ss A, DD MMM YYYY")}${FOOTER}`);
    } catch (e) { fail(reply, "Valid timezone do, e.g. Asia/Karachi, Africa/Kampala, Europe/London"); }
});

module.exports = {};
