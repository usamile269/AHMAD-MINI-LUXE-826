const { cmd } = require('../ahmad-core');
const { sleep } = require('../lib/functions');
const axios = require('axios');
const { randomFooter } = require('../lib/menu-styles');

// 🚨 BUG FIX: these commands used to call `conn.requestPairingCode()` on the
// bot's OWN already-connected/authenticated socket. Requesting a new pairing
// code on a live session confuses WhatsApp (it looks like a duplicate link
// attempt) and gets the CURRENT session logged out after a while — matching
// the "bot works for ~1hr, then .pair kills it and it goes offline" bug.
// Fix: hit the app's own internal /code HTTP route instead, which spins up
// a brand-new, separate socket for the target number (exactly like main.js
// already does for the pairing web page) without touching the live session.
const PORT = process.env.PORT || process.env.SERVER_PORT || process.env.APP_PORT || 8000;
async function getPairingCodeSafely(phoneNumber) {
    const { data } = await axios.get(`http://localhost:${PORT}/code`, {
        params: { number: phoneNumber },
        timeout: 30000
    });
    if (data && data.code) return data.code;
    if (data && data.status === 'already_connected') throw new Error('This number is already connected.');
    if (data && data.status === 'reconnecting') throw new Error('Session exists, reconnecting instead of issuing a new code.');
    throw new Error((data && (data.error || data.message)) || 'No code returned.');
}

// ==================== PAIR COMMAND ====================
cmd({
    pattern: "pair",
    alias: ["getpair", "pairing", "clonebot"],
    react: "✅",
    desc: "Get pairing code for bot",
    category: "download",
    use: ".pair 92304***",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, senderNumber }) => {
    try {
        await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

        const phoneNumber = q ? q.trim().replace(/[^0-9]/g, '') : senderNumber.replace(/[^0-9]/g, '');

        if (!phoneNumber || phoneNumber.length < 10 || phoneNumber.length > 15) {
            await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
            return reply(`╭═══ ❌ PAIR ═══⊷
┃❃╭──────────────
┃❃│ ❌ Invalid number!
┃❃│ 💡 Use: .pair 92304*******
┃❃╰───────────────
╰═════════════════⊷

> ${randomFooter()}`);
        }

        // Uses the app's own /code route to spin up a separate socket for
        // this number, instead of calling requestPairingCode() on THIS bot's
        // own live session (which was killing the current connection).
        const pairingCode = await getPairingCodeSafely(phoneNumber);

        if (!pairingCode) {
            await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
            return reply("❌ Failed to get pairing code. Try again.");
        }

        await reply(pairingCode);
        await conn.sendMessage(from, { react: { text: "✅", key: m.key } });
    } catch (error) {
        console.error("Pair error:", error);
        await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
        reply("❌ Error occurred: " + error.message);
    }
});

// ==================== PAIR2 COMMAND (Private Chat Only) ====================
cmd({
    pattern: "pair2",
    alias: ["getpair2", "reqpair", "clonebot2"],
    react: "📉",
    desc: "Get pairing code (private chat only)",
    category: "download",
    use: ".pair2 92304XXX",
    filename: __filename
}, async (conn, mek, m, { from, q, reply, isGroup, senderNumber }) => {
    try {
        await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

        if (isGroup) {
            await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
            return reply("❌ This command only works in private chat.");
        }

        const phoneNumber = q ? q.trim().replace(/[^0-9]/g, '') : senderNumber.replace(/[^0-9]/g, '');

        if (!phoneNumber || phoneNumber.length < 10 || phoneNumber.length > 15) {
            await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
            return reply(`╭═══ ❌ PAIR2 ═══⊷
┃❃╭──────────────
┃❃│ ❌ Invalid number!
┃❃│ 💡 Use: .pair2 92304*******
┃❃╰───────────────
╰═════════════════⊷

> ${randomFooter()}`);
        }

        const pairingCode = await getPairingCodeSafely(phoneNumber);

        if (!pairingCode) {
            await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
            return reply("❌ Failed to get pairing code. Try again.");
        }

        await reply(pairingCode);
        await conn.sendMessage(from, { react: { text: "✅", key: m.key } });
    } catch (error) {
        console.error("Pair2 error:", error);
        await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
        reply("❌ Error occurred: " + error.message);
    }
});
