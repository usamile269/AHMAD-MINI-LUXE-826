const { cmd } = require('../ahmad-core');
const { randomFooter } = require('../lib/menu-styles');

// ══════════════════════════════════════════════════════════════════════════
// ✒️ TEXT STYLE TOOLS — 8 pure-JS text transformers, zero external API calls.
// These never go down, never rate-limit, never need a key — unlike
// downloader/AI commands that depend on third-party services.
// ══════════════════════════════════════════════════════════════════════════

const FOOTER = "\n\n> " + randomFooter();

function fail(reply, usage) {
    return reply(`❌ ${usage}${FOOTER}`);
}

// --- smallcaps ---
const SMALLCAPS_MAP = {
    a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',
    n:'ɴ',o:'ᴏ',p:'ᴘ',q:'ǫ',r:'ʀ',s:'ꜱ',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ'
};
cmd({ pattern: 'smallcaps', desc: 'Convert text to sᴍᴀʟʟᴄᴀᴘꜱ', category: 'tools', filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, 'Usage: .smallcaps hello world');
    const out = q.toLowerCase().split('').map(c => SMALLCAPS_MAP[c] || c).join('');
    reply(out + FOOTER);
});

// --- bubbletext ---
const BUBBLE_MAP = {
    a:'ⓐ',b:'ⓑ',c:'ⓒ',d:'ⓓ',e:'ⓔ',f:'ⓕ',g:'ⓖ',h:'ⓗ',i:'ⓘ',j:'ⓙ',k:'ⓚ',l:'ⓛ',m:'ⓜ',
    n:'ⓝ',o:'ⓞ',p:'ⓟ',q:'ⓠ',r:'ⓡ',s:'ⓢ',t:'ⓣ',u:'ⓤ',v:'ⓥ',w:'ⓦ',x:'ⓧ',y:'ⓨ',z:'ⓩ',
    0:'⓪',1:'①',2:'②',3:'③',4:'④',5:'⑤',6:'⑥',7:'⑦',8:'⑧',9:'⑨'
};
cmd({ pattern: 'bubbletext', alias: ['bubble'], desc: 'Convert text to ⓑⓤⓑⓑⓛⓔ letters', category: 'tools', filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, 'Usage: .bubbletext hello world');
    const out = q.toLowerCase().split('').map(c => BUBBLE_MAP[c] || c).join('');
    reply(out + FOOTER);
});

// --- upsidedown ---
const FLIP_MAP = {
    a:'ɐ',b:'q',c:'ɔ',d:'p',e:'ǝ',f:'ɟ',g:'ƃ',h:'ɥ',i:'ᴉ',j:'ɾ',k:'ʞ',l:'l',m:'ɯ',
    n:'u',o:'o',p:'d',q:'b',r:'ɹ',s:'s',t:'ʇ',u:'n',v:'ʌ',w:'ʍ',x:'x',y:'ʎ',z:'z',
    '.':'˙',',':"'",'?':'¿','!':'¡',"'":',','(':')',')':'('
};
cmd({ pattern: 'upsidedown', desc: 'Flip text ıɐʇoʇ ǝpısdn', category: 'tools', filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, 'Usage: .upsidedown hello world');
    const out = q.toLowerCase().split('').reverse().map(c => FLIP_MAP[c] || c).join('');
    reply(out + FOOTER);
});

// --- strikethrough (unicode combining char, works in WA) ---
cmd({ pattern: 'strikethrough', alias: ['strike'], desc: 'S̶t̶r̶i̶k̶e̶t̶h̶r̶o̶u̶g̶h̶ text', category: 'tools', filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, 'Usage: .strikethrough hello world');
    const out = q.split('').map(c => c + '\u0336').join('');
    reply(out + FOOTER);
});

// --- underline ---
cmd({ pattern: 'underlinetext', alias: ['utext'], desc: 'U̲n̲d̲e̲r̲l̲i̲n̲e̲ text', category: 'tools', filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, 'Usage: .underlinetext hello world');
    const out = q.split('').map(c => c + '\u0332').join('');
    reply(out + FOOTER);
});

// --- zalgo (glitchy text — capped intensity so it stays readable) ---
const ZALGO_MARKS = ['\u0301','\u0302','\u0303','\u0304','\u0305','\u0306','\u0307','\u0308','\u030a','\u030b','\u030c','\u0323','\u0324','\u0325'];
cmd({ pattern: 'zalgo', desc: 'Ĉ̷h̸̛a̶͊o̴̅t̵̏i̶c̶ zalgo text', category: 'tools', filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, 'Usage: .zalgo hello world');
    const out = q.split('').map(c => {
        if (c === ' ') return c;
        const marks = Math.floor(Math.random() * 3) + 1;
        let r = c;
        for (let i = 0; i < marks; i++) r += ZALGO_MARKS[Math.floor(Math.random() * ZALGO_MARKS.length)];
        return r;
    }).join('');
    reply(out + FOOTER);
});

// --- fullwidth ---
cmd({ pattern: 'fullwidth', alias: ['wide'], desc: 'Ｃｏｎｖｅｒｔ ｔｏ full-width text', category: 'tools', filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, 'Usage: .fullwidth hello world');
    const out = q.split('').map(c => {
        const code = c.charCodeAt(0);
        if (code >= 33 && code <= 126) return String.fromCharCode(code + 0xFEE0);
        if (c === ' ') return '\u3000';
        return c;
    }).join('');
    reply(out + FOOTER);
});

// --- clap ---
cmd({ pattern: 'clap', desc: 'Insert 👏 between 👏 words', category: 'tools', filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, 'Usage: .clap hello world');
    reply(q.trim().split(/\s+/).join(' 👏 ') + FOOTER);
});
