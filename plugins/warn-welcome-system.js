const { cmd } = require('../ahmad-core');
const config = require('../config');
const { getGroupSettings, setGroupSettings, GLOBAL_KEY } = require('../data/GroupSettings');
const { getWarnCount, incrementWarn, decrementWarn, resetWarn, resetAllWarnsInChat } = require('../data/Warnings');
const { resolveIsAdmin } = require('../lib/jid-resolve');

const { randomFooter } = require('../lib/menu-styles');

function fail(reply, msg) { return reply(`❌ ${msg}`); }

// 🚨 BUG FIX (Bunty: "${randomFooter()} ye literally text me aa raha hai") —
// this was wrapped in single quotes ('...'), so it was a plain string, not a
// template literal, and JS never evaluated randomFooter() inside it — every
// box just printed the literal characters "${randomFooter()}". Needs
// backticks (`...`) to actually interpolate the function call.
const BOX_FOOTER = `> ${randomFooter()}`;
// 🚨 FIX (requested by Ahmad — antilink/gc setting replies were plain
// one-line text): every settings command below now replies with the same
// channel-forward box style used across the rest of the bot instead of a
// bare sentence.
function box(title, lines, emoji = '🔗') {
    return `╭═══ ${emoji} ${title} ═══⊷\n┃❃╭──────────────\n${lines.map(l => `┃❃│ ${l}`).join('\n')}\n┃❃╰───────────────\n╰═════════════════⊷\n\n${BOX_FOOTER}`;
}

// 🚨 FEATURE RESTORED (Ahmad: "apni chat se hi sab A to Z set karein, sab
// jagah lagu ho"): this was previously removed entirely because it let ANY
// group's setting leak into every other group unintentionally. Restoring it
// now, but scoped safely: it only activates when the OWNER specifically
// runs the command from a private/DM chat (never from inside a group, and
// never for non-owners) — so a global override can only ever be a
// deliberate action by the one person allowed to make it.
function isSelfChat(conn, from, isGroup, isOwner) {
    return !isGroup && isOwner;
}

// ==================== WELCOME TOGGLE ====================
cmd({
    pattern: "welcometoggle",
    alias: ["welcome"],
    desc: "👋 Enable/Disable welcome messages (in a group = that group; from your own DM = every group you admin; owner's DM = every group)",
    category: "settings",
    react: "👋",
    use: ".welcome on/off",
    filename: __filename
}, async (conn, mek, m, { from, sender, isGroup, isAdmins, isOwner, args, reply }) => {
    const self = isSelfChat(conn, from, isGroup, isOwner);

    let adminGroupIds = null;
    if (!isGroup && !self) {
        try {
            const groups = await conn.groupFetchAllParticipating();
            adminGroupIds = [];
            for (const [id, g] of Object.entries(groups)) {
                const adminIds = (g.participants || [])
                    .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                    .map(p => p.id);
                if (await resolveIsAdmin(conn, sender, adminIds)) adminGroupIds.push(id);
            }
        } catch (e) {
            adminGroupIds = [];
        }
        if (!adminGroupIds.length) {
            return fail(reply, "Run this INSIDE a group to configure just that group, or from your own DM if you're an admin in at least one group (it'll apply to every group you admin).");
        }
    }

    if (isGroup && !isAdmins && !isOwner) return fail(reply, "Admins only.");
    const applyToScopes = self ? [GLOBAL_KEY] : (isGroup ? [from] : adminGroupIds);
    const scopeLabel = self ? ' — *OVERALL* (all groups)' : (isGroup ? '' : ` — applied to ${applyToScopes.length} group(s) you admin`);
    const val = args[0]?.toLowerCase();
    if (val === "on") {
        for (const s of applyToScopes) await setGroupSettings(s, { welcomeOn: true });
        reply(`✅ Welcome messages enabled${scopeLabel}.`);
    } else if (val === "off") {
        for (const s of applyToScopes) await setGroupSettings(s, { welcomeOn: false });
        reply(`✅ Welcome messages disabled${scopeLabel}.`);
    } else {
        const s = await getGroupSettings(self ? GLOBAL_KEY : (isGroup ? from : adminGroupIds[0]));
        reply(`Status: ${s.welcomeOn ? "ON" : "OFF"}\nUse: .welcome on/off`);
    }
});

// ==================== SET WELCOME MESSAGE ====================
cmd({
    pattern: "setwelcome",
    desc: "✏️ Set custom welcome message (in a group = that group; from your own DM = every group you admin; owner's DM = every group)",
    category: "settings",
    react: "✏️",
    use: ".setwelcome Welcome @user! (placeholders: @user, @members, @time)",
    filename: __filename
}, async (conn, mek, m, { from, sender, isGroup, isAdmins, isOwner, args, reply }) => {
    const self = isSelfChat(conn, from, isGroup, isOwner);

    // 🚨 FIX (Bunty: "private DM se jo main karoon woh overall har gc mein
    // apply ho — abhi sirf group ke andar jaake lagana padta hai"): same
    // per-admin-DM pattern .gwelcomevideo already uses. A non-owner running
    // this from their own DM now applies it to every group THEY admin,
    // instead of only working for the single global owner.
    let adminGroupIds = null;
    if (!isGroup && !isOwner) {
        try {
            const groups = await conn.groupFetchAllParticipating();
            adminGroupIds = [];
            for (const [id, g] of Object.entries(groups)) {
                const adminIds = (g.participants || [])
                    .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                    .map(p => p.id);
                if (await resolveIsAdmin(conn, sender, adminIds)) adminGroupIds.push(id);
            }
        } catch (e) {
            adminGroupIds = [];
        }
        if (!adminGroupIds.length) {
            return fail(reply, "Run this INSIDE a group to configure just that group, or from your own DM if you're an admin in at least one group (it'll apply to every group you admin).");
        }
    }

    if (isGroup && !isAdmins && !isOwner) return fail(reply, "Admins only.");
    const text = args.join(" ");
    if (!text) return fail(reply, "Use: .setwelcome Welcome @user!");

    const applyToScopes = self ? [GLOBAL_KEY] : (isGroup ? [from] : adminGroupIds);
    const scopeLabel = self ? ' — *OVERALL* (all groups)' : (isGroup ? '' : ` — applied to ${applyToScopes.length} group(s) you admin`);

    for (const s of applyToScopes) {
        const ok = await setGroupSettings(s, { welcomeMsg: text, welcomeOn: true });
        if (!ok) return fail(reply, "Couldn't save that — storage error, try again in a moment.");
    }
    reply(`✅ Welcome message updated and enabled${scopeLabel}.`);
});

// ==================== SET WELCOME VIDEO ====================
// 🚨 FEATURE (requested by Ahmad): welcome could only ever be plain text.
// This lets a group set a VIDEO that goes out together with the welcome
// text — same message, video + caption, not two separate sends. Reply to a
// video with .gwelcomevideo to save it, or run .gwelcomevideo clear to
// remove it and go back to text-only.
cmd({
    pattern: "gwelcomevideo",
    desc: "🎬 Set a video for the welcome message (in a group = that group; from your own DM = all groups you admin; owner's DM = every group)",
    category: "settings",
    react: "🎬",
    use: "Reply to a video with .gwelcomevideo, or .gwelcomevideo clear",
    filename: __filename
}, async (conn, mek, m, { from, sender, isGroup, isAdmins, isOwner, args, reply }) => {
    const self = isSelfChat(conn, from, isGroup, isOwner);

    // 🆕 (Bunty: "user welcomevideo set kare apni DM se, jahan wo admin hai
    // wahan show ho" — set once from DM instead of repeating it in every
    // group they admin individually). Only kicks in for a non-owner running
    // this from their own DM (not inside a group, and not the owner's
    // DM-is-global case, which is handled separately above).
    let adminGroupIds = null;
    if (!isGroup && !isOwner) {
        try {
            const groups = await conn.groupFetchAllParticipating();
            // 🚨 BUG FIX (Bunty: ".gwelcomevideo private se chalta nahi, 'run
            // inside a group' bolta hai" even for genuine group admins): this
            // used to compare `p.id === sender` directly. WhatsApp can hand
            // out a group's participant list as @lid identities while
            // `sender` here is a plain phone-number @s.whatsapp.net JID (or
            // vice versa) — same class of bug already fixed for isOwner/group
            // -admin checks in main.js. A real admin's ids just never
            // string-matched, so adminGroupIds always came back empty and
            // this always failed from private DM. Now uses the same
            // lid<->phone-number aware resolver main.js already relies on.
            adminGroupIds = [];
            for (const [id, g] of Object.entries(groups)) {
                const adminIds = (g.participants || [])
                    .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                    .map(p => p.id);
                if (await resolveIsAdmin(conn, sender, adminIds)) adminGroupIds.push(id);
            }
        } catch (e) {
            adminGroupIds = [];
        }
        if (!adminGroupIds.length) {
            return fail(reply, "Run this INSIDE a group to configure just that group, or from your own DM if you're an admin in at least one group (it'll apply to every group you admin).");
        }
    }

    if (isGroup && !isAdmins && !isOwner) return fail(reply, "Admins only.");

    const applyToScopes = self ? [GLOBAL_KEY] : (isGroup ? [from] : adminGroupIds);
    const scopeLabel = self ? ' — *OVERALL* (all groups)' : (isGroup ? '' : ` — applied to ${applyToScopes.length} group(s) you admin`);

    if (args[0]?.toLowerCase() === 'clear') {
        for (const s of applyToScopes) await setGroupSettings(s, { welcomeVideo: null });
        return reply(`✅ Welcome video cleared${scopeLabel}. Welcome will go back to text-only.`);
    }

    // 🆕 (Bunty: gave a direct Cloudinary video URL to set as the default)
    // — a direct link can be stored and streamed straight from WhatsApp,
    // no download/base64 needed, so this is now supported alongside the
    // original reply-to-video flow.
    if (args[0] && /^https?:\/\//i.test(args[0])) {
        for (const s of applyToScopes) await setGroupSettings(s, { welcomeVideo: args[0] });
        return reply(`✅ Welcome video (from URL) saved${scopeLabel}.`);
    }

    const quotedType = m.quoted && m.quoted.message ? Object.keys(m.quoted.message)[0] : null;
    if (quotedType !== 'videoMessage') {
        return fail(reply, "Reply to a video with .gwelcomevideo, paste a direct video URL, or use .gwelcomevideo clear to remove it.");
    }

    try {
        const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
        const stream = await downloadContentFromMessage(m.quoted.message.videoMessage, 'video');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        const b64 = buffer.toString('base64');
        // Stored as base64 in each applicable group's own settings doc
        // (local JSON file, no MongoDB) — same approach already used for
        // per-user MENU_IMAGE.
        for (const s of applyToScopes) await setGroupSettings(s, { welcomeVideo: b64 });
        reply(`✅ Welcome video saved${scopeLabel}. It will be sent together with the welcome text from now on.`);
    } catch (e) {
        fail(reply, "Couldn't save that video: " + e.message);
    }
});

// ==================== SET GOODBYE MESSAGE ====================
cmd({
    pattern: "setgoodbye",
    desc: "✏️ Set custom goodbye message (in a group = that group; from your own DM = every group you admin; owner's DM = every group). .setgoodbye off to disable.",
    category: "settings",
    react: "✏️",
    use: ".setgoodbye Bye @user! / .setgoodbye off",
    filename: __filename
}, async (conn, mek, m, { from, sender, isGroup, isAdmins, isOwner, args, reply }) => {
    const self = isSelfChat(conn, from, isGroup, isOwner);

    let adminGroupIds = null;
    if (!isGroup && !isOwner) {
        try {
            const groups = await conn.groupFetchAllParticipating();
            adminGroupIds = [];
            for (const [id, g] of Object.entries(groups)) {
                const adminIds = (g.participants || [])
                    .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                    .map(p => p.id);
                if (await resolveIsAdmin(conn, sender, adminIds)) adminGroupIds.push(id);
            }
        } catch (e) {
            adminGroupIds = [];
        }
        if (!adminGroupIds.length) {
            return fail(reply, "Run this INSIDE a group to configure just that group, or from your own DM if you're an admin in at least one group (it'll apply to every group you admin).");
        }
    }

    if (isGroup && !isAdmins && !isOwner) return fail(reply, "Admins only.");
    const text = args.join(" ");
    if (!text) return fail(reply, "Use: .setgoodbye Bye @user!  (or .setgoodbye off to disable)");

    const applyToScopes = self ? [GLOBAL_KEY] : (isGroup ? [from] : adminGroupIds);
    const scopeLabel = self ? ' — *OVERALL* (all groups)' : (isGroup ? '' : ` — applied to ${applyToScopes.length} group(s) you admin`);
    const disabling = text.toLowerCase() === 'off';

    for (const s of applyToScopes) {
        const ok = await setGroupSettings(s, { goodbyeMsg: disabling ? null : text });
        if (!ok) return fail(reply, "Couldn't save that — storage error, try again in a moment.");
    }
    reply(disabling ? `✅ Goodbye messages disabled${scopeLabel}.` : `✅ Goodbye message updated${scopeLabel}.`);
});

// ==================== SET KICK MESSAGE ====================
// 🆕 (Bunty: "kick wale ki attitude wali lines alag hon, normal leave se")
// — this only fires when the removal was a genuine bot-authorized .kick,
// never for someone leaving on their own (see main.js's group-participants
// .update handler, which checks the same pendingGroupActions flag .kick
// itself stamps).
cmd({
    pattern: "setkickmsg",
    alias: ["setkickmessage"],
    desc: "✏️ Set the message shown when an admin kicks someone via .kick (in a group = that group; from your own DM = every group you admin; owner's DM = every group). .setkickmsg off to disable.",
    category: "settings",
    react: "✏️",
    use: ".setkickmsg @user got removed... / .setkickmsg off",
    filename: __filename
}, async (conn, mek, m, { from, sender, isGroup, isAdmins, isOwner, args, reply }) => {
    const self = isSelfChat(conn, from, isGroup, isOwner);

    let adminGroupIds = null;
    if (!isGroup && !isOwner) {
        try {
            const groups = await conn.groupFetchAllParticipating();
            adminGroupIds = [];
            for (const [id, g] of Object.entries(groups)) {
                const adminIds = (g.participants || [])
                    .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                    .map(p => p.id);
                if (await resolveIsAdmin(conn, sender, adminIds)) adminGroupIds.push(id);
            }
        } catch (e) {
            adminGroupIds = [];
        }
        if (!adminGroupIds.length) {
            return fail(reply, "Run this INSIDE a group to configure just that group, or from your own DM if you're an admin in at least one group (it'll apply to every group you admin).");
        }
    }

    if (isGroup && !isAdmins && !isOwner) return fail(reply, "Admins only.");
    const text = args.join(" ");
    if (!text) return fail(reply, "Use: .setkickmsg <message>  (placeholders: @user, @members, @time — or .setkickmsg off to disable)");

    const applyToScopes = self ? [GLOBAL_KEY] : (isGroup ? [from] : adminGroupIds);
    const scopeLabel = self ? ' — *OVERALL* (all groups)' : (isGroup ? '' : ` — applied to ${applyToScopes.length} group(s) you admin`);
    const disabling = text.toLowerCase() === 'off';

    for (const s of applyToScopes) {
        const ok = await setGroupSettings(s, { kickMsg: disabling ? null : text });
        if (!ok) return fail(reply, "Couldn't save that — storage error, try again in a moment.");
    }
    reply(disabling ? `✅ Kick message disabled${scopeLabel} (falls back to the normal goodbye message).` : `✅ Kick message updated${scopeLabel}.`);
});


cmd({
    pattern: "ggoodbyevideo",
    desc: "🎬 Set a video for the goodbye message (in a group = that group; from your own DM = all groups you admin; owner's DM = every group)",
    category: "settings",
    react: "🎬",
    use: "Reply to a video with .ggoodbyevideo, paste a video URL, or .ggoodbyevideo clear",
    filename: __filename
}, async (conn, mek, m, { from, sender, isGroup, isAdmins, isOwner, args, reply }) => {
    const self = isSelfChat(conn, from, isGroup, isOwner);

    let adminGroupIds = null;
    if (!isGroup && !isOwner) {
        try {
            const groups = await conn.groupFetchAllParticipating();
            adminGroupIds = [];
            for (const [id, g] of Object.entries(groups)) {
                const adminIds = (g.participants || [])
                    .filter(p => p.admin === 'admin' || p.admin === 'superadmin')
                    .map(p => p.id);
                if (await resolveIsAdmin(conn, sender, adminIds)) adminGroupIds.push(id);
            }
        } catch (e) {
            adminGroupIds = [];
        }
        if (!adminGroupIds.length) {
            return fail(reply, "Run this INSIDE a group to configure just that group, or from your own DM if you're an admin in at least one group (it'll apply to every group you admin).");
        }
    }

    if (isGroup && !isAdmins && !isOwner) return fail(reply, "Admins only.");

    const applyToScopes = self ? [GLOBAL_KEY] : (isGroup ? [from] : adminGroupIds);
    const scopeLabel = self ? ' — *OVERALL* (all groups)' : (isGroup ? '' : ` — applied to ${applyToScopes.length} group(s) you admin`);

    if (args[0]?.toLowerCase() === 'clear') {
        for (const s of applyToScopes) await setGroupSettings(s, { goodbyeVideo: null });
        return reply(`✅ Goodbye video cleared${scopeLabel}. Goodbye will go back to text-only.`);
    }

    if (args[0] && /^https?:\/\//i.test(args[0])) {
        for (const s of applyToScopes) await setGroupSettings(s, { goodbyeVideo: args[0] });
        return reply(`✅ Goodbye video (from URL) saved${scopeLabel}.`);
    }

    const quotedType = m.quoted && m.quoted.message ? Object.keys(m.quoted.message)[0] : null;
    if (quotedType !== 'videoMessage') {
        return fail(reply, "Reply to a video with .ggoodbyevideo, paste a direct video URL, or use .ggoodbyevideo clear to remove it.");
    }

    try {
        const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
        const stream = await downloadContentFromMessage(m.quoted.message.videoMessage, 'video');
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        for (const s of applyToScopes) await setGroupSettings(s, { goodbyeVideo: buffer.toString('base64') });
        reply(`✅ Goodbye video saved${scopeLabel}. It will be sent together with the goodbye text from now on.`);
    } catch (e) {
        fail(reply, "Couldn't save that video: " + e.message);
    }
});

// ==================== WARN ====================
cmd({
    pattern: "warn",
    desc: "⚠️ Warn a member",
    category: "group",
    react: "⚠️",
    use: ".warn (reply to user)",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isAdmins, reply }) => {
    if (!isGroup) return fail(reply, "Group only command.");
    if (!isAdmins) return fail(reply, "Admins only.");
    const target = m.quoted?.sender || m.mentionedJid?.[0];
    if (!target) return fail(reply, "Reply to or mention the user to warn.");

    const count = await incrementWarn(from, target);
    const settings = await getGroupSettings(from);
    const limit = settings.warnLimit || 3;

    await conn.sendMessage(from, {
        text: `⚠️ @${target.split('@')[0]} has been warned. (${count}/${limit})`,
        mentions: [target]
    }, { quoted: mek });

    if (count >= limit) {
        try {
            await conn.groupParticipantsUpdate(from, [target], "remove");
            await conn.sendMessage(from, { text: `🚫 @${target.split('@')[0]} reached the warn limit and was removed.`, mentions: [target] });
            await resetWarn(from, target);
        } catch (e) {
            await conn.sendMessage(from, { text: "⚠️ Warn limit reached but I couldn't remove the user (need admin)." });
        }
    }
});

// ==================== WARNINGS (CHECK COUNT) ====================
cmd({
    pattern: "warnings",
    alias: ["warncount"],
    desc: "📊 Check warning count",
    category: "group",
    react: "📊",
    use: ".warnings (reply to user)",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, reply }) => {
    if (!isGroup) return fail(reply, "Group only command.");
    const target = m.quoted?.sender || m.mentionedJid?.[0] || m.sender;
    const count = await getWarnCount(from, target);
    const settings = await getGroupSettings(from);
    reply(`⚠️ @${target.split('@')[0]}: ${count}/${settings.warnLimit || 3} warnings`);
});

// ==================== RESETWARN (all) ====================
cmd({
    pattern: "resetwarn",
    alias: ["resetwarnings"],
    desc: "🔄 Reset all warnings in group",
    category: "group",
    react: "🔄",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isAdmins, reply }) => {
    if (!isGroup) return fail(reply, "Group only command.");
    if (!isAdmins) return fail(reply, "Admins only.");
    await resetAllWarnsInChat(from);
    reply("✅ All warnings reset for this group.");
});

// ==================== DELWARN (one user) ====================
cmd({
    pattern: "delwarn",
    desc: "➖ Remove one warning from a user",
    category: "group",
    react: "➖",
    use: ".delwarn (reply to user)",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isAdmins, reply }) => {
    if (!isGroup) return fail(reply, "Group only command.");
    if (!isAdmins) return fail(reply, "Admins only.");
    const target = m.quoted?.sender || m.mentionedJid?.[0];
    if (!target) return fail(reply, "Reply to or mention the user.");
    const current = await getWarnCount(from, target);
    if (current > 0) {
        const newCount = await decrementWarn(from, target);
        reply(`✅ Removed 1 warning. Now: ${newCount}`);
    } else {
        reply("This user has no warnings.");
    }
});

// ==================== SETWARNLIMIT ====================
cmd({
    pattern: "setwarnlimit",
    desc: "🔢 Set warning limit before auto-kick (from private chat = all groups)",
    category: "group",
    react: "🔢",
    use: ".setwarnlimit 5",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isAdmins, isOwner, args, reply }) => {
    const self = isSelfChat(conn, from, isGroup, isOwner);
    if (!isGroup && !self) return fail(reply, "Run this INSIDE a group to configure just that group, or from your own DM (as owner) to set it globally for all groups.");
    if (isGroup && !isAdmins && !isOwner) return fail(reply, "Admins only.");
    const limit = parseInt(args[0]);
    if (!limit || limit < 1) return fail(reply, "Use: .setwarnlimit 5");
    const scope = self ? GLOBAL_KEY : from;
    await setGroupSettings(scope, { warnLimit: limit });
    reply(`✅ Warn limit set to ${limit}${self ? ' — *OVERALL* (all groups)' : ''}.`);
});

// ==================== ANTILINK TOGGLE ====================
cmd({
    pattern: "antilink",
    desc: "🔗 Enable/Disable anti-link protection + choose action (per-group only)",
    category: "settings",
    react: "🔗",
    use: ".antilink on/off/delete/warn/kick",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isAdmins, isOwner, args, reply }) => {
    // 🚨 FIX (Bunty: "maine on kiya to SAB groups mein ho gaya, sabko
    // response aane laga"): antilink used the same "private DM + owner =
    // sets it for ALL groups at once" pattern as the other settings
    // commands here. That's fine for something like warnlimit, but for
    // antilink it meant one .antilink on from the owner's own DM silently
    // flipped it ON for every single group the bot is in — including ones
    // Bunty wasn't even trying to touch. Antilink is now group-scoped ONLY:
    // must be run inside the group you want it for, by that group's own
    // admin (or the bot owner). No more DM/global toggle for this one.
    if (!isGroup) return fail(reply, "Run this INSIDE the group you want to configure.");
    if (!isAdmins && !isOwner) return fail(reply, "Admins only.");
    const scope = from;
    const val = args[0]?.toLowerCase();
    if (val === "on") {
        await setGroupSettings(scope, { antilink: true });
        reply(box('ANTILINK', [`🔗 Status: ✅ ON`, `🛡️ Non-admins can't send links now`]));
    } else if (val === "off") {
        await setGroupSettings(scope, { antilink: false });
        reply(box('ANTILINK', [`🔗 Status: ❌ OFF`]));
    } else if (["delete", "warn", "kick"].includes(val)) {
        await setGroupSettings(scope, { antilinkAction: val, antilink: true });
        const actionDesc = { delete: 'Link message gets deleted.', warn: 'Only a warning is sent, message stays.', kick: 'Link message deleted + sender removed from group.' };
        reply(box('ANTILINK ACTION', [`⚙️ Action: ${val.toUpperCase()}`, `💡 ${actionDesc[val]}`]));
    } else {
        const s = await getGroupSettings(scope);
        reply(box('ANTILINK STATUS', [
            `🔗 Status: ${s.antilink ? '✅ ON' : '❌ OFF'}`,
            `⚙️ Action: ${s.antilinkAction.toUpperCase()}`,
            `──────────────`,
            `💡 .antilink on/off`,
            `💡 .antilink delete/warn/kick`
        ]));
    }
});

// ==================== GROUP RULES ====================
// 🚨 FEATURE (requested by Ahmad — "gc rules"): a proper settable rules text
// per group, shown via .rules and referenced by the antilink violation
// message below instead of a bare one-line warning with no context.
cmd({
    pattern: "setrules",
    alias: ["setgcrules"],
    desc: "📜 Set this group's rules text",
    category: "settings",
    react: "📜",
    use: ".setrules <text>",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, isAdmins, isOwner, q, reply }) => {
    if (!isGroup) return fail(reply, "Groups only.");
    if (!isAdmins && !isOwner) return fail(reply, "Admins only.");
    if (!q) return fail(reply, "Usage: .setrules 1. Be respectful\\n2. No links\\n3. No spam");
    await setGroupSettings(from, { rules: q });
    reply(box('RULES SAVED', ['📜 Group rules updated.', '💡 View anytime with .rules'], '📜'));
});

cmd({
    pattern: "rules",
    alias: ["gcrules"],
    desc: "📜 Show this group's rules",
    category: "group",
    react: "📜",
    filename: __filename
}, async (conn, mek, m, { from, isGroup, groupName, reply }) => {
    if (!isGroup) return fail(reply, "Groups only.");
    const s = await getGroupSettings(from);
    if (!s.rules) return reply(box('RULES', ['📜 No rules set yet for this group.', '💡 Admins: .setrules <text>'], '📜'));
    const lines = s.rules.split('\n').filter(Boolean);
    reply(box(`RULES${groupName ? ' — ' + groupName : ''}`, lines, '📜'));
});

// ==================== TEST WELCOME (Bunty: "khud test karna hai, real
// join ke bina") — fires the EXACT same code (lib/welcome-sender) as a
// real join, using YOU as the "new member". If this works but a real join
// doesn't trigger anything, the bug is in event delivery (bot not admin,
// WhatsApp not firing the event) — not in the welcome message itself. ====
cmd({
    pattern: "testwelcometext",
    desc: "🧪 Preview the current welcome message (text/card) without a real join",
    category: "group",
    react: "🧪",
    filename: __filename
}, async (conn, mek, m, { from, sender, isGroup, isAdmins, isOwner, reply }) => {
    if (!isGroup) return fail(reply, "Groups only.");
    if (!isAdmins && !isOwner) return fail(reply, "Admins only.");
    const s = await getGroupSettings(from);
    if (!s.welcomeOn) return reply(box('TEST WELCOME', ['⚠️ Welcome is currently OFF.', '💡 .welcome on to enable it first — this preview works either way, but the real one won\'t fire until it\'s on.'], '🧪'));
    try {
        const { sendWelcome } = require('../lib/welcome-sender');
        await sendWelcome(conn, from, sender, { ...s, welcomeVideo: null }); // force the text/card path even if a video is also set
        reply(box('TEST WELCOME', ['✅ That\'s the exact text/card a real join sends right now.'], '🧪'));
    } catch (e) {
        reply(box('TEST WELCOME', [`❌ Failed: ${e.message}`], '🧪'));
    }
});

cmd({
    pattern: "testwelcomevideo",
    desc: "🧪 Preview the saved welcome video without a real join",
    category: "group",
    react: "🧪",
    filename: __filename
}, async (conn, mek, m, { from, sender, isGroup, isAdmins, isOwner, reply }) => {
    if (!isGroup) return fail(reply, "Groups only.");
    if (!isAdmins && !isOwner) return fail(reply, "Admins only.");
    const s = await getGroupSettings(from);
    if (!s.welcomeVideo) return reply(box('TEST WELCOME VIDEO', ['⚠️ No welcome video saved for this group.', '💡 Reply to a video with .gwelcomevideo to set one first.'], '🧪'));
    if (!s.welcomeOn) return reply(box('TEST WELCOME VIDEO', ['⚠️ Welcome is currently OFF — the video below is a preview only.', '💡 .welcome on to make it actually fire on real joins.'], '🧪'));
    try {
        const { sendWelcome } = require('../lib/welcome-sender');
        await sendWelcome(conn, from, sender, s);
        reply(box('TEST WELCOME VIDEO', ['✅ That\'s the exact video + caption a real join sends right now.'], '🧪'));
    } catch (e) {
        reply(box('TEST WELCOME VIDEO', [`❌ Failed: ${e.message}`], '🧪'));
    }
});



// ==================== BROADCAST TO SAVED USERS ====================
