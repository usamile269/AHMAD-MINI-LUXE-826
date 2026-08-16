// ============================================================================
// lib/card-styles.js — shared "attractive card" text layout used by welcome,
// goodbye, and profile commands. Kept as plain styled text (bordered box +
// bold-serif + emoji) rather than a canvas-rendered image, since this repo
// has no image/canvas library installed — adding one (e.g. @napi-rs/canvas)
// risks breaking installs on free hosts (Railway/KataBump/Render free tiers
// sometimes fail native-module builds). The member's actual profile photo
// is still attached as the message image, so it looks like a real "card"
// even though the box itself is text.
// ============================================================================

// 🔧 Bunty: "footer to wohi hai all file may footer yeh karo" — use the
// same shared footer pool (now just the 2 luxury footers) everywhere,
// instead of each card having its own hardcoded footer text.
const { randomFooter } = require('./menu-styles');

const BOLD_SERIF_MAP = {
    A:'𝑨',B:'𝑩',C:'𝑪',D:'𝑫',E:'𝑬',F:'𝑭',G:'𝑮',H:'𝑯',I:'𝑰',J:'𝑱',K:'𝑲',L:'𝑳',M:'𝑴',
    N:'𝑵',O:'𝑶',P:'𝑷',Q:'𝑸',R:'𝑹',S:'𝑺',T:'𝑻',U:'𝑼',V:'𝑽',W:'𝑾',X:'𝑿',Y:'𝒀',Z:'𝒁',
    a:'𝒂',b:'𝒃',c:'𝒄',d:'𝒅',e:'𝒆',f:'𝒇',g:'𝒈',h:'𝒉',i:'𝒊',j:'𝒋',k:'𝒌',l:'𝒍',m:'𝒎',
    n:'𝒏',o:'𝒐',p:'𝒑',q:'𝒒',r:'𝒓',s:'𝒔',t:'𝒕',u:'𝒖',v:'𝒗',w:'𝒘',x:'𝒙',y:'𝒚',z:'𝒛',
};
function bs(str) { return String(str).split('').map(c => BOLD_SERIF_MAP[c] || c).join(''); }

function renderWelcomeCard({ mention, groupName, memberCount, botName }) {
    return (
        `╭─❖ ${bs('WELCOME')} ❖─╮\n` +
        `┃\n` +
        `┃ 🎉 ${mention}\n` +
        // 🔧 FIX (Bunty: "yeh * a jata hai" — raw asterisk showing in welcome
        // card instead of rendering bold): swapped WhatsApp's *bold* markdown
        // for the same bold-serif unicode font used everywhere else in the
        // card. Native *asterisk* bold is unreliable inside these box-drawn
        // captions and can render as a literal "*" instead of bolding.
        `┃ ${bs('has joined')} ${bs(groupName)}\n` +
        `┃\n` +
        `┃ 👥 ${bs('Member #')}${memberCount}\n` +
        `┃\n` +
        `╰──────────────╯\n` +
        `> ${randomFooter()}`
    );
}

function renderGoodbyeCard({ mention, groupName, memberCount }) {
    return (
        `╭─❖ ${bs('GOODBYE')} ❖─╮\n` +
        `┃\n` +
        `┃ 👋 ${mention}\n` +
        // 🔧 FIX — same raw-asterisk issue as welcome card, fixed here too
        // (this is the "leave" message Bunty flagged specifically).
        `┃ ${bs('has left')} ${bs(groupName)}\n` +
        `┃\n` +
        `┃ 👥 ${bs('Members left')}: ${memberCount}\n` +
        `┃\n` +
        `╰──────────────╯\n` +
        `> ${randomFooter()}`
    );
}

function renderProfileCard({ name, number, bio, isAdmin, groupName }) {
    let card =
        `╭─❖ ${bs('PROFILE')} ❖─╮\n` +
        `┃\n` +
        `┃ 👤 ${bs('Name')}   : ${name}\n` +
        `┃ 🔢 ${bs('Number')} : +${number}\n`;
    if (bio) card += `┃ 📝 ${bs('About')}  : ${bio}\n`;
    if (groupName) card += `┃ 👥 ${bs('Group')}  : ${groupName}\n`;
    if (typeof isAdmin === 'boolean') card += `┃ 🛡️ ${bs('Role')}   : ${isAdmin ? 'Admin' : 'Member'}\n`;
    card +=
        `┃\n` +
        `╰──────────────╯\n` +
        `> ${randomFooter()}`;
    return card;
}

module.exports = { renderWelcomeCard, renderGoodbyeCard, renderProfileCard };
