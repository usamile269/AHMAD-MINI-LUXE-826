const { cmd } = require('../ahmad-core');
const config = require('../config');

const { getInactiveMembers } = require('../data/GroupActivity');
const { toSansBold } = require('../lib/menu-styles');

function fail(reply, msg) {
    return reply(`❌ ${toSansBold(msg)}`);
}

// ==================== KICK INACTIVE MEMBERS ====================
// 🆕 (Ahmad: "group management mein naya command chahiye") — kicks members
// who haven't sent a message in this group for N days. Uses activity data
// collected as people chat (see data/GroupActivity.js) — members never seen
// active at all (e.g. tracking only just started, or they joined and never
// spoke) are shown separately and NOT auto-kicked, since silence isn't
// proof of inactivity until we've actually observed them being active
// before and then going quiet.
cmd({
    pattern: "kickinactive",
    alias: ["kickafk", "removeinactive"],
    desc: "🚪 Kick members inactive for N days (default 30)",
    category: "group",
    react: "🚪",
    use: ".kickinactive [days] — e.g. .kickinactive 30"
}, async (conn, mek, m, { from, isGroup, isCreator, isBotAdmins, groupMetadata, args, reply }) => {
    try {
        if (!isGroup) return fail(reply, "This is a group-only command.");
        if (!isCreator) return fail(reply, "Only bot owner can use this.");
        if (!isBotAdmins) return fail(reply, "Bot needs to be admin for this.");

        const days = parseInt(args[0], 10) || 30;
        if (days < 1) return fail(reply, "Days must be at least 1.");

        const allParticipants = groupMetadata.participants
            .filter(p => !p.admin) // never touch admins automatically
            .map(p => p.id);

        const inactive = await getInactiveMembers(from, allParticipants, days);
        if (!inactive.length) {
            return reply(`✅ ${toSansBold(`No tracked members inactive for ${days}+ days. Nobody to kick.`)}`);
        }

        for (const jid of inactive) {
            await conn.groupParticipantsUpdate(from, [jid], "remove").catch(() => {});
        }
        reply(`✅ ${toSansBold(`Kicked ${inactive.length} member(s) inactive for ${days}+ days.`)}`);
    } catch (e) { fail(reply, "Failed. " + e.message); }
});

// ==================== ADD MEMBER ====================
cmd({
    pattern: "kickadmins",
    desc: "➖ Remove all admins (except owner)",
    category: "group",
    react: "⚠️",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isCreator, isBotAdmins, groupMetadata, reply }) => {
    try {
        if (!isGroup) return fail(reply, "This is a group-only command.");
        if (!isCreator) return fail(reply, "Only bot owner can use this.");
        if (!isBotAdmins) return fail(reply, "Bot needs to be admin for this.");
        const admins = groupMetadata.participants.filter(p => p.admin && !p.admin.includes("superadmin")).map(p => p.id);
        if (!admins.length) return reply("No removable admins found.");
        for (const jid of admins) {
            await conn.groupParticipantsUpdate(from, [jid], "remove").catch(() => {});
        }
        reply(`✅ ${toSansBold(`Removed ${admins.length} admins.`)}`);
    } catch (e) { fail(reply, "Failed. " + e.message); }
});

// ==================== PROMOTE ====================
cmd({
    pattern: "setgname",
    desc: "✏️ Change group name",
    category: "group",
    react: "✏️",
    use: ".setgname New Name",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, args, reply }) => {
    try {
        if (!isGroup) return fail(reply, "This is a group-only command.");
        if (!isAdmins) return fail(reply, "Only group admins can use this.");
        if (!isBotAdmins) return fail(reply, "Bot needs to be admin for this.");
        const name = args.join(" ");
        if (!name) return fail(reply, "Use: .setgname New Name");
        await conn.groupUpdateSubject(from, name);
        reply(`✅ ${toSansBold('Group name changed to:')} ${toSansBold(name)}`);
    } catch (e) { fail(reply, "Failed. " + e.message); }
});

// ==================== SETGDESC ====================
cmd({
    pattern: "setgdesc",
    desc: "📝 Change group description",
    category: "group",
    react: "📝",
    use: ".setgdesc New description",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, args, reply }) => {
    try {
        if (!isGroup) return fail(reply, "This is a group-only command.");
        if (!isAdmins) return fail(reply, "Only group admins can use this.");
        if (!isBotAdmins) return fail(reply, "Bot needs to be admin for this.");
        const desc = args.join(" ");
        if (!desc) return fail(reply, "Use: .setgdesc New description");
        await conn.groupUpdateDescription(from, desc);
        reply(`✅ ${toSansBold('Group description updated.')}`);
    } catch (e) { fail(reply, "Failed. " + e.message); }
});

// ==================== SETGPP ====================
cmd({
    pattern: "setgpp",
    desc: "🖼️ Set group photo (reply to image)",
    category: "group",
    react: "🖼️",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
    try {
        if (!isGroup) return fail(reply, "This is a group-only command.");
        if (!isAdmins) return fail(reply, "Only group admins can use this.");
        if (!isBotAdmins) return fail(reply, "Bot needs to be admin for this.");
        if (!m.quoted || m.quoted.mtype !== "imageMessage") return fail(reply, "Reply to an image.");
        const buffer = await m.quoted.download();
        await conn.updateProfilePicture(from, buffer);
        reply(`✅ ${toSansBold('Group photo updated.')}`);
    } catch (e) { fail(reply, "Failed. " + e.message); }
});

// ==================== MUTE ====================
cmd({
    pattern: "mute",
    desc: "🔇 Only admins can send messages",
    category: "group",
    react: "🔇",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
    try {
        if (!isGroup) return fail(reply, "This is a group-only command.");
        if (!isAdmins) return fail(reply, "Only group admins can use this.");
        if (!isBotAdmins) return fail(reply, "Bot needs to be admin for this.");
        await conn.groupSettingUpdate(from, "announcement");
        reply(`🔇 ${toSansBold('Group muted. Only admins can send messages.')}`);
    } catch (e) { fail(reply, "Failed. " + e.message); }
});

// ==================== UNMUTE ====================
cmd({
    pattern: "unmute",
    desc: "🔊 Everyone can send messages",
    category: "group",
    react: "🔊",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
    try {
        if (!isGroup) return fail(reply, "This is a group-only command.");
        if (!isAdmins) return fail(reply, "Only group admins can use this.");
        if (!isBotAdmins) return fail(reply, "Bot needs to be admin for this.");
        await conn.groupSettingUpdate(from, "not_announcement");
        reply(`🔊 ${toSansBold('Group unmuted. Everyone can send messages.')}`);
    } catch (e) { fail(reply, "Failed. " + e.message); }
});

// ==================== GROUPLINK ====================
cmd({
    pattern: "grouplink",
    alias: ["glink"],
    desc: "🔗 Get group invite link",
    category: "group",
    react: "🔗",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
    try {
        if (!isGroup) return fail(reply, "This is a group-only command.");
        if (!isAdmins) return fail(reply, "Only group admins can use this.");
        if (!isBotAdmins) return fail(reply, "Bot needs to be admin for this.");
        const code = await conn.groupInviteCode(from);
        reply(`🔗 ${toSansBold('Invite link:')} https://chat.whatsapp.com/${code}`);
    } catch (e) { fail(reply, "Failed. " + e.message); }
});

// ==================== REVOKELINK ====================
cmd({
    pattern: "revokelink",
    // 🚨 BUG FIX (".revoke" did nothing): only "revokelink"/"resetlink"
    // existed — the short word "revoke" itself wasn't registered as a
    // pattern or alias anywhere, so it silently fell through as an
    // unknown command.
    alias: ["revoke"],
    desc: "🔄 Reset group invite link",
    category: "group",
    react: "🔄",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isAdmins, isBotAdmins, reply }) => {
    try {
        if (!isGroup) return fail(reply, "This is a group-only command.");
        if (!isAdmins) return fail(reply, "Only group admins can use this.");
        if (!isBotAdmins) return fail(reply, "Bot needs to be admin for this.");
        await conn.groupRevokeInvite(from);
        const code = await conn.groupInviteCode(from);
        reply(`✅ ${toSansBold('Link reset.')}\n🔗 https://chat.whatsapp.com/${code}`);
    } catch (e) { fail(reply, "Failed. " + e.message); }
});

// ==================== GROUPJID ====================
cmd({
    pattern: "groupjid",
    desc: "🆔 Get group JID",
    category: "group",
    react: "🆔",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, reply }) => {
    if (!isGroup) return fail(reply, "This is a group-only command.");
    reply(`🆔 ${toSansBold('Group JID:')} ${from}`);
});

// ==================== GROUPINFO ====================
cmd({
    pattern: "groupinfo",
    desc: "ℹ️ Full group details",
    category: "group",
    react: "ℹ️",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, groupMetadata, reply }) => {
    try {
        if (!isGroup) return fail(reply, "This is a group-only command.");
        const g = groupMetadata;
        const created = new Date(g.creation * 1000).toLocaleDateString();
        reply(`╭═══ ℹ️ ${toSansBold('GROUP INFO')} ═══⊷\n┃❃│ ${toSansBold('Name')}: ${toSansBold(g.subject)}\n┃❃│ ${toSansBold('Members')}: ${toSansBold(String(g.participants.length))}\n┃❃│ ${toSansBold('Created')}: ${created}\n┃❃│ ${toSansBold('Description')}: ${g.desc || "None"}\n╰═════════════════⊷`);
    } catch (e) { fail(reply, "Failed. " + e.message); }
});

// ==================== REQUESTLIST ====================
cmd({
    pattern: "memberlist",
    alias: ["members"],
    desc: "👥 List all members",
    category: "group",
    react: "👥",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, participants, reply }) => {
    try {
        if (!isGroup) return fail(reply, "This is a group-only command.");
        const text = participants.map((p, i) => `${i + 1}. @${p.id.split('@')[0]}`).join("\n");
        await conn.sendMessage(from, { text: `╭═══ 👥 ${toSansBold(`MEMBERS (${participants.length})`)} ═══⊷\n${text}\n╰═════════════════⊷`, mentions: participants.map(p => p.id) });
    } catch (e) { fail(reply, "Failed. " + e.message); }
});

// ==================== ADMINLIST ====================
cmd({
    pattern: "adminlist",
    alias: ["admins"],
    desc: "👮 List group admins",
    category: "group",
    react: "👮",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, participants, reply }) => {
    try {
        if (!isGroup) return fail(reply, "This is a group-only command.");
        // 🚨 ROOT-CAUSE FIX ("1 admin dikhaya but multiple times"): the old
        // code used the shared `groupAdmins` array, which was deliberately
        // built (see main.js getGroupAdmins) to hold EVERY id-variant
        // (id/jid/lid/phoneNumber) for each admin, flattened together, so
        // that admin-permission checks work regardless of which id format
        // a message shows up with. That's correct for permission checks,
        // but wrong for display — one real admin with 3 id-variants showed
        // up as 3 separate "admins". This now reads directly from the raw
        // group participants and takes exactly one id per real admin.
        const uniqueAdmins = (participants || [])
            .filter(p => p.admin)
            .map(p => p.id || p.jid || p.lid)
            .filter(Boolean);
        if (!uniqueAdmins.length) return reply(`${toSansBold('No admins found.')}`);
        const text = uniqueAdmins.map((a, i) => `${i + 1}. @${a.split('@')[0]}`).join("\n");
        await conn.sendMessage(from, { text: `╭═══ 👮 ${toSansBold(`ADMINS (${uniqueAdmins.length})`)} ═══⊷\n${text}\n╰═════════════════⊷`, mentions: uniqueAdmins });
    } catch (e) { fail(reply, "Failed. " + e.message); }
});

// ==================== TAGADMINS ====================
cmd({
    pattern: "tagadmins",
    desc: "📢 Tag only admins",
    category: "group",
    react: "📢",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isAdmins, participants, args, reply }) => {
    try {
        if (!isGroup) return fail(reply, "This is a group-only command.");
        if (!isAdmins) return fail(reply, "Only group admins can use this.");
        // Same fix as .adminlist — one id per real admin, not per id-variant.
        const uniqueAdmins = (participants || [])
            .filter(p => p.admin)
            .map(p => p.id || p.jid || p.lid)
            .filter(Boolean);
        const msg = args.join(" ") || "Attention admins!";
        const text = uniqueAdmins.map(a => `@${a.split('@')[0]}`).join(" ");
        await conn.sendMessage(from, { text: `${msg}\n\n${text}`, mentions: uniqueAdmins });
    } catch (e) { fail(reply, "Failed. " + e.message); }
});

// ==================== ACCEPTALL ====================
cmd({
    pattern: "groupcreate",
    alias: ["newgroup"],
    desc: "➕ Create a new group",
    category: "group",
    react: "➕",
    use: ".groupcreate Group Name | 923001234567,923009876543",
    filename: __filename
}, async (conn, mek, m, { from, isCreator, args, reply }) => {
    try {
        if (!isCreator) return fail(reply, "Only bot owner can use this.");
        const fullText = args.join(" ");
        const [name, numbersRaw] = fullText.split("|");
        if (!name || !numbersRaw) return fail(reply, "Use: .groupcreate Name | 923001234567,923009876543");
        const numbers = numbersRaw.split(",").map(n => n.trim().replace(/[^0-9]/g, "") + "@s.whatsapp.net");
        const result = await conn.groupCreate(name.trim(), numbers);
        reply(`✅ ${toSansBold('Group created:')} ${toSansBold(name.trim())}`);
    } catch (e) { fail(reply, "Failed. " + e.message); }
});

// ==================== JOIN (via link) ====================
