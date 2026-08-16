const { cmd } = require('../ahmad-core');
const crypto = require('crypto');
const { randomFooter } = require('../lib/menu-styles');

const FOOTER = "\n\n> ✦﹒𝙊𝘽𝙎𝙄𝘿𝙄𝘼𝙉 𝙇𝙐𝙓𝙀 𝘼𝙃𝙈𝘼𝘿 𝙈𝙄𝙉𝙄";
const box = (title, body) => `╭═══ ${title} ═══⊷\n${body}\n╰═════════════════⊷${FOOTER}`;

// Deterministic "random" % from a string — same input always gives the same
// fun result (so .lovecalc ahmad,sara gives the same answer every time).
function hashPercent(str, min = 0, max = 100) {
    const h = crypto.createHash('md5').update(str.toLowerCase()).digest('hex');
    const n = parseInt(h.substring(0, 8), 16);
    return min + (n % (max - min + 1));
}

// ==================== FUN CALCULATORS ====================
cmd({ pattern: "lovecalculator", alias: ["lovecalc"], desc: "💕 Calculate love % between two names", category: "fun", react: "💕", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '').split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length !== 2) return reply("❌ Format: .lovecalculator name1,name2\nExample: .lovecalculator Ahmad,Sara");
    const pct = hashPercent(parts.sort().join('+'));
    const bar = '💖'.repeat(Math.round(pct / 10)) + '🤍'.repeat(10 - Math.round(pct / 10));
    const verdict = pct > 80 ? "Perfect match! 💍" : pct > 50 ? "Good chemistry! 😍" : pct > 25 ? "It could work... 🤔" : "Just friends maybe 😅";
    reply(box("💕 LOVE CALCULATOR", `┃❃│ ${parts[0]} ❤️ ${parts[1]}\n┃❃│ \n┃❃│ ${bar}\n┃❃│ \n┃❃│ Match: ${pct}%\n┃❃│ ${verdict}`));
});

cmd({ pattern: "friendshipcalculator", alias: ["friendcalc"], desc: "🤝 Calculate friendship % between two names", category: "fun", react: "🤝", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '').split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length !== 2) return reply("❌ Format: .friendshipcalculator name1,name2\nExample: .friendshipcalculator Ahmad,Bilal");
    const pct = hashPercent(parts.sort().join('#friend'));
    const bar = '🤝'.repeat(Math.round(pct / 10)) + '⬜'.repeat(10 - Math.round(pct / 10));
    const verdict = pct > 80 ? "Best friends forever! 🎉" : pct > 50 ? "Solid friendship! 😊" : pct > 25 ? "Growing bond 🌱" : "Still getting to know each other 👋";
    reply(box("🤝 FRIENDSHIP CALCULATOR", `┃❃│ ${parts[0]} 🤝 ${parts[1]}\n┃❃│ \n┃❃│ ${bar}\n┃❃│ \n┃❃│ Bond: ${pct}%\n┃❃│ ${verdict}`));
});

cmd({ pattern: "luckcalculator", alias: ["dailyluck"], desc: "🍀 Get your luck percentage for today", category: "fun", react: "🍀", filename: __filename },
async (conn, mek, m, { reply, sender }) => {
    const today = new Date().toISOString().split('T')[0];
    const pct = hashPercent(sender + today);
    const stars = '⭐'.repeat(Math.round(pct / 20));
    reply(box("🍀 TODAY'S LUCK", `┃❃│ Date: ${today}\n┃❃│ Luck Score: ${pct}%\n┃❃│ ${stars}\n┃❃│ \n┃❃│ ${pct > 70 ? "Great day ahead! 🌟" : pct > 40 ? "Pretty average day 🙂" : "Take it easy today 🌧️"}`));
});

cmd({ pattern: "iqtestfun", alias: ["iqcheck"], desc: "🧠 Fun random IQ test (for entertainment)", category: "fun", react: "🧠", filename: __filename },
async (conn, mek, m, { reply, sender }) => {
    const iq = 85 + hashPercent(sender + Date.now(), 0, 60);
    const verdict = iq > 130 ? "Genius! 🧠✨" : iq > 110 ? "Above average! 👏" : iq > 90 ? "Solid average 🙂" : "Everyone has off days 😄";
    reply(box("🧠 IQ TEST (for fun)", `┃❃│ Your IQ: ${iq}\n┃❃│ ${verdict}\n┃❃│ \n┃❃│ ⚠️ Purely for entertainment, not a real test.`));
});

cmd({ pattern: "decisionmaker", alias: ["yesorno"], desc: "🎲 Let the bot make a yes/no decision", category: "fun", react: "🎲", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const options = ["✅ Yes, definitely!", "❌ No, don't do it.", "🤷 Maybe, think again.", "✅ Absolutely yes!", "❌ I'd say no.", "🔄 Ask again later."];
    const pick = options[Math.floor(Math.random() * options.length)];
    reply(box("🎲 DECISION MAKER", `┃❃│ Question: ${q || '(none given)'}\n┃❃│ Answer: ${pick}`));
});

// ==================== TEXT STYLERS (unicode, guaranteed to work) ====================
cmd({ pattern: "spongebobcase", alias: ["mockingcase"], desc: "🧽 sPoNgEbOb MoCkInG cAsE", category: "tools", react: "🧽", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.\nExample: .spongebobcase this is funny");
    const out = q.split('').map((c, i) => i % 2 === 0 ? c.toLowerCase() : c.toUpperCase()).join('');
    reply(box("🧽 SPONGEBOB CASE", `┃❃│ ${out}`));
});

cmd({ pattern: "upsidedowntext", alias: ["flipupside"], desc: "🙃 Flip text upside down", category: "tools", react: "🙃", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.");
    const map = { a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ᴉ',j:'ɾ',k:'ʞ',l:'l',m:'ɯ',n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',u:'n',v:'ʌ',w:'ʍ',x:'x',y:'ʎ',z:'z',
        A:'∀',B:'ᙠ',C:'Ɔ',D:'ᗡ',E:'Ǝ',F:'Ⅎ',G:'⅁',H:'H',I:'I',J:'ſ',K:'ʞ',L:'⅂',M:'W',N:'N',O:'O',P:'Ԁ',Q:'Ò',R:'ᴚ',S:'S',T:'⊥',U:'∩',V:'Λ',W:'M',X:'X',Y:'⅄',Z:'Z',
        '1':'Ɩ','2':'ᄅ','3':'Ɛ','4':'ㄣ','5':'ϛ','6':'9','7':'ㄥ','8':'8','9':'6','0':'0','.':'˙',',':"'","'":',','?':'¿','!':'¡' };
    const out = q.split('').reverse().map(c => map[c] || c).join('');
    reply(box("🙃 UPSIDE DOWN", `┃❃│ ${out}`));
});

cmd({ pattern: "strikethroughtext", alias: ["struckthrough"], desc: "S̶t̶r̶i̶k̶e̶t̶h̶r̶o̶u̶g̶h̶ text", category: "tools", react: "✂️", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.");
    const out = q.split('').map(c => c + '\u0336').join('');
    reply(box("✂️ STRIKETHROUGH", `┃❃│ ${out}`));
});

cmd({ pattern: "superscripttext", alias: ["superscript"], desc: "🔼 Convert text to ˢᵘᵖᵉʳˢᶜʳᶦᵖᵗ", category: "tools", react: "🔼", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.");
    const map = { a:'ᵃ',b:'ᵇ',c:'ᶜ',d:'ᵈ',e:'ᵉ',f:'ᶠ',g:'ᵍ',h:'ʰ',i:'ᶦ',j:'ʲ',k:'ᵏ',l:'ˡ',m:'ᵐ',n:'ⁿ',o:'ᵒ',p:'ᵖ',q:'ᑫ',r:'ʳ',s:'ˢ',t:'ᵗ',u:'ᵘ',v:'ᵛ',w:'ʷ',x:'ˣ',y:'ʸ',z:'ᶻ','0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹' };
    const out = q.toLowerCase().split('').map(c => map[c] || c).join('');
    reply(box("🔼 SUPERSCRIPT", `┃❃│ ${out}`));
});

cmd({ pattern: "subscripttext", alias: ["subscript"], desc: "🔽 Convert text to ₛᵤᵦₛᶜᵣᵢₚₜ", category: "tools", react: "🔽", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.");
    const map = { a:'ₐ',e:'ₑ',h:'ₕ',i:'ᵢ',j:'ⱼ',k:'ₖ',l:'ₗ',m:'ₘ',n:'ₙ',o:'ₒ',p:'ₚ',r:'ᵣ',s:'ₛ',t:'ₜ',u:'ᵤ',v:'ᵥ',x:'ₓ','0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉' };
    const out = q.toLowerCase().split('').map(c => map[c] || c).join('');
    reply(box("🔽 SUBSCRIPT", `┃❃│ ${out}`));
});

cmd({ pattern: "zalgotext", alias: ["creepytext"], desc: "👻 Convert text to Z̸̢̛̗a̷̮̋l̶̰̾g̴̈́͜o̷̠͐ creepy text", category: "fun", react: "👻", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.\nExample: .zalgotext hello");
    const marks = ['\u0300','\u0301','\u0302','\u0303','\u0304','\u0305','\u0306','\u0307','\u0308','\u030A','\u030B','\u030C','\u0316','\u0317','\u0318','\u0319'];
    const out = q.split('').map(c => c + Array.from({length: 3}, () => marks[Math.floor(Math.random() * marks.length)]).join('')).join('');
    reply(box("👻 ZALGO TEXT", `┃❃│ ${out}`));
});

cmd({ pattern: "vaporwavetext", alias: ["aesthetictext"], desc: "🌆 Convert text to full-width Ａｅｓｔｈｅｔｉｃ text", category: "tools", react: "🌆", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.\nExample: .vaporwavetext aesthetic");
    const out = q.split('').map(c => {
        const code = c.charCodeAt(0);
        if (code >= 33 && code <= 126) return String.fromCharCode(code + 0xFEE0);
        if (c === ' ') return '\u3000';
        return c;
    }).join('');
    reply(box("🌆 VAPORWAVE", `┃❃│ ${out}`));
});

cmd({ pattern: "claptext", alias: ["clapbetween"], desc: "👏 Add clap emoji between words", category: "fun", react: "👏", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.\nExample: .claptext this is so true");
    reply(box("👏 CLAP TEXT", `┃❃│ ${q.trim().split(/\s+/).join(' 👏 ')} 👏`));
});

cmd({ pattern: "textwave", alias: ["wavetext"], desc: "🌊 Alternate case in a wave pattern", category: "tools", react: "🌊", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Text do.");
    let out = '', up = true;
    for (const c of q) { out += /[a-zA-Z]/.test(c) ? (up ? c.toUpperCase() : c.toLowerCase()) : c; if (/[a-zA-Z]/.test(c)) up = !up; }
    reply(box("🌊 WAVE TEXT", `┃❃│ ${out}`));
});

// ==================== NUMBER / ROMAN ====================
cmd({ pattern: "numbertowords", alias: ["spellnumber"], desc: "🔢 Spell out a number in words", category: "tools", react: "🔢", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const n = parseInt(q);
    if (!q || isNaN(n) || Math.abs(n) > 999999999) return reply("❌ Number do (max 9 digits).\nExample: .numbertowords 4520");
    const ones = ['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
    const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
    function chunk(num) {
        let s = '';
        if (num >= 100) { s += ones[Math.floor(num / 100)] + ' hundred '; num %= 100; }
        if (num >= 20) { s += tens[Math.floor(num / 10)] + ' '; num %= 10; }
        if (num > 0) s += ones[num] + ' ';
        return s.trim();
    }
    function numToWords(num) {
        if (num === 0) return 'zero';
        const neg = num < 0; num = Math.abs(num);
        const units = ['', ' thousand', ' million'];
        let parts = [], i = 0;
        while (num > 0) { const c = num % 1000; if (c) parts.unshift(chunk(c) + units[i]); num = Math.floor(num / 1000); i++; }
        return (neg ? 'negative ' : '') + parts.join(' ');
    }
    reply(box("🔢 NUMBER TO WORDS", `┃❃│ ${n} → ${numToWords(n)}`));
});

// ==================== MORE UNIT CONVERTERS ====================
function convCmd(pattern, alias, label, emoji, fn, example) {
    cmd({ pattern, alias, desc: `${emoji} ${label}`, category: "tools", react: emoji, filename: __filename },
    async (conn, mek, m, { q, reply }) => {
        const n = parseFloat(q);
        if (!q || isNaN(n)) return reply(`❌ Number do.\nExample: .${pattern} ${example}`);
        reply(box(`${emoji} ${label.toUpperCase()}`, `┃❃│ ${fn(n)}`));
    });
}
convCmd("kelvin2c", ["k2c"], "Kelvin to Celsius", "🌡️", n => `${n}K = ${(n - 273.15).toFixed(1)}°C`, "300");
convCmd("c2kelvin", ["c2k"], "Celsius to Kelvin", "🌡️", n => `${n}°C = ${(n + 273.15).toFixed(1)}K`, "27");
convCmd("feet2meter", [], "Feet to Meters", "📏", n => `${n} ft = ${(n * 0.3048).toFixed(2)} m`, "10");
convCmd("meter2feet", [], "Meters to Feet", "📏", n => `${n} m = ${(n * 3.28084).toFixed(2)} ft`, "3");
convCmd("kmh2mph", [], "km/h to mph", "🚗", n => `${n} km/h = ${(n * 0.621371).toFixed(2)} mph`, "100");
convCmd("mph2kmh", [], "mph to km/h", "🚗", n => `${n} mph = ${(n * 1.60934).toFixed(2)} km/h`, "60");
convCmd("mb2gb", [], "MB to GB", "💾", n => `${n} MB = ${(n / 1024).toFixed(3)} GB`, "2048");
convCmd("gb2mb", [], "GB to MB", "💾", n => `${n} GB = ${(n * 1024).toFixed(0)} MB`, "2");
convCmd("kb2mb", [], "KB to MB", "💾", n => `${n} KB = ${(n / 1024).toFixed(3)} MB`, "1500");
convCmd("seconds2hms", ["sec2hms"], "Seconds to H:M:S", "⏱️", n => { const h=Math.floor(n/3600), m2=Math.floor((n%3600)/60), s=Math.floor(n%60); return `${n}s = ${h}h ${m2}m ${s}s`; }, "5000");
convCmd("hms2seconds", ["hms2sec"], "H:M:S to total seconds", "⏱️", n => `${n} hours = ${(n * 3600).toFixed(0)} seconds`, "2");

// ==================== COLORS ====================
const COLOR_MAP = { red:'#FF0000', green:'#00FF00', blue:'#0000FF', black:'#000000', white:'#FFFFFF', yellow:'#FFFF00', orange:'#FFA500', purple:'#800080', pink:'#FFC0CB', gray:'#808080', grey:'#808080', brown:'#A52A2A', cyan:'#00FFFF', magenta:'#FF00FF', gold:'#FFD700', silver:'#C0C0C0', navy:'#000080', teal:'#008080', maroon:'#800000', olive:'#808000', lime:'#00FF00', indigo:'#4B0082', violet:'#EE82EE', turquoise:'#40E0D0', beige:'#F5F5DC', coral:'#FF7F50', crimson:'#DC143C', lavender:'#E6E6FA' };

cmd({ pattern: "colorname2hex", alias: ["colortohex"], desc: "🎨 Get hex code for a color name", category: "tools", react: "🎨", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Color name do.\nExample: .colorname2hex coral");
    const hex = COLOR_MAP[q.trim().toLowerCase()];
    if (!hex) return reply(`❌ "${q}" color database mein nahi mila. Try: ${Object.keys(COLOR_MAP).slice(0, 10).join(', ')}...`);
    reply(box("🎨 COLOR → HEX", `┃❃│ ${q}: ${hex}`));
});

cmd({ pattern: "hex2colorname", alias: ["hextocolor"], desc: "🎨 Find the closest color name for a hex code", category: "tools", react: "🎨", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q || !/^#?[0-9a-fA-F]{6}$/.test(q.trim())) return reply("❌ Hex code do.\nExample: .hex2colorname #FF0000");
    const hex = ('#' + q.trim().replace('#', '')).toUpperCase();
    const toRgb = h => [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)];
    const [r, g, b] = toRgb(hex);
    let closest = null, minDist = Infinity;
    for (const [name, val] of Object.entries(COLOR_MAP)) {
        const [r2, g2, b2] = toRgb(val);
        const dist = (r-r2)**2 + (g-g2)**2 + (b-b2)**2;
        if (dist < minDist) { minDist = dist; closest = name; }
    }
    reply(box("🎨 HEX → COLOR", `┃❃│ ${hex} is closest to: ${closest}`));
});

cmd({ pattern: "randomhexcolor", alias: [], desc: "🎨 Generate a random hex color", category: "fun", react: "🎨", filename: __filename },
async (conn, mek, m, { reply }) => {
    const hex = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0').toUpperCase();
    reply(box("🎨 RANDOM COLOR", `┃❃│ ${hex}`));
});

// ==================== PASSWORD / USERNAME ====================
cmd({ pattern: "passwordgen", alias: ["genpassword"], desc: "🔐 Generate a strong random password", category: "tools", react: "🔐", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const len = Math.min(Math.max(parseInt(q) || 12, 6), 64);
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let pass = '';
    for (let i = 0; i < len; i++) pass += chars[crypto.randomInt(chars.length)];
    reply(box("🔐 PASSWORD GENERATED", `┃❃│ ${pass}\n┃❃│ \n┃❃│ Length: ${len} characters`));
});

cmd({ pattern: "usernamegen", alias: ["genusername"], desc: "👤 Generate creative username ideas", category: "tools", react: "👤", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Base name do.\nExample: .usernamegen ahmad");
    const suffixes = ['_x', 'official', '_pro', '99', '_yt', 'gaming', '_real', '007', '_dev', '_hd'];
    const ideas = suffixes.map(s => q.trim().replace(/\s+/g, '') + s);
    reply(box("👤 USERNAME IDEAS", ideas.map(u => `┃❃│ ${u}`).join('\n')));
});

// ==================== MISC FUN ====================
const NUMEROLOGY_MEANINGS = { 1:"Leader, independent, ambitious", 2:"Diplomatic, cooperative, sensitive", 3:"Creative, expressive, social", 4:"Practical, disciplined, hardworking", 5:"Adventurous, freedom-loving, curious", 6:"Caring, responsible, nurturing", 7:"Analytical, spiritual, introspective", 8:"Ambitious, business-minded, powerful", 9:"Compassionate, idealistic, generous" };

cmd({ pattern: "numerologynum", alias: ["numerology"], desc: "🔮 Get your numerology number from your name", category: "fun", react: "🔮", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return reply("❌ Naam do.\nExample: .numerologynum Ahmad");
    let sum = q.toLowerCase().replace(/[^a-z]/g, '').split('').reduce((a, c) => a + (c.charCodeAt(0) - 96), 0);
    while (sum > 9) sum = String(sum).split('').reduce((a, d) => a + parseInt(d), 0);
    reply(box("🔮 NUMEROLOGY", `┃❃│ Name: ${q}\n┃❃│ Number: ${sum}\n┃❃│ Meaning: ${NUMEROLOGY_MEANINGS[sum] || 'Unique path'}`));
});

cmd({ pattern: "luckynumber", alias: ["mylucky"], desc: "🍀 Get your lucky number for today", category: "fun", react: "🍀", filename: __filename },
async (conn, mek, m, { reply, sender }) => {
    const today = new Date().toISOString().split('T')[0];
    const num = hashPercent(sender + 'lucky' + today, 1, 99);
    reply(box("🍀 LUCKY NUMBER", `┃❃│ Today's lucky number: ${num}`));
});

const ZODIAC_COMPAT = {
    fire: ['aries','leo','sagittarius'], earth: ['taurus','virgo','capricorn'],
    air: ['gemini','libra','aquarius'], water: ['cancer','scorpio','pisces']
};
function elementOf(sign) { for (const [el, signs] of Object.entries(ZODIAC_COMPAT)) if (signs.includes(sign)) return el; return null; }

cmd({ pattern: "zodiaccompat", alias: ["zodiacmatch"], desc: "♈ Check compatibility between two zodiac signs", category: "fun", react: "♈", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '').split(',').map(s => s.trim().toLowerCase());
    if (parts.length !== 2) return reply("❌ Format: .zodiaccompat sign1,sign2\nExample: .zodiaccompat leo,aries");
    const [e1, e2] = [elementOf(parts[0]), elementOf(parts[1])];
    if (!e1 || !e2) return reply("❌ Valid zodiac signs do (aries, taurus, gemini, cancer, leo, virgo, libra, scorpio, sagittarius, capricorn, aquarius, pisces).");
    const compatible = { fire: ['fire','air'], earth: ['earth','water'], air: ['air','fire'], water: ['water','earth'] };
    const isGood = compatible[e1].includes(e2);
    const pct = isGood ? hashPercent(parts.sort().join(''), 65, 99) : hashPercent(parts.sort().join(''), 20, 60);
    reply(box("♈ ZODIAC COMPATIBILITY", `┃❃│ ${parts[0]} (${e1}) + ${parts[1]} (${e2})\n┃❃│ Compatibility: ${pct}%\n┃❃│ ${isGood ? 'Great match! 💫' : 'Needs some work 🤔'}`));
});

cmd({ pattern: "dicegame", alias: ["rolldice"], desc: "🎲 Roll multiple dice at once", category: "fun", react: "🎲", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const count = Math.min(Math.max(parseInt(q) || 2, 1), 10);
    const rolls = Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
    reply(box("🎲 DICE ROLL", `┃❃│ Rolls: ${rolls.join(' 🎲 ')}\n┃❃│ Total: ${rolls.reduce((a, b) => a + b, 0)}`));
});

cmd({ pattern: "cointossmulti", alias: ["multicoinflip"], desc: "🪙 Flip multiple coins at once", category: "fun", react: "🪙", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const count = Math.min(Math.max(parseInt(q) || 3, 1), 20);
    const flips = Array.from({ length: count }, () => Math.random() < 0.5 ? 'H' : 'T');
    const heads = flips.filter(f => f === 'H').length;
    reply(box("🪙 MULTI COIN FLIP", `┃❃│ Results: ${flips.join(' ')}\n┃❃│ Heads: ${heads} | Tails: ${count - heads}`));
});

module.exports = {};
