const { cmd } = require('../ahmad-core');
const axios = require('axios');
const { gifToVideoGif } = require('../lib/sticker-utils');
const { toFancyBold } = require('../lib/text-style');
const { randomFooter } = require('../lib/menu-styles');

// ══════════════════════════════════════════════════════════════════════════
// 💫 REACTIONS BATCH 2 — 16 more anime reaction gifs, same nekos.best source
// and same send pattern as plugins/reactions.js (video+gifPlayback so the
// caption text rides along with the gif). Only categories that nekos.best
// actually supports AND that don't collide with an existing command pattern
// (checked against the full command list — "kick" and "facepalm" were
// dropped because those pattern names are already used elsewhere).
// ══════════════════════════════════════════════════════════════════════════

const FOOTER = "\n\n> " + randomFooter();

async function getNekoGifUrl(category) {
    const { data } = await axios.get(`https://nekos.best/api/v2/${category}?amount=1`, {
        timeout: 10000, family: 4,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
    });
    const url = data?.results?.[0]?.url;
    if (!url) throw new Error('No GIF found on nekos.best');
    return url;
}

// 🚨 BUG FIX (Bunty: ".shoot / .baka → \"Reaction fetch failed\"") — this
// file only ever tried nekos.best, unlike plugins/reactions.js which has 3
// fallback sources. One source going down (or not having that category)
// meant an instant, guaranteed failure with zero backup. Brought over the
// same otakugifs.xyz + waifu.pics fallback chain already proven working in
// reactions.js.
async function getOtakuGifUrl(category) {
    const { data } = await axios.get(`https://api.otakugifs.xyz/gif`, {
        params: { reaction: category },
        timeout: 12000, family: 4,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
    });
    if (!data?.url) throw new Error('No GIF found on otakugifs');
    return data.url;
}

async function getWaifuPicsGifUrl(category) {
    const { data } = await axios.get(`https://api.waifu.pics/sfw/${category}`, {
        timeout: 12000, family: 4,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
    });
    if (!data?.url) throw new Error('No GIF found on waifu.pics');
    return data.url;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getAnyReactionGif(category) {
    // 🚨 FIX (Bunty: ".blush/.happy/.kiss 100% working, .baka/.lurk fail"
    // — both use the exact same nekos.best endpoint/category names, which
    // ARE valid on nekos.best's own docs, so it isn't a bad-category
    // issue. The screenshots show several of these commands fired back-
    // to-back within the same minute — classic short-window rate-limit
    // territory, where an instant zero-delay retry just re-hits the same
    // limit and fails again immediately. Added a short, increasing delay
    // between retries so a brief rate-limit/hiccup actually has time to
    // clear before trying again, instead of hammering it instantly.
    for (let attempt = 1; attempt <= 2; attempt++) {
        try { return await getNekoGifUrl(category); }
        catch (e) { console.log(`[REACTION2:${category}] nekos.best attempt ${attempt} failed:`, e.message); }
        if (attempt < 2) await sleep(1200);
    }
    // 🚨 FIX (Bunty log: ".baka → otakugifs attempt 1/2 both 400"): a 400
    // here means otakugifs.xyz doesn't have this reaction category at all —
    // that's a permanent fact about this one category, not a fluke.
    // Retrying it again a moment later was guaranteed to 400 again too,
    // just adding delay before falling through to waifu.pics for nothing.
    // Now a 400 skips straight past the retry to the next source.
    try { return await getOtakuGifUrl(category); }
    catch (e) {
        console.log(`[REACTION2:${category}] otakugifs attempt 1 failed:`, e.message);
        if (e.response && e.response.status !== 400) {
            try { return await getOtakuGifUrl(category); }
            catch (e2) { console.log(`[REACTION2:${category}] otakugifs attempt 2 failed:`, e2.message); }
        }
    }
    for (let attempt = 1; attempt <= 2; attempt++) {
        try { return await getWaifuPicsGifUrl(category); }
        catch (e) { console.log(`[REACTION2:${category}] waifu.pics attempt ${attempt} failed:`, e.message); }
        if (attempt < 2) await sleep(1200);
    }
    return null;
}

// 🚨 REPLACED (Bunty: "baka/lurk ab bhi fail, koi aur SFW category laga
// do"): baka and lurk kept failing across all 3 sources even after the
// rate-limit-delay fix — nekos.best 403'd on them specifically while
// identical code for other categories in this same file (pout, stare,
// etc.) has been fine, so something about these two routes specifically
// seems persistently blocked on nekos.best's end, not fixable from here.
// Swapped them out for two other valid, currently-unused nekos.best
// categories (angry, handshake) using the exact same 3-source chain.
const reactions = [
    { pattern: "angry", emoji: "😠", verb: "is angry at" },
    { pattern: "bored", emoji: "😑", verb: "is bored with" },
    { pattern: "feed", emoji: "🍰", verb: "fed" },
    { pattern: "handhold", emoji: "🤝", verb: "is holding hands with" },
    { pattern: "laugh", emoji: "😂", verb: "is laughing at" },
    { pattern: "handshake", emoji: "🤝", verb: "shook hands with" },
    { pattern: "nod", emoji: "🙂", verb: "nodded at" },
    { pattern: "nope", emoji: "🙅", verb: "said nope to" },
    { pattern: "pout", emoji: "😤", verb: "is pouting at" },
    { pattern: "punch", emoji: "👊", verb: "punched" },
    { pattern: "shoot", emoji: "🔫", verb: "(fake) shot" },
    { pattern: "shrug", emoji: "🤷", verb: "shrugged at" },
    { pattern: "sleep", emoji: "😴", verb: "fell asleep on" },
    { pattern: "stare", emoji: "👀", verb: "is staring at" },
    { pattern: "think", emoji: "🤔", verb: "is thinking about" },
    { pattern: "tickle", emoji: "🤭", verb: "tickled" },
];

for (const r of reactions) {
    cmd({
        pattern: r.pattern,
        desc: `${r.emoji} Anime reaction: ${r.pattern}`,
        category: "fun",
        filename: __filename
    }, async (conn, mek, m, { from, q, reply, mentionedJid }) => {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        let imageUrl = null;
        try { imageUrl = await getAnyReactionGif(r.pattern); }
        catch (e) { console.log(`[REACTION2:${r.pattern}] unexpected error:`, e.message); }

        if (!imageUrl) {
            console.log(`[REACTION2:${r.pattern}] all 3 sources failed`);
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            return reply(`❌ Reaction fetch failed (tried 3 sources), try again in a bit.${FOOTER}`);
        }

        const target = (mentionedJid && mentionedJid.length) ? ` @${mentionedJid[0].split('@')[0]}` : (q ? ` ${q}` : '');
        const caption = `${r.emoji} ${r.verb}${target}${FOOTER}`;
        const mentions = (mentionedJid && mentionedJid.length) ? [mentionedJid[0]] : undefined;

        try {
            const res = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 20000, family: 4 });
            const mp4 = await gifToVideoGif(Buffer.from(res.data));
            await conn.sendMessage(from, {
                video: mp4, gifPlayback: true, caption: toFancyBold(caption), mentions
            }, { quoted: mek });
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        } catch (e1) {
            console.log(`[REACTION2:${r.pattern}] gif conversion failed, falling back to direct url:`, e1.message);
            try {
                await conn.sendMessage(from, {
                    video: { url: imageUrl }, gifPlayback: true, caption: toFancyBold(caption), mentions
                }, { quoted: mek });
                await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            } catch (e2) {
                console.log(`[REACTION2:${r.pattern}] fallback also failed:`, e2.message);
                await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
                reply(`❌ Reaction send failed.${FOOTER}`);
            }
        }
    });
}
