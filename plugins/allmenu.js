const { cmd, commands } = require('../ahmad-core');
const moment = require('moment-timezone');
const config = require('../config');
const { fakevCard } = require('../lib/fakevCard');
const { getUserConfigFromMongoDB } = require('../lib/database');
const { getUserBotSettings } = require('../data/UserBotSettings');
const { renderMenu } = require('../lib/menu-styles');
const { runtime } = require('../lib/functions');
const axios = require('axios');

// 🚀 SPEED FIX (Bunty: "bot ki speed chahiye, fast karo") — the default
// menu image (when the user hasn't set a custom DP) was being downloaded
// from the internet FRESH on every single .menu call, even though it's a
// static image that never changes. Cache it in memory after the first
// successful fetch so every call after that is instant — zero network
// round-trip — instead of repeating an 8s-timeout HTTP fetch every time.
let cachedDefaultMenuImage = null;
// 🚀 Same idea for the grouped-commands breakdown: looping over all ~400+
// registered commands to build the category groupings is pure CPU work
// that gives the exact same result every time (until plugins hot-reload).
// Cache it, only rebuild when the command count actually changes.
let cachedGrouped = null, cachedTotalCommands = 0, cachedCommandsLength = -1;

cmd({
    pattern: 'menu',
    alias: ['commandlist', 'allmenu', 'help', 'cmds'],
    desc: 'Show all bot commands',
    category: 'system',
    react: '📋'
}, async (conn, mek, m, { from, sender, reply, botNumber }) => {
    try {
        await conn.sendMessage(from, { react: { text: '📋', key: m.key } });

        // ✅ Three-level fallback: the PERSON RUNNING .menu's own customization
        // (.setbotname/.setbotdp/.setbotaudio/.menustyle, keyed by their jid)
        // wins first, then the bot-wide default (.globalbotname etc, set by
        // owner), then the hardcoded config.js default. This way one user
        // customizing their own .menu never changes what anyone else sees.
        const [myConfig, userConfig] = await Promise.all([
            getUserBotSettings(sender),
            getUserConfigFromMongoDB(botNumber)
        ]);
        const botName = myConfig.BOT_NAME || userConfig.BOT_NAME || config.BOT_NAME || '™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 ᥫᩣ';

        let totalCommands = 0;
        let grouped = {};
        if (cachedGrouped && cachedCommandsLength === commands.length) {
            grouped = cachedGrouped;
            totalCommands = cachedTotalCommands;
        } else {
            for (const c of commands) {
                if (!c.pattern || !c.category) continue;
                totalCommands++;
                if (!grouped[c.category]) grouped[c.category] = [];
                grouped[c.category].push(c.pattern);
            }
            cachedGrouped = grouped;
            cachedTotalCommands = totalCommands;
            cachedCommandsLength = commands.length;
        }

        const time = moment().tz(config.TIMEZONE || 'Asia/Karachi').format('hh:mm:ss A');
        const date = moment().tz(config.TIMEZONE || 'Asia/Karachi').format('dddd, DD MMMM YYYY');

        const categoryDisplay = {
            'main':      { emoji: '🍹', name: 'Main Menu' },
            'system':    { emoji: '🔧', name: 'System' },
            'settings':  { emoji: '⚙️', name: 'Settings' },
            'owner':     { emoji: '👑', name: 'Owner Zone' },
            'group':     { emoji: '👥', name: 'Group Management' },
            'admin':     { emoji: '🛡️', name: 'Admin Tools' },
            'download':  { emoji: '📥', name: 'Downloader' },
            'downloader':{ emoji: '📥', name: 'Downloader' },
            'sticker':   { emoji: '🎨', name: 'Sticker Maker' },

            'fun':       { emoji: '🎮', name: 'Fun & Games' },
            'general':   { emoji: '📌', name: 'General' },
            'tools':     { emoji: '🧰', name: 'Utility Tools' },
            'recovery':  { emoji: '♻️', name: 'Recovery Zone' },
            'osint':     { emoji: '🕵️', name: 'Network Tools' },
            'cybersec':  { emoji: '🛡️', name: 'Cybersecurity Tips' },

            'search':    { emoji: '🔍', name: 'Search' },
            'ai':        { emoji: '🤖', name: 'AI Tools' },
            'info':      { emoji: 'ℹ️', name: 'Info' },
            'misc':      { emoji: '✨', name: 'Miscellaneous' },
            'bug':       { emoji: '💀', name: 'Ahmad Bug & Ban' }
        };

        // ✅ New info-box fields for the updated menu look.
        const ownerName = userConfig.OWNER_NAME || config.OWNER_NAME || 'Bunty Ahmad';
        const uptime = runtime(process.uptime());
        const mode = config.WORK_TYPE || 'public';

        // 🆕 REMOVED (Bunty: "menustyle system remove, only ek menu rahe") —
        // was previously myConfig.MENU_STYLE || userConfig.MENU_STYLE || 1;
        // now always style 1, no per-user/global override.
        const menu = renderMenu(1, {
            botName,
            ownerName,
            total: totalCommands,
            uptime,
            prefix: config.PREFIX || '.',
            mode,
            grouped,
            categoryDisplay
        });

        // ✅ Send menu with image + channel forward style
        // Custom DP (set via .setbotdp) is stored as base64 -> send as a Buffer.
        // Otherwise fall back to the default hosted image URL.
        const customImageB64 = myConfig.MENU_IMAGE || userConfig.MENU_IMAGE;
        let menuImage;
        if (customImageB64) {
            menuImage = Buffer.from(customImageB64, 'base64');
        } else {
            // 🚨 FIX (Bunty log: "ConnectTimeoutError ... files.catbox.moe:443,
            // timeout: 10000ms" at allmenu.js:94, inside Baileys'
            // sendMessage) — this used to hand Baileys a raw { url }
            // reference and let IT fetch the image internally, with no
            // control over retries if catbox was briefly slow/unreachable —
            // one hiccup meant an instant, unrecoverable "Menu failed to
            // load!". Now the image is fetched ourselves first (same
            // retry-with-delay pattern used elsewhere in the bot), and only
            // the resulting Buffer is handed to Baileys — a transient catbox
            // slowdown now gets a second chance instead of killing .menu.
            const defaultImageUrl = config.MENU_IMAGE || 'https://img.sanishtech.com/u/fe855020e861cd81f6ee7dff32784740.png';
            // 🚨 REMOVED AGAIN (Bunty: "sirf .owner wali video mein catbox
            // chahiye thi, baki se remove karo") — no catbox backup here
            // anymore, just retries on the primary link.
            menuImage = { url: defaultImageUrl };
            if (cachedDefaultMenuImage) {
                menuImage = cachedDefaultMenuImage;
            } else {
                try {
                    let imgRes;
                    try {
                        imgRes = await axios.get(defaultImageUrl, { responseType: 'arraybuffer', timeout: 8000, family: 4 });
                    } catch (e1) {
                        console.log('[MENU] default image fetch attempt 1 failed:', e1.message);
                        await new Promise((res) => setTimeout(res, 1200));
                        imgRes = await axios.get(defaultImageUrl, { responseType: 'arraybuffer', timeout: 8000, family: 4 });
                    }
                    menuImage = Buffer.from(imgRes.data);
                    cachedDefaultMenuImage = menuImage; // cache for every future .menu call
                } catch (e2) {
                    console.log('[MENU] default image fetch failed twice, sending text-only menu instead:', e2.message);
                    menuImage = null;
                }
            }
        }

        const menuMessage = menuImage ? {
            image: menuImage,
            caption: menu,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                mentionedJid: [m.sender],
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.CHANNEL_JID || '120363427856127926@newsletter',
                    newsletterName: botName,
                    serverMessageId: 2,
                },
            },
        } : {
            // Image fetch failed twice — menu still gets delivered as text
            // rather than the whole command failing outright.
            text: menu,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                mentionedJid: [m.sender],
                forwardedNewsletterMessageInfo: {
                    newsletterJid: config.CHANNEL_JID || '120363427856127926@newsletter',
                    newsletterName: botName,
                    serverMessageId: 2,
                },
            },
        };
        await conn.sendMessage(from, menuMessage, { quoted: fakevCard });

        // 🚨 SPEED FIX (Ahmad: ".menu likhtay to dair lgtii"): when nobody
        // has set a custom .setbotaudio, this used to download the SAME
        // default catbox.moe mp3 over the network AND run it through ffmpeg
        // (mp3 -> opus/ogg) on every single .menu call — a full HTTP
        // round-trip plus a CPU transcode, every time, for a file that
        // never changes. That's the real source of the delay, not the menu
        // text itself. Now the transcoded result is cached in memory the
        // first time, and every call after that reuses the same Buffer —
        // instant, no network, no ffmpeg. Only re-fetches if someone sets/
        // clears a custom audio (myConfig/userConfig audio is checked first
        // and always bypasses this cache, same as before).
        let sent = false;
        const customAudioB64 = myConfig.MENU_AUDIO || userConfig.MENU_AUDIO;
        if (!customAudioB64 && global.__defaultMenuVoiceCache) {
            try {
                await conn.sendMessage(from, {
                    audio: global.__defaultMenuVoiceCache.buffer,
                    mimetype: global.__defaultMenuVoiceCache.mimetype,
                    ptt: global.__defaultMenuVoiceCache.ptt
                }, { quoted: fakevCard });
                sent = true;
            } catch { /* fall through to regenerate below */ }
        }

        // ✅ Send voice note after menu
        try {
            if (sent) throw { __skip: true }; // already served from cache above
            const axios = require('axios');
            const fs = require('fs');
            const os = require('os');
            const path = require('path');
            const ffmpeg = require('fluent-ffmpeg');
            const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
            ffmpeg.setFfmpegPath(ffmpegPath);

            let mp3Buffer;
            if (customAudioB64) {
                // Custom song set via .setbotaudio (yours) or .globalbotaudio
                // (owner's bot-wide default) — use it directly, no fetch needed.
                mp3Buffer = Buffer.from(customAudioB64, 'base64');
            } else {
                // 🚨 BUG FIX ("This audio is not available because something is
                // wrong with the audio file"): the catbox.moe download had no
                // User-Agent header — same root cause as the .url 412 issue —
                // so on a blocked/failed request the response body could be an
                // HTML error page instead of actual MP3 bytes. That garbage
                // then got fed straight to ffmpeg/WhatsApp, which is what
                // produced the "wrong with the audio file" error on send.
                const audioRes = await axios.get(
                    config.MENU_AUDIO || 'https://files.catbox.moe/wp1lm1.mp3',
                    {
                        responseType: 'arraybuffer',
                        timeout: 30000,
                        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
                    }
                );
                mp3Buffer = Buffer.from(audioRes.data);
            }

            let audioSent = false;
            const looksLikeAudio = mp3Buffer && mp3Buffer.length > 1000 && (
                mp3Buffer.slice(0, 3).toString('latin1') === 'ID3' ||       // MP3 w/ ID3 tag
                (mp3Buffer[0] === 0xFF && (mp3Buffer[1] & 0xE0) === 0xE0)   // raw MP3 frame sync
            );

            if (!looksLikeAudio) {
                console.log('Menu audio skipped: downloaded file is not valid audio (dead/blocked link).');
                audioSent = true; // skip both send attempts below, but don't touch outer flow
            }

            // Try opus (real voice note bubble)
            if (!audioSent) try {
                const tmpIn = path.join(os.tmpdir(), `menu_in_${Date.now()}.mp3`);
                const tmpOut = path.join(os.tmpdir(), `menu_out_${Date.now()}.ogg`);
                fs.writeFileSync(tmpIn, mp3Buffer);
                await new Promise((resolve, reject) => {
                    ffmpeg(tmpIn)
                        .audioCodec('libopus')
                        .audioBitrate('64k')
                        .audioChannels(1)
                        .format('ogg')
                        .on('end', resolve)
                        .on('error', reject)
                        .save(tmpOut);
                });
                const oggBuffer = fs.readFileSync(tmpOut);
                await conn.sendMessage(from, {
                    audio: oggBuffer,
                    mimetype: 'audio/ogg; codecs=opus',
                    ptt: true
                }, { quoted: fakevCard });
                fs.unlink(tmpIn, () => {});
                fs.unlink(tmpOut, () => {});
                audioSent = true;
                // Cache only the default (non-custom) transcoded audio so the
                // next .menu call anywhere skips the download+transcode entirely.
                if (!customAudioB64) {
                    global.__defaultMenuVoiceCache = { buffer: oggBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true };
                }
            } catch {
                // libopus not available — fallback
            }

            // Fallback: regular audio
            if (!audioSent) {
                await conn.sendMessage(from, {
                    audio: mp3Buffer,
                    mimetype: 'audio/mpeg',
                    ptt: false
                }, { quoted: fakevCard });
                if (!customAudioB64) {
                    global.__defaultMenuVoiceCache = { buffer: mp3Buffer, mimetype: 'audio/mpeg', ptt: false };
                }
            }
        } catch (audioErr) {
            if (!audioErr || !audioErr.__skip) console.log('Menu audio error:', audioErr && audioErr.message);
        }

        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });

    } catch (e) {
        console.error('Menu Error:', e);
        await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
        reply('❌ *Menu failed to load!*');
    }
});

// 🆕 (Bunty: ".menu2 — Minimal Elegant style, graceful") — a second, fully
// independent menu look. Deliberately kept as its own separate command
// (not a shared refactor with .menu above) so .menu itself is never at
// risk of changing — exactly "old wala hi aaye jo already hai".
const { renderMenu2 } = require('../lib/menu-styles');
cmd({
    pattern: 'menu2',
    alias: ['menuelegant', 'minimalmenu'],
    desc: 'Show all bot commands (Minimal Elegant style)',
    category: 'system',
    react: '✨'
}, async (conn, mek, m, { from, sender, reply, botNumber }) => {
    try {
        await conn.sendMessage(from, { react: { text: '✨', key: m.key } });

        const [myConfig, userConfig] = await Promise.all([
            getUserBotSettings(sender),
            getUserConfigFromMongoDB(botNumber)
        ]);
        const botName = myConfig.BOT_NAME || userConfig.BOT_NAME || config.BOT_NAME || 'AHMAD MINI';

        let totalCommands = 0;
        let grouped = {};
        for (const c of commands) {
            if (!c.pattern || !c.category) continue;
            totalCommands++;
            if (!grouped[c.category]) grouped[c.category] = [];
            grouped[c.category].push(c.pattern);
        }

        const categoryDisplay = {
            'main': { emoji: '🍹', name: 'Main Menu' }, 'system': { emoji: '🔧', name: 'System' },
            'settings': { emoji: '⚙️', name: 'Settings' }, 'owner': { emoji: '👑', name: 'Owner Zone' },
            'group': { emoji: '👥', name: 'Group Management' }, 'admin': { emoji: '🛡️', name: 'Admin Tools' },
            'download': { emoji: '📥', name: 'Downloader' }, 'downloader': { emoji: '📥', name: 'Downloader' },
            'sticker': { emoji: '🎨', name: 'Sticker Maker' }, 'fun': { emoji: '🎮', name: 'Fun & Games' },
            'general': { emoji: '📌', name: 'General' }, 'tools': { emoji: '🧰', name: 'Utility Tools' },
            'recovery': { emoji: '♻️', name: 'Recovery Zone' }, 'osint': { emoji: '🕵️', name: 'Network Tools' },
            'cybersec': { emoji: '🛡️', name: 'Cybersecurity Tips' }, 'search': { emoji: '🔍', name: 'Search' },
            'ai': { emoji: '🤖', name: 'AI Tools' }, 'info': { emoji: 'ℹ️', name: 'Info' },
            'misc': { emoji: '✨', name: 'Miscellaneous' }
        };

        const ownerName = userConfig.OWNER_NAME || config.OWNER_NAME || 'Bunty Ahmad';
        const uptime = runtime(process.uptime());

        const menu2 = renderMenu2({
            botName, ownerName, total: totalCommands, uptime,
            prefix: config.PREFIX || '.', grouped, categoryDisplay
        });

        const customImageB64 = myConfig.MENU_IMAGE || userConfig.MENU_IMAGE;
        let menuImage;
        if (customImageB64) {
            menuImage = Buffer.from(customImageB64, 'base64');
        } else {
            const defaultImageUrl = config.MENU_IMAGE || 'https://img.sanishtech.com/u/fe855020e861cd81f6ee7dff32784740.png';
            try {
                let imgRes;
                try {
                    imgRes = await axios.get(defaultImageUrl, { responseType: 'arraybuffer', timeout: 8000, family: 4 });
                } catch (e1) {
                    await new Promise((res) => setTimeout(res, 1200));
                    imgRes = await axios.get(defaultImageUrl, { responseType: 'arraybuffer', timeout: 8000, family: 4 });
                }
                menuImage = Buffer.from(imgRes.data);
            } catch (e2) {
                console.log('[MENU2] default image fetch failed twice, sending text-only:', e2.message);
                menuImage = null;
            }
        }

        const menuMessage = menuImage
            ? { image: menuImage, caption: menu2 }
            : { text: menu2 };
        await conn.sendMessage(from, menuMessage, { quoted: fakevCard });
        await conn.sendMessage(from, { react: { text: '✅', key: m.key } });

    } catch (e) {
        console.error('Menu2 Error:', e);
        await conn.sendMessage(from, { react: { text: '❌', key: m.key } });
        reply('❌ *Menu failed to load!*');
    }
});

// alive
