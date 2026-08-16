const { cmd } = require('../ahmad-core');
const { randomFooter } = require('../lib/menu-styles');

// ══════════════════════════════════════════════════════════════════════════
// 🎨 CONVERTER & COLOR PACK — 8 more pure-JS utility commands, no external API.
// ══════════════════════════════════════════════════════════════════════════

const FOOTER = "\n\n> " + randomFooter();
function fail(reply, usage) { return reply(`❌ ${usage}${FOOTER}`); }

cmd({ pattern: 'hex2rgb', desc: 'Convert HEX color to RGB', category: 'tools', filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const hex = (q || '').trim().replace('#', '');
    if (!/^[0-9a-fA-F]{6}$/.test(hex)) return fail(reply, 'Usage: .hex2rgb #ff5733');
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16);
    reply(`🎨 *#${hex.toUpperCase()}* → rgb(${r}, ${g}, ${b})${FOOTER}`);
});

cmd({ pattern: 'rgb2hex', desc: 'Convert RGB color to HEX', category: 'tools', filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const parts = (q || '').split(',').map(s => parseInt(s.trim(), 10));
    if (parts.length !== 3 || parts.some(n => isNaN(n) || n < 0 || n > 255)) return fail(reply, 'Usage: .rgb2hex 255,87,51');
    const hex = '#' + parts.map(n => n.toString(16).padStart(2, '0')).join('');
    reply(`🎨 rgb(${parts.join(', ')}) → ${hex.toUpperCase()}${FOOTER}`);
});

cmd({ pattern: 'randomcolor', alias: ['randcolor'], desc: 'Generate a random color', category: 'tools', filename: __filename },
async (conn, mek, m, { reply }) => {
    const hex = '#' + Math.floor(Math.random() * 0xFFFFFF).toString(16).padStart(6, '0');
    const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    reply(`🎲 Random color: ${hex.toUpperCase()}\nrgb(${r}, ${g}, ${b})${FOOTER}`);
});

cmd({ pattern: 'cm2inch', desc: 'Convert centimeters to inches', category: 'tools', filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const cm = parseFloat(q);
    if (isNaN(cm)) return fail(reply, 'Usage: .cm2inch 100');
    reply(`📏 ${cm} cm = ${(cm / 2.54).toFixed(2)} in${FOOTER}`);
});

cmd({ pattern: 'inch2cm', desc: 'Convert inches to centimeters', category: 'tools', filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const inch = parseFloat(q);
    if (isNaN(inch)) return fail(reply, 'Usage: .inch2cm 40');
    reply(`📏 ${inch} in = ${(inch * 2.54).toFixed(2)} cm${FOOTER}`);
});

cmd({ pattern: 'ft2m', desc: 'Convert feet to meters', category: 'tools', filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const ft = parseFloat(q);
    if (isNaN(ft)) return fail(reply, 'Usage: .ft2m 6');
    reply(`📏 ${ft} ft = ${(ft * 0.3048).toFixed(3)} m${FOOTER}`);
});

cmd({ pattern: 'm2ft', desc: 'Convert meters to feet', category: 'tools', filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const mt = parseFloat(q);
    if (isNaN(mt)) return fail(reply, 'Usage: .m2ft 1.8');
    reply(`📏 ${mt} m = ${(mt / 0.3048).toFixed(2)} ft${FOOTER}`);
});

// Local heuristic strength check — nothing is sent anywhere or logged,
// checked purely in-memory so it's safe to try real passwords with.
cmd({ pattern: 'passwordstrength', desc: 'Check password strength (checked locally, never stored/sent)', category: 'tools', filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, 'Usage: .passwordstrength MyP@ssw0rd');
    let score = 0;
    const checks = [
        [q.length >= 8, 'At least 8 characters'],
        [q.length >= 12, '12+ characters (extra credit)'],
        [/[a-z]/.test(q), 'Lowercase letter'],
        [/[A-Z]/.test(q), 'Uppercase letter'],
        [/[0-9]/.test(q), 'Number'],
        [/[^a-zA-Z0-9]/.test(q), 'Special character'],
    ];
    checks.forEach(([ok]) => { if (ok) score++; });
    const label = score <= 2 ? '🔴 Weak' : score <= 4 ? '🟡 Medium' : '🟢 Strong';
    const details = checks.map(([ok, label]) => `${ok ? '✅' : '❌'} ${label}`).join('\n');
    reply(`🔐 *Password Strength:* ${label} (${score}/6)\n\n${details}${FOOTER}`);
});
