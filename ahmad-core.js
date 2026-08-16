var commands = [];
var commandMap = new Map();

// 🚨 BUG FIX (Bunty: "khaasa commands mein koi emoji/reaction nahi aata,
// jaise .url quietly link bhej deta hai") — the auto-reaction on a command
// only ever fires if that command explicitly sets a `react` emoji in its
// definition (see main.js dispatch). Turns out 164 out of 529 commands
// across the whole bot never set one — not a typo in one file, just never
// added when those commands were written. Instead of hand-editing 164
// command blocks across a dozen+ plugin files, every command that doesn't
// set its own `react` now gets a sensible default based on its category, so
// this is fixed everywhere at once and stays fixed for new commands too.
//
// 🚨 UPGRADE (Ahmad: "har command ka apna unique reaction ho, category wala
// repeat na ho"): a single static emoji per category meant every command in,
// say, "fun" showed the exact same 🎉 — technically not silent anymore, but
// repetitive/samey. Each category is now a POOL of emojis instead of one,
// and the specific emoji for a command is picked deterministically from a
// hash of its own pattern name — same command always gets the same emoji
// every time it runs (consistent, not random-per-run), but different
// commands within the same category land on different emojis from the pool.
// This covers commands defined via a shared loop too (e.g. reactions.js,
// where dozens of commands are registered from one cmd({...}) call site with
// a variable pattern) since the hash is computed per actual pattern string,
// not per call site.
const CATEGORY_REACT_POOL = {
    tools: ['🛠️', '🔧', '⚙️', '🧰', '🪛', '🔩'],
    fun: ['🎉', '🎊', '🥳', '🎈', '🎭', '🎪', '🃏', '🎲', '🎯', '🎨'],
    owner: ['👑', '🔱', '💎', '🏆', '🗝️'],
    group: ['👥', '🫂', '🧑‍🤝‍🧑', '📢', '🔔'],
    settings: ['⚙️', '🎛️', '🔧', '🧩'],
    osint: ['🕵️', '🔎', '🛰️', '📡', '🧭'],
    download: ['⬇️', '📥', '💾', '📦', '🗂️'],
    general: ['ℹ️', '📋', '📝', '🔖'],
    recovery: ['♻️', '🔄', '🩹', '🧯'],
    cybersec: ['🔐', '🛡️', '🔒', '🗝️', '🚨'],
    ai: ['🤖', '🧠', '✨', '🔮'],
    main: ['📋', '📌', '📎'],
    search: ['🔍', '🔦', '🧐', '🗺️'],
    system: ['🖥️', '💻', '🧮', '📊'],
    sticker: ['🎴', '🖼️', '🏷️'],
    info: ['ℹ️', '💡', '📖'],
    hack: ['💻', '👨‍💻', '🕶️', '⚡'],
    misc: ['⚡', '✨', '🌀', '🔸']
};
function hashPickEmoji(pattern, category) {
    const pool = CATEGORY_REACT_POOL[category] || CATEGORY_REACT_POOL.misc;
    let h = 0;
    const s = String(pattern || '');
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return pool[h % pool.length];
}
const CATEGORY_REACT = CATEGORY_REACT_POOL; // kept for any external reference

function cmd(info, func) {
    var data = info;
    data.function = func;
    
    // Si pas de pattern, on utilise cmdname
    if (!data.pattern && data.cmdname) data.pattern = data.cmdname;
    
    if (!data.alias) data.alias = [];
    if (!data.dontAddCommandList) data.dontAddCommandList = false;
    if (!data.desc) data.desc = '';
    if (!data.fromMe) data.fromMe = false;
    if (!data.category) data.category = 'misc';
    if (!data.react) data.react = hashPickEmoji(data.pattern, data.category);
    
    commands.push(data);
    if (data.pattern) commandMap.set(data.pattern, data);
    for (const a of data.alias) commandMap.set(a, data);
    return data;
}

module.exports = {
    cmd,
    AddCommand: cmd,
    Function: cmd,
    commands,
    commandMap,
};

