// 🆕 (Bunty: "AURA-MD wali .hacker command achi hai — 'photo 360 api'
// use karti hai, aur bhi templates chahiye") — thin wrapper around the
// `mumaker` npm package's `.ephoto()` function, which scrapes
// ephoto360.com's text-into-image template generators (hundreds of styles
// exist there — neon, glitch, hacker/cyberpunk, fire, ice, metallic, etc).
// One shared helper so every effect command below stays a 3-line file.
const mumaker = require('mumaker');

/**
 * @param {string} templateUrl - the ephoto360.com template page URL
 * @param {string} text - text to render into the template image
 * @returns {Promise<string>} direct image URL of the generated result
 */
async function ephotoText(templateUrl, text) {
    const result = await mumaker.ephoto(templateUrl, text);
    if (!result || !result.image) throw new Error('ephoto360: no image in response — the template page may be down or its layout changed');
    return result.image;
}

module.exports = { ephotoText };
