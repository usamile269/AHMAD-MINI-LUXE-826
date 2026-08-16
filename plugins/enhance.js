const { cmd } = require('../ahmad-core');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

// 🆕 (Bunty: "khud se banao, skip mat karo" — re: .hd) — the reference
// version's .hd called an "upskel" library that doesn't actually exist
// anywhere findable in that codebase (broken/missing dependency, couldn't
// verify it as real). Built for real here instead: Lanczos upscaling +
// an unsharp-mask sharpen pass via ffmpeg, which is a genuine, verifiable
// quality-enhancement technique (this is literally how most "photo
// enhance" filters work under the hood) — described honestly below as
// filter-based enhancement, not deep-learning AI, since claiming "AI
// upscale" for something that isn't would be misleading.
cmd({
    pattern: 'enhance',
    alias: ['hd', 'upscale'],
    desc: 'Sharpen and upscale a replied image (filter-based enhancement)',
    category: 'tools',
    react: '🔍',
    use: '<reply to an image> .enhance [2|4]'
}, async (conn, mek, m, { from, reply, text, args }) => {
    const inPath = path.join(tmpdir(), `enh_in_${Date.now()}.png`);
    const outPath = path.join(tmpdir(), `enh_out_${Date.now()}.png`);
    try {
        if (!m.quoted?.message?.imageMessage) return reply('❌ Reply to an image with .enhance');
        const scale = (text || args.join(' ') || '').includes('4') ? 4 : 2;

        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        const buf = await m.quoted.download();
        if (!buf) throw new Error('Could not download the image.');
        fs.writeFileSync(inPath, buf);

        await new Promise((resolve, reject) => {
            ffmpeg(inPath)
                .videoFilters([
                    `scale=iw*${scale}:ih*${scale}:flags=lanczos`,
                    'unsharp=5:5:1.0:5:5:0.0'
                ])
                .outputOptions(['-frames:v 1'])
                .format('image2')
                .on('end', resolve)
                .on('error', reject)
                .save(outPath);
        });

        await conn.sendMessage(from, {
            image: fs.readFileSync(outPath),
            caption: `🔍 *Enhanced* (${scale}x, sharpened)`
        }, { quoted: mek });
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e) {
        console.log('[ENHANCE] failed:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply('❌ Enhance fail ho gaya — image bohot bari ho sakti hai, chota try karo.');
    } finally {
        try { fs.unlinkSync(inPath); } catch {}
        try { fs.unlinkSync(outPath); } catch {}
    }
});
