const { cmd } = require('../ahmad-core');
const axios = require('axios');
const { randomFooter, renderError } = require('../lib/menu-styles');

// 🆕 (Ahmad tested each of these live and confirmed which ones actually work
// before asking for this file — see the working-apis.md reference doc).
// Only the CONFIRMED-WORKING endpoints from this provider are wired up here.
// Deliberately NOT added: tiktoksearch, tiktokstalk, lyrics — plugins/felix-apis.js
// already registers commands with these exact same pattern names using a
// different provider; adding them again here would silently overwrite one
// or the other in ahmad-core's commandMap depending on plugin load order.
// Also not added: dalle, bible-ai, cohere, yta, ytvi, ytplay, pinterest,
// spotifysearch, ocr, txt2img — all confirmed broken/unreliable on this
// provider during testing (pinterest in particular ignores the `q` param
// entirely and always returns the same cached results, regardless of query).
const BASE = "https://r-bots-free-apis.co08.art/api/v1/api";

async function safeGet(path, params, timeout = 20000) {
    const { data } = await axios.get(`${BASE}${path}`, { params, timeout });
    return data;
}

// ==================== AI CHAT (multiple models) ====================
cmd({
    pattern: "gptlogic",
    alias: ["aichat2"],
    desc: "🤖 AI chat (gptlogic model)",
    category: "ai",
    use: ".gptlogic <question>",
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    const q = args.join(' ').trim();
    if (!q) return reply(renderError('Give me something to ask. Use: .gptlogic <question>'));
    try {
        const data = await safeGet('/gptlogic', { q, prompt: 'be friendly' });
        reply(`${data?.response || 'No response.'}\n\n> ${randomFooter()}`);
    } catch (e) {
        reply(renderError('AI request failed. Try again later.'));
    }
});

cmd({
    pattern: "copilot",
    desc: "🤖 AI chat (Copilot model)",
    category: "ai",
    use: ".copilot <question>",
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    const q = args.join(' ').trim();
    if (!q) return reply(renderError('Give me something to ask. Use: .copilot <question>'));
    try {
        const data = await safeGet('/copilot', { text: q });
        reply(`${data?.results?.text || 'No response.'}\n\n> ${randomFooter()}`);
    } catch (e) {
        reply(renderError('AI request failed. Try again later.'));
    }
});

cmd({
    pattern: "qwen",
    desc: "🤖 AI chat (Qwen model)",
    category: "ai",
    use: ".qwen <question>",
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    const q = args.join(' ').trim();
    if (!q) return reply(renderError('Give me something to ask. Use: .qwen <question>'));
    try {
        const data = await safeGet('/qwen', { q });
        // 🚨 FIX: this model's raw response includes its own internal
        // <think>...</think> reasoning block before the real answer —
        // confirmed during testing. Strip it so only the actual reply shows.
        const cleaned = String(data?.response || '').replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
        reply(`${cleaned || 'No response.'}\n\n> ${randomFooter()}`);
    } catch (e) {
        reply(renderError('AI request failed. Try again later.'));
    }
});

cmd({
    pattern: "llamameta",
    alias: ["llama"],
    desc: "🤖 AI chat (Llama 3.1 model)",
    category: "ai",
    use: ".llamameta <question>",
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    const q = args.join(' ').trim();
    if (!q) return reply(renderError('Give me something to ask. Use: .llamameta <question>'));
    try {
        const data = await safeGet('/llama-meta', { q });
        reply(`${data?.response || 'No response.'}\n\n> ${randomFooter()}`);
    } catch (e) {
        reply(renderError('AI request failed. Try again later.'));
    }
});

cmd({
    pattern: "gpt5",
    desc: "🤖 AI chat (GPT-5 model)",
    category: "ai",
    use: ".gpt5 <question>",
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    const q = args.join(' ').trim();
    if (!q) return reply(renderError('Give me something to ask. Use: .gpt5 <question>'));
    try {
        const data = await safeGet('/gpt-5', { q });
        reply(`${data?.results || 'No response.'}\n\n> ${randomFooter()}`);
    } catch (e) {
        reply(renderError('AI request failed. Try again later.'));
    }
});

// ==================== AI TEXT DETECTOR ====================
cmd({
    pattern: "aidetector",
    desc: "🔍 Check if text was likely written by AI",
    category: "tools",
    use: ".aidetector <text>",
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    const q = args.join(' ').trim();
    if (!q) return reply(renderError('Give me some text to check. Use: .aidetector <text>'));
    try {
        const data = await safeGet('/ai-detector', { q });
        reply(`🔍 AI-likelihood: *${data?.message?.percentage}%*\n\n> ${randomFooter()}`);
    } catch (e) {
        reply(renderError('Detector request failed. Try again later.'));
    }
});

// ==================== FACEBOOK VIDEO DOWNLOADER ====================
cmd({
    pattern: "fbvideo",
    alias: ["fb2dl"],
    desc: "📥 Download a Facebook video (alt source)",
    category: "download",
    use: ".fbvideo <facebook link>",
    filename: __filename
}, async (conn, mek, m, { args, reply, from }) => {
    const url = args[0];
    if (!url || !url.includes('facebook.com')) return reply(renderError('Give me a valid Facebook link. Use: .fbdl <link>'));
    try {
        const data = await safeGet('/facebook', { url }, 40000);
        const media = data?.result?.media?.[0];
        if (!media) return reply(renderError('Could not fetch that video — link may be private or invalid.'));
        await conn.sendMessage(from, { video: { url: media }, caption: `> ${randomFooter()}` }, { quoted: mek });
    } catch (e) {
        reply(renderError('Download failed. Try again later.'));
    }
});

// ==================== GITHUB REPO CLONE/DOWNLOAD LINK ====================
cmd({
    pattern: "gitclone",
    desc: "📦 Get a downloadable zip link for a GitHub repo",
    category: "tools",
    use: ".gitclone <github repo url>",
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    const url = args[0];
    if (!url || !url.includes('github.com')) return reply(renderError('Give me a valid GitHub repo link. Use: .gitclone <url>'));
    try {
        const data = await safeGet('/gitclone', { url });
        if (!data?.success) return reply(renderError('Could not fetch that repo — check the link.'));
        reply(`📦 *${data.repository}*\n🔗 ${data.download_url}\n📄 ${data.filename}\n\n> ${randomFooter()}`);
    } catch (e) {
        reply(renderError('Request failed. Try again later.'));
    }
});

// ==================== YOUTUBE SEARCH ====================
cmd({
    pattern: "ytsearch",
    alias: ["yts"],
    desc: "🔍 Search YouTube videos",
    category: "search",
    use: ".ytsearch <query>",
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    const q = args.join(' ').trim();
    if (!q) return reply(renderError('Give me something to search. Use: .ytsearch <query>'));
    try {
        const data = await safeGet('/yts', { q });
        const results = (data?.result || []).slice(0, 8);
        if (!results.length) return reply(renderError('No results found.'));
        const lines = results.map((r, i) => `${i + 1}. ${r.title}\n   ⏱️ ${r.timestamp} · 👁️ ${r.views} · 🔗 ${r.url}`).join('\n\n');
        reply(`🔍 *YouTube results for:* ${q}\n\n${lines}\n\n> ${randomFooter()}`);
    } catch (e) {
        reply(renderError('Search failed. Try again later.'));
    }
});

// ==================== LYRICS SEARCH (multi-match) ====================
cmd({
    pattern: "lyricsearch",
    desc: "🎵 Search for lyrics (multiple matches)",
    category: "search",
    use: ".lyricsearch <song name>",
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    const q = args.join(' ').trim();
    if (!q) return reply(renderError('Give me a song name. Use: .lyricsearch <song>'));
    try {
        const data = await safeGet('/lyrics2', { q });
        const results = Array.isArray(data) ? data : [];
        if (!results.length) return reply(renderError('No lyrics found for that.'));
        const top = results[0];
        reply(`🎵 *${top.title}* — ${top.artist}\n\n${top.lyric}\n\n> ${randomFooter()}`);
    } catch (e) {
        reply(renderError('Lyrics search failed. Try again later.'));
    }
});

// ==================== RANDOM IMAGE ====================
cmd({
    pattern: "randompic",
    desc: "🖼️ Get a random image",
    category: "fun",
    filename: __filename
}, async (conn, mek, m, { reply, from }) => {
    try {
        // 🚨 NOTE: this provider's response field is spelled "responce" (typo
        // in their API, not ours) — confirmed during testing.
        const data = await safeGet('/randomimage', {});
        const url = data?.responce;
        if (!url) return reply(renderError('Could not fetch an image right now.'));
        await conn.sendMessage(from, { image: { url }, caption: `> ${randomFooter()}` }, { quoted: mek });
    } catch (e) {
        reply(renderError('Request failed. Try again later.'));
    }
});

// ==================== RANDOM QUOTE ====================
cmd({
    pattern: "rquote2",
    desc: "💭 Random quote",
    category: "fun",
    filename: __filename
}, async (conn, mek, m, { reply }) => {
    try {
        const data = await safeGet('/randomquotes', {});
        reply(`💭 ${data?.quotes || 'No quote found.'}\n\n> ${randomFooter()}`);
    } catch (e) {
        reply(renderError('Request failed. Try again later.'));
    }
});

// ==================== RANDOM FACT ====================
cmd({
    pattern: "fact2",
    desc: "📚 Random fact (alt source)",
    category: "fun",
    filename: __filename
}, async (conn, mek, m, { reply }) => {
    try {
        const data = await safeGet('/facts', {});
        reply(`📚 ${data?.fact || 'No fact found.'}\n\n> ${randomFooter()}`);
    } catch (e) {
        reply(renderError('Request failed. Try again later.'));
    }
});
