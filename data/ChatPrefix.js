const jsondb = require('../lib/mongo');

// 🆕 FEATURE (Bunty: ".setprefix owner se hatao, user apna Jo marzi karay,
// no overall — .setprefixall owner ke liye"): every chat (a group, or
// someone's own DM) can carry its own prefix override — set by whoever's
// allowed to run .setprefix there (group admin/owner in a group, anyone in
// their own DM), no owner check. The bot-wide default is still separately
// controlled by the owner via .setprefixall (unchanged config.PREFIX
// mechanism), for whoever hasn't set their own.
//
// 🚨 SCOPING FIX: same reasoning as data/AntiViewOnce.js — this bot can run
// multiple paired numbers off one deployment/Mongo, so every key here is
// namespaced by botNumber too. Otherwise chat X's custom prefix on one
// paired number could leak into (or collide with) chat X on a different
// paired number.
const ChatPrefix = jsondb.model('ChatPrefix');
function keyFor(botNumber, chatId) { return `${botNumber}::${chatId}`; }

// Same stale-while-revalidate pattern as data/UserBotSettings.js — a plain
// Map lookup is fast for the 99% of chats that never touch this, and only
// the very first message ever seen from a given chat pays one real DB read.
const PREFIX_CACHE_TTL_MS = 30 * 1000;
const chatPrefixCache = new Map(); // "botNumber::chatId" -> { prefix, ts }
const chatPrefixRefreshing = new Set();

// Synchronous — reads whatever's cached right now (or null if never
// checked). main.js calls this on every message, so it must never block.
function getCachedChatPrefix(botNumber, chatId) {
    const key = keyFor(botNumber, chatId);
    const cached = chatPrefixCache.get(key);
    if (!cached) {
        // Not cached yet — kick off a background fetch so the NEXT message
        // from this chat is fast, and treat this one message as "no
        // override" (falls back to the global prefix) rather than stalling.
        if (!chatPrefixRefreshing.has(key)) {
            chatPrefixRefreshing.add(key);
            ChatPrefix.findOne({ chatId: key })
                .then(doc => chatPrefixCache.set(key, { prefix: doc ? doc.prefix : null, ts: Date.now() }))
                .catch(() => chatPrefixCache.set(key, { prefix: null, ts: Date.now() }))
                .finally(() => chatPrefixRefreshing.delete(key));
        }
        return null;
    }
    if ((Date.now() - cached.ts) >= PREFIX_CACHE_TTL_MS && !chatPrefixRefreshing.has(key)) {
        chatPrefixRefreshing.add(key);
        ChatPrefix.findOne({ chatId: key })
            .then(doc => chatPrefixCache.set(key, { prefix: doc ? doc.prefix : null, ts: Date.now() }))
            .catch(() => {})
            .finally(() => chatPrefixRefreshing.delete(key));
    }
    return cached.prefix;
}

async function setChatPrefix(botNumber, chatId, prefix) {
    const key = keyFor(botNumber, chatId);
    try {
        await ChatPrefix.findOneAndUpdate({ chatId: key }, { prefix }, { upsert: true, new: true });
        chatPrefixCache.set(key, { prefix, ts: Date.now() }); // instant, visible on the very next message
        return true;
    } catch (e) { console.error('ChatPrefix save error:', e.message); return false; }
}

async function clearChatPrefix(botNumber, chatId) {
    const key = keyFor(botNumber, chatId);
    try {
        await ChatPrefix.findOneAndUpdate({ chatId: key }, { prefix: null }, { upsert: true, new: true });
        chatPrefixCache.set(key, { prefix: null, ts: Date.now() });
        return true;
    } catch (e) { return false; }
}

module.exports = { ChatPrefix, getCachedChatPrefix, setChatPrefix, clearChatPrefix };
