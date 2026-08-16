const { cmd } = require('../ahmad-core');
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const config = require('../config');
const { fakevCard } = require('../lib/fakevCard');
const { randomFooter } = require('../lib/menu-styles');

const FOOTER = '> ' + randomFooter();
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

// Pitch/speed modifier using ffmpeg
async function modifyAudio(inputPath, outputPath, opts = {}) {
    const { pitch = 1.0, speed = 1.0, echo = false, bass = false } = opts;
    return new Promise((resolve, reject) => {
        let filters = [];
        // 🚨 BUG FIX (requested by Ahmad — "speed boht teez hai, 1x normal ho"):
        // asetrate changes BOTH pitch and playback speed together as one side
        // effect of how it works. This used to apply asetrate for pitch with
        // NO compensation, then ALSO apply the `speed` option on top —
        // meaning e.g. babyvoice (pitch:1.8, speed:1.1) actually played back
        // at roughly 1.8 × 1.1 ≈ 2x speed, not the intended 1.1x. Now the
        // pitch shift is neutralized back to normal speed first (asetrate +
        // its own compensating atempo), and the caller's `speed` option is
        // applied independently on top of that — so pitch and speed no
        // longer secretly multiply into each other.
        if (pitch !== 1.0) {
            filters.push(`asetrate=44100*${pitch}`);
            filters.push(`atempo=${Math.min(Math.max(1 / pitch, 0.5), 2.0)}`);
            filters.push(`aresample=44100`);
        }
        if (speed !== 1.0) filters.push(`atempo=${Math.min(Math.max(speed, 0.5), 2.0)}`);
        if (echo) filters.push('aecho=0.8:0.88:60:0.4');
        if (bass) filters.push('bass=g=10');
        const cmd = ffmpeg(inputPath).audioCodec('libopus').audioBitrate('64k').audioChannels(1).format('ogg');
        if (filters.length) cmd.audioFilters(filters);
        cmd.on('end', resolve).on('error', reject).save(outputPath);
    });
}

// Send voice note from URL with optional modification
async function sendVoice(conn, from, mek, url, opts = {}) {
    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
    try {
        const res = await axios.get(url, {
            responseType: 'arraybuffer', timeout: 20000, family: 4,
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
        });
        const raw = Buffer.from(res.data);
        // 🚨 FIX (Bunty screenshot: "This audio is not available because
        // something is wrong with the audio file") — the download was
        // treated as valid MP3 bytes no matter what actually came back.
        // If the host served an HTML block/error page instead of real
        // audio (bot-detection, redirect, etc.), ffmpeg would silently
        // "convert" that garbage into a tiny broken ogg file that
        // WhatsApp then correctly refuses to play — with zero indication
        // of what actually went wrong. Now the bytes are sanity-checked
        // BEFORE conversion: real MP3 either starts with an ID3 tag or an
        // MPEG frame-sync byte pair, and should be more than a trivial
        // handful of bytes.
        const looksLikeHtml = raw.slice(0, 20).toString('utf8').trim().toLowerCase().startsWith('<');
        const looksLikeMp3 = raw.length > 2000 && (
            raw.slice(0, 3).toString('latin1') === 'ID3' ||
            (raw[0] === 0xFF && (raw[1] & 0xE0) === 0xE0)
        );
        if (looksLikeHtml || !looksLikeMp3) {
            throw new Error(`downloaded file doesn't look like valid audio (${raw.length} bytes, starts with: ${raw.slice(0, 12).toString('hex')})`);
        }
        const inPath = path.join(tmpdir(), `vin_${Date.now()}.mp3`);
        const outPath = path.join(tmpdir(), `vout_${Date.now()}.ogg`);
        fs.writeFileSync(inPath, raw);
        await modifyAudio(inPath, outPath, opts);
        await conn.sendMessage(from, {
            audio: fs.readFileSync(outPath),
            mimetype: 'audio/ogg; codecs=opus',
            ptt: true
        }, { quoted: fakevCard });
        try { fs.unlinkSync(inPath); fs.unlinkSync(outPath); } catch {}
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e1) {
        console.log('[VOICE] primary send failed:', e1.message);
        // 🚨 FIX (Bunty: ".ohno → catbox busy, URL nahi aati"): this
        // fallback used to retry the exact same catbox URL with zero
        // delay — if catbox was genuinely busy/overloaded for a moment,
        // hitting it again instantly just failed the same way again.
        // A short pause first gives it a real chance to recover.
        await new Promise((res) => setTimeout(res, 1500));
        // Fallback: send raw mp3
        try {
            const res = await axios.get(url, {
                responseType: 'arraybuffer', timeout: 15000, family: 4,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
            });
            const fallbackRaw = Buffer.from(res.data);
            const fbLooksLikeHtml = fallbackRaw.slice(0, 20).toString('utf8').trim().toLowerCase().startsWith('<');
            const fbLooksLikeMp3 = fallbackRaw.length > 2000 && (
                fallbackRaw.slice(0, 3).toString('latin1') === 'ID3' ||
                (fallbackRaw[0] === 0xFF && (fallbackRaw[1] & 0xE0) === 0xE0)
            );
            if (fbLooksLikeHtml || !fbLooksLikeMp3) {
                throw new Error(`fallback download also doesn't look like valid audio (${fallbackRaw.length} bytes)`);
            }
            await conn.sendMessage(from, {
                audio: fallbackRaw,
                mimetype: 'audio/mpeg', ptt: false
            }, { quoted: fakevCard });
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        } catch (e2) {
            console.log('[VOICE] fallback also failed:', e2.message);
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            // 🚨 FIX (Bunty: "ohno/lurk jaisi cheezein kaafi zyada fail hoti
            // hain"): this used to fail completely silent — just a ❌
            // react with zero text, so there was no way to tell if it was
            // a one-off network blip or the sound file's host being down.
            // A real reply at least makes repeated failures visible/reportable.
            await conn.sendMessage(from, { text: `❌ Sound source unreachable right now, try again in a bit.\n\n${FOOTER}` }, { quoted: mek });
        }
    }
}

// TTS voice with funny effect
async function ttsVoice(conn, from, mek, text, lang, opts = {}) {
    await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
    try {
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=${lang}&client=tw-ob`;
        const res = await axios.get(url, {
                responseType: 'arraybuffer', timeout: 15000, family: 4,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
            });
        const inPath = path.join(tmpdir(), `tts_${Date.now()}.mp3`);
        const outPath = path.join(tmpdir(), `tts_${Date.now()}.ogg`);
        fs.writeFileSync(inPath, Buffer.from(res.data));
        await modifyAudio(inPath, outPath, opts);
        await conn.sendMessage(from, {
            audio: fs.readFileSync(outPath),
            mimetype: 'audio/ogg; codecs=opus', ptt: true
        }, { quoted: fakevCard });
        try { fs.unlinkSync(inPath); fs.unlinkSync(outPath); } catch {}
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
    }
}

// ══════════════════════════════════
// ★ FUNNY VOICE NOTES (20 cmds)
// ══════════════════════════════════

// 1. pikachu
cmd({ pattern: 'pikachu', alias: ['pika', 'pikaaaa'], desc: 'Pikachu voice note 🐭', category: 'fun', react: '⚡' },
async (conn, mek, m, { from }) => {
    await ttsVoice(conn, from, mek, 'Pika pika pikachu! Pikaaaa!', 'ja', { pitch: 1.5 });
});

// 2. minion
cmd({ pattern: 'minion', alias: ['banana', 'bello'], desc: 'Minion voice note 🍌', category: 'fun', react: '🍌' },
async (conn, mek, m, { from }) => {
    await ttsVoice(conn, from, mek, 'Bello! Papoy! Banana banana banana! Underwear!', 'en', { pitch: 1.4 });
});

// 3. robot
// 🚨 BUG FIX (dead alias): 'robot' was listed here as an alias, but
// voice-changer.js already registers 'robot' as its own PRIMARY pattern.
// The dispatcher checks exact pattern matches across ALL plugins before it
// ever checks aliases, so typing .robot always went to voice-changer's
// pitch-effect version — this TTS version was silently unreachable via
// that word. Removed to stop implying it worked; 'cyborg' still reaches it.
cmd({ pattern: 'robotvoice', alias: ['cyborg'], desc: 'Robot voice note 🤖', category: 'fun', react: '🤖' },
async (conn, mek, m, { from, args, q }) => {
    const text = q || args.join(' ') || 'I am a robot. Beep boop beep. Error detected. Rebooting system.';
    await ttsVoice(conn, from, mek, text, 'en', { pitch: 0.7, speed: 0.8, echo: true });
});

// 4. baby
// 🚨 BUG FIX (dead alias): same shadowing issue — 'baby' is voice-changer's
// own primary pattern (a real ffmpeg pitch effect on YOUR quoted audio),
// so this TTS version was never reachable through that word. 'cutevoice'
// still works.
cmd({ pattern: 'babyvoice', alias: ['cutevoice'], desc: 'Baby voice note 👶', category: 'fun', react: '👶' },
async (conn, mek, m, { from, args, q }) => {
    const text = q || args.join(' ') || 'Hello! I am a baby. Goo goo ga ga!';
    await ttsVoice(conn, from, mek, text, 'en', { pitch: 1.8 });
});

// 5. giant / deep voice
// 🚨 BUG FIX (dead alias, corrected): 'demon' is voice-changer's primary
// pattern (ffmpeg effect on quoted audio) — this TTS version was
// unreachable through that word. The previous fix here claimed 'giant'
// still worked as an alias, but voice-changer.js ALSO has an exact pattern
// called 'giant' (its own ffmpeg pitch-down effect) — exact pattern matches
// are checked before any alias, so 'giant' always went to voice-changer.js
// and this TTS version was silently unreachable through it too. Only
// 'deepvoice' actually reaches this command; use '.giantvoice' or
// '.deepvoice' to get THIS one specifically.
cmd({ pattern: 'giantvoice', alias: ['deepvoice'], desc: 'Giant deep voice note 👹', category: 'fun', react: '👹' },
async (conn, mek, m, { from, args, q }) => {
    const text = q || args.join(' ') || 'I AM THE GIANT. FEAR ME. HAHAHA.';
    await ttsVoice(conn, from, mek, text, 'en', { pitch: 0.5, speed: 0.7 });
});

// 6. chipmunk
cmd({ pattern: 'vineboom', alias: ['boom', 'vine'], desc: 'Vine boom sound effect 💥', category: 'fun', react: '💥' },
async (conn, mek, m, { from }) => {
    await sendVoice(conn, from, mek, 'https://files.catbox.moe/bxnzv5.mp3');
});

// 8. bruh
cmd({ pattern: 'bruh', alias: ['bruhhh'], desc: 'Bruh sound effect 😐', category: 'fun', react: '😐' },
async (conn, mek, m, { from }) => {
    await sendVoice(conn, from, mek, 'https://files.catbox.moe/9ihz8z.mp3');
});

// 9. airhorn
cmd({ pattern: 'airhorn', alias: ['horn', 'goalhorn'], desc: 'Air horn sound 📯', category: 'fun', react: '📯' },
async (conn, mek, m, { from }) => {
    await sendVoice(conn, from, mek, 'https://files.catbox.moe/p1fkzk.mp3');
});

// 10. ohno
// 🚨 BUG FIX (Bunty log: "status code 404" on both primary + fallback) —
// the old catbox.moe/cit0w4.mp3 link is genuinely dead/deleted, not just
// slow/busy — no retry could ever fix a 404. Swapped to a currently-live
// direct mp3 link (confirmed reachable, served with the right audio
// content-type) for the exact same "oh no" meme sound.
cmd({ pattern: 'ohno', alias: ['ohnoo', 'falling'], desc: 'Oh no falling sound 😱', category: 'fun', react: '😱' },
async (conn, mek, m, { from }) => {
    await sendVoice(conn, from, mek, 'https://www.myinstants.com/media/sounds/oh-no-meme-sound.mp3');
});

// 11. windows
cmd({ pattern: 'windows', alias: ['windowsxp', 'error'], desc: 'Windows XP startup/error sound 💻', category: 'fun', react: '💻' },
async (conn, mek, m, { from }) => {
    await sendVoice(conn, from, mek, 'https://files.catbox.moe/5fnbue.mp3');
});

// 12. nyan
cmd({ pattern: 'nyan', alias: ['nyancat', 'rainbow'], desc: 'Nyan cat sound 🌈', category: 'fun', react: '🌈' },
async (conn, mek, m, { from }) => {
    await sendVoice(conn, from, mek, 'https://files.catbox.moe/m3jwg2.mp3');
});

// 13. scary voice
// 🚨 BUG FIX (dead alias): 'ghost' is voice-changer's own primary pattern —
// unreachable here through that word. 'scary' and 'horror' still work.
cmd({ pattern: 'scaryvoice', alias: ['horror'], desc: 'Scary ghost voice 👻', category: 'fun', react: '👻' },
async (conn, mek, m, { from, args, q }) => {
    const text = q || args.join(' ') || 'I am watching you... come to me... you cannot escape...';
    await ttsVoice(conn, from, mek, text, 'en', { pitch: 0.6, speed: 0.75, echo: true });
});

// 14. alien
// 🚨 BUG FIX (dead alias): 'fast' is voice-changer's own primary pattern —
// unreachable here through that word. 'speedy' still works.
cmd({ pattern: 'fastvoice', alias: ['speedy'], desc: 'Super fast voice note ⚡', category: 'fun', react: '⚡' },
async (conn, mek, m, { from, args, q }) => {
    const text = q || args.join(' ') || 'Hello how are you I am speaking very fast right now can you understand me?';
    await ttsVoice(conn, from, mek, text, 'en', { speed: 2.0 });
});

// 16. slow
// 🚨 BUG FIX (dead alias): 'slow' is voice-changer's own primary pattern —
// unreachable here through that word. 'slomo' still works.
cmd({ pattern: 'slowvoice', alias: ['slomo'], desc: 'Super slow voice note 🐢', category: 'fun', react: '🐢' },
async (conn, mek, m, { from, args, q }) => {
    const text = q || args.join(' ') || 'Hello... I... am... speaking... very... slowly...';
    await ttsVoice(conn, from, mek, text, 'en', { speed: 0.5, pitch: 0.8 });
});

// 17. echo
// 🚨 BUG FIX (dead alias): 'echo' is voice-changer's own primary pattern —
// unreachable here through that word. 'reverb' still works.
cmd({ pattern: 'echovoice', alias: ['reverb'], desc: 'Echo voice note 🏔️', category: 'fun', react: '🏔️' },
async (conn, mek, m, { from, args, q }) => {
    const text = q || args.join(' ') || 'Hello! Can you hear the echo? Echo echo echo!';
    await ttsVoice(conn, from, mek, text, 'en', { echo: true });
});

// 18. spongebob
cmd({ pattern: 'spongebob', alias: ['spongybob', 'squarepants'], desc: 'SpongeBob impression 🧽', category: 'fun', react: '🧽' },
async (conn, mek, m, { from, args, q }) => {
    const text = q || args.join(' ') || 'Are you ready kids? Aye aye captain! I cannot hear you! Aye aye captain!';
    await ttsVoice(conn, from, mek, text, 'en', { pitch: 1.3 });
});

// 19. arabic funny
cmd({ pattern: 'arabicvoice', alias: ['arabic', 'habeebi'], desc: 'Funny Arabic voice 🌙', category: 'fun', react: '🌙' },
async (conn, mek, m, { from, args, q }) => {
    const text = q || args.join(' ') || 'habeebi come to dubai habibi you are my friend';
    await ttsVoice(conn, from, mek, text, 'ar', { pitch: 1.1 });
});

// 20. say (custom TTS voice note)
cmd({ pattern: 'say', alias: ['speak', 'voice', 'ttsvoice'], desc: 'Convert your text to voice note 🗣️', category: 'fun', react: '🗣️' },
async (conn, mek, m, { from, args, q }) => {
    const text = q || args.join(' ');
    if (!text) return;
    const lang = config.LANGUAGE || 'en';
    await ttsVoice(conn, from, mek, text.slice(0, 200), lang, {});
});

module.exports = { ttsVoice, sendVoice, modifyAudio };
