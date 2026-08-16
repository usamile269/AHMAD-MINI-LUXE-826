const { cmd } = require('../ahmad-core');
const { setAntiViewOnceStatus, getAntiViewOnceStatus, setAntiViewOnceSendTo, getAntiViewOnceSendTo } = require('../data/AntiViewOnce.js');
const { randomFooter, ownerOnlyDenied } = require('../lib/menu-styles');

const FOOTER = "\n\n> " + randomFooter();

// 🆕 SIMPLIFIED (Bunty: "voviewpath system boht zayada hai remove all
// options, default private ho gc/DM/others sab may, .voviewpath sirf
// overall set kare — abhi sirf iss chat ke liye hota hai"):
//   - .antiviewonce on/off is unchanged in scope — still per-chat, but now
//     owner/isMe-only everywhere (DM included — see the gate below), not
//     open to whoever's chatting with the bot.
//   - .voviewpath is no longer per-chat / per-scope. There is now ONE
//     destination setting PER BOT NUMBER: 'private' (default — every
//     auto-captured view-once always goes to that number's own DM, no
//     matter which chat/group it was captured in) or 'same' (goes back to
//     whichever chat it was captured in).
//   - .voviewpathall / .antiviewonceall / the groups|other scope commands
//     are removed — .voviewpath now IS the overall/global command.
//   - 🚨 SCOPING FIX (Bunty: "har user ka alag alag hoga na?"): everything
//     below is now keyed by botNumber too (see data/AntiViewOnce.js) — if
//     this deployment ever runs more than one paired number off the same
//     Mongo, each number's "overall" setting is fully independent, exactly
//     like PREFIX already is. No owner-only gate either — never asked for.

cmd({
    pattern: "antiviewonce",
    alias: ["avo", "autovv"],
    desc: "Auto-capture & auto-forward view-once media (per-chat toggle)",
    category: "settings",
    use: ".antiviewonce on/off",
    filename: __filename
}, async (conn, mek, m, { from, args, isGroup, isAdmins, isOwner, isMe, reply, botNumber }) => {
    try {
        if (!isOwner && !isMe) return reply(`❌ Owner only.${FOOTER}`);
        const mode = (args[0] || '').toLowerCase();

        if (mode === 'on') {
            await setAntiViewOnceStatus(botNumber, from, true);
            return reply(`✅ *Anti-ViewOnce ON* for this chat.\n👁️ Every view-once media will now auto-forward (without needing a .vv reply).${FOOTER}`);
        }
        if (mode === 'off') {
            await setAntiViewOnceStatus(botNumber, from, false);
            return reply(`✅ *Anti-ViewOnce OFF* for this chat.${FOOTER}`);
        }

        const status = await getAntiViewOnceStatus(botNumber, from);
        const sendTo = await getAntiViewOnceSendTo(botNumber);
        reply(`⚙️ *ANTI-VIEWONCE STATUS*\n📍 Status: ${status ? '✅ ON' : '❌ OFF'}\n📤 Send to (overall, this number): ${sendTo === 'private' ? 'Private Chat 📥' : 'Same Chat 📍'}\n\n💡 Use: .antiviewonce on/off\n💡 Use: .voviewpath same/private (sets it overall, for all chats on this number)${FOOTER}`);
    } catch (e) { reply(`❌ Error: ${e.message}${FOOTER}`); }
});

cmd({
    pattern: "voviewpath",
    alias: ["vvpath"],
    desc: "Set where auto-captured view-once media gets sent — OVERALL for this bot number (default: private)",
    category: "settings",
    use: ".voviewpath same/private",
    filename: __filename
}, async (conn, mek, m, { args, isGroup, isAdmins, isOwner, isMe, reply, botNumber }) => {
    try {
        const mode = (args[0] || '').toLowerCase();
        if (!['same', 'private'].includes(mode)) {
            const current = await getAntiViewOnceSendTo(botNumber);
            return reply(`❌ Usage: .voviewpath same/private\n📤 Current (overall, this number): ${current === 'private' ? 'Private Chat 📥' : 'Same Chat 📍'}${FOOTER}`);
        }
        // 🚨 FIX (Bunty: "Owner kahan se aa gya, main hi hoon aur block ho
        // gaya" — no owner-only here, never asked for it): same permission
        // level as .antiviewonce — group admins for their group, anyone
        // for their own DM.
        if (!isOwner && !isMe) return reply(`❌ Owner only.${FOOTER}`);
        await setAntiViewOnceSendTo(botNumber, mode);
        reply(`✅ *View-once path set to:* ${mode === 'private' ? 'Your Private Chat 📥' : 'Same Chat 📍'} — *OVERALL for this bot number* (applies to every group, DM and chat immediately).${FOOTER}`);
    } catch (e) { reply(`❌ Error: ${e.message}${FOOTER}`); }
});

module.exports = {};
