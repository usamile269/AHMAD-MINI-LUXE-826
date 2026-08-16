// ============================================================================
// data/AIAutoReply.js — settings for the .aibyahmad feature. Simplified
// (Bunty: "storage boht ho raha, sirf DM reply wala on/off rahay") to a
// single flag — every other field (persona, footer, ignore list, hours,
// voice, group mode, known-contacts-only, daily summary) was its own bit
// of data written to Mongo per botNumber; removing them cuts what actually
// gets stored down to the one thing that matters.
// ============================================================================
const jsondb = require('../lib/mongo');

const AIAutoReply = jsondb.model('AIAutoReply');

const DEFAULTS = {
    enabled: false // DM auto-reply
};

const settingsCache = new Map(); // botNumber -> { settings, ts }
const CACHE_TTL_MS = 15000;

async function getAIAutoReplySettings(botNumber) {
    try {
        const cached = settingsCache.get(botNumber);
        if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) return cached.settings;
        const doc = await AIAutoReply.findOne({ botNumber });
        const result = { ...DEFAULTS, ...(doc ? doc.toObject() : {}) };
        settingsCache.set(botNumber, { settings: result, ts: Date.now() });
        return result;
    } catch (e) {
        return { ...DEFAULTS };
    }
}

async function setAIAutoReplySettings(botNumber, update) {
    try {
        await AIAutoReply.findOneAndUpdate({ botNumber }, update, { upsert: true, new: true });
        const cached = settingsCache.get(botNumber);
        settingsCache.set(botNumber, { settings: { ...DEFAULTS, ...(cached ? cached.settings : {}), ...update }, ts: Date.now() });
        return true;
    } catch (e) {
        console.error('AIAutoReply save error:', e.message);
        return false;
    }
}

module.exports = { getAIAutoReplySettings, setAIAutoReplySettings, DEFAULTS };
