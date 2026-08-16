const { cmd } = require('../ahmad-core');
const { ttsVoice } = require('./funny-voices');

// 🎙️ Romantic / funny Urdu voice-note commands. Uses the same free Google
// Translate TTS engine as the rest of the bot's voice commands (funny-voices.js).
// NOTE (honesty): Google's free TTS only offers ONE voice per language — there's
// no way to pick a specific "cute girl" voice from a free API. What we CAN vary
// is pitch/speed (a higher pitch + slightly faster reads a little softer/sweeter)
// and, more importantly, the actual WORDS — so each command has several
// hand-written Urdu lines that rotate randomly for variety.
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

// Slightly higher pitch + gentle speed = softer/sweeter delivery (best we can
// do without a paid voice-cloning API).
const SWEET_VOICE = { pitch: 1.15, speed: 1.0 };
const FUNNY_VOICE = { pitch: 1.3, speed: 1.15 };

const loveLines = [
    "Jaanu, tumhari yaad bohot aati hai. Tum meri zindagi ki sabse pyari cheez ho.",
    "Main tumse bohot pyar karta hoon, tum meri jaan ho, mera sukoon ho.",
    "Tumhari muskurahat dekh kar mera din ban jata hai. I love you bohot zyada.",
    "Har pal tumhara khayal aata hai. Tum ho to sab kuch acha lagta hai, i love you."
];

const flirtLines = [
    "Aap itni pyari kyun ho? Dekh kar dil dhadakna bhool jata hai.",
    "Kya aap GPS ho? Kyunki mujhe apne dil mein raasta mil gaya hai aap tak.",
    "Aapki smile dekh kar lagta hai duniya ki sabse achi cheez yehi hai."
];

const funnyLines = [
    "Oye hoye, itna pyar? Bhai sambhal ke, dil kamzor hai mera!",
    "Arre wah, kya baat hai, aap to seedha dil mein ghus gaye bina visa ke!",
    "Suno ji, itni mohabbat dekh kar mera network hi hang ho gaya."
];

cmd({
    pattern: 'loveyou',
    alias: ['iloveyou', 'ily'],
    desc: '💕 Cute romantic Urdu voice reply',
    category: 'fun',
    react: '💕'
}, async (conn, mek, m, { from }) => {
    await ttsVoice(conn, from, mek, pick(loveLines), 'ur', SWEET_VOICE);
});

// 📜 REAL SHAYARI (Ahmad: ".shayari/.poetry mein TTS nahi, asli shayaron ka
// kalam chahiye — Ahmad Faraz, Jaun Elia, etc). No reliable free API exists
// for this with correct attribution (poetry gets misquoted constantly
// online) — a small hand-checked local collection is more trustworthy than
// an unverified API. Only couplets I'm confident are correctly attributed
// are included; contemporary/less-documented poets (e.g. Ali Zaryoun) were
// left out rather than risk a wrong quote. Send more verified couplets and
// I'll add them.
const realShayari = [
    { poet: "Ahmad Faraz", text: "Ranjish hi sahi dil hi dukhane ke liye aa\nAa phir se mujhe chhod ke jaane ke liye aa" },
    { poet: "Ahmad Faraz", text: "Suna hai log usay aankh bhar ke dekhte hain\nSo uske shehar mein kuch din thehar ke dekhte hain" },
    { poet: "Ahmad Faraz", text: "Ab ke hum bichray to shayad kabhi khwabon mein milein\nJis tarah sukhay huay phool kitabon mein milein" },
    { poet: "Jaun Elia", text: "Main bhi bahut ajeeb hoon, itna ajeeb hoon ke bas\nKhud ko tabah kar liya aur malal bhi nahi" },
    { poet: "Faiz Ahmad Faiz", text: "Aur bhi dukh hain zamane mein mohabbat ke siwa\nRahatein aur bhi hain wasl ki raahat ke siwa" },
    { poet: "Faiz Ahmad Faiz", text: "Bol ke lab azad hain tere\nBol zabaan ab tak teri hai" },
    { poet: "Parveen Shakir", text: "Ku-ba-ku phail gayi baat shanasai ki\nUss ne khushbu ki tarah meri pehchaan rakhi" },
    { poet: "Parveen Shakir", text: "Wo tou khushbu hai hawaon mein bikhar jayega\nMasla phool ka hai phool kidhar jayega" },
];

cmd({
    pattern: 'shayari',
    alias: ['urdushayari', 'poetry'],
    desc: '🌹 Real shayari by famous Urdu poets',
    category: 'fun',
    react: '🌹',
    use: '.shayari [poet name] — e.g. .shayari faraz'
}, async (conn, mek, m, { from, args, reply }) => {
    const filter = args.join(' ').toLowerCase().trim();
    const pool = filter
        ? realShayari.filter(s => s.poet.toLowerCase().includes(filter))
        : realShayari;
    if (!pool.length) return reply(`❌ Is naam ka shayar nahi mila.\n📜 Available: ${[...new Set(realShayari.map(s => s.poet))].join(', ')}`);
    const s = pick(pool);
    reply(`🌹 *${s.text}*\n\n— *${s.poet}*`);
});

cmd({
    pattern: 'flirt',
    alias: ['flirtvoice', 'pyar'],
    desc: '😘 Flirty Urdu voice line',
    category: 'fun',
    react: '😘'
}, async (conn, mek, m, { from }) => {
    await ttsVoice(conn, from, mek, pick(flirtLines), 'ur', SWEET_VOICE);
});

cmd({
    pattern: 'funnyvoice',
    alias: ['funnyurdu', 'majaak'],
    desc: '😂 Funny reaction voice note in Urdu',
    category: 'fun',
    react: '😂'
}, async (conn, mek, m, { from }) => {
    await ttsVoice(conn, from, mek, pick(funnyLines), 'ur', FUNNY_VOICE);
});

// Custom: .voicesay <apna text> — same sweet voice, but your own words
cmd({
    pattern: 'voicesay',
    alias: ['saytts', 'urdutts'],
    desc: '🎙️ Say your own text as a cute Urdu voice note',
    category: 'fun',
    react: '🎙️',
    use: '.voicesay <text>'
}, async (conn, mek, m, { from, args, reply }) => {
    const text = args.join(' ');
    if (!text) return reply('❌ Kuch text do na!\n💡 Use: .voicesay tumhe bohot miss karta hoon');
    await ttsVoice(conn, from, mek, text.slice(0, 200), 'ur', SWEET_VOICE);
});

module.exports = {};
