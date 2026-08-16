const { cmd } = require('../ahmad-core');
const crypto = require('crypto');
const { randomFooter } = require('../lib/menu-styles');

const FOOTER = "\n\n> 𝙊𝘽𝙎𝙄𝘿𝙄𝘼𝙉 𝙇𝙐𝙓𝙀 𝘼𝙃𝙈𝘼𝘿 𝙈𝙄𝙉𝙄";
const box = (title, body) => `╭═══ ${title} ═══⊷\n${body}\n╰═════════════════⊷${FOOTER}`;

// ==================== BASE64 ====================
cmd({ pattern: "b64encode", alias: ["encodeb64"], desc: "🔐 Encode text to Base64", category: "tools", react: "🔐", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do encode karne ke liye.\nExample: .b64encode hello");
    reply(box("🔐 BASE64 ENCODE", `┃❃│ ${Buffer.from(q, 'utf8').toString('base64')}`));
});

cmd({ pattern: "b64decode", alias: ["decodeb64"], desc: "🔓 Decode Base64 to text", category: "tools", react: "🔓", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Base64 string do decode karne ke liye.");
    try {
        reply(box("🔓 BASE64 DECODE", `┃❃│ ${Buffer.from(q, 'base64').toString('utf8')}`));
    } catch (e) { reply("❌ Invalid base64 string."); }
});

// ==================== URL ENCODE/DECODE ====================
cmd({ pattern: "uriencode", alias: ["encodeuri"], desc: "🔗 URL encode text", category: "tools", react: "🔗", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.\nExample: .uriencode hello world");
    reply(box("🔗 URL ENCODE", `┃❃│ ${encodeURIComponent(q)}`));
});

cmd({ pattern: "uridecode", alias: ["decodeuri"], desc: "🔗 URL decode text", category: "tools", react: "🔗", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Encoded text do.");
    try { reply(box("🔗 URL DECODE", `┃❃│ ${decodeURIComponent(q)}`)); }
    catch (e) { reply("❌ Invalid encoded string."); }
});

// ==================== HEX / BINARY ====================
cmd({ pattern: "hex2text", desc: "🔡 Convert hex to text", category: "tools", react: "🔡", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Hex string do.\nExample: .hex2text 68656c6c6f");
    try {
        const clean = q.replace(/\s+/g, '');
        reply(box("🔡 HEX → TEXT", `┃❃│ ${Buffer.from(clean, 'hex').toString('utf8')}`));
    } catch (e) { reply("❌ Invalid hex string."); }
});

cmd({ pattern: "text2hex", desc: "🔡 Convert text to hex", category: "tools", react: "🔡", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.");
    reply(box("🔡 TEXT → HEX", `┃❃│ ${Buffer.from(q, 'utf8').toString('hex')}`));
});

cmd({ pattern: "bin2text", desc: "🔢 Convert binary to text", category: "tools", react: "🔢", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Binary do (space separated).\nExample: .bin2text 01101000 01101001");
    try {
        const txt = q.trim().split(/\s+/).map(b => String.fromCharCode(parseInt(b, 2))).join('');
        if (/[\ufffd]/.test(txt) || txt.includes('NaN')) throw new Error('bad');
        reply(box("🔢 BINARY → TEXT", `┃❃│ ${txt}`));
    } catch (e) { reply("❌ Invalid binary string."); }
});

cmd({ pattern: "text2bin", desc: "🔢 Convert text to binary", category: "tools", react: "🔢", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.");
    const bin = q.split('').map(c => c.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
    reply(box("🔢 TEXT → BINARY", `┃❃│ ${bin}`));
});

// ==================== HASHES ====================
function hashCmd(pattern, algo, label, emoji) {
    cmd({ pattern, desc: `${emoji} Generate ${label} hash`, category: "tools", react: emoji, filename: __filename },
    async (conn, mek, m, { q, reply }) => {
        if (!q) return reply(`❌ Text do.\nExample: .${pattern} hello`);
        reply(box(`${emoji} ${label}`, `┃❃│ ${crypto.createHash(algo).update(q).digest('hex')}`));
    });
}
hashCmd("md5hash", "md5", "MD5 HASH", "🔑");
hashCmd("sha1hash", "sha1", "SHA1 HASH", "🔑");
hashCmd("sha256hash", "sha256", "SHA256 HASH", "🔑");
hashCmd("sha512hash", "sha512", "SHA512 HASH", "🔑");

// ==================== ROT13 / MORSE ====================
cmd({ pattern: "rot13cipher", alias: ["rot13text"], desc: "🔄 ROT13 cipher", category: "tools", react: "🔄", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.");
    const out = q.replace(/[a-zA-Z]/g, c => {
        const base = c <= 'Z' ? 65 : 97;
        return String.fromCharCode((c.charCodeAt(0) - base + 13) % 26 + base);
    });
    reply(box("🔄 ROT13", `┃❃│ ${out}`));
});

const MORSE = { A:'.-',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..','0':'-----','1':'.----','2':'..---','3':'...--','4':'....-','5':'.....','6':'-....','7':'--...','8':'---..','9':'----.' };
const MORSE_REV = Object.fromEntries(Object.entries(MORSE).map(([k, v]) => [v, k]));

cmd({ pattern: "text2morse", desc: "📡 Convert text to morse code", category: "tools", react: "📡", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.\nExample: .text2morse SOS");
    const out = q.toUpperCase().split('').map(c => c === ' ' ? '/' : (MORSE[c] || c)).join(' ');
    reply(box("📡 TEXT → MORSE", `┃❃│ ${out}`));
});

cmd({ pattern: "morse2text", desc: "📡 Convert morse code to text", category: "tools", react: "📡", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Morse code do.\nExample: .morse2text ... --- ...");
    const out = q.trim().split(' ').map(c => c === '/' ? ' ' : (MORSE_REV[c] || c)).join('');
    reply(box("📡 MORSE → TEXT", `┃❃│ ${out}`));
});

// ==================== TEXT UTILITIES ====================
cmd({ pattern: "reversetext", alias: ["textreverse"], desc: "🔁 Reverse any text", category: "tools", react: "🔁", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.");
    reply(box("🔁 REVERSED", `┃❃│ ${q.split('').reverse().join('')}`));
});

cmd({ pattern: "wordreverse", desc: "🔁 Reverse word order in a sentence", category: "tools", react: "🔁", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Sentence do.");
    reply(box("🔁 WORD REVERSE", `┃❃│ ${q.split(/\s+/).reverse().join(' ')}`));
});

cmd({ pattern: "charcount", desc: "🔢 Count characters in text", category: "tools", react: "🔢", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.");
    reply(box("🔢 CHAR COUNT", `┃❃│ Characters: ${q.length}\n┃❃│ Without spaces: ${q.replace(/\s/g, '').length}`));
});

cmd({ pattern: "vowelscount", desc: "🔤 Count vowels in text", category: "tools", react: "🔤", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.");
    const vowels = (q.match(/[aeiouAEIOU]/g) || []).length;
    reply(box("🔤 VOWEL COUNT", `┃❃│ Vowels: ${vowels}\n┃❃│ Consonants: ${(q.match(/[a-zA-Z]/g) || []).length - vowels}`));
});

cmd({ pattern: "textstats", desc: "📊 Full text statistics", category: "tools", react: "📊", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.");
    const words = q.trim().split(/\s+/).filter(Boolean);
    const sentences = (q.match(/[.!?]+/g) || []).length || 1;
    reply(box("📊 TEXT STATS", `┃❃│ Characters: ${q.length}\n┃❃│ Words: ${words.length}\n┃❃│ Sentences: ${sentences}\n┃❃│ Avg word length: ${(q.replace(/\s/g,'').length / (words.length||1)).toFixed(1)}`));
});

cmd({ pattern: "ispalindrome", desc: "🔁 Check if text is a palindrome", category: "tools", react: "🔁", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.\nExample: .ispalindrome madam");
    const clean = q.toLowerCase().replace(/[^a-z0-9]/g, '');
    const isPalin = clean === clean.split('').reverse().join('');
    reply(box("🔁 PALINDROME CHECK", `┃❃│ "${q}"\n┃❃│ Result: ${isPalin ? '✅ Yes, palindrome hai' : '❌ Nahi, palindrome nahi hai'}`));
});

cmd({ pattern: "isanagram", desc: "🔤 Check if two words are anagrams", category: "tools", react: "🔤", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '').split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length !== 2) return reply("❌ Do words comma se separate karke do.\nExample: .isanagram listen,silent");
    const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '').split('').sort().join('');
    const result = norm(parts[0]) === norm(parts[1]);
    reply(box("🔤 ANAGRAM CHECK", `┃❃│ "${parts[0]}" vs "${parts[1]}"\n┃❃│ Result: ${result ? '✅ Anagram hain' : '❌ Anagram nahi hain'}`));
});

cmd({ pattern: "capitalizetext", desc: "🔠 Capitalize first letter of each sentence", category: "tools", react: "🔠", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.");
    const out = q.toLowerCase().replace(/(^\s*\w|[.!?]\s*\w)/g, c => c.toUpperCase());
    reply(box("🔠 CAPITALIZED", `┃❃│ ${out}`));
});

cmd({ pattern: "titlecasetext", desc: "🔠 Convert text to Title Case", category: "tools", react: "🔠", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.");
    const out = q.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.substr(1).toLowerCase());
    reply(box("🔠 TITLE CASE", `┃❃│ ${out}`));
});

cmd({ pattern: "snakecasetext", desc: "🐍 Convert text to snake_case", category: "tools", react: "🐍", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.");
    const out = q.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    reply(box("🐍 SNAKE_CASE", `┃❃│ ${out}`));
});

cmd({ pattern: "camelcasetext", desc: "🐫 Convert text to camelCase", category: "tools", react: "🐫", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.");
    const words = q.trim().toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
    const out = words.map((w, i) => i === 0 ? w : w.charAt(0).toUpperCase() + w.slice(1)).join('');
    reply(box("🐫 CAMELCASE", `┃❃│ ${out}`));
});

cmd({ pattern: "kebabcasetext", desc: "🍢 Convert text to kebab-case", category: "tools", react: "🍢", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.");
    const out = q.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    reply(box("🍢 KEBAB-CASE", `┃❃│ ${out}`));
});

cmd({ pattern: "textslug", alias: ["slugify"], desc: "🔗 Convert text to a URL slug", category: "tools", react: "🔗", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.");
    const out = q.trim().toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-');
    reply(box("🔗 SLUG", `┃❃│ ${out}`));
});

cmd({ pattern: "textinitials", desc: "🔤 Get initials from a name/phrase", category: "tools", react: "🔤", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Name/phrase do.\nExample: .textinitials Ahmad Ali Khan");
    const out = q.trim().split(/\s+/).map(w => w[0].toUpperCase()).join('.') + '.';
    reply(box("🔤 INITIALS", `┃❃│ ${out}`));
});

cmd({ pattern: "textacronym", desc: "🔤 Build an acronym from a phrase", category: "tools", react: "🔤", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Phrase do.\nExample: .textacronym as soon as possible");
    const out = q.trim().split(/\s+/).map(w => w[0].toUpperCase()).join('');
    reply(box("🔤 ACRONYM", `┃❃│ ${out}`));
});

cmd({ pattern: "textshuffle", alias: ["shuffleword"], desc: "🔀 Shuffle letters of a word", category: "fun", react: "🔀", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Word do.");
    const arr = q.split('');
    for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
    reply(box("🔀 SHUFFLED", `┃❃│ ${arr.join('')}`));
});

cmd({ pattern: "textrepeat", desc: "🔁 Repeat a word N times", category: "tools", react: "🔁", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '').split(',');
    if (parts.length < 2 || isNaN(parts[1])) return reply("❌ Format: .textrepeat word,count\nExample: .textrepeat hi,5");
    const n = Math.min(parseInt(parts[1]), 100);
    reply(box("🔁 REPEATED", `┃❃│ ${parts[0].trim().repeat(n)}`));
});

// ==================== NUMBERS / MATH ====================
cmd({ pattern: "isprimenum", desc: "🔢 Check if a number is prime", category: "tools", react: "🔢", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const n = parseInt(q);
    if (!q || isNaN(n)) return reply("❌ Number do.\nExample: .isprimenum 17");
    if (n < 2) return reply(box("🔢 PRIME CHECK", `┃❃│ ${n} is ❌ NOT prime`));
    let prime = true;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) { prime = false; break; }
    reply(box("🔢 PRIME CHECK", `┃❃│ ${n} is ${prime ? '✅ PRIME' : '❌ NOT prime'}`));
});

cmd({ pattern: "factorialnum", desc: "🔢 Calculate factorial of a number", category: "tools", react: "🔢", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const n = parseInt(q);
    if (!q || isNaN(n) || n < 0 || n > 170) return reply("❌ Number do (0-170).\nExample: .factorialnum 5");
    let result = 1n;
    for (let i = 2; i <= n; i++) result *= BigInt(i);
    reply(box("🔢 FACTORIAL", `┃❃│ ${n}! = ${result.toString()}`));
});

cmd({ pattern: "fibonaccinum", desc: "🔢 Generate Fibonacci sequence", category: "tools", react: "🔢", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const n = parseInt(q);
    if (!q || isNaN(n) || n < 1 || n > 50) return reply("❌ Number do (1-50).\nExample: .fibonaccinum 10");
    const seq = [0, 1];
    for (let i = 2; i < n; i++) seq.push(seq[i - 1] + seq[i - 2]);
    reply(box("🔢 FIBONACCI", `┃❃│ ${seq.slice(0, n).join(', ')}`));
});

cmd({ pattern: "gcdlcmcalc", desc: "🔢 Calculate GCD and LCM of two numbers", category: "tools", react: "🔢", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '').split(',').map(s => parseInt(s.trim()));
    if (parts.length !== 2 || parts.some(isNaN)) return reply("❌ Format: .gcdlcmcalc a,b\nExample: .gcdlcmcalc 12,18");
    const gcd = (a, b) => b === 0 ? a : gcd(b, a % b);
    const g = gcd(Math.abs(parts[0]), Math.abs(parts[1]));
    const l = g === 0 ? 0 : Math.abs(parts[0] * parts[1]) / g;
    reply(box("🔢 GCD / LCM", `┃❃│ GCD: ${g}\n┃❃│ LCM: ${l}`));
});

cmd({ pattern: "percentcalc", desc: "📐 Calculate percentage of a number", category: "tools", react: "📐", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '').split(',').map(s => parseFloat(s.trim()));
    if (parts.length !== 2 || parts.some(isNaN)) return reply("❌ Format: .percentcalc percent,number\nExample: .percentcalc 20,150");
    reply(box("📐 PERCENTAGE", `┃❃│ ${parts[0]}% of ${parts[1]} = ${(parts[0] / 100 * parts[1]).toFixed(2)}`));
});

cmd({ pattern: "avgcalc", desc: "📐 Calculate average of numbers", category: "tools", react: "📐", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const nums = (q || '').split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (nums.length === 0) return reply("❌ Format: .avgcalc num1,num2,num3\nExample: .avgcalc 10,20,30");
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    reply(box("📐 AVERAGE", `┃❃│ Numbers: ${nums.join(', ')}\n┃❃│ Average: ${avg.toFixed(2)}`));
});

cmd({ pattern: "bmicalc", desc: "⚖️ Calculate BMI (Body Mass Index)", category: "tools", react: "⚖️", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '').split(',').map(s => parseFloat(s.trim()));
    if (parts.length !== 2 || parts.some(isNaN)) return reply("❌ Format: .bmicalc weight_kg,height_m\nExample: .bmicalc 70,1.75");
    const bmi = parts[0] / (parts[1] * parts[1]);
    let cat = bmi < 18.5 ? "Underweight" : bmi < 25 ? "Normal" : bmi < 30 ? "Overweight" : "Obese";
    reply(box("⚖️ BMI CALCULATOR", `┃❃│ BMI: ${bmi.toFixed(1)}\n┃❃│ Category: ${cat}`));
});

cmd({ pattern: "tipcalc", desc: "💰 Calculate tip and total bill split", category: "tools", react: "💰", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '').split(',').map(s => parseFloat(s.trim()));
    if (parts.length < 2 || parts.some(isNaN)) return reply("❌ Format: .tipcalc bill,tip%,people(optional)\nExample: .tipcalc 1000,10,4");
    const [bill, tipPct, people = 1] = parts;
    const tip = bill * (tipPct / 100);
    const total = bill + tip;
    reply(box("💰 TIP CALCULATOR", `┃❃│ Bill: ${bill}\n┃❃│ Tip (${tipPct}%): ${tip.toFixed(2)}\n┃❃│ Total: ${total.toFixed(2)}\n┃❃│ Per person (${people}): ${(total / people).toFixed(2)}`));
});

cmd({ pattern: "discountcalc", desc: "💰 Calculate discounted price", category: "tools", react: "💰", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '').split(',').map(s => parseFloat(s.trim()));
    if (parts.length !== 2 || parts.some(isNaN)) return reply("❌ Format: .discountcalc price,discount%\nExample: .discountcalc 2000,25");
    const [price, disc] = parts;
    const saved = price * (disc / 100);
    reply(box("💰 DISCOUNT CALCULATOR", `┃❃│ Original: ${price}\n┃❃│ Discount (${disc}%): -${saved.toFixed(2)}\n┃❃│ Final Price: ${(price - saved).toFixed(2)}`));
});

// ==================== UNIT CONVERTERS ====================
cmd({ pattern: "c2f", desc: "🌡️ Convert Celsius to Fahrenheit", category: "tools", react: "🌡️", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const n = parseFloat(q);
    if (!q || isNaN(n)) return reply("❌ Number do.\nExample: .c2f 30");
    reply(box("🌡️ C → F", `┃❃│ ${n}°C = ${(n * 9 / 5 + 32).toFixed(1)}°F`));
});

cmd({ pattern: "f2c", desc: "🌡️ Convert Fahrenheit to Celsius", category: "tools", react: "🌡️", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const n = parseFloat(q);
    if (!q || isNaN(n)) return reply("❌ Number do.\nExample: .f2c 86");
    reply(box("🌡️ F → C", `┃❃│ ${n}°F = ${((n - 32) * 5 / 9).toFixed(1)}°C`));
});

cmd({ pattern: "km2mi", desc: "📏 Convert kilometers to miles", category: "tools", react: "📏", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const n = parseFloat(q);
    if (!q || isNaN(n)) return reply("❌ Number do.\nExample: .km2mi 10");
    reply(box("📏 KM → MILES", `┃❃│ ${n} km = ${(n * 0.621371).toFixed(2)} mi`));
});

cmd({ pattern: "mi2km", desc: "📏 Convert miles to kilometers", category: "tools", react: "📏", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const n = parseFloat(q);
    if (!q || isNaN(n)) return reply("❌ Number do.\nExample: .mi2km 10");
    reply(box("📏 MILES → KM", `┃❃│ ${n} mi = ${(n * 1.60934).toFixed(2)} km`));
});

cmd({ pattern: "kg2lb", desc: "⚖️ Convert kilograms to pounds", category: "tools", react: "⚖️", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const n = parseFloat(q);
    if (!q || isNaN(n)) return reply("❌ Number do.\nExample: .kg2lb 70");
    reply(box("⚖️ KG → LB", `┃❃│ ${n} kg = ${(n * 2.20462).toFixed(2)} lb`));
});

cmd({ pattern: "lb2kg", desc: "⚖️ Convert pounds to kilograms", category: "tools", react: "⚖️", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const n = parseFloat(q);
    if (!q || isNaN(n)) return reply("❌ Number do.\nExample: .lb2kg 154");
    reply(box("⚖️ LB → KG", `┃❃│ ${n} lb = ${(n * 0.453592).toFixed(2)} kg`));
});

// ==================== DATE / TIME ====================
cmd({ pattern: "datediff", desc: "📅 Calculate days between two dates", category: "tools", react: "📅", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '').split(',').map(s => s.trim());
    if (parts.length !== 2) return reply("❌ Format: .datediff YYYY-MM-DD,YYYY-MM-DD\nExample: .datediff 2026-01-01,2026-12-31");
    const d1 = new Date(parts[0]), d2 = new Date(parts[1]);
    if (isNaN(d1) || isNaN(d2)) return reply("❌ Invalid date format. Use YYYY-MM-DD.");
    const days = Math.round(Math.abs(d2 - d1) / 86400000);
    reply(box("📅 DATE DIFFERENCE", `┃❃│ ${parts[0]} → ${parts[1]}\n┃❃│ Difference: ${days} days`));
});

cmd({ pattern: "weekdayof", desc: "📅 Find which weekday a date falls on", category: "tools", react: "📅", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Format: .weekdayof YYYY-MM-DD\nExample: .weekdayof 2026-12-25");
    const d = new Date(q);
    if (isNaN(d)) return reply("❌ Invalid date format. Use YYYY-MM-DD.");
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    reply(box("📅 WEEKDAY", `┃❃│ ${q} was/is a ${days[d.getUTCDay()]}`));
});

cmd({ pattern: "agecalc", desc: "🎂 Calculate your age from date of birth", category: "tools", react: "🎂", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Format: .agecalc YYYY-MM-DD\nExample: .agecalc 2000-05-15");
    const dob = new Date(q);
    if (isNaN(dob)) return reply("❌ Invalid date format. Use YYYY-MM-DD.");
    const now = new Date();
    let years = now.getFullYear() - dob.getFullYear();
    let months = now.getMonth() - dob.getMonth();
    let days = now.getDate() - dob.getDate();
    if (days < 0) { months--; days += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
    if (months < 0) { years--; months += 12; }
    reply(box("🎂 AGE CALCULATOR", `┃❃│ Born: ${q}\n┃❃│ Age: ${years} years, ${months} months, ${days} days`));
});

// ==================== FUN / GAMES ====================
cmd({ pattern: "rockpaperscissors", alias: ["rpsgame"], desc: "✂️ Play rock paper scissors vs bot", category: "fun", react: "✂️", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const choices = ['rock', 'paper', 'scissors'];
    const emojis = { rock: '🪨', paper: '📄', scissors: '✂️' };
    const user = (q || '').toLowerCase().trim();
    if (!choices.includes(user)) return reply("❌ Choose: rock, paper, ya scissors\nExample: .rockpaperscissors rock");
    const bot = choices[Math.floor(Math.random() * 3)];
    let result;
    if (user === bot) result = "🤝 Draw!";
    else if ((user === 'rock' && bot === 'scissors') || (user === 'paper' && bot === 'rock') || (user === 'scissors' && bot === 'paper')) result = "🎉 You Win!";
    else result = "😎 Bot Wins!";
    reply(box("✂️ ROCK PAPER SCISSORS", `┃❃│ You: ${emojis[user]} ${user}\n┃❃│ Bot: ${emojis[bot]} ${bot}\n┃❃│ ${result}`));
});

cmd({ pattern: "truthquestion", desc: "🎭 Get a random Truth question", category: "fun", react: "🎭", filename: __filename },
async (conn, mek, m, { reply }) => {
    const questions = [
        "What's the most embarrassing thing that's happened to you?",
        "Have you ever lied to your best friend?",
        "What's your biggest fear?",
        "What's a secret you've never told anyone?",
        "Who was your first crush?",
        "What's the weirdest dream you've ever had?",
        "Have you ever cheated in an exam?",
        "What's your most annoying habit?"
    ];
    reply(box("🎭 TRUTH", `┃❃│ ${questions[Math.floor(Math.random() * questions.length)]}`));
});

cmd({ pattern: "darechallenge", desc: "🎭 Get a random Dare challenge", category: "fun", react: "🎭", filename: __filename },
async (conn, mek, m, { reply }) => {
    const dares = [
        "Send a voice note singing your favorite song.",
        "Text your crush 'hi' right now.",
        "Post an old embarrassing photo as your status.",
        "Talk in a funny accent for the next 5 messages.",
        "Send the last photo in your gallery.",
        "Do 10 push-ups right now.",
        "Message a random contact 'I found your diary'."
    ];
    reply(box("🎭 DARE", `┃❃│ ${dares[Math.floor(Math.random() * dares.length)]}`));
});

cmd({ pattern: "wyrquestion", alias: ["randomwyr"], desc: "🤔 Get a random Would You Rather question", category: "fun", react: "🤔", filename: __filename },
async (conn, mek, m, { reply }) => {
    const qs = [
        "Would you rather have unlimited money or unlimited time?",
        "Would you rather be invisible or be able to fly?",
        "Would you rather always be 10 minutes late or 20 minutes early?",
        "Would you rather lose all your memories or never make new ones?",
        "Would you rather live without music or without movies?",
        "Would you rather be the funniest or the smartest person in the room?"
    ];
    reply(box("🤔 WOULD YOU RATHER", `┃❃│ ${qs[Math.floor(Math.random() * qs.length)]}`));
});

cmd({ pattern: "randomriddle", desc: "🧩 Get a random riddle", category: "fun", react: "🧩", filename: __filename },
async (conn, mek, m, { reply }) => {
    const riddles = [
        { q: "What has keys but no locks, space but no room, and you can enter but not go inside?", a: "A keyboard" },
        { q: "The more you take, the more you leave behind. What am I?", a: "Footsteps" },
        { q: "What has a face and two hands but no arms or legs?", a: "A clock" },
        { q: "I speak without a mouth and hear without ears. What am I?", a: "An echo" },
        { q: "What gets wetter as it dries?", a: "A towel" }
    ];
    const r = riddles[Math.floor(Math.random() * riddles.length)];
    reply(box("🧩 RIDDLE", `┃❃│ ${r.q}\n┃❃│ \n┃❃│ 💡 Answer: ${r.a}`));
});

module.exports = {};
