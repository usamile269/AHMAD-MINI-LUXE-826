const jsondb = require('../lib/mongo');

// 🆕 FEATURE (Bunty: "har user apna bot khud customize kar sakay, sab pe
// overall na lagay") — .setbotname/.setbotdp/.setbotaudio/.setmenustyle used
// to write straight into the bot-wide MongoDB config (keyed by botNumber),
// which is shared by literally everyone who talks to the bot. So one person
// setting a custom name/DP/song replaced it for EVERY user's .menu.
//
// This model stores those same fields, but keyed by the SENDER's own jid —
// so each person who runs .setbotname etc. only changes what THEY see when
// they run .menu. Nobody else's .menu is touched.
//
// The real bot-wide default (used for anyone who hasn't set their own) is
// still controlled separately by the owner via .globalbotname/.globalbotdp/
// .globalbotaudio, which continue to write to the old botNumber config —
// untouched by this file.
const UserBotSettings = jsondb.model('UserBotSettings');

// 🚨 SPEED FIX (Bunty: ".menu likhta to kaafi dair baad aata, overall bhi
// slow"): getUserBotSettings had ZERO caching — every single .menu call
// (and every .antidelete/.antiedit/.antiviewonce/.voviewpath check, which
// all read per-user settings too) did a real Mongo Atlas network round-trip,
// even for the huge majority of users who've never customized anything at
// all. This is the exact same stale-while-revalidate pattern already used
// for the bot-wide config (lib/database.js) — return whatever's cached
// immediately (even if stale) and refresh it quietly in the background,
// instead of blocking every command on a fresh DB call.
const USER_SETTINGS_CACHE_TTL_MS = 30 * 1000;
const userSettingsCache = new Map(); // userJid -> { settings, ts }
const userSettingsRefreshing = new Set();

async function getUserBotSettings(userJid) {
    try {
        const cached = userSettingsCache.get(userJid);
        if (cached) {
            if ((Date.now() - cached.ts) >= USER_SETTINGS_CACHE_TTL_MS && !userSettingsRefreshing.has(userJid)) {
                userSettingsRefreshing.add(userJid);
                const refreshStartedAt = Date.now();
                UserBotSettings.findOne({ userJid })
                    .then(doc => {
                        // 🚨 RACE FIX (Bunty: ".clear kaam karta hai jinhone kabhi
                        // apna naam/dp/audio set hi nahi kiya — jinhone set kiya
                        // hota unke liye clear ke baad bhi purana wala dikhta
                        // raha") — this background refresh reads from Mongo using
                        // the OLD (pre-.clear) doc if it happened to be in flight
                        // when .clear ran. Since setUserBotSettings() does its own
                        // instant, correct cache update the moment the write lands,
                        // this now-stale refresh must not clobber it afterwards.
                        // Only apply this result if nothing fresher has written to
                        // the cache since the refresh started.
                        const latest = userSettingsCache.get(userJid);
                        if (latest && latest.ts > refreshStartedAt) return;
                        userSettingsCache.set(userJid, { settings: doc ? doc.toObject() : {}, ts: Date.now() });
                    })
                    .catch(err => console.error('UserBotSettings background refresh failed:', err.message))
                    .finally(() => userSettingsRefreshing.delete(userJid));
            }
            return cached.settings;
        }

        const doc = await UserBotSettings.findOne({ userJid });
        const result = doc ? doc.toObject() : {};
        userSettingsCache.set(userJid, { settings: result, ts: Date.now() });
        return result;
    } catch (e) { return {}; }
}

async function setUserBotSettings(userJid, update) {
    // 🚨 FIX (Bunty: ".clear/.setbotname mein mongo save issue, live nahi
    // aata"): a single transient Atlas hiccup (common on shared/Railway
    // hosting) used to fail the whole save silently — caller always
    // replied "✅ success" regardless (that part is now fixed at each
    // call site too), but the underlying save itself never got a second
    // chance. One quick retry before giving up for real.
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            await UserBotSettings.findOneAndUpdate({ userJid }, update, { upsert: true, new: true });
            // Instant cache refresh so the change is visible on the very next
            // .menu/command instead of waiting up to USER_SETTINGS_CACHE_TTL_MS.
            const cached = userSettingsCache.get(userJid);
            userSettingsCache.set(userJid, { settings: { ...(cached ? cached.settings : {}), ...update }, ts: Date.now() });
            return true;
        } catch (e) {
            console.error(`UserBotSettings save error (attempt ${attempt}):`, e.message);
            if (attempt === 2) return false;
        }
    }
}

// 🚨 ROOT-CAUSE FIX (Bunty: ".clear phir bhi galat, old data a jata hai"):
// .clear used to call setUserBotSettings(sender, { BOT_NAME: null,
// MENU_IMAGE: null, MENU_AUDIO: null }) — an upsert-UPDATE, not a real
// delete. That still leaves a document sitting in the DB (and in cache)
// for that jid; any field this update didn't explicitly list (or any
// future field added later) can still linger on it untouched. ".clear"
// should mean a genuine wipe — this deletes the ENTIRE document for that
// jid (every field, A to Z) instead of nulling three specific ones, and
// clears the in-memory cache for that jid too so nothing stale can be
// served from either layer. After this, getUserBotSettings(jid) always
// returns {} for that person until they set something new, so .menu falls
// straight through to the owner's current global default — never an old
// cached value.
async function deleteUserBotSettings(userJid) {
    for (let attempt = 1; attempt <= 2; attempt++) {
        try {
            await UserBotSettings.deleteOne({ userJid });
            userSettingsCache.delete(userJid);
            userSettingsRefreshing.delete(userJid);
            return true;
        } catch (e) {
            console.error(`UserBotSettings delete error (attempt ${attempt}):`, e.message);
            if (attempt === 2) return false;
        }
    }
}

module.exports = { UserBotSettings, getUserBotSettings, setUserBotSettings, deleteUserBotSettings };
