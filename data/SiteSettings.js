const jsondb = require('../lib/mongo');

// Single row, always keyed 'site'. Stored locally via jsondb — no MongoDB.
const SiteSettings = jsondb.model('SiteSettings');
const KEY = 'site';

const DEFAULTS = {
    botName: 'AHMAD-MINI',
    welcomeMsg: "Connected Successfully — you're all set!",
    welcomeVideo: '',
    channelLink: '',
    bgMusicUrl: '',
    heroTagline: 'WhatsApp Pairing',
    // 🆕 FEATURE (Bunty: "songs popup trigger se admin panel se"): when on,
    // an attractive animated "🎵 Enable Sound" popup appears on page load
    // (only if bgMusicUrl is set) instead of the silent toggle button —
    // also doubles as the click-to-satisfy-browser-autoplay-restriction
    // gesture, so the song can actually start playing right away.
    audioPopupEnabled: false
};

async function getSiteSettings() {
    try {
        const doc = await SiteSettings.findOne({ key: KEY });
        return doc ? { ...DEFAULTS, ...doc.data } : { ...DEFAULTS };
    } catch (e) {
        return { ...DEFAULTS };
    }
}

async function setSiteSettings(update) {
    try {
        const current = await getSiteSettings();
        const merged = { ...current, ...update };
        await SiteSettings.findOneAndUpdate({ key: KEY }, { data: merged }, { upsert: true });
        return merged;
    } catch (e) {
        console.error('❌ Error saving site settings:', e.message);
        return null;
    }
}

module.exports = { getSiteSettings, setSiteSettings, DEFAULTS };
