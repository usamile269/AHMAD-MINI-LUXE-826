// ============================================================================
// plugins/downloader-batch2.js — Threads + Likee downloaders.
// Approach: fetch the PUBLIC post page HTML and read its own og:video /
// og:image meta tags (the same data the site serves to WhatsApp/Facebook
// link-preview bots). No third-party "downloader API" middleman involved,
// so there's no undocumented endpoint to guess at or that can go down —
// only the platform's own public page has to keep working, same as it
// would for a normal browser visit.
// ============================================================================

const { cmd } = require('../ahmad-core');
const axios = require('axios');
const { randomFooter } = require('../lib/menu-styles');

const FOOTER = "\n\n> " + randomFooter();
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchHtml(url) {
    const { data: html } = await axios.get(url, { timeout: 20000, headers: { 'User-Agent': UA } });
    return html;
}

function extractMeta(html, props) {
    const propList = Array.isArray(props) ? props : [props];
    for (const prop of propList) {
        const re = new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, 'i');
        const match = html.match(re) || html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, 'i'));
        if (match) return match[1];
    }
    return null;
}

cmd({
    pattern: 'threads',
    alias: ['threadsdl'],
    desc: '🧵 Download a public Threads post (video/image)',
    category: 'download',
    use: '.threads <threads.net post link>',
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q || !q.includes('threads.net') && !q.includes('threads.com')) return reply(`❌ Usage: .threads <threads.net post link>${FOOTER}`);
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        // 🚀 SPEED FIX: this used to fetch the same page 2-3 times (once per
        // meta-tag lookup). One fetch now, all tags read from that single HTML.
        const html = await fetchHtml(q);
        const video = extractMeta(html, ['og:video', 'og:video:secure_url']);
        const image = extractMeta(html, 'og:image');
        if (video) {
            await conn.sendMessage(from, { video: { url: video }, caption: `🧵 *Threads*${FOOTER}` }, { quoted: mek });
        } else if (image) {
            await conn.sendMessage(from, { image: { url: image }, caption: `🧵 *Threads*${FOOTER}` }, { quoted: mek });
        } else {
            return reply(`❌ Couldn't find media on that post — it may be private or text-only.${FOOTER}`);
        }
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e) {
        console.log('[THREADS DL] error:', e.message);
        reply(`❌ Download failed: ${e.message}${FOOTER}`);
    }
});

cmd({
    pattern: 'likee',
    alias: ['likeedl'],
    desc: '🎥 Download a public Likee video',
    category: 'download',
    use: '.likee <likee.video link>',
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q || !q.includes('likee')) return reply(`❌ Usage: .likee <likee.video link>${FOOTER}`);
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const html = await fetchHtml(q);
        const video = extractMeta(html, ['og:video', 'og:video:url']);
        if (!video) return reply(`❌ Couldn't find a video on that link — it may be private or removed.${FOOTER}`);
        await conn.sendMessage(from, { video: { url: video }, caption: `🎥 *Likee*${FOOTER}` }, { quoted: mek });
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e) {
        console.log('[LIKEE DL] error:', e.message);
        reply(`❌ Download failed: ${e.message}${FOOTER}`);
    }
});
