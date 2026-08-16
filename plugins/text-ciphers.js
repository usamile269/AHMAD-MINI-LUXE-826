const { cmd } = require('../ahmad-core');

const MORSE_MAP = {
    A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.',
    H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.',
    O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-',
    V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..',
    '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-',
    '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.',
    ' ': '/'
};
const MORSE_REVERSE = Object.fromEntries(Object.entries(MORSE_MAP).map(([k, v]) => [v, k]));

cmd({
    pattern: 'caesarcipher',
    alias: ['caesar'],
    desc: 'Encode/decode text with a Caesar cipher shift',
    category: 'tools',
    react: '🔐',
    use: '.caesarcipher <shift> <text>'
}, async (conn, mek, m, { reply, args }) => {
    const shift = parseInt(args[0], 10);
    const text = args.slice(1).join(' ');
    if (isNaN(shift) || !text) return reply('❌ Use: .caesarcipher <shift number> <text>\nExample: .caesarcipher 3 Hello World');
    const result = text.replace(/[a-zA-Z]/g, (ch) => {
        const base = ch === ch.toUpperCase() ? 65 : 97;
        return String.fromCharCode(((ch.charCodeAt(0) - base + shift) % 26 + 26) % 26 + base);
    });
    reply(`🔐 *Caesar Cipher (shift ${shift})*\n\n${result}`);
});

cmd({
    pattern: 'atbash',
    desc: 'Encode/decode text with the Atbash cipher (A↔Z, B↔Y, etc)',
    category: 'tools',
    react: '🔡',
    use: '.atbash <text>'
}, async (conn, mek, m, { reply, text, args }) => {
    const input = (text || args.join(' ')).trim();
    if (!input) return reply('❌ Use: .atbash <text>');
    const result = input.replace(/[a-zA-Z]/g, (ch) => {
        const isUpper = ch === ch.toUpperCase();
        const base = isUpper ? 65 : 97;
        return String.fromCharCode(base + (25 - (ch.charCodeAt(0) - base)));
    });
    reply(`🔡 *Atbash Cipher*\n\n${result}`);
});

cmd({
    pattern: 'tomorse',
    desc: 'Convert text to Morse code',
    category: 'tools',
    react: '📡',
    use: '.tomorse <text>'
}, async (conn, mek, m, { reply, text, args }) => {
    const input = (text || args.join(' ')).trim().toUpperCase();
    if (!input) return reply('❌ Use: .tomorse <text>');
    const result = input.split('').map((ch) => MORSE_MAP[ch] ?? ch).join(' ');
    reply(`📡 *Morse Code*\n\n${result}`);
});

cmd({
    pattern: 'frommorse',
    desc: 'Convert Morse code back to text',
    category: 'tools',
    react: '📡',
    use: '.frommorse <morse code, space-separated>'
}, async (conn, mek, m, { reply, text, args }) => {
    const input = (text || args.join(' ')).trim();
    if (!input) return reply('❌ Use: .frommorse .... . .-.. .-.. ---');
    const result = input.split(' ').map((code) => MORSE_REVERSE[code] ?? code).join('');
    reply(`📝 *Decoded*\n\n${result}`);
});

cmd({
    pattern: 'tobinary',
    desc: 'Convert text to binary',
    category: 'tools',
    react: '💻',
    use: '.tobinary <text>'
}, async (conn, mek, m, { reply, text, args }) => {
    const input = (text || args.join(' ')).trim();
    if (!input) return reply('❌ Use: .tobinary <text>');
    const result = input.split('').map((ch) => ch.charCodeAt(0).toString(2).padStart(8, '0')).join(' ');
    reply(`💻 *Binary*\n\n${result}`);
});
