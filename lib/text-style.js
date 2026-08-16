// ============================================================================
// lib/text-style.js — simple, big/bold reply text for every command
// ----------------------------------------------------------------------------
// 🚨 CHANGE (Ahmad requested "simple fonts, results big"): the old version
// replaced every letter with a Mathematical Bold Unicode character. That
// font is inconsistent across phones/fonts, breaks copy-paste and search,
// and stacked badly with the small-caps font already used in menu/settings
// text. Switched to WhatsApp's own bold markdown (*text*) instead — it's
// plain, normal text underneath (simple), but WhatsApp renders it bold/
// heavier so results still stand out and look "big".
//
// Rather than editing 40+ plugin files individually, this still hooks into
// the ONE shared `reply()` function in main.js that virtually every command
// already calls, so it's applied bot-wide from a single place.
//
// Lines that are already formatted (start with *, >, ```, or box-drawing
// characters like │╭╰┃) are left untouched so nothing gets double-wrapped
// or broken.
// ============================================================================

const boldMap = {
    a:'𝐚', b:'𝐛', c:'𝐜', d:'𝐝', e:'𝐞', f:'𝐟', g:'𝐠', h:'𝐡', i:'𝐢', j:'𝐣',
    k:'𝐤', l:'𝐥', m:'𝐦', n:'𝐧', o:'𝐨', p:'𝐩', q:'𝐪', r:'𝐫', s:'𝐬', t:'𝐭',
    u:'𝐮', v:'𝐯', w:'𝐰', x:'𝐱', y:'𝐲', z:'𝐳',
    A:'𝐀', B:'𝐁', C:'𝐂', D:'𝐃', E:'𝐄', F:'𝐅', G:'𝐆', H:'𝐇', I:'𝐈', J:'𝐉',
    K:'𝐊', L:'𝐋', M:'𝐌', N:'𝐍', O:'𝐎', P:'𝐏', Q:'𝐐', R:'𝐑', S:'𝐒', T:'𝐓',
    U:'𝐔', V:'𝐕', W:'𝐖', X:'𝐗', Y:'𝐘', Z:'𝐙'
};

// Kept for backwards compatibility with any code that still wants the old
// unicode-bold behaviour for a single word/string.
function boldWord(word) {
    return word.split('').map(ch => boldMap[ch] || ch).join('');
}

const ALREADY_FORMATTED = /^[*>`│┃║┆┇╎╏╭╮╰╯┏┓┗┛╔╗╚╝\-─━═]/;

// 🚨 CHANGE (Bunty: "bot may ** yeh fazool hai / SAB perfect ho ab" —
// wrapping every single reply line in *asterisks* bot-wide was exactly
// the clutter being complained about, on top of plugins that already
// wrap dynamic bold spans themselves). No longer auto-wraps anything —
// text is sent through untouched, so only intentional formatting
// (unicode-bold via toSansBold/toFancy, or explicit *text* a plugin
// still wants) shows up, nothing extra.
function toFancyBold(text) {
    return text;
}

module.exports = { toFancyBold, boldWord, boldMap };
