const { cmd } = require('../ahmad-core');
const { randomFooter, renderError } = require('../lib/menu-styles');

const FOOTER = "\n\n> " + randomFooter();
const ok = (reply, msg) => reply(`${msg}${FOOTER}`);
const fail = (reply, msg) => reply(renderError(msg));

// ==================== MATH TOOLS ====================

cmd({ pattern: "factorial", desc: "Calculate the factorial of a number", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const n = parseInt(q);
    if (isNaN(n) || n < 0 || n > 170) return fail(reply, "Usage: .factorial <number 0-170>");
    let result = 1n;
    for (let i = 2; i <= n; i++) result *= BigInt(i);
    ok(reply, `🔢 ${n}! = ${result.toString()}`);
});

cmd({ pattern: "fibonacci", alias: ["fib"], desc: "Get the Nth Fibonacci number", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const n = parseInt(q);
    if (isNaN(n) || n < 0 || n > 1000) return fail(reply, "Usage: .fibonacci <n> (0-1000)");
    let a = 0n, b = 1n;
    for (let i = 0; i < n; i++) [a, b] = [b, a + b];
    ok(reply, `🔢 Fibonacci(${n}) = ${a.toString()}`);
});

cmd({ pattern: "isprime", desc: "Check if a number is prime", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const n = parseInt(q);
    if (isNaN(n) || n < 0) return fail(reply, "Usage: .isprime <number>");
    if (n < 2) return ok(reply, `❌ ${n} is not prime.`);
    let prime = true;
    for (let i = 2; i * i <= n; i++) if (n % i === 0) { prime = false; break; }
    ok(reply, prime ? `✅ ${n} is prime!` : `❌ ${n} is not prime.`);
});

cmd({ pattern: "gcd", desc: "Find the greatest common divisor of two numbers", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '').split(',').map(s => parseInt(s.trim()));
    if (parts.length !== 2 || parts.some(isNaN)) return fail(reply, "Usage: .gcd a,b");
    let [a, b] = parts.map(Math.abs);
    while (b) [a, b] = [b, a % b];
    ok(reply, `🔢 GCD = ${a}`);
});

cmd({ pattern: "lcm", desc: "Find the lowest common multiple of two numbers", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '').split(',').map(s => parseInt(s.trim()));
    if (parts.length !== 2 || parts.some(isNaN)) return fail(reply, "Usage: .lcm a,b");
    const [x, y] = parts.map(Math.abs);
    const gcd = (a, b) => b ? gcd(b, a % b) : a;
    ok(reply, `🔢 LCM = ${(x * y) / gcd(x, y)}`);
});

cmd({ pattern: "sqrt", desc: "Calculate the square root of a number", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const n = parseFloat(q);
    if (isNaN(n) || n < 0) return fail(reply, "Usage: .sqrt <non-negative number>");
    ok(reply, `🔢 √${n} = ${Math.sqrt(n).toFixed(4)}`);
});

cmd({ pattern: "power", alias: ["pow"], desc: "Calculate base^exponent", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '').split(',').map(s => parseFloat(s.trim()));
    if (parts.length !== 2 || parts.some(isNaN)) return fail(reply, "Usage: .power base,exponent");
    ok(reply, `🔢 ${parts[0]}^${parts[1]} = ${Math.pow(parts[0], parts[1])}`);
});

cmd({ pattern: "average", alias: ["avg", "mean"], desc: "Calculate the average of a list of numbers", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const nums = (q || '').split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (!nums.length) return fail(reply, "Usage: .average 4,8,15,16,23,42");
    ok(reply, `📊 Average = ${(nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2)}`);
});

cmd({ pattern: "median", desc: "Calculate the median of a list of numbers", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const nums = (q || '').split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n)).sort((a, b) => a - b);
    if (!nums.length) return fail(reply, "Usage: .median 4,8,15,16,23,42");
    const mid = Math.floor(nums.length / 2);
    const median = nums.length % 2 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
    ok(reply, `📊 Median = ${median}`);
});

cmd({ pattern: "sum", desc: "Add up a list of numbers", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const nums = (q || '').split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (!nums.length) return fail(reply, "Usage: .sum 4,8,15,16,23,42");
    ok(reply, `📊 Sum = ${nums.reduce((a, b) => a + b, 0)}`);
});

cmd({ pattern: "max", desc: "Find the largest number in a list", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const nums = (q || '').split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (!nums.length) return fail(reply, "Usage: .max 4,8,15,16,23,42");
    ok(reply, `📊 Max = ${Math.max(...nums)}`);
});

cmd({ pattern: "min", desc: "Find the smallest number in a list", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const nums = (q || '').split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n));
    if (!nums.length) return fail(reply, "Usage: .min 4,8,15,16,23,42");
    ok(reply, `📊 Min = ${Math.min(...nums)}`);
});

cmd({ pattern: "romannumeral", alias: ["toroman"], desc: "Convert a number to Roman numerals", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const n = parseInt(q);
    if (isNaN(n) || n < 1 || n > 3999) return fail(reply, "Usage: .romannumeral <1-3999>");
    const table = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
    let num = n, out = '';
    for (const [val, sym] of table) { while (num >= val) { out += sym; num -= val; } }
    ok(reply, `🏛️ ${n} = ${out}`);
});

cmd({ pattern: "fromroman", desc: "Convert Roman numerals to a number", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .fromroman <roman numeral e.g. MCMXCIV>");
    const map = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
    const s = q.toUpperCase().trim();
    if (!/^[IVXLCDM]+$/.test(s)) return fail(reply, "Invalid Roman numeral.");
    let total = 0;
    for (let i = 0; i < s.length; i++) {
        const cur = map[s[i]], next = map[s[i + 1]];
        total += (next && cur < next) ? -cur : cur;
    }
    ok(reply, `🏛️ ${s} = ${total}`);
});

// ==================== DATE / TIME TOOLS ====================

cmd({ pattern: "weekday", desc: "Find what day of the week a date falls on", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .weekday DD-MM-YYYY");
    const parts = q.split(/[-\/]/).map(Number);
    if (parts.length !== 3) return fail(reply, "Format: .weekday DD-MM-YYYY");
    const [d, mo, y] = parts;
    const date = new Date(y, mo - 1, d);
    if (isNaN(date.getTime())) return fail(reply, "Invalid date.");
    const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
    ok(reply, `📅 ${q} was/is a ${days[date.getDay()]}`);
});

cmd({ pattern: "daysbetween", desc: "Count days between two dates", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '').split(',').map(s => s.trim());
    if (parts.length !== 2) return fail(reply, "Usage: .daysbetween DD-MM-YYYY,DD-MM-YYYY");
    const parse = s => { const [d, mo, y] = s.split(/[-\/]/).map(Number); return new Date(y, mo - 1, d); };
    const d1 = parse(parts[0]), d2 = parse(parts[1]);
    if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return fail(reply, "Invalid date(s). Use DD-MM-YYYY,DD-MM-YYYY");
    const days = Math.round(Math.abs(d2 - d1) / 86400000);
    ok(reply, `📅 ${days} days between those dates.`);
});

cmd({ pattern: "isleapyear", desc: "Check if a year is a leap year", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const y = parseInt(q);
    if (isNaN(y)) return fail(reply, "Usage: .isleapyear <year>");
    const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
    ok(reply, isLeap ? `✅ ${y} is a leap year.` : `❌ ${y} is not a leap year.`);
});

cmd({ pattern: "timestamp", alias: ["unixtime"], desc: "Get the current Unix timestamp", category: "tools", filename: __filename },
async (conn, mek, m, { reply }) => { ok(reply, `🕐 ${Math.floor(Date.now() / 1000)}`); });

cmd({ pattern: "fromtimestamp", desc: "Convert a Unix timestamp to a readable date", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const ts = parseInt(q);
    if (isNaN(ts)) return fail(reply, "Usage: .fromtimestamp <unix timestamp>");
    const ms = ts > 9999999999 ? ts : ts * 1000; // handle both sec and ms timestamps
    const date = new Date(ms);
    if (isNaN(date.getTime())) return fail(reply, "Invalid timestamp.");
    ok(reply, `🕐 ${date.toUTCString()}`);
});

// ==================== TEXT TOOLS ====================

cmd({ pattern: "scramble", desc: "Scramble the letters of a word", category: "fun", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .scramble <word>");
    const arr = q.split('');
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    ok(reply, `🔀 ${arr.join('')}`);
});

cmd({ pattern: "capitalize", desc: "Capitalize just the first letter of text", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .capitalize <text>");
    ok(reply, q.charAt(0).toUpperCase() + q.slice(1));
});

cmd({ pattern: "shuffle", desc: "Shuffle the order of comma-separated items", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const items = (q || '').split(',').map(s => s.trim()).filter(Boolean);
    if (items.length < 2) return fail(reply, "Usage: .shuffle item1,item2,item3");
    for (let i = items.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [items[i], items[j]] = [items[j], items[i]];
    }
    ok(reply, `🔀 ${items.join(', ')}`);
});

cmd({ pattern: "initials", desc: "Get the initials from a name", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .initials <full name>");
    const initials = q.trim().split(/\s+/).map(w => w[0].toUpperCase()).join('');
    ok(reply, `🔤 ${initials}`);
});

cmd({ pattern: "strlen", alias: ["textlength"], desc: "Get the length of text", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => { if (!q) return fail(reply, "Usage: .strlen <text>"); ok(reply, `🔤 Length: ${q.length}`); });

module.exports = {};
