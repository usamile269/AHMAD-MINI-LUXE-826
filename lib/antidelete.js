const { getAntideleteStatus, getAntideleteSendTo } = require('../data/Antidelete.js');
const config = require('../config');
const { randomFooter } = require('./menu-styles');

// Path 1: deletion arrives as a message.update (older / some clients)
const handleAntidelete = async (conn, updates, store) => {
    try {
        for (const update of updates) {
            // 🚨 BUG FIX: this used to skip whenever the ORIGINAL deleted
            // message was the bot/owner's own — meaning testing antidelete
            // by sending yourself a message and then deleting it (the most
            // natural way to test it solo) was silently ignored every time.
            // Now every deletion is caught, regardless of who sent or who
            // deleted the original message.

            const isRevoke = update.update.messageStubType === 68 ||
                             (update.update.message &&
                              update.update.message.protocolMessage &&
                              update.update.message.protocolMessage.type === 0);

            if (!isRevoke) continue;

            const chatId = update.key.remoteJid;
            const messageId = update.key.id;
            const participant = update.key.participant || chatId;

            await sendRecoveredMessage(conn, store, chatId, messageId, participant);
        }
    } catch (e) { console.error("Antidelete Error (update path):", e); }
};

// Path 2: deletion arrives as a NEW message via messages.upsert containing a
// protocolMessage of type REVOKE (type 0) — this is how modern WhatsApp/Baileys
// usually reports "Delete for Everyone". Without this, antidelete silently never fires.
const handleAntideleteUpsert = async (conn, messages, store) => {
    try {
        for (const mek of messages) {
            const proto = mek.message?.protocolMessage;
            if (!proto || proto.type !== 0 /* REVOKE */) continue;
            // 🚨 BUG FIX: same as the update-path fix above — this used to
            // skip whenever the DELETE ACTION was performed by the bot/owner
            // itself, which silently swallowed the most common solo-testing
            // pattern (send a message to yourself, then delete it yourself).

            const chatId = mek.key.remoteJid;
            const messageId = proto.key?.id; // the id of the ORIGINAL message being deleted
            const participant = mek.key.participant || proto.key?.participant || chatId;
            if (!messageId) continue;

            await sendRecoveredMessage(conn, store, chatId, messageId, participant);
        }
    } catch (e) { console.error("Antidelete Error (upsert path):", e); }
};

// 🚨 BUG FIX (requested by Ahmad — header showed up but the actual deleted
// message content never did): the old code sent the alert header, THEN
// tried `forward: msg` for the actual content with no error handling of its
// own — if that forward call threw (which it does for messages wrapped in
// ephemeralMessage/viewOnceMessage, which forward doesn't unwrap), the
// header had already gone out and the failure was silently swallowed by the
// outer try/catch, so it just looked like the content "never came". This
// unwraps those wrapper types first, and always falls back to at least a
// plain-text copy of the content if the raw forward fails for any reason.
function unwrapMessage(message) {
    if (!message) return message;
    if (message.ephemeralMessage) return unwrapMessage(message.ephemeralMessage.message);
    if (message.viewOnceMessage) return unwrapMessage(message.viewOnceMessage.message);
    if (message.viewOnceMessageV2) return unwrapMessage(message.viewOnceMessageV2.message);
    if (message.viewOnceMessageV2Extension) return unwrapMessage(message.viewOnceMessageV2Extension.message);
    if (message.documentWithCaptionMessage) return unwrapMessage(message.documentWithCaptionMessage.message);
    return message;
}

function extractPlainText(message) {
    if (!message) return null;
    return message.conversation
        || message.extendedTextMessage?.text
        || message.imageMessage?.caption
        || message.videoMessage?.caption
        || message.documentMessage?.caption
        || null;
}

async function sendRecoveredMessage(conn, store, chatId, messageId, participant) {
    const botNumber = conn.user.id.split(':')[0].split('@')[0];
    const isEnabled = await getAntideleteStatus(botNumber, chatId);
    if (!isEnabled) return;

    if (!store || !store.messages[chatId]) return;
    const msg = await store.loadMessage(chatId, messageId);
    if (!msg) return; // message wasn't cached before it got deleted — can't recover

    const sendTo = await getAntideleteSendTo(botNumber, chatId);
    const isPrivate = sendTo === 'private';
    const destination = isPrivate
        ? conn.user.id.split(':')[0].split('@')[0] + "@s.whatsapp.net"
        : chatId;

    const isGroup = chatId.endsWith('@g.us');
    let groupName = '';
    if (isGroup) {
        try { groupName = (await conn.groupMetadata(chatId)).subject; } catch { groupName = 'this group'; }
    }

    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    const date = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    // 🚨 FEATURE (requested by Ahmad — alert was too short/plain): expanded
    // into the same channel-forward box style used everywhere else in the
    // bot, with who/where/when plus a short "rules" line explaining that
    // deleting a message in a monitored chat doesn't actually stop it from
    // being seen — matches the attractive style of the rest of the bot's
    // group commands instead of a bare 3-line alert.
    const alertText = `╭━━━ 💗 𝙈𝙀𝙎𝙎𝘼𝙂𝙀 𝙍𝙀𝘾𝙊𝙑𝙀𝙍𝙀𝘿 ━━━╮
┃ 𖹭 𝙊𝙍𝙄𝙂𝙄𝙉𝘼𝙇 𝘾𝙊𝙉𝙏𝙀𝙉𝙏 𝙍𝙀𝙎𝙏𝙊𝙍𝙀𝘿
┣━━━━━━━━━━━━━━━━━━━━━━┫
┃ 👤 𝙁𝙧𝙤𝙢: @${participant.split('@')[0]}
┃ 💬 𝙎𝙤𝙪𝙧𝙘𝙚: ${isGroup ? groupName : '𝙔𝙤𝙪𝙧 𝙋𝙧𝙞𝙫𝙖𝙩𝙚 𝘾𝙝𝙖𝙩'}
┃ 🕒 ${time}  •  ${date}
┣━━━━━━━━━━━━━━━━━━━━━━┫
┃ 🗑️ 𝘿𝙚𝙡𝙚𝙩𝙚𝙙 𝙢𝙚𝙨𝙨𝙖𝙜𝙚 𝙧𝙚𝙘𝙤𝙫𝙚𝙧𝙚𝙙
┃ 𝙏𝙝𝙚 𝙤𝙧𝙞𝙜𝙞𝙣𝙖𝙡 𝙢𝙚𝙨𝙨𝙖𝙜𝙚 𝙞𝙨 𝙖𝙩𝙩𝙖𝙘𝙝𝙚𝙙 𝙗𝙚𝙡𝙤𝙬.
╰━━━ 💗 𝘼𝙃𝙈𝘼𝘿 𝙈𝙄𝙉𝙄 ━━━╯

> ✦﹒𝙊𝘽𝙎𝙄𝘿𝙄𝘼𝙉 𝙇𝙐𝙓𝙀 𝘼𝙃𝙈𝘼𝘿 𝙈𝙄𝙉𝙄`;
    await conn.sendMessage(destination, { text: alertText, mentions: [participant] });

    // 🚨 BUG FIX: `quoted` must belong to the SAME chat you're sending to.
    // When forwarding to the owner's private chat (destination !== chatId),
    // `msg` is still keyed to the original group/chat, so Baileys' quoted
    // context (remoteJid/participant) mismatches the destination and the
    // send silently fails — matching "works in same chat, never arrives
    // when set to private". Only quote when forwarding into the same chat.
    const unwrapped = unwrapMessage(msg.message);
    const forwardableMsg = { ...msg, message: unwrapped };
    try {
        if (isPrivate) {
            await conn.sendMessage(destination, { forward: forwardableMsg, contextInfo: { isForwarded: false } });
        } else {
            await conn.sendMessage(destination, { forward: forwardableMsg, contextInfo: { isForwarded: false } }, { quoted: msg });
        }
    } catch (forwardErr) {
        console.log('[ANTIDELETE] forward failed, falling back to plain text:', forwardErr.message);
        const text = extractPlainText(unwrapped);
        if (text) {
            await conn.sendMessage(destination, { text: `📝 *Recovered text:*\n${text}` }).catch((e) => console.log('[ANTIDELETE] plain-text fallback also failed:', e.message));
        } else {
            await conn.sendMessage(destination, { text: `⚠️ Couldn't recover this message's content (unsupported message type: ${Object.keys(unwrapped || {})[0] || 'unknown'}).` }).catch(() => {});
        }
    }
}

module.exports = { handleAntidelete, handleAntideleteUpsert };
