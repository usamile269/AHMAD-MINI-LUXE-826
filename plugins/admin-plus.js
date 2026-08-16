const { cmd } = require('../ahmad-core');
const config = require('../config');
const { fakevCard } = require('../lib/fakevCard');
const { sleep } = require('../lib/functions');
const { toFancyBold } = require('../lib/text-style');
const { randomFooter } = require('../lib/menu-styles');

const FOOTER = '> ' + randomFooter();

function chanCtx() {
    return {
        forwardingScore: 999, isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: config.CHANNEL_JID || '120363427856127926@newsletter',
            newsletterName: config.BOT_NAME || '™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 ᥫᩣ',
            serverMessageId: 2
        }
    };
}

function box(title, lines, emoji = '🛡️') {
    return `╭═══ ${emoji} ${title} ═══⊷\n┃❃╭──────────────\n${lines.map(l=>`┃❃│ ${l}`).join('\n')}\n┃❃╰───────────────\n╰═════════════════⊷\n\n${FOOTER}`;
}

async function send(conn, from, text) {
    return conn.sendMessage(from, { text: toFancyBold(text), contextInfo: chanCtx() }, { quoted: fakevCard });
}

// In-memory stores
const lockStore = {};
const antifloodStore = {};
const floodCount = {};
const pollStore = {};
const scheduleStore = {};

// ══════════════════════════════════════════
// ★ GROUP PROTECTION (10 cmds)
// ══════════════════════════════════════════

// 1. antispam
// 🚨 BUG FIX (name collision): plugins/group-extra.js's .antiflood also
// lists "antispam" as an alias and loads later alphabetically, so it
// silently owned .antispam — this simple on/off toggle (different from
// antiflood's limit/window/action config) was only reachable via
// .floodprotect, never its own documented .antispam name. Renamed to
// .spamguard so it's actually reachable under its own name again.
cmd({ pattern: 'spamguard', alias: ['floodprotect'], desc: 'Toggle flood/spam protection', category: 'group', react: '🛡️' },
async (conn, mek, m, { from, isGroup, isAdmins, args, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    if (!isAdmins) return reply('❌ Admins only');
    const val = args[0]?.toLowerCase();
    antifloodStore[from] = (val === 'on') ? true : (val === 'off') ? false : !antifloodStore[from];
    await send(conn, from, box('ANTISPAM', [`🛡️ Status: ${antifloodStore[from] ? '✅ ON — 5 msgs/5s limit' : '❌ OFF'}`]));
});

// 2. antibot
cmd({ pattern: 'antibot', alias: ['blockbots'], desc: 'Auto-kick other bots from group', category: 'group', react: '🤖' },
async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, args, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    if (!isAdmins) return reply('❌ Admins only');
    if (!isBotAdmins) return reply('❌ Make me admin first');
    const val = args[0]?.toLowerCase();
    config[`ANTIBOT_${from}`] = (val === 'on') ? 'true' : (val === 'off') ? 'false' : config[`ANTIBOT_${from}`] === 'true' ? 'false' : 'true';
    await send(conn, from, box('ANTIBOT', [`🤖 Status: ${config[`ANTIBOT_${from}`] === 'true' ? '✅ ON — Bots will be kicked' : '❌ OFF'}`]));
});

// 3. antidemote
cmd({ pattern: 'antidemote', alias: ['protectadmin'], desc: 'Prevent unauthorized demotions', category: 'group', react: '🛡️' },
async (conn, mek, m, { from, isGroup, isAdmins, args, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    if (!isAdmins) return reply('❌ Admins only');
    const val = args[0]?.toLowerCase();
    config[`ANTIDEMOTE_${from}`] = (val === 'on') ? 'true' : (val === 'off') ? 'false' : config[`ANTIDEMOTE_${from}`] === 'true' ? 'false' : 'true';
    await send(conn, from, box('ANTIDEMOTE', [`🛡️ Status: ${config[`ANTIDEMOTE_${from}`] === 'true' ? '✅ ON' : '❌ OFF'}`]));
});

// 3b. antipromote
// 🚨 BUG FIX (".antipromote on" did nothing / command didn't exist at all):
// .promote already stamped a `pendingGroupActions` entry so a real
// bot-issued promotion wouldn't get auto-reverted, and a comment in
// gc-setting.js referenced ".antipromote (main.js)" — but the command
// itself was never actually written anywhere, and there was no listener in
// main.js consuming that pending-actions map either. This adds the missing
// toggle; the actual enforcement (auto-demoting anyone promoted OUTSIDE the
// bot while this is ON) is wired into the group-participants.update
// listener in main.js.
cmd({ pattern: 'antipromote', desc: 'Auto-revert admin promotions not done via the bot', category: 'group', react: '🛡️' },
async (conn, mek, m, { from, isGroup, isAdmins, isOwner, args, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    if (!isAdmins && !isOwner) return reply('❌ Admins only');
    const val = args[0]?.toLowerCase();
    config[`ANTIPROMOTE_${from}`] = (val === 'on') ? 'true' : (val === 'off') ? 'false' : config[`ANTIPROMOTE_${from}`] === 'true' ? 'false' : 'true';
    await send(conn, from, box('ANTIPROMOTE', [`🛡️ Status: ${config[`ANTIPROMOTE_${from}`] === 'true' ? '✅ ON — unauthorized promotions auto-reverted' : '❌ OFF'}`]));
});

// 4. antiword
cmd({ pattern: 'antiword', alias: ['badwordfilter', 'wordfilter'], desc: 'Toggle bad word filter', category: 'group', react: '🚫' },
async (conn, mek, m, { from, isGroup, isAdmins, args, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    if (!isAdmins) return reply('❌ Admins only');
    const val = args[0]?.toLowerCase();
    config[`ANTIWORD_${from}`] = (val === 'on') ? 'true' : (val === 'off') ? 'false' : config[`ANTIWORD_${from}`] === 'true' ? 'false' : 'true';
    await send(conn, from, box('ANTIWORD', [`🚫 Status: ${config[`ANTIWORD_${from}`] === 'true' ? '✅ ON' : '❌ OFF'}`]));
});

// 5. poll
cmd({ pattern: 'lockchat', alias: ['lockedit', 'editlock'], desc: 'Lock group so only admins can edit info', category: 'group', react: '🔒' },
async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    if (!isAdmins) return reply('❌ Admins only');
    if (!isBotAdmins) return reply('❌ Make me admin first');
    try {
        await conn.groupSettingUpdate(from, 'locked');
        await send(conn, from, box('CHAT LOCKED', ['🔒 Only admins can edit group info now'], '🔒'));
    } catch (e) { reply(`❌ Failed: ${e.message}`); }
});

// 7. unlockchat
cmd({ pattern: 'unlockchat', alias: ['unlockedit', 'editunlock'], desc: 'Unlock group info editing for all', category: 'group', react: '🔓' },
async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    if (!isAdmins) return reply('❌ Admins only');
    if (!isBotAdmins) return reply('❌ Make me admin first');
    try {
        await conn.groupSettingUpdate(from, 'unlocked');
        await send(conn, from, box('CHAT UNLOCKED', ['🔓 Everyone can edit group info now'], '🔓'));
    } catch (e) { reply(`❌ Failed: ${e.message}`); }
});

// 8. kickoffline
cmd({ pattern: 'kickoffline', desc: 'Kick members who have no profile picture (likely inactive)', category: 'group', react: '👢' },
async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    if (!isAdmins) return reply('❌ Admins only');
    if (!isBotAdmins) return reply('❌ Make me admin first');
    const meta = await conn.groupMetadata(from);
    const members = meta.participants.filter(p => !p.admin);
    let kicked = 0;
    await send(conn, from, box('KICK OFFLINE', [`⏳ Checking ${members.length} members...`], '👢'));
    for (const p of members) {
        try {
            await conn.profilePictureUrl(p.id);
        } catch {
            try {
                await conn.groupParticipantsUpdate(from, [p.id], 'remove');
                kicked++;
                await sleep(800);
            } catch {}
        }
    }
    await send(conn, from, box('KICK OFFLINE DONE', [`✅ Kicked ${kicked} members with no profile pic`], '👢'));
});

// 9. softkick (kick then re-add)
cmd({ pattern: 'softkick', alias: ['resetmember'], desc: 'Kick and re-add a member (reset their status)', category: 'group', react: '🔄' },
async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, quoted, args, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    if (!isAdmins) return reply('❌ Admins only');
    if (!isBotAdmins) return reply('❌ Make me admin first');
    const target = quoted?.sender || (args[0] ? `${args[0].replace(/[^0-9]/g,'')}@s.whatsapp.net` : null);
    if (!target) return reply('❌ Reply to a member or give number');
    try {
        await conn.groupParticipantsUpdate(from, [target], 'remove');
        await sleep(1500);
        await conn.groupParticipantsUpdate(from, [target], 'add');
        await send(conn, from, box('SOFT KICK', [`✅ @${target.split('@')[0]} was reset (kicked + re-added)`], '🔄'), { mentions: [target] });
    } catch (e) { reply(`❌ Failed: ${e.message}`); }
});

// 10. mentionadmin
cmd({ pattern: 'mentionadmin', alias: ['calladmin', 'admin'], desc: 'Silently notify all admins', category: 'group', react: '📢' },
async (conn, mek, m, { from, isGroup, args, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    const meta = await conn.groupMetadata(from);
    const admins = meta.participants.filter(p => p.admin).map(p => p.id);
    const msg = args.join(' ') || '🚨 Admin needed!';
    await conn.sendMessage(from, {
        text: msg,
        mentions: admins,
        contextInfo: chanCtx()
    }, { quoted: fakevCard });
});

// ══════════════════════════════════════════
// ★ GROUP INFO / STATS (8 cmds)
// ══════════════════════════════════════════

// 11. groupstats
cmd({ pattern: 'groupstats', alias: ['gcstats', 'gstats'], desc: 'Show detailed group statistics', category: 'group', react: '📊' },
async (conn, mek, m, { from, isGroup, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    const meta = await conn.groupMetadata(from);
    const admins = meta.participants.filter(p => p.admin).length;
    const superAdmins = meta.participants.filter(p => p.admin === 'superadmin').length;
    const members = meta.participants.length - admins;
    const created = new Date(meta.creation * 1000);
    await send(conn, from, box('GROUP STATS 📊', [
        `📛 Name: ${meta.subject}`,
        `👥 Total: ${meta.participants.length}`,
        `👤 Members: ${members}`,
        `👑 Admins: ${admins}`,
        `⚡ Super Admins: ${superAdmins}`,
        `📅 Created: ${created.toLocaleDateString()}`,
        `🔗 ${meta.desc ? 'Has description' : 'No description'}`
    ], '📊'));
});

// 12. whoami
cmd({ pattern: 'whoami', alias: ['myinfo', 'mystatus'], desc: 'Check your own status in group', category: 'group', react: '👤' },
async (conn, mek, m, { from, sender, isGroup, isAdmins, isBotAdmins, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    await send(conn, from, box('MY STATUS', [
        `👤 JID: ${sender}`,
        `📱 Number: +${sender.split('@')[0]}`,
        `👑 Admin: ${isAdmins ? '✅ Yes' : '❌ No'}`,
        `🤖 Bot Admin: ${isBotAdmins ? '✅ Yes' : '❌ No'}`
    ], '👤'));
});

// 13. countmembers
cmd({ pattern: 'countmembers', alias: ['count', 'membercount'], desc: 'Count total members', category: 'group', react: '🔢' },
async (conn, mek, m, { from, isGroup, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    const meta = await conn.groupMetadata(from);
    await send(conn, from, box('MEMBER COUNT', [
        `👥 Total: ${meta.participants.length}`,
        `👤 Regular: ${meta.participants.filter(p=>!p.admin).length}`,
        `👑 Admins: ${meta.participants.filter(p=>p.admin).length}`
    ], '🔢'));
});

// 14. botrank
cmd({ pattern: 'botrank', alias: ['checkrank', 'rankcheck'], desc: 'Check bot rank in group', category: 'group', react: '🤖' },
async (conn, mek, m, { from, isGroup, isBotAdmins, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    const meta = await conn.groupMetadata(from);
    const botId = conn.user.id.split(':')[0] + '@s.whatsapp.net';
    const botInfo = meta.participants.find(p => p.id.includes(conn.user.id.split(':')[0]));
    await send(conn, from, box('BOT RANK', [
        `🤖 Bot: ${conn.user.name || 'Ahmad Bot'}`,
        `👑 Admin: ${isBotAdmins ? '✅ Yes' : '❌ No - Make me admin!'}`,
        `📦 Total Members: ${meta.participants.length}`,
        isBotAdmins ? '✅ All commands available!' : '⚠️ Limited access without admin!'
    ], '🤖'));
});

// 15. setdesc
cmd({ pattern: 'setdesc', alias: ['groupdesc', 'changedesc'], desc: 'Change group description', category: 'group', react: '📝' },
async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, args, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    if (!isAdmins) return reply('❌ Admins only');
    if (!isBotAdmins) return reply('❌ Make me admin first');
    const desc = args.join(' ');
    if (!desc) return reply('❌ Usage: .setdesc <new description>');
    try {
        await conn.groupUpdateDescription(from, desc);
        await send(conn, from, box('GROUP DESC', ['✅ Description updated!', `📝 "${desc.slice(0,60)}"`], '📝'));
    } catch (e) { reply(`❌ Failed: ${e.message}`); }
});

// 16. setsubject
cmd({ pattern: 'setsubject', alias: ['rename', 'changename'], desc: 'Change group name/subject', category: 'group', react: '✏️' },
async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, args, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    if (!isAdmins) return reply('❌ Admins only');
    if (!isBotAdmins) return reply('❌ Make me admin first');
    const name = args.join(' ');
    if (!name) return reply('❌ Usage: .setsubject <new name>');
    try {
        await conn.groupUpdateSubject(from, name);
        await send(conn, from, box('GROUP NAME', [`✅ Name changed to: ${name}`], '✏️'));
    } catch (e) { reply(`❌ Failed: ${e.message}`); }
});

// 17. opengroup
cmd({ pattern: 'opengroup', alias: ['open', 'ungategroup'], desc: 'Open group for join requests', category: 'group', react: '🟢' },
async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    if (!isAdmins) return reply('❌ Admins only');
    if (!isBotAdmins) return reply('❌ Make me admin first');
    try {
        await conn.groupJoinApprovalMode(from, 'off');
        await send(conn, from, box('GROUP OPEN', ['🟢 Anyone can now join with link (no approval needed)'], '🟢'));
    } catch (e) { reply(`❌ Failed: ${e.message}`); }
});

// 18. closegroup
const { renderCard } = require('../lib/menu-styles');
cmd({ pattern: 'closegroup', alias: ['close', 'gategroup', 'approvalmode'], desc: 'Require admin approval to join', category: 'group', react: '🔴' },
async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    if (!isAdmins) return reply('❌ Admins only');
    if (!isBotAdmins) return reply('❌ Make me admin first');
    try {
        await conn.groupJoinApprovalMode(from, 'on');
        await reply(renderCard('GROUP CLOSED', '🔴 Admin approval required to join now', '🔴'));
    } catch (e) { reply(`❌ Failed: ${e.message}`); }
});

// ══════════════════════════════════════════
// ★ BROADCAST / TAG EXTRAS (7 cmds)
// ══════════════════════════════════════════

// 19. tagall + message
cmd({ pattern: 'tagmsg', alias: ['announcetag', 'tagannounce'], desc: 'Tag all with a custom message', category: 'group', react: '📢' },
async (conn, mek, m, { from, isGroup, isAdmins, args, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    if (!isAdmins) return reply('❌ Admins only');
    const msg = args.join(' ');
    if (!msg) return reply('❌ Usage: .tagmsg <message>');
    const meta = await conn.groupMetadata(from);
    const mentions = meta.participants.map(p => p.id);
    const tags = mentions.map(id => `@${id.split('@')[0]}`).join(' ');
    await conn.sendMessage(from, {
        text: `╭═══ 📢 ANNOUNCEMENT ═══⊷\n┃❃│ ${msg}\n╰═════════════════⊷\n\n${tags}\n\n${FOOTER}`,
        mentions, contextInfo: chanCtx()
    }, { quoted: fakevCard });
});

// 20. tagactive (tag members who sent a message recently - simplified)
cmd({ pattern: 'tagadminsonly', alias: ['adminannounce'], desc: 'Send announcement to admins only (DM each admin)', category: 'group', react: '👑' },
async (conn, mek, m, { from, isGroup, isAdmins, args, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    if (!isAdmins) return reply('❌ Admins only');
    const msg = args.join(' ');
    if (!msg) return reply('❌ Usage: .tagadminsonly <message>');
    const meta = await conn.groupMetadata(from);
    const admins = meta.participants.filter(p => p.admin);
    let sent = 0;
    for (const admin of admins) {
        try {
            await conn.sendMessage(admin.id, {
                text: `╭═══ 👑 ADMIN MESSAGE ═══⊷\n┃❃│ 📛 Group: ${meta.subject}\n┃❃│ 📝 ${msg}\n╰═════════════════⊷\n\n${FOOTER}`
            });
            sent++;
            await sleep(1000);
        } catch {}
    }
    reply(box('ADMIN DM SENT', [`✅ Sent to ${sent}/${admins.length} admins`], '👑'));
});

// 21. delusermsg
cmd({ pattern: 'del', alias: ['deletemsg', 'delmsg', 'delete'], desc: 'Delete a message (reply to it)', category: 'group', react: '🗑️' },
async (conn, mek, m, { from, isAdmins, isBotAdmins, isOwner, quoted, reply }) => {
    if (!quoted) return reply('❌ Reply to a message to delete it');
    if (!isAdmins && !isOwner) return reply('❌ Admins only');
    if (!isBotAdmins) return reply('❌ Make me admin first');
    try {
        await conn.sendMessage(from, { delete: quoted.key });
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e) { reply(`❌ Failed: ${e.message}`); }
});

// 22. promoteall (promote all members to admin)
cmd({ pattern: 'promoteall', alias: ['adminall'], desc: 'Promote all members to admin (owner only)', category: 'group', react: '👑' },
async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    if (!isAdmins) return reply('❌ Admins only');
    if (!isBotAdmins) return reply('❌ Make me admin first');
    const meta = await conn.groupMetadata(from);
    const members = meta.participants.filter(p => !p.admin).map(p => p.id);
    if (!members.length) return reply('❌ No regular members to promote');
    let promoted = 0;
    for (const id of members) {
        try { await conn.groupParticipantsUpdate(from, [id], 'promote'); promoted++; await sleep(500); } catch {}
    }
    await send(conn, from, box('PROMOTE ALL', [`✅ Promoted ${promoted} members to admin`], '👑'));
});

// 23. grouppp (get group profile pic)
cmd({ pattern: 'grouppp', alias: ['gcpic', 'groupphoto'], desc: 'Get the group profile picture', category: 'group', react: '🖼️' },
async (conn, mek, m, { from, isGroup, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    try {
        const ppUrl = await conn.profilePictureUrl(from, 'image');
        await conn.sendMessage(from, {
            image: { url: ppUrl },
            caption: box('GROUP PIC', ['✅ Group profile picture'], '🖼️'),
            contextInfo: chanCtx()
        }, { quoted: fakevCard });
    } catch { reply('❌ No group profile picture found!'); }
});

// 24. getlink (quick invite link)
cmd({ pattern: 'getlink', alias: ['link', 'invite'], desc: 'Get group invite link quickly', category: 'group', react: '🔗' },
async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    if (!isAdmins) return reply('❌ Admins only');
    if (!isBotAdmins) return reply('❌ Make me admin first');
    try {
        const code = await conn.groupInviteCode(from);
        await send(conn, from, box('INVITE LINK', [`🔗 https://chat.whatsapp.com/${code}`], '🔗'));
    } catch (e) { reply(`❌ Failed: ${e.message}`); }
});

// 25. resetlink
cmd({ pattern: 'resetlink', alias: ['newlink'], desc: 'Reset/revoke the group invite link', category: 'group', react: '🔄' },
async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
    if (!isGroup) return reply('❌ Groups only');
    if (!isAdmins) return reply('❌ Admins only');
    if (!isBotAdmins) return reply('❌ Make me admin first');
    try {
        await conn.groupRevokeInvite(from);
        const newCode = await conn.groupInviteCode(from);
        await send(conn, from, box('LINK RESET', ['✅ Old link revoked!', `🔗 New: https://chat.whatsapp.com/${newCode}`], '🔄'));
    } catch (e) { reply(`❌ Failed: ${e.message}`); }
});
