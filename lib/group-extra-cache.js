// ============================================================================
// lib/group-extra-cache.js — tiny shared cache (chatId -> boolean) so
// main.js's message handler can cheaply know whether a group has ANY of
// the new group-extra.js protections (slowmode / nightmode / mediaLock /
// badwords / groupEmoji) active, WITHOUT doing a real WhatsApp-server
// round trip (groupMetadata/isAdmin) on every single plain chat message.
//
// Commands in plugins/group-extra.js call `invalidate(chatId)` after
// changing a setting, so the next message in that group re-checks fresh
// instead of using a stale cached value.
// ============================================================================
const cache = new Map();

function get(chatId) {
    return cache.has(chatId) ? cache.get(chatId) : null;
}

function set(chatId, active) {
    cache.set(chatId, active);
}

function invalidate(chatId) {
    cache.delete(chatId);
}

module.exports = { get, set, invalidate };
