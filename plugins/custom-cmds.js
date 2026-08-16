// ============================================================================
// lib/custom-cmds.js — lets the owner add brand-new commands from inside
// WhatsApp itself (.addcmd), eval-style. Code is stored to disk so custom
// commands survive restarts/redeploys, and get re-registered on boot.
//
// ⚠️ This runs owner-supplied JS with full bot access, same trust level as
// the existing .eval/.exec commands — it's gated behind isOwner the same
// way. Only the account owner (923044975027) can add/remove these.
// ============================================================================

const fs = require('fs');
const path = require('path');
const { cmd, commands } = require('../ahmad-core');

const STORE_PATH = path.join(__dirname, '..', 'data', 'custom-commands.json');

function readStore() {
    try {
        if (!fs.existsSync(STORE_PATH)) return {};
        return JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) || {};
    } catch {
        return {};
    }
}

function writeStore(store) {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
}

// Builds the actual command handler out of owner-supplied code. `ctx` is the
// same options object every normal plugin command receives (reply, args,
// text, isOwner, from, etc.) — so custom commands can use ctx.reply(...),
// ctx.args, ctx.text just like any built-in command.
function buildHandler(code) {
    const fn = new Function(
        'conn', 'mek', 'm', 'ctx',
        `return (async () => {\n${code}\n})();`
    );
    return async (conn, mek, m, ctx) => {
        try {
            await fn(conn, mek, m, ctx);
        } catch (e) {
            if (ctx && typeof ctx.reply === 'function') {
                ctx.reply(`❌ Custom command error:\n${e.message}`);
            }
        }
    };
}

function removeFromCommandsArray(pattern) {
    const idx = commands.findIndex(c => c.pattern === pattern);
    if (idx !== -1) commands.splice(idx, 1);
}

// Checks if `pattern` collides with an existing BUILT-IN command (or one of
// its aliases) — i.e. anything not already a custom command we registered
// ourselves. Used to stop .addcmd from silently shadowing real commands
// that regular users rely on (e.g. someone naming a custom command "menu").
function collidesWithBuiltIn(pattern) {
    return commands.find(c =>
        c.category !== 'custom' &&
        (c.pattern === pattern || (Array.isArray(c.alias) && c.alias.includes(pattern)))
    );
}

function registerCustomCommand(pattern, code) {
    const clash = collidesWithBuiltIn(pattern);
    if (clash) {
        const err = new Error(`".${pattern}" is already used by a built-in command ("${clash.pattern}"). Pick a different name — overwriting it would break that command for everyone.`);
        err.isCollision = true;
        throw err;
    }
    removeFromCommandsArray(pattern); // replace if it already exists as a custom cmd
    cmd({
        pattern,
        desc: 'Custom command (owner-added via .addcmd)',
        category: 'custom',
        react: '🧩'
    }, buildHandler(code));
    const store = readStore();
    store[pattern] = code;
    writeStore(store);
}

function removeCustomCommand(pattern) {
    const store = readStore();
    if (!store[pattern]) return false;
    delete store[pattern];
    writeStore(store);
    removeFromCommandsArray(pattern);
    return true;
}

function listCustomCommands() {
    return Object.keys(readStore());
}

// Called once at startup (main.js) — re-registers everything saved so far.
// 🚨 BUG FIX (Bunty: "old .drama wapis aa raha hai, DB mein kuch hai" —
// root cause found): this used to blindly re-register EVERY saved custom
// command on every boot/hot-reload with no collision check — but plugins
// finish loading right before this runs (see main.js), so if a custom
// command was ever saved under the SAME name as a real built-in plugin
// command (e.g. someone ran ".addcmd drama ..." at some point, testing or
// otherwise), it would silently overwrite that built-in in commandMap on
// EVERY single boot from then on — no error, no log, the real plugin code
// just never ran again even after being fixed/redeployed, because this
// stale saved copy always loaded last and won. registerCustomCommand()
// (used by .addcmd itself) already guarded against this via
// collidesWithBuiltIn() — this boot-time loader just never used the same
// check. Now it skips (and logs) any stored custom command that collides
// with a real plugin command instead of silently shadowing it.
function loadCustomCommands() {
    const store = readStore();
    let loaded = 0;
    for (const [pattern, code] of Object.entries(store)) {
        const clash = collidesWithBuiltIn(pattern);
        if (clash) {
            console.log(`⚠️ Skipped stale custom command ".${pattern}" — collides with built-in ".${clash.pattern}". Remove it with .delcmd ${pattern} if it's no longer needed.`);
            continue;
        }
        cmd({
            pattern,
            desc: 'Custom command (owner-added via .addcmd)',
            category: 'custom',
            react: '🧩'
        }, buildHandler(code));
        loaded++;
    }
    return loaded;
}

module.exports = {
    registerCustomCommand,
    removeCustomCommand,
    listCustomCommands,
    loadCustomCommands
};
