const { cmd, commands } = require('../ahmad-core');
const os = require("os");
const config = require('../config');
const { randomFooter, toSansBoldItalic } = require('../lib/menu-styles');

// 🎨 REDESIGN (Bunty: final .alive layout — locked-in exact template):
// ✦ AHMAD MINI 👻 is alive and watching 👀
// 💚 41ms · ⏱️ 3h 5m
// <random helpful quote>
// ✦﹒footer
// + bot's own real WhatsApp DP as the image.
//
// Dropped the old catbox video-note system entirely (fragile, unrelated
// clips, needed a whole retry/mp4-sniffing rig just to work). Quote pool
// swapped from funny/romantic/flirty one-liners to short helpful/motivational
// lines per Bunty's latest call. 👻 and 💚 are fixed accents matching the
// exact template — the WhatsApp reaction emoji still varies (random heart)
// so every alive still feels a little different.
const HEART_REACTS = ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💗', '💖', '💘', '💞', '💕', '✨'];

const HELPFUL_QUOTES = [
    "💡 Every big goal starts with one small step — today's step is enough.",
    "⏳ Don't waste time overthinking, just start — clarity comes with motion.",
    "🌱 Consistency beats talent — show up daily, don't stop.",
    "🎯 Focus on one thing — chasing two rabbits catches neither.",
    "🧠 Nothing you learn is ever wasted, even if you don't use it yet.",
    "💪 Hard roads build strong people.",
    "📈 Progress isn't visible daily, but it never really stops.",
    "🕊️ Rest matters too — a tired mind rarely makes good decisions.",
    "🔑 Discipline is doing it even when motivation doesn't show up.",
    "🌤️ Every hard day is followed by a better one.",
    "🚪 Knock on doors that won't open themselves — opportunities are asked for.",
    "📚 One good habit outweighs one bad one.",
    "🤝 Ask for help without hesitation — you don't always have to go it alone.",
    "🧭 Start even without a plan — direction reveals itself as you move.",
    "☕ Take breaks without guilt — recharging is part of the work.",
];

function uptimeShort() {
    let sec = process.uptime();
    let h = Math.floor(sec / 3600);
    let m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

cmd({
    pattern: "alive",
    alias: ["status", "live"],
    desc: "Check uptime and system status",
    category: "main",
    filename: __filename
}, async (conn, mek, m, { from, sender, botNumber2, reply }) => {
    const reactHeart = HEART_REACTS[Math.floor(Math.random() * HEART_REACTS.length)];
    try {
        await conn.sendMessage(from, { react: { text: reactHeart, key: m.key } });

        const start = Date.now();
        await conn.sendPresenceUpdate('available', from).catch(() => {});
        const speedMs = Math.max(1, Date.now() - start);

        const quote = HELPFUL_QUOTES[Math.floor(Math.random() * HELPFUL_QUOTES.length)];
        const B = toSansBoldItalic;

        const caption = `✦ ${B('AHMAD MINI')} 👻 ${B('is alive and watching')} 👀\n` +
            `💚 ${B(String(speedMs))}${B('ms')} · ⏱️ ${B(uptimeShort())}\n\n` +
            `${B(quote)}\n\n` +
            `✦﹒${randomFooter()}`;

        // Bot's own WhatsApp profile picture — real fetch via Baileys, same
        // call used elsewhere in the bot (admin-plus.js, downloaders.js,
        // profilecard.js). Falls back to the configured menu image only if
        // the bot has no DP set / the fetch fails, so .alive never comes
        // back empty.
        let ppUrl = config.MENU_IMAGE;
        try {
            ppUrl = await conn.profilePictureUrl(botNumber2, 'image');
        } catch (e) {
            console.log('[ALIVE] could not fetch bot profile pic, using fallback image:', e.message);
        }

        await conn.sendMessage(from, {
            image: { url: ppUrl },
            caption,
            contextInfo: {
                mentionedJid: [sender],
                forwardingScore: 999,
                isForwarded: true
            }
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

    } catch (e) {
        console.error("Error in alive command:", e);
        await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
        reply(`❌ Error: ${e.message}`);
    }
});
