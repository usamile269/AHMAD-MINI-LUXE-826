// ============================================================================
// lib/database.js — local storage layer (NO MongoDB, per Ahmad's request)
// ----------------------------------------------------------------------------
// Every function name/signature below is UNCHANGED from the old MongoDB
// version, so every plugin/file that calls these (main.js, telegram-pair.js,
// owner.js, etc.) keeps working with zero changes on their end. Only what
// happens *inside* each function changed: instead of talking to a remote
// MongoDB Atlas cluster, everything is now read/written to small JSON files
// under the /database folder (via lib/jsondb.js).
//
// Benefits: no MongoDB URI to set up, no internet dependency for storage,
// works identically on Railway / Render / Heroku / any VPS or panel hosting
// / bot-hosting.net — as long as that host gives the app a persistent disk
// (see the hosting notes in README.md).
// ============================================================================

const storage = require('./mongo');

// 🚨 FIX (requested by Ahmad — paired sessions disappearing on every
// re-upload/redeploy): this now actually connects to MongoDB Atlas when
// config.MONGODB_URI is set (survives redeploys), and transparently falls
// back to the old local-JSON behavior when it isn't set — see lib/mongo.js.
const connectdb = async () => {
    if (storage.isMongoConfigured) {
        await storage.ensureConnected();
    } else {
        console.log('ℹ️ MONGODB_URI not set — using local JSON storage (paired sessions/settings will be lost on redeploy). Set MONGODB_URI to fix this permanently.');
    }
};

// ====================================
// COLLECTIONS
// ====================================
const Session = storage.model('Session');
const UserConfig = storage.model('UserConfig');
const OTP = storage.model('OTP');
const ActiveNumber = storage.model('ActiveNumber');
const Stats = storage.model('Stats');
const TelegramUser = storage.model('TelegramUser');
const ChannelRelay = storage.model('ChannelRelay'); // 🆕 auto-relay mappings for .chnfor

// ====================================
// SESSION
// ====================================
async function saveSessionToMongoDB(number, credentials) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        await Session.findOneAndUpdate(
            { number: cleanNumber },
            { credentials },
            { upsert: true }
        );
        console.log(`📁 Session saved locally for ${cleanNumber}`);
        return true;
    } catch (error) {
        console.error('❌ Error saving session:', error.message);
        return false;
    }
}

async function getSessionFromMongoDB(number) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const session = await Session.findOne({ number: cleanNumber });
        return session ? session.credentials : null;
    } catch (error) {
        console.error('❌ Error getting session:', error.message);
        return null;
    }
}

async function deleteSessionFromMongoDB(number) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        await Session.deleteOne({ number: cleanNumber });
        await ActiveNumber.deleteOne({ number: cleanNumber });
        console.log(`🗑️ Session deleted locally for ${cleanNumber}`);
        return true;
    } catch (error) {
        console.error('❌ Error deleting session:', error.message);
        return false;
    }
}

// ====================================
// USER CONFIG
// ====================================
const DEFAULT_USER_CONFIG = {
    AUTO_RECORDING: 'false',
    AUTO_TYPING: 'false',
    AUTO_REACT: 'false',
    ANTI_CALL: 'false',
    REJECT_MSG: '*🔕 ʏᴏᴜʀ ᴄᴀʟʟ ᴡᴀs ᴀᴜᴛᴏᴍᴀᴛɪᴄᴀʟʟʏ ʀᴇᴊᴇᴄᴛᴇᴅ..!*',
    READ_MESSAGE: 'false',
    AUTO_VIEW_STATUS: 'true',
    AUTO_LIKE_STATUS: 'true',
    AUTO_STATUS_REPLY: 'false',
    AUTO_STATUS_MSG: 'Hello from black popkid!',
    AUTO_LIKE_EMOJI: ['❤️', '👍', '😮', '😎'],
    BOT_NAME: "MINI AHMAD V077",
    MENU_IMAGE: null,
    MENU_AUDIO: null,
    MENU_STYLE: 1
};

// 🚨 SPEED FIX (Ahmad: "bot slow hai katabump per bhi" — this is the #1
// cause): getUserConfigFromMongoDB was called UNCONDITIONALLY on EVERY
// single incoming message (main.js, before any command even runs) with a
// full network round-trip to MongoDB Atlas every time — not cached anywhere.
// On a lower-resource/free host like Katabump, that round-trip alone can be
// several hundred ms, and it happened before the bot could do ANYTHING else
// with the message. Settings like AUTO_TYPING/AUTO_REACT/etc. change rarely
// (only when the owner runs a .set* command), so there's no reason to fetch
// them fresh from the DB on every message. This adds a short in-memory
// cache: reads reuse the cached value for 30s, and any write (updateUser-
// ConfigInMongoDB) instantly refreshes the cache so a toggle takes effect
// immediately instead of waiting out the TTL.
const userConfigCache = new Map(); // cleanNumber -> { config, ts }
const USER_CONFIG_CACHE_TTL_MS = 600000; // 🚀 Optimized: Cache for 10 minutes instead of 30s for lightning speed

// Tracks an in-flight background refresh per number so a stale cache entry
// doesn't trigger 50 parallel Mongo lookups if 50 messages land in the same
// second (only the first schedules a refresh; the rest just reuse the cache).
const userConfigRefreshing = new Set();

async function getUserConfigFromMongoDB(number) {
    const cleanNumber = number.replace(/[^0-9]/g, '');
    try {
        const cached = userConfigCache.get(cleanNumber);

        // 🚨 SPEED FIX (Bunty: "speed 138ms hai, 9-15ms chahiye real"):
        // previously, once the 30s TTL expired, the VERY NEXT message had to
        // block on a fresh Mongo Atlas round-trip (regularly 100ms+) before
        // the bot could even start processing — that round-trip alone was
        // most of the "138ms". Settings rarely change, so there's no need
        // to block on freshness: if we have ANY cached value (even stale),
        // return it immediately and refresh it in the background instead.
        // Only a number's very first-ever message (nothing cached yet) has
        // to wait on the real DB call — every message after that is a
        // sub-millisecond in-memory Map read, which is what actually makes
        // single-digit-ms ping numbers possible.
        if (cached) {
            if ((Date.now() - cached.ts) >= USER_CONFIG_CACHE_TTL_MS && !userConfigRefreshing.has(cleanNumber)) {
                userConfigRefreshing.add(cleanNumber);
                UserConfig.findOne({ number: cleanNumber })
                    .then(doc => {
                        const fresh = doc ? doc.config : DEFAULT_USER_CONFIG;
                        userConfigCache.set(cleanNumber, { config: fresh, ts: Date.now() });
                    })
                    .catch(err => console.error('❌ Background user config refresh failed:', err.message))
                    .finally(() => userConfigRefreshing.delete(cleanNumber));
            }
            return cached.config;
        }

        const config = await UserConfig.findOne({ number: cleanNumber });
        const result = config ? config.config : DEFAULT_USER_CONFIG;
        if (!config) await UserConfig.create({ number: cleanNumber, config: DEFAULT_USER_CONFIG });

        userConfigCache.set(cleanNumber, { config: result, ts: Date.now() });
        return result;
    } catch (error) {
        console.error('❌ Error getting user config:', error.message);
        return {};
    }
}

// 🆕 (Bunty: ".cleardb — user ka data wipe ho jaye db se, fresh new ho
// jaye all default mein") — deletes this botNumber's UserConfig document
// entirely (BOT_NAME, OWNER_NAME, WORK_TYPE, MENU_IMAGE, etc. all revert
// to DEFAULT_USER_CONFIG) and clears its cache entry so the very next
// read doesn't serve a stale value.
async function deleteUserConfigFromMongoDB(number) {
    const cleanNumber = number.replace(/[^0-9]/g, '');
    try {
        await UserConfig.deleteOne({ number: cleanNumber });
        userConfigCache.delete(cleanNumber);
        userConfigRefreshing.delete(cleanNumber);
        return true;
    } catch (error) {
        console.error('❌ Error deleting user config:', error.message);
        return false;
    }
}

async function updateUserConfigInMongoDB(number, newConfig) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        await UserConfig.findOneAndUpdate(
            { number: cleanNumber },
            { config: newConfig },
            { upsert: true }
        );
        // Instant cache refresh so the change is visible on the very next
        // message instead of waiting up to USER_CONFIG_CACHE_TTL_MS.
        userConfigCache.set(cleanNumber, { config: newConfig, ts: Date.now() });
        console.log(`⚙️ Config updated for ${cleanNumber}`);
        return true;
    } catch (error) {
        console.error('❌ Error updating user config:', error.message);
        return false;
    }
}

// ====================================
// OTP
// ====================================
async function saveOTPToMongoDB(number, otp, config) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        await OTP.create({
            number: cleanNumber,
            otp,
            config,
            // No TTL index locally, so the expiry has to be stored explicitly
            // and checked by hand in verifyOTPFromMongoDB below.
            expiresAt: new Date(Date.now() + 5 * 60000).toISOString()
        });
        console.log(`🔐 OTP saved for ${cleanNumber}`);
        return true;
    } catch (error) {
        console.error('❌ Error saving OTP:', error.message);
        return false;
    }
}

async function verifyOTPFromMongoDB(number, otp) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const candidates = await OTP.find({ number: cleanNumber, otp });
        const valid = candidates.find((c) => new Date(c.expiresAt) > new Date());

        if (!valid) return { valid: false, error: 'Invalid or expired OTP' };

        await OTP.deleteOne({ _id: valid._id });
        return { valid: true, config: valid.config };
    } catch (error) {
        console.error('❌ Error verifying OTP:', error.message);
        return { valid: false, error: 'Verification error' };
    }
}

// ====================================
// ACTIVE NUMBERS (reconnect tracking + welcome cooldown)
// ====================================
async function addNumberToMongoDB(number) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        await ActiveNumber.findOneAndUpdate(
            { number: cleanNumber },
            { lastConnected: new Date().toISOString(), isActive: true },
            { upsert: true }
        );
        return true;
    } catch (error) {
        console.error('❌ Error adding active number:', error.message);
        return false;
    }
}

async function removeNumberFromMongoDB(number) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        await ActiveNumber.deleteOne({ number: cleanNumber });
        return true;
    } catch (error) {
        console.error('❌ Error removing active number:', error.message);
        return false;
    }
}

async function getMsSinceLastWelcome(number) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const doc = await ActiveNumber.findOne({ number: cleanNumber });
        if (!doc || !doc.lastWelcomeAt) return Infinity;
        return Date.now() - new Date(doc.lastWelcomeAt).getTime();
    } catch (error) {
        console.error('❌ Error checking last welcome time:', error.message);
        return Infinity; // fail open — better to occasionally over-send than never send
    }
}

async function markWelcomeSent(number) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        await ActiveNumber.findOneAndUpdate(
            { number: cleanNumber },
            { lastWelcomeAt: new Date().toISOString() },
            { upsert: true }
        );
        return true;
    } catch (error) {
        console.error('❌ Error marking welcome sent:', error.message);
        return false;
    }
}

async function getAllNumbersFromMongoDB() {
    try {
        const activeNumbers = await ActiveNumber.find({ isActive: true });
        return activeNumbers.map((num) => num.number);
    } catch (error) {
        console.error('❌ Error getting active numbers:', error.message);
        return [];
    }
}

// ====================================
// STATS
// ====================================
async function incrementStats(number, field) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const today = new Date().toISOString().split('T')[0];
        await Stats.findOneAndUpdate(
            { number: cleanNumber, date: today },
            { $inc: { [field]: 1 } },
            { upsert: true }
        );
    } catch (error) {
        console.error('❌ Error updating stats:', error.message);
    }
}

async function getStatsForNumber(number) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const stats = await Stats.find({ number: cleanNumber });
        return stats.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 30);
    } catch (error) {
        console.error('❌ Error getting stats:', error.message);
        return [];
    }
}

// 🆕 Command usage leaderboard — sums every `cmd_<name>` counter across all
// stored days for this bot number and returns the top N most-used commands.
// Reuses the exact same Stats docs incrementStats() already writes on every
// command call, so no new tracking/storage was needed — just an aggregation.
async function getCommandLeaderboard(number, limit = 10) {
    try {
        const cleanNumber = number.replace(/[^0-9]/g, '');
        const docs = await Stats.find({ number: cleanNumber });
        const totals = {};
        for (const doc of docs) {
            for (const [key, val] of Object.entries(doc)) {
                if (!key.startsWith('cmd_') || typeof val !== 'number') continue;
                const name = key.slice(4);
                totals[name] = (totals[name] || 0) + val;
            }
        }
        return Object.entries(totals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([name, count]) => ({ name, count }));
    } catch (error) {
        console.error('❌ Error building command leaderboard:', error.message);
        return [];
    }
}

// ====================================
// TELEGRAM PAIRING-BOT USERS
// ====================================
async function saveTelegramUser(chatId, meta = {}) {
    try {
        const existing = await TelegramUser.findOne({ chatId: String(chatId) });
        await TelegramUser.findOneAndUpdate(
            { chatId: String(chatId) },
            {
                lastSeen: new Date().toISOString(),
                username: meta.username || null,
                firstName: meta.firstName || null,
                firstSeen: existing ? existing.firstSeen : new Date().toISOString()
            },
            { upsert: true }
        );
    } catch (error) {
        console.error('❌ Error saving Telegram user:', error.message);
    }
}

async function getAllTelegramUsers() {
    try {
        const users = await TelegramUser.find({});
        return users.map((u) => u.chatId);
    } catch (error) {
        console.error('❌ Error getting Telegram users:', error.message);
        return [];
    }
}

async function getTelegramUserCount() {
    try {
        return await TelegramUser.countDocuments({});
    } catch (error) {
        console.error('❌ Error counting Telegram users:', error.message);
        return 0;
    }
}

// =================================
// EXPORTS
// =================================
// 🆕 Channel auto-relay mappings (.chnfor) — sourceJid's new posts auto-copy
// to targetJid, set up once instead of forwarding manually every time.
// 🚨 FIX (Bunty: "koi gc mein apni jid list dekhay to mera bhi wohi show
// karwata, koi apni dm mein list dekhe to wohi — har kisi ka alag hona
// chahiye"): .chnfor list had NO per-user scoping at all — every single
// user of the bot saw the exact same global list (including the owner's
// own relays), because addChannelRelay/listChannelRelays never recorded or
// filtered by WHO set a relay up. Every relay now remembers its creator
// (`createdBy`), and listing/removing is scoped to that — matching the
// same per-user pattern already used everywhere else in this bot
// (.antidelete, .setbotname, etc). The actual forwarding logic
// (getRelayTargets, used by main.js when a real post comes in) is
// intentionally left UNSCOPED — the forward itself still has to happen
// for every relay regardless of who configured it; only the
// listing/management view is private per-user.
async function addChannelRelay(sourceJid, targetJid, createdBy) {
    return ChannelRelay.findOneAndUpdate(
        { sourceJid, targetJid },
        { sourceJid, targetJid, createdBy },
        { upsert: true }
    );
}
async function getRelayTargets(sourceJid) {
    const rows = await ChannelRelay.find({ sourceJid });
    return rows.map(r => r.targetJid);
}
async function removeChannelRelay(sourceJid, targetJid, createdBy) {
    // Owner (createdBy === null passed in) can remove any relay; a normal
    // user can only remove one they created themselves.
    const query = createdBy ? { sourceJid, targetJid, createdBy } : { sourceJid, targetJid };
    return ChannelRelay.deleteOne(query);
}
async function listChannelRelays(createdBy) {
    // Passing no createdBy (owner's "list all" view) returns everyone's.
    return ChannelRelay.find(createdBy ? { createdBy } : {});
}

module.exports = {
    connectdb,

    Session,
    UserConfig,
    OTP,
    ActiveNumber,
    Stats,
    TelegramUser,

    saveSessionToMongoDB,
    getSessionFromMongoDB,
    deleteSessionFromMongoDB,

    getUserConfigFromMongoDB,
    updateUserConfigInMongoDB,
    deleteUserConfigFromMongoDB,

    saveOTPToMongoDB,
    verifyOTPFromMongoDB,

    addNumberToMongoDB,
    removeNumberFromMongoDB,
    getMsSinceLastWelcome,
    markWelcomeSent,
    getAllNumbersFromMongoDB,

    incrementStats,
    getStatsForNumber,
    getCommandLeaderboard,
    addChannelRelay,
    getRelayTargets,
    removeChannelRelay,
    listChannelRelays,

    saveTelegramUser,
    getAllTelegramUsers,
    getTelegramUserCount,

    // Old aliases kept for compatibility with any older plugin call sites.
    getUserConfig: async (number) => {
        const config = await getUserConfigFromMongoDB(number);
        return config || {};
    },
    updateUserConfig: updateUserConfigInMongoDB
};

// ᴘᴏᴡᴇʀᴇᴅ ʙʏ ™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 ᥫᩣ
