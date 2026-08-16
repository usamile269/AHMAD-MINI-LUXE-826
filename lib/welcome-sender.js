// ============================================================================
// lib/welcome-sender.js — shared welcome/goodbye send logic.
// ----------------------------------------------------------------------------
// (Bunty: ".testwelcometext"/".testwelcomevideo" — "abhi bhi fix nahi
// hua, khud test karna hai") — extracted out of main.js's real
// group-participants.update listener so BOTH the real join/leave event
// AND the new test commands run the exact same code. If the test command
// works but a real join doesn't, that tells us the bug is specifically in
// event delivery (bot not admin, WhatsApp not firing the event, etc.) —
// not in the welcome-rendering logic itself.
// ============================================================================

// 🆕 (Bunty gave direct video URLs to set as defaults): welcomeVideo/
// goodbyeVideo can now be EITHER a stored base64 string (old .gwelcomevideo
// reply-to-video flow) OR a direct URL string — Baileys can stream straight
// from a URL, so a URL default doesn't need downloading/storing bytes at
// all, just the link itself.
function videoField(value) {
    return /^https?:\/\//i.test(value) ? { url: value } : Buffer.from(value, 'base64');
}

async function sendWelcome(conn, groupId, participantJid, settings) {
    const mention = '@' + participantJid.split('@')[0];
    let groupMeta;
    try { groupMeta = await conn.groupMetadata(groupId); } catch { groupMeta = null; }
    const memberCount = groupMeta?.participants?.length ?? '?';
    const joinTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const text = (settings.welcomeMsg || 'Welcome @user to the group! 🎉')
        .replace(/@user/g, mention)
        .replace(/@members/g, String(memberCount))
        .replace(/@time/g, joinTime);

    if (settings.welcomeVideo) {
        return conn.sendMessage(groupId, {
            video: videoField(settings.welcomeVideo),
            caption: text,
            mentions: [participantJid]
        });
    }

    try {
        const { renderWelcomeCard } = require('./card-styles');
        let ppUrl;
        try { ppUrl = await conn.profilePictureUrl(participantJid, 'image'); }
        catch { ppUrl = 'https://i.ibb.co/yBVVkT2G/1000199611.png'; }

        const card = renderWelcomeCard({
            mention,
            groupName: groupMeta?.subject || 'the group',
            memberCount,
        });
        return await conn.sendMessage(groupId, {
            image: { url: ppUrl },
            caption: `${card}\n\n${text}`,
            mentions: [participantJid]
        });
    } catch (e) {
        console.log('[WELCOME CARD ERROR]', e.message);
        return conn.sendMessage(groupId, { text, mentions: [participantJid] });
    }
}

async function sendGoodbye(conn, groupId, participantJid, settings) {
    if (!settings.goodbyeMsg) return null;
    const mention = '@' + participantJid.split('@')[0];
    let groupMeta;
    try { groupMeta = await conn.groupMetadata(groupId); } catch { groupMeta = null; }
    const memberCount = groupMeta?.participants?.length ?? '?';
    const leftTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const text = settings.goodbyeMsg
        .replace(/@user/g, mention)
        .replace(/@members/g, String(memberCount))
        .replace(/@time/g, leftTime);

    if (settings.goodbyeVideo) {
        return conn.sendMessage(groupId, {
            video: videoField(settings.goodbyeVideo),
            caption: text,
            mentions: [participantJid]
        });
    }

    try {
        const { renderGoodbyeCard } = require('./card-styles');
        let ppUrl;
        try { ppUrl = await conn.profilePictureUrl(participantJid, 'image'); }
        catch { ppUrl = 'https://i.ibb.co/yBVVkT2G/1000199611.png'; }

        const card = renderGoodbyeCard({
            mention,
            groupName: groupMeta?.subject || 'the group',
            memberCount,
        });
        return await conn.sendMessage(groupId, {
            image: { url: ppUrl },
            caption: `${card}\n\n${text}`,
            mentions: [participantJid]
        });
    } catch (e) {
        console.log('[GOODBYE CARD ERROR]', e.message);
        return conn.sendMessage(groupId, { text, mentions: [participantJid] });
    }
}

// 🆕 (Bunty: "kick walay ki attitude wali lines alag hon, normal leave se")
// — sent instead of sendGoodbye when the departure was a bot-authorized
// .kick, not a voluntary leave. Falls back to sendGoodbye's message if no
// kickMsg is set, so nothing breaks for anyone who hasn't set one.
async function sendKick(conn, groupId, participantJid, settings) {
    const msg = settings.kickMsg || settings.goodbyeMsg;
    if (!msg) return null;
    const mention = '@' + participantJid.split('@')[0];
    let groupMeta;
    try { groupMeta = await conn.groupMetadata(groupId); } catch { groupMeta = null; }
    const memberCount = groupMeta?.participants?.length ?? '?';
    const kickTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const text = msg
        .replace(/@user/g, mention)
        .replace(/@members/g, String(memberCount))
        .replace(/@time/g, kickTime);

    return conn.sendMessage(groupId, { text, mentions: [participantJid] });
}

module.exports = { sendWelcome, sendGoodbye, sendKick };
