const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { tmpdir } = require('os');
const Crypto = require('crypto');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');

ffmpeg.setFfmpegPath(ffmpegPath);

/**
 * Fetch an image from a given URL.
 * @param {string} url - The image URL.
 * @returns {Promise<Buffer>} - The image buffer.
 */
async function fetchImage(url) {
    try {
        // 🚨 BUG FIX (Bunty: "kuch cmds mein stickers working nahi" — .attp
        // and friends): this had NO timeout at all. If the free API host is
        // slow/cold-starting/dead, the request just hangs forever — no
        // error, no timeout, the command never completes or replies.
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
        return response.data;
    } catch (error) {
        console.error("Error fetching image:", error.message);
        throw new Error("Could not fetch image.");
    }
}

/**
 * Fetch a GIF from a given API URL.
 * @param {string} url - API endpoint to fetch GIF.
 * @returns {Promise<Buffer>} - The GIF buffer.
 */
async function fetchGif(url) {
    try {
        // 🚨 SAME BUG FIX as fetchImage above — no timeout meant a slow/dead
        // API (e.g. api-fix.onrender.com cold-starting) hung .attp forever.
        const response = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000 });
        return response.data;
    } catch (error) {
        console.error("Error fetching GIF:", error.message);
        throw new Error("Could not fetch GIF — the sticker service is slow or unavailable right now, try again in a moment.");
    }
}

/**
 * Converts a GIF buffer to WebP sticker format.
 * @param {Buffer} gifBuffer - The GIF buffer.
 * @returns {Promise<Buffer>} - The WebP sticker buffer.
 */
async function gifToSticker(gifBuffer) {
    const outputPath = path.join(tmpdir(), Crypto.randomBytes(6).toString('hex') + ".webp");
    const inputPath = path.join(tmpdir(), Crypto.randomBytes(6).toString('hex') + ".gif");

    fs.writeFileSync(inputPath, gifBuffer);

    await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .on("error", reject)
            .on("end", () => resolve(true))
            .addOutputOptions([
                "-vcodec", "libwebp",
                // 🚨 FIX ("sticker chota, box bara" — character tiny inside a big
                // empty square): the old filter scaled DOWN to fit inside
                // 320x320 and padded the leftover space with transparency, so
                // any non-square source (most anime reaction gifs are
                // wide/tall) ended up small in the middle of a big empty
                // sticker. Now we scale UP to fully COVER a 512x512 frame
                // (WhatsApp's native sticker resolution) and crop the excess,
                // so the character always fills the whole sticker.
                "-vf", "scale=512:512:force_original_aspect_ratio=increase,crop=512:512,fps=15,split [a][b];[a] palettegen=reserve_transparent=on:transparency_color=ffffff [p];[b][p] paletteuse",
                "-loop", "0",
                "-preset", "default",
                "-an",
                "-vsync", "0"
            ])
            .toFormat("webp")
            .save(outputPath);
    });

    const webpBuffer = fs.readFileSync(outputPath);
    fs.unlinkSync(outputPath);
    fs.unlinkSync(inputPath);

    return webpBuffer;
}

/**
 * Converts a GIF buffer into an MP4 for WhatsApp's gifPlayback video
 * message — this keeps it ANIMATED (unlike a plain image) while still
 * being able to carry a caption in the same message (unlike a sticker,
 * which can't have text at all). Scaled up big, full aspect ratio kept
 * (no square crop), so it displays large and clean.
 * @param {Buffer} gifBuffer - The GIF buffer.
 * @returns {Promise<Buffer>} - The MP4 buffer.
 */
async function gifToVideoGif(gifBuffer) {
    const outputPath = path.join(tmpdir(), Crypto.randomBytes(6).toString('hex') + ".mp4");
    const inputPath = path.join(tmpdir(), Crypto.randomBytes(6).toString('hex') + ".gif");

    fs.writeFileSync(inputPath, gifBuffer);

    await new Promise((resolve, reject) => {
        ffmpeg(inputPath)
            .on("error", reject)
            .on("end", () => resolve(true))
            .addOutputOptions([
                "-vcodec", "libx264",
                "-pix_fmt", "yuv420p",
                // Big and clean: upscale to 720px on the long side, full
                // original aspect ratio kept (no cropping/padding), even
                // dimensions required by libx264.
                "-vf", "scale='if(gt(iw,ih),720,-2)':'if(gt(iw,ih),-2,720)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,fps=15",
                "-movflags", "+faststart",
                "-an"
            ])
            .toFormat("mp4")
            .save(outputPath);
    });

    const mp4Buffer = fs.readFileSync(outputPath);
    fs.unlinkSync(outputPath);
    fs.unlinkSync(inputPath);

    return mp4Buffer;
}

module.exports = { fetchImage, fetchGif, gifToSticker, gifToVideoGif };
          
