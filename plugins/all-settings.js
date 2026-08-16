const { cmd } = require('../ahmad-core');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');
const { sleep } = require('../lib/functions');
const { updateUserConfig, getUserConfigFromMongoDB } = require('../lib/database');
const { renderInfoBox, ownerOnlyDenied } = require('../lib/menu-styles');
const { getUserBotSettings, setUserBotSettings, deleteUserBotSettings } = require('../data/UserBotSettings');
const { getCachedChatPrefix, setChatPrefix } = require('../data/ChatPrefix');

// 🚨 HARD SELF-ONLY GUARD (Bunty: "koi user kisi ki setting change na kar
// sake — fully lock it down"): setbotname/setbotdp/setbotaudio/clear are
// personal-only by design (each user manages their own .menu look), but
// they all trust the `sender` value handed to them by the message
// pipeline. This re-derives the caller's identity independently, straight
// from the raw message key (not from any variable that passed through
// other code), and refuses to save unless it exactly matches. This is a
// second, independent lock on top of the JID-normalization fix already
// applied in main.js — even if some future bug ever miscomputed `sender`
// upstream, this still blocks the write instead of silently landing on
// someone else's record.
function isSelfOwned(conn, mek, sender) {
    let trueSelf;
    if (mek.key.fromMe) {
        trueSelf = jidNormalizedUser(conn.user.id);
    } else if (mek.key.participant) {
        trueSelf = jidNormalizedUser(mek.key.participant);
    } else {
        trueSelf = jidNormalizedUser(mek.key.remoteJid);
    }
    return trueSelf === jidNormalizedUser(sender);
}

// 🎨 Fancy Font System
function toFancy(text) {
    const map = {
        'a': 'ᴀ', 'b': 'ʙ', 'c': 'ᴄ', 'd': 'ᴅ', 'e': 'ᴇ', 'f': 'ғ',
        'g': 'ɢ', 'h': 'ʜ', 'i': 'ɪ', 'j': 'ᴊ', 'k': 'ᴋ', 'l': 'ʟ',
        'm': 'ᴍ', 'n': 'ɴ', 'o': 'ᴏ', 'p': 'ᴘ', 'q': 'ǫ', 'r': 'ʀ',
        's': 's', 't': 'ᴛ', 'u': 'ᴜ', 'v': 'ᴠ', 'w': 'ᴡ', 'x': 'x',
        'y': 'ʏ', 'z': 'ᴢ'
    };
    return text.toLowerCase().split('').map(char => map[char] || char).join('');
}

// 🎨 Shared attractive toggle-status box (replaces the old plain
// `╭─── X ───╮ │ Status: Y │ Use: Z ╰──╯` boxes across every .auto*/.anti*
// on-off command — requested by Ahmad: "yeh simple hai, bold karo").
const toggleBox = (title, status, usage) => renderInfoBox(title, [
    { emoji: String(status) === 'true' ? '✅' : '❌', label: 'Status', value: String(status) === 'true' ? 'ON' : 'OFF' },
    { emoji: '💡', label: 'Use', value: usage }
]);

// Helper function to update config
// FIX: previously this spread the static config.js object (PREFIX, MONGODB_URI, etc)
// into Mongo on every toggle, wiping out every other previously-saved auto-setting.
// Now it fetches the real current per-number config from MongoDB first and merges into that.
const updateConfig = async (key, value, botNumber, config, reply) => {
    try {
        const currentConfig = await getUserConfigFromMongoDB(botNumber);
        const newConfig = { ...currentConfig, [key]: value };
        await updateUserConfig(botNumber, newConfig);

        // 🚨 ROOT-CAUSE FIX (".setprefix not working"): this saved the new
        // prefix to storage and replied "✅ Updated" — but command matching
        // in main.js reads the LIVE `config.PREFIX` value straight out of
        // memory (`body.startsWith(config.PREFIX)`), which nothing here ever
        // touched. So the bot kept reacting to the OLD prefix until a full
        // process restart, and even then the saved value was never restored
        // back into config on reconnect (unlike WORK_TYPE, which already had
        // that restore logic). Any live, in-memory config key (PREFIX being
        // the main one users hit) now gets applied immediately here too.
        if (key === 'PREFIX') {
            config.PREFIX = value;
        }

        // 🚨 BUG FIX: this used to always echo the raw `value` back in the
        // reply. For toggles like true/false that's fine, but .setbotdp and
        // .setbotaudio pass the ENTIRE base64-encoded image/audio buffer as
        // `value` — dumping a massive garbage text block into the chat.
        // Now large values are summarized instead of echoed verbatim.
        const displayValue = (typeof value === 'string' && value.length > 60)
            ? `(${(value.length / 1024).toFixed(1)} KB saved)`
            : value;
        return reply(`✅ ${key} ${toFancy('Updated To')}: ${displayValue}`);
    } catch (e) {
        console.error(e);
        return reply("❌ ${toFancy('Error Saving')}");
    }
};

// ============================================================
// 1. AUTO RECORDING
// ============================================================
cmd({
    pattern: "autorecording",
    alias: ["autorec", "arecording"],
    desc: "Enable/Disable auto recording",
    category: "settings",
    react: "👑"
}, async (conn, mek, m, { args, isOwner, reply, botNumber, config }) => {
    const userConfig = await getUserConfigFromMongoDB(botNumber);
    const value = args[0]?.toLowerCase();
    
    if (value === 'on' || value === 'true') {
        await updateConfig('AUTO_RECORDING', 'true', botNumber, config, reply);
    } else if (value === 'off' || value === 'false') {
        await updateConfig('AUTO_RECORDING', 'false', botNumber, config, reply);
    } else {
        reply(toggleBox('Auto Recording', userConfig.AUTO_RECORDING, '.autorec on/off'));
    }
});

// ============================================================
// 2. AUTO TYPING
// ============================================================
cmd({
    pattern: "autotyping",
    alias: ["autotype", "atyping"],
    desc: "Enable/Disable auto typing",
    category: "settings",
    react: "👑"
}, async (conn, mek, m, { args, isOwner, reply, botNumber, config }) => {
    const userConfig = await getUserConfigFromMongoDB(botNumber);
    const value = args[0]?.toLowerCase();
    
    if (value === 'on' || value === 'true') {
        await updateConfig('AUTO_TYPING', 'true', botNumber, config, reply);
    } else if (value === 'off' || value === 'false') {
        await updateConfig('AUTO_TYPING', 'false', botNumber, config, reply);
    } else {
        reply(toggleBox('Auto Typing', userConfig.AUTO_TYPING, '.autotype on/off'));
    }
});

cmd({
    pattern: "autoreact",
    alias: ["autoreaction"],
    desc: "Enable/Disable auto react to every message",
    category: "settings",
    react: "👑"
}, async (conn, mek, m, { args, isOwner, reply, botNumber, config }) => {
    const userConfig = await getUserConfigFromMongoDB(botNumber);
    const value = args[0]?.toLowerCase();

    if (value === 'on' || value === 'true') {
        await updateConfig('AUTO_REACT', 'true', botNumber, config, reply);
    } else if (value === 'off' || value === 'false') {
        await updateConfig('AUTO_REACT', 'false', botNumber, config, reply);
    } else {
        reply(toggleBox('Auto React', userConfig.AUTO_REACT || 'false', '.autoreact on/off'));
    }
});

// ============================================================
// 3. ANTI CALL
// ============================================================
cmd({
    pattern: "anticall",
    alias: "acall",
    desc: "Auto reject calls",
    category: "settings",
    react: "👑"
}, async (conn, mek, m, { args, isOwner, reply, botNumber, config }) => {
    const userConfig = await getUserConfigFromMongoDB(botNumber);
    const value = args[0]?.toLowerCase();
    
    if (value === 'on' || value === 'true') {
        await updateConfig('ANTI_CALL', 'true', botNumber, config, reply);
    } else if (value === 'off' || value === 'false') {
        await updateConfig('ANTI_CALL', 'false', botNumber, config, reply);
    } else {
        reply(toggleBox('Anti Call', userConfig.ANTI_CALL, '.anticall on/off'));
    }
});

// ============================================================
// 4. WELCOME — REMOVED (Bunty: "welcome text/video lagti nahi" deep scan)
// ----------------------------------------------------------------------
// 🚨 CRITICAL BUG: this command toggled a completely SEPARATE, disconnected
// flag (UserBotSettings.WELCOME) that main.js's real join-listener never
// reads at all — only data/GroupSettings.js's `welcomeOn` field controls
// whether a welcome message actually fires. Running .welcome on/off here
// gave a confident "✅ success" reply while doing NOTHING to the real
// system. This was very likely a big part of why welcome "wasn't working"
// despite being "set". The real, connected toggle is .welcometoggle
// (plugins/warn-welcome-system.js), which now also answers to the natural
// name ".welcome" via alias — so nothing is lost, it's just wired to the
// system that's actually checked on a real join.
// ============================================================

// ============================================================
// 5. GOODBYE — REMOVED, same reason as WELCOME above. The real goodbye
// message is controlled by .setgoodbye <text> / .setgoodbye off
// (plugins/warn-welcome-system.js), which IS connected to what main.js
// actually checks.
// ============================================================

// ============================================================
// 6. AUTO READ (Blue Tick)
// ============================================================
cmd({
    pattern: "autoread",
    desc: "Enable/Disable auto read (Blue Tick)",
    category: "settings",
    react: "👀"
}, async (conn, mek, m, { args, isOwner, reply, botNumber, config }) => {
    const userConfig = await getUserConfigFromMongoDB(botNumber);
    const value = args[0]?.toLowerCase();
    
    if (value === 'on' || value === 'true') {
        await updateConfig('READ_MESSAGE', 'true', botNumber, config, reply);
    } else if (value === 'off' || value === 'false') {
        await updateConfig('READ_MESSAGE', 'false', botNumber, config, reply);
    } else {
        reply(toggleBox('Auto Read', userConfig.READ_MESSAGE, '.autoread on/off'));
    }
});

// ============================================================
// 7. AUTO VIEW STATUS
// ============================================================
cmd({
    pattern: "autoviewsview",
    alias: ["avs", "statusseen", "astatus"],
    desc: "Auto view status updates",
    category: "settings",
    react: "😎"
}, async (conn, mek, m, { args, isOwner, reply, botNumber, config }) => {
    const userConfig = await getUserConfigFromMongoDB(botNumber);
    const value = args[0]?.toLowerCase();
    
    if (value === 'on' || value === 'true') {
        await updateConfig('AUTO_VIEW_STATUS', 'true', botNumber, config, reply);
    } else if (value === 'off' || value === 'false') {
        await updateConfig('AUTO_VIEW_STATUS', 'false', botNumber, config, reply);
    } else {
        reply(toggleBox('Auto View Status', userConfig.AUTO_VIEW_STATUS, '.avs on/off'));
    }
});

// ============================================================
// 8. AUTO LIKE STATUS
// ============================================================
cmd({
    pattern: "autolikestatus",
    alias: ["als"],
    desc: "Auto like status updates",
    category: "settings",
    react: "❤️"
}, async (conn, mek, m, { args, isOwner, reply, botNumber, config }) => {
    const userConfig = await getUserConfigFromMongoDB(botNumber);
    const value = args[0]?.toLowerCase();
    
    if (value === 'on' || value === 'true') {
        await updateConfig('AUTO_LIKE_STATUS', 'true', botNumber, config, reply);
    } else if (value === 'off' || value === 'false') {
        await updateConfig('AUTO_LIKE_STATUS', 'false', botNumber, config, reply);
    } else {
        reply(toggleBox('Auto Like Status', userConfig.AUTO_LIKE_STATUS, '.als on/off'));
    }
});

// ============================================================
// 9. MODE
// ============================================================
cmd({
    pattern: "mode",
    desc: "Change bot mode",
    category: "settings",
    react: "⚙️"
}, async (conn, mek, m, { args, isOwner, isMe, reply, botNumber, config }) => {
    // 🚨 FEATURE (Ahmad: "har user apni khud ki personal setting rakhe, ek
    // user private karle doosre par asar na ho"): this bot supports multiple
    // paired numbers on the same deployment, each its own instance. `isMe`
    // here means "you're messaging from the exact number THIS bot instance
    // is paired to" — i.e. you're that instance's own owner — which is safe
    // to use for controlling just that one instance's settings. This is a
    // different, narrower check than the global `isOwner` bypass that was
    // removed for security (that one incorrectly granted access to
    // OWNER-ONLY commands across the whole deployment; this one only ever
    // affects the single instance the sender's own number is paired to).
    if (!isOwner && !isMe) return reply(`${toFancy('Owner Only')} 😎`);
    const userConfig = await getUserConfigFromMongoDB(botNumber);
    const mode = args[0]?.toLowerCase();
    const validModes = ['public', 'private', 'groups', 'inbox'];

    if (validModes.includes(mode)) {
        // Only the real global owner's change updates the shared in-memory
        // default (config.WORK_TYPE) — a per-instance (isMe-only) change
        // just persists to that instance's own userConfig. main.js's
        // enforcement already checks userConfig.WORK_TYPE first (falling
        // back to config.WORK_TYPE only if unset), so this instance's mode
        // takes effect correctly without touching any other paired number's
        // default.
        if (isOwner) config.WORK_TYPE = mode;
        await updateConfig('WORK_TYPE', mode, botNumber, config, reply);
    } else {
        const effectiveMode = userConfig.WORK_TYPE || config.WORK_TYPE;
        const modeEmojis = { public: '🌐', private: '🔒', groups: '👥', inbox: '📥' };
        reply(renderInfoBox('Bot Mode', validModes.map(mo => ({
            emoji: mo === effectiveMode ? '✅' : (modeEmojis[mo] || '▸'),
            label: mo.charAt(0).toUpperCase() + mo.slice(1),
            value: mo === effectiveMode ? 'Active' : '—'
        }))));
    }
});

// ============================================================
// 13. SET OWNER NUMBER
// ============================================================
cmd({
    pattern: "setowner",
    alias: ["changeowner", "setownernumber"],
    desc: "Change the bot owner's number",
    category: "owner",
    react: "👑"
}, async (conn, mek, m, { args, isOwner, reply, botNumber, config }) => {
    if (!isOwner) return reply(`${toFancy('Owner Only')} 😎`);
    const raw = args[0];

    if (raw) {
        // 🚨 Accepts +923044975027, 923044975027, or with spaces/dashes —
        // strips everything except digits, same normalization main.js
        // already uses when comparing senderNumber to config.OWNER_NUMBER.
        const newOwner = raw.replace(/[^0-9]/g, '');
        if (newOwner.length < 8) return reply(`❌ Invalid number. Usage: .setowner 923044975027`);

        // Same live-update pattern as .setprefix: write to the in-memory
        // config immediately (so isOwner checks work right away) AND
        // persist it, so it survives a restart.
        config.OWNER_NUMBER = newOwner;
        await updateConfig('OWNER_NUMBER', newOwner, botNumber, config, reply);
    } else {
        reply(renderInfoBox('Bot Owner', [
            { emoji: '👑', label: 'Current', value: '+' + config.OWNER_NUMBER },
            { emoji: '💡', label: 'Use', value: '.setowner 923044975027' }
        ]));
    }
});

// ============================================================
// 10. SET PREFIX
// ============================================================
cmd({
    pattern: "setprefix",
    desc: "Change the command prefix for THIS chat only (group admins for their group, anyone for their own DM)",
    category: "settings",
    react: "🔑"
}, async (conn, mek, m, { args, from, isGroup, isAdmins, isOwner, reply, botNumber }) => {
    if (isGroup && !isAdmins && !isOwner) return reply(`${toFancy('Admins Only')} 😎`);
    const newPrefix = args[0];

    if (newPrefix) {
        const charCount = [...newPrefix].length;
        if (charCount > 1 && newPrefix !== 'noprefix') return reply(`${toFancy('Prefix must be short')} ❌ (one character/emoji only, e.g. . ! # 💀)`);
        await setChatPrefix(botNumber, from, newPrefix);
        return reply(`✅ ${toFancy('Prefix updated for this chat')}: ${newPrefix}`);
    }
    const current = getCachedChatPrefix(botNumber, from);
    reply(renderInfoBox('Current Prefix (this chat)', [
        { emoji: '🔑', label: 'Prefix', value: current || `${config.PREFIX} (bot default)` },
        { emoji: '💡', label: 'Use', value: '.setprefix . or !' },
        { emoji: '👑', label: 'Owner', value: '.setprefixall — sets the bot-wide default' }
    ]));
});

// OWNER: the true bot-wide default, used by any chat that hasn't set its
// own prefix via .setprefix. Deliberate, separate command name so a normal
// .setprefix in someone's own chat never silently overrides everyone else.
cmd({
    pattern: "setprefixall",
    desc: "OWNER: change the bot-wide default prefix for every chat that hasn't set its own",
    category: "owner",
    react: "👑"
}, async (conn, mek, m, { args, isOwner, reply, botNumber, config }) => {
    if (!isOwner) return reply(`${toFancy('Owner Only')} 😎`);
    const newPrefix = args[0];

    if (newPrefix) {
        const charCount = [...newPrefix].length;
        if (charCount > 1 && newPrefix !== 'noprefix') return reply(`${toFancy('Prefix must be short')} ❌ (one character/emoji only, e.g. . ! # 💀)`);
        await updateConfig('PREFIX', newPrefix, botNumber, config, reply);
    } else {
        reply(renderInfoBox('Current Prefix (overall default)', [
            { emoji: '🔑', label: 'Prefix', value: config.PREFIX },
            { emoji: '💡', label: 'Use', value: '.setprefixall . or !' }
        ]));
    }
});

// ============================================================
// 11. VIEW ALL SETTINGS
// ============================================================
cmd({
    pattern: "allsettings",
    alias: ["settings", "config"],
    desc: "View all bot settings",
    category: "settings",
    react: "⚙️"
}, async (conn, mek, m, { isOwner, reply, config, botNumber }) => {
    const userConfig = await getUserConfigFromMongoDB(botNumber);
    const settings = renderInfoBox('All Settings', [
        { emoji: '🤖', label: 'Bot Name', value: config.BOT_NAME },
        { emoji: '🔑', label: 'Prefix', value: config.PREFIX },
        { emoji: '⚙️', label: 'Mode', value: config.WORK_TYPE },
        { emoji: userConfig.AUTO_RECORDING === 'true' ? '✅' : '❌', label: 'Auto Recording', value: userConfig.AUTO_RECORDING },
        { emoji: userConfig.AUTO_TYPING === 'true' ? '✅' : '❌', label: 'Auto Typing', value: userConfig.AUTO_TYPING },
        { emoji: userConfig.ANTI_CALL === 'true' ? '✅' : '❌', label: 'Anti Call', value: userConfig.ANTI_CALL },
        { emoji: userConfig.WELCOME === 'true' ? '✅' : '❌', label: 'Welcome', value: userConfig.WELCOME },
        { emoji: userConfig.GOODBYE === 'true' ? '✅' : '❌', label: 'Goodbye', value: userConfig.GOODBYE },
        { emoji: userConfig.READ_MESSAGE === 'true' ? '✅' : '❌', label: 'Auto Read', value: userConfig.READ_MESSAGE },
        { emoji: userConfig.AUTO_VIEW_STATUS === 'true' ? '✅' : '❌', label: 'Auto View Status', value: userConfig.AUTO_VIEW_STATUS },
        { emoji: userConfig.AUTO_LIKE_STATUS === 'true' ? '✅' : '❌', label: 'Auto Like Status', value: userConfig.AUTO_LIKE_STATUS },
    ]);

    reply(settings);
});

// ============================================================
// 12. CUSTOM BOT NAME (shown in YOUR OWN .menu header/caption)
// ============================================================
// 🆕 CHANGED (Bunty: "har user apna bot khud customize kar sakay, sab pe
// overall na lagay"): this used to be owner-only and wrote to the ONE
// bot-wide config, so it changed .menu for literally everyone. Now ANY
// user can run it, and it only changes what THEY personally see when THEY
// run .menu — saved against their own jid, nobody else is touched. The
// owner still has a separate command (.globalbotname) to set the real
// bot-wide default that applies to anyone who hasn't set their own.
cmd({
    pattern: "setbotname",
    alias: ["botname", "setname"],
    desc: "Set YOUR OWN custom bot name shown in your .menu",
    category: "settings",
    react: "📝"
}, async (conn, mek, m, { args, text, sender, isOwner, isMe, reply, botNumber, config }) => {
    if (!isOwner && !isMe) return reply(ownerOnlyDenied());
    const name = (text || args.join(' ')).trim();
    if (!name) {
        const my = await getUserBotSettings(sender);
        const userConfig = await getUserConfigFromMongoDB(botNumber);
        return reply(renderInfoBox('Bot Name (Yours)', [
            { emoji: '🤖', label: 'Current', value: my.BOT_NAME || userConfig.BOT_NAME || config.BOT_NAME },
            { emoji: '💡', label: 'Use', value: '.setbotname My Cool Bot' }
        ]));
    }
    if (name.length > 25) return reply('❌ Name must be under 25 characters.');
    if (!isSelfOwned(conn, mek, sender)) return reply('❌ Identity mismatch — safety block, try again.');
    // 🚨 ROOT-CAUSE FIX (Bunty: ".menu likhta to old show hota jo bhi set
    // kya ho"): this used to reply "✅ updated" unconditionally, even if
    // the Mongo save itself silently failed (network hiccup, Atlas
    // timeout, etc.) — so the user saw success but .menu kept showing the
    // OLD name because nothing was actually persisted. Now checks the
    // real save result and tells the truth.
    const saved = await setUserBotSettings(sender, { BOT_NAME: name });
    if (!saved) return reply('❌ Save fail hui (Mongo issue) — dobara try karo, .menu abhi bhi purana naam dikhayega.');
    reply(`✅ Bot name updated to: ${name}`);
    // 🚨 Note carried forward: this never touches the real WhatsApp profile
    // name/pic — only the .menu branding text/image, exactly as before.
});

// ============================================================
// 12b. OWNER: SET THE REAL GLOBAL BOT NAME (default for everyone)
// ============================================================
cmd({
    pattern: "overallname",
    alias: ["overallbotname", "globalbotname", "obotname", "setglobalbotname"],
    desc: "OWNER ONLY: change the bot name for EVERYONE (unlike .setbotname which only changes YOUR own view)",
    category: "owner",
    react: "👑"
}, async (conn, mek, m, { args, text, isOwner, reply, botNumber, config }) => {
    // 🚨 REVERTED (Bunty: "mixup na ho, phir owner sab ka change kare") —
    // this affects EVERYONE talking to this bot, so it's back to strictly
    // isOwner-only, not isOwner||isMe. .setbotname (isOwner||isMe, only
    // ever touches the sender's own record) is the one paired users use
    // for themselves — this one is deliberately separate and owner-only,
    // renamed from .globalbotname to .overallname so the two can never be
    // confused for each other again. Old name still works as an alias.
    if (!isOwner) return reply(ownerOnlyDenied());
    const name = (text || args.join(' ')).trim();
    if (!name) {
        const userConfig = await getUserConfigFromMongoDB(botNumber);
        return reply(renderInfoBox('Bot Name (Overall — everyone)', [
            { emoji: '🤖', label: 'Current', value: userConfig.BOT_NAME || config.BOT_NAME },
            { emoji: '💡', label: 'Use', value: '.overallname My Cool Bot' }
        ]));
    }
    if (name.length > 25) return reply('❌ Naam 25 characters se kam rakho.');
    await updateConfig('BOT_NAME', name, botNumber, config, reply);
});

// ============================================================
// 13. CUSTOM BOT DP (YOUR OWN .menu image)
// ============================================================
cmd({
    pattern: "setbotdp",
    alias: ["botdp", "setbotpic"],
    desc: "Reply to an image to set it as YOUR OWN .menu image",
    category: "settings",
    react: "🖼️"
}, async (conn, mek, m, { sender, isOwner, isMe, reply }) => {
    try {
        if (!isOwner && !isMe) return reply(ownerOnlyDenied());
        if (!m.quoted || m.quoted.mtype !== 'imageMessage') {
            return reply('❌ Reply to an image.\n💡 Use: .setbotdp (reply to image)');
        }
        if (!isSelfOwned(conn, mek, sender)) return reply('❌ Identity mismatch — safety block, try again.');
        const buffer = await m.quoted.download();
        console.log(`[SETBOTDP] sender=${sender}`);
        const saved = await setUserBotSettings(sender, { MENU_IMAGE: buffer.toString('base64') });
        if (!saved) return reply('❌ Save fail hui (Mongo issue) — dobara try karo.');
        reply('✅ Your bot DP updated.');
        // Only the .menu image is touched — real WhatsApp profile picture
        // is never called/changed here.
    } catch (e) {
        reply('❌ Failed: ' + e.message);
    }
});

// ============================================================
// 13b. OWNER: SET THE REAL GLOBAL BOT DP (default for everyone)
// ============================================================
cmd({
    pattern: "overalldp",
    alias: ["overallbotdp", "globalbotdp", "obotdp", "globalbotpic", "setglobalbotdp"],
    desc: "OWNER ONLY: reply to an image to change the bot DP for EVERYONE (unlike .setbotdp which only changes YOUR own)",
    category: "owner",
    react: "👑"
}, async (conn, mek, m, { isOwner, reply, botNumber, config }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    try {
        if (!m.quoted || m.quoted.mtype !== 'imageMessage') {
            return reply('❌ Reply to an image.\n💡 Use: .overalldp (reply to image)');
        }
        const buffer = await m.quoted.download();
        await updateConfig('MENU_IMAGE', buffer.toString('base64'), botNumber, config, reply);
    } catch (e) {
        reply('❌ Failed: ' + e.message);
    }
});

// ============================================================
// 13c. OWNER: SET THE REAL WHATSAPP ACCOUNT PROFILE PICTURE
// ============================================================
// 🆕 (Ahmad: "bot ki pic main yeh lgao do ab overall") — every other DP
// command above (.setbotdp / .globalbotdp) only ever changed the image
// shown inside .menu's caption, never the bot number's ACTUAL WhatsApp
// profile photo. This one calls the real Baileys profile-picture update,
// so it changes what people see on the bot's WhatsApp contact/profile.
// Accepts either a direct image URL as an argument, or a replied image.
cmd({
    pattern: "setrealdp",
    alias: ["setaccountdp", "botprofilepic", "realdp"],
    desc: "OWNER: change the bot number's ACTUAL WhatsApp profile picture",
    category: "owner",
    use: ".setrealdp <image url>  OR  reply to an image with .setrealdp",
    react: "🖼️"
}, async (conn, mek, m, { isOwner, args, reply }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    try {
        const axios = require('axios');
        let buffer;
        const url = (args[0] || '').trim();

        if (url && /^https?:\/\//i.test(url)) {
            const res = await axios.get(url, {
                responseType: 'arraybuffer',
                timeout: 20000,
                headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36' }
            });
            buffer = Buffer.from(res.data);
        } else if (m.quoted && m.quoted.mtype === 'imageMessage') {
            buffer = await m.quoted.download();
        } else {
            return reply('❌ Reply to an image, or provide a direct image URL.\n💡 Use: .setrealdp <image url>');
        }

        if (!buffer || buffer.length < 500) return reply('❌ Could not fetch a valid image.');

        const botJid = await conn.decodeJid(conn.user.id);
        await conn.updateProfilePicture(botJid, buffer);
        reply('✅ Bot ki real WhatsApp DP update ho gayi!');
    } catch (e) {
        reply('❌ Failed: ' + e.message);
    }
});

// ============================================================
// 14. CUSTOM BOT MENU AUDIO/SONG (YOUR OWN)
// ============================================================
cmd({
    pattern: "setbotaudio",
    alias: ["botaudio", "setbotsong", "menusong"],
    desc: "Reply to an audio/voice note to set it as YOUR OWN .menu song",
    category: "settings",
    react: "🎵"
}, async (conn, mek, m, { sender, isOwner, isMe, reply }) => {
    try {
        if (!isOwner && !isMe) return reply(ownerOnlyDenied());
        if (!m.quoted || m.quoted.mtype !== 'audioMessage') {
            return reply('❌ Reply to an audio or voice note.\n💡 Use: .setbotaudio (reply to audio)');
        }
        if (!isSelfOwned(conn, mek, sender)) return reply('❌ Identity mismatch — safety block, try again.');
        const buffer = await m.quoted.download();
        if (buffer.length > 6 * 1024 * 1024) {
            return reply('❌ This audio is too large. Send one under 5MB.');
        }
        const saved = await setUserBotSettings(sender, { MENU_AUDIO: buffer.toString('base64') });
        if (!saved) return reply('❌ Save fail hui (Mongo issue) — dobara try karo.');
        reply('✅ Your .menu song updated.');
    } catch (e) {
        reply('❌ Failed: ' + e.message);
    }
});

// ============================================================
// 14c. OWNER: SET THE REAL GLOBAL BOT AUDIO (default for everyone)
// ============================================================
cmd({
    pattern: "overallaudio",
    alias: ["overallbotaudio", "globalbotaudio", "obotaudio", "setglobalbotaudio"],
    desc: "OWNER ONLY: reply to audio to change the bot's .menu song for EVERYONE (unlike .setbotaudio which only changes YOUR own)",
    category: "owner",
    react: "👑"
}, async (conn, mek, m, { isOwner, reply, botNumber, config }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    try {
        if (!m.quoted || m.quoted.mtype !== 'audioMessage') {
            return reply('❌ Reply to an audio or voice note.\n💡 Use: .overallaudio (reply to audio)');
        }
        const buffer = await m.quoted.download();
        if (buffer.length > 6 * 1024 * 1024) {
            return reply('❌ This audio is too large. Send one under 5MB.');
        }
        await updateConfig('MENU_AUDIO', buffer.toString('base64'), botNumber, config, reply);
    } catch (e) {
        reply('❌ Failed: ' + e.message);
    }
});

// ============================================================
// 14b. MENU STYLE — REMOVED (Bunty: "menustyle system remove, only ek
// menu rahay") — .menustyle/.globalmenustyle commands taken out, .menu
// always uses the single fixed style now (see plugins/allmenu.js).
// ============================================================



// ============================================================
// 15. RESET BOT CUSTOMIZATION
// ============================================================
cmd({
    pattern: "resetbotcustom",
    alias: ["resetbotdp", "resetmenu", "clear"],
    desc: "Reset YOUR OWN bot name/DP/menu-song back to default (owner's latest)",
    category: "settings",
    react: "♻️"
}, async (conn, mek, m, { sender, isOwner, isMe, reply }) => {
    if (!isOwner && !isMe) return reply(ownerOnlyDenied());
    if (!isSelfOwned(conn, mek, sender)) return reply('❌ Identity mismatch — safety block, try again.');
    const saved = await deleteUserBotSettings(sender);
    if (!saved) return reply('❌ Clear fail hua (Mongo save issue) — dobara try karo, purani settings abhi bhi active hain.');
    reply('✅ Aapka bot name/DP/audio clear ho gaye — ab owner ka latest default use hoga.');
});

// OWNER: reset the bot-wide default itself
cmd({
    pattern: "overallreset",
    alias: ["overallresetbotcustom", "globalresetbotcustom", "gresetbotdp", "gresetmenu"],
    desc: "OWNER ONLY: reset the bot name/DP/song that EVERYONE sees by default (unlike .clear which only resets YOUR own)",
    category: "owner",
    react: "♻️"
}, async (conn, mek, m, { isOwner, reply, botNumber }) => {
    if (!isOwner) return reply(ownerOnlyDenied());
    const currentConfig = await getUserConfigFromMongoDB(botNumber);
    const newConfig = { ...currentConfig, BOT_NAME: null, MENU_IMAGE: null, MENU_AUDIO: null, MENU_STYLE: 1 };
    await updateUserConfig(botNumber, newConfig);
    reply('✅ Bot-wide default name/DP/audio/menu-style reset ho gaye.');
});

// 🆕 (Bunty: ".cleardb — user ka data wipe ho jaye db se, fresh new ho
// jaye all default mein") — a genuine factory-reset for THIS paired
// session (botNumber-scoped). Wipes:
//   • UserConfig doc for this botNumber (bot-wide name/dp/audio/mode/etc
//     — same doc .overallreset touches, but a real delete not a null-out)
//   • UserBotSettings for the person running it (their personal
//     .setbotname/.setbotdp customization)
//   • Every Antidelete/Antiedit/AntiViewOnce/ChatPrefix record scoped to
//     this botNumber (every chat's individual settings under this
//     session) — matched via the "botNumber::" key prefix these models
//     already use, so nothing belonging to any OTHER paired number is
//     ever touched.
// Owner/isMe only, and requires a literal "confirm" argument since this
// is destructive and can't be undone.
const { deleteUserConfigFromMongoDB } = require('../lib/database');
const { Antidelete } = require('../data/Antidelete');
const { Antiedit } = require('../data/Antiedit');
const { AntiViewOnce } = require('../data/AntiViewOnce');
const { ChatPrefix: ChatPrefixModel } = require('../data/ChatPrefix');

cmd({
    pattern: "cleardb",
    alias: ["clearalldb", "resetdb"],
    desc: "OWNER/PAIRED USER ONLY: wipe ALL of this bot session's data (name/dp/audio/antidelete/antiviewonce/antiedit/prefix — every chat) back to fresh defaults. Destructive, needs 'confirm'.",
    category: "owner",
    react: "🗑️"
}, async (conn, mek, m, { args, isOwner, isMe, sender, reply, botNumber }) => {
    if (!isOwner && !isMe) return reply(ownerOnlyDenied());
    if ((args[0] || '').toLowerCase() !== 'confirm') {
        return reply(
            `⚠️ *Yeh IRREVERSIBLE hai* — is bot session ki har chat ki antidelete/antiviewonce/antiedit/prefix settings, bot-wide name/dp/audio, aur teri apni personal customization sab wipe ho jayengi.\n\n` +
            `Confirm karne ke liye likho:\n*.cleardb confirm*`
        );
    }

    const prefixRegex = { $regex: `^${botNumber}::` };
    try {
        const [userConfigOk, userBotOk, adRes, aeRes, avRes, cpRes] = await Promise.all([
            deleteUserConfigFromMongoDB(botNumber),
            deleteUserBotSettings(sender),
            Antidelete.deleteMany({ chatId: prefixRegex }),
            Antiedit.deleteMany({ chatId: prefixRegex }),
            AntiViewOnce.deleteMany({ chatId: prefixRegex }),
            ChatPrefixModel.deleteMany({ chatId: prefixRegex }),
        ]);

        reply(renderInfoBox('Database Wiped ✅', [
            { emoji: '⚙️', label: 'Bot-wide config', value: userConfigOk ? 'reset' : 'failed' },
            { emoji: '👤', label: 'Your personal settings', value: userBotOk ? 'reset' : 'failed' },
            { emoji: '🗑️', label: 'Antidelete records cleared', value: String(adRes.deletedCount) },
            { emoji: '🗑️', label: 'Antiedit records cleared', value: String(aeRes.deletedCount) },
            { emoji: '🗑️', label: 'AntiViewOnce records cleared', value: String(avRes.deletedCount) },
            { emoji: '🗑️', label: 'Custom prefixes cleared', value: String(cpRes.deletedCount) },
        ]));
    } catch (e) {
        console.error('[CLEARDB] failed:', e.message);
        reply('❌ Kuch wipe fail ho gaya beech mein — console log check karo, kuch data purana reh gaya ho sakta hai.');
    }
});

cmd({
    pattern: 'resetusersettings',
    alias: ['resetuser'],
    desc: 'OWNER ONLY: reset another user\'s personal bot customization (name/dp/audio)',
    category: 'owner',
    react: '🔧',
    use: '.resetusersettings @user'
}, async (conn, mek, m, { from, reply, isOwner, isMe, args, mentionedJid }) => {
    // 🆕 (Bunty: "baaki bhi add karo" — AURA's resetusersettings): genuinely
    // different from .cleardb — this is the OWNER force-resetting a
    // SPECIFIC OTHER user's own personal customization (misuse/spam/support
    // request), not the owner's own data. Regular users can never target
    // anyone but themselves via .setbotdp/.clear — this is the one
    // deliberate exception, and only isOwner/isMe can use it.
    if (!isOwner && !isMe) return reply(ownerOnlyDenied());

    let target = mentionedJid?.[0] || m.quoted?.sender;
    if (!target && args[0]) target = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    if (!target) return reply('❌ Mention, reply to, ya number do: .resetusersettings 923001234567');

    const ok = await deleteUserBotSettings(target);
    if (!ok) return reply('❌ Reset fail ho gaya, dobara try karo.');
    await conn.sendMessage(from, {
        text: `✅ @${target.split('@')[0]} ki personal settings (name/dp/audio) clear kar di gayi.`,
        mentions: [target]
    }, { quoted: mek });
});