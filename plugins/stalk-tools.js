// ============================================================================
// plugins/stalk-tools.js — OSINT-style lookup commands, ported from AURA_MD
// (drenox.js) into ahmad-mini's plugin format.
//
// Ported: ghstalk (GitHub), igstalk (Instagram), tiktokstalk (TikTok), ffstalk
// (Free Fire game ID).
//
// Change from the AURA_MD original: AURA_MD's tiktokstalk went through a
// Cloudflare-turnstile-bypass call against a random third-party site
// (anonymous-viewer.com) before hitting its actual API — fragile and not
// something worth carrying over. Swapped it for the same NexOracle endpoint
// AURA_MD's own tiktokstalk2 used, which ahmad-mini already relies on
// elsewhere (see plugins/apk.js, plugins/nexoracle-downloaders.js), so it's
// one less API surface to trust.
// ============================================================================

const { cmd } = require('../ahmad-core');
const axios = require('axios');
const { randomFooter } = require('../lib/menu-styles');

const NEX_BASE = 'https://api.nexoracle.com';
const NEX_KEY = 'free_key@maher_apis';
const FOOTER = () => `\n\n> ${randomFooter()}`;

// ==================== GITHUB STALK ====================
cmd({
    pattern: 'ghstalk',
    alias: ['githubstalk'],
    desc: '💻 Look up a GitHub user',
    category: 'osint',
    use: '.ghstalk <username>',
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(`💻 *GitHub Stalk*\n\nExample: .ghstalk nexoracle${FOOTER()}`);
    try {
        const { data } = await axios.get(`${NEX_BASE}/stalking/github-user`, {
            params: { apikey: NEX_KEY, user: q },
            timeout: 20000
        });
        const u = data.result;
        if (!u) return reply(`❌ User not found${FOOTER()}`);

        const caption = `╭━━〔 💻 GITHUB STALK 〕━━┈⊷
┃
┃ 👤 Username: ${u.login || 'N/A'}
┃ 📝 Name: ${u.name || 'N/A'}
┃ 👥 Followers: ${u.followers ?? 'N/A'}
┃ 👤 Following: ${u.following ?? 'N/A'}
┃ 📦 Repos: ${u.public_repos ?? 'N/A'}
┃ 📄 Bio: ${u.bio || 'N/A'}
┃ 🏢 Company: ${u.company || 'N/A'}
┃ 📍 Location: ${u.location || 'N/A'}
┃ 🔗 Profile: ${u.html_url || 'N/A'}
┃
╰━━━━━━━━━━━━━━━┈⊷${FOOTER()}`;

        if (u.avatar_url) {
            await conn.sendMessage(from, { image: { url: u.avatar_url }, caption }, { quoted: mek });
        } else {
            reply(caption);
        }
    } catch (e) {
        console.log('[GHSTALK] error:', e.message);
        reply(`❌ User not found or API error${FOOTER()}`);
    }
});

// ==================== INSTAGRAM STALK ====================
cmd({
    pattern: 'igstalk',
    alias: ['instastalk'],
    desc: '📸 Look up an Instagram profile',
    category: 'osint',
    use: '.igstalk <username>',
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(`📸 *Instagram Stalk*\n\nExample: .igstalk username${FOOTER()}`);
    try {
        const { data } = await axios.get('https://api.popcat.xyz/instagram', {
            params: { user: q },
            timeout: 20000
        });
        if (!data || !data.username) return reply(`❌ User not found${FOOTER()}`);

        const caption = `╭━━〔 📸 INSTAGRAM STALK 〕━━┈⊷
┃
┃ 👤 Username: ${data.username}
┃ 📝 Name: ${data.full_name || 'N/A'}
┃ 👥 Followers: ${data.followers ?? 'N/A'}
┃ 👤 Following: ${data.following ?? 'N/A'}
┃ 📸 Posts: ${data.posts ?? 'N/A'}
┃ 📄 Bio: ${data.biography || 'N/A'}
┃
╰━━━━━━━━━━━━━━━┈⊷${FOOTER()}`;

        if (data.profile_pic) {
            await conn.sendMessage(from, { image: { url: data.profile_pic }, caption }, { quoted: mek });
        } else {
            reply(caption);
        }
    } catch (e) {
        console.log('[IGSTALK] error:', e.message);
        reply(`❌ User not found or API error${FOOTER()}`);
    }
});

// ==================== TIKTOK STALK ====================
// Uses NexOracle's tiktok-user2 endpoint (same one AURA_MD's own tiktokstalk2
// used) instead of AURA_MD's primary tiktokstalk, which depended on a
// Cloudflare-bypass hop through a third-party site.
cmd({
    pattern: 'tiktokstalk',
    alias: ['ttstalk'],
    desc: '🎵 Look up a TikTok profile',
    category: 'osint',
    use: '.tiktokstalk <username>',
    filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
    if (!q) return reply(`🎵 *TikTok Stalk*\n\nExample: .tiktokstalk khaby.lame${FOOTER()}`);

    const sendResult = async (u) => {
        const caption = `╭━━〔 🎵 TIKTOK STALK 〕━━┈⊷
┃
┃ 👤 Username: ${u.uniqueId || u.username || q}
┃ 📝 Nickname: ${u.nickname || 'N/A'}
┃ 👥 Followers: ${u.followerCount ?? 'N/A'}
┃ 👤 Following: ${u.followingCount ?? 'N/A'}
┃ ❤️ Likes: ${u.heartCount ?? 'N/A'}
┃ 🎥 Videos: ${u.videoCount ?? 'N/A'}
┃ 📄 Bio: ${u.signature || 'N/A'}
┃ ✅ Verified: ${u.verified ? 'Yes' : 'No'}
┃
╰━━━━━━━━━━━━━━━┈⊷${FOOTER()}`;

        const avatar = u.avatarLarger || u.avatar;
        if (avatar) {
            await conn.sendMessage(from, { image: { url: avatar }, caption }, { quoted: mek });
        } else {
            reply(caption);
        }
    };

    // 🚨 FIX (Bunty's logs: NexOracle tiktok-user2 → 404 "No Results
    // Found" — endpoint's broken/renamed, not just this one username).
    // tikwm.com is already confirmed reachable from this host (see
    // plugins/downloaders.js .tiktok download command), so try it first.
    try {
        const { data } = await axios.get('https://www.tikwm.com/api/user/info', {
            params: { unique_id: q },
            timeout: 15000
        });
        if (data?.code === 0 && data?.data?.user) {
            const u = { ...data.data.user, ...data.data.stats };
            return await sendResult(u);
        }
        throw new Error(`tikwm: ${data?.msg || 'no user data'}`);
    } catch (e) {
        console.log('[TIKTOKSTALK] tikwm failed:', e.message);
    }

    // Fallback: NexOracle (kept in case it comes back / tikwm rate-limits).
    try {
        const { data } = await axios.get(`${NEX_BASE}/stalking/tiktok-user2`, {
            params: { apikey: NEX_KEY, user: q },
            timeout: 20000
        });
        const u = data.result;
        if (!u) return reply(`❌ User not found${FOOTER()}`);
        await sendResult(u);
    } catch (e) {
        // 🔧 Bunty: was only logging e.message, which for an HTTP error just
        // says "Request failed with status code 4xx/5xx" — no way to tell
        // WHY it failed. Now logs the actual response status + body from
        // NexOracle so the real cause (bad key, wrong param, endpoint
        // renamed/down, rate limit, etc.) shows up in console next time.
        console.log('[TIKTOKSTALK] error:', e.message);
        if (e.response) {
            console.log('[TIKTOKSTALK] status:', e.response.status);
            console.log('[TIKTOKSTALK] body:', JSON.stringify(e.response.data));
        }
        reply(`❌ User not found or API error${FOOTER()}`);
    }
});

// ==================== FREE FIRE STALK ====================
cmd({
    pattern: 'ffstalk',
    desc: '🎮 Look up a Free Fire player ID',
    category: 'osint',
    use: '.ffstalk <player id>',
    filename: __filename
}, async (conn, mek, m, { q, reply }) => {
    if (!q) return reply(`🎮 *Free Fire Stalk*\n\nExample: .ffstalk 1234567890${FOOTER()}`);
    try {
        const { data } = await axios.get(`https://api.lolhuman.xyz/api/freefire/${encodeURIComponent(q)}`, {
            params: { apikey: 'GataDios' },
            timeout: 20000
        });
        const r = data && data.result;
        if (!r) return reply(`❌ Player not found or invalid ID${FOOTER()}`);

        reply(`🎮 *FREE FIRE PROFILE*\n\nName: ${r.nickname || 'N/A'}\nID: ${q}\nRegion: ${r.region || 'N/A'}${FOOTER()}`);
    } catch (e) {
        console.log('[FFSTALK] error:', e.message);
        reply(`❌ Player not found or invalid ID${FOOTER()}\n\n⚠️ Note: this uses a shared free API key (lolhuman.xyz) that may be rate-limited or dead — if it keeps failing that's why.`);
    }
});
