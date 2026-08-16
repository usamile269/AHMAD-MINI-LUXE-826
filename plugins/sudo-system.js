const { cmd } = require('../ahmad-core');
const { getSudoList, addSudo, removeSudo } = require('../data/Sudo');
const { ownerOnlyDenied, renderInfoBox } = require('../lib/menu-styles');

cmd({
    pattern: 'sudo',
    alias: ['addsudo'],
    desc: 'OWNER ONLY: grant a user sudo (owner-level command) access',
    category: 'owner',
    react: '⚡',
    use: '.sudo @user / .sudo <number>'
}, async (conn, mek, m, { from, reply, isOwner, isMe, args, mentionedJid, botNumber }) => {
    if (!isOwner && !isMe) return reply(ownerOnlyDenied());

    let target = mentionedJid?.[0] || m.quoted?.sender;
    if (!target && args[0]) target = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    if (!target) return reply('❌ Mention, reply to, ya number do: .sudo 923001234567');

    const result = await addSudo(botNumber, target);
    if (result.already) return reply('ℹ️ Yeh banda pehle se sudo hai.');
    await conn.sendMessage(from, {
        text: `✅ @${target.split('@')[0]} ko sudo access de diya — ab yeh owner-level commands chala sakta hai. Sirf unhi logo ko sudo do jin par pura bharosa ho.`,
        mentions: [target]
    }, { quoted: mek });
});

cmd({
    pattern: 'delsudo',
    alias: ['removesudo'],
    desc: 'OWNER ONLY: remove a user\'s sudo access',
    category: 'owner',
    react: '🗑️',
    use: '.delsudo @user / .delsudo <number>'
}, async (conn, mek, m, { from, reply, isOwner, isMe, args, mentionedJid, botNumber }) => {
    if (!isOwner && !isMe) return reply(ownerOnlyDenied());

    let target = mentionedJid?.[0] || m.quoted?.sender;
    if (!target && args[0]) target = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    if (!target) return reply('❌ Mention, reply to, ya number do: .delsudo 923001234567');

    const result = await removeSudo(botNumber, target);
    if (!result.removed) return reply('ℹ️ Yeh banda sudo list mein tha hi nahi.');
    await conn.sendMessage(from, {
        text: `✅ @${target.split('@')[0]} ka sudo access hata diya.`,
        mentions: [target]
    }, { quoted: mek });
});

cmd({
    pattern: 'listsudo',
    alias: ['sudolist'],
    desc: 'List all sudo users for this bot session',
    category: 'owner',
    react: '📋'
}, async (conn, mek, m, { reply, botNumber }) => {
    const list = await getSudoList(botNumber);
    if (!list.length) return reply('ℹ️ Koi sudo user nahi hai abhi.');
    reply(renderInfoBox('Sudo Users', list.map((n, i) => ({ emoji: '⚡', label: `${i + 1}`, value: `+${n}` }))));
});

cmd({
    pattern: 'demoteall',
    desc: 'OWNER/ADMIN: demote all group admins except the bot itself',
    category: 'group',
    react: '⬇️'
}, async (conn, mek, m, { from, reply, isGroup, isAdmins, isBotAdmins }) => {
    if (!isGroup) return reply('❌ Groups only.');
    if (!isAdmins) return reply('❌ Group admins only.');
    if (!isBotAdmins) return reply('❌ Bot ko admin banao pehle.');

    const metadata = await conn.groupMetadata(from);
    const botJid = conn.user.id.split(':')[0] + '@s.whatsapp.net';
    const admins = metadata.participants.filter((p) => p.admin && p.id !== botJid).map((p) => p.id);
    if (!admins.length) return reply('ℹ️ Koi aur admin nahi hai demote karne ke liye.');

    try {
        await conn.groupParticipantsUpdate(from, admins, 'demote');
        reply(`✅ ${admins.length} admin(s) demote kar diye.`);
    } catch (e) {
        console.log('[DEMOTEALL] failed:', e.message);
        reply('❌ Demote fail ho gaya, dobara try karo.');
    }
});

cmd({
    pattern: 'tagnotadmin',
    alias: ['tagmembers'],
    desc: 'Tag only the NON-admin members of the group',
    category: 'group',
    react: '📢',
    use: '.tagnotadmin <message>'
}, async (conn, mek, m, { from, reply, isGroup, isAdmins, text, args }) => {
    if (!isGroup) return reply('❌ Groups only.');
    if (!isAdmins) return reply('❌ Group admins only.');

    const metadata = await conn.groupMetadata(from);
    const nonAdmins = metadata.participants.filter((p) => !p.admin).map((p) => p.id);
    if (!nonAdmins.length) return reply('ℹ️ Is group mein sab admin hain.');

    const message = (text || args.join(' ')).trim() || 'Attention!';
    const mentionText = nonAdmins.map((jid) => `@${jid.split('@')[0]}`).join(' ');

    await conn.sendMessage(from, {
        text: `📢 ${message}\n\n${mentionText}`,
        mentions: nonAdmins
    }, { quoted: mek });
});
