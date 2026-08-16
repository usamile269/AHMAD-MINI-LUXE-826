const jsondb = require('../lib/mongo');

// Single row, always keyed 'site'. Stored locally via jsondb — no MongoDB.
const SiteSettings = jsondb.model('SiteSettings');
const KEY = 'site';

const DEFAULTS = {
    botName: '™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 ᥫᩣ',
    welcomeMsg: "Connected Successfully — you're all set!",
    welcomeVideo: '',
    channelLink: 'https://whatsapp.com/channel/0029VbCLBN8EwEk5DUkDta0K',
    bgMusicUrl: 'https://res.cloudinary.com/qdskwzyn/video/upload/v1785497379/AhmadHosting_ms8v1ejbw6v6z0.mp3',
    heroTagline: 'Luxury Cyber-Pink Pairing',
    botImageUrl: 'https://res.cloudinary.com/qdskwzyn/image/upload/v1785495694/AhmadHosting_ms8u1aiw10x6yr.jpg',
    audioPopupEnabled: true
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
