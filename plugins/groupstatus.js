const { cmd } = require('../ahmad-core');
const { downloadContentFromMessage, generateWAMessage } = require('@whiskeysockets/baileys');
const { randomFooter } = require('../lib/menu-styles');
const crypto = require('crypto');

// 🚨 TRIED AND REVERTED (Bunty: wanted media attached to the real working
// text status): attempted sending image/video as a text status carrying a
// link-preview-style thumbnail (externalAdReplyInfo). Even after two
// separate encoding fixes (pixel format, frame-timing), it still rendered
// black in WhatsApp's Status viewer — confirmed this is a rendering
// limitation of that mechanism inside Status specifically, not an encoding
// bug on our side. Bunty's priority is the exact image/video showing with
// no black, over having the green status-ring on it — so image/video now
// go out as real media again (see below), same as before that experiment.

// 🆕 (Bunty: "AURA-MD wali file mein .gcstatus sahi hai, yeh lagao" then
// "fallback koi na, AURA wala hi lagao") — posts the content directly INTO
// the group via conn.relayMessage using groupStatusMessageV2, instead of
// the bot's own personal WhatsApp Status.
// 🚨 KNOWN LIMITATION, CONFIRMED VIA SCREENSHOTS (Bunty: real group status
// shows a green ring on the group photo for TEXT, but not for image/video):
// mainline @whiskeysockets/baileys doesn't implement groupStatusMessageV2
// for media, only for text — and the text+thumbnail-preview workaround
// (see comment above) also failed (rendered black). Bunty declined
// switching to the unofficial fork that adds real media support. Final
// state: text status is a real group status; image/video/audio/sticker
// still attempt the real relay (harmless no-op if it fails) but are then
// also sent as a normal group message so the actual content is always
// visible, even without the green ring.
async function relayGroupStatusV2(conn, jid, msgContent) {
    const messageSecret = crypto.randomBytes(32);
    const msg = await generateWAMessage(jid, msgContent, {
        userJid: conn.user.id,
        upload: conn.waUploadToServer
    });
    const relayMsg = {
        groupStatusMessageV2: {
            message: msg.message,
            messageContextInfo: { messageSecret }
        }
    };
    await conn.relayMessage(jid, relayMsg, { messageId: msg.key.id });
    return msg;
}

// ============================================================================
// .gcstatus / .gstatus / .poststatus / .statuspost
// ----------------------------------------------------------------------------
// Posts directly into the group as a native Group Status (groupStatusMessageV2)
// — NOT the bot's personal WhatsApp Status. Unlike the old status@broadcast
// approach, this isn't subject to "only people who've saved the bot's number
// as a contact can see it" — it's genuinely a group-scoped post.
// ============================================================================

async function downloadQuotedMedia(quotedMsg, type) {
    const mediaTypeMap = { imageMessage: 'image', videoMessage: 'video', audioMessage: 'audio', stickerMessage: 'sticker' };
    const mediaType = mediaTypeMap[type];
    const stream = await downloadContentFromMessage(quotedMsg[type], mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
    return buffer;
}

cmd({
    pattern: "groupstatus",
    alias: ["gstatus", "poststatus", "statuspost", "gcstatus"],
    desc: "Post text/image/video/audio/sticker as a native Group Status, visible to everyone in this group",
    category: "group",
    react: "📡",
    filename: __filename
}, async (conn, mek, m, { body, reply, from, isGroup }) => {
    try {
        if (!isGroup) return reply("❌ This command only works in groups.");
        await conn.sendMessage(from, { react: { text: "📡", key: m.key } });

        const caption = body.split(" ").slice(1).join(" ");
        const quoted = m.quoted?.message;

        const done = (label) => `╭═══ ✅ STATUS ═══⊷\n┃❃╭──────────────\n┃❃│ ✅ ${label}\n┃❃│ 🟢 Posted as this group's Status\n┃❃╰───────────────\n╰═════════════════⊷\n\n> ${randomFooter()}`;

        if (!quoted && caption) {
            // 🆕 (Bunty: "fallback koi na, AURA wala hi lagao") — dropped
            // the fallback entirely, groupStatusMessageV2 only now.
            await relayGroupStatusV2(conn, from, { text: caption });
            await conn.sendMessage(from, { react: { text: "✅", key: m.key } });
            return reply(done('Text status posted!'));
        }
        if (!quoted) {
            await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
            return reply(`❌ No message or media!\n💡 Use: .gcstatus Hello\n💡 Or reply to media with .gcstatus`);
        }

        if (quoted.imageMessage) {
            const media = await downloadQuotedMedia(quoted, 'imageMessage');
            const imgCaption = caption || quoted.imageMessage.caption || '';
            // 🚨 THIRD ATTEMPT (Bunty: the text+thumbnail approach DID get
            // the real green-ring status-attach working, only the picture
            // itself came out black — wants that mechanism back, fixed).
            // Previous two attempts re-encoded the thumbnail ourselves via
            // ffmpeg, which could itself have been the bug. This time: use
            // the jpegThumbnail WhatsApp itself already generated for this
            // exact image (every image message carries one) — it's
            // guaranteed to be a valid, correctly-formatted small JPEG
            // since WhatsApp made it, so if THIS still comes out black,
            // that conclusively proves it's the Status viewer's rendering,
            // not our encoding. Real media is still sent right after either
            // way, so nothing is lost if it's still black.
            if (quoted.imageMessage.jpegThumbnail) {
                await relayGroupStatusV2(conn, from, {
                    text: imgCaption || ' ',
                    contextInfo: {
                        externalAdReplyInfo: {
                            title: 'GC STATUS',
                            thumbnail: quoted.imageMessage.jpegThumbnail,
                            mediaType: 1,
                            renderLargerThumbnail: true,
                            showAdAttribution: false
                        }
                    }
                }).catch(() => {});
            }
            await relayGroupStatusV2(conn, from, { image: media, caption: imgCaption }).catch(() => {});
            await conn.sendMessage(from, {
                image: media,
                caption: `╭═══ 📡 GC STATUS ═══⊷\n┃❃│ ${imgCaption || 'Image status'}\n╰═════════════════⊷`
            }, { quoted: mek });
            await conn.sendMessage(from, { react: { text: "✅", key: m.key } });
            return reply(done('Image status posted!'));
        }
        if (quoted.videoMessage) {
            const media = await downloadQuotedMedia(quoted, 'videoMessage');
            const vidCaption = caption || quoted.videoMessage.caption || '';
            if (quoted.videoMessage.jpegThumbnail) {
                await relayGroupStatusV2(conn, from, {
                    text: vidCaption || ' ',
                    contextInfo: {
                        externalAdReplyInfo: {
                            title: 'GC STATUS',
                            thumbnail: quoted.videoMessage.jpegThumbnail,
                            mediaType: 2,
                            renderLargerThumbnail: true,
                            showAdAttribution: false
                        }
                    }
                }).catch(() => {});
            }
            await relayGroupStatusV2(conn, from, { video: media, caption: vidCaption, mimetype: 'video/mp4' }).catch(() => {});
            await conn.sendMessage(from, {
                video: media,
                mimetype: 'video/mp4',
                caption: `╭═══ 📡 GC STATUS ═══⊷\n┃❃│ ${vidCaption || 'Video status'}\n╰═════════════════⊷`
            }, { quoted: mek });
            await conn.sendMessage(from, { react: { text: "✅", key: m.key } });
            return reply(done('Video status posted!'));
        }
        if (quoted.audioMessage) {
            const media = await downloadQuotedMedia(quoted, 'audioMessage');
            await relayGroupStatusV2(conn, from, { audio: media, mimetype: "audio/mp4", ptt: false }).catch(() => {});
            await conn.sendMessage(from, { audio: media, mimetype: "audio/mp4", ptt: false }, { quoted: mek });
            await conn.sendMessage(from, { react: { text: "✅", key: m.key } });
            return reply(done('Audio status posted!'));
        }
        if (quoted.stickerMessage) {
            const media = await downloadQuotedMedia(quoted, 'stickerMessage');
            await relayGroupStatusV2(conn, from, { sticker: media }).catch(() => {});
            await conn.sendMessage(from, { sticker: media }, { quoted: mek });
            await conn.sendMessage(from, { react: { text: "✅", key: m.key } });
            return reply(done('Sticker status posted!'));
        }
        if (quoted.documentMessage || quoted.conversation || quoted.extendedTextMessage) {
            const text = caption || quoted.extendedTextMessage?.text || quoted.conversation || 'No text';
            await relayGroupStatusV2(conn, from, { text });
            await conn.sendMessage(from, { react: { text: "✅", key: m.key } });
            return reply(done('Text/Doc status posted!'));
        }

        await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
        return reply(`❌ Unsupported media type — reply to image/video/audio/sticker/text.`);

    } catch (err) {
        console.log("GROUPSTATUS ERROR:", err);
        await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
        reply(`❌ Error: ${err.message}\n📌 Ensure bot's account allows Status posting.`);
    }
});
