const { cmd } = require('../ahmad-core');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { randomFooter } = require('../lib/menu-styles');
ffmpeg.setFfmpegPath(ffmpegPath);

const FOOTER = "\n\n> " + randomFooter();
const tmp = (ext) => path.join(os.tmpdir(), `vc_${Date.now()}_${crypto.randomBytes(3).toString('hex')}${ext}`);

// 🚨 CRASH FIX (Ahmad: ".mp3 karta bot crash ho jata"): this had NO size
// limit while buffering the downloaded media into memory — a large video
// (which is exactly what people reply to .mp3 with) gets fully loaded into
// RAM here with nothing capping it. On a memory-constrained host like
// Katabump, that can exhaust available RAM and get the WHOLE bot process
// OOM-killed — not just this command failing, the entire bot going down and
// needing a restart, which matches "bot crash ho jata" much better than a
// simple per-command error would. Now aborts early with a clear message
// once the download exceeds a sane cap, instead of continuing to buffer.
const MAX_MEDIA_BYTES = 60 * 1024 * 1024; // 60MB — generous for voice/audio, still protects against large videos

// 🚨 CRASH FIX round 2 (Bunty: ".mp3 too slow then crash" — still happening
// on big videos even with the 60MB cap above): the cap stops a truly huge
// file, but for anything under it, the full buffer was STILL held in RAM
// (via Buffer.concat) and THEN written to disk with writeFileSync — meaning
// the file briefly existed twice over: once as the in-memory buffer, once
// as bytes on disk, doubling peak RAM for zero benefit. On a low-RAM host,
// that's enough on its own to get the whole process OOM-killed (which looks
// exactly like "too slow, then crash" — the slowness IS the host swapping/
// struggling right before the kill). Streams straight to a temp file now —
// only a small chunk is ever in memory at once, cutting peak RAM use
// dramatically for the exact case (bigger videos) that was crashing.
async function downloadQuotedAudioToFile(m, outPath) {
    if (!m.quoted || !m.quoted.message) return false;
    const type = Object.keys(m.quoted.message)[0];
    if (!['audioMessage', 'videoMessage'].includes(type)) return false;
    const mediaType = type === 'audioMessage' ? 'audio' : 'video';
    const stream = await downloadContentFromMessage(m.quoted.message[type], mediaType);
    const writeStream = fs.createWriteStream(outPath);
    let total = 0;
    for await (const chunk of stream) {
        total += chunk.length;
        if (total > MAX_MEDIA_BYTES) {
            writeStream.destroy();
            fs.unlink(outPath, () => {});
            throw new Error(`File too large (over ${MAX_MEDIA_BYTES / (1024 * 1024)}MB) — try a shorter clip.`);
        }
        if (!writeStream.write(chunk)) {
            // respect backpressure instead of piling chunks up in memory
            await new Promise(res => writeStream.once('drain', res));
        }
    }
    await new Promise((res, rej) => writeStream.end(err => err ? rej(err) : res()));
    return true;
}

async function downloadQuotedAudio(m) {
    if (!m.quoted || !m.quoted.message) return null;
    const type = Object.keys(m.quoted.message)[0];
    if (!['audioMessage', 'videoMessage'].includes(type)) return null;
    const mediaType = type === 'audioMessage' ? 'audio' : 'video';
    const stream = await downloadContentFromMessage(m.quoted.message[type], mediaType);
    let buffer = Buffer.from([]);
    for await (const chunk of stream) {
        buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length > MAX_MEDIA_BYTES) {
            throw new Error(`File too large (over ${MAX_MEDIA_BYTES / (1024 * 1024)}MB) — try a shorter clip.`);
        }
    }
    return buffer;
}

// 🚨 BUG FIX (voice effects/.mp3 "kaafi der lagti, phir error, pata nahi
// convert ho rahi ya nahi"): two problems together caused this —
// 1) Nothing was sent to the user between the initial command and the
//    final result, so a slow conversion (big file, loaded server) looked
//    completely stuck with zero feedback.
// 2) ffmpeg had no timeout at all — if it ever hung (corrupt/incompatible
//    input codec, etc.) it could sit there indefinitely with no error ever
//    firing, which is worse than a slow-but-working conversion.
// Fix: send a "⏳ Converting..." reply immediately, and cap ffmpeg at 90s —
// past that it's rejected explicitly instead of hanging silently.
async function applyVoiceEffect(inputBuffer, filterString) {
    const inPath = tmp('.ogg');
    const outPath = tmp('.ogg');
    fs.writeFileSync(inPath, inputBuffer);
    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            command.kill('SIGKILL');
            reject(new Error('Conversion timed out after 90s — file may be too long/large.'));
        }, 90000);
        const command = ffmpeg(inPath)
            .audioFilters(filterString)
            .audioCodec('libopus')
            .format('ogg')
            .on('end', () => { clearTimeout(timer); resolve(); })
            .on('error', (e) => { clearTimeout(timer); reject(e); })
            .save(outPath);
    });
    const buf = fs.readFileSync(outPath);
    fs.unlink(inPath, () => {}); fs.unlink(outPath, () => {});
    return buf;
}

// 🚨 BUG FIX (requested by Ahmad — "speed 1x normal ho"): asetrate changes
// BOTH pitch and playback speed together. baby/deep/fairy/demon/monster
// already paired it with a compensating atempo (asetrate × atempo ≈ 1.0) so
// only the pitch changed. chipmunk/giant/nightcore/squeaky were MISSING that
// compensation, so on top of sounding higher/lower they also genuinely
// played back faster/slower — now every pitch-only effect keeps 1x speed.
// (fast/slow are intentionally tempo-only effects and are left as-is.)
const effects = [
    { pattern: "baby", emoji: "👶", filter: "asetrate=44100*1.4,atempo=0.7143,aresample=44100" },
    { pattern: "deep", emoji: "🗿", filter: "asetrate=44100*0.7,atempo=1.4286,aresample=44100" },
    { pattern: "chipmunk", emoji: "🐿️", filter: "asetrate=44100*1.8,atempo=0.5556,aresample=44100" },
    { pattern: "giant", emoji: "🦣", filter: "asetrate=44100*0.6,atempo=1.6667,aresample=44100" },
    { pattern: "robot", emoji: "🤖", filter: "flanger=delay=0:depth=2:speed=0.5" },
    { pattern: "fast", emoji: "⏩", filter: "atempo=1.6" },
    { pattern: "slow", emoji: "⏪", filter: "atempo=0.7" },
    { pattern: "echo", emoji: "🔊", filter: "aecho=0.8:0.9:1000:0.3" },
    { pattern: "reverseaudio", emoji: "🔄", filter: "areverse" },
    { pattern: "demon", emoji: "👹", filter: "asetrate=44100*0.6,atempo=1.6667,aresample=44100,aecho=0.8:0.9:40:0.25" },
    { pattern: "fairy", emoji: "🧚", filter: "asetrate=44100*1.6,atempo=0.625,aresample=44100" },
    { pattern: "alien", emoji: "👽", filter: "vibrato=f=6:d=0.5" },
    { pattern: "drunk", emoji: "🍺", filter: "vibrato=f=3:d=0.8" },
    { pattern: "telephone", emoji: "📞", filter: "highpass=f=300,lowpass=f=3400" },
    { pattern: "nightcore", emoji: "🌙", filter: "asetrate=44100*1.25,atempo=0.8,aresample=44100" },
    { pattern: "bass", emoji: "🔉", filter: "bass=g=15" },
    { pattern: "squeaky", emoji: "🐭", filter: "asetrate=44100*2.0,atempo=0.5,aresample=44100" },
    { pattern: "monster", emoji: "👺", filter: "asetrate=44100*0.5,atempo=2.0,aresample=44100" },
    { pattern: "underwater", emoji: "🌊", filter: "lowpass=f=500" },
    { pattern: "radio", emoji: "📻", filter: "highpass=f=1000,lowpass=f=4000" },
    { pattern: "whisper", emoji: "🤫", filter: "volume=0.5,highpass=f=2000" },
    // 🆕 new voice effects
    { pattern: "kid", emoji: "🧒", filter: "asetrate=44100*1.25,atempo=0.8,aresample=44100" },
    { pattern: "oldman", emoji: "👴", filter: "asetrate=44100*0.75,atempo=1.3333,aresample=44100,bass=g=5" },
    { pattern: "ghost", emoji: "👻", filter: "asetrate=44100*0.85,atempo=1.1765,aresample=44100,aecho=0.6:0.7:60:0.4" },
    { pattern: "helium", emoji: "🎈", filter: "asetrate=44100*2.2,atempo=0.4545,aresample=44100" },
    { pattern: "cave", emoji: "🕳️", filter: "aecho=0.9:0.95:300:0.6,lowpass=f=2000" },
    { pattern: "megaphone", emoji: "📢", filter: "highpass=f=500,lowpass=f=3000,acompressor=threshold=0.1:ratio=9" }
];

for (const eff of effects) {
    cmd({
        pattern: eff.pattern,
        desc: `${eff.emoji} Voice changer: ${eff.pattern}`,
        category: "fun",
        filename: __filename
    }, async (conn, mek, m, { from, reply }) => {
        try {
            const audioBuffer = await downloadQuotedAudio(m);
            if (!audioBuffer) return reply(`❌ Reply to a voice note/audio with *.${eff.pattern}*.${FOOTER}`);

            await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
            const outBuffer = await applyVoiceEffect(audioBuffer, eff.filter);
            await conn.sendMessage(from, {
                audio: outBuffer,
                mimetype: "audio/ogg; codecs=opus",
                ptt: true
            }, { quoted: mek });
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        } catch (e) {
            console.log(`VOICE FX (${eff.pattern}) ERROR:`, e.message);
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            reply(`❌ Voice effect failed: ${e.message}${FOOTER}`);
        }
    });
}

// 🆕 .mp3 — convert a quoted video/audio to a plain .mp3 file (requested by Ahmad)
cmd({
    pattern: "mp3",
    desc: "Convert a replied video/audio to MP3",
    category: "tools",
    filename: __filename
}, async (conn, mek, m, { from, reply }) => {
    const inPath = tmp('.tmp');
    const outPath = tmp('.mp3');
    try {
        if (!m.quoted || !m.quoted.message || !['audioMessage', 'videoMessage'].includes(Object.keys(m.quoted.message)[0])) {
            return reply(`❌ Reply to a video/audio with *.mp3*.${FOOTER}`);
        }

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        await downloadQuotedAudioToFile(m, inPath);

        await new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                command.kill('SIGKILL');
                reject(new Error('Conversion timed out after 90s — file may be too long/large.'));
            }, 90000);
            const command = ffmpeg(inPath)
                .audioCodec('libmp3lame')
                .audioBitrate('128k')
                .format('mp3')
                .on('end', () => { clearTimeout(timer); resolve(); })
                .on('error', (e) => { clearTimeout(timer); reject(e); })
                .save(outPath);
        });
        const outBuffer = fs.readFileSync(outPath);
        fs.unlink(inPath, () => {}); fs.unlink(outPath, () => {});

        await conn.sendMessage(from, {
            audio: outBuffer,
            mimetype: "audio/mpeg",
            ptt: false,
            fileName: "converted.mp3"
        }, { quoted: mek });
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e) {
        console.log('MP3 CONVERT ERROR:', e.message);
        fs.unlink(inPath, () => {}); fs.unlink(outPath, () => {});
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`❌ Conversion failed: ${e.message}${FOOTER}`);
    }
});

module.exports = {};
