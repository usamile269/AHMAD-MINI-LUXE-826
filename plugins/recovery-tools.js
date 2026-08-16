const { cmd } = require('../ahmad-core');
const config = require('../config');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { getViewOnceMedia } = require('./vv');
const { ownerOnlyDenied, toSansBold } = require('../lib/menu-styles');

async function downloadMedia(msgContent, type) {
    const mediaType = type === "imageMessage" ? "image" : type === "videoMessage" ? "video" : type === "audioMessage" ? "audio" : "document";
    const stream = await downloadContentFromMessage(msgContent[type], mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

function unwrapViewOnce(msg) {
    if (msg?.viewOnceMessageV2) return msg.viewOnceMessageV2.message;
    if (msg?.viewOnceMessageV2Extension) return msg.viewOnceMessageV2Extension.message;
    if (msg?.viewOnceMessage) return msg.viewOnceMessage.message;
    return msg;
}

function fail(reply, text) {
    return reply(`❌ ${toSansBold(text)}`);
}

// ==================== RECOVER TO GROUP (post in current chat) ====================
cmd({
    pattern: "vvhere",
    alias: ["vvpost", "recoverhere"],
    desc: "👁️ Recover view-once and post it right here",
    category: "recovery",
    react: "👁️",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        if (!m.quoted) return fail(reply, "Reply to a view-once media with .vvhere");
        let msg = unwrapViewOnce(m.quoted.message);
        const type = Object.keys(msg)[0];
        if (!["imageMessage", "videoMessage", "audioMessage"].includes(type)) return fail(reply, "Unsupported media type.");
        const buffer = await downloadMedia(msg, type);

        let content = {};
        if (type === "imageMessage") content = { image: buffer, caption: "📸 Recovered View-Once" };
        else if (type === "videoMessage") content = { video: buffer, caption: "🎥 Recovered View-Once" };
        else content = { audio: buffer, mimetype: "audio/mp4", ptt: false };

        await conn.sendMessage(from, content, { quoted: mek });
    } catch (e) {
        console.log("VVHERE ERROR:", e);
        fail(reply, "Could not recover media. Make sure you replied to a view-once message.");
    }
});

// ==================== SAVE VIEW-ONCE AS DOCUMENT (avoids re-view-once) ====================
cmd({
    pattern: "vvdoc",
    alias: ["vvfile"],
    desc: "📁 Recover view-once and send as a file/document",
    category: "recovery",
    react: "📁",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        if (!m.quoted) return fail(reply, "Reply to a view-once media with .vvdoc");
        // 🚨 BUG FIX: this used to read m.quoted.message directly, which is
        // empty/unusable once the view-once has already been opened (or the
        // quoted message aged out). .vv/.vv2 solved this with a pre-captured
        // cache fallback — reuse that same helper here instead of duplicating
        // (and under-supporting) the logic.
        const { buffer, type } = await getViewOnceMedia(m);
        if (!["imageMessage", "videoMessage"].includes(type)) return fail(reply, "Only image/video view-once supported here.");
        const ext = type === "imageMessage" ? "jpg" : "mp4";

        await conn.sendMessage(from, {
            document: buffer,
            mimetype: type === "imageMessage" ? "image/jpeg" : "video/mp4",
            fileName: `recovered.${ext}`
        }, { quoted: mek });
    } catch (e) {
        console.log("VVDOC ERROR:", e);
        fail(reply, "Could not recover media.");
    }
});

// ==================== STATUS SAVE (save someone's status) ====================
cmd({
    pattern: "savestatus",
    alias: ["ssave", "statussave"],
    desc: "💾 Save a replied status to your DM",
    category: "recovery",
    react: "💾",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        if (!m.quoted) return fail(reply, "Reply to a status update with .savestatus");
        const type = Object.keys(m.quoted.message)[0];
        if (!["imageMessage", "videoMessage"].includes(type)) return fail(reply, "This status type isn't supported.");
        const buffer = await downloadMedia(m.quoted.message, type);

        let content = {};
        if (type === "imageMessage") content = { image: buffer, caption: "💾 Saved Status" };
        else content = { video: buffer, caption: "💾 Saved Status" };

        await conn.sendMessage(m.sender, content, { quoted: mek });
        reply(`✅ ${toSansBold('Status saved and sent to your DM!')}`);
    } catch (e) {
        console.log("SAVESTATUS ERROR:", e);
        fail(reply, "Could not save status.");
    }
});

// ==================== RECOVER DELETED (check antidelete store, if any) ====================
cmd({
    pattern: "recoverdel",
    alias: ["restoredeleted"],
    desc: "🗑️ Info about deleted message recovery",
    category: "recovery",
    react: "🗑️",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    reply(`╭═══ 🗑️ ${toSansBold('DELETED MESSAGE RECOVERY')} ═══⊷\n┃❃│ ${toSansBold('Deleted messages are automatically')}\n┃❃│ ${toSansBold('recovered by the Anti-Delete feature')}\n┃❃│ ${toSansBold('if it\'s enabled.')}\n┃❃│\n┃❃│ Use .antidelete on/off to enable it.\n┃❃│ Use .delpath same/private to choose\n┃❃│ where recovered messages go.\n╰═════════════════⊷`);
});

// ==================== VV TO OWNER DOCUMENT ====================
cmd({
    pattern: "vvdocowner",
    desc: "📁 Recover view-once as document, sent to owner",
    category: "owner",
    react: "📁",
    filename: __filename
}, async (conn, mek, m, { from, isCreator, reply }) => {
    try {
        if (!isCreator) return fail(reply, ownerOnlyDenied());
        if (!m.quoted) return fail(reply, "Reply to a view-once media.");
        let msg = unwrapViewOnce(m.quoted.message);
        const type = Object.keys(msg)[0];
        if (!["imageMessage", "videoMessage"].includes(type)) return fail(reply, "Unsupported type.");
        const buffer = await downloadMedia(msg, type);
        const ext = type === "imageMessage" ? "jpg" : "mp4";

        const ownerJid = conn.user.id.split(':')[0].split('@')[0] + "@s.whatsapp.net";
        await conn.sendMessage(ownerJid, {
            document: buffer,
            mimetype: type === "imageMessage" ? "image/jpeg" : "video/mp4",
            fileName: `owner_recovered.${ext}`
        }, { quoted: mek });
        reply(`✅ ${toSansBold('Sent to owner as document.')}`);
    } catch (e) {
        console.log("VVDOCOWNER ERROR:", e);
        fail(reply, "Failed.");
    }
});
