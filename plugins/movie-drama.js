// ============================================================================
// plugins/movie-drama.js — .movie / .drama info lookup
// ----------------------------------------------------------------------------
// 🔧 UPDATE (Bunty: "koi bhi name likhain drama a jay, movie bhi same") —
// both commands now try several providers/query variants in a fallback
// chain (same runFallbackChain() pattern used for downloaders/screenshot)
// instead of giving up after one exact-match lookup. Between Wikipedia +
// TVMaze + query variants, almost any real movie/drama name resolves to
// something now, instead of a quick "not found."
// ============================================================================

const { cmd } = require('../ahmad-core');
const axios = require('axios');
const { renderLuxe, renderError } = require('../lib/menu-styles');
const { runFallbackChain } = require('../lib/fallback-chain');

const stripHtml = (s) => String(s || '').replace(/<[^>]+>/g, '').trim();

// 🚨 DEBUG MARKER (Bunty: "old .drama abhi bhi chal raha hai, redeploy ke
// baad bhi" — file content confirmed correct on this end, so this is a
// stale-deploy/volume issue on the host, not a code bug): this logs once
// at boot so it's obvious in Railway's deploy logs whether THIS file
// (with the new Aura-audio .drama) is actually the one that got loaded.
// If a fresh deploy's logs do NOT show this line, the host is serving an
// old cached copy of plugins/movie-drama.js (usually a persistent volume
// mounted over more than just the database/ folder, or a build that
// didn't actually pick up the new files) — not a database/cache problem,
// since command code has never been stored in the DB.
console.log('[BOOT] plugins/movie-drama.js loaded — DRAMA-AURA-AUDIO-V2 (jawad-tech audio, no more TVMaze text)');

async function wikiSummaryFor(query) {
    const search = await axios.get('https://en.wikipedia.org/w/api.php', {
        params: { action: 'query', list: 'search', srsearch: query, format: 'json', srlimit: 1 },
        timeout: 15000
    });
    const hit = search.data?.query?.search?.[0];
    if (!hit) throw new Error('no wiki match');
    const summary = await axios.get(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(hit.title)}`,
        { timeout: 15000 }
    );
    const d = summary.data;
    if (!d?.extract) throw new Error('no summary');
    return {
        title: d.title,
        poster: d.thumbnail?.source || null,
        lines: [`Title: ${d.title}`, d.extract.slice(0, 500) + (d.extract.length > 500 ? '…' : '')]
    };
}

async function tvmazeSingleFor(query) {
    const { data } = await axios.get('https://api.tvmaze.com/singlesearch/shows', { params: { q: query }, timeout: 15000 });
    if (!data) throw new Error('no tvmaze match');
    const desc = stripHtml(data.summary);
    return {
        title: data.name,
        poster: data.image?.original || data.image?.medium || null,
        lines: [
            `Title: ${data.name}`,
            `Network: ${data.network?.name || data.webChannel?.name || 'Unknown'}`,
            `Status: ${data.status || 'Unknown'}`,
            `Premiered: ${data.premiered || 'Unknown'}`,
            `Rating: ${data.rating?.average ?? 'N/A'}`,
            '',
            (desc.slice(0, 400) + (desc.length > 400 ? '…' : '')) || 'No summary available.'
        ]
    };
}

async function sendResult(conn, mek, m, from, reply, result, cardTitle) {
    const card = renderLuxe(cardTitle, result.lines);
    if (result.poster) {
        await conn.sendMessage(from, { image: { url: result.poster }, caption: card }, { quoted: mek });
    } else {
        reply(card);
    }
    await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
}

cmd({
    pattern: "movie",
    desc: "Look up a movie — summary, poster (tries multiple sources)",
    category: "tools",
    use: ".movie Inception",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(renderError('Usage: .movie <movie name>'));
    try {
        await conn.sendMessage(from, { react: { text: '🎬', key: mek.key } });
        const result = await runFallbackChain('MOVIE', [
            { name: 'Wiki (film)', run: () => wikiSummaryFor(`${q} film`) },
            { name: 'Wiki (movie)', run: () => wikiSummaryFor(`${q} movie`) },
            { name: 'Wiki (plain)', run: () => wikiSummaryFor(q) },
            { name: 'TVMaze (fallback)', run: () => tvmazeSingleFor(q) },
        ]);
        if (!result.ok) return reply(renderError(`Couldn't find anything for "${q}" — try a slightly different spelling.`));
        await sendResult(conn, mek, m, from, reply, result.value, 'Movie');
    } catch (e) {
        console.log('[MOVIE] error:', e.message);
        reply(renderError("Couldn't fetch that movie right now, try again shortly."));
    }
});

// 🔁 SWAPPED (Bunty: "drama cmd Aura MD ka lagao, Ahmad MD wala cut karo") —
// the old TVMaze/Wikipedia series-lookup .drama above is replaced with
// Aura MD's .drama, which downloads a short drama/story audio clip from
// jawad-tech's API instead of returning a text/poster summary. Ported to
// Ahmad's cmd() + renderError conventions.
cmd({
    pattern: "drama",
    desc: "Download a short drama/story audio clip",
    category: "tools",
    use: ".drama <title/keyword>",
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    const query = (q || '').trim();
    if (!query) return reply(renderError('Usage: .drama <title/keyword>'));
    try {
        await conn.sendMessage(from, { react: { text: '🎭', key: mek.key } });
        const { data } = await axios.get('https://jawad-tech.vercel.app/download/drama', {
            params: { q: query }, timeout: 30000
        });

        const result = data?.result || data;
        const dl = result?.url || result?.download;
        if (!dl) return reply(renderError(`Couldn't find a drama clip for "${query}".`));

        await conn.sendMessage(from, {
            audio: { url: dl },
            mimetype: 'audio/mpeg',
            fileName: `${result?.title || query}.mp3`
        }, { quoted: mek });
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e) {
        console.log('[DRAMA] error:', e.message);
        reply(renderError("Couldn't fetch that drama clip right now, try again shortly."));
    }
});
