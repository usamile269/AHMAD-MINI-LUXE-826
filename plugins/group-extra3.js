// ============================================================================
// plugins/group-extra3.js — new group ("gc") commands (requested by Ahmad:
// "gc may more add karo"). Every command here is fully wired and working —
// no placeholder/duplicate stubs — using the same conventions (isAdmins,
// isBotAdmins, renderInfoBox, animate.js) already established across the
// rest of the plugin set.
// ============================================================================
const { cmd } = require('../ahmad-core');
const { renderInfoBox } = require('../lib/menu-styles');
const { playFrames, progressFrames } = require('../lib/animate');

// (Note: .poll already exists in plugins/more-tools.js — not duplicated here.)

// ============================================================
// 1. VOTEKICK — starts a poll so the group can weigh in before an admin
// actually removes someone. Doesn't auto-kick (reading poll results back
// reliably needs a persisted message store); this keeps it simple and
// honest about what it does.
// ============================================================
cmd({
    pattern: "votekick",
    alias: ["kickpoll"],
    desc: "Start a group poll asking whether to kick a member",
    category: "group",
    react: "🗳️",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isAdmins, mentionedJid, quoted, reply }) => {
    try {
        if (!isGroup) return reply("❌ This command only works in groups.");
        if (!isAdmins) return reply("❌ Only group admins can start a votekick.");
        const target = mentionedJid?.[0] || quoted?.sender;
        if (!target) return reply("❌ Mention or reply to the member you want to poll about.");

        await conn.sendMessage(from, {
            poll: {
                name: `Kick @${target.split('@')[0]}?`,
                values: ["✅ Yes, kick them", "❌ No, keep them"],
                selectableCount: 1
            },
            mentions: [target]
        }, { quoted: mek });

        reply("📊 Votekick poll posted — once you've seen enough votes, an admin can run *.kick* to remove them.");
    } catch (e) {
        console.error("Votekick error:", e);
        reply("❌ Failed to start votekick.");
    }
});

// ============================================================
// 2. PIN / UNPIN CHAT — pins this group to the top of the bot's chat list
// ============================================================
cmd({
    pattern: "pinchat",
    desc: "Pin this group chat (for the bot's own chat list)",
    category: "group",
    react: "📌",
    filename: __filename
}, async (conn, mek, m, { from, isAdmins, reply }) => {
    try {
        if (!isAdmins) return reply("❌ Only group admins can use this command.");
        await conn.chatModify({ pin: true }, from);
        reply("📌 Chat pinned.");
    } catch (e) {
        console.error("Pinchat error:", e);
        reply("❌ Failed to pin chat.");
    }
});

cmd({
    pattern: "unpinchat",
    desc: "Unpin this group chat",
    category: "group",
    react: "📌",
    filename: __filename
}, async (conn, mek, m, { from, isAdmins, reply }) => {
    try {
        if (!isAdmins) return reply("❌ Only group admins can use this command.");
        await conn.chatModify({ pin: false }, from);
        reply("✅ Chat unpinned.");
    } catch (e) {
        console.error("Unpinchat error:", e);
        reply("❌ Failed to unpin chat.");
    }
});

// ============================================================
// 3. GCOUNTDOWN — animated countdown for group events/drops (uses the
// existing lib/animate.js frame-editing animation, just like .hack)
// ============================================================
cmd({
    pattern: "gcountdown",
    alias: ["gctimer"],
    desc: "Animated countdown for a group event — .gcountdown 10 Giveaway starting!",
    category: "group",
    react: "⏳",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isAdmins, args, reply }) => {
    try {
        if (!isGroup) return reply("❌ This command only works in groups.");
        if (!isAdmins) return reply("❌ Only group admins can start a countdown.");
        const seconds = Math.min(parseInt(args[0], 10) || 10, 30);
        const title = args.slice(1).join(" ") || "Get ready!";

        const steps = [];
        for (let s = seconds; s > 0; s--) {
            steps.push({ percent: Math.round(((seconds - s) / seconds) * 100), label: `${title} — ⏳ ${s}s` });
        }
        const frames = progressFrames('⏳ COUNTDOWN', steps, `🚀 ${title} — GO!`);
        await playFrames(conn, from, mek, frames, 1000);
    } catch (e) {
        console.error("Gcountdown error:", e);
        reply("❌ Failed to run countdown.");
    }
});

// ============================================================
// 4. SCHEDULEMSG — schedule an announcement in this chat. In-memory only
// (resets if the process restarts) — clearly noted so it's never a
// silent surprise on free-tier hosts that respawn periodically.
// ============================================================
cmd({
    pattern: "schedulemsg",
    alias: ["schedule"],
    desc: "Schedule a message in this chat — .schedulemsg 15 Meeting starts now!",
    category: "group",
    react: "🕒",
    filename: __filename
}, async (conn, mek, m, { from, isAdmins, args, reply }) => {
    try {
        if (!isAdmins) return reply("❌ Only group admins can schedule messages.");
        const minutes = parseFloat(args[0]);
        const text = args.slice(1).join(" ");
        if (!minutes || minutes <= 0 || !text) {
            return reply(renderInfoBox('Schedule Message', [
                { emoji: '💡', label: 'Use', value: '.schedulemsg 15 Meeting starts now!' },
                { emoji: '⚠️', label: 'Note', value: 'In-memory — lost on restart' }
            ]));
        }
        if (minutes > 1440) return reply("❌ Max 24 hours (1440 minutes) ahead.");

        reply(`🕒 Scheduled for ${minutes} minute(s) from now.`);
        setTimeout(async () => {
            try {
                await conn.sendMessage(from, { text: `🔔 *Scheduled Reminder*\n\n${text}` });
            } catch (e) {
                console.error("Scheduled send failed:", e.message);
            }
        }, minutes * 60 * 1000);
    } catch (e) {
        console.error("Schedulemsg error:", e);
        reply("❌ Failed to schedule message.");
    }
});
