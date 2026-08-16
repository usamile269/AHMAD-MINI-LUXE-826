// ============================================================================
// lib/animate.js — shared helper for "attractive animation" command replies.
// Requested by Ahmad: "attractive karo, animations add karo". Reuses the
// same edit-message technique already used by .hack (fun-extra.js) — send
// one message, then repeatedly edit it in place a fixed delay apart — so
// every new command gets the same smooth, consistent animated look instead
// of everyone hand-rolling their own loop.
// ============================================================================
const { sleep } = require('./functions');

/**
 * Play a sequence of text frames as one animated message (edits in place).
 * @param {object} conn - baileys socket
 * @param {string} from - chat jid
 * @param {object} mek - original message (used to quote the first frame)
 * @param {string[]} frames - text for each frame, in order
 * @param {number} delayMs - delay between frames (default 900ms)
 * @param {string[]} [mentions] - jids to mention (kept across all frames)
 * @returns {Promise<object>} the final sent message key (for further edits)
 */
async function playFrames(conn, from, mek, frames, delayMs = 900, mentions) {
    if (!frames || !frames.length) return null;
    let msg = await conn.sendMessage(from, { text: frames[0], mentions }, { quoted: mek });
    for (let i = 1; i < frames.length; i++) {
        await sleep(delayMs);
        await conn.sendMessage(from, { text: frames[i], edit: msg.key, mentions });
    }
    return msg;
}

// A simple reusable "loading bar" frame generator: builds N steps from 0%
// to 100% around whatever body/label text you pass in, so commands don't
// need to hand-craft their own progress-bar strings.
function loadingBar(percent, width = 10) {
    const filled = Math.round((percent / 100) * width);
    return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function progressFrames(title, steps, finalLine) {
    // steps: array of { percent, label }
    const frames = steps.map(s => (
        `╭═══ ${title} ═══⊷\n┃❃│ [${loadingBar(s.percent)}] ${s.percent}%\n┃❃│ ${s.label}\n╰═════════════════⊷`
    ));
    if (finalLine) {
        frames.push(`╭═══ ${title} ═══⊷\n┃❃│ [${loadingBar(100)}] 100%\n┃❃│ ${finalLine}\n╰═════════════════⊷`);
    }
    return frames;
}

module.exports = { playFrames, loadingBar, progressFrames };
