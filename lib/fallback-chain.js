// ============================================================================
// lib/fallback-chain.js — shared multi-API fallback runner
// ----------------------------------------------------------------------------
// Extracted from the pattern already used in downloaders.js (dlAudio/dlVideo:
// Vreden → Yupra → Okatsu → Alya → Cobalt → EliteProTech). Any command that
// currently calls just ONE API and dies if it's down/rate-limited can adopt
// this instead of hand-rolling its own try/catch chain.
//
// Usage:
//   const { runFallbackChain } = require('../lib/fallback-chain');
//   const result = await runFallbackChain('screenshot', [
//     { name: 'Movanest', run: async () => { ... return url; } },
//     { name: 'Microlink', run: async () => { ... return url; } },
//   ]);
//   // result = { ok: true, value: url, provider: 'Movanest' }
//   // or      { ok: false, errors: [{provider, message}, ...] }
// ============================================================================

// 🚀 SPEED FIX (Ahmad: "downloading/API commands slow — jo jo issues fix
// karo"): this ran every provider ONE AFTER ANOTHER — a dead/slow first
// provider meant waiting out its full timeout before even trying the next
// one, for every single command using this shared runner (ss, movie-drama,
// sim-info). Now all providers fire in PARALLEL; whichever succeeds first
// wins, and the rest are ignored. Fixing it here fixes it everywhere this
// runner is used, no per-command changes needed.
async function runFallbackChain(label, providers) {
    const errors = [];
    const attempts = providers.map(p => (async () => {
        try {
            const value = await p.run();
            if (value === undefined || value === null || value === '') {
                throw new Error('empty result');
            }
            return { value, provider: p.name };
        } catch (e) {
            const message = e?.message || String(e);
            console.log(`[${label} | ${p.name}] failed:`, message);
            errors.push({ provider: p.name, message });
            throw e;
        }
    })());

    try {
        const winner = await Promise.any(attempts);
        return { ok: true, value: winner.value, provider: winner.provider };
    } catch (e) {
        return { ok: false, errors };
    }
}

module.exports = { runFallbackChain };
