const jsondb = require('../lib/mongo');

const GLOBAL_KEY = '__GLOBAL__';

// Stored locally now (JSON file via lib/jsondb.js) instead of MongoDB.
const GroupSettings = jsondb.model('GroupSettings');

const DEFAULTS = { welcomeOn: false, welcomeMsg: "Welcome @user to the group! 🎉", welcomeVideo: null, goodbyeMsg: null, goodbyeVideo: null, kickMsg: null, warnLimit: 3, antilink: false, antilinkAction: 'delete', rules: null, badwords: [], slowmodeSec: 0, nightMode: null, mediaLock: false, groupEmoji: null, antiforward: false, antiforwardAction: 'delete' };

// 🚨 SPEED FIX (same class as getUserConfigFromMongoDB in lib/database.js):
// this was hitting the DB fresh on every antilink/slowmode/nightmode-relevant
// group message with no caching. Group settings change rarely (only via
// .antilink/.slowmode/etc.), so cache reads for a short window and refresh
// instantly on write.
const groupSettingsCache = new Map(); // chatId -> { settings, ts }
const GROUP_SETTINGS_CACHE_TTL_MS = 30000;

// 🚨 FEATURE RESTORED (Ahmad: "apni chat se sab set karo, sab groups pe
// lagu ho"): getGroupSettings used to read ONLY that exact chatId's own
// document, with the GLOBAL_KEY doc never consulted for anything — so a
// global value written via the owner's self-chat had nowhere to actually
// apply. Now, for any real group, its settings are built as: bot-wide
// GLOBAL_KEY settings as the base, with that specific group's own saved
// fields overlaid on top (so a group that's explicitly configured
// something for itself still wins for that field — only fields the group
// has never touched fall back to the global value).
async function getGroupSettings(chatId) {
    try {
        const cached = groupSettingsCache.get(chatId);
        if (cached && (Date.now() - cached.ts) < GROUP_SETTINGS_CACHE_TTL_MS) {
            return cached.settings;
        }
        const chatDoc = await GroupSettings.findOne({ chatId });
        const groupRaw = chatDoc ? chatDoc.toObject() : {};

        const base = (chatId === GLOBAL_KEY) ? DEFAULTS : await getGroupSettings(GLOBAL_KEY);

        const result = { ...base, ...groupRaw, chatId };
        groupSettingsCache.set(chatId, { settings: result, ts: Date.now() });
        return result;
    } catch (e) { return { chatId, ...DEFAULTS }; }
}

async function setGroupSettings(chatId, update) {
    try {
        await GroupSettings.findOneAndUpdate({ chatId }, update, { upsert: true, new: true });
        if (chatId === GLOBAL_KEY) {
            // Every group's cached result was built by merging in the global
            // doc, so a global change invalidates all of them, not just this key.
            groupSettingsCache.clear();
        } else {
            groupSettingsCache.delete(chatId); // force a fresh read (with the new merged doc) next time
        }
        return true;
    } catch (e) { console.error("GroupSettings save error:", e.message); return false; }
}

module.exports = { GroupSettings, GLOBAL_KEY, getGroupSettings, setGroupSettings };
