// ============================================================================
// plugins/group-extra.js — extra group (gc) commands, requested by Ahmad:
// "cmds gc may more add karo... attractive karo, animations add karo".
// Adds badword filtering, slowmode, night-mode auto-lock, media lock, a
// per-group auto-react emoji, member export tools, and an animated group
// status card — on top of what group-management.js / gc-setting.js /
// admin-plus.js already cover (kick/promote/tagall/antilink/warnings etc).
// ============================================================================
const { cmd } = require('../ahmad-core');
const { getGroupSettings, setGroupSettings } = require('../data/GroupSettings');
const { renderInfoBox, randomFooter } = require('../lib/menu-styles');
const { playFrames, progressFrames } = require('../lib/animate');
const groupExtraCache = require('../lib/group-extra-cache');

const FOOTER = () => `\n\n> ${randomFooter()}`;

// ============================================================
// BADWORD LIST — .addbadword / .delbadword / .badwords
// ============================================================
cmd({
    pattern: "addbadword",
    alias: ["banword"],
    desc: "Add a word to this group's banned-word filter",
    category: "group",
    react: "🚫"
}, async (conn, mek, m, { from, isGroup, isAdmins, isOwner, q, reply }) => {
    if (!isGroup) return reply("❌ This command only works in groups.");
    if (!isAdmins && !isOwner) return reply("❌ Only group admins can use this command.");
    if (!q) return reply("❌ Usage: .addbadword <word>");
    const word = q.trim().toLowerCase();
    const settings = await getGroupSettings(from);
    const badwords = settings.badwords || [];
    if (badwords.includes(word)) return reply(`⚠️ ${word} is already banned in this group.`);
    badwords.push(word);
    await setGroupSettings(from, { badwords });
    groupExtraCache.invalidate(from);
    reply(`✅ Added ${word} to the banned-word list (${badwords.length} total).` + FOOTER());
});

cmd({
    pattern: "delbadword",
    alias: ["removebadword", "unbanword"],
    desc: "Remove a word from this group's banned-word filter",
    category: "group",
    react: "✅"
}, async (conn, mek, m, { from, isGroup, isAdmins, isOwner, q, reply }) => {
    if (!isGroup) return reply("❌ This command only works in groups.");
    if (!isAdmins && !isOwner) return reply("❌ Only group admins can use this command.");
    if (!q) return reply("❌ Usage: .delbadword <word>");
    const word = q.trim().toLowerCase();
    const settings = await getGroupSettings(from);
    const badwords = (settings.badwords || []).filter(w => w !== word);
    await setGroupSettings(from, { badwords });
    groupExtraCache.invalidate(from);
    reply(`✅ Removed ${word} from the banned-word list.` + FOOTER());
});

cmd({
    pattern: "badwords",
    alias: ["listbadwords", "wordfilterlist"],
    desc: "List this group's banned words",
    category: "group",
    react: "📋"
}, async (conn, mek, m, { from, isGroup, reply }) => {
    if (!isGroup) return reply("❌ This command only works in groups.");
    const settings = await getGroupSettings(from);
    const badwords = settings.badwords || [];
    if (!badwords.length) return reply("📋 No banned words set yet. Use .addbadword <word>." + FOOTER());
    reply(renderInfoBox('Banned Words', badwords.map((w, i) => ({ emoji: '🚫', label: `${i + 1}.`, value: w }))));
});

// ============================================================
// SLOWMODE — .slowmode <seconds|off>
// ============================================================
cmd({
    pattern: "slowmode",
    desc: "Limit how often each member can send messages",
    category: "group",
    react: "🐢"
}, async (conn, mek, m, { from, isGroup, isAdmins, isOwner, args, reply }) => {
    if (!isGroup) return reply("❌ This command only works in groups.");
    if (!isAdmins && !isOwner) return reply("❌ Only group admins can use this command.");
    const arg = (args[0] || '').toLowerCase();
    if (!arg) {
        const settings = await getGroupSettings(from);
        return reply(renderInfoBox('Slowmode', [
            { emoji: '🐢', label: 'Status', value: settings.slowmodeSec > 0 ? `${settings.slowmodeSec}s between messages` : 'OFF' },
            { emoji: '💡', label: 'Use', value: '.slowmode 10 (or .slowmode off)' }
        ]));
    }
    if (arg === 'off' || arg === '0') {
        await setGroupSettings(from, { slowmodeSec: 0 });
    groupExtraCache.invalidate(from);
        return reply("✅ Slowmode disabled." + FOOTER());
    }
    const sec = parseInt(arg, 10);
    if (isNaN(sec) || sec < 1 || sec > 3600) return reply("❌ Usage: .slowmode <seconds 1-3600> or .slowmode off");
    await setGroupSettings(from, { slowmodeSec: sec });
    groupExtraCache.invalidate(from);
    reply(`✅ Slowmode set — members can send 1 message every ${sec}s.` + FOOTER());
});

// ============================================================
// ANTI-FLOOD — .antiflood on/off | .antiflood <limit> <windowSec> | .antiflood action warn/kick
// ============================================================
cmd({
    pattern: "antiflood",
    alias: ["gcantiflood", "antispam"],
    desc: "Auto-warn/kick members who send too many messages too fast",
    category: "group",
    react: "🌊"
}, async (conn, mek, m, { from, isGroup, isAdmins, isOwner, args, reply }) => {
    if (!isGroup) return reply("❌ This command only works in groups.");
    if (!isAdmins && !isOwner) return reply("❌ Only group admins can use this command.");
    const sub = (args[0] || '').toLowerCase();

    if (!sub) {
        const s = await getGroupSettings(from);
        return reply(renderInfoBox('Anti-Flood', [
            { emoji: '🌊', label: 'Status', value: s.antiflood ? 'ON' : 'OFF' },
            { emoji: '⚙️', label: 'Limit', value: `${s.antifloodLimit || 6} msgs / ${s.antifloodWindowSec || 10}s` },
            { emoji: '⚙️', label: 'Action', value: (s.antifloodAction || 'warn').toUpperCase() },
            { emoji: '💡', label: 'Use', value: '.antiflood on/off | .antiflood limit 6 10 | .antiflood action warn/kick' }
        ]));
    }

    if (sub === 'on') {
        await setGroupSettings(from, { antiflood: true });
        groupExtraCache.invalidate(from);
        return reply("✅ Anti-flood enabled." + FOOTER());
    }
    if (sub === 'off') {
        await setGroupSettings(from, { antiflood: false });
        groupExtraCache.invalidate(from);
        return reply("✅ Anti-flood disabled." + FOOTER());
    }
    if (sub === 'limit') {
        const limit = parseInt(args[1], 10);
        const windowSec = parseInt(args[2], 10);
        if (!limit || !windowSec || limit < 2 || limit > 100 || windowSec < 2 || windowSec > 300) {
            return reply("❌ Usage: .antiflood limit <msgs 2-100> <seconds 2-300>");
        }
        await setGroupSettings(from, { antifloodLimit: limit, antifloodWindowSec: windowSec });
        groupExtraCache.invalidate(from);
        return reply(`✅ Anti-flood limit set — ${limit} msgs / ${windowSec}s.` + FOOTER());
    }
    if (sub === 'action') {
        const action = (args[1] || '').toLowerCase();
        if (!['warn', 'kick'].includes(action)) return reply("❌ Usage: .antiflood action warn|kick");
        await setGroupSettings(from, { antifloodAction: action });
        groupExtraCache.invalidate(from);
        return reply(`✅ Anti-flood action set to ${action.toUpperCase()}.` + FOOTER());
    }
    reply("❌ Usage: .antiflood on/off | .antiflood limit <msgs> <sec> | .antiflood action warn/kick");
});

// ============================================================
// NIGHT MODE — .nightmode <HH:MM-HH:MM|off>
// ============================================================
cmd({
    pattern: "nightmode",
    alias: ["gcnightmode"],
    desc: "Auto-restrict the group to admins-only during set hours",
    category: "group",
    react: "🌙"
}, async (conn, mek, m, { from, isGroup, isAdmins, isOwner, args, reply }) => {
    if (!isGroup) return reply("❌ This command only works in groups.");
    if (!isAdmins && !isOwner) return reply("❌ Only group admins can use this command.");
    const arg = (args[0] || '').toLowerCase();
    if (!arg) {
        const settings = await getGroupSettings(from);
        return reply(renderInfoBox('Night Mode', [
            { emoji: '🌙', label: 'Status', value: settings.nightMode ? `${settings.nightMode.start}–${settings.nightMode.end}` : 'OFF' },
            { emoji: '💡', label: 'Use', value: '.nightmode 23:00-06:00 (or .nightmode off)' }
        ]));
    }
    if (arg === 'off') {
        await setGroupSettings(from, { nightMode: null });
    groupExtraCache.invalidate(from);
        return reply("✅ Night mode disabled." + FOOTER());
    }
    const match = arg.match(/^(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})$/);
    if (!match) return reply("❌ Usage: .nightmode 23:00-06:00 (24-hour format)");
    const [, sh, sm, eh, em] = match;
    const start = `${sh.padStart(2, '0')}:${sm}`;
    const end = `${eh.padStart(2, '0')}:${em}`;
    await setGroupSettings(from, { nightMode: { start, end } });
    groupExtraCache.invalidate(from);
    reply(`✅ Night mode set — non-admins are muted from ${start} to ${end} daily.` + FOOTER());
});

// ============================================================
// MEDIA LOCK — .lockmedia / .unlockmedia
// ============================================================
cmd({
    pattern: "lockmedia",
    alias: ["mediaoff"],
    desc: "Only allow admins to send media (images/video/docs)",
    category: "group",
    react: "🔒"
}, async (conn, mek, m, { from, isGroup, isAdmins, isOwner, reply }) => {
    if (!isGroup) return reply("❌ This command only works in groups.");
    if (!isAdmins && !isOwner) return reply("❌ Only group admins can use this command.");
    await setGroupSettings(from, { mediaLock: true });
    groupExtraCache.invalidate(from);
    reply("🔒 Media locked — only admins can send images/video/docs now." + FOOTER());
});

cmd({
    pattern: "unlockmedia",
    alias: ["mediaon"],
    desc: "Allow everyone to send media again",
    category: "group",
    react: "🔓"
}, async (conn, mek, m, { from, isGroup, isAdmins, isOwner, reply }) => {
    if (!isGroup) return reply("❌ This command only works in groups.");
    if (!isAdmins && !isOwner) return reply("❌ Only group admins can use this command.");
    await setGroupSettings(from, { mediaLock: false });
    groupExtraCache.invalidate(from);
    reply("🔓 Media unlocked — everyone can send media again." + FOOTER());
});

// ============================================================
// GROUP EMOJI — .groupemoji <emoji|off>
// ============================================================
cmd({
    pattern: "groupemoji",
    alias: ["autoreactgc"],
    desc: "Auto-react to every message in this group with a chosen emoji",
    category: "group",
    react: "😍"
}, async (conn, mek, m, { from, isGroup, isAdmins, isOwner, args, reply }) => {
    if (!isGroup) return reply("❌ This command only works in groups.");
    if (!isAdmins && !isOwner) return reply("❌ Only group admins can use this command.");
    const arg = args[0];
    if (!arg) {
        const settings = await getGroupSettings(from);
        return reply(renderInfoBox('Group Emoji', [
            { emoji: settings.groupEmoji || '➖', label: 'Current', value: settings.groupEmoji || 'OFF' },
            { emoji: '💡', label: 'Use', value: '.groupemoji 🔥 (or .groupemoji off)' }
        ]));
    }
    if (arg.toLowerCase() === 'off') {
        await setGroupSettings(from, { groupEmoji: null });
    groupExtraCache.invalidate(from);
        return reply("✅ Group auto-react disabled." + FOOTER());
    }
    await setGroupSettings(from, { groupEmoji: arg });
    groupExtraCache.invalidate(from);
    reply(`✅ The bot will now react ${arg} to every message in this group.` + FOOTER());
});

// ============================================================
// GROUP AGE — .groupage
// ============================================================
cmd({
    pattern: "groupage",
    alias: ["gcage", "groupcreated"],
    desc: "Show how old this group is",
    category: "group",
    react: "📅"
}, async (conn, mek, m, { from, isGroup, groupMetadata, reply }) => {
    if (!isGroup) return reply("❌ This command only works in groups.");
    try {
        const meta = groupMetadata || await conn.groupMetadata(from);
        const createdMs = (meta.creation || 0) * 1000;
        const createdDate = createdMs ? new Date(createdMs) : null;
        const ageDays = createdDate ? Math.floor((Date.now() - createdMs) / 86400000) : null;
        reply(renderInfoBox('Group Age', [
            { emoji: '📅', label: 'Created', value: createdDate ? createdDate.toDateString() : 'Unknown' },
            { emoji: '⏳', label: 'Age', value: ageDays !== null ? `${ageDays} days` : 'Unknown' }
        ]));
    } catch (e) {
        reply("❌ Couldn't fetch group creation date.");
    }
});

// ============================================================
// MEMBER EXPORT — .exportmembers / .groupvcf  (animated, sends a file)
// ============================================================
cmd({
    pattern: "exportmembers",
    alias: ["memberexport", "exportlist"],
    desc: "Export the group member list as a .txt file",
    category: "group",
    react: "📄"
}, async (conn, mek, m, { from, isGroup, isAdmins, isOwner, participants, reply }) => {
    if (!isGroup) return reply("❌ This command only works in groups.");
    if (!isAdmins && !isOwner) return reply("❌ Only group admins can use this command.");
    try {
        const frames = progressFrames('📄 EXPORTING MEMBERS', [
            { percent: 30, label: 'Reading participants...' },
            { percent: 70, label: 'Building file...' }
        ], 'Done — sending file below ✅');
        await playFrames(conn, from, mek, frames, 700);

        const lines = participants.map((p, i) => `${i + 1}. ${p.id.split('@')[0]}${p.admin ? ' (admin)' : ''}`);
        const content = Buffer.from(lines.join('\n'), 'utf-8');
        await conn.sendMessage(from, {
            document: content,
            mimetype: 'text/plain',
            fileName: 'members.txt',
            caption: `📄 ${participants.length} members exported` + FOOTER()
        }, { quoted: mek });
    } catch (e) {
        reply("❌ Failed to export members: " + e.message);
    }
});

cmd({
    pattern: "groupvcf",
    alias: ["exportvcf", "membervcf"],
    desc: "Export all group members as a .vcf contact file",
    category: "group",
    react: "📇"
}, async (conn, mek, m, { from, isGroup, isAdmins, isOwner, participants, groupMetadata, reply }) => {
    if (!isGroup) return reply("❌ This command only works in groups.");
    if (!isAdmins && !isOwner) return reply("❌ Only group admins can use this command.");
    try {
        const frames = progressFrames('📇 BUILDING VCF', [
            { percent: 40, label: 'Reading contacts...' },
            { percent: 80, label: 'Formatting vCards...' }
        ], 'Done — sending file below ✅');
        await playFrames(conn, from, mek, frames, 700);

        const groupName = groupMetadata?.subject || 'Group';
        const vcf = participants.map((p, i) => {
            const num = p.id.split('@')[0];
            return `BEGIN:VCARD\nVERSION:3.0\nFN:${groupName} Member ${i + 1}\nTEL;type=CELL;type=VOICE;waid=${num}:+${num}\nEND:VCARD`;
        }).join('\n');
        await conn.sendMessage(from, {
            document: Buffer.from(vcf, 'utf-8'),
            mimetype: 'text/vcard',
            fileName: `${groupName.replace(/[^a-z0-9]/gi, '_')}.vcf`,
            caption: `📇 ${participants.length} contacts exported` + FOOTER()
        }, { quoted: mek });
    } catch (e) {
        reply("❌ Failed to export contacts: " + e.message);
    }
});

// ============================================================
// GROUP STATUS — .gcstatus  (animated summary card)
// ============================================================
cmd({
    pattern: "gcshield",
    alias: ["gcprotectioninfo", "groupstatuscard"],
    desc: "Animated summary of this group's active protections/settings",
    category: "group",
    react: "🛡️"
}, async (conn, mek, m, { from, isGroup, participants, reply }) => {
    if (!isGroup) return reply("❌ This command only works in groups.");
    try {
        const frames = progressFrames('🛡️ SCANNING GROUP', [
            { percent: 25, label: 'Checking anti-link...' },
            { percent: 50, label: 'Checking slowmode / night mode...' },
            { percent: 80, label: 'Checking word filter / media lock...' }
        ]);
        await playFrames(conn, from, mek, frames, 650);

        const settings = await getGroupSettings(from);
        const box = renderInfoBox('Group Status', [
            { emoji: '👥', label: 'Members', value: participants.length },
            { emoji: settings.antilink ? '✅' : '❌', label: 'Anti-Link', value: settings.antilink ? `ON (${settings.antilinkAction})` : 'OFF' },
            { emoji: settings.slowmodeSec > 0 ? '🐢' : '❌', label: 'Slowmode', value: settings.slowmodeSec > 0 ? `${settings.slowmodeSec}s` : 'OFF' },
            { emoji: settings.nightMode ? '🌙' : '❌', label: 'Night Mode', value: settings.nightMode ? `${settings.nightMode.start}–${settings.nightMode.end}` : 'OFF' },
            { emoji: settings.mediaLock ? '🔒' : '🔓', label: 'Media Lock', value: settings.mediaLock ? 'ON' : 'OFF' },
            { emoji: (settings.badwords || []).length ? '🚫' : '❌', label: 'Banned Words', value: (settings.badwords || []).length },
            { emoji: settings.antiforward ? '🚫' : '❌', label: 'Anti-Forward', value: settings.antiforward ? `ON (${settings.antiforwardAction})` : 'OFF' },
            { emoji: settings.groupEmoji || '➖', label: 'Group Emoji', value: settings.groupEmoji || 'OFF' },
        ]);
        reply(box);
    } catch (e) {
        reply("❌ Couldn't load group status.");
    }
});

// ============================================================
// ANTI-TAG — .antitag on/off | .antitag limit <n> | .antitag action warn/kick
// ============================================================
cmd({
    pattern: "antitag",
    alias: ["antimention", "antieveryone"],
    desc: "Block non-admins from mass-mentioning the group",
    category: "group",
    react: "🏷️"
}, async (conn, mek, m, { from, isGroup, isAdmins, isOwner, args, reply }) => {
    if (!isGroup) return reply("❌ This command only works in groups.");
    if (!isAdmins && !isOwner) return reply("❌ Only group admins can use this command.");
    const sub = (args[0] || '').toLowerCase();

    if (!sub) {
        const s = await getGroupSettings(from);
        return reply(renderInfoBox('Anti-Tag', [
            { emoji: '🏷️', label: 'Status', value: s.antitag ? 'ON' : 'OFF' },
            { emoji: '⚙️', label: 'Limit', value: `${s.antitagLimit || 5} mentions` },
            { emoji: '⚙️', label: 'Action', value: (s.antitagAction || 'warn').toUpperCase() },
            { emoji: '💡', label: 'Use', value: '.antitag on/off | .antitag limit 5 | .antitag action warn/kick' }
        ]));
    }
    if (sub === 'on') {
        await setGroupSettings(from, { antitag: true });
        groupExtraCache.invalidate(from);
        return reply("✅ Anti-tag enabled." + FOOTER());
    }
    if (sub === 'off') {
        await setGroupSettings(from, { antitag: false });
        groupExtraCache.invalidate(from);
        return reply("✅ Anti-tag disabled." + FOOTER());
    }
    if (sub === 'limit') {
        const limit = parseInt(args[1], 10);
        if (!limit || limit < 2 || limit > 200) return reply("❌ Usage: .antitag limit <mentions 2-200>");
        await setGroupSettings(from, { antitagLimit: limit });
        groupExtraCache.invalidate(from);
        return reply(`✅ Anti-tag limit set — ${limit} mentions.` + FOOTER());
    }
    if (sub === 'action') {
        const action = (args[1] || '').toLowerCase();
        if (!['warn', 'kick'].includes(action)) return reply("❌ Usage: .antitag action warn|kick");
        await setGroupSettings(from, { antitagAction: action });
        groupExtraCache.invalidate(from);
        return reply(`✅ Anti-tag action set to *${action.toUpperCase()}*.` + FOOTER());
    }
    reply("❌ Usage: .antitag on/off | .antitag limit <n> | .antitag action warn/kick");
});

// ============================================================
// ANTI-STICKER — .antisticker on/off
// ============================================================
cmd({
    pattern: "antisticker",
    alias: ["nosticker", "stickerlock"],
    desc: "Auto-delete stickers sent by non-admins",
    category: "group",
    react: "🎭"
}, async (conn, mek, m, { from, isGroup, isAdmins, isOwner, args, reply }) => {
    if (!isGroup) return reply("❌ This command only works in groups.");
    if (!isAdmins && !isOwner) return reply("❌ Only group admins can use this command.");
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'on') {
        await setGroupSettings(from, { antisticker: true });
        groupExtraCache.invalidate(from);
        return reply("✅ Anti-sticker enabled — stickers from non-admins will be deleted." + FOOTER());
    }
    if (sub === 'off') {
        await setGroupSettings(from, { antisticker: false });
        groupExtraCache.invalidate(from);
        return reply("✅ Anti-sticker disabled." + FOOTER());
    }
    const s = await getGroupSettings(from);
    reply(renderInfoBox('Anti-Sticker', [
        { emoji: '🎭', label: 'Status', value: s.antisticker ? 'ON' : 'OFF' },
        { emoji: '💡', label: 'Use', value: '.antisticker on/off' }
    ]));
});

// ============================================================
// ANTI-KICK (admin protection) — .antikick on/off
// Re-adds + flags an admin removed outside the bot's own .kick command.
// ============================================================
cmd({
    pattern: "antikick",
    alias: ["protectadmins", "adminshield"],
    desc: "Protect admins — re-add if removed outside the bot's own .kick",
    category: "group",
    react: "🛡️"
}, async (conn, mek, m, { from, isGroup, isAdmins, isOwner, args, reply }) => {
    if (!isGroup) return reply("❌ This command only works in groups.");
    if (!isAdmins && !isOwner) return reply("❌ Only group admins can use this command.");
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'on') {
        await setGroupSettings(from, { antikick: true });
        return reply("✅ Anti-kick enabled — admins removed outside .kick will be re-added." + FOOTER());
    }
    if (sub === 'off') {
        await setGroupSettings(from, { antikick: false });
        return reply("✅ Anti-kick disabled." + FOOTER());
    }
    const s = await getGroupSettings(from);
    reply(renderInfoBox('Anti-Kick', [
        { emoji: '🛡️', label: 'Status', value: s.antikick ? 'ON' : 'OFF' },
        { emoji: '💡', label: 'Use', value: '.antikick on/off' },
        { emoji: 'ℹ️', label: 'Note', value: 'Only protects admins, not regular members' }
    ]));
});

// ============================================================
// ANTI-CONTACT (user protection) — .anticontact on/off
// ============================================================
cmd({
    pattern: "anticontact",
    alias: ["novcard", "contactlock"],
    desc: "Auto-delete contact card (vCard) spam from non-admins",
    category: "group",
    react: "📇"
}, async (conn, mek, m, { from, isGroup, isAdmins, isOwner, args, reply }) => {
    if (!isGroup) return reply("❌ This command only works in groups.");
    if (!isAdmins && !isOwner) return reply("❌ Only group admins can use this command.");
    const sub = (args[0] || '').toLowerCase();

    if (sub === 'on') {
        await setGroupSettings(from, { anticontact: true });
        groupExtraCache.invalidate(from);
        return reply("✅ Anti-contact enabled — contact cards from non-admins will be deleted." + FOOTER());
    }
    if (sub === 'off') {
        await setGroupSettings(from, { anticontact: false });
        groupExtraCache.invalidate(from);
        return reply("✅ Anti-contact disabled." + FOOTER());
    }
    const s = await getGroupSettings(from);
    reply(renderInfoBox('Anti-Contact', [
        { emoji: '📇', label: 'Status', value: s.anticontact ? 'ON' : 'OFF' },
        { emoji: '💡', label: 'Use', value: '.anticontact on/off' }
    ]));
});

// ============================================================
// ANTI-FORWARD — .antiforward on/off | .antiforward action delete/warn/kick
// ============================================================
cmd({
    pattern: "antiforward",
    alias: ["antifwd", "gcantiforward"],
    desc: "Auto-delete/warn/kick members who forward messages from channels",
    category: "group",
    react: "🚫"
}, async (conn, mek, m, { from, isGroup, isAdmins, isOwner, args, reply }) => {
    if (!isGroup) return reply("❌ This command only works in groups.");
    if (!isAdmins && !isOwner) return reply("❌ Only group admins can use this command.");
    const sub = (args[0] || '').toLowerCase();

    if (!sub) {
        const s = await getGroupSettings(from);
        return reply(renderInfoBox('Anti-Forward', [
            { emoji: '🚫', label: 'Status', value: s.antiforward ? 'ON' : 'OFF' },
            { emoji: '⚙️', label: 'Action', value: (s.antiforwardAction || 'delete').toUpperCase() },
            { emoji: '💡', label: 'Use', value: '.antiforward on/off | .antiforward action delete/warn/kick' }
        ]));
    }

    if (sub === 'on') {
        await setGroupSettings(from, { antiforward: true });
        groupExtraCache.invalidate(from);
        return reply("✅ Anti-forward enabled — channel posts forwarded by non-admins will be handled." + FOOTER());
    }
    if (sub === 'off') {
        await setGroupSettings(from, { antiforward: false });
        groupExtraCache.invalidate(from);
        return reply("✅ Anti-forward disabled." + FOOTER());
    }
    if (sub === 'action') {
        const action = (args[1] || '').toLowerCase();
        if (!['delete', 'warn', 'kick'].includes(action)) return reply("❌ Usage: .antiforward action delete|warn|kick");
        await setGroupSettings(from, { antiforwardAction: action });
        groupExtraCache.invalidate(from);
        return reply(`✅ Anti-forward action set to ${action.toUpperCase()}.` + FOOTER());
    }
    reply("❌ Usage: .antiforward on/off | .antiforward action delete/warn/kick");
});
