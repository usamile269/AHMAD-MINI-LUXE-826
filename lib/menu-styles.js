// ============================================================================
// lib/menu-styles.js — 55 selectable .menu border/theme presets
// ----------------------------------------------------------------------------
// Requested by Ahmad: "50+ attractive menu styles, users apni marzi se
// change kar sakin" (users should be able to pick their own).
//
// Instead of hand-writing 50+ near-duplicate template functions, styles are
// built from 11 border-character sets × 5 bullet/list-marker sets = 55
// combinations. Every style shares the same, simple layout — plain text,
// wrapped in WhatsApp's own *bold* markdown for section headers (not the
// old Unicode-letter-replacement font), so it stays readable and "big"
// without the font-breaking issues of the old style.
// ============================================================================

const BORDERS = [
    { key: 'bold',     label: 'Bold',      tl: '┏', tr: '┓', bl: '┗', br: '┛', h: '━', v: '┃' },
    { key: 'classic',  label: 'Classic',   tl: '╭', tr: '╮', bl: '╰', br: '╯', h: '─', v: '┃' },
    { key: 'double',   label: 'Double',    tl: '╔', tr: '╗', bl: '╚', br: '╝', h: '═', v: '║' },
    { key: 'dotted',   label: 'Dotted',    tl: '⌜', tr: '⌝', bl: '⌞', br: '⌟', h: '┄', v: '┆' },
    { key: 'star',     label: 'Star',      tl: '✦', tr: '✦', bl: '✦', br: '✦', h: '─', v: '│' },
    { key: 'diamond',  label: 'Diamond',   tl: '◈', tr: '◈', bl: '◈', br: '◈', h: '─', v: '│' },
    { key: 'flower',   label: 'Flower',    tl: '❀', tr: '❀', bl: '❀', br: '❀', h: '─', v: '│' },
    { key: 'neon',     label: 'Neon',      tl: '▞', tr: '▚', bl: '▞', br: '▚', h: '─', v: '┊' },
    { key: 'bracket',  label: 'Bracket',   tl: '[', tr: ']', bl: '[', br: ']', h: '-', v: '|' },
    { key: 'arrow',    label: 'Arrow',     tl: '»', tr: '«', bl: '»', br: '«', h: '─', v: '│' },
    { key: 'wave',     label: 'Wave',      tl: '〜', tr: '〜', bl: '〜', br: '〜', h: '─', v: '│' },
    { key: 'ornate',   label: 'Ornate',    tl: '━', tr: '┈', bl: '⊷', br: '⊷', h: '━', v: '│' },
];

const BULLETS = [
    { key: 'triangle', label: 'Triangle', mark: '▸' },
    { key: 'arrow',     label: 'Arrow',    mark: '➤' },
    { key: 'dot',       label: 'Dot',      mark: '•' },
    { key: 'sparkle',   label: 'Sparkle',  mark: '✧' },
    { key: 'chevron',   label: 'Chevron',  mark: '➣' },
];

const STYLES = [];
for (const b of BORDERS) {
    for (const bu of BULLETS) {
        STYLES.push({
            id: STYLES.length + 1,
            name: `${b.label} ${bu.label}`,
            border: b,
            bullet: bu.mark,
        });
    }
}

function getStyle(id) {
    const n = parseInt(id, 10);
    return STYLES.find(s => s.id === n) || STYLES[0];
}

function listStyles() {
    return STYLES.map(s => `${s.id}. ${s.name}`).join('\n');
}

const BOLD_SERIF_MAP = {
    A:'𝐀',B:'𝐁',C:'𝐂',D:'𝐃',E:'𝐄',F:'𝐅',G:'𝐆',H:'𝐇',I:'𝐈',J:'𝐉',K:'𝐊',L:'𝐋',M:'𝐌',
    N:'𝐍',O:'𝐎',P:'𝐏',Q:'𝐐',R:'𝐑',S:'𝐒',T:'𝐓',U:'𝐔',V:'𝐕',W:'𝐖',X:'𝐗',Y:'𝐘',Z:'𝐙',
    a:'𝐚',b:'𝐛',c:'𝐜',d:'𝐝',e:'𝐞',f:'𝐟',g:'𝐠',h:'𝐡',i:'𝐢',j:'𝐣',k:'𝐤',l:'𝐥',m:'𝐦',
    n:'𝐧',o:'𝐨',p:'𝐩',q:'𝐪',r:'𝐫',s:'𝐬',t:'𝐭',u:'𝐮',v:'𝐯',w:'𝐰',x:'𝐱',y:'𝐲',z:'𝐳',
    0:'𝟎',1:'𝟏',2:'𝟐',3:'𝟑',4:'𝟒',5:'𝟓',6:'𝟔',7:'𝟕',8:'𝟖',9:'𝟗',
};
// Bold-italic-serif mapping for info-box labels and footer (𝑶𝒘𝒏𝒆𝒓 style)
// 🔧 FIX (Bunty: "jo numbers hein 804 wo bhi bold, all digits bold") —
// Unicode doesn't have a distinct "bold italic" digit set, so digits here
// now reuse the plain Bold digits (𝟖𝟎𝟒) instead of falling through to
// plain ASCII — they still read as clearly bold, just not slanted.
const BOLD_ITALIC_SERIF_MAP = {
    A:'𝑨',B:'𝑩',C:'𝑪',D:'𝑫',E:'𝑬',F:'𝑭',G:'𝑮',H:'𝑯',I:'𝑰',J:'𝑱',K:'𝑲',L:'𝑳',M:'𝑴',
    N:'𝑵',O:'𝑶',P:'𝑷',Q:'𝑸',R:'𝑹',S:'𝑺',T:'𝑻',U:'𝑼',V:'𝑽',W:'𝑾',X:'𝑿',Y:'𝒀',Z:'𝒁',
    a:'𝒂',b:'𝒃',c:'𝒄',d:'𝒅',e:'𝒆',f:'𝒇',g:'𝒈',h:'𝒉',i:'𝒊',j:'𝒋',k:'𝒌',l:'𝒍',m:'𝒎',
    n:'𝒏',o:'𝒐',p:'𝒑',q:'𝒒',r:'𝒓',s:'𝒔',t:'𝒕',u:'𝒖',v:'𝒗',w:'𝒘',x:'𝒙',y:'𝒚',z:'𝒛',
    0:'𝟎',1:'𝟏',2:'𝟐',3:'𝟑',4:'𝟒',5:'𝟓',6:'𝟔',7:'𝟕',8:'𝟖',9:'𝟗',
};
function toBoldSerif(str) {
    return String(str).split('').map(ch => BOLD_SERIF_MAP[ch] || ch).join('');
}
function toBoldItalicSerif(str) {
    return String(str).split('').map(ch => BOLD_ITALIC_SERIF_MAP[ch] || ch).join('');
}

// 🎨 ADDED (Bunty: "hamara menu bhi itna khas nahi hai, iससे acha kar sakte
// hain?" — comparing against a small-caps-styled reference menu): small-caps
// Unicode mapping used by the new "ornate" premium layout's category headers
// and section dividers, for the same polished look — built as our own font
// map rather than copying any other bot's code.
const SMALL_CAPS_MAP = {
    A:'ᴀ',B:'ʙ',C:'ᴄ',D:'ᴅ',E:'ᴇ',F:'ꜰ',G:'ɢ',H:'ʜ',I:'ɪ',J:'ᴊ',K:'ᴋ',L:'ʟ',M:'ᴍ',
    N:'ɴ',O:'ᴏ',P:'ᴘ',Q:'ǫ',R:'ʀ',S:'ꜱ',T:'ᴛ',U:'ᴜ',V:'ᴠ',W:'ᴡ',X:'x',Y:'ʏ',Z:'ᴢ',
    a:'ᴀ',b:'ʙ',c:'ᴄ',d:'ᴅ',e:'ᴇ',f:'ꜰ',g:'ɢ',h:'ʜ',i:'ɪ',j:'ᴊ',k:'ᴋ',l:'ʟ',m:'ᴍ',
    n:'ɴ',o:'ᴏ',p:'ᴘ',q:'ǫ',r:'ʀ',s:'ꜱ',t:'ᴛ',u:'ᴜ',v:'ᴠ',w:'ᴡ',x:'x',y:'ʏ',z:'ᴢ',
};
function toSmallCaps(str) {
    return String(str).split('').map(ch => SMALL_CAPS_MAP[ch] || ch).join('');
}

// 🔧 Bunty: "yeh perfect tha" (re: Sans Bold) — locked the menu font to
// Sans Bold only, no more random rotation between fonts.
function buildFontMap(upperStart, lowerStart, digitStart) {
    const map = {};
    for (let i = 0; i < 26; i++) {
        map[String.fromCharCode(65 + i)] = String.fromCodePoint(upperStart + i);
        map[String.fromCharCode(97 + i)] = String.fromCodePoint(lowerStart + i);
    }
    if (digitStart !== null) {
        for (let i = 0; i < 10; i++) map[String(i)] = String.fromCodePoint(digitStart + i);
    }
    return map;
}
const SANS_BOLD_MAP = buildFontMap(0x1D5D4, 0x1D5EE, 0x1D7EC);
// 🆕 (Bunty: "yeh wala font — 𝙎𝘼𝙍𝙒𝘼𝙍 style") — Mathematical Sans-Serif
// Bold Italic. No separate italic digit set exists in Unicode, so digits
// reuse the Sans Bold ones (same as toSansBold) — visually indistinguishable
// in practice since digits don't slant either way in most fonts.
const SANS_BOLD_ITALIC_MAP = buildFontMap(0x1D63C, 0x1D656, 0x1D7EC);

function applyFontMap(str, map) {
    return String(str).split('').map(ch => map[ch] || ch).join('');
}
function toSansBold(str) {
    return applyFontMap(str, SANS_BOLD_MAP);
}
function toSansBoldItalic(str) {
    return applyFontMap(str, SANS_BOLD_ITALIC_MAP);
}

// 🔧 Bunty: "yeh nahi ke yeh symbols, wo jaisa sarwar ka tha footer waisa hi
// hamare naam ka bold type tha koi" — dropped the ✦/™ symbols entirely,
// just the brand name itself in the same Bold Italic Sans font used
// everywhere else now (matches the reference: *𝙎𝘼𝙍𝙒𝘼𝙍 𝙓𝘿 𝙈𝙄𝙉𝙄*). Defined
// here (after the font maps above), not earlier, so toSansBoldItalic is
// actually available when this runs at module-load time.
const FOOTERS = [
    `✦﹒𝙊𝘽𝙎𝙄𝘿𝙄𝘼𝙉 𝙇𝙐𝙓𝙀 𝘼𝙃𝙈𝘼𝘿 𝙈𝙄𝙉𝙄`,
];

function randomMenuFont() {
    return { name: 'Sans Bold Italic', fn: (s) => toSansBoldItalic(s) };
}
function randomFooter() {
    return `✦﹒𝙊𝘽𝙎𝙄𝘿𝙄𝘼𝙉 𝙇𝙐𝙓𝙀 𝘼𝙃𝙈𝘼𝘿 𝙈𝙄𝙉𝙄`;
}



// Renders the full .menu body text (without image/caption wrapper).
// 🎨 REDESIGN (Bunty: "menu 3 look change but full attractive, har user apni
// choice ka lagay, poora menu he change ho, boht acha ho jaye" — the previous
// version's own comment admitted all 55 styles shared ONE fixed layout and
// only swapped border characters/bullet symbols, which is exactly why
// picking a different style barely looked different). Each of the 11
// BORDERS groups below now has its OWN genuinely distinct full layout
// (different header shape, different section/divider structure, different
// spacing/formatting) — the 5 BULLETS within each group vary the list
// marker as before. 11 layouts × 5 bullets = still all 55 STYLES, but now
// every one of them is an actually different-looking menu, not a palette
// swap of the same one.


function menuData(s, botName, ownerName, total, uptime, prefix, mode, grouped, categoryDisplay) {
    const sortedCategories = Object.keys(grouped).sort();
    return { s, botName, ownerName, total, uptime, prefix, mode, grouped, categoryDisplay, sortedCategories };
}

function catLine(disp, cat) {
    return disp.emoji ? disp.emoji : '▫️';
}

// 1. BOLD — "Classic Boxed" layout, matching Bunty's reference screenshot
// exactly: one outer info box (owner/commands/uptime/prefix/mode), then a
// separate ┏━━━ CATEGORY ━━━┓ box per category with one command per line
// next to the style's own bullet. This is style #1 (Bold border + Triangle
// bullet ▸ by default), which is already the bot's default MENU_STYLE.
function layoutBold(d) {
    const { s, botName, ownerName, total, uptime, prefix, mode, sortedCategories, grouped, categoryDisplay } = d;
    const b = s.border;
    const HLINE = b.h.repeat(24);
    let out = `┏━━━━━━━━━━━━━━━━━━━━━━━━┓\n`;
    out += `┃ ${toSansBoldItalic(botName)}\n┃\n`;
    out += `┃ 👑 ${toSansBoldItalic('Owner')}: ${toSansBoldItalic(ownerName)}\n`;
    out += `┃ ⚙️ ${toSansBoldItalic('Commands')}: ${toSansBoldItalic(String(total))}\n`;
    out += `┃ ⏳ ${toSansBoldItalic('Uptime')}: ${toSansBoldItalic(uptime)}\n`;
    out += `┃ 🔑 ${toSansBoldItalic('Prefix')}: ${prefix}  ⚡ ${toSansBoldItalic('Mode')}: ${toSansBoldItalic(mode)}\n`;
    out += `┗━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
    for (const cat of sortedCategories) {
        const disp = categoryDisplay[cat.toLowerCase()] || { name: cat.charAt(0).toUpperCase() + cat.slice(1) };
        out += `┏━━━ ${disp.emoji || '✨'} ${toSansBoldItalic(disp.name.toUpperCase())} ━━━┓\n`;
        for (const c of grouped[cat].sort()) out += `┃ ${s.bullet} .${toSansBoldItalic(c)}\n`;
        out += `┗━━━━━━━━━━━━━━━━━━━━━━━━┛\n\n`;
    }
    return out;
}

// 2. CLASSIC — rounded card, centered header banner, simple category tags
function layoutClassic(d) {
    const { s, botName, ownerName, total, uptime, prefix, mode, sortedCategories, grouped, categoryDisplay } = d;
    const b = s.border;
    let out = `${b.tl}${b.h.repeat(3)} ${toSansBold(botName)} ${b.h.repeat(3)}${b.tr}\n\n`;
    out += `${b.v} 👑 ${toSansBold(ownerName)}   ⚙️ ${toSansBold(String(total))} cmds   ⏳ ${toSansBold(uptime)}\n`;
    out += `${b.v} 🔑 Prefix "${prefix}"   ⚡ ${toSansBold(mode)}\n\n`;
    for (const cat of sortedCategories) {
        const disp = categoryDisplay[cat.toLowerCase()] || { name: cat.charAt(0).toUpperCase() + cat.slice(1) };
        out += `『 ${catLine(disp)} ${toSansBold(disp.name.toUpperCase())} 』\n`;
        const line = grouped[cat].sort().map(c => `${prefix}${c}`).join(`  ${s.bullet}  `);
        out += `${line}\n\n`;
    }
    out += `${b.bl}${b.h.repeat(20)}${b.br}\n`;
    return out;
}

// 3. DOUBLE — wide banner box, two-column-feel category list, heavier spacing
function layoutDouble(d) {
    const { s, botName, ownerName, total, uptime, prefix, mode, sortedCategories, grouped, categoryDisplay } = d;
    const b = s.border;
    let out = `${b.tl}${b.h.repeat(26)}${b.tr}\n`;
    out += `${b.v}   ${toSansBold(botName)}\n`;
    out += `${b.bl}${b.h.repeat(26)}${b.br}\n`;
    out += `  ${toSansBold('Owner')} : ${ownerName}\n  ${toSansBold('Cmds')}  : ${total}   ${toSansBold('Uptime')}: ${uptime}\n  ${toSansBold('Prefix')}: ${prefix}   ${toSansBold('Mode')}  : ${mode}\n\n`;
    for (const cat of sortedCategories) {
        const disp = categoryDisplay[cat.toLowerCase()] || { name: cat.charAt(0).toUpperCase() + cat.slice(1) };
        out += `${b.tl}${b.h.repeat(2)} ${catLine(disp)} ${toSansBold(disp.name.toUpperCase())}\n`;
        for (const c of grouped[cat].sort()) out += `   ${s.bullet} ${prefix}${c}\n`;
        out += `${b.bl}${b.h.repeat(10)}\n\n`;
    }
    return out;
}

// 4. DOTTED — no boxes at all, airy minimalist list with dotted rules
function layoutDotted(d) {
    const { s, botName, ownerName, total, uptime, prefix, mode, sortedCategories, grouped, categoryDisplay } = d;
    const rule = s.border.h.repeat(24);
    let out = `${toSansBold(botName)}\n${rule}\n`;
    out += `Owner ${s.bullet} ${ownerName}    Cmds ${s.bullet} ${total}    Uptime ${s.bullet} ${uptime}\nPrefix ${s.bullet} ${prefix}    Mode ${s.bullet} ${mode}\n${rule}\n\n`;
    for (const cat of sortedCategories) {
        const disp = categoryDisplay[cat.toLowerCase()] || { name: cat.charAt(0).toUpperCase() + cat.slice(1) };
        out += `${catLine(disp)}  ${toSansBold(disp.name.toUpperCase())}\n`;
        for (const c of grouped[cat].sort()) out += `   ${s.bullet} ${prefix}${c}\n`;
        out += `\n`;
    }
    return out;
}

// 5. STAR — starry banner top/bottom, celebratory feel
function layoutStar(d) {
    const { s, botName, ownerName, total, uptime, prefix, mode, sortedCategories, grouped, categoryDisplay } = d;
    let out = `${s.border.tl} ${s.border.tr} ${toSansBold(botName)} ${s.border.tl} ${s.border.tr}\n\n`;
    out += `${s.bullet} Owner: ${toSansBold(ownerName)}\n${s.bullet} Commands: ${toSansBold(String(total))}\n${s.bullet} Uptime: ${toSansBold(uptime)}\n${s.bullet} Prefix: ${prefix}  |  Mode: ${toSansBold(mode)}\n`;
    out += `${'─'.repeat(24)}\n\n`;
    for (const cat of sortedCategories) {
        const disp = categoryDisplay[cat.toLowerCase()] || { name: cat.charAt(0).toUpperCase() + cat.slice(1) };
        out += `${s.border.bl} ${toSansBold(disp.name.toUpperCase())} ${catLine(disp)}\n`;
        for (const c of grouped[cat].sort()) out += `   ${s.bullet} ${prefix}${c}\n`;
        out += `\n`;
    }
    out += `${s.border.tl} ${s.border.tr}${s.border.tl}${s.border.tr}${s.border.tl}${s.border.tr}\n`;
    return out;
}

// 6. DIAMOND — diamond-cornered card, tightly grouped sections
function layoutDiamond(d) {
    const { s, botName, ownerName, total, uptime, prefix, mode, sortedCategories, grouped, categoryDisplay } = d;
    const dia = s.border.tl;
    let out = `${dia}${dia}${dia} ${toSansBold(botName)} ${dia}${dia}${dia}\n`;
    out += `${dia} ${toSansBold('Owner')}: ${ownerName}   ${toSansBold('Cmds')}: ${total}   ${toSansBold('Uptime')}: ${uptime}\n`;
    out += `${dia} ${toSansBold('Prefix')}: ${prefix}   ${toSansBold('Mode')}: ${mode}\n${'-'.repeat(24)}\n\n`;
    for (const cat of sortedCategories) {
        const disp = categoryDisplay[cat.toLowerCase()] || { name: cat.charAt(0).toUpperCase() + cat.slice(1) };
        out += `${dia} ${toSansBold(disp.name.toUpperCase())}\n`;
        for (const c of grouped[cat].sort()) out += `  ${s.bullet} ${prefix}${c}\n`;
        out += `\n`;
    }
    return out;
}

// 7. FLOWER — decorative floral header/footer motif, gentle spacing
function layoutFlower(d) {
    const { s, botName, ownerName, total, uptime, prefix, mode, sortedCategories, grouped, categoryDisplay } = d;
    const fl = s.border.tl;
    let out = `${fl}${fl}${fl}  ${toSansBold(botName)}  ${fl}${fl}${fl}\n\n`;
    out += `${fl} Owner   : ${toSansBold(ownerName)}\n${fl} Commands: ${toSansBold(String(total))}\n${fl} Uptime  : ${toSansBold(uptime)}\n${fl} Prefix  : ${prefix}   Mode: ${toSansBold(mode)}\n\n`;
    for (const cat of sortedCategories) {
        const disp = categoryDisplay[cat.toLowerCase()] || { name: cat.charAt(0).toUpperCase() + cat.slice(1) };
        out += `${fl} ${toSansBold(disp.name.toUpperCase())} ${catLine(disp)}\n`;
        for (const c of grouped[cat].sort()) out += `    ${s.bullet} ${prefix}${c}\n`;
        out += `\n`;
    }
    out += `${fl}${fl}${fl}${fl}${fl}${fl}${fl}\n`;
    return out;
}

// 8. NEON — all-caps "sign" feel, angled brackets, tight glow-style rows
function layoutNeon(d) {
    const { s, botName, ownerName, total, uptime, prefix, mode, sortedCategories, grouped, categoryDisplay } = d;
    let out = `${s.border.tl}${s.border.tr} ${toSansBold(String(botName).toUpperCase())} ${s.border.bl}${s.border.br}\n`;
    out += `[${toSansBold('OWNER')}] ${ownerName}  [${toSansBold('CMDS')}] ${total}  [${toSansBold('UP')}] ${uptime}\n`;
    out += `[${toSansBold('PREFIX')}] ${prefix}  [${toSansBold('MODE')}] ${String(mode).toUpperCase()}\n${'┈'.repeat(24)}\n\n`;
    for (const cat of sortedCategories) {
        const disp = categoryDisplay[cat.toLowerCase()] || { name: cat.charAt(0).toUpperCase() + cat.slice(1) };
        out += `${s.border.tl}${s.border.tr}${toSansBold(disp.name.toUpperCase())}${s.border.bl}${s.border.br}\n`;
        for (const c of grouped[cat].sort()) out += `${s.bullet}${prefix}${c}  `;
        out += `\n\n`;
    }
    return out;
}

// 9. BRACKET — terminal/code-console look, [tags], monospace feel
function layoutBracket(d) {
    const { s, botName, ownerName, total, uptime, prefix, mode, sortedCategories, grouped, categoryDisplay } = d;
    let out = `[${toSansBold(botName)}]\n`;
    out += `[owner: ${ownerName}] [cmds: ${total}] [uptime: ${uptime}]\n[prefix: ${prefix}] [mode: ${mode}]\n${'-'.repeat(24)}\n\n`;
    for (const cat of sortedCategories) {
        const disp = categoryDisplay[cat.toLowerCase()] || { name: cat.charAt(0).toUpperCase() + cat.slice(1) };
        out += `[${toSansBold(disp.name.toUpperCase())}]\n`;
        for (const c of grouped[cat].sort()) out += `  ${s.bullet} ${prefix}${c}\n`;
        out += `\n`;
    }
    return out;
}

// 10. ARROW — flowing chevron-driven layout, forward-motion feel
function layoutArrow(d) {
    const { s, botName, ownerName, total, uptime, prefix, mode, sortedCategories, grouped, categoryDisplay } = d;
    let out = `${s.border.tl}${s.border.tl}${s.border.tl} ${toSansBold(botName)}\n\n`;
    out += `${s.border.tl} Owner ${toSansBold(ownerName)}\n${s.border.tl} Commands ${toSansBold(String(total))}\n${s.border.tl} Uptime ${toSansBold(uptime)}\n${s.border.tl} Prefix ${prefix} ${s.border.tl} Mode ${toSansBold(mode)}\n\n`;
    for (const cat of sortedCategories) {
        const disp = categoryDisplay[cat.toLowerCase()] || { name: cat.charAt(0).toUpperCase() + cat.slice(1) };
        out += `${s.border.tr}${s.border.tr} ${toSansBold(disp.name.toUpperCase())}\n`;
        for (const c of grouped[cat].sort()) out += `   ${s.bullet} ${prefix}${c}\n`;
        out += `\n`;
    }
    return out;
}

// 11. WAVE — soft flowing dividers, relaxed/casual spacing
function layoutWave(d) {
    const { s, botName, ownerName, total, uptime, prefix, mode, sortedCategories, grouped, categoryDisplay } = d;
    const wave = s.border.h.repeat(1) + s.border.tl.repeat(1);
    let out = `${toSansBold(botName)}\n${'〜'.repeat(12)}\n`;
    out += `Owner: ${toSansBold(ownerName)} ${s.bullet} Cmds: ${toSansBold(String(total))} ${s.bullet} Uptime: ${toSansBold(uptime)}\nPrefix: ${prefix} ${s.bullet} Mode: ${toSansBold(mode)}\n${'〜'.repeat(12)}\n\n`;
    for (const cat of sortedCategories) {
        const disp = categoryDisplay[cat.toLowerCase()] || { name: cat.charAt(0).toUpperCase() + cat.slice(1) };
        out += `${catLine(disp)} ${toSansBold(disp.name.toUpperCase())}\n`;
        for (const c of grouped[cat].sort()) out += `  ${s.bullet} ${prefix}${c}\n`;
        out += `\n`;
    }
    return out;
}

// 12. ORNATE — premium small-caps design: boxed header card, decorative
// "━━━┈⊷" divider bands between sections, small-caps category titles,
// italic-bold command names. Built as our own take after comparing against
// another bot's menu — same level of polish, our own font maps/markers.
function layoutOrnate(d) {
    const { botName, ownerName, total, uptime, prefix, mode, sortedCategories, grouped, categoryDisplay } = d;
    const DIVIDER = '━'.repeat(19) + '┈⊷';
    let out = `╔${'═'.repeat(20)}╗\n`;
    out += `║  ${toSansBold(botName)}\n`;
    out += `║  👑 ${toSansBold('Owner')} : ${toSansBold(ownerName)}\n`;
    out += `║  ⚙️ ${toSansBold('Commands')} : ${toSansBold(String(total))}\n`;
    out += `║  ⏳ ${toSansBold('Uptime')} : ${toSansBold(uptime)}\n`;
    out += `║  🔑 ${toSansBold('Prefix')} : ${prefix}   ⚡ ${toSansBold('Mode')} : ${toSansBold(mode)}\n`;
    out += `╚${'═'.repeat(20)}╝\n\n`;
    for (const cat of sortedCategories) {
        const disp = categoryDisplay[cat.toLowerCase()] || { name: cat.charAt(0).toUpperCase() + cat.slice(1) };
        out += `${DIVIDER}\n`;
        out += `‣ ${disp.emoji || '✧'}Ξ ⤹• ${toSmallCaps(disp.name)} 𓂃ꜛ⸙\n\n`;
        for (const c of grouped[cat].sort()) out += `  𖥸 ${toBoldItalicSerif(prefix + c)}\n`;
        out += `\n`;
    }
    out += `${DIVIDER}\n`;
    return out;
}

const LAYOUTS_BY_BORDER_KEY = {
    bold: layoutBold, classic: layoutClassic, double: layoutDouble, dotted: layoutDotted,
    star: layoutStar, diamond: layoutDiamond, flower: layoutFlower, neon: layoutNeon,
    bracket: layoutBracket, arrow: layoutArrow, wave: layoutWave, ornate: layoutOrnate,
};

function renderMenu(styleId, { botName, ownerName, total, uptime, prefix, mode, grouped, categoryDisplay }) {
    const s = getStyle(styleId);
    const d = menuData(s, botName, ownerName, total, uptime, prefix, mode, grouped, categoryDisplay);
    const layoutFn = LAYOUTS_BY_BORDER_KEY[s.border.key] || layoutBold;
    return layoutFn(d) + `\n✦ ${randomFooter()}`;
}

// 🆕 (Bunty: ".menu2 — Minimal Elegant style, graceful, emoji aesthetic")
// A second, distinct menu look — kept completely separate from the main
// .menu/renderMenu pipeline so .menu itself never changes.
function renderMenu2({ botName, ownerName, total, uptime, prefix, grouped, categoryDisplay }) {
    const B = toSansBoldItalic;
    const DIVIDER = '─'.repeat(25);
    let out = `˚₊· ͟͟͞͞➳ ${B(botName)} ➳͟͟͞͞ ·₊˚\n\n`;
    out += `  ${B('Owner')}     ›  ${ownerName}\n`;
    out += `  ${B('Commands')}  ›  ${total}\n`;
    out += `  ${B('Uptime')}    ›  ${uptime}\n`;
    out += `  ${B('Prefix')}    ›  ${prefix}\n`;
    out += `${DIVIDER}\n\n`;

    const sortedCategories = Object.keys(grouped).sort();
    for (const cat of sortedCategories) {
        const disp = categoryDisplay[cat.toLowerCase()] || { name: cat.charAt(0).toUpperCase() + cat.slice(1), emoji: '✦' };
        out += `${disp.emoji || '✦'} ${B(disp.name.toUpperCase())}\n`;
        for (const c of grouped[cat].sort()) out += `   ↳ ${prefix}${c}\n`;
        out += `${DIVIDER}\n\n`;
    }

    out += randomFooter();
    return out;
}

// Bold-serif mapping for the botName header (𝐀𝐇𝐌𝐀𝐃 𝐌𝐈𝐍𝐈 style)
function renderInfoBox(title, rows, footer) {
    const divider = '◆' + '─'.repeat(22);
    let box = `▍${toSansBold(title.toUpperCase())}\n${divider}\n`;
    for (const row of rows) {
        box += `▍ ${row.emoji || '▸'} ${toSansBold(row.label)} : ${toSansBold(row.value)}\n`;
    }
    box += `${divider}\n`;
    box += `✦ ${footer || randomFooter()}`;
    return box;
}

function renderError(msg) {
    const divider = '◆' + '─'.repeat(22);
    return `▍ ❌ ${toSansBold('ERROR')}\n${divider}\n▍ ${msg}\n${divider}\n✦ ${randomFooter()}`;
}

function renderCard(title, body, emoji = '✨') {
    const divider = '◆' + '─'.repeat(22);
    const lines = String(body).split('\n').map(l => `▍ ${l}`).join('\n');
    return `▍${emoji} ${toSansBold(title.toUpperCase())}\n${divider}\n${lines}\n${divider}\n✦ ${randomFooter()}`;
}

function renderLuxe(title, lines) {
    const divider = '◆' + '─'.repeat(22);
    const body = Array.isArray(lines) ? lines.join('\n') : String(lines);
    return `▍${toSansBold(title.toUpperCase())}\n${divider}\n${body}\n${divider}\n✦ ${randomFooter()}`;
}

// 🆕 (Bunty: "owner only change this, attitude line your daddy owner only
// 😎 etc yeh fonts mein") — replaces the same flat "OWNER-ONLY ZONE / access
// denied" wall of text used ~80 times across the bot with a random,
// fancy-font, attitude-flavored line instead, matching the personality
// already used in .owner's attitude quotes.
const OWNER_ONLY_LINES = [
    "😎 Nice try. But your daddy (the owner) only can touch this one.",
    "🚫 Not your lane. Owner-only zone — step back.",
    "👑 Big moves need big permissions. You don't have them.",
    "🔒 Locked. Owner's hands only on this button.",
    "💀 Cute attempt. This one's above your pay grade.",
    "🖤 Owner privileges required — you're not on the list.",
    "😏 Ask nicely to the owner, not the bot.",
    "⚠️ Restricted zone. Only the owner walks through this door.",
];
function ownerOnlyDenied() {
    const line = OWNER_ONLY_LINES[Math.floor(Math.random() * OWNER_ONLY_LINES.length)];
    return `👑 ${toBoldSerif('OWNER-ONLY ZONE')} 👑\n\n${toBoldItalicSerif(line)}`;
}

module.exports = { STYLES, getStyle, listStyles, renderMenu, renderMenu2, renderInfoBox, renderError, renderCard, renderLuxe, toBoldSerif, toBoldItalicSerif, toSansBold, toSansBoldItalic, toSmallCaps, randomFooter, ownerOnlyDenied };
