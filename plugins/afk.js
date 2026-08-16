// ============================================================================
// plugins/afk.js — AFK (away) status
// ----------------------------------------------------------------------------
// .afk [reason]  -> marks the sender AFK (across any chat).
// If someone @mentions or replies to an AFK user, the bot lets them know
// (with reason + how long they've been away). The AFK user's own next
// message automatically clears their AFK and posts a short "welcome back".
//
// In-memory only (Map, not DB) — AFK is inherently short-lived/session-y,
// so it resets on a bot restart like most bots' AFK features do; no schema
// changes needed anywhere else.
// ============================================================================

const { cmd } = require('../ahmad-core');
const { renderLuxe } = require('../lib/menu-styles');

const afkUsers = new Map(); // jid -> { reason, since }

function formatDuration(ms) {
    const sec = Math.floor(ms / 1000);
    if (sec < 60) return `${sec}s`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ${min % 60}m`;
    const days = Math.floor(hr / 24);
    return `${days}d ${hr % 24}h`;
}

cmd({
    pattern: "afk",
    desc: "Mark yourself away — bot notifies anyone who mentions/replies to you",
    category: "main",
    react: "💤",
    use: ".afk studying for exams",
    filename: __filename
}, async (conn, mek, m, { sender, text, args, reply }) => {
    const reason = text || args.join(' ') || 'Away';
    afkUsers.set(sender, { reason, since: Date.now() });
    reply(renderLuxe('AFK', [`You're now marked AFK: ${reason}`, `Anyone who mentions/replies to you will be told.`]));
});

// Universal listener — runs on every text message to auto-clear AFK on
// return and to warn anyone mentioning/replying to a currently-AFK user.
cmd({
    on: "body",
    filename: __filename
}, async (conn, mek, m, { from, sender, mentionedJid, quoted, isCmd, command, reply }) => {
    try {
        // 1) Sender was AFK and just sent a message (not the .afk command itself) — clear it.
        if (afkUsers.has(sender) && !(isCmd && command === 'afk')) {
            const info = afkUsers.get(sender);
            afkUsers.delete(sender);
            await reply(`👋 Welcome back — you were AFK for ${formatDuration(Date.now() - info.since)}.`);
        }

        // 2) Someone mentioned or replied to a currently-AFK user — let them know.
        const targets = new Set([...(mentionedJid || [])]);
        if (quoted && quoted.sender) targets.add(quoted.sender);
        for (const jid of targets) {
            if (jid === sender) continue; // don't notify about yourself
            if (afkUsers.has(jid)) {
                const info = afkUsers.get(jid);
                await conn.sendMessage(from, {
                    text: `💤 @${jid.split('@')[0]} is AFK: ${info.reason} (${formatDuration(Date.now() - info.since)} ago)`,
                    mentions: [jid]
                }).catch(() => {});
            }
        }
    } catch (e) {
        console.log('[AFK] error:', e.message);
    }
});
