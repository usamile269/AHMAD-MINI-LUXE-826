const { cmd } = require('../ahmad-core');
const { setAntideleteStatus, getAntideleteStatus, setAntideleteSendTo, getAntideleteSendTo, globalKeyFor: dGlobalKeyFor, setAntideleteGlobalStatus, setAntideleteGlobalSendTo } = require('../data/Antidelete.js');
const { setAntieditStatus, getAntieditStatus, setAntieditSendTo, getAntieditSendTo, globalKeyFor: eGlobalKeyFor, setAntieditGlobalStatus, setAntieditGlobalSendTo } = require('../data/Antiedit.js');
const { randomFooter, ownerOnlyDenied } = require('../lib/menu-styles');

const FOOTER = "\n\n> " + randomFooter();

// 🚨 PERMISSION FIX (Bunty: "gc mein only bot users, admin nahi kuch bhi
// karay, admin bhi same" — then LATER: "DM mein bhi koi aur change na
// kar sake, abhi DM mein kisi ke jaake karo to hota hai"): this used to
// only restrict GROUPS — any random person messaging the bot directly in
// a DM could toggle antidelete/antiedit for THAT chat, no check at all.
// Now it's owner/isMe-only everywhere, DM included — a random person
// messaging the bot's own number can no longer touch these settings for
// themselves either, only the actual owner or the paired-number's own
// user can.
//
// 🚨 MINI-BOT HOSTING FIX (Bunty: "sirf jis banda ne apna number pair
// kiya wo control kare"): `isOwner` only matches config.OWNER_NUMBER —
// correct for dangerous cross-tenant commands like .eval/.broadcast, but
// wrong here. On a hosting deployment where OTHER people pair their own
// number onto this same bot, they are never config.OWNER_NUMBER, so they
// could never toggle antidelete/antiedit in their OWN chats at all.
// `isMe` (botNumber === senderNumber, i.e. "you're the person whose
// number this session is paired to") is added alongside isOwner so the
// actual paired-number owner always controls their own bot, in every
// chat — while anyone who is neither isOwner nor isMe still can't.

cmd({
    pattern: "antidelete",
    alias: ["adelete"],
    desc: "Turn Anti-Delete on/off (this chat only)",
    category: "settings",
    use: ".antidelete on/off",
    filename: __filename
}, async (conn, mek, m, { from, args, isGroup, isAdmins, isOwner, isMe, reply, botNumber }) => {
    try {
        if (!isOwner && !isMe) return reply(`❌ Owner only.${FOOTER}`);
        const mode = (args[0] || '').toLowerCase();

        if (mode === 'on') {
            await setAntideleteStatus(botNumber, from, true);
            return reply(`✅ *Anti-Delete ON* for this chat.${FOOTER}`);
        }
        if (mode === 'off') {
            await setAntideleteStatus(botNumber, from, false);
            return reply(`✅ *Anti-Delete OFF* for this chat.${FOOTER}`);
        }

        const status = await getAntideleteStatus(botNumber, from);
        const sendTo = await getAntideleteSendTo(botNumber, from);
        reply(`⚙️ *ANTI-DELETE STATUS*\n📍 Status: ${status ? '✅ ON' : '❌ OFF'}\n📤 Send to: ${sendTo === 'private' ? 'Your Private Chat' : 'Same Chat'}\n\n💡 Use: .antidelete on/off\n💡 Use: .delpath same/private${FOOTER}`);
    } catch (e) { reply(`❌ Error: ${e.message}${FOOTER}`); }
});

cmd({
    pattern: "antideleteall",
    alias: ["gadelete", "globalantidelete"],
    desc: "OWNER: turn anti-delete on/off OVERALL for every chat on this bot number",
    category: "owner",
    use: ".antideleteall on/off",
    filename: __filename
}, async (conn, mek, m, { args, isOwner, isMe, reply, botNumber }) => {
    try {
        if (!isOwner && !isMe) return reply(ownerOnlyDenied() + FOOTER);
        const mode = (args[0] || '').toLowerCase();
        if (!['on', 'off'].includes(mode)) return reply(`❌ Usage: .antideleteall on/off${FOOTER}`);
        await setAntideleteGlobalStatus(botNumber, mode === 'on');
        reply(`✅ *Anti-Delete ${mode.toUpperCase()}* — *OVERALL* (all chats: groups + DMs, this bot number).${FOOTER}`);
    } catch (e) { reply(`❌ Error: ${e.message}${FOOTER}`); }
});

cmd({
    pattern: "delpath",
    desc: "Choose where recovered deleted messages go (this chat only)",
    category: "settings",
    use: ".delpath same/private",
    filename: __filename
}, async (conn, mek, m, { from, args, isGroup, isAdmins, isOwner, isMe, reply, botNumber }) => {
    try {
        if (!isOwner && !isMe) return reply(`❌ Owner only.${FOOTER}`);
        const mode = (args[0] || '').toLowerCase();

        if (!['same', 'private'].includes(mode)) {
            return reply(`❌ Usage: .delpath same  (send in this same chat)\n❌ Usage: .delpath private  (send to your private chat)${FOOTER}`);
        }

        await setAntideleteSendTo(botNumber, from, mode);
        reply(`✅ *Delete-path set to:* ${mode === 'private' ? 'Your Private Chat 📥' : 'Same Chat 📍'} for this chat.${FOOTER}`);
    } catch (e) { reply(`❌ Error: ${e.message}${FOOTER}`); }
});

cmd({
    pattern: "delpathall",
    alias: ["gdelpath", "globaldelpath"],
    desc: "OWNER: set the delete-recovery destination OVERALL for every chat on this bot number",
    category: "owner",
    use: ".delpathall same/private",
    filename: __filename
}, async (conn, mek, m, { args, isOwner, isMe, reply, botNumber }) => {
    try {
        if (!isOwner && !isMe) return reply(ownerOnlyDenied() + FOOTER);
        const mode = (args[0] || '').toLowerCase();
        if (!['same', 'private'].includes(mode)) return reply(`❌ Usage: .delpathall same/private${FOOTER}`);
        await setAntideleteGlobalSendTo(botNumber, mode);
        reply(`✅ *Delete-path set to:* ${mode === 'private' ? 'Your Private Chat 📥' : 'Same Chat 📍'} — *OVERALL* (this bot number).${FOOTER}`);
    } catch (e) { reply(`❌ Error: ${e.message}${FOOTER}`); }
});

module.exports = {};

// ==================== ANTI-EDIT ====================
cmd({
    pattern: "antiedit",
    alias: ["aedit"],
    desc: "Turn Anti-Edit on/off (this chat only)",
    category: "settings",
    use: ".antiedit on/off",
    filename: __filename
}, async (conn, mek, m, { from, args, isGroup, isAdmins, isOwner, isMe, reply, botNumber }) => {
    try {
        if (!isOwner && !isMe) return reply(`❌ Owner only.${FOOTER}`);
        const mode = (args[0] || '').toLowerCase();

        if (mode === 'on') {
            await setAntieditStatus(botNumber, from, true);
            return reply(`✅ *Anti-Edit ON* for this chat.${FOOTER}`);
        }
        if (mode === 'off') {
            await setAntieditStatus(botNumber, from, false);
            return reply(`✅ *Anti-Edit OFF* for this chat.${FOOTER}`);
        }

        const status = await getAntieditStatus(botNumber, from);
        const sendTo = await getAntieditSendTo(botNumber, from);
        reply(`⚙️ *ANTI-EDIT STATUS*\n📍 Status: ${status ? '✅ ON' : '❌ OFF'}\n📤 Send to: ${sendTo === 'private' ? 'Your Private Chat' : 'Same Chat'}\n\n💡 Use: .antiedit on/off\n💡 Use: .editpath same/private${FOOTER}`);
    } catch (e) { reply(`❌ Error: ${e.message}${FOOTER}`); }
});

cmd({
    pattern: "antieditall",
    alias: ["gaedit", "globalantiedit"],
    desc: "OWNER: turn anti-edit on/off OVERALL for every chat on this bot number",
    category: "owner",
    use: ".antieditall on/off",
    filename: __filename
}, async (conn, mek, m, { args, isOwner, isMe, reply, botNumber }) => {
    try {
        if (!isOwner && !isMe) return reply(ownerOnlyDenied() + FOOTER);
        const mode = (args[0] || '').toLowerCase();
        if (!['on', 'off'].includes(mode)) return reply(`❌ Usage: .antieditall on/off${FOOTER}`);
        await setAntieditGlobalStatus(botNumber, mode === 'on');
        reply(`✅ *Anti-Edit ${mode.toUpperCase()}* — *OVERALL* (all chats: groups + DMs, this bot number).${FOOTER}`);
    } catch (e) { reply(`❌ Error: ${e.message}${FOOTER}`); }
});

cmd({
    pattern: "editpath",
    desc: "Choose where edited-message alerts go (this chat only)",
    category: "settings",
    use: ".editpath same/private",
    filename: __filename
}, async (conn, mek, m, { from, args, isGroup, isAdmins, isOwner, isMe, reply, botNumber }) => {
    try {
        if (!isOwner && !isMe) return reply(`❌ Owner only.${FOOTER}`);
        const mode = (args[0] || '').toLowerCase();

        if (!['same', 'private'].includes(mode)) {
            return reply(`❌ Usage: .editpath same  (send in this same chat)\n❌ Usage: .editpath private  (send to your private chat)${FOOTER}`);
        }

        await setAntieditSendTo(botNumber, from, mode);
        reply(`✅ *Edit-path set to:* ${mode === 'private' ? 'Your Private Chat 📥' : 'Same Chat 📍'} for this chat.${FOOTER}`);
    } catch (e) { reply(`❌ Error: ${e.message}${FOOTER}`); }
});

cmd({
    pattern: "editpathall",
    alias: ["geditpath", "globaleditpath"],
    desc: "OWNER: set the edit-alert destination OVERALL for every chat on this bot number",
    category: "owner",
    use: ".editpathall same/private",
    filename: __filename
}, async (conn, mek, m, { args, isOwner, isMe, reply, botNumber }) => {
    try {
        if (!isOwner && !isMe) return reply(ownerOnlyDenied() + FOOTER);
        const mode = (args[0] || '').toLowerCase();
        if (!['same', 'private'].includes(mode)) return reply(`❌ Usage: .editpathall same/private${FOOTER}`);
        await setAntieditGlobalSendTo(botNumber, mode);
        reply(`✅ *Edit-path set to:* ${mode === 'private' ? 'Your Private Chat 📥' : 'Same Chat 📍'} — *OVERALL* (this bot number).${FOOTER}`);
    } catch (e) { reply(`❌ Error: ${e.message}${FOOTER}`); }
});
