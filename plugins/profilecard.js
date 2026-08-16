const { cmd } = require('../ahmad-core');
const { renderProfileCard } = require('../lib/card-styles');
const { renderError } = require('../lib/menu-styles');

// ══════════════════════════════════════════════════════════════════════════
// 🪪 .profile / .pcard — attractive profile card for yourself, a mentioned
// user, or a replied-to user. Sends their real profile photo + a bordered
// card with name/number/about/group role.
// ══════════════════════════════════════════════════════════════════════════

cmd({
    pattern: 'profile',
    alias: ['pcard', 'profilecard'],
    desc: '🪪 Show a profile card for yourself or a mentioned user',
    category: 'tools',
    filename: __filename
}, async (conn, mek, m, { from, isGroup, reply, mentionedJid, quoted, sender }) => {
    try {
        await conn.sendMessage(from, { react: { text: '🪪', key: mek.key } });

        const target = (mentionedJid && mentionedJid[0]) || (quoted && quoted.sender) || sender;
        const number = target.split('@')[0];

        let name = number;
        try {
            const contact = await conn.onWhatsApp(target);
            name = (contact && contact[0] && contact[0].notify) || number;
        } catch {}
        // Prefer the pushName if we're looking at the message sender / group member
        if (target === sender && m.pushName) name = m.pushName;

        let bio = null;
        try {
            const status = await conn.fetchStatus(target);
            bio = status?.status || null;
        } catch {}

        let ppUrl;
        try { ppUrl = await conn.profilePictureUrl(target, 'image'); }
        catch { ppUrl = 'https://i.ibb.co/yBVVkT2G/1000199611.png'; }

        let groupName = null, isAdmin = null;
        if (isGroup) {
            try {
                const meta = await conn.groupMetadata(from);
                groupName = meta.subject;
                const p = meta.participants.find(p => p.id === target);
                isAdmin = !!(p && (p.admin === 'admin' || p.admin === 'superadmin'));
            } catch {}
        }

        const card = renderProfileCard({ name, number, bio, isAdmin, groupName });

        await conn.sendMessage(from, {
            image: { url: ppUrl },
            caption: card,
            mentions: [target]
        }, { quoted: mek });

        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e) {
        console.log('[PROFILE CARD] error:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(renderError('Could not load profile card!'));
    }
});
