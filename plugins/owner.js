const { cmd } = require('../ahmad-core');
const config = require('../config');
const fs = require('fs');
const path = require('path');
const { ownerOnlyDenied } = require('../lib/menu-styles');

// ====================================================
// AHMAD MINI — OWNER COMMANDS (54 total)
// ====================================================

// Bold font helper
function toFancy(text) {
    const map = {
        'a':'𝐚','b':'𝐛','c':'𝐜','d':'𝐝','e':'𝐞','f':'𝐟','g':'𝐠','h':'𝐡','i':'𝐢','j':'𝐣',
        'k':'𝐤','l':'𝐥','m':'𝐦','n':'𝐧','o':'𝐨','p':'𝐩','q':'𝐪','r':'𝐫','s':'𝐬','t':'𝐭',
        'u':'𝐮','v':'𝐯','w':'𝐰','x':'𝐱','y':'𝐲','z':'𝐳',
        'A':'𝐀','B':'𝐁','C':'𝐂','D':'𝐃','E':'𝐄','F':'𝐅','G':'𝐆','H':'𝐇','I':'𝐈','J':'𝐉',
        'K':'𝐊','L':'𝐋','M':'𝐌','N':'𝐍','O':'𝐎','P':'𝐏','Q':'𝐐','R':'𝐑','S':'𝐒','T':'𝐓',
        'U':'𝐔','V':'𝐕','W':'𝐖','X':'𝐗','Y':'𝐘','Z':'𝐙',' ':' '
    };
    return text.split('').map(ch => map[ch] || ch).join('');
}

const BOT = config.BOT_NAME || '™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 ᥫᩣ';
const FOOTER = config.BOT_FOOTER || randomFooter();

// In-memory stores (persist across commands in same session)
const banList    = new Set();
const whitelist  = new Set();
const blacklist  = new Set();
const premiumList= new Set();
const ownerList  = new Set([config.OWNER_NUMBER?.replace(/[^0-9]/g,'')]);
let   maintenanceMode = false;
let   broadcastDelay  = 1500;
// 🚨 ANTIBAN IMPROVEMENT: a perfectly fixed delay between every send is
// itself a bot fingerprint (real humans never message at exact 1500ms
// intervals). This adds ±40% random jitter around broadcastDelay so the
// pacing looks organic, while keeping the average close to whatever the
// owner set via .setbroadcastdelay.
const jitterDelay = () => new Promise(r => setTimeout(r, broadcastDelay + Math.floor(Math.random() * broadcastDelay * 0.8) - broadcastDelay * 0.4));

// ══════════════════════════════════════════════
// ★ BROADCAST & COMMUNICATION (4)
// ══════════════════════════════════════════════

// 1. broadcast
cmd({
    pattern: 'broadcast',
    alias: ['bc'],
    desc: 'Send message to all groups',
    category: 'owner',
    react: '📢'
}, async (conn, mek, m, { isOwner, reply, text }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    if (!text) return reply(`📢 ${toFancy('Usage')}: .broadcast <message>`);
    const groups = await conn.groupFetchAllParticipating();
    const ids = Object.keys(groups);
    let sent = 0, failed = 0;
    for (const id of ids) {
        try {
            await conn.sendMessage(id, { text: `${BOT}\n\n${text}\n\n_${FOOTER}_` });
            sent++;
            await jitterDelay();
        } catch { failed++; }
    }
    reply(`✅ ${toFancy('Broadcast Done')}\n📤 ${toFancy('Sent')}: ${sent}\n❌ ${toFancy('Failed')}: ${failed}`);
});

// 2. broadcastusers
cmd({
    pattern: 'broadcastusers',
    alias: ['bcusers','bcu'],
    desc: 'Send message to all DM contacts',
    category: 'owner',
    react: '📢'
}, async (conn, mek, m, { isOwner, reply, text }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    if (!text) return reply(`📢 ${toFancy('Usage')}: .broadcastusers <message>`);
    const contacts = await conn.getContacts?.() || [];
    const users = Object.values(contacts).filter(c => c.id?.endsWith('@s.whatsapp.net'));
    let sent = 0, failed = 0;
    for (const u of users.slice(0, 200)) {
        try {
            await conn.sendMessage(u.id, { text: `${BOT}\n\n${text}\n\n_${FOOTER}_` });
            sent++;
            await jitterDelay();
        } catch { failed++; }
    }
    reply(`✅ ${toFancy('Broadcast Done')}\n📤 ${toFancy('Sent')}: ${sent}\n❌ ${toFancy('Failed')}: ${failed}`);
});

// 3. forwardall
cmd({
    pattern: 'forwardall',
    alias: ['fwall'],
    desc: 'Forward a quoted message to all groups',
    category: 'owner',
    react: '📨'
}, async (conn, mek, m, { isOwner, reply, quoted }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    if (!quoted) return reply(`📨 ${toFancy('Reply to a message first')}`);
    const groups = await conn.groupFetchAllParticipating();
    const ids = Object.keys(groups);
    let sent = 0, failed = 0;
    for (const id of ids) {
        try {
            await conn.copyNForward(id, quoted, true);
            sent++;
            await jitterDelay();
        } catch { failed++; }
    }
    reply(`✅ ${toFancy('Forward Done')}\n📤 ${toFancy('Sent')}: ${sent}\n❌ ${toFancy('Failed')}: ${failed}`);
});

// 4. statusreply
cmd({
    pattern: 'statusreply',
    alias: ['sreply'],
    desc: 'Set auto status reply template',
    category: 'owner',
    react: '💬'
}, async (conn, mek, m, { isOwner, reply, text }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    if (!text) {
        config.AUTO_STATUS_MSG = config.AUTO_STATUS_MSG || '🤗';
        return reply(`💬 ${toFancy('Current Status Reply')}:\n${config.AUTO_STATUS_MSG}`);
    }
    config.AUTO_STATUS_MSG = text;
    reply(`✅ ${toFancy('Status Reply Set')}:\n${text}`);
});

// ══════════════════════════════════════════════
// ★ ACCESS CONTROL (8)
// ══════════════════════════════════════════════

// 5. ban
cmd({
    pattern: 'ban',
    desc: 'Ban a number from using bot',
    category: 'owner',
    react: '🚫'
}, async (conn, mek, m, { isOwner, reply, args, sender, quoted }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const target = args[0]?.replace(/[^0-9]/g,'') 
        || quoted?.sender?.split('@')[0] 
        || sender.split('@')[0];
    if (!target) return reply(`🚫 ${toFancy('Usage')}: .ban <number> or reply to msg`);
    banList.add(target);
    reply(`🚫 ${toFancy('Banned')}: +${target}\n_${toFancy('They cannot use the bot now')}_`);
});

// 6. unban
cmd({
    pattern: 'unban',
    desc: 'Unban a number',
    category: 'owner',
    react: '✅'
}, async (conn, mek, m, { isOwner, reply, args, quoted }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const target = args[0]?.replace(/[^0-9]/g,'') || quoted?.sender?.split('@')[0];
    if (!target) return reply(`✅ ${toFancy('Usage')}: .unban <number>`);
    banList.delete(target);
    reply(`✅ ${toFancy('Unbanned')}: +${target}`);
});

// 7. banlist
cmd({
    pattern: 'banlist',
    desc: 'Show all banned numbers',
    category: 'owner',
    react: '📋'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    if (banList.size === 0) return reply(`📋 ${toFancy('Ban List is Empty')}`);
    const list = [...banList].map((n, i) => `${i+1}. +${n}`).join('\n');
    reply(`🚫 ${toFancy('Banned Numbers')} (${banList.size})\n\n${list}\n\n_${FOOTER}_`);
});

// 8. whitelist
cmd({
    pattern: 'whitelist',
    alias: ['wl'],
    desc: 'Add number to whitelist (bypass restrictions)',
    category: 'owner',
    react: '⭐'
}, async (conn, mek, m, { isOwner, reply, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const num = args[0]?.replace(/[^0-9]/g,'');
    if (!num) return reply(`⭐ ${toFancy('Usage')}: .whitelist <number>`);
    whitelist.add(num);
    reply(`⭐ ${toFancy('Whitelisted')}: +${num}`);
});

// 9. blacklist
cmd({
    pattern: 'blacklist',
    alias: ['bl'],
    desc: 'Blacklist a group from using bot',
    category: 'owner',
    react: '🔴'
}, async (conn, mek, m, { isOwner, reply, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const jid = args[0] || m?.chat;
    if (!jid) return reply(`🔴 ${toFancy('Usage')}: .blacklist <groupJid or run in group>`);
    blacklist.add(jid);
    reply(`🔴 ${toFancy('Blacklisted')}: ${jid}`);
});

// 10. addpremium
cmd({
    pattern: 'addpremium',
    alias: ['addprem'],
    desc: 'Add premium user',
    category: 'owner',
    react: '💎'
}, async (conn, mek, m, { isOwner, reply, args, quoted }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const num = args[0]?.replace(/[^0-9]/g,'') || quoted?.sender?.split('@')[0];
    if (!num) return reply(`💎 ${toFancy('Usage')}: .addpremium <number>`);
    premiumList.add(num);
    reply(`💎 ${toFancy('Premium Added')}: +${num}`);
});

// 11. delpremium
cmd({
    pattern: 'delpremium',
    alias: ['delprem'],
    desc: 'Remove premium user',
    category: 'owner',
    react: '💎'
}, async (conn, mek, m, { isOwner, reply, args, quoted }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const num = args[0]?.replace(/[^0-9]/g,'') || quoted?.sender?.split('@')[0];
    if (!num) return reply(`💎 ${toFancy('Usage')}: .delpremium <number>`);
    premiumList.delete(num);
    reply(`✅ ${toFancy('Premium Removed')}: +${num}`);
});

// 12. premiumlist
cmd({
    pattern: 'premiumlist',
    alias: ['plist'],
    desc: 'Show all premium users',
    category: 'owner',
    react: '💎'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    if (premiumList.size === 0) return reply(`💎 ${toFancy('No Premium Users Yet')}`);
    const list = [...premiumList].map((n,i)=>`${i+1}. +${n}`).join('\n');
    reply(`💎 ${toFancy('Premium Users')} (${premiumList.size})\n\n${list}\n\n_${FOOTER}_`);
});

// ══════════════════════════════════════════════
// ★ BOT CONTROL (10)
// ══════════════════════════════════════════════

// 13. join
cmd({
    pattern: 'join',
    desc: 'Join a group via invite link',
    category: 'owner',
    react: '🔗'
}, async (conn, mek, m, { isOwner, reply, text }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    if (!text) return reply(`🔗 ${toFancy('Usage')}: .join <group invite link>`);
    try {
        const code = text.split('https://chat.whatsapp.com/')[1];
        if (!code) return reply(`❌ ${toFancy('Invalid Link')}`);
        await conn.groupAcceptInvite(code);
        reply(`✅ ${toFancy('Joined Group Successfully')}`);
    } catch (e) {
        reply(`❌ ${toFancy('Failed')}: ${e.message}`);
    }
});

// 14. leaveall
cmd({
    pattern: 'leaveall',
    desc: 'Leave all groups except current',
    category: 'owner',
    react: '👋'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const groups = await conn.groupFetchAllParticipating();
    const ids = Object.keys(groups).filter(id => id !== m?.chat);
    let left = 0;
    for (const id of ids) {
        try { await conn.groupLeave(id); left++; await new Promise(r => setTimeout(r,800)); } catch {}
    }
    reply(`✅ ${toFancy('Left')} ${left} ${toFancy('Groups')}`);
});

// 15. groupsjoinedlist
cmd({
    pattern: 'groupsjoinedlist',
    alias: ['gclist','groupslist'],
    desc: 'List all joined groups',
    category: 'owner',
    react: '📋'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const groups = await conn.groupFetchAllParticipating();
    const list = Object.values(groups).map((g,i) => `${i+1}. ${g.subject}`).join('\n');
    reply(`📋 ${toFancy('Groups Joined')} (${Object.keys(groups).length})\n\n${list}\n\n_${FOOTER}_`);
});

// 16. restart
cmd({
    pattern: 'restart',
    alias: ['reboot'],
    desc: 'Restart the bot',
    category: 'owner',
    react: '🔄'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    await reply(`🔄 ${toFancy('Restarting')} ${BOT}...`);
    setTimeout(() => process.exit(0), 1500);
});

// 17. shutdown
cmd({
    pattern: 'shutdown',
    alias: ['turnoff'],
    desc: 'Shutdown the bot',
    category: 'owner',
    react: '⛔'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    await reply(`⛔ ${BOT} ${toFancy('Shutting Down')}...\n_${FOOTER}_`);
    setTimeout(() => process.exit(1), 1500);
});

// 18. maintenance
cmd({
    pattern: 'maintenance',
    alias: ['maint'],
    desc: 'Toggle maintenance mode',
    category: 'owner',
    react: '🔧'
}, async (conn, mek, m, { isOwner, reply, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const val = args[0]?.toLowerCase();
    if (val === 'on') { maintenanceMode = true; }
    else if (val === 'off') { maintenanceMode = false; }
    else { maintenanceMode = !maintenanceMode; }
    reply(`🔧 ${toFancy('Maintenance Mode')}: ${maintenanceMode ? '✅ ON' : '❌ OFF'}`);
});

// 19. setadminonly
cmd({
    pattern: 'setadminonly',
    alias: ['adminonly'],
    desc: 'Only group admins can use bot cmds in that group',
    category: 'owner',
    react: '👑'
}, async (conn, mek, m, { isOwner, reply, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const val = args[0]?.toLowerCase();
    const current = config.ADMIN_ONLY || 'false';
    config.ADMIN_ONLY = (val === 'on') ? 'true' : (val === 'off') ? 'false' : current === 'true' ? 'false' : 'true';
    reply(`👑 ${toFancy('Admin Only Mode')}: ${config.ADMIN_ONLY === 'true' ? '✅ ON' : '❌ OFF'}`);
});

// 20. setcommandcooldown
cmd({
    pattern: 'setcommandcooldown',
    alias: ['cooldown'],
    desc: 'Set command spam delay (in seconds)',
    category: 'owner',
    react: '⏱️'
}, async (conn, mek, m, { isOwner, reply, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const sec = parseInt(args[0]);
    if (isNaN(sec) || sec < 0) return reply(`⏱️ ${toFancy('Usage')}: .cooldown <seconds>`);
    config.CMD_COOLDOWN = sec;
    reply(`⏱️ ${toFancy('Command Cooldown Set')}: ${sec}s`);
});

// NEW: wipedb — clears ALL MongoDB-stored data for THIS bot number (settings,
// session record), for a genuinely fresh start. Note: MongoDB never stores
// message history or command history — only auth session + settings — so
// this alone won't stop message replay (that comes from WhatsApp's own
// history-sync, already handled by the timestamp-freshness filter in
// main.js). This is for a clean-slate reset, not a spam fix by itself.
cmd({
    pattern: 'wipedb',
    alias: ['fullreset', 'wipemydata'],
    desc: 'Clear ALL MongoDB data for this bot number (settings + session record)',
    category: 'owner',
    react: '🧨'
}, async (conn, mek, m, { isOwner, reply, botNumber, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    if (args[0] !== 'confirm') {
        return reply(`🧨 *WIPE DATABASE*\n\nThis will delete from MongoDB for ${botNumber}:\n• Saved config/settings\n• Session record\n\nThe bot will disconnect immediately and need to be paired again via .pair/QR.\n\n⚠️ This only wipes settings/session — group settings (antidelete, welcome, etc.), warnings, and stats are NOT removed (those live in separate collections).\n\nTo confirm: .wipedb confirm`);
    }
    try {
        const { UserConfig, Session } = require('../lib/database');
        await UserConfig.deleteOne({ number: botNumber });
        await Session.deleteOne({ number: botNumber });
        reply(`🧨 *Wiped.* Config and session record for ${botNumber} deleted from MongoDB.\n♻️ The bot will now restart/reconnect and need to be paired again via QR.`);
    } catch (e) {
        reply(`❌ Error: ${e.message}`);
    }
});

// NEW: diskusage — check temp-file storage usage without needing SSH/file
// manager access. Helps confirm the storage-bloat fixes are actually working
// on hosts with tight limits (KataBump free tier etc).
// NEW: setwelcomevideo — set/clear the video shown on successful connect
cmd({
    pattern: 'setwelcomevideo',
    alias: ['setconnectvideo'],
    desc: 'Set (or clear) the welcome video shown on successful connect',
    category: 'owner',
    react: '🎬'
}, async (conn, mek, m, { isOwner, reply, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const url = args[0];
    if (!url) {
        config.WELCOME_VIDEO_PATH = '';
        return reply('✅ Welcome video cleared — back to using the image on connect.');
    }
    if (!/^https?:\/\//i.test(url)) return reply('❌ Usage: .setwelcomevideo <direct video URL>\n💡 Or send .setwelcomevideo (with no URL) to clear it.');
    config.WELCOME_VIDEO_PATH = url;
    reply('✅ Welcome video set! This video will show on the next connect.');
});

// NEW: testwelcome — preview the connect message/video right now without reconnecting
cmd({
    pattern: 'testwelcome',
    desc: 'Preview the connect welcome message/video right now',
    category: 'owner',
    react: '👀'
}, async (conn, mek, m, { isOwner, reply, from, config: cfg }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const mode = cfg.MODE || cfg.WORK_TYPE;
    const welcomeHeaders = [
        `👑 ═══════════════ 👑\n   𝐖𝐄𝐋𝐂𝐎𝐌𝐄 𝐓𝐎\n   𝐀𝐇𝐌𝐀𝐃 - 𝐌𝐈𝐍𝐈\n👑 ═══════════════ 👑`,
        `🔥『 𝐀𝐇𝐌𝐀𝐃 𝐌𝐈𝐍𝐈 』🔥\n   ⚔️ 𝐖𝐄𝐋𝐂𝐎𝐌𝐄, 𝐁𝐎𝐒𝐒 ⚔️`,
        `▓▓▓ 𝑨𝑯𝑴𝑨𝑫 · 𝑴𝑰𝑵𝑰 ▓▓▓\n  ☠️ 𝒀𝑶𝑼'𝑹𝑬 𝑰𝑵. 𝑳𝑬𝑻'𝑺 𝑮𝑶 ☠️`,
        `⚡━━━━━━━━━━━━━━⚡\n   𝐀𝐇𝐌𝐀𝐃-𝐌𝐈𝐍𝐈 𝐈𝐒 𝐋𝐈𝐕𝐄\n⚡━━━━━━━━━━━━━━⚡`
    ];
    const randomHeader = welcomeHeaders[Math.floor(Math.random() * welcomeHeaders.length)];
    const { randomFooter } = require('../lib/menu-styles');
    const caption = `${randomHeader}\n\n✅ *Connected Successfully* — you're all set! 🔥\n\n┏━━━━━━━━━━━━━━┓\n┃ 📋 Menu   : ${cfg.PREFIX}menu\n┃ 🔧 Prefix : 「 ${cfg.PREFIX} 」\n┃ ⚙️ Mode   : 「 ${mode} 」\n┗━━━━━━━━━━━━━━┛\n\n💞 *Stay updated — join our channel:*\n${cfg.CHANNEL_LINK}\n\n━━━━━━━━━━━━━━━━━\n> ${randomFooter()}`;
    try {
        if (cfg.WELCOME_VIDEO_PATH) {
            await conn.sendMessage(from, { video: { url: cfg.WELCOME_VIDEO_PATH }, caption, ptv: true });
        } else {
            await conn.sendMessage(from, { image: { url: cfg.IMAGE_PATH }, caption });
        }
    } catch (e) {
        reply(`❌ Preview failed: ${e.message}`);
    }
});

cmd({
    pattern: 'diskusage',
    alias: ['storagecheck', 'tmpsize'],
    desc: 'Check how much space the bot\'s temp files are using',
    category: 'owner',
    react: '💾'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    try {
        const os = require('os');
        const dirs = [...new Set([os.tmpdir(), '/tmp'])];
        const ourPrefixes = ['ytaudio_', 'ytvideo_', 'vvcache_', 'menu_in_', 'menu_out_', 'amd_', 'vc_'];
        let totalBytes = 0, totalFiles = 0;
        const breakdown = {};
        for (const dir of dirs) {
            try {
                for (const file of fs.readdirSync(dir)) {
                    const prefix = ourPrefixes.find(p => file.startsWith(p));
                    if (!prefix) continue;
                    try {
                        const stat = fs.statSync(path.join(dir, file));
                        totalBytes += stat.size;
                        totalFiles++;
                        breakdown[prefix] = (breakdown[prefix] || 0) + stat.size;
                    } catch {}
                }
            } catch {}
        }
        const cacheCount = global.viewOnceCache ? global.viewOnceCache.size : 0;
        const mb = (b) => (b / (1024 * 1024)).toFixed(2);
        const { toSansBold } = require('../lib/menu-styles');
        let text = `💾 *DISK USAGE (bot temp files)*\n\n📦 Total: ${mb(totalBytes)} MB across ${totalFiles} files\n👁️ View-once cache: ${cacheCount} entries\n\n`;
        for (const [prefix, bytes] of Object.entries(breakdown)) {
            // 🔧 FIX (Bunty: "* yeh * fazool mein aata cut karo") — this had
            // a lone trailing "*" with no matching pair, so it just showed
            // up as a stray asterisk instead of doing anything. Removed it.
            text += `• ${toSansBold(prefix)} → ${mb(bytes)} MB\n`;
        }
        text += `\n💡 Files older than 1hr auto-clean every 30 min.`;
        reply(text);
    } catch (e) {
        reply(`❌ Error: ${e.message}`);
    }
});
cmd({
    pattern: 'resetconfig',
    alias: ['configreset'],
    desc: 'Reset runtime config to defaults',
    category: 'owner',
    react: '♻️'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    config.ADMIN_ONLY = 'false';
    config.CMD_COOLDOWN = 0;
    maintenanceMode = false;
    reply(`♻️ ${toFancy('Config Reset to Defaults')}`);
});

// 22. setbroadcastdelay
cmd({
    pattern: 'setbroadcastdelay',
    alias: ['bcdelay'],
    desc: 'Set delay between broadcast messages (ms)',
    category: 'owner',
    react: '⏳'
}, async (conn, mek, m, { isOwner, reply, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const ms = parseInt(args[0]);
    if (isNaN(ms) || ms < 500) return reply(`⏳ ${toFancy('Usage')}: .bcdelay <ms> (min 500)`);
    broadcastDelay = ms;
    reply(`⏳ ${toFancy('Broadcast Delay Set')}: ${ms}ms`);
});

// ══════════════════════════════════════════════
// ★ DEVELOPER / DEBUG (10)
// ══════════════════════════════════════════════

// 23. eval
cmd({
    pattern: 'eval',
    alias: ['>'],
    desc: 'Evaluate JS code (owner debug)',
    category: 'owner',
    react: '⚡'
}, async (conn, mek, m, { isOwner, reply, text }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    if (!text) return reply(`⚡ ${toFancy('Usage')}: .eval <js code>`);
    try {
        let result = await eval(text);
        if (typeof result !== 'string') result = JSON.stringify(result, null, 2);
        reply(`⚡ ${toFancy('Result')}:\n\`\`\`\n${result?.slice(0,1500)}\n\`\`\``);
    } catch (e) {
        reply(`❌ ${toFancy('Error')}:\n${e.message}`);
    }
});

// 25b. addcmd — owner adds a brand-new permanent command with custom JS
// (eval-based, but saved to disk so it survives restarts, unlike .eval).
cmd({
    pattern: 'addcmd',
    alias: ['newcmd'],
    desc: 'Owner: add a new custom command with JS code (saved permanently)',
    category: 'owner',
    react: '🧩'
}, async (conn, mek, m, { isOwner, reply, text }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    if (!text || !text.includes('\n')) {
        return reply(`🧩 ${toFancy('Usage')}:\n.addcmd <name>\n<js code — use ctx.reply(...), ctx.args, ctx.text>\n\n${toFancy('Example')}:\n.addcmd hello\nctx.reply("Hi " + (m.pushName || "friend") + "!");\n\n⚠️ Runs with full bot access, same as .eval — only add code you trust.`);
    }
    const firstLine = text.split('\n')[0].trim();
    const pattern = firstLine.split(/\s+/)[0].toLowerCase().replace(/^\.+/, '');
    const code = text.split('\n').slice(1).join('\n').trim();
    if (!pattern) return reply('❌ Give a command name on the first line.\n💡 Usage: .addcmd <name>\\n<code>');
    if (!code) return reply('❌ No code given after the command name.');
    try {
        const { registerCustomCommand } = require('../lib/custom-cmds');
        registerCustomCommand(pattern, code);
        reply(`✅ ${toFancy('Custom command added')}: .${pattern}\n💾 Saved — survives restarts.\n🗑️ Remove anytime with: .delcmd ${pattern}`);
    } catch (e) {
        reply(`❌ Failed to add command: ${e.message}`);
    }
});

// 25c. delcmd — remove a custom command added via .addcmd
cmd({
    pattern: 'delcmd',
    desc: 'Owner: remove a custom command added via .addcmd',
    category: 'owner',
    react: '🗑️'
}, async (conn, mek, m, { isOwner, reply, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const pattern = (args[0] || '').toLowerCase().replace(/^\.+/, '');
    if (!pattern) return reply('❌ Usage: .delcmd <name>');
    const { removeCustomCommand } = require('../lib/custom-cmds');
    const ok = removeCustomCommand(pattern);
    reply(ok ? `✅ Removed custom command: .${pattern}` : `❌ No custom command named .${pattern}`);
});

// 25d. customcmds — list all custom commands added via .addcmd
cmd({
    pattern: 'customcmds',
    alias: ['listcustom', 'mycmds'],
    desc: 'List all custom commands added via .addcmd',
    category: 'owner',
    react: '📋'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const { listCustomCommands } = require('../lib/custom-cmds');
    const list = listCustomCommands();
    if (!list.length) return reply(`📋 ${toFancy('No custom commands yet')}. Add one with .addcmd`);
    reply(`📋 ${toFancy('Custom Commands')} (${list.length}):\n\n${list.map(p => `• .${p}`).join('\n')}`);
});


cmd({
    pattern: 'exec',
    alias: ['$', 'shell'],
    desc: 'Run shell command',
    category: 'owner',
    react: '💻'
}, async (conn, mek, m, { isOwner, reply, text }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    if (!text) return reply(`💻 ${toFancy('Usage')}: .exec <command>`);
    const { exec } = require('child_process');
    exec(text, { timeout: 15000 }, (err, stdout, stderr) => {
        const output = stdout || stderr || err?.message || 'No output';
        reply(`💻 ${toFancy('Output')}:\n\`\`\`\n${output.slice(0,1500)}\n\`\`\``);
    });
});

// 25. logs
const logBuffer = [];
cmd({
    pattern: 'logs',
    desc: 'Show recent bot activity logs',
    category: 'owner',
    react: '📜'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    if (logBuffer.length === 0) return reply(`📜 ${toFancy('No logs yet')}`);
    reply(`📜 ${toFancy('Recent Logs')}:\n\n${logBuffer.slice(-20).join('\n')}`);
});

// 26. clearlogs
cmd({
    pattern: 'clearlogs',
    desc: 'Clear activity logs',
    category: 'owner',
    react: '🗑️'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    logBuffer.length = 0;
    reply(`🗑️ ${toFancy('Logs Cleared')}`);
});

// 27. testcmd
cmd({
    pattern: 'testcmd',
    desc: 'Check if a command is registered',
    category: 'owner',
    react: '🔬'
}, async (conn, mek, m, { isOwner, reply, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const name = args[0]?.toLowerCase();
    if (!name) return reply(`🔬 ${toFancy('Usage')}: .testcmd <cmdname>`);
    const { commands } = require('../ahmad-core');
    const found = commands.find(c => c.pattern === name || (c.alias || []).includes(name));
    if (found) {
        reply(`✅ ${toFancy('Command Found')}\n📛 ${toFancy('Name')}: ${found.pattern}\n📁 ${toFancy('Category')}: ${found.category}\n📝 ${toFancy('Desc')}: ${found.desc || 'N/A'}`);
    } else {
        reply(`❌ ${toFancy('Command Not Found')}: .${name}`);
    }
});

// 28. listcommands
cmd({
    pattern: 'listcommands',
    alias: ['cmdlist','allcmds'],
    desc: 'List all registered commands',
    category: 'owner',
    react: '📋'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const { commands } = require('../ahmad-core');
    const list = commands.map((c,i) => `${i+1}. .${c.pattern} [${c.category}]`).join('\n');
    reply(`📋 ${toFancy('All Commands')} (${commands.length})\n\n${list.slice(0,3500)}`);
});

// 29. selfcheck
cmd({
    pattern: 'selfcheck',
    alias: ['healthcheck'],
    desc: 'Check bot health and status',
    category: 'owner',
    react: '💓'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const { commands } = require('../ahmad-core');
    const uptime = process.uptime();
    const h = Math.floor(uptime/3600), min = Math.floor((uptime%3600)/60), s = Math.floor(uptime%60);
    const mem = process.memoryUsage();
    reply(`💓 ${BOT} ${toFancy('Health Check')}\n\n` +
        `⏱️ ${toFancy('Uptime')}: ${h}h ${min}m ${s}s\n` +
        `🧠 ${toFancy('Memory')}: ${(mem.heapUsed/1024/1024).toFixed(1)}MB / ${(mem.heapTotal/1024/1024).toFixed(1)}MB\n` +
        `📦 ${toFancy('Commands Loaded')}: ${commands.length}\n` +
        `🔧 ${toFancy('Maintenance')}: ${maintenanceMode ? 'ON' : 'OFF'}\n` +
        `🚫 ${toFancy('Banned')}: ${banList.size}\n` +
        `💎 ${toFancy('Premium')}: ${premiumList.size}\n\n` +
        `_${FOOTER}_`);
});

// 30. cleartmp
cmd({
    pattern: 'cleartmp',
    alias: ['clearcache'],
    desc: 'Clear temp/cache files',
    category: 'owner',
    react: '🧹'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const tmpDir = path.join(__dirname, '../temp');
    let count = 0;
    try {
        if (fs.existsSync(tmpDir)) {
            const files = fs.readdirSync(tmpDir);
            for (const f of files) {
                try { fs.unlinkSync(path.join(tmpDir, f)); count++; } catch {}
            }
        }
        reply(`🧹 ${toFancy('Temp Cleared')}: ${count} ${toFancy('files deleted')}`);
    } catch (e) {
        reply(`❌ ${toFancy('Error')}: ${e.message}`);
    }
});

// 31. forwardlog
cmd({
    pattern: 'forwardlog',
    alias: ['flog'],
    desc: 'Toggle error forwarding to owner DM',
    category: 'owner',
    react: '📩'
}, async (conn, mek, m, { isOwner, reply, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const val = args[0]?.toLowerCase();
    config.FORWARD_LOG = (val === 'on') ? 'true' : (val === 'off') ? 'false' : config.FORWARD_LOG === 'true' ? 'false' : 'true';
    reply(`📩 ${toFancy('Forward Log')}: ${config.FORWARD_LOG === 'true' ? '✅ ON' : '❌ OFF'}`);
});

// 32. reloadplugins
cmd({
    pattern: 'reloadplugins',
    alias: ['reload'],
    desc: 'Reload plugins without restarting bot',
    category: 'owner',
    react: '🔁'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    try {
        const pluginsDir = path.join(__dirname);
        const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'));
        for (const f of files) {
            try { delete require.cache[require.resolve(path.join(pluginsDir, f))]; require(path.join(pluginsDir, f)); } catch {}
        }
        reply(`🔁 ${toFancy('Plugins Reloaded')}: ${files.length} ${toFancy('files')}`);
    } catch (e) {
        reply(`❌ ${e.message}`);
    }
});

// ══════════════════════════════════════════════
// ★ SESSION & DATA (6)
// ══════════════════════════════════════════════

// 33. clearsession
cmd({
    pattern: 'clearsession',
    desc: 'Clear auth session files',
    category: 'owner',
    react: '🗑️'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const sessionDir = path.join(__dirname, '../session');
    let count = 0;
    try {
        if (fs.existsSync(sessionDir)) {
            const files = fs.readdirSync(sessionDir).filter(f => !f.includes('creds'));
            for (const f of files) { try { fs.unlinkSync(path.join(sessionDir, f)); count++; } catch {} }
        }
        reply(`🗑️ ${toFancy('Session Cleared')}: ${count} ${toFancy('files')}\n⚠️ ${toFancy('Creds kept safe')}`);
    } catch (e) {
        reply(`❌ ${e.message}`);
    }
});

// 34. getsession
cmd({
    pattern: 'getsession',
    alias: ['getcreds'],
    desc: 'Send creds.json to owner DM',
    category: 'owner',
    react: '🔑'
}, async (conn, mek, m, { isOwner, reply, sender }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const credsPath = path.join(__dirname, '../session/creds.json');
    try {
        if (!fs.existsSync(credsPath)) return reply(`❌ ${toFancy('creds.json not found')}`);
        const data = fs.readFileSync(credsPath);
        await conn.sendMessage(sender, {
            document: data,
            mimetype: 'application/json',
            fileName: 'creds.json'
        });
        reply(`🔑 ${toFancy('Session sent to your DM')}`);
    } catch (e) {
        reply(`❌ ${e.message}`);
    }
});

// 35. exportdb
cmd({
    pattern: 'exportdb',
    desc: 'Export local database to owner DM',
    category: 'owner',
    react: '💾'
}, async (conn, mek, m, { isOwner, reply, sender }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const dbPath = path.join(__dirname, '../database.json');
    try {
        if (!fs.existsSync(dbPath)) return reply(`❌ ${toFancy('database.json not found')}`);
        const data = fs.readFileSync(dbPath);
        await conn.sendMessage(sender, {
            document: data,
            mimetype: 'application/json',
            fileName: 'database_backup.json'
        });
        reply(`💾 ${toFancy('Database exported to your DM')}`);
    } catch (e) {
        reply(`❌ ${e.message}`);
    }
});

// 36. importdb
cmd({
    pattern: 'importdb',
    desc: 'Import database from quoted file',
    category: 'owner',
    react: '📥'
}, async (conn, mek, m, { isOwner, reply, quoted, downloadMediaMessage }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    if (!quoted) return reply(`📥 ${toFancy('Reply to a .json file with .importdb')}`);
    try {
        const buffer = await downloadMediaMessage(quoted);
        const dbPath = path.join(__dirname, '../database.json');
        fs.writeFileSync(dbPath, buffer);
        reply(`✅ ${toFancy('Database Imported Successfully')}`);
    } catch (e) {
        reply(`❌ ${e.message}`);
    }
});

// 37. setapikey
cmd({
    pattern: 'setapikey',
    desc: 'Set an API key in config (usage: .setapikey <name> <key>)',
    category: 'owner',
    react: '🔑'
}, async (conn, mek, m, { isOwner, reply, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    if (!args[0] || !args[1]) return reply(`🔑 ${toFancy('Usage')}: .setapikey <name> <value>`);
    const key = args[0].toUpperCase();
    const val = args[1];
    config[key] = val;
    reply(`✅ ${toFancy('API Key Set')}\n📛 ${toFancy('Key')}: ${key}\n🔑 ${toFancy('Value')}: ${val.slice(0,6)}****`);
});

// 38. listapikeys
cmd({
    pattern: 'listapikeys',
    alias: ['apikeys'],
    desc: 'List all set API keys',
    category: 'owner',
    react: '🗂️'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const apiKeys = Object.entries(config)
        .filter(([k]) => k.includes('API') || k.includes('TOKEN') || k.includes('KEY'))
        .map(([k, v]) => `🔑 ${k}: ${String(v).slice(0,6)}****`).join('\n');
    reply(`🗂️ ${toFancy('API Keys')}:\n\n${apiKeys || toFancy('None configured')}`);
});

// ══════════════════════════════════════════════
// ★ OWNER MANAGEMENT (5)
// ══════════════════════════════════════════════

// 39. addowner
cmd({
    pattern: 'addowner',
    alias: ['addown'],
    desc: 'Add a new owner (disabled — single-owner lock)',
    category: 'owner',
    react: '👑'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    // 🚨 SECURITY FIX (Ahmad: "owner zone cmd only +923044975027 ho, koi
    // aur nahi"): this used to write the given number into a local
    // `ownerList` Set and reply "👑 Owner Added" — looking like it granted
    // real access. It never did: the actual permission check everywhere
    // else (main.js's isOwner) only ever compares against
    // config.OWNER_NUMBER, which this Set was never wired into. So it was
    // silently a no-op — misleading either way. Disabled outright so
    // there's exactly one real owner, matching what's actually enforced.
    reply(`👑 ${toFancy('Multi-owner is disabled')}\n\nOwner zone is locked to a single number: +${config.OWNER_NUMBER}\n\nTo change the owner, use .setowner <number> instead.`);
});

// 40. delowner
cmd({
    pattern: 'delowner',
    alias: ['delown'],
    desc: 'Remove an owner (disabled — single-owner lock)',
    category: 'owner',
    react: '👑'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    reply(`👑 ${toFancy('Multi-owner is disabled')}\n\nOnly +${config.OWNER_NUMBER} has owner access — there's nothing else to remove.`);
});

// 41. ownerlist
cmd({
    pattern: 'ownerlist',
    alias: ['listowner','listowners'],
    desc: 'Show the owner',
    category: 'owner',
    react: '👑'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    reply(`👑 ${toFancy('Owner')}\n\n1. +${config.OWNER_NUMBER}\n\n_${FOOTER}_`);
});

// 42. setbotowner
cmd({
    pattern: 'setbotowner',
    desc: 'Change primary bot owner number',
    category: 'owner',
    react: '👑'
}, async (conn, mek, m, { isOwner, reply, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const num = args[0]?.replace(/[^0-9]/g,'');
    if (!num) return reply(`👑 ${toFancy('Usage')}: .setbotowner <number>`);
    config.OWNER_NUMBER = `+${num}`;
    ownerList.add(num);
    reply(`✅ ${toFancy('Primary Owner Set')}: +${num}`);
});

// 43. ownerinfo
cmd({
    pattern: 'ownerinfo',
    desc: 'Show owner/developer details',
    category: 'owner',
    react: '👑'
}, async (conn, mek, m, { reply, config }) => {
    // Made public — this is a credits/about card, not a sensitive owner
    // control, so no reason to gate it behind isOwner.
    reply(
        `👑 ${toFancy('Owner Info')}\n\n` +
        `📱 ${toFancy('Number')}: +${config.OWNER_NUMBER}\n` +
        `🤖 ${toFancy('Bot Name')}: ${BOT}\n` +
        `🔢 ${toFancy('Total Owners')}: ${ownerList.size}\n\n` +
        `✨ *Bunty Ahmad always on top* ✨\n` +
        `👨‍💻 He's the developer behind this bot\n` +
        `🔥 Built with passion, coded with skill\n` +
        `🚀 Always improving, always shipping\n` +
        `💎 Respect the grind, respect the hustle\n` +
        `🙏 Say thanks — he built this for you\n\n` +
        `_${FOOTER}_`
    );
});

// ══════════════════════════════════════════════
// ★ MISC OWNER TOOLS (11)
// ══════════════════════════════════════════════

// 44. addjid
cmd({
    pattern: 'addjid',
    desc: 'Add JID to allowed list',
    category: 'owner',
    react: '➕'
}, async (conn, mek, m, { isOwner, reply, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const jid = args[0];
    if (!jid) return reply(`➕ ${toFancy('Usage')}: .addjid <jid>`);
    whitelist.add(jid);
    reply(`✅ ${toFancy('JID Added')}: ${jid}`);
});

// 45. removejid
cmd({
    pattern: 'removejid',
    alias: ['deljid'],
    desc: 'Remove JID from allowed list',
    category: 'owner',
    react: '➖'
}, async (conn, mek, m, { isOwner, reply, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const jid = args[0];
    if (!jid) return reply(`➖ ${toFancy('Usage')}: .removejid <jid>`);
    whitelist.delete(jid);
    reply(`✅ ${toFancy('JID Removed')}: ${jid}`);
});

// 46. setglobalreact
cmd({
    pattern: 'setglobalreact',
    alias: ['globalreact'],
    desc: 'Set global reaction emoji for all commands',
    category: 'owner',
    react: '😊'
}, async (conn, mek, m, { isOwner, reply, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const emoji = args[0];
    if (!emoji) return reply(`😊 ${toFancy('Usage')}: .setglobalreact <emoji>`);
    config.GLOBAL_REACT = emoji;
    reply(`✅ ${toFancy('Global React Set')}: ${emoji}`);
});

// 47. forcejoinchannel
cmd({
    pattern: 'forcejoinchannel',
    alias: ['fjc'],
    desc: 'Toggle force-join-channel gate on/off',
    category: 'owner',
    react: '📢'
}, async (conn, mek, m, { isOwner, reply, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const val = args[0]?.toLowerCase();
    config.FORCE_JOIN = (val === 'on') ? 'true' : (val === 'off') ? 'false' : config.FORCE_JOIN === 'true' ? 'false' : 'true';
    reply(`📢 ${toFancy('Force Join Channel')}: ${config.FORCE_JOIN === 'true' ? '✅ ON' : '❌ OFF'}`);
});

// 48. setforcejoinchannel
cmd({
    pattern: 'setforcejoinchannel',
    alias: ['setfjc'],
    desc: 'Set the channel link for force-join',
    category: 'owner',
    react: '📢'
}, async (conn, mek, m, { isOwner, reply, args }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    if (!args[0]) return reply(`📢 ${toFancy('Usage')}: .setfjc <channel_link>`);
    config.CHANNEL_LINK = args[0];
    reply(`✅ ${toFancy('Force Join Channel Set')}:\n${args[0]}`);
});

// 49. version
cmd({
    pattern: 'version',
    alias: ['ver'],
    desc: 'Show bot version info',
    category: 'owner',
    react: '📦'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    let pkgVersion = '1.0.0';
    try { pkgVersion = require('../package.json').version || pkgVersion; } catch {}
    reply(`📦 ${BOT}\n\n🔢 ${toFancy('Version')}: v${pkgVersion}\n⚙️ ${toFancy('Node')}: ${process.version}\n🔧 ${toFancy('Platform')}: ${process.platform}\n\n_${FOOTER}_`);
});

// 50. changelog
cmd({
    pattern: 'changelog',
    desc: 'Show recent bot changes',
    category: 'owner',
    react: '📝'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    reply(`📝 ${BOT} ${toFancy('Changelog')}\n\n` +
        `✅ ${toFancy('v1.0')} — ${toFancy('Initial Release')}\n` +
        `✅ ${toFancy('v1.1')} — ${toFancy('Added 43 GC commands')}\n` +
        `✅ ${toFancy('v1.2')} — ${toFancy('Added 41 Settings commands')}\n` +
        `✅ ${toFancy('v1.3')} — ${toFancy('Added 54 Owner commands')}\n\n_${FOOTER}_`);
});

// 51. donate
cmd({
    pattern: 'donate',
    desc: 'Show donation info',
    category: 'owner',
    react: '💸'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    reply(`💸 ${toFancy('Support')} ${BOT}\n\n` +
        `🌟 ${toFancy('Your support keeps the bot running!')}\n` +
        `📱 ${toFancy('Contact Owner for donation info')}\n` +
        `📞 ${config.OWNER_NUMBER}\n\n_${FOOTER}_`);
});

// 52. credits
cmd({
    pattern: 'credits',
    desc: 'Show bot credits',
    category: 'owner',
    react: '🌟'
}, async (conn, mek, m, { isOwner, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    reply(`🌟 ${BOT} ${toFancy('Credits')}\n\n` +
        `👑 ${toFancy('Developer')}: Ahmad\n` +
        `🔧 ${toFancy('Framework')}: Baileys (WhiskeySockets)\n` +
        `💻 ${toFancy('Runtime')}: Node.js\n` +
        `🌐 ${toFancy('Channel')}: ${config.CHANNEL_LINK || 'N/A'}\n\n_${FOOTER}_`);
});

// 53. setstatus
cmd({
    pattern: 'setstatus',
    desc: 'Set bot WhatsApp status/about',
    category: 'owner',
    react: '💬'
}, async (conn, mek, m, { isOwner, reply, text }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    if (!text) return reply(`💬 ${toFancy('Usage')}: .setstatus <text>`);
    try {
        await conn.updateProfileStatus(text);
        reply(`✅ ${toFancy('Status Updated')}:\n${text}`);
    } catch (e) {
        reply(`❌ ${e.message}`);
    }
});

// 55. fixsendto — one-time cleanup for the sendTo schema-default bug (see
// data/Antidelete.js / Antiedit.js / AntiViewOnce.js comments). Any chat doc
// created BEFORE that fix already has 'same' physically saved in MongoDB,
// which the code fix alone can't undo — this clears that stale value from
// every non-global doc so the global .delpath/.editpath/.voviewpath
// preference actually applies again everywhere it should.
cmd({
    pattern: 'fixsendto',
    desc: 'One-time cleanup: clear stale per-chat sendTo values so the global delpath/editpath/voviewpath setting applies correctly',
    category: 'owner',
    react: '🧹'
}, async (conn, mek, m, { isOwner, reply, botNumber }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    try {
        const { Antidelete, globalKeyFor: dGlobalKeyFor } = require('../data/Antidelete.js');
        const { Antiedit, globalKeyFor: eGlobalKeyFor } = require('../data/Antiedit.js');
        const { AntiViewOnce, globalKeyFor: vGlobalKeyFor } = require('../data/AntiViewOnce.js');
        const G1 = dGlobalKeyFor(botNumber);
        const G2 = eGlobalKeyFor(botNumber);
        const G3 = vGlobalKeyFor(botNumber);
        // Only touch docs belonging to THIS bot number (chatId starts with
        // "botNumber::") — never another paired number's data.
        const prefix = new RegExp(`^${botNumber}::`);
        const r1 = await Antidelete.updateMany({ chatId: { $regex: prefix, $ne: G1 } }, { $unset: { sendTo: "" } });
        const r2 = await Antiedit.updateMany({ chatId: { $regex: prefix, $ne: G2 } }, { $unset: { sendTo: "" } });
        const r3 = await AntiViewOnce.updateMany({ chatId: { $regex: prefix, $ne: G3 } }, { $unset: { sendTo: "" } });
        reply(`🧹 *Cleaned up stale sendTo values*\n• Antidelete: ${r1.modifiedCount}\n• Antiedit: ${r2.modifiedCount}\n• AntiViewOnce: ${r3.modifiedCount}\n\n✅ Global .delpath/.editpath/.voviewpath settings will now apply everywhere they should. Per-chat sendTo values you set on purpose in a specific chat are untouched — this only clears leftover defaults.`);
    } catch (e) {
        reply(`❌ ${e.message}`);
    }
});

// 56. followchannel — manual trigger for the auto-join fix, so it can be
// tested right now instead of waiting up to 5 minutes for the watcher.
cmd({
    pattern: 'followchannel',
    desc: 'Manually re-check and re-follow the configured channel now',
    category: 'owner',
    react: '📢'
}, async (conn, mek, m, { isOwner, reply, config: cfg }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const channelLink = cfg.CHANNEL_LINK || '';
    if (!channelLink || !channelLink.includes('whatsapp.com/channel/')) {
        return reply('❌ No CHANNEL_LINK configured.');
    }
    const channelCode = channelLink.split('whatsapp.com/channel/')[1].split('?')[0];
    try {
        // 🚨 Same fix as main.js's ensureChannelFollowed — the invite code in
        // the link isn't the real JID, it needs resolving first.
        const inviteMeta = await conn.newsletterMetadata('invite', channelCode);
        const channelJid = inviteMeta?.id;
        if (!channelJid) return reply(`❌ Couldn't resolve the channel link to a JID — it may be wrong or expired.`);
        await conn.newsletterFollow(channelJid);
        const role = inviteMeta?.viewer_metadata?.role;
        reply(`✅ Follow call sent.\n🆔 JID: ${channelJid}\n📍 Role: ${role || 'unknown'}`);
    } catch (e) {
        reply(`❌ Follow failed: ${e.message}`);
    }
});

// 57. pingowner
cmd({
    pattern: 'pingowner',
    desc: 'Send connectivity test message to owner',
    category: 'owner',
    react: '📡'
}, async (conn, mek, m, { isOwner, reply, sender }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const ownerJid = config.OWNER_NUMBER?.replace(/[^0-9]/g,'') + '@s.whatsapp.net';
    const start = Date.now();
    try {
        await conn.sendMessage(ownerJid, { text: `📡 ${toFancy('Ping from')} ${BOT}\n_${toFancy('Connectivity OK')}_` });
        const ping = Date.now() - start;
        reply(`✅ ${toFancy('Owner Pinged')}\n⚡ ${toFancy('Ping')}: ${ping}ms`);
    } catch (e) {
        reply(`❌ ${toFancy('Could not reach owner DM')}: ${e.message}`);
    }
});

// Export ban/whitelist/premium lists for use in main.js middleware
module.exports = { banList, whitelist, blacklist, premiumList, ownerList, maintenanceMode };
