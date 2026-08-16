// ============================================================================
// plugins/channel-crosspost.js — .chanpost
// ----------------------------------------------------------------------------
// Bunty's issue: posting the same thing to all 3 owned WhatsApp Channels
// separately took too long. This posts once and fans it out to every JID in
// config.CHANNEL_POST_JIDS in parallel — text, or reply to an image/video/
// audio to post that instead.
//
// ⚠️ Requirement: the bot's WhatsApp account must be the OWNER/ADMIN of each
// channel listed — exactly like the real app, you can't post into a channel
// you don't control. If a post fails for one channel, the others still go
// through; the reply tells you which succeeded/failed.
// ============================================================================

const { cmd } = require('../ahmad-core');
const { renderLuxe, renderError } = require('../lib/menu-styles');
const { addChannelRelay, removeChannelRelay, listChannelRelays } = require('../lib/database');

cmd({
    pattern: "chanpost",
    alias: ["postchannel", "crosspost"],
    desc: "Post text/media to all configured WhatsApp Channels at once",
    category: "owner",
    react: "📢",
    use: ".chanpost Hello everyone! (or reply to an image/video/audio)",
    filename: __filename
}, async (conn, mek, m, { isOwner, isMe, text, args, reply, config }) => {
    if (!isOwner) return reply(renderError('Owner only — locked to the configured OWNER_NUMBER, no matter who paired/deployed this bot.'));

    const jids = config.CHANNEL_POST_JIDS || config.AUTO_FOLLOW_JIDS || [];
    if (!jids.length) return reply(renderError('No channels configured — set CHANNEL_POST_JIDS in config.js.'));

    const caption = text || args.join(' ');
    let payload = null;

    try {
        if (m.quoted && m.quoted.mtype === 'imageMessage') {
            payload = { image: await m.quoted.download(), caption: caption || undefined };
        } else if (m.quoted && m.quoted.mtype === 'videoMessage') {
            payload = { video: await m.quoted.download(), caption: caption || undefined };
        } else if (m.quoted && m.quoted.mtype === 'audioMessage') {
            payload = { audio: await m.quoted.download(), mimetype: 'audio/mp4' };
        } else if (caption) {
            payload = { text: caption };
        } else {
            return reply(renderError('Usage: .chanpost <text>, or reply to an image/video/audio with .chanpost (optional caption).'));
        }
    } catch (e) {
        return reply(renderError("Couldn't read that media: " + e.message));
    }

    const results = await Promise.all(jids.map(async (jid) => {
        try {
            await conn.sendMessage(jid, payload);
            return { jid, ok: true };
        } catch (e) {
            return { jid, ok: false, error: e.message };
        }
    }));

    const lines = results.map(r => `${r.jid.split('@')[0]}: ${r.ok ? 'Posted' : 'Failed — ' + r.error}`);
    reply(renderLuxe('Channel Cross-Post', lines));
});

// ============================================================================
// .chnfor <source channel link or jid> <target channel jid> — SET UP AUTO-
// RELAY, once. From then on, every new post in the source channel is
// automatically copied to the target channel — no need to run this per post.
// (Bunty: "ek baar set karo, jab bhi us mein post ho, doosre mein auto ho jaye")
// The actual relay-on-new-post logic lives in main.js, right where channel
// posts arrive; this command only creates/lists/removes the mapping.
// ============================================================================
async function resolveChannelJid(conn, input) {
    input = input.trim();
    if (input.endsWith('@newsletter')) return input;
    // Accept a channel link, with or without a trailing /<messageId> —
    // e.g. https://whatsapp.com/channel/0029VbCNhy7BKfhvVOR9nz3X/952
    const match = input.match(/whatsapp\.com\/channel\/([A-Za-z0-9]+)/);
    if (!match) return null;
    const code = match[1];
    const meta = await conn.newsletterMetadata('invite', code);
    return meta?.id || null;
}

cmd({
    // 🆕 (Ahmad: ".chnfor yeh users kay lyay karo" — open this up, not
    // owner-only anymore) — any user of the bot can now set up their own
    // channel-to-channel auto-relay. Note: the bot's WhatsApp account still
    // has to be the OWNER/ADMIN of the target channel for the actual post to
    // go through (that part hasn't changed, it's a WhatsApp-side
    // requirement) — this just removes the "only +923044975027 can even run
    // the command" restriction. .chanpost stays owner-only since that one
    // posts straight into Ahmad's own specific channels.
    pattern: "chnfor",
    alias: ["forwardchannel", "chanforward", "channelrelay"],
    desc: "Set up auto-relay: new posts in one channel auto-copy to another",
    category: "tools",
    react: "📤",
    use: ".chnfor https://whatsapp.com/channel/0029VbCNhy7BKfhvVOR9nz3X/952 120363xxxx@newsletter",
    filename: __filename
}, async (conn, mek, m, { args, reply, config, sender, isOwner }) => {
    const sub = (args[0] || '').toLowerCase();
    if (sub === 'list') {
        // Owner-only escape hatch to see EVERYONE's relays at once,
        // matching the same "...all"-style pattern used elsewhere
        // (.antideleteall, .voviewpathall, etc) — deliberate, not implicit.
        const wantsAll = isOwner && (args[1] || '').toLowerCase() === 'all';
        const rows = await listChannelRelays(wantsAll ? null : sender);
        if (!rows.length) return reply(renderLuxe('Channel Relays', [wantsAll ? 'No relays set up by anyone yet.' : 'You haven\'t set up any relays yet.']));
        return reply(renderLuxe(wantsAll ? 'Channel Relays (Everyone)' : 'Your Channel Relays', rows.map(r => `${r.sourceJid.split('@')[0]} → ${r.targetJid.split('@')[0]}${wantsAll && r.createdBy ? ' (by ' + r.createdBy.split('@')[0] + ')' : ''}`)));
    }
    if (sub === 'remove') {
        const src = await resolveChannelJid(conn, args[1] || '');
        const tgt = await resolveChannelJid(conn, args[2] || '');
        if (!src || !tgt) return reply(renderError('Usage: .chnfor remove <source link/jid> <target link/jid>'));
        await removeChannelRelay(src, tgt, isOwner ? null : sender);
        return reply(renderLuxe('Channel Relay Removed', [`${src.split('@')[0]} → ${tgt.split('@')[0]}`]));
    }

    const [sourceRaw, targetRaw] = args;
    if (!sourceRaw) {
        return reply(renderError(
            'Usage:\n' +
            '.chnfor <target jid>  → relays FROM your main channel (CHANNEL_JID) TO this target\n' +
            '.chnfor <source link/jid> <target jid>  → relays between any two channels\n\n' +
            'Also: .chnfor list  •  .chnfor remove <source> <target>'
        ));
    }

    // One argument = treat it as the target and default source to the bot's
    // main configured channel (config.CHANNEL_JID).
    const usingDefaultSource = !targetRaw;
    const effectiveSourceRaw = usingDefaultSource ? config.CHANNEL_JID : sourceRaw;
    const effectiveTargetRaw = usingDefaultSource ? sourceRaw : targetRaw;

    if (usingDefaultSource && !effectiveSourceRaw) {
        return reply(renderError('No default source channel configured (config.CHANNEL_JID is empty) — pass the source explicitly: .chnfor <source> <target>'));
    }

    try {
        const sourceJid = await resolveChannelJid(conn, effectiveSourceRaw);
        const targetJid = await resolveChannelJid(conn, effectiveTargetRaw);
        if (!sourceJid) return reply(renderError("Couldn't resolve the source channel — check the link/jid."));
        if (!targetJid) return reply(renderError("Couldn't resolve the target channel — check the link/jid."));

        // 🚨 THE ACTUAL SPAM-LOOP FIX (Bunty: "source channel me hi post
        // back-to-back spam ho rahi") — if source and target resolve to the
        // SAME channel (easy to do by accident, e.g. with the single-arg
        // default-source form above), every relay reposts into the same
        // channel, which then fires the relay again on its own copy — an
        // infinite, ever-escalating loop, all inside one channel. Reject it.
        if (sourceJid === targetJid) {
            return reply(renderError("Source and target are the same channel — that would spam-loop the channel with its own posts. Pick a different target."));
        }

        // Bot must be following the source to actually receive its new posts.
        try { await conn.newsletterFollow(sourceJid); } catch (_) {}

        await addChannelRelay(sourceJid, targetJid, sender);
        reply(renderLuxe('Channel Auto-Relay Set', [
            `Source: ${sourceJid.split('@')[0]}`,
            `Target: ${targetJid.split('@')[0]}`,
            'Every new post in the source will now auto-copy to the target.',
            'Remove anytime: .chnfor remove <source> <target>'
        ]));
    } catch (e) {
        reply(renderError(`Couldn't set up the relay: ${e.message}`));
    }
});
