const { cmd } = require('../ahmad-core');
const { randomFooter } = require('../lib/menu-styles');

// 🆕 (Bunty: "baaki bhi add karo") — sends the bug report to THIS bot
// session's own owner (botNumber, consistent with the isMe-scoping used
// everywhere else in this bot) rather than a single hardcoded global
// number, so it works correctly for every paired user's own session too.
cmd({
    pattern: 'reportbug',
    alias: ['bugreport'],
    desc: 'Report a bug directly to this bot session\'s owner',
    category: 'general',
    react: '🐛',
    use: '.reportbug <description>'
}, async (conn, mek, m, { from, sender, pushname, reply, text, args, isGroup, botNumber }) => {
    const description = (text || args.join(' ')).trim();
    if (!description) return reply('❌ Use: .reportbug <describe the issue>\nExample: .reportbug .play command timeout ho raha hai');

    const ownerJid = `${botNumber}@s.whatsapp.net`;
    const reporterNumber = sender.split('@')[0];
    const chatContext = isGroup ? `Group (${from})` : 'Private DM';

    const reportText = `🐛 *New Bug Report*\n\n` +
        `👤 From: ${pushname || 'Unknown'} (+${reporterNumber})\n` +
        `📍 Chat: ${chatContext}\n` +
        `📝 Report:\n${description}\n\n` +
        `> ${randomFooter()}`;

    try {
        await conn.sendMessage(ownerJid, { text: reportText });
        reply('✅ Bug report bhej diya gaya — jald hi dekha jayega. Shukriya! 🙏');
    } catch (e) {
        console.log('[REPORTBUG] failed to send:', e.message);
        reply('❌ Report bhejne mein masla hua, dobara try karo.');
    }
});
