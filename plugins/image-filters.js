const { cmd } = require('../ahmad-core');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

// 🆕 (Bunty: "image wali [category], hd/grayscale/pixelate/invert/blur/
// mirror" — reference used `sharp`, a native module): built with ffmpeg
// instead — already a proven dependency in this bot (used by .play/.owner/
// .ohno/etc), so this adds zero new packages and zero new install risk.
// (.hd / AI-upscale skipped — its source used an "upskel" library that
// isn't actually present/resolvable anywhere in the reference codebase,
// so it couldn't be verified as real or working.)
const FILTERS = [
    { pattern: 'grayscale', alias: ['bw'], emoji: '⚫', label: 'Grayscale', vf: 'format=gray' },
    { pattern: 'invertimg', alias: ['negativeimg'], emoji: '🎨', label: 'Invert', vf: 'negate' },
    { pattern: 'blurimg', emoji: '🌫️', label: 'Blur', vf: 'gblur=sigma=15' },
    { pattern: 'mirrorimg', emoji: '🪞', label: 'Mirror', vf: 'hflip' },
    { pattern: 'pixelate', emoji: '🧩', label: 'Pixelate', vf: 'scale=iw/20:ih/20:flags=fast_bilinear,scale=iw*20:ih*20:flags=neighbor' },
];

for (const f of FILTERS) {
    cmd({
        pattern: f.pattern,
        alias: f.alias || [],
        desc: `${f.label} a replied image`,
        category: 'tools',
        react: f.emoji,
        use: `<reply to an image> .${f.pattern}`
    }, async (conn, mek, m, { from, reply }) => {
        const inPath = path.join(tmpdir(), `imgin_${Date.now()}.png`);
        const outPath = path.join(tmpdir(), `imgout_${Date.now()}.png`);
        try {
            if (!m.quoted?.message?.imageMessage) {
                return reply(`❌ Reply to an image with .${f.pattern}`);
            }
            await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

            const buf = await m.quoted.download();
            if (!buf) throw new Error('Could not download the image.');
            fs.writeFileSync(inPath, buf);

            await new Promise((resolve, reject) => {
                ffmpeg(inPath)
                    .videoFilters(f.vf)
                    .outputOptions(['-frames:v 1'])
                    .format('image2')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(outPath);
            });

            await conn.sendMessage(from, {
                image: fs.readFileSync(outPath),
                caption: `${f.emoji} ${f.label} applied!`
            }, { quoted: mek });
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        } catch (e) {
            console.log(`[${f.pattern.toUpperCase()}] failed:`, e.message);
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            reply('❌ Image process nahi ho saki, dobara try karo.');
        } finally {
            try { fs.unlinkSync(inPath); } catch {}
            try { fs.unlinkSync(outPath); } catch {}
        }
    });
}
