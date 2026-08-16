const { cmd } = require('../ahmad-core');
const crypto = require('crypto');
const { randomFooter, renderError } = require('../lib/menu-styles');

const FOOTER = "\n\n> " + randomFooter();
const ok = (reply, msg) => reply(`${msg}${FOOTER}`);
const fail = (reply, msg) => reply(renderError(msg));

// ==================== TEXT TOOLS ====================
// (Note: reverse/upper/lower/calc/8ball/dice/roll/flip/coinflip/md5/sha256/
// base64encode/base64decode/binary/bmi/password/lorem/morse/leet/age/
// wordcount already exist in other plugin files — deliberately not
// duplicated here to avoid two commands answering to the same name.)

cmd({ pattern: "titlecase", desc: "Convert Text To Title Case", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .titlecase <text>");
    ok(reply, q.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()));
});

cmd({ pattern: "camelcase", desc: "Convert text to camelCase", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .camelcase <text>");
    const words = q.trim().split(/\s+/);
    const out = words.map((w, i) => i === 0 ? w.toLowerCase() : w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');
    ok(reply, out);
});

cmd({ pattern: "snakecase", desc: "Convert text to snake_case", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => { if (!q) return fail(reply, "Usage: .snakecase <text>"); ok(reply, q.trim().replace(/\s+/g, '_').toLowerCase()); });

cmd({ pattern: "kebabcase", desc: "Convert text to kebab-case", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => { if (!q) return fail(reply, "Usage: .kebabcase <text>"); ok(reply, q.trim().replace(/\s+/g, '-').toLowerCase()); });

cmd({ pattern: "rot13", desc: "Encode/decode text with ROT13", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .rot13 <text>");
    const out = q.replace(/[a-zA-Z]/g, c => {
        const base = c <= 'Z' ? 65 : 97;
        return String.fromCharCode((c.charCodeAt(0) - base + 13) % 26 + base);
    });
    ok(reply, out);
});

cmd({ pattern: "frombinary", desc: "Convert binary back to text", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .frombinary <01000110 01101111...>");
    try {
        ok(reply, q.trim().split(/\s+/).map(b => String.fromCharCode(parseInt(b, 2))).join(''));
    } catch (e) { fail(reply, "Invalid binary input."); }
});

cmd({ pattern: "urlencode", desc: "URL-encode text", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => { if (!q) return fail(reply, "Usage: .urlencode <text>"); ok(reply, encodeURIComponent(q)); });

cmd({ pattern: "urldecode", desc: "URL-decode text", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => { if (!q) return fail(reply, "Usage: .urldecode <encoded text>"); try { ok(reply, decodeURIComponent(q)); } catch (e) { fail(reply, "Invalid encoded text."); } });

cmd({ pattern: "vowelcount", desc: "Count vowels in text", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .vowelcount <text>");
    const count = (q.match(/[aeiouAEIOU]/g) || []).length;
    ok(reply, `🔤 Vowels found: ${count}`);
});

cmd({ pattern: "anagram", desc: "Check if two words/phrases are anagrams", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '').split(',');
    if (parts.length !== 2) return fail(reply, "Usage: .anagram word1,word2");
    const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '').split('').sort().join('');
    const isAnagram = norm(parts[0]) === norm(parts[1]);
    ok(reply, isAnagram ? "✅ Yes, these are anagrams!" : "❌ No, these are not anagrams.");
});

cmd({ pattern: "palindrome2", desc: "Check if text is a palindrome (ignores punctuation/case)", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .palindrome2 <text>");
    const norm = q.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isPalin = norm === norm.split('').reverse().join('');
    ok(reply, isPalin ? "✅ Yes, this is a palindrome!" : "❌ No, this is not a palindrome.");
});

cmd({ pattern: "repeat", desc: "Repeat text N times", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '').split(',');
    if (parts.length < 2) return fail(reply, "Usage: .repeat text,count");
    const n = Math.min(parseInt(parts[parts.length - 1]) || 0, 30);
    const text = parts.slice(0, -1).join(',');
    if (!n || n < 1) return fail(reply, "Usage: .repeat text,count (count must be 1-30)");
    ok(reply, Array(n).fill(text).join(' '));
});

// ==================== NUMBER / CONVERTER TOOLS ====================

cmd({ pattern: "bin2dec", desc: "Convert binary number to decimal", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => { if (!q) return fail(reply, "Usage: .bin2dec <binary>"); const n = parseInt(q, 2); if (isNaN(n)) return fail(reply, "Invalid binary number."); ok(reply, `🔢 ${n}`); });

cmd({ pattern: "dec2bin", desc: "Convert decimal number to binary", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => { if (!q) return fail(reply, "Usage: .dec2bin <number>"); const n = parseInt(q); if (isNaN(n)) return fail(reply, "Invalid number."); ok(reply, `🔢 ${n.toString(2)}`); });

cmd({ pattern: "dec2hex", desc: "Convert decimal number to hexadecimal", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => { if (!q) return fail(reply, "Usage: .dec2hex <number>"); const n = parseInt(q); if (isNaN(n)) return fail(reply, "Invalid number."); ok(reply, `🔢 ${n.toString(16).toUpperCase()}`); });

cmd({ pattern: "hex2dec", desc: "Convert hexadecimal to decimal", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => { if (!q) return fail(reply, "Usage: .hex2dec <hex>"); const n = parseInt(q, 16); if (isNaN(n)) return fail(reply, "Invalid hex number."); ok(reply, `🔢 ${n}`); });

cmd({ pattern: "celsius", alias: ["ctof"], desc: "Convert Celsius to Fahrenheit", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => { const c = parseFloat(q); if (isNaN(c)) return fail(reply, "Usage: .celsius <°C>"); ok(reply, `🌡️ ${c}°C = ${(c * 9 / 5 + 32).toFixed(1)}°F`); });

cmd({ pattern: "fahrenheit", alias: ["ftoc"], desc: "Convert Fahrenheit to Celsius", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => { const f = parseFloat(q); if (isNaN(f)) return fail(reply, "Usage: .fahrenheit <°F>"); ok(reply, `🌡️ ${f}°F = ${((f - 32) * 5 / 9).toFixed(1)}°C`); });

cmd({ pattern: "kmtomiles", desc: "Convert kilometers to miles", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => { const km = parseFloat(q); if (isNaN(km)) return fail(reply, "Usage: .kmtomiles <km>"); ok(reply, `📏 ${km} km = ${(km * 0.621371).toFixed(2)} miles`); });

cmd({ pattern: "milestokm", desc: "Convert miles to kilometers", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => { const mi = parseFloat(q); if (isNaN(mi)) return fail(reply, "Usage: .milestokm <miles>"); ok(reply, `📏 ${mi} miles = ${(mi * 1.60934).toFixed(2)} km`); });

cmd({ pattern: "kgtolbs", desc: "Convert kilograms to pounds", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => { const kg = parseFloat(q); if (isNaN(kg)) return fail(reply, "Usage: .kgtolbs <kg>"); ok(reply, `⚖️ ${kg} kg = ${(kg * 2.20462).toFixed(2)} lbs`); });

cmd({ pattern: "lbstokg", desc: "Convert pounds to kilograms", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => { const lbs = parseFloat(q); if (isNaN(lbs)) return fail(reply, "Usage: .lbstokg <lbs>"); ok(reply, `⚖️ ${lbs} lbs = ${(lbs / 2.20462).toFixed(2)} kg`); });

// ==================== CALCULATORS / GENERATORS ====================

cmd({ pattern: "percentage", alias: ["percent"], desc: "Calculate X percent of Y", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '').split(',').map(s => parseFloat(s.trim()));
    if (parts.length !== 2 || parts.some(isNaN)) return fail(reply, "Usage: .percentage 20,150  (20% of 150)");
    ok(reply, `📊 ${parts[0]}% of ${parts[1]} = ${(parts[0] / 100 * parts[1]).toFixed(2)}`);
});

cmd({ pattern: "uuid", desc: "Generate a random UUID", category: "tools", filename: __filename },
async (conn, mek, m, { reply }) => { ok(reply, `🆔 ${crypto.randomUUID()}`); });

cmd({ pattern: "choose", alias: ["pick"], desc: "Pick randomly between comma-separated options", category: "fun", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const options = (q || '').split(',').map(s => s.trim()).filter(Boolean);
    if (options.length < 2) return fail(reply, "Usage: .choose option1,option2,option3");
    ok(reply, `🎯 I choose: ${options[crypto.randomInt(options.length)]}`);
});

cmd({ pattern: "randomnumber", alias: ["rng"], desc: "Generate a random number in a range", category: "fun", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '1,100').split(',').map(s => parseInt(s.trim()));
    const [min, max] = parts.length === 2 ? parts : [1, 100];
    if (isNaN(min) || isNaN(max) || min >= max) return fail(reply, "Usage: .randomnumber min,max");
    ok(reply, `🔢 ${crypto.randomInt(min, max + 1)}`);
});

module.exports = {};
