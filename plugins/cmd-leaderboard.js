// ============================================================================
// plugins/cmd-leaderboard.js — command usage leaderboard
// ----------------------------------------------------------------------------
// main.js already calls incrementStats(botNumber, `cmd_${command}`) on every
// single command execution (used for the existing per-day stats). This just
// adds a command to read that same data back out, aggregated across all
// stored days, sorted by usage — no new tracking logic needed.
// ============================================================================

const { cmd } = require('../ahmad-core');
const { getCommandLeaderboard } = require('../lib/database');
const { randomFooter, renderError, toSansBold } = require('../lib/menu-styles');

const FOOTER = "\n\n> " + randomFooter();
const fail = (reply, msg) => reply(renderError(msg));

// 🚨 BUG FIX (name collision — this command was 100% unreachable): both
// this file AND plugins/fun-games.js's .topcmds registered "cmdstats" —
// fun-games.js loads later alphabetically so it silently won every time,
// meaning .cmdstats never once reached this file's handler. Renamed to
// .cmdlb (kept "leaderboard"/"topcommands" aliases, which didn't collide)
// so this — genuinely different, Mongo-aggregated — leaderboard is
// actually reachable instead of being dead code.
cmd({
    pattern: "cmdlb",
    alias: ["leaderboard", "topcommands"],
    desc: "📊 Show the most-used commands on this bot",
    category: "main",
    react: "📊",
    use: ".cmdlb",
    filename: __filename
}, async (conn, mek, m, { botNumber, reply }) => {
    try {
        const top = await getCommandLeaderboard(botNumber, 10);
        if (!top.length) return fail(reply, "No command usage recorded yet.");

        const lines = top.map((c, i) => `${i + 1}. ${toSansBold('.' + c.name)} — ${c.count} use${c.count === 1 ? '' : 's'}`);
        reply(`╭═══ 📊 ${toSansBold('COMMAND LEADERBOARD')} ═══⊷\n${lines.map(l => `┃❃│ ${l}`).join('\n')}\n╰═════════════════⊷${FOOTER}`);
    } catch (e) {
        fail(reply, "Couldn't load command stats: " + e.message);
    }
});
