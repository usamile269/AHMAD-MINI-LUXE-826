const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { getAntiViewOnceStatus, getAntiViewOnceSendTo } = require('../data/AntiViewOnce.js');
const config = require('../config');

function unwrapViewOnce(message) {
    if (!message) return null;
    if (message.viewOnceMessage) return message.viewOnceMessage.message;
    if (message.viewOnceMessageV2) return message.viewOnceMessageV2.message;
    if (message.viewOnceMessageV2Extension) return message.viewOnceMessageV2Extension.message;
    // Some clients set a `.viewOnce` flag directly on the media node instead
    // of wrapping it — handle that shape too.
    for (const key of ['imageMessage', 'videoMessage', 'audioMessage']) {
        if (message[key] && message[key].viewOnce) return { [key]: message[key] };
    }
    return null;
}

// 🚨 BUG FIX: .vv/.vv2/.vvdoc all had a "check global.viewOnceCache first,
// in case the view-once was already opened" fallback — but NOTHING ever
// wrote to that cache, so the fallback always missed and those commands
// only ever worked on a still-unopened view-once. This handler runs on
// every incoming message and pre-captures view-once media the moment it
// arrives, so the cache actually has something in it later.
//
// 🚨 CROSS-SESSION LEAK FIX (Bunty: "dono number mere bot se connect the,
// ek taraf ka view-once mujhe kisi aur ki taraf se bhi DM mein aa gaya"):
// this bot can run MULTIPLE paired numbers in the same process at once
// (see main.js's `activeSockets` Map). The cache used to be keyed ONLY by
// `mek.key.id` — WhatsApp message IDs are NOT guaranteed unique across
// different paired numbers/sessions, so with 2+ sessions active, one
// session's captured view-once could collide with, be overwritten by, or
// get handed back out to, a completely different session/chat. Every
// cache key is now namespaced by botNumber so each paired session's
// captured media is fully isolated from every other session — exactly
// like AntiViewOnce's own settings already are.
function scopedKey(botNumber, id) { return `${botNumber || 'unknown'}::${id}`; }

async function captureViewOnce(mek, botNumber) {
    try {
        const content = unwrapViewOnce(mek.message);
        if (!content) return;
        const type = Object.keys(content)[0];
        if (!['imageMessage', 'videoMessage', 'audioMessage'].includes(type)) return;

        // 🚨 STORAGE FIX: this used to cache every single view-once video too,
        // with no size limit — videos can be tens of MB each, and with up to
        // 200 cached, that's easily hundreds of MB of disk on a host where
        // storage is tight (KataBump free tier etc). Skip caching videos
        // bigger than a few MB; still cache photos (small, and the far more
        // common recovery case) and small clips.
        const MAX_CACHE_BYTES = 4 * 1024 * 1024; // 4MB
        // 🚨 CRASH FIX: MAX_CACHE_BYTES above only decided whether to write
        // the already-fully-downloaded buffer to disk — the download itself
        // was still unbounded, so a large view-once video (sent by literally
        // any user, not gated to owner/size in any way since this runs
        // automatically on every incoming view-once) could still fully
        // buffer into RAM and OOM-crash the whole bot before that check
        // ever ran. This aborts the download itself once it's clearly too
        // large to be worth capturing anyway.
        const MAX_DOWNLOAD_BYTES = 60 * 1024 * 1024; // 60MB
        const mediaType = type === 'imageMessage' ? 'image' : type === 'videoMessage' ? 'video' : 'audio';
        const stream = await downloadContentFromMessage(content[type], mediaType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
            if (buffer.length > MAX_DOWNLOAD_BYTES) return null; // too large — skip capture entirely rather than risk OOM
        }

        if (type === 'videoMessage' && buffer.length > MAX_CACHE_BYTES) {
            // Still return the buffer for immediate use (e.g. .antiviewonce
            // auto-forward right now), just don't write it to disk for later.
            return { buffer, type };
        }

        const ext = type === 'imageMessage' ? '.jpg' : type === 'videoMessage' ? '.mp4' : '.m4a';
        const filePath = path.join(os.tmpdir(), `vvcache_${Date.now()}_${crypto.randomBytes(3).toString('hex')}${ext}`);
        fs.writeFileSync(filePath, buffer);

        if (!global.viewOnceCache) global.viewOnceCache = new Map();
        global.viewOnceCache.set(scopedKey(botNumber, mek.key.id), {
            filePath, type, cachedAt: Date.now(),
            // 🆕 (Ahmad: ".vv jaisa but more heavy — .vvall") — needed so a
            // batch-recover command can find "everything cached from THIS
            // chat" instead of only ever working one reply at a time.
            chatId: mek.key.remoteJid,
            senderJid: mek.key.participant || mek.key.remoteJid
        });

        // 🚨 STORAGE FIX: shrunk from 200 → 40 entries, AND added a 15-minute
        // time-based expiry — .vv/.vv2/.vvdoc are almost always used within a
        // few minutes of the view-once being sent, not hours later, so there's
        // little reason to keep old cached media around at all.
        const MAX_CACHE_ENTRIES = 40;
        const MAX_CACHE_AGE_MS = 15 * 60 * 1000;
        const now = Date.now();
        for (const [key, entry] of global.viewOnceCache) {
            if (now - entry.cachedAt > MAX_CACHE_AGE_MS) {
                fs.unlink(entry.filePath, () => {});
                global.viewOnceCache.delete(key);
            }
        }
        while (global.viewOnceCache.size > MAX_CACHE_ENTRIES) {
            const oldestKey = global.viewOnceCache.keys().next().value;
            const old = global.viewOnceCache.get(oldestKey);
            if (old) fs.unlink(old.filePath, () => {});
            global.viewOnceCache.delete(oldestKey);
        }

        return { buffer, type };
    } catch (e) {
        console.log('[VIEWONCE CAPTURE] failed:', e.message);
        return null;
    }
}

// .antiviewonce: on top of the always-on caching above, when enabled for a
// chat this immediately auto-forwards the view-once media (no need to
// manually reply with .vv) as soon as it's captured.
async function handleAntiViewOnce(conn, mek) {
    try {
        // 🚨 REAL SPEED FIX (Ahmad: "turtle 🐢 speed mein ata hai, koi aur
        // cheez hai" — this was it): this used to call getAntiViewOnceStatus()
        // — a DB/file lookup (2 reads: per-chat + global) — on EVERY single
        // incoming message, for EVERY chat, unconditionally, even a plain
        // text command like .ping that has nothing to do with view-once at
        // all. That's real disk/DB I/O added to the front of literally every
        // message before any command even runs, which is exactly what
        // dragged the measured bot-processing time past the 🐢 threshold —
        // the earlier presence-update fire-and-forget fix didn't touch this
        // because it's a completely separate code path.
        // captureViewOnce() already does a synchronous, free check
        // (unwrapViewOnce) for whether this message is even a view-once
        // before doing any real work — so we now do that same cheap check
        // FIRST here too, and skip the DB call entirely unless the message
        // actually is one. For the 99% of messages that aren't view-once,
        // this function now does nothing at all instead of a file read.
        const vvContent = unwrapViewOnce(mek.message);
        if (!vvContent) return;

        const chatId = mek.key.remoteJid;
        const { jidNormalizedUser } = require('@whiskeysockets/baileys');
        const botNumber = jidNormalizedUser(conn.user.id).split('@')[0];
        const isEnabled = await getAntiViewOnceStatus(botNumber, chatId);

        const captured = await captureViewOnce(mek, botNumber);
        if (!isEnabled || !captured) return;

        const { buffer, type } = captured;
        const selfJid = jidNormalizedUser(conn.user.id);
        // 🆕 SIMPLIFIED + SCOPED: single destination setting per bot number
        // (default 'private') — see data/AntiViewOnce.js.
        const sendTo = await getAntiViewOnceSendTo(botNumber);
        // 🚨 FIX (Ahmad: ".voviewpath same not working"): this used to resolve 'private'
        // correctly but 'same' was sometimes ambiguous if chatId wasn't properly
        // normalized. Now 'private' goes to the bot's own DM, and everything else
        // (including 'same') goes back to the original chat.
        const destination = sendTo === 'private' ? selfJid : chatId;
        const participant = mek.key.participant || chatId;

        let content = {};
        if (type === 'imageMessage') content = { image: buffer, caption: `👁️ Auto-captured view-once from @${participant.split('@')[0]}` };
        else if (type === 'videoMessage') content = { video: buffer, caption: `👁️ Auto-captured view-once from @${participant.split('@')[0]}` };
        else content = { audio: buffer, mimetype: 'audio/mp4', ptt: false };
        if (content.caption) content.mentions = [participant];

        await conn.sendMessage(destination, content);
    } catch (e) {
        console.log('[ANTIVIEWONCE] failed:', e.message);
    }
}

// 🔁 NO-COMMAND RECOVERY: user replies to a view-once with literally
// anything (not the .vv2 command) — the media still gets sent to their
// own private DM automatically. Works for two cases:
//   1. The view-once is still unopened — unwrap + download it live.
//   2. It was already opened, but captureViewOnce() cached it the moment
//      it first arrived (see above) — read that cached copy.
// Deduped per (replier + message) so replying twice doesn't spam their DM.
async function autoRecoverOnReply(conn, quotedMsg, senderJid, from, botNumber) {
    try {
        if (!quotedMsg || !quotedMsg.message) return;

        let type, buffer;
        const unwrapped = unwrapViewOnce(quotedMsg.message);
        if (unwrapped) {
            type = Object.keys(unwrapped)[0];
            if (!['imageMessage', 'videoMessage', 'audioMessage'].includes(type)) return;
            const mediaType = type === 'imageMessage' ? 'image' : type === 'videoMessage' ? 'video' : 'audio';
            const stream = await downloadContentFromMessage(unwrapped[type], mediaType);
            buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
                if (buffer.length > 60 * 1024 * 1024) return; // too large — skip rather than risk OOM
            }
        } else if (quotedMsg.stanzaId && global.viewOnceCache && global.viewOnceCache.has(scopedKey(botNumber, quotedMsg.stanzaId))) {
            const cached = global.viewOnceCache.get(scopedKey(botNumber, quotedMsg.stanzaId));
            type = cached.type;
            buffer = fs.readFileSync(cached.filePath);
        } else {
            return; // not a view-once reply — nothing to recover
        }

        // 🚨 CROSS-SESSION FIX: dedupe key now also namespaced by botNumber —
        // same reasoning as the cache key above, so a coincidental id match
        // between two different paired sessions can't suppress a genuine
        // recovery on the other session.
        const dedupeKey = `${botNumber || 'unknown'}:${senderJid}:${quotedMsg.stanzaId}`;
        if (!global.vvAutoReplySent) global.vvAutoReplySent = new Set();
        if (global.vvAutoReplySent.has(dedupeKey)) return;
        global.vvAutoReplySent.add(dedupeKey);
        if (global.vvAutoReplySent.size > 500) global.vvAutoReplySent.clear();

        let content;
        if (type === 'imageMessage') content = { image: buffer, caption: '📸 View Once (auto-recovered)' };
        else if (type === 'videoMessage') content = { video: buffer, caption: '🎥 View Once (auto-recovered)' };
        else content = { audio: buffer, mimetype: 'audio/mp4', ptt: false };

        // 🚨 FIX (Bunty: "yar dekho udhar hi aa raha hai" — recovered
        // view-once was landing back in the SAME chat, visible to the
        // very person who sent it, exposing that it got captured, even
        // when the reply was just a casual "Hm"/"Yess" not meant to
        // trigger a recovery at all). Always goes to the replier's own
        // private DM now — never back into the chat it came from,
        // regardless of who sent the original view-once or what the
        // reply text was.
        await conn.sendMessage(senderJid, content);
    } catch (e) {
        console.log('[AUTO-VV-REPLY] failed:', e.message);
    }
}

module.exports = { captureViewOnce, handleAntiViewOnce, autoRecoverOnReply, unwrapViewOnce };

