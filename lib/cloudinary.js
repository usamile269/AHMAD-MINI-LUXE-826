// 🆕 (Bunty: "mini_bot unsigned preset use karo, simpler safer") — unsigned
// uploads via a pre-configured upload preset. No signature, no API secret
// touching this code at all — just cloud_name + upload_preset + the file.
// Cloudinary is a real cloud service (not a random free anonymous host
// like catbox/0x0.st/etc.), so it doesn't share the reliability problems
// this bot has repeatedly hit with those.
const axios = require('axios');
const FormData = require('form-data');
const config = require('../config');

function isConfigured() {
    return !!(config.CLOUDINARY_CLOUD_NAME && config.CLOUDINARY_UPLOAD_PRESET);
}

/**
 * Upload a Buffer to Cloudinary using an unsigned upload preset.
 * @param {Buffer} buffer - file contents
 * @param {string} ext - file extension, used only to guess resource_type
 * @param {object} opts - { folder, publicId } optional
 * @returns {Promise<string>} secure_url of the uploaded asset
 */
async function uploadToCloudinary(buffer, ext, opts = {}) {
    if (!isConfigured()) throw new Error('Cloudinary not configured (missing CLOUDINARY_CLOUD_NAME or CLOUDINARY_UPLOAD_PRESET)');

    const videoExts = ['mp4', 'mov', 'avi', 'mkv', 'webm', '3gp'];
    const audioExts = ['mp3', 'ogg', 'wav', 'm4a', 'opus', 'aac'];
    // Cloudinary treats audio as a "video" resource type internally — there
    // is no separate "audio" type in their API.
    const resourceType = (videoExts.includes(ext) || audioExts.includes(ext)) ? 'video' : 'image';

    // 🆕 (Bunty: "link ka naam mera ho, jaise AhmadHosting.png") — every
    // upload gets a branded public_id (AhmadHosting_<random>) instead of
    // Cloudinary's own auto-generated one, so the resulting link/filename
    // itself carries the brand instead of a meaningless random string.
    const randomSuffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    const publicId = opts.publicId || `AhmadHosting_${randomSuffix}`;

    const form = new FormData();
    form.append('file', buffer, `file.${ext}`);
    form.append('upload_preset', config.CLOUDINARY_UPLOAD_PRESET);
    form.append('public_id', publicId);
    if (opts.folder) form.append('folder', opts.folder);

    const res = await axios.post(
        `https://api.cloudinary.com/v1_1/${config.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload`,
        form,
        { headers: form.getHeaders(), timeout: 30000, maxBodyLength: Infinity, maxContentLength: Infinity }
    ).catch((err) => {
        // 🚨 FIX (Bunty: "Cloudinary aayi hi nahi, .url qu.ax pe gir gaya")
        // — the generic axios error message (e.g. "Request failed with
        // status code 401") hides the actual reason Cloudinary rejected
        // the upload. Cloudinary's real error text lives in
        // err.response.data.error.message — surfacing that instead so the
        // console log actually says WHY (bad preset, invalid cloud name,
        // account restriction, etc.) instead of just "it failed".
        const cloudinaryMsg = err.response?.data?.error?.message;
        throw new Error(cloudinaryMsg ? `Cloudinary: ${cloudinaryMsg}` : err.message);
    });

    if (!res.data || !res.data.secure_url) throw new Error('Cloudinary: no secure_url in response');
    return res.data.secure_url;
}

module.exports = { uploadToCloudinary, isConfigured };
