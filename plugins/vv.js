const { cmd } = require('../ahmad-core');
const { sleep } = require('../lib/functions');
const config = require('../config');
const { downloadContentFromMessage, jidNormalizedUser } = require('@whiskeysockets/baileys');
// 🚨 BUG FIX (Bunty: ".vv → ERROR: randomFooter is not defined") — every
// reply box in this file uses randomFooter() but the import was missing
// entirely, so it crashed the moment it tried to build the footer.
const { randomFooter } = require('../lib/menu-styles');

async function downloadViewOnce(msgContent, type) {
    const mediaType = type === "imageMessage" ? "image" : type === "videoMessage" ? "video" : "audio";
    const mediaObj = msgContent[type];
    if (!mediaObj || !mediaObj.mediaKey) {
        throw new Error(`No mediaKey found for ${type}. The quoted message may be too old or not cached.`);
    }
    const stream = await downloadContentFromMessage(mediaObj, mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
    }
    return buffer;
}

// Try the pre-captured cache first (works even if the view-once was already opened),
// then fall back to a live re-download attempt (only works if it's still unopened).
// 🚨 CROSS-SESSION LEAK FIX (Bunty): this bot can run multiple paired
// numbers in one process, and WhatsApp message IDs aren't guaranteed
// unique across different sessions — so the cache lookup MUST be scoped
// by botNumber (see lib/viewonce-capture.js's scopedKey), or one paired
// session's .vv/.vv2 could pull back media captured under a totally
// different session/chat.
async function getViewOnceMedia(m, botNumber) {
    const stanzaId = m.quoted && m.quoted.stanzaId;
    const cacheKey = `${botNumber || 'unknown'}::${stanzaId}`;
    if (stanzaId && global.viewOnceCache && global.viewOnceCache.has(cacheKey)) {
        const cached = global.viewOnceCache.get(cacheKey);
        try {
            const fs = require('fs');
const { randomFooter } = require('../lib/menu-styles');
            const buffer = fs.readFileSync(cached.filePath);
            return { buffer, type: cached.type };
        } catch (_) { /* file missing/expired, fall through to live download */ }
    }
    if (!m.quoted.message) throw new Error("Quoted message content not available anymore.");
    let msg = m.quoted.message;
    if (msg?.viewOnceMessage) msg = msg.viewOnceMessage.message;
    else if (msg?.viewOnceMessageV2) msg = msg.viewOnceMessageV2.message;
    else if (msg?.viewOnceMessageV2Extension) msg = msg.viewOnceMessageV2Extension.message;
    const type = msg ? Object.keys(msg)[0] : null;
    if (!type) throw new Error("Could not read quoted media type.");
    const buffer = await downloadViewOnce(msg, type);
    return { buffer, type };
}

// ============================================================
// 👑 VV - OWNER ONLY (Sends to Owner's Inbox)
// ============================================================
cmd({
    pattern: "vv",
    alias: ["viewonce", "view"],
    react: "🫶🏻",
    desc: "Retrieve view-once media",
    category: "tools",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        if (!m.quoted) {
            const display = `╭═══ 🥺 VIEW ONCE ═══⊷
┃❃╭──────────────
┃❃│ ❌ Reply to a view-once media!
┃❃│ 💡 Use: .vv (reply to view once)
┃❃╰───────────────
╰═════════════════⊷

> ${randomFooter()}`;

            await conn.sendMessage(from, {
                react: { text: "❌", key: m.key }
            });
            return reply(display);
        }

        // 🔥 VIEW ONCE FIX
        const botNumber = jidNormalizedUser(conn.user.id).split('@')[0];
        const { buffer, type } = await getViewOnceMedia(m, botNumber);

        let content = {};

        if (type === "imageMessage") {
            content = {
                image: buffer,
                caption: m.quoted.text || "📸 View Once Image"
            };
        } else if (type === "videoMessage") {
            content = {
                video: buffer,
                caption: m.quoted.text || "🎥 View Once Video"
            };
        } else if (type === "audioMessage") {
            content = {
                audio: buffer,
                mimetype: "audio/mp4",
                ptt: false
            };
        } else {
            await conn.sendMessage(from, {
                react: { text: "❌", key: m.key }
            });
            return reply("❌ *THIS VIEW-ONCE MEDIA TYPE IS NOT SUPPORTED 🥺*");
        }

        // 📤 Send to owner's inbox
        // 🚨 BUG FIX: config.OWNER_NUMBER can be a stale/placeholder value if
        // it was never explicitly configured. Since this bot runs on its own
        // WhatsApp account, the bot's own connected number IS the owner in
        // practice — using conn.user.id guarantees a valid, correct JID.
        const ownerJid = conn.user.id.split(':')[0].split('@')[0] + "@s.whatsapp.net";

        // ✅ FIX: `mek` belongs to the GROUP chat, not ownerJid's DM. Passing
        // { quoted: mek } here tells Baileys to attach a reply-context that
        // points at a message living in a different chat than the one we're
        // sending to — an invalid cross-chat reference that can trip WhatsApp's
        // protocol validation and kill the socket connection (the "bot goes
        // offline" symptom). Also spaced out the calls slightly so several
        // media/react/text sends don't fire in the same instant.
        await conn.sendMessage(ownerJid, content);
        await sleep(700);

        const done = `╭═══ ✅ VIEW ONCE ═══⊷
┃❃╭──────────────
┃❃│ ✅ Media retrieved successfully!
┃❃│ 📤 Sent to owner inbox
┃❃╰───────────────
╰═════════════════⊷

> ${randomFooter()}`;

        await conn.sendMessage(from, {
            text: done
        }, { quoted: mek });

        await conn.sendMessage(from, {
            react: { text: "✅", key: m.key }
        });

    } catch (e) {
        console.log("VV ERROR:", e);
        await conn.sendMessage(from, {
            react: { text: "❌", key: m.key }
        });
        reply(`❌ *ERROR:* ${e.message}`);
    }
});

// ============================================================
// 🔥 VV2 - PUBLIC VERSION (Sends to User's DM)
// ============================================================
cmd({
    pattern: "vv2",
    alias: ["viewonce2", "getmedia"],
    react: "👁️",
    desc: "Get view once media in your DM (Public)",
    category: "recovery",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        await conn.sendMessage(from, {
            react: { text: "👁️", key: m.key }
        });

        if (!m.quoted) {
            const display = `╭═══ 👁️ VIEW ONCE ═══⊷
┃❃╭──────────────
┃❃│ ❌ Reply to a view-once media!
┃❃│ 💡 Use: .vv2 (reply to view once)
┃❃╰───────────────
╰═════════════════⊷

> ${randomFooter()}`;

            await conn.sendMessage(from, {
                react: { text: "❌", key: m.key }
            });
            return reply(display);
        }

        const botNumber = jidNormalizedUser(conn.user.id).split('@')[0];
        const { buffer, type } = await getViewOnceMedia(m, botNumber);

        let content = {};

        if (type === "imageMessage") {
            content = {
                image: buffer,
                caption: m.quoted.text || "📸 View Once Image"
            };
        } else if (type === "videoMessage") {
            content = {
                video: buffer,
                caption: m.quoted.text || "🎥 View Once Video"
            };
        } else if (type === "audioMessage") {
            content = {
                audio: buffer,
                mimetype: "audio/mp4",
                ptt: false
            };
        } else {
            await conn.sendMessage(from, {
                react: { text: "❌", key: m.key }
            });
            return reply("❌ *THIS VIEW-ONCE MEDIA TYPE IS NOT SUPPORTED 🥺*");
        }

        // 📤 Send to user's DM (who used the command)
        const userJid = m.sender; // The person who sent the command

        // ✅ FIX: same cross-chat quoted issue as .vv — mek belongs to the
        // group, not the user's DM.
        await conn.sendMessage(userJid, content);
        await sleep(700);

        const done = `╭━━━━━━━━━━━━━━━━━━━━━━╮
┃  ✅ *VIEW ONCE SENT!*  ┃
┃  ═══════════════════════
┃  📥 Media sent to your DM
┃  🔒 Check your inbox
╰━━━━━━━━━━━━━━━━━━━━━━╯

> ${randomFooter()}`;

        await conn.sendMessage(from, {
            text: done
        }, { quoted: mek });

        await conn.sendMessage(from, {
            react: { text: "✅", key: m.key }
        });

    } catch (e) {
        console.log("VV2 ERROR:", e);
        await conn.sendMessage(from, {
            react: { text: "❌", key: m.key }
        });
        reply(`❌ *ERROR:* ${e.message}`);
    }
});

// ============================================================
// 🎯 EMOJI COMMAND - PUBLIC (Sends to User's DM)
// ============================================================
cmd({
    pattern: "👁️",
    alias: ["vv3"],
    react: "👁️",
    desc: "Quick view once (Public)",
    category: "recovery",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    try {
        await conn.sendMessage(from, {
            react: { text: "👁️", key: m.key }
        });

        if (!m.quoted) {
            await conn.sendMessage(from, {
                react: { text: "❌", key: m.key }
            });
            return reply("❌ *Reply to a view once media!*");
        }

        const botNumber = jidNormalizedUser(conn.user.id).split('@')[0];
        const { buffer, type } = await getViewOnceMedia(m, botNumber);

        let content = {};

        if (type === "imageMessage") {
            content = { image: buffer, caption: "📸 View Once" };
        } else if (type === "videoMessage") {
            content = { video: buffer, caption: "🎥 View Once" };
        } else if (type === "audioMessage") {
            content = { audio: buffer, mimetype: "audio/mp4", ptt: false };
        } else {
            await conn.sendMessage(from, {
                react: { text: "❌", key: m.key }
            });
            return reply("❌ *Not supported!*");
        }

        // Send to user's DM
        const userJid = m.sender;
        await conn.sendMessage(userJid, content);
        await sleep(500);

        await conn.sendMessage(from, {
            react: { text: "✅", key: m.key }
        });
        reply("✅ *Check your DM!*");

    } catch (e) {
        console.log("EMOJI VV ERROR:", e);
        await conn.sendMessage(from, {
            react: { text: "❌", key: m.key }
        });
        reply(`❌ *ERROR:* ${e.message}`);
    }
});
module.exports = { getViewOnceMedia };
