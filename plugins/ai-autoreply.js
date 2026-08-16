// ============================================================================
// plugins/ai-autoreply.js — ".aibyahmad" — simplified to ONE thing (Bunty:
// "storage boht ho raha, aiby ahmad se saara heavy settings hata do, sirf
// DM auto-reply on/off wala rahay").
//
// Everything else that used to live here (group mode, persona, custom
// footer, ignore list, known-contacts-only, active hours, voice replies,
// daily summary, live test) has been removed on purpose — every one of
// those was its own field saved to MongoDB per botNumber, its own
// in-memory cache/Map in main.js, and its own code path. Cutting them
// down to just enabled/disabled means far less written to the DB and far
// less kept in memory, which is exactly the "storage boht" complaint.
//
// Toggle lives per botNumber (each paired WhatsApp number is its own
// instance). The actual auto-reply SENDING happens in main.js (needs to
// see every incoming message, not just command messages) — this file is
// just the on/off switch.
// ============================================================================
const { cmd } = require('../ahmad-core');
const { getAIAutoReplySettings, setAIAutoReplySettings } = require('../data/AIAutoReply');
const { randomFooter, toSansBoldItalic } = require('../lib/menu-styles');

function box(title, lines) {
    return `╭◆──「 ✦ ${toSansBoldItalic(title)} ✦ 」──◆╮\n` +
        lines.map(l => `┃  ${l}`).join('\n') + '\n' +
        `╰──────────────────────╯\n\n` +
        `> ${randomFooter()}`;
}

cmd({
    pattern: "aibyahmad",
    alias: ["aiby", "aiauto", "autoai"],
    desc: "🤖 AI auto-reply for your DMs — on/off",
    category: "settings",
    react: "🤖",
    use: ".aibyahmad on/off",
    filename: __filename
}, async (conn, mek, m, { isOwner, isMe, botNumber, args, reply }) => {
    // 🚨 RESTRICTION (Bunty: "sirf owner control kar sakay"): only the
    // actual bot owner can toggle this.
    if (!isOwner) {
        // Notify owner about the attempt
        await conn.sendMessage(config.OWNER_NUMBER + '@s.whatsapp.net', { 
            text: `⚠️ *Security Alert:* User @${sender.split('@')[0]} tried to change your AI settings.`,
            mentions: [sender]
        });
        return reply(box('AIBYAHMAD', ['⛔ Access Denied: Only Bunty Ahmad can control AI settings.']));
    }

    const sub = (args[0] || '').toLowerCase();
    const s = await getAIAutoReplySettings(botNumber);

    if (sub === 'on') {
        await setAIAutoReplySettings(botNumber, { enabled: true });
        reply(box('AIBYAHMAD', ['✅ DM Auto-Reply: ON', '💬 Anyone who DMs you now gets a real AI reply, understood in context.']));

    } else if (sub === 'off') {
        await setAIAutoReplySettings(botNumber, { enabled: false });
        reply(box('AIBYAHMAD', ['❌ DM Auto-Reply: OFF']));

    } else {
        reply(box('AIBYAHMAD', [
            `Status: ${s.enabled ? '✅ ON' : '❌ OFF'}`,
            `──────────────`,
            `💡 .aibyahmad on`,
            `💡 .aibyahmad off`
        ]));
    }
});
