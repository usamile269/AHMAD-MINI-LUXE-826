const { cmd } = require('../ahmad-core');
const axios = require('axios');
const config = require('../config');
const { randomFooter } = require('../lib/menu-styles');

const NEX_BASE = 'https://api.nexoracle.com';
const NEX_KEY = 'free_key@maher_apis';

function footer() { return `\n\n> ${randomFooter()}`; }

// ==================== TIKTOK (NexOracle fallback) ====================
cmd({
    pattern: "tiktoknx",
    alias: ["ttnx"],
    desc: "🎬 Download TikTok video (NexOracle)",
    category: "download",
    react: "🎬",
    use: ".tiktoknx <tiktok link>",
    filename: __filename
}, async (conn, mek, m, { from, args, reply }) => {
    try {
        const url = args[0];
        if (!url || !url.includes("tiktok.com")) return reply("❌ Use: .tiktoknx <tiktok link>");

        await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

        const res = await axios.get(`${NEX_BASE}/downloader/tiktok-wm`, {
            params: { apikey: NEX_KEY, url },
            timeout: 25000
        });

        const result = res.data?.result;
        if (result && (result.video || result.play)) {
            await conn.sendMessage(from, {
                video: { url: result.video || result.play },
                caption: `╭═══ 🎬 TIKTOK ═══⊷\n┃❃│ ${result.title || 'No title'}\n╰═════════════════⊷${footer()}`
            }, { quoted: mek });
            await conn.sendMessage(from, { react: { text: "✅", key: m.key } });
        } else {
            reply("❌ Could not fetch this TikTok video. Try .tiktokdl instead.");
        }
    } catch (e) {
        console.log("TIKTOKNX ERROR:", e.message);
        reply("❌ Error found. Try .tiktokdl instead.");
    }
});

// ==================== INSTAGRAM (NexOracle) ====================
cmd({
    pattern: "instanx",
    alias: ["ignx"],
    desc: "📸 Download Instagram reel/post (NexOracle)",
    category: "download",
    react: "📸",
    use: ".instanx <instagram link>",
    filename: __filename
}, async (conn, mek, m, { from, args, reply }) => {
    try {
        const url = args[0];
        if (!url || !url.includes("instagram.com")) return reply("❌ Use: .instanx <instagram link>");

        await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

        const res = await axios.get(`${NEX_BASE}/downloader/insta`, {
            params: { apikey: NEX_KEY, url },
            timeout: 25000
        });

        const result = res.data?.result;
        if (result && result.length) {
            const media = result[0];
            const type = media.type === 'video' ? 'video' : 'image';
            await conn.sendMessage(from, {
                [type]: { url: media.url },
                caption: `╭═══ 📸 INSTAGRAM ═══⊷\n╰═════════════════⊷${footer()}`
            }, { quoted: mek });
            await conn.sendMessage(from, { react: { text: "✅", key: m.key } });
        } else {
            reply("❌ Could not fetch this Instagram content. Try .igdl instead.");
        }
    } catch (e) {
        console.log("INSTANX ERROR:", e.message);
        reply("❌ Error found. Try .igdl instead.");
    }
});

// ==================== TWITTER/X (NexOracle) ====================
cmd({
    pattern: "twitternx",
    alias: ["xdl", "twdl"],
    desc: "🐦 Download Twitter/X video (NexOracle)",
    category: "download",
    react: "🐦",
    use: ".twitternx <twitter/x link>",
    filename: __filename
}, async (conn, mek, m, { from, args, reply }) => {
    try {
        const url = args[0];
        if (!url || (!url.includes("twitter.com") && !url.includes("x.com"))) {
            return reply("❌ Use: .twitternx <twitter/x link>");
        }

        await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

        const res = await axios.get(`${NEX_BASE}/downloader/twitter`, {
            params: { apikey: NEX_KEY, url },
            timeout: 25000
        });

        const result = res.data?.result;
        if (result && (result.video || result.hd || result.sd)) {
            const videoUrl = result.hd || result.video || result.sd;
            await conn.sendMessage(from, {
                video: { url: videoUrl },
                caption: `╭═══ 🐦 TWITTER/X ═══⊷\n╰═════════════════⊷${footer()}`
            }, { quoted: mek });
            await conn.sendMessage(from, { react: { text: "✅", key: m.key } });
        } else {
            reply("❌ Could not fetch this Twitter/X video.");
        }
    } catch (e) {
        console.log("TWITTERNX ERROR:", e.message);
        reply("❌ Error found. Please check the link and try again.");
    }
});
