const { cmd } = require('../ahmad-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const config = require('../config');
const { fakevCard } = require('../lib/fakevCard');
const { randomFooter } = require('../lib/menu-styles');

const FOOTER = '> ' + randomFooter();
const TENOR_KEY = config.TENOR_KEY || 'AIzaSyAyimkuYQYF_FXVALexPuGQctUWRURdCYQ';
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

function chanCtx() {
    return {
        forwardingScore: 999, isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: config.CHANNEL_JID || '120363427856127926@newsletter',
            newsletterName: config.BOT_NAME || '™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 ᥫᩣ',
            serverMessageId: 2
        }
    };
}

// GIF → Animated WebP sticker converter
async function gifToSticker(gifUrl) {
    const res = await axios.get(gifUrl, { responseType: 'arraybuffer', timeout: 20000 });
    const inPath = path.join(tmpdir(), `stk_${Date.now()}.gif`);
    const outPath = path.join(tmpdir(), `stk_${Date.now()}.webp`);
    fs.writeFileSync(inPath, Buffer.from(res.data));
    await new Promise((resolve, reject) => {
        ffmpeg(inPath)
            .addOutputOptions([
                '-vcodec', 'libwebp',
                '-vf', "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0,split[a][b];[a]palettegen=reserve_transparent=on:transparency_color=ffffff[p];[b][p]paletteuse",
                '-loop', '0', '-preset', 'default', '-an', '-vsync', '0'
            ])
            .on('end', resolve).on('error', reject)
            .save(outPath);
    });
    const buf = fs.readFileSync(outPath);
    try { fs.unlinkSync(inPath); fs.unlinkSync(outPath); } catch {}
    return buf;
}

// 🚨 RELIABILITY FIX ("GIF sources unreachable" on .sad, .ok, etc): Tenor
// and Giphy below both use SHARED public keys used by tons of other bots —
// they get rate-limited/exhausted constantly, which is why sticker commands
// kept failing outright. nekos.best needs NO API key at all (not shared,
// not rate-limited the same way, 99.9% uptime per their own docs) and has
// dedicated anime-reaction categories that match these sticker commands
// almost 1:1 (cry, hug, dance, slap, wink, laugh, etc) — so it's tried
// FIRST now, with Tenor/Giphy kept as backups if it's ever down.
async function getNekoGif(category) {
    const res = await axios.get(`https://nekos.best/api/v2/${category}?amount=1`, { timeout: 10000 });
    const results = res.data?.results || [];
    if (!results.length || !results[0].url) throw new Error('No GIF found on nekos.best');
    return results[0].url;
}

// Fetch GIF from otakugifs.xyz — no API key needed, not shared/rate-limited
async function getOtakuGif(reaction) {
    const res = await axios.get(`https://api.otakugifs.xyz/gif?reaction=${encodeURIComponent(reaction)}`, { timeout: 10000 });
    if (!res.data?.url) throw new Error('No GIF found on otakugifs');
    return res.data.url;
}

// Fetch GIF from Tenor
async function getTenorGif(query) {
    const res = await axios.get(`https://tenor.googleapis.com/v2/search?q=${encodeURIComponent(query)}&key=${TENOR_KEY}&limit=8&media_filter=gif`, { timeout: 10000 });
    const results = res.data?.results || [];
    if (!results.length) throw new Error('No GIF found');
    const random = results[Math.floor(Math.random() * results.length)];
    return random.media_formats?.gif?.url || random.media_formats?.tinygif?.url;
}

// 🚨 BUG FIX ("stickers don't come at all"): the shared/default TENOR_KEY is
// public and used by many bots, so it hits Tenor's rate limit constantly —
// every sticker command failed the moment that happened, with no working
// backup source. Giphy's long-standing public beta key ('dc6zaTOxFJmzC',
// documented in Giphy's own API docs for exactly this kind of testing/demo
// use) acts as a second, independent source: if Tenor fails for any reason,
// this is tried before giving up entirely.
async function getGiphyGif(query) {
    const res = await axios.get(`https://api.giphy.com/v1/gifs/search?q=${encodeURIComponent(query)}&api_key=dc6zaTOxFJmzC&limit=8&rating=g`, { timeout: 10000 });
    const results = res.data?.data || [];
    if (!results.length) throw new Error('No GIF found on Giphy either');
    const random = results[Math.floor(Math.random() * results.length)];
    return random.images?.original?.url || random.images?.downsized?.url;
}

async function getAnyGif(query, nekoCategory) {
    if (nekoCategory) {
        try {
            return await getNekoGif(nekoCategory);
        } catch (e) {
            console.log(`[STICKER] nekos.best failed ("${e.message}"), trying otakugifs...`);
        }
        try {
            return await getOtakuGif(nekoCategory);
        } catch (e) {
            console.log(`[STICKER] otakugifs failed ("${e.message}"), trying Giphy...`);
        }
    }
    // 🚨 FIX (Bunty: "Funny Sticker failed — GIF sources are unreachable"):
    // Tenor used to be tried here before Giphy. Google fully discontinued
    // the public Tenor API — new API keys stopped Jan 13 2026 and existing
    // integrations were cut off June 30 2026, which has already passed.
    // Every request to it now fails outright, so it was just adding a
    // guaranteed ~10s dead wait on EVERY sticker command before the real
    // fallback (Giphy) ever got a chance to run. Removed entirely — goes
    // straight to Giphy now.
    return await getGiphyGif(query);
}

// Generic sticker sender
// 🚨 BUG FIX (".ok" / other sticker cmds "no response"): every failure path
// here used to end in just a ❌ reaction with no text — easy to miss
// entirely, and no console log either, so there was no way to tell WHY it
// failed. Root cause is almost always the shared default TENOR_KEY (used by
// many bots publicly) hitting Tenor's rate limit. Now logs the real reason
// and always sends a visible text reply on total failure.
async function sendSticker(conn, from, mek, query, label, nekoCategory) {
    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
    try {
        const gifUrl = await getAnyGif(query, nekoCategory);
        const webp = await gifToSticker(gifUrl);
        // isAnimated:true — see the .sticker command fix in more-tools.js for
        // why this is needed for the sticker to actually play, not just sit
        // as a still frame.
        await conn.sendMessage(from, { sticker: webp, isAnimated: true }, { quoted: fakevCard });
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e1) {
        console.log(`[STICKER "${label}"] sticker conversion failed:`, e1.message);
        // Fallback: send as GIF image
        try {
            const gifUrl = await getAnyGif(query, nekoCategory);
            await conn.sendMessage(from, {
                video: { url: gifUrl }, gifPlayback: true,
                caption: `${label}\n\n${FOOTER}`
            }, { quoted: fakevCard });
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        } catch (e2) {
            console.log(`[STICKER "${label}"] GIF fallback also failed:`, e2.message);
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            await conn.sendMessage(from, {
                text: `❌ ${label} failed — GIF sources are unreachable right now. Try again in a bit.\n\n${FOOTER}`
            }, { quoted: mek });
        }
    }
}

// ══════════════════════════════════
// ★ STICKER PACKS (20 cmds)
// ══════════════════════════════════

const stickerCmds = [
    { pattern: 'funnysticker',    alias: ['funny', 'lol'],      query: 'funny meme reaction',      emoji: '😂', label: '😂 Funny Sticker',     neko: 'teehee' },
    { pattern: 'sadsticker',      alias: ['sad', 'crying'],     query: 'sad anime cry',             emoji: '😢', label: '😢 Sad Sticker',       neko: 'cry' },
    { pattern: 'happysticker',    alias: ['yay'],               query: 'happy celebration anime',   emoji: '😊', label: '😊 Happy Sticker',     neko: 'happy' },
    { pattern: 'angersticker',    alias: ['mad'],      query: 'angry anime mad',           emoji: '😡', label: '😡 Angry Sticker',     neko: 'angry' },
    { pattern: 'lovingsticker',   alias: ['love', 'heart'],     query: 'love heart anime cute',     emoji: '❤️', label: '❤️ Love Sticker',      neko: 'kiss' },
    { pattern: 'surprisedsticker',alias: ['surprised', 'omg'],  query: 'surprised shocked anime',   emoji: '😱', label: '😱 Surprised Sticker', neko: 'shocked' },
    { pattern: 'sleepysticker',   alias: ['sleepy', 'tired'],   query: 'sleepy tired anime',        emoji: '😴', label: '😴 Sleepy Sticker',    neko: 'yawn' },
    { pattern: 'dancesticker',    alias: ['dancing'],           query: 'dancing anime celebration', emoji: '💃', label: '💃 Dance Sticker',     neko: 'dance' },
    { pattern: 'facepalm',        alias: ['fp', 'smh'],         query: 'facepalm anime reaction',   emoji: '🤦', label: '🤦 Facepalm Sticker',  neko: 'facepalm' },
    { pattern: 'hugsticker',      alias: ['hugs'],              query: 'anime hug cute',            emoji: '🤗', label: '🤗 Hug Sticker',       neko: 'hug' },
    { pattern: 'cryingsticker',   alias: ['sobbing', 'weep'],   query: 'anime sobbing cry tears',   emoji: '😭', label: '😭 Crying Sticker',    neko: 'cry' },
    // 🚨 BUG FIX (Ahmad: full-bot scan) — 'laugh' and 'bored' were also used
    // as aliases here, but reactions-batch2.js already uses those EXACT
    // names as its own PRIMARY command (.laugh = reaction GIF, .bored =
    // reaction GIF). Two commands sharing one name means whichever plugin
    // loaded later silently won and the other became unreachable. Dropped
    // here since .laughsticker/.boredsticker still work fine under their
    // own full names + the remaining alias (haha/meh).
    { pattern: 'laughsticker',    alias: ['haha'],     query: 'laughing rolling anime',    emoji: '🤣', label: '🤣 Laugh Sticker',     neko: 'laugh' },
    { pattern: 'boredsticker',    alias: ['meh'],      query: 'bored anime meh',           emoji: '😑', label: '😑 Bored Sticker',     neko: 'bored' },
    { pattern: 'winksticker',     alias: ['winky'],             query: 'wink anime cute',           emoji: '😉', label: '😉 Wink Sticker',      neko: 'wink' },
    { pattern: 'ggsticker',       alias: ['gg', 'respect'],     query: 'respect anime gg',          emoji: '🫡', label: '🫡 GG Sticker',        neko: 'salute' },
    { pattern: 'slapsticker',     alias: ['hit'],               query: 'anime slap funny',          emoji: '👋', label: '👋 Slap Sticker',      neko: 'slap' },
    { pattern: 'nerdsticker',     alias: ['nerd', 'smart'],     query: 'nerd glasses anime',        emoji: '🤓', label: '🤓 Nerd Sticker',      neko: 'think' },
    { pattern: 'coolsticker',     alias: ['cool', 'drip'],      query: 'cool swag anime sunglasses',emoji: '😎', label: '😎 Cool Sticker',      neko: 'smug' },
    { pattern: 'confusedsticker', alias: ['confused', 'huh'],   query: 'confused anime reaction',   emoji: '😕', label: '😕 Confused Sticker',  neko: 'confused' },
    { pattern: 'thumbsup',        alias: ['gud', 'nice', 'ok'], query: 'thumbs up anime good',      emoji: '👍', label: '👍 Thumbs Up Sticker', neko: 'thumbsup' }
];

for (const s of stickerCmds) {
    cmd({ pattern: s.pattern, alias: s.alias, desc: `${s.label} GIF sticker`, category: 'sticker', react: s.emoji },
    async (conn, mek, m, { from }) => {
        await sendSticker(conn, from, mek, s.query, s.label, s.neko);
    });
}

