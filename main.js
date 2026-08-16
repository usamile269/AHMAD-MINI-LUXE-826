const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    jidNormalizedUser,
    Browsers,
    DisconnectReason,
    jidDecode,
    downloadContentFromMessage,
    getContentType,
    fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const config = require('./config');
// 🚀 GLOBAL SPEED BOOST (Bunty: "speed boost like rocket") — axios.defaults
// is shared by EVERY file that does `require('axios')` across the whole
// bot (same module instance in Node), so setting this once here turns on
// connection-reuse (keepAlive) for literally every API call the bot makes
// — downloaders, AI, everything — without editing 50+ files individually.
// Skipping the TCP+TLS handshake on repeat calls to the same host is the
// single biggest free win available here, and it's zero-risk (pure
// transport-level optimization, doesn't change any request's behavior).
{
    const http = require('http');
    const https = require('https');
    const axios = require('axios');
    axios.defaults.httpAgent = new http.Agent({ keepAlive: true, maxSockets: 100 });
    axios.defaults.httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100 });
}
const { getCachedChatPrefix } = require('./data/ChatPrefix.js');
const events = require('./ahmad-core');
const { EventEmitter } = require('events');
// 📡 Lets other entry points (Telegram pairing bot) know the moment a
// number's WhatsApp connection actually goes live, so they can send their
// own "connected" confirmation without duplicating the connection logic.
const ahmadEvents = new EventEmitter();
const { sms } = require('./lib/msg');
const { toFancyBold } = require('./lib/text-style');
const {
    connectdb,
    saveSessionToMongoDB,
    getSessionFromMongoDB,
    deleteSessionFromMongoDB,
    getUserConfigFromMongoDB,
    updateUserConfigInMongoDB,
    addNumberToMongoDB,
    removeNumberFromMongoDB,
    getMsSinceLastWelcome,
    markWelcomeSent,
    getAllNumbersFromMongoDB,
    saveOTPToMongoDB,
    verifyOTPFromMongoDB,
    incrementStats,
    getStatsForNumber,
    getRelayTargets
} = require('./lib/database');
const { handleAntidelete, handleAntideleteUpsert } = require('./lib/antidelete');
const { handleAntiedit, handleAntieditUpsert } = require('./lib/antiedit');
const { handleAntiViewOnce, autoRecoverOnReply } = require('./lib/viewonce-capture');
const { getSiteSettings, setSiteSettings } = require('./data/SiteSettings');
const { recordActivity } = require('./data/GroupActivity');
const { randomFooter, toBoldSerif, toBoldItalicSerif, toSansBold } = require('./lib/menu-styles');
// 🆕 (Bunty: ".aiby" — AI auto-reply for personal DMs, per-instance toggle + persona)
const { getAIAutoReplySettings } = require('./data/AIAutoReply');
const { smartAI, transcribeVoiceNote } = require('./lib/ai-provider');
const { withLanguageMatch, looksLikeIdentityQuestion, identityAnswer } = require('./lib/ai-persona');

const express = require('express');
const fs = require('fs-extra');
const path = require('path');
const pino = require('pino');
const crypto = require('crypto');
const FileType = require('file-type');
const axios = require('axios');
const { isSudo } = require('./data/Sudo');
const moment = require('moment-timezone');

const prefix = config.PREFIX;
const mode = config.MODE || config.WORK_TYPE;
const router = express.Router();


connectdb();

const activeSockets = new Map();
const socketCreationTime = new Map();
// 🚨 BUG FIX (Bunty: ".pair karay to 'already connected' bolta hai, jabke
// abhi tak actually connect hua hi nahi"): activeSockets gets a number's
// entry the MOMENT a socket object is constructed — well before pairing
// actually completes. If someone requests a code and never finishes
// pairing (closes the app, code expires, etc.), that socket never fires a
// 'close' event either — it just sits there half-alive forever, so
// isNumberAlreadyConnected() kept seeing it as "connected" on every later
// attempt. This tracks whether a number's connection has genuinely reached
// WhatsApp's 'open' state at least once — that's the real definition of
// "connected", not just "a socket object exists for it".
const connectionOpenState = new Map();
// 🚨 ROOT-CAUSE FIX (Bunty: "kisi bhi FRESH/stranger user ki chat mein
// koi bhi cmd .ping/.menu — kuch bhi nahi hota, lekin do paired users
// ek dusre ki chat mein chala lete hain"): every @lid-resolution spot in
// this file (reply(), the global sendMessage wrap, resolveIsOwner) was
// asking Baileys' signalRepository.lidMapping.getPNForLID(jid) for the
// real phone-number jid. That store is only populated once a session/
// contact-sync/group-membership has already established the @lid<->PN
// link — exactly why it works between two numbers that already have
// history with each other (both paired, likely already exchanged
// messages), but returns null for a genuine first-ever message from a
// stranger, silently killing every outbound reply with zero error
// surfaced (the catch blocks just log and give up).
// Baileys DOES hand us the real jid for free on the incoming stanza
// itself — `key.remoteJidAlt` — with no session/cache dependency at
// all. Caching it here the instant a message arrives means the global
// sendMessage wrap (which has no access to `mek`, only a bare jid) can
// still use it as an instant, always-available fallback before ever
// touching the unreliable lidMapping store.
const lidAltCache = new Map(); // "@lid jid" -> real "@s.whatsapp.net jid"
// 🚨 NEW (Ahmad: "bot 24 hours baad chalta nahi, reconnect/restart karna
// parta") — the existing reconnect logic (setupAutoRestart below) only ever
// runs when Baileys actually FIRES a connection.update with connection:
// 'close'. On some hosts/networks the underlying WebSocket can go silently
// dead — no close event ever arrives, the TCP connection is just gone or
// unresponsive — so from the JS side the socket still LOOKS connected
// forever, and none of the reconnect code ever triggers. That's exactly
// the "works fine, then just stops, needs a manual restart" symptom: it's
// not that reconnection is failing, it's that nothing ever notices the
// disconnection happened. This map + the watchdog interval below is a
// second, independent check that doesn't depend on Baileys telling us —
// it looks at the actual underlying WebSocket readyState directly.
const lastActivityAt = new Map(); // sanitizedNumber -> timestamp of last connection.update/message seen
const channelWatchers = new Map(); // number -> setInterval id, for periodic re-follow
const presenceWatchers = new Map(); // number -> setInterval id, for 24/7 "online" keep-alive
const lastCommandAt = new Map(); // "botNumber:sender" -> timestamp, for CMD_COOLDOWN enforcement
const lastReactAt = new Map(); // "botNumber:chat" -> timestamp, throttles AUTO_REACT so it doesn't fire on every single message
const lastGroupMsgAt = new Map(); // "chat:sender" -> timestamp, for .slowmode enforcement
const floodTracker = new Map(); // "chat:sender" -> array of recent message timestamps, for .antiflood enforcement
const groupAdminsSnapshot = new Map(); // groupId -> Set of admin jids, refreshed on every group message — used by .antikick since a removed member is gone from groupMetadata by the time the remove event fires
const groupMetadataCache = new Map(); // groupId -> { data, ts } — see groupMetadata caching fix below
// 🆕 (.aibyahmad): tiny per-conversation memory for the AI auto-reply
// feature — "botNumber:senderJid" -> last few {u, a} exchanges, capped.
const aiAutoReplyHistory = new Map();
const groupMetadataRefreshing = new Set(); // groupId -> in-flight background refresh guard
// 🚨 BUG FIX (antiedit always showing "Before: (not cached / unknown)"):
// ahmadStore used to be created fresh INSIDE ahmadPair(), so every reconnect
// (a normal, expected thing — auto-restart, redeploy, etc.) silently wiped
// the in-memory message cache antiedit depends on to know what a message
// said before it was edited. Any message sent even a moment before a
// reconnect became permanently "unknown" the instant it was edited
// afterwards. Keeping one store per number here, reused across reconnects
// instead of recreated, means the cache only resets on an actual full
// restart of the whole bot process, not on every reconnect.
const ahmadStores = new Map(); // number -> store, persists across reconnects

// 🚨 BUG FIX (welcome video repeating): same idea as ahmadStores above —
// tracked at PROCESS level, not per-socket. A number goes in here the first
// time it shows the welcome video after this process booted, and stays in
// here through every later reconnect (network drop, keep-alive noise,
// Katabump auto-restart of the connection, etc.) for as long as the process
// keeps running. It only empties out — letting the welcome video fire again
// — when the whole bot process actually restarts (redeploy, crash+respawn,
// manual restart), which is the one case where showing it again makes sense.
const welcomeSentThisProcess = new Set();

// 🚨 BUG FIX (duplicate replies — .menu song sent twice, .antidelete replies
// twice, .vv media sent twice, etc): the old "replay filter" only checked how
// OLD a message's timestamp was (to skip history-sync replays after a
// reconnect) — it never checked whether that exact message had already been
// handled. WhatsApp/Baileys can genuinely redeliver the SAME live message
// (brief socket hiccup, multi-device sync, a slow ack, etc.), and since both
// deliveries have a "fresh" timestamp, both passed the old filter and the
// command ran twice. This tracks message IDs already processed per number and
// skips anything seen before. Capped size with periodic pruning so it can't
// grow forever on a long-running bot.
const processedMessageIds = new Map(); // number -> Set of message ids

// 🚨 BUG FIX (.chnfor spamming — same channel post relayed multiple times
// back-to-back): the generic dedup below keys off mek.key.id, but
// WhatsApp/Baileys can redeliver the SAME channel post under a DIFFERENT
// key.id (reconnects, multi-device fan-out, catch-up sync). key.id is NOT
// a stable identity for newsletter/channel posts — newsletterServerId is
// (that's why the reaction code further down already uses serverId, not
// key.id, to react). So the relay feature gets its own dedup keyed on
// newsletterServerId, tracked per source channel.
const relayedServerIds = new Map(); // sourceJid -> Set of newsletterServerId (string)
function wasAlreadyRelayed(sourceJid, serverId) {
    if (!serverId) return false;
    const id = serverId.toString();
    let seen = relayedServerIds.get(sourceJid);
    if (!seen) { seen = new Set(); relayedServerIds.set(sourceJid, seen); }
    if (seen.has(id)) return true;
    seen.add(id);
    if (seen.size > 300) {
        const arr = [...seen];
        seen.clear();
        for (const v of arr.slice(arr.length - 150)) seen.add(v);
    }
    return false;
}

// 🚨 CRASH-SURVIVAL FIX (Bunty: "bina command kiye jo commands use ki thi
// wo dobara aa jati" — old bot replies randomly resending themselves,
// spam risk): wasAlreadyProcessed (below) and the 60-second freshness
// filter in messages.upsert both live ONLY in memory. If the whole bot
// process crashes and restarts (which is exactly what unhandled command
// errors used to cause, before the crash fixes elsewhere in this file),
// that memory is wiped clean — and WhatsApp's post-reconnect history-sync
// then redelivers the last minute or so of messages, including ones
// already answered right before the crash. Since those messages are still
// under 60 seconds old by wall-clock time, the freshness filter let them
// through as if brand new, and the command re-ran, re-sending the exact
// same reply — which is what looked like commands "firing on their own".
// This persists a lightweight "already handled up to this timestamp" mark
// to disk per number (throttled writes, cheap), and loads it back on
// every restart, so a crash+restart can no longer replay anything that
// was already handled before the crash.
// 🚨 GAP FIX ROUND 2 (Bunty: "cmd phir bhi dobara aa jati" — STILL
// happening after the disk-file fix): the disk-file version above only
// protects against an in-place crash+restart where the SAME container
// keeps running (disk intact). On Railway (and most container hosts), a
// REDEPLOY spins up a brand-new container with a completely fresh
// filesystem — so a plain local file never survives a redeploy at all,
// same root problem this codebase already solved for WhatsApp session
// credentials via lib/mongo.js ("sessions & settings will now survive
// redeploys"). This mark now goes through the exact same Mongo-backed
// model as everything else — actually survives redeploys, not just
// same-container crashes. Falls back to local-JSON automatically (same as
// every other collection) if MONGODB_URI isn't configured.
const BootMarkModel = require('./lib/mongo').model('BootMarks');
const bootMarkTs = new Map(); // sanitizedNumber -> epoch seconds, already-handled-up-to (fast in-memory read path)
const lastBootMarkWrite = new Map(); // sanitizedNumber -> last DB-write epoch ms (throttle)

async function loadBootMark(sanitizedNumber) {
    try {
        const doc = await BootMarkModel.findOne({ number: sanitizedNumber });
        return doc ? (Number(doc.upTo) || 0) : 0;
    } catch (_) { return 0; }
}

async function persistBootMark(sanitizedNumber, ts) {
    try {
        await BootMarkModel.findOneAndUpdate({ number: sanitizedNumber }, { upTo: ts }, { upsert: true });
    } catch (e) {
        ahmadLog(`BootMark save failed for ${sanitizedNumber}: ${e.message}`, 'error');
    }
}

async function saveBootMark(sanitizedNumber, ts) {
    const prev = bootMarkTs.get(sanitizedNumber) || 0;
    if (ts <= prev) return;
    bootMarkTs.set(sanitizedNumber, ts); // in-memory updated immediately either way
    const lastWrite = lastBootMarkWrite.get(sanitizedNumber) || 0;
    if (Date.now() - lastWrite < 1000) return; // throttle DB writes to at most once/1s
    lastBootMarkWrite.set(sanitizedNumber, Date.now());
    await persistBootMark(sanitizedNumber, ts);
}

// Force-flushes EVERY number's mark to the DB immediately, bypassing the
// throttle — called right before the process would otherwise crash or
// exit (including a graceful SIGTERM from a redeploy), so whatever was
// the most recent message actually seen always makes it to Mongo before
// the process goes down. Bounded to 3s total so a slow/dead DB connection
// can never hang shutdown indefinitely.
async function flushAllBootMarks() {
    const writes = Array.from(bootMarkTs.entries()).map(([num, ts]) => persistBootMark(num, ts));
    await Promise.race([
        Promise.allSettled(writes),
        new Promise(resolve => setTimeout(resolve, 3000))
    ]);
}


function wasAlreadyProcessed(number, id) {
    if (!id) return false;
    let seen = processedMessageIds.get(number);
    if (!seen) { seen = new Set(); processedMessageIds.set(number, seen); }
    if (seen.has(id)) return true;
    seen.add(id);
    if (seen.size > 500) {
        // drop the oldest half once it gets too big
        const arr = [...seen];
        seen.clear();
        for (const v of arr.slice(arr.length - 250)) seen.add(v);
    }
    return false;
}

// 🚨 STORAGE FIX: multiple plugins write temp files to /tmp and the OS tmpdir
// for downloads/conversions (songs, videos, stickers, view-once cache, etc).
// Individual cleanup bugs have been fixed, but as a safety net against any
// still-missed path (or a crash mid-conversion), this periodically sweeps
// away anything older than 1 hour matching the bot's own temp-file naming
// patterns — this is what was causing storage to keep climbing on hosts
// with tight limits like KataBump's free tier.
function sweepOrphanedTempFiles() {
    const dirs = [require('os').tmpdir(), '/tmp'];
    const ourPrefixes = ['ytaudio_', 'ytvideo_', 'vvcache_', 'menu_in_', 'menu_out_', 'amd_', 'vc_'];
    const ONE_HOUR = 60 * 60 * 1000;
    const now = Date.now();
    for (const dir of new Set(dirs)) {
        try {
            for (const file of fs.readdirSync(dir)) {
                if (!ourPrefixes.some(p => file.startsWith(p))) continue;
                const fullPath = require('path').join(dir, file);
                try {
                    const stat = fs.statSync(fullPath);
                    if (now - stat.mtimeMs > ONE_HOUR) fs.unlinkSync(fullPath);
                } catch {}
            }
        } catch {}
    }
}
setInterval(sweepOrphanedTempFiles, 30 * 60 * 1000);


// 🚨 MEMORY-LEAK FIX: lastCommandAt and lastReactAt keep one entry PER
// SENDER/CHAT FOREVER — on a bot with a lot of daily users/groups, that
// grows without bound for as long as the process stays up (which, with the
// 24/7 reconnect fix, is meant to be a long time). Sweep out anything older
// than 1 hour every 30 minutes — cheap, and nothing legitimate needs an
// entry older than that (cooldowns are seconds, react-throttle is 20s).
setInterval(() => {
    const cutoff = Date.now() - (60 * 60 * 1000);
    for (const [key, ts] of lastCommandAt) if (ts < cutoff) lastCommandAt.delete(key);
    for (const [key, ts] of lastReactAt) if (ts < cutoff) lastReactAt.delete(key);
    // 🚨 MEMORY-LEAK FIX (Bunty: "bot fast/stable rahe, error na de"):
    // lastGroupMsgAt (.slowmode) and floodTracker (.antiflood) had the
    // exact same per-chat:sender-forever leak as lastCommandAt/lastReactAt
    // above, just never got swept here too. floodTracker's own array
    // already self-trims to its time window, but the MAP KEY for every
    // chat:sender pair that ever triggered either check was never removed
    // — same slow unbounded RAM growth over a long uptime, just for two
    // different Maps. Reusing this same 30-min sweep/1-hour cutoff.
    for (const [key, ts] of lastGroupMsgAt) if (ts < cutoff) lastGroupMsgAt.delete(key);
    for (const [key, hits] of floodTracker) {
        if (!hits.length || hits[hits.length - 1] < cutoff) floodTracker.delete(key);
    }
}, 30 * 60 * 1000);


function createahmadStore() {
    const store = {
        messages: {},
        // 🚨 MEMORY-LEAK FIX (bot slowing down / getting OOM-killed the
        // longer it stays up — a big contributor to "offline ho jata" on a
        // low-RAM host like Katabump): messages.length was already capped
        // per-chat at 200, but a NEW ENTRY WAS KEPT FOREVER FOR EVERY CHAT
        // THE BOT EVER SAW — for a bot active in hundreds of groups over
        // weeks, that's hundreds of arrays of up to 200 messages each,
        // sitting in RAM for the entire process lifetime with nothing ever
        // removing an old chat's entry. This tracks insertion order and
        // evicts the oldest-touched chat once more than 300 distinct chats
        // are being tracked, so total memory use stays bounded no matter
        // how many groups the bot has been active in.
        _order: [],
        bind(ev) {
            ev.on('messages.upsert', ({ messages }) => {
                for (const msg of messages) {
                    const jid = msg.key && msg.key.remoteJid;
                    if (!jid) continue;
                    if (!store.messages[jid]) {
                        store.messages[jid] = [];
                        store._order.push(jid);
                        if (store._order.length > 300) {
                            const oldest = store._order.shift();
                            delete store.messages[oldest];
                        }
                    }
                    store.messages[jid].push(msg);
                    if (store.messages[jid].length > 200) store.messages[jid].shift();
                }
            });
        },
        async loadMessage(jid, id) {
            if (!store.messages[jid]) return null;
            return store.messages[jid].find(m => m.key && m.key.id === id) || null;
        }
    };
    return store;
}

// Utility functions
const createSerial = (size) => crypto.randomBytes(size).toString('hex').slice(0, size);

// ✅ FIX (GCSTATUS-FIX): WhatsApp now assigns group participants a privacy
// "@lid" identity in addition to their real "@s.whatsapp.net" number. If a
// group uses @lid internally, groupMetadata.participants[i].id will be an
// @lid jid, while the sender of a message may show up as either @lid or
// @s.whatsapp.net depending on context. Comparing only the numeric part of
// two different jid *types* will never match, so a real admin was wrongly
// told "you must be admin". Fix: collect every identity field Baileys may
// expose per participant, and normalize/compare against ALL of them.
const getGroupAdmins = (participants) => {
    let admins = [];
    for (let i of participants) {
        if (i.admin == null) continue; // not an admin/superadmin
        if (i.id) admins.push(i.id);
        if (i.jid) admins.push(i.jid);
        if (i.lid) admins.push(i.lid);
        if (i.phoneNumber) admins.push(i.phoneNumber);
    }
    return admins;
};

const isJidInList = (jid, list) => {
    if (!jid || !list) return false;
    const num = jid.split('@')[0].split(':')[0];
    return list.some(item => item && item.split('@')[0].split(':')[0] === num);
};

// Extra safety net: if the plain numeric comparison above still fails
// (e.g. sender is @lid but admin list only has the @s.whatsapp.net number,
// or vice versa), ask Baileys' own lid<->phone-number mapping store to
// resolve the alternate identity and try again. Wrapped in try/catch
// because this internal API can vary between Baileys versions.
const resolveIsAdmin = async (conn, jid, list) => {
    if (isJidInList(jid, list)) return true;
    try {
        const isLid = jid.endsWith('@lid');
        const lidMap = conn?.signalRepository?.lidMapping;
        if (lidMap) {
            const alt = isLid
                ? await lidMap.getPNForLID(jid)
                : await lidMap.getLIDForPN(jid);
            if (alt && isJidInList(alt, list)) return true;
        }
    } catch (_) {}
    return false;
};

// 🚨 BUG FIX ("kabhi group mein nahi chalta" — owner-only commands, WORK_TYPE
// "private" mode, and cooldown-exemption randomly failing): isOwner used to
// be a PLAIN senderNumber === ownerNumber string check. But exactly like
// group admin status above, WhatsApp can deliver a message's sender as an
// "@lid" privacy identity instead of the real "@s.whatsapp.net" number —
// when that happens senderNumber is a random-looking @lid pseudo-number, so
// it never matches OWNER_NUMBER even though it genuinely is the owner. This
// reuses the exact same lid<->phone-number resolution resolveIsAdmin already
// has, just checked against the owner-number list instead of an admin list.
const resolveIsOwner = async (conn, jid, ownerList) => {
    return resolveIsAdmin(conn, jid, ownerList);
};

function isNumberAlreadyConnected(number) {
    const n = number.replace(/[^0-9]/g, '');
    return activeSockets.has(n) && connectionOpenState.get(n) === true;
}

function getConnectionStatus(number) {
    const n = number.replace(/[^0-9]/g, '');
    const isConnected = activeSockets.has(n);
    const connectionTime = socketCreationTime.get(n);
    return {
        isConnected,
        connectionTime: connectionTime ? new Date(connectionTime).toLocaleString() : null,
        uptime: connectionTime ? Math.floor((Date.now() - connectionTime) / 1000) : 0
    };
}

function ahmadLog(message, type = 'info') {
    const icons = { info: '📝', success: '✅', error: '❌', warning: '⚠️', debug: '🐛' };
    console.log(`${icons[type] || '📝'} [™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 ᥫᩣ] ${new Date().toISOString()}: ${message}`);
}

// Load Plugins
const pluginsDir = path.join(__dirname, 'plugins');
if (!fs.existsSync(pluginsDir)) fs.mkdirSync(pluginsDir, { recursive: true });

// 🔄 HOT-RELOAD (Bunty: "Usman ki file mein command hot-reload hai, hamari
// mein nahi") — mirrors Usman-MD's loadCommands()+fs.watch pattern. Every
// plugin file calls cmd(...) at require-time, which pushes into the shared
// events.commands array / events.commandMap. To reload safely we clear both
// completely and re-require EVERY plugin file fresh (same as Usman-MD does)
// rather than trying to track which entries came from which single file —
// simpler and can't leave stale/duplicate commands behind.
function loadAllPlugins() {
    events.commands.length = 0;
    events.commandMap.clear();
    const pluginFiles = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'));
    for (const file of pluginFiles) {
        try {
            const filePath = path.join(pluginsDir, file);
            delete require.cache[require.resolve(filePath)];
            require(filePath);
        } catch (e) { ahmadLog(`Failed to load plugin ${file}: ${e.message}`, 'error'); }
    }
    try {
        const customCount = require('./lib/custom-cmds').loadCustomCommands();
        if (customCount > 0) ahmadLog(`Loaded ${customCount} custom command(s) from .addcmd`, 'info');
    } catch (e) { ahmadLog(`Failed to load custom commands: ${e.message}`, 'error'); }
    // onListenerCommands is a separately-cached filtered array (see below) —
    // refill it IN PLACE so every other part of the file that already holds
    // a reference to this same array (declared with const) sees the update.
    onListenerCommands.length = 0;
    onListenerCommands.push(...events.commands.filter(c => c.on));
    return pluginFiles.length;
}

const pluginFiles = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'));
ahmadLog(`Loading ${pluginFiles.length} plugins...`, 'info');
for (const file of pluginFiles) {
    try { require(path.join(pluginsDir, file)); }
    catch (e) { ahmadLog(`Failed to load plugin ${file}: ${e.message}`, 'error'); }
}

// 🧩 Re-register any custom commands the owner added via .addcmd — so they
// survive restarts/redeploys instead of vanishing on every reboot.
try {
    const customCount = require('./lib/custom-cmds').loadCustomCommands();
    if (customCount > 0) ahmadLog(`Loaded ${customCount} custom command(s) from .addcmd`, 'info');
} catch (e) {
    ahmadLog(`Failed to load custom commands: ${e.message}`, 'error');
}

// 🚨 SPEED FIX (Ahmad: ".ping 300-1000ms+ 🐢"): computed once, here, after
// every plugin (and .addcmd custom command) has finished registering — see
// the messages.upsert handler for why this replaces a per-message scan of
// all ~528 registered commands.
const onListenerCommands = events.commands.filter(c => c.on);

// 🔄 Watch the plugins folder — any .js file added/edited/removed triggers a
// full reload, same as Usman-MD. Debounced 300ms since editors/git often
// fire several change events for one save.
let reloadTimer = null;
fs.watch(pluginsDir, (eventType, filename) => {
    if (!filename || !filename.endsWith('.js')) return;
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => {
        const count = loadAllPlugins();
        ahmadLog(`🔄 Hot-reloaded plugins (${filename} changed) — ${count} files, ${events.commands.length} commands`, 'info');
    }, 300);
});





async function setupCallHandlers(socket, number) {
    socket.ev.on('call', async (calls) => {
        try {
            const userConfig = await getUserConfigFromMongoDB(number);
            if (userConfig.ANTI_CALL !== 'true') return;
            for (const call of calls) {
                if (call.status !== 'offer') continue;
                await socket.rejectCall(call.id, call.from);
                await socket.sendMessage(call.from, {
                    text: userConfig.REJECT_MSG || config.REJECT_MSG
                });
                ahmadLog(`Auto-rejected call for ${number} from ${call.from}`, 'info');
            }
        } catch (err) {
            ahmadLog(`Anti-call error for ${number}: ${err.message}`, 'error');
        }
    });
}

// 🚨 NEW (Ahmad: "bot 24 hours baad chalta nahi") — see lastActivityAt
// comment above. This is a safety net for the case where Baileys never
// fires a close event even though the connection is actually dead.
// 🚨 BUG FIX (Ahmad: "bot connect hone ke baad jaldi inactive ho jata hai"):
// the first version of this watchdog read `socket.ws.socket.readyState` /
// `socket.ws.readyState` and treated anything other than `1` as a dead
// socket. That property path/value was never actually confirmed against
// this Baileys version — if it reports something other than the standard
// WebSocket readyState enum (e.g. a different internal state value), a
// perfectly healthy, freshly-opened connection could get misread as dead
// on the very first check (3 min after connecting) and get force-killed
// and reconnected — which is exactly the "goes inactive quickly after
// connecting" symptom that started after this watchdog was added. Removed
// that unverified check entirely. Now this relies ONLY on real inactivity
// (no connection.update AND no message seen for a long time) with a grace
// period after connecting, which can't misfire on a freshly-healthy socket.
const watchdogRegistered = new Set(); // sanitizedNumber -> avoid double-registering on rapid reconnects
function registerStaleSocketWatchdog(socket, number, sanitizedNumber) {
    if (watchdogRegistered.has(sanitizedNumber)) return;
    watchdogRegistered.add(sanitizedNumber);
    const CHECK_EVERY_MS = 5 * 60 * 1000;
    const GRACE_PERIOD_MS = 15 * 60 * 1000; // never act on a socket younger than this
    const STALE_THRESHOLD_MS = 45 * 60 * 1000; // no activity at all for this long = assume dead
    const interval = setInterval(async () => {
        if (!activeSockets.has(sanitizedNumber) || activeSockets.get(sanitizedNumber) !== socket) {
            clearInterval(interval);
            watchdogRegistered.delete(sanitizedNumber);
            return;
        }
        try {
            const createdAt = socketCreationTime.get(sanitizedNumber) || 0;
            if (Date.now() - createdAt < GRACE_PERIOD_MS) return; // too young to judge yet
            const staleForMs = Date.now() - (lastActivityAt.get(sanitizedNumber) || createdAt);
            const isZombie = staleForMs > STALE_THRESHOLD_MS;
            if (isZombie) {
                ahmadLog(`Watchdog: no activity at all for ${number} in ${Math.round(staleForMs / 60000)} min but no close event ever fired — forcing reconnect.`, 'error');
                clearInterval(interval);
                watchdogRegistered.delete(sanitizedNumber);
                activeSockets.delete(sanitizedNumber);
                socketCreationTime.delete(sanitizedNumber);
                try { socket.ws?.close(); } catch (_) {}
                try { socket.end(new Error('watchdog: stale socket, forcing reconnect')); } catch (_) {}
                const mockRes = { headersSent: false, send: () => {}, status: () => mockRes, setHeader: () => {}, json: () => {} };
                try { await ahmadPair(number, mockRes); } catch (e) { ahmadLog(`Watchdog reconnect failed for ${number}: ${e.message}`, 'error'); }
            }
        } catch (e) {
            ahmadLog(`Watchdog check error for ${number}: ${e.message}`, 'error');
        }
    }, CHECK_EVERY_MS);
}

function setupAutoRestart(socket, number) {
    let restartAttempts = 0;
    const maxRestartAttempts = 8; // was 3 — too easy to exhaust and end up needing a manual reconnect
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    lastActivityAt.set(sanitizedNumber, Date.now());
    registerStaleSocketWatchdog(socket, number, sanitizedNumber);

    socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        lastActivityAt.set(sanitizedNumber, Date.now());
        if (connection === 'close') {
            const statusCode = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode;
            const errorMessage = lastDisconnect && lastDisconnect.error && lastDisconnect.error.message;
            // Full disconnect reason logged every time — if the bot drops again,
            // this line tells us exactly why (e.g. was it WhatsApp closing the
            // stream, a timeout, a stream:error, etc).
            ahmadLog(`Connection closed for ${number}: statusCode=${statusCode} reason="${errorMessage}"`, 'warning');

            const sanitizedNumber = number.replace(/[^0-9]/g, '');

            // 🚨 ROOT-CAUSE FIX ("already_connected" after first pairing):
            // activeSockets gets this number added the MOMENT a socket object
            // is created (see ahmadPair, right after makeWASocket) — well
            // BEFORE pairing actually succeeds. Previously this map entry was
            // only ever cleaned up on a 401 (logged out) or inside the retry
            // branch below. That meant a pairing code that expired (408), a
            // QR/pairing timeout, or hitting max restart attempts left the
            // number sitting in activeSockets FOREVER even though it was
          // never actually connected — so every later `.code`/pair request
            // for that number saw isNumberAlreadyConnected()===true and
            // returned "already_connected" instead of issuing a fresh code.
            // Fix: on ANY real close, immediately clear the bookkeeping maps
            // here, up front. If we do go on to reconnect below, ahmadPair
            // re-adds the entry itself once the new socket is created — so
            // legitimate reconnects are unaffected.
            activeSockets.delete(sanitizedNumber);
            socketCreationTime.delete(sanitizedNumber);
            connectionOpenState.delete(sanitizedNumber);

            if (statusCode === 401 || (errorMessage && errorMessage.includes('401'))) {
                ahmadLog(`Manual unlink detected for ${number}, cleaning up...`, 'warning');
                ahmadStores.delete(sanitizedNumber);
                await deleteSessionFromMongoDB(sanitizedNumber);
                await removeNumberFromMongoDB(sanitizedNumber);
                socket.ev.removeAllListeners();
                return;
            }

            // 🚨 SPEED FIX (Ahmad: "overall bot slow" — root cause found via
            // console logs): statusCode 403 ("Connection Failure") almost
            // always means WhatsApp has banned/blocked that number from
            // connecting — it will NEVER succeed no matter how many times we
            // retry. This used to fall through to the generic retry path
            // below: 8 fast retries (10s apart), then forever after that
            // every 60s. With multiple numbers hosted in this SAME process
            // (activeSockets), even ONE banned number stuck in that infinite
            // loop keeps burning CPU/network/event-loop time forever — which
            // is exactly why EVERY number's commands (including .ping on a
            // perfectly healthy number) were slow. Now 403 is treated like a
            // permanent failure (same as 401): clean up and stop, instead of
            // fighting a connection that can't ever come back.
            const looksBanned = statusCode === 403
                || (errorMessage && /banned|blocked|forbidden/i.test(errorMessage));
            if (looksBanned) {
                ahmadLog(`Number ${number} looks banned/blocked (statusCode=${statusCode}, reason="${errorMessage}"). NOT retrying, cleaning up session so it stops burning resources for every other number sharing this process.`, 'error');
                ahmadStores.delete(sanitizedNumber);
                await deleteSessionFromMongoDB(sanitizedNumber);
                await removeNumberFromMongoDB(sanitizedNumber);
                socket.ev.removeAllListeners();
                return;
            }

            // 🚨 BUG FIX (Ahmad: "bot lagate hi auto disconnect ho jata"):
            // connectionReplaced means ANOTHER session/instance connected
            // with these SAME credentials and WhatsApp kicked this one out
            // to make room (WhatsApp only allows one active connection per
            // "linked device" slot). This can happen if a redeploy briefly
            // runs an old and new container at the same time, or if the
            // session was opened elsewhere. Retrying here was actively
            // counterproductive — reconnecting with the same stale
            // credentials just gets replaced again by whatever session is
            // legitimately holding it now, causing a fight/reconnect loop
            // that looks exactly like "keeps randomly disconnecting". This
            // stops retrying immediately and logs clearly instead, so it's
            // obvious in the logs when this is the cause.
            if (statusCode === DisconnectReason.connectionReplaced) {
                ahmadLog(`Connection REPLACED for ${number} — another session/instance connected with the same credentials (e.g. overlapping redeploy, or logged in elsewhere). NOT retrying, to avoid fighting the new session. If this wasn't intentional, make sure only ONE instance of the bot is running for this number.`, 'error');
                socket.ev.removeAllListeners();
                return;
            }

            const isNormalError = statusCode === 408 || (errorMessage && errorMessage.includes('QR refs attempts ended'));
            if (isNormalError) { ahmadLog(`Normal closure for ${number}, no restart needed.`, 'info'); return; }

            if (restartAttempts < maxRestartAttempts) {
                restartAttempts++;
                // 515 = restartRequired — Baileys expects an IMMEDIATE reconnect
                // here (it's a normal part of the connection handshake, not a
                // real failure), so don't sit through the usual 10s delay for it.
                const isRestartRequired = statusCode === 515;
                const waitMs = isRestartRequired ? 500 : 10000;
                ahmadLog(`Reconnecting ${number} (${restartAttempts}/${maxRestartAttempts}) in ${waitMs}ms...`, 'warning');
                socket.ev.removeAllListeners();
                await delay(waitMs);
                try {
                    const mockRes = { headersSent: false, send: () => {}, status: () => mockRes, setHeader: () => {}, json: () => {} };
                    await ahmadPair(number, mockRes);
                } catch (e) { ahmadLog(`Reconnection failed for ${number}: ${e.message}`, 'error'); }
            } else {
                // 🚨 BUG FIX (24/7 uptime — bot going offline after ~10-20 min
                // and never coming back on its own): previously, once
                // maxRestartAttempts was hit, the bot just gave up silently
                // and stayed offline until someone manually re-paired. Free/
                // shared hosts (Railway, Render, Katabump, etc.) restart or
                // drop connections far more often than 8 retries can absorb.
                // Now, after exhausting the fast-retry attempts, it backs off
                // to a longer interval and keeps trying indefinitely instead
                // of permanently giving up — this is what actually makes the
                // bot behave like it's online 24/7 on flaky free hosting.
                ahmadLog(`Max fast-restart attempts reached for ${number}. Switching to slow-retry mode (every 60s) so the bot keeps trying to come back online instead of staying offline.`, 'error');
                const slowRetry = setInterval(async () => {
                    if (activeSockets.has(sanitizedNumber)) { clearInterval(slowRetry); return; } // already reconnected some other way
                    ahmadLog(`Slow-retry reconnect attempt for ${number}...`, 'warning');
                    clearInterval(slowRetry);
                    try {
                        const mockRes = { headersSent: false, send: () => {}, status: () => mockRes, setHeader: () => {}, json: () => {} };
                        await ahmadPair(number, mockRes);
                    } catch (e) {
                        ahmadLog(`Slow-retry reconnect failed for ${number}: ${e.message}`, 'error');
                    }
                }, 60000);
            }
        }
        if (connection === 'open') { restartAttempts = 0; connectionOpenState.set(sanitizedNumber, true); }
    });
}


async function ahmadPair(number, res = null) {
    let connectionLockKey;
    const sanitizedNumber = number.replace(/[^0-9]/g, '');
    if (!bootMarkTs.has(sanitizedNumber)) bootMarkTs.set(sanitizedNumber, await loadBootMark(sanitizedNumber));

    try {
        const sessionPath = path.join(__dirname, 'session', `session_${sanitizedNumber}`);

        if (isNumberAlreadyConnected(sanitizedNumber)) {
            const status = getConnectionStatus(sanitizedNumber);
            if (res && !res.headersSent) {
                return res.json({ status: 'already_connected', message: 'Number is already connected', connectionTime: status.connectionTime, uptime: `${status.uptime} seconds` });
            }
            return;
        }

        connectionLockKey = `ahmad_lock_${sanitizedNumber}`;
        if (global[connectionLockKey]) {
            if (res && !res.headersSent) return res.json({ status: 'connection_in_progress' });
            return;
        }
        global[connectionLockKey] = true;

        // Check MongoDB session
        const existingSession = await getSessionFromMongoDB(sanitizedNumber);

        if (!existingSession) {
            ahmadLog(`No MongoDB session for ${sanitizedNumber} — new pairing required`, 'info');
            if (fs.existsSync(sessionPath)) {
                await fs.remove(sessionPath);
                ahmadLog(`Cleaned leftover local session for ${sanitizedNumber}`, 'info');
            }
        } else {
            // Session exists - restore from MongoDB
            fs.ensureDirSync(sessionPath);
            fs.writeFileSync(path.join(sessionPath, 'creds.json'), JSON.stringify(existingSession, null, 2));
            ahmadLog(`🔄 Restored existing session from MongoDB for ${sanitizedNumber}`, 'success');
        }

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        // 🚨 SPEED FIX (Ahmad: "overall reply aane mein hi der lagti hai"):
        // this logger backs makeCacheableSignalKeyStore, which runs on EVERY
        // message's encrypt/decrypt (signal protocol key read/write) — not
        // just connection events. It was defaulting to 'debug' unless
        // NODE_ENV was exactly 'production', but Katabump/Railway/Render
        // don't set that automatically, so in practice it ran in 'debug'
        // on every host unless someone set the env var by hand. 'debug'
        // pino output is synchronous stdout writes with full object
        // serialization, happening per-message — real, measurable added
        // latency before every reply, on every host, regardless of RAM/CPU
        // tier. Now defaults to a quiet level always; set LOG_LEVEL=debug
        // in env only when actively troubleshooting.
        const logger = pino({ level: process.env.LOG_LEVEL || 'silent' });

        let ahmadStore = ahmadStores.get(sanitizedNumber);
        if (!ahmadStore) {
            ahmadStore = createahmadStore();
            ahmadStores.set(sanitizedNumber, ahmadStore);
        }

        // 🚨 ROOT-CAUSE FIX — REVERTS the earlier hardcoded version pin
        // (Bunty: "[DECRYPT-DEBUG] entire batch had no decrypted content"
        // confirmed via live test): the pin [2, 3000, 9758746874] is now a
        // STALE WhatsApp-Web protocol version — WhatsApp's servers have
        // moved on, and pinning an old version made Baileys negotiate an
        // outdated Signal-session setup that's no longer able to actually
        // decrypt messages from @lid-addressed contacts at all. This isn't
        // a "retry with a resolved jid" problem anymore, it's a genuine
        // decryption failure — no amount of jid-resolution code fixes
        // that. fetchLatestBaileysVersion() asks WhatsApp itself what the
        // CURRENT supported version is, every time the bot connects, so
        // it never goes stale like a hardcoded array does. This is also
        // Baileys' own documented recommended approach over hardcoding.
        const { version } = await fetchLatestBaileysVersion();

        const conn = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, logger),
            },
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            connectTimeoutMs: 60000,
            // 🚨 SPEED FIX: 0 here means "no timeout" — if any WA query (e.g.
            // groupMetadata, or anything else conn.* awaits) got no response,
            // the bot would just hang on it forever instead of failing fast,
            // which shows up as the whole bot "freezing"/going slow until a
            // manual restart. 60s is generous but actually bounds it.
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 10000,
            emitOwnEvents: true,
            fireInitQueries: true,
            generateHighQualityLinkPreview: true,
            syncFullHistory: false,
            // 🚨 ROOT-LEVEL FIX: syncFullHistory:false alone only skips the BIG
            // comprehensive history sync — WhatsApp still sends smaller
            // "recent messages" history-sync chunks by default, which is what
            // was causing old commands to fire again after a reconnect. This
            // callback tells Baileys to skip processing ANY history-sync
            // notification entirely, so there's nothing to replay in the first
            // place. (The timestamp-based filter in the message handler stays
            // too, as a second layer of defense.)
            shouldSyncHistoryMessage: () => false,
            markOnlineOnConnect: true,
            browser: Browsers.ubuntu('Chrome'),
            getMessage: async (key) => {
                try {
                    const msg = await ahmadStore.loadMessage(key.remoteJid, key.id);
                    return msg && msg.message ? msg.message : undefined;
                } catch (e) {
                    return undefined;
                }
            }
        });

        socketCreationTime.set(sanitizedNumber, Date.now());
        activeSockets.set(sanitizedNumber, conn);
        // 🚨 SAFETY NET for the same "already connected but never really
        // connected" bug: even with connectionOpenState above, belt-and-
        // suspenders in case some disconnect path skips both the 'close'
        // handler and ever reaching 'open' (e.g. process hiccup). If this
        // exact socket still hasn't opened within 3 minutes (WhatsApp
        // pairing codes expire well before that anyway), clear it so the
        // NEXT .pair attempt for this number gets a clean slate instead of
        // being stuck behind a dead half-connection.
        setTimeout(() => {
            if (activeSockets.get(sanitizedNumber) === conn && connectionOpenState.get(sanitizedNumber) !== true) {
                ahmadLog(`Pairing attempt for ${sanitizedNumber} never opened within 3 min — clearing stale entry.`, 'warning');
                activeSockets.delete(sanitizedNumber);
                socketCreationTime.delete(sanitizedNumber);
                try { conn.end(new Error('pairing timeout, never opened')); } catch (_) {}
            }
        }, 3 * 60 * 1000);
        ahmadStore.bind(conn.ev);

        // 🚨 ROOT-CAUSE FIX (Bunty: "@lid chat mein koi bhi command chalao,
        // kuch nahi hota, mode se farq nahi padta"): patching just the shared
        // reply() helper (main.js) wasn't enough — most plugins (e.g.
        // plugins/ping.js) call conn.sendMessage(from, ...) DIRECTLY,
        // completely bypassing reply(). Confirmed via console: .ping's
        // [PERF] dispatch log fires (command genuinely runs), but nothing
        // ever arrives in the @lid chat and no error surfaces anywhere,
        // because ping.js's own try/catch swallows the failure with just a
        // console.error(e) (not ahmadLog, so it's easy to miss in hosted
        // logs) and a best-effort reply("❌ Failed!") that ALSO goes through
        // the same broken direct sendMessage path.
        // Fixing this per-plugin isn't practical (60+ files, many with their
        // own direct conn.sendMessage(from, ...) calls). Instead, wrap
        // conn.sendMessage ONCE, right here at the socket level, so EVERY
        // call — from any plugin, from reply(), from anywhere — automatically
        // gets @lid-aware retry + visible error logging, with zero changes
        // needed anywhere else in the 60+ plugin files.
        const __rawSendMessage = conn.sendMessage.bind(conn);
        conn.sendMessage = async (jid, content, options) => {
            try {
                return await __rawSendMessage(jid, content, options);
            } catch (e) {
                if (typeof jid === 'string' && jid.endsWith('@lid')) {
                    try {
                        // Try the free, always-available stanza hint FIRST —
                        // works even for a stranger's very first message,
                        // unlike lidMapping which needs a pre-existing session.
                        const lidMap = conn?.signalRepository?.lidMapping;
                        const realJid = lidAltCache.get(jid) || (lidMap ? await lidMap.getPNForLID(jid) : null);
                        if (realJid) {
                            ahmadLog(`sendMessage: @lid send failed for ${jid} (${e.message}) — retrying via resolved jid ${realJid}`, 'warning');
                            return await __rawSendMessage(realJid, content, options);
                        }
                    } catch (e2) {
                        ahmadLog(`sendMessage: @lid fallback also failed for ${jid}: ${e2.message}`, 'error');
                        throw e2;
                    }
                }
                ahmadLog(`sendMessage: failed for ${jid}: ${e.message}`, 'error');
                throw e;
            }
        };

        // 🚀 SPEED + RELIABILITY FIX (compared against Usman-MD, which reacts
        // to channel posts instantly and never misses one): the old autoreact
        // code lived INSIDE the big messages.upsert handler further below,
        // AFTER the freshness filter, the wasAlreadyProcessed dedup filter,
        // handleAntideleteUpsert, handleAntieditUpsert, the per-message
        // antiviewonce loop, and an awaited getUserConfigFromMongoDB() call —
        // every channel post had to wait in line behind ALL of that before a
        // reaction was even attempted. Usman-MD instead registers its
        // autoreact as its OWN dedicated conn.ev.on('messages.upsert', ...)
        // listener, completely separate from command handling, so it fires
        // the instant Baileys delivers the event with nothing else in front
        // of it. This mirrors that: a small, standalone listener registered
        // right here at connection time, whose only job is reacting to
        // channel/newsletter posts. The full-featured newsletter block later
        // in this file (further down, inside the main handler) now only
        // handles .chnfor relay — NOT reacting — so posts don't get
        // double-reacted.
        conn.ev.on('messages.upsert', async ({ messages }) => {
            try {
                for (const rawMsg of (messages || [])) {
                    const jid = rawMsg.key?.remoteJid;
                    if (!jid || !jid.endsWith('@newsletter')) continue;

                    // 🚨 BUG FIX: Baileys has used different property names for
                    // this across versions (newsletterServerId in some, a plain
                    // server_id/serverId on the key in others). Checking all
                    // three means this keeps working across Baileys upgrades
                    // instead of silently going quiet if the field gets renamed.
                    const serverId = rawMsg.newsletterServerId || rawMsg.key?.server_id || rawMsg.key?.serverId;
                    if (!serverId) continue;

                    // 🚨 DECOUPLED (Bunty: "autoreact default off ho normal chat
                    // mein, but channel wala hamesha on rahe") — this used to also
                    // fire when userConfig.AUTO_REACT === 'true', tying channel
                    // reactions to the SAME toggle as normal DM/group auto-react
                    // (.autoreact on/off). Now that toggle defaults to off, that
                    // link would've turned channel reactions off too. Channel
                    // auto-react is its own always-on feature for the configured
                    // channel(s) — no longer checks AUTO_REACT at all, still only
                    // reacts to the bot's own configured channel(s) rather than
                    // every newsletter the account happens to follow.
                    const newsletterJids = (Array.isArray(config.AUTO_FOLLOW_JIDS) && config.AUTO_FOLLOW_JIDS.length)
                        ? config.AUTO_FOLLOW_JIDS
                        : (config.CHANNEL_JID ? [config.CHANNEL_JID] : []);
                    if (!newsletterJids.includes(jid)) continue;

                    // 🚨 EXPANDED (Bunty: "channel auto react mein har color ka heart
                    // aur positive emoji zyada dalo") — every heart color WhatsApp
                    // supports, plus a wider spread of positive/celebratory reactions.
                    const newsEmojis = [
                        '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎',
                        '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟',
                        '👍', '😍', '🥰', '😊', '🎉', '✨', '🌟', '🔥',
                        '👑', '💯', '🙌', '👏', '😎', '🤩', '💫', '😮'
                    ];
                    const emoji = newsEmojis[Math.floor(Math.random() * newsEmojis.length)];
                    try {
                        await conn.newsletterReactMessage(jid, serverId.toString(), emoji);
                        console.log(`[AUTOREACT] reacted ${emoji} to serverId=${serverId} on ${jid}`);
                    } catch (reactErr) {
                        // Same self-heal as before: most failures are just "not
                        // actually following yet" — follow, then retry once.
                        try {
                            await conn.newsletterFollow(jid);
                            await conn.newsletterReactMessage(jid, serverId.toString(), emoji);
                            console.log(`[AUTOREACT] reacted ${emoji} to serverId=${serverId} on ${jid} (after re-follow retry)`);
                        } catch (retryErr) {
                            console.log(`[AUTOREACT] FAILED on ${jid} (serverId=${serverId}) even after re-follow retry: ${retryErr.message}`);
                        }
                    }
                }
            } catch (e) {
                console.log(`[AUTOREACT] listener error: ${e.message}`);
            }
        });

        // Setup handlers
        setupCallHandlers(conn, number);
        setupAutoRestart(conn, number);

        // decodeJid utility
        conn.decodeJid = jid => {
            if (!jid) return jid;
            if (/:\d+@/gi.test(jid)) {
                const decode = jidDecode(jid) || {};
                return (decode.user && decode.server && decode.user + '@' + decode.server) || jid;
            }
            return jid;
        };

        conn.downloadAndSaveMediaMessage = async (message, filename, attachExtension = true) => {
            const quoted = message.msg ? message.msg : message;
            const mime = (message.msg || message).mimetype || '';
            const messageType = message.mtype ? message.mtype.replace(/Message/gi, '') : mime.split('/')[0];
            const stream = await downloadContentFromMessage(quoted, messageType);
            let buffer = Buffer.from([]);
            for await (const chunk of stream) {
                buffer = Buffer.concat([buffer, chunk]);
                if (buffer.length > 60 * 1024 * 1024) throw new Error('File too large (over 60MB).');
            }
            const type = await FileType.fromBuffer(buffer);
            const trueFileName = attachExtension ? (filename + '.' + type.ext) : filename;
            await fs.writeFileSync(trueFileName, buffer);
            return trueFileName;
        };

        // Pairing Code
        if (!conn.authState.creds.registered) {
            ahmadLog(`🔐 Starting NEW pairing process for ${sanitizedNumber}`, 'info');
            try {
                await delay(1500);
                // ✅ Custom pairing code (Ahmad requested "BUNTYTOP1" as the
                // code shown to users). WhatsApp/Baileys requires this to be
                // EXACTLY 8 uppercase alphanumeric characters — "BUNTYTOP1"
                // is 9 characters, one too many, so it would get rejected.
                // Trimmed to the closest 8-char version: "BUNTYTOP".
                // const customCode = 'BUNTYTOP'; // Standard Baileys does not support custom pairing codes
                const code = await conn.requestPairingCode(sanitizedNumber);
                ahmadLog(`Pairing Code for ${sanitizedNumber}: ${code}`, 'success');

                // 🚨 REMOVED (Bunty: "yeh khatam karo, sirf HTML/Telegram se
                // hi code jaye, WhatsApp pe kabhi kisi ko nahi") — this used
                // to relay the pairing code as a WhatsApp message to the
                // owner's number. Pairing codes now ONLY go out through the
                // HTML panel response below (`res.send`) and the Telegram
                // pairing bot (via `ahmadEvents`) — nothing about pairing is
                // ever sent over WhatsApp itself anymore.

                if (res && !res.headersSent) {
                    res.send({ code, status: 'new_pairing' });
                }
            } catch (error) {
                ahmadLog(`Failed to request pairing code: ${error.message}`, 'error');
                if (res && !res.headersSent) {
                    res.status(500).send({ error: 'Failed to get pairing code', status: 'error', message: error.message });
                }
                throw error;
            }
        } else {
            ahmadLog(`✅ Using existing session for ${sanitizedNumber}`, 'success');
            if (res && !res.headersSent) {
                res.json({ status: 'reconnecting', message: 'Reconnecting with existing session' });
            }
        }

        // Save creds on update
        conn.ev.on('creds.update', async () => {
            await saveCreds();
            const fileContent = await fs.readFile(path.join(sessionPath, 'creds.json'), 'utf8');
            const creds = JSON.parse(fileContent);
            const existingSessionCheck = await getSessionFromMongoDB(sanitizedNumber);
            const isNewSession = !existingSessionCheck;
            await saveSessionToMongoDB(sanitizedNumber, creds);
            if (isNewSession) {
                ahmadLog(`🎉 NEW user ${sanitizedNumber} successfully registered!`, 'success');
            }
        });

        // Anti-delete
        conn.ev.on('messages.update', async (updates) => {
            // 🚀 SPEED FIX (same class as the antidelete/antiedit/viewonce
            // parallelization already done in the messages.upsert handler
            // below): these two were awaited one after another even though
            // they're fully independent — a busy group message.update event
            // used to pay for both durations added together. Run together.
            await Promise.all([
                handleAntidelete(conn, updates, ahmadStore),
                handleAntiedit(conn, updates, ahmadStore)
            ]);
        });

        // 🚨 BUG FIX (welcome/goodbye not working): .welcome on/off and
        // .setwelcome/.setgoodbye saved settings correctly, but there was no
        // listener anywhere in the codebase that actually reacted to someone
        // joining or leaving a group — the feature's "on switch" existed but
        // was never wired to anything. This adds that missing listener.
        conn.ev.on('group-participants.update', async (gu) => {
            try {
                groupMetadataCache.delete(gu.id); // membership/admin status just changed — force a fresh fetch next time
                const { getGroupSettings } = require('./data/GroupSettings');
                const settings = await getGroupSettings(gu.id);
                for (const participant of gu.participants) {
                    const mention = '@' + participant.split('@')[0];
                    if (gu.action === 'add') {
                        if (!settings.welcomeOn) continue;
                        const { sendWelcome } = require('./lib/welcome-sender');
                        await sendWelcome(conn, gu.id, participant, settings).catch((e) => console.log('[WELCOME ERROR]', e.message));
                    } else if (gu.action === 'remove') {
                        // 🆕 Anti-kick (Bunty: "anti features admin ke liye
                        // bhi") — if the removed member was an admin (per our
                        // snapshot, since they're gone from groupMetadata by
                        // now) and this removal wasn't done via the bot's own
                        // .kick command, re-add them and flag it. Protects
                        // admins from being removed by other non-owner admins
                        // outside the bot's own audited flow.
                        try {
                            const gset = await getGroupSettings(gu.id);
                            if (gset.antikick) {
                                const wasAdmin = groupAdminsSnapshot.get(gu.id)?.has(participant);
                                const flagKey = `${gu.id}:${participant}:remove`;
                                const pending = global.pendingGroupActions;
                                const authorized = pending && pending.has(flagKey) && pending.get(flagKey) > Date.now();
                                if (wasAdmin && !authorized) {
                                    if (pending) pending.delete(flagKey);
                                    await conn.groupParticipantsUpdate(gu.id, [participant], 'add').catch((e) => console.log('[ANTIKICK RE-ADD ERROR]', e.message));
                                    await conn.sendMessage(gu.id, {
                                        text: `🛡️ Anti-kick is ON — ${mention} is an admin and was removed outside the bot. Re-added.\n\nUse .kick if this was intentional (only the owner should remove admins).`,
                                        mentions: [participant]
                                    }).catch(() => {});
                                    continue; // skip the normal goodbye message for a re-add
                                }
                            }
                        } catch (e) { console.log('[ANTIKICK ERROR]', e.message); }

                        // 🆕 (Bunty: "kick wale ki attitude wali lines alag
                        // hon, normal leave se") — reuse the SAME
                        // bot-authorized-removal flag antikick above already
                        // computes (stamped by .kick/.kickall themselves) to
                        // tell a real admin kick apart from someone leaving
                        // on their own, independent of whether antikick
                        // itself is even turned on.
                        const kickFlagKey = `${gu.id}:${participant}:remove`;
                        const kickPending = global.pendingGroupActions;
                        const wasBotKick = kickPending && kickPending.has(kickFlagKey) && kickPending.get(kickFlagKey) > Date.now();
                        if (kickPending) kickPending.delete(kickFlagKey);

                        const { sendGoodbye, sendKick } = require('./lib/welcome-sender');
                        if (wasBotKick && settings.kickMsg) {
                            await sendKick(conn, gu.id, participant, settings).catch((e) => console.log('[KICK MSG ERROR]', e.message));
                        } else {
                            // goodbyeMsg defaults to null (disabled) — only send if the
                            // owner/admin has actually set one via .setgoodbye.
                            if (!settings.goodbyeMsg) continue;
                            await sendGoodbye(conn, gu.id, participant, settings).catch((e) => console.log('[GOODBYE ERROR]', e.message));
                        }
                    }
                } // closes the for(participant of gu.participants) loop

                // 🚨 FEATURE FIX (.antipromote/.antidemote toggles existed in
                // admin-plus.js but were never actually enforced anywhere —
                // this listener is where .promote/.demote already stamp a
                // `pendingGroupActions` entry to mark "this change came from
                // the bot itself, don't revert it". Anything NOT stamped
                // (i.e. done natively in WhatsApp, outside the bot) gets
                // auto-reverted when the matching toggle is ON.
                if (gu.action === 'promote' || gu.action === 'demote') {
                    try {
                        const config = require('./config');
                        const settingKey = gu.action === 'promote' ? 'ANTIPROMOTE' : 'ANTIDEMOTE';
                        if (config[`${settingKey}_${gu.id}`] === 'true') {
                            const pending = global.pendingGroupActions;
                            const reverted = [];
                            for (const participant of gu.participants) {
                                const flagKey = `${gu.id}:${participant}:${gu.action}`;
                                if (pending && pending.has(flagKey) && pending.get(flagKey) > Date.now()) {
                                    pending.delete(flagKey);
                                    continue; // authorized via the bot itself — leave it alone
                                }
                                reverted.push(participant);
                            }
                            if (reverted.length) {
                                const revertAction = gu.action === 'promote' ? 'demote' : 'promote';
                                await conn.groupParticipantsUpdate(gu.id, reverted, revertAction).catch((e) => console.log('[ANTIPROMOTE/DEMOTE REVERT ERROR]', e.message));
                                const mentions = reverted.map(p => '@' + p.split('@')[0]).join(' ');
                                await conn.sendMessage(gu.id, {
                                    text: `🛡️ ${settingKey} is ON — reverted unauthorized ${gu.action} for: ${mentions}\n\nUse the bot's .${gu.action} command instead.`,
                                    mentions: reverted
                                }).catch(() => {});
                            }
                        }
                    } catch (e) { console.log('[ANTIPROMOTE/ANTIDEMOTE ERROR]', e.message); }
                }
            } catch (e) { console.log('[GROUP-PARTICIPANTS.UPDATE ERROR]', e.message); }
        });

        // Connection update
        conn.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            if (connection === 'open') {
                ahmadLog(`Connected: ${sanitizedNumber}`, 'success');
                connectionOpenState.set(sanitizedNumber, true);
                const userJid = jidNormalizedUser(conn.user.id);
                await addNumberToMongoDB(sanitizedNumber);

                // ✅ 24/7 ALWAYS ONLINE (requested by Ahmad): markOnlineOnConnect
                // only sets presence to "available" ONCE, right at connect time.
                // WhatsApp drops that back to "unavailable" after a while on its
                // own, which is why the number showed offline again a few minutes
                // after connecting even though the bot was still running. This
                // re-sends 'available' every 2 minutes for as long as the socket
                // is alive, so the number looks online 24/7 instead of only at
                // the moment of connecting.
                if (presenceWatchers.has(sanitizedNumber)) clearInterval(presenceWatchers.get(sanitizedNumber));
                const presenceIntervalId = setInterval(async () => {
                    try {
                        if (!activeSockets.has(sanitizedNumber)) { clearInterval(presenceIntervalId); return; }
                        await conn.sendPresenceUpdate('available');
                    } catch (_) {}
                }, 2 * 60 * 1000);
                presenceWatchers.set(sanitizedNumber, presenceIntervalId);

                // 🚨 BUG FIX: .mode saves WORK_TYPE to MongoDB, but the actual
                // enforcement check reads the live config.WORK_TYPE in-memory
                // value. Without this, a restart would silently forget any
                // .mode change and fall back to the config.js/env default.
                try {
                    const savedConfig = await getUserConfigFromMongoDB(sanitizedNumber);
                    if (savedConfig && savedConfig.WORK_TYPE) config.WORK_TYPE = savedConfig.WORK_TYPE;
                    // 🚨 Same restore as WORK_TYPE above — .setprefix saves the new
                    // prefix to storage, so make sure a reconnect/restart picks it
                    // back up instead of silently reverting to config.js's default.
                    if (savedConfig && savedConfig.PREFIX) config.PREFIX = savedConfig.PREFIX;
                } catch (_) {}

                // ✅ AUTO JOIN CHANNEL — har baar connect hone pe
                // 🚨 FEATURE (requested by Bunty — "dono channels working ho"):
                // there were TWO channels floating around in the code but only
                // ONE was ever actually auto-followed. CHANNEL_LINK (an invite
                // link) got resolved + followed below, but config.CHANNEL_JID
                // (the one used for the "forwarded from channel" cosmetic tag
                // on every reply) was never actually joined — it was purely
                // decorative. Now both get auto-followed on every connect and
                // re-checked every 5 min, same as before.
                const channelLink = config.CHANNEL_LINK || '';

                // 🚨 BUG FIX ("Failed to newsletter follow, unexpected response
                // structure" on EVERY channel, right after reconnect): this is
                // Baileys failing to parse WhatsApp's reply because the socket
                // fired newsletterFollow() before its query pipe was fully
                // warmed up post-reconnect (only ~0.7s after "Auto-reconnect
                // completed" in the logs — too fast). Fixed with a short delay
                // helper + up to 3 attempts with backoff before giving up, so a
                // slow-to-warm-up socket gets a real second chance instead of
                // failing once and staying unfollowed for 5 minutes.
                const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
                async function followWithRetry(jid) {
                    for (let attempt = 1; attempt <= 3; attempt++) {
                        try {
                            await conn.newsletterFollow(jid);
                            return true;
                        } catch (err) {
                            if (attempt === 3) {
                                ahmadLog(`Channel auto-join FAILED for ${jid}: ${err.message}`, 'warning');
                                return false;
                            }
                            await sleep(attempt * 2000); // 2s, then 4s
                        }
                    }
                }

                async function ensureChannelFollowed() {
                    // ✅ Multiple direct-JID channels — loops over every JID in
                    // config.AUTO_FOLLOW_JIDS (falls back to just CHANNEL_JID
                    // if that list isn't set, for backwards compatibility).
                    const jidsToFollow = (Array.isArray(config.AUTO_FOLLOW_JIDS) && config.AUTO_FOLLOW_JIDS.length)
                        ? config.AUTO_FOLLOW_JIDS
                        : (config.CHANNEL_JID ? [config.CHANNEL_JID] : []);

                    for (const jid of jidsToFollow) {
                        const ok = await followWithRetry(jid);
                        if (ok) ahmadLog(`✅ Channel follow sent (jid: ${jid})`, 'success');
                    }

                    // Channel #2 (via invite link) — invite links resolve to
                    // a JID that's not known ahead of time, so this stays
                    // separate from the direct-JID list above.
                    if (!channelLink || !channelLink.includes('whatsapp.com/channel/')) return;
                    const channelCode = channelLink.split('whatsapp.com/channel/')[1].split('?')[0];
                    try {
                        // 🚨 BUG FIX (the real "GraphQL server error: Bad Request"
                        // cause): the invite code in a channel LINK (the part
                        // after /channel/) is NOT the channel's actual JID — it's
                        // just an invite token. Passing `<code>@newsletter`
                        // straight to newsletterFollow as if it WERE the JID is
                        // what WhatsApp's server was rejecting as a bad request.
                        // The invite code has to be resolved to the real JID
                        // first via newsletterMetadata('invite', code).
                        const inviteMeta = await conn.newsletterMetadata('invite', channelCode);
                        const channelJid = inviteMeta?.id;
                        if (!channelJid) {
                            ahmadLog('Channel auto-join FAILED: could not resolve invite code to a JID (channel link may be wrong/expired).', 'warning');
                            return;
                        }
                        const ok = await followWithRetry(channelJid);
                        if (ok) {
                            const role = inviteMeta?.viewer_metadata?.role;
                            ahmadLog(`✅ Channel follow sent (jid: ${channelJid}${role ? `, role: ${role}` : ''})`, 'success');
                        }
                    } catch (autoJoinErr) {
                        ahmadLog('Channel auto-join FAILED: ' + autoJoinErr.message, 'warning');
                    }
                }

                // 🚨 Give the socket a moment to fully settle post-connect/
                // reconnect before the first follow attempt (on top of
                // followWithRetry's own internal retries — belt and suspenders).
                sleep(3000).then(() => ensureChannelFollowed());

                // 🚨 BUG FIX: the auto-join above only ran once, at connect time.
                // If someone unfollows the channel WHILE the bot stays connected
                // (no disconnect/reconnect happens), it stayed unfollowed until
                // the next reconnect. Now it's re-checked every 5 minutes so an
                // unfollow gets auto-corrected without needing a reconnect.
                if (channelWatchers.has(sanitizedNumber)) clearInterval(channelWatchers.get(sanitizedNumber));
                const watcherId = setInterval(ensureChannelFollowed, 5 * 60 * 1000);
                channelWatchers.set(sanitizedNumber, watcherId);

                // 🚨 BUG FIX (requested by Ahmad): Baileys/WhatsApp can emit
                // connection.update with connection:'open' more than once for
                // the SAME live connection — not just on a genuine
                // disconnect+reconnect, but also from internal keep-alive /
                // socket refresh cycles (this is why the welcome message was
                // repeating roughly every 30 min even with nothing actually
                // disconnecting). Tag the socket itself so the welcome
                // message only sends once per real connect/reconnect; a
                // genuine reconnect creates a brand-new `conn` object (via
                // ahmadPair), so it naturally gets its own untagged socket
                // and the welcome message still fires as intended there.
                const isFreshOpen = !conn._welcomeAlreadySent;
                conn._welcomeAlreadySent = true;

                // 🚨 BUG FIX (requested by Rome): welcome video/image should
                // fire once per connect/reconnect cycle within a running
                // process, and then again after a genuine server restart —
                // but NOT repeat every time Baileys silently reconnects (network
                // drop, hourly keep-alive re-auth, etc.) while the process is
                // still alive. `welcomeSentThisProcess` (module-level, defined
                // near the top of the file) is what gives us that: it survives
                // reconnects but gets wiped when the process itself restarts.
                const alreadyWelcomedThisProcess = welcomeSentThisProcess.has(sanitizedNumber);

                // 🚨 BUG FIX (welcome video every ~hour): `alreadyWelcomedThisProcess`
                // resets on every process restart, and hosts like Katabump can
                // respawn the free-tier process roughly hourly (idle/resource
                // limits) even though the WhatsApp session itself never
                // actually logged out. That respawn used to look identical to
                // a genuine reconnect, so welcome fired again every time. Now
                // we also check MongoDB (survives restarts) and skip if a
                // welcome already went out within WELCOME_COOLDOWN_MS — only a
                // real gap this long (or a brand-new pairing, which has no
                // prior record at all) lets it fire again.
                const WELCOME_COOLDOWN_MS = 6 * 60 * 60 * 1000; // 6 hours
                const msSinceLastWelcome = await getMsSinceLastWelcome(sanitizedNumber);
                const cooldownExpired = msSinceLastWelcome >= WELCOME_COOLDOWN_MS;

                if (isFreshOpen && !alreadyWelcomedThisProcess && cooldownExpired) {
                    welcomeSentThisProcess.add(sanitizedNumber);
                    await markWelcomeSent(sanitizedNumber);
                    ahmadEvents.emit('connected', sanitizedNumber);
                    // 🚨 BUG FIX (requested by Ahmad): this welcome video/image was
                    // gated behind `if (!existingSession)`, so it only ever fired on
                    // a brand-new pairing — every later reconnect (restart, Katabump
                    // redeploy, network drop + auto-reconnect, etc.) skipped it
                    // entirely, even though nothing else about the connect flow
                    // changed. Now it fires on EVERY real connect/reconnect (but not
                    // on the repeated 'open' noise handled above).
                    // 🎨 Ahmad liked all 4 header styles and wants them to show up
                    // randomly (not always the same one) — a different vibe on
                    // each connect/reconnect, same body content underneath.
                    // 🎛️ Pulls whatever the owner has set via the pair.html hidden
                    // admin panel (welcome text / video / channel link). Falls back
                    // to the original hardcoded defaults if nothing's been set yet,
                    // so this is fully backward-compatible.
                    const siteSettings = await getSiteSettings();
                    const botDisplayName = (siteSettings.botName || 'AHMAD MINI').toUpperCase();
                    const liveHeader = `╭──────────────────────╮\n│  ✦ ${toBoldItalicSerif(botDisplayName)} ✦\n│  ⚡ ${toSansBold('LIVE')}\n╰──────────────────────╯`;

                    // 🎬 REAL live progress animation (requested by Bunty: "Jo
                    // animation wo live ay"): sends one message, then actually
                    // EDITS it a few times with growing progress bars, instead
                    // of just pasting a pre-filled "100%" as static text. If
                    // edit isn't supported for some reason, it fails silently
                    // and the final card below still goes out normally.
                    // 🎨 (Ahmad: "connect successfully msg boring hai, sahi
                    // karo") — bold digits on the % so the progress actually
                    // pops, cleaner Glass Card header matching the new .menu
                    // look instead of the old plain banner block.
                    try {
                        const connectingMsg = await conn.sendMessage(userJid, {
                            text: `${liveHeader}\n\n⏳ ${toSansBold('Connecting...')}\n░░░░░░░░░░ ${toSansBold('0%')}`
                        });
                        const stages = ['███░░░░░░░ 30%', '██████░░░░ 60%', '█████████░ 90%', '██████████ 100%'];
                        for (const stage of stages) {
                            await new Promise(r => setTimeout(r, 450));
                            const [bar, pct] = [stage.slice(0, -4).trim(), stage.slice(-3)];
                            await conn.sendMessage(userJid, {
                                text: `${liveHeader}\n\n⏳ ${toSansBold('Connecting...')}\n${bar} ${toSansBold(pct)}`,
                                edit: connectingMsg.key
                            });
                        }
                        await new Promise(r => setTimeout(r, 350));
                        await conn.sendMessage(userJid, {
                            text: `${liveHeader}\n\n✔ ${toSansBold('Connection Established')}\n✔ ${toSansBold('Bot Status')} : ${toSansBold('ONLINE')}`,
                            edit: connectingMsg.key
                        });
                    } catch (e) {
                        ahmadLog(`Live connect animation failed (non-fatal): ${e.message}`, 'warning');
                    }

                    const channelLine = (siteSettings.channelLink || config.CHANNEL_LINK)
                        ? `\n💎 ${toSansBold('Channel')}\n${siteSettings.channelLink || config.CHANNEL_LINK}\n`
                        : '';
                    const welcomeCaption = `╭──────────────────────╮\n│  📜 ${toSansBold('menu')}   : ${prefix}menu\n│  🔧 ${toSansBold('prefix')}: ${prefix}\n│  🌐 ${toSansBold('mode')}  : ${toSansBold(mode)}\n╰──────────────────────╯\n${channelLine}\n✦ ${toBoldItalicSerif('OBSIDIAN LUXE • AHMAD MINI')} ✦`;
                    // 🎬 send a welcome VIDEO on connect instead of just an image,
                    // if config.WELCOME_VIDEO_PATH is set. Falls back to the image
                    // automatically if no video is configured or if sending it
                    // fails (bad URL, network hiccup, dead catbox link, etc.) so
                    // the connect message never silently disappears.
                    // 🎥 UPDATE (requested by Ahmad, referencing a round "video
                    // note" bubble like WhatsApp's own circular video messages):
                    // `ptv: true` tells WhatsApp to render this as a round,
                    // auto-playing video-note bubble instead of a normal
                    // rectangular video attachment. If the connected WhatsApp
                    // client is old enough not to support it, it just falls back
                    // to rendering a normal video — nothing breaks either way.
                    let sentVideo = false;
                    const welcomeVideoUrl = siteSettings.welcomeVideo || config.WELCOME_VIDEO_PATH;
                    if (welcomeVideoUrl) {
                        try {
                            // 🚨 FIX (Bunty: "overall slow ho gaya, .owner/.menu
                            // jaisa hi masla" — audited every other hardcoded
                            // default-media send in the bot): same root cause
                            // as .menu/.owner — handing Baileys a raw { url }
                            // let IT do the fetch internally with zero retry.
                            // Pre-fetch with one retry first, hand it a Buffer.
                            let vidRes;
                            try {
                                vidRes = await axios.get(welcomeVideoUrl, { responseType: 'arraybuffer', timeout: 10000, family: 4 });
                            } catch (eFirst) {
                                await new Promise((res) => setTimeout(res, 1200));
                                vidRes = await axios.get(welcomeVideoUrl, { responseType: 'arraybuffer', timeout: 10000, family: 4 });
                            }
                            // 🚨 FIX (Bunty: "welcome video Kay sath bhii msg ay ji
                            // pehlay tha") — `ptv: true` round video-notes drop
                            // captions silently in WhatsApp, which is why the
                            // welcome text stopped showing up next to the video.
                            // Send the video note, then the welcome text as its
                            // own message right after.
                            await conn.sendMessage(userJid, {
                                video: Buffer.from(vidRes.data),
                                gifPlayback: false,
                                ptv: true
                            });
                            await conn.sendMessage(userJid, {
                                text: welcomeCaption
                            });
                            sentVideo = true;
                        } catch (e) {
                            ahmadLog(`Welcome video failed, falling back to image: ${e.message}`, 'warning');
                        }
                    }
                    if (!sentVideo) {
                        try {
                            let imgRes;
                            try {
                                imgRes = await axios.get(config.IMAGE_PATH, { responseType: 'arraybuffer', timeout: 8000, family: 4 });
                            } catch (eFirst) {
                                await new Promise((res) => setTimeout(res, 1200));
                                imgRes = await axios.get(config.IMAGE_PATH, { responseType: 'arraybuffer', timeout: 8000, family: 4 });
                            }
                            await conn.sendMessage(userJid, {
                                image: Buffer.from(imgRes.data),
                                caption: welcomeCaption
                            });
                        } catch (e) {
                            ahmadLog(`Welcome image also failed, sending text-only: ${e.message}`, 'warning');
                            await conn.sendMessage(userJid, { text: welcomeCaption });
                        }
                    }
                }
            }
            if (connection === 'close') {
                if (channelWatchers.has(sanitizedNumber)) {
                    clearInterval(channelWatchers.get(sanitizedNumber));
                    channelWatchers.delete(sanitizedNumber);
                }
                if (presenceWatchers.has(sanitizedNumber)) {
                    clearInterval(presenceWatchers.get(sanitizedNumber));
                    presenceWatchers.delete(sanitizedNumber);
                }
                const reason = lastDisconnect && lastDisconnect.error && lastDisconnect.error.output && lastDisconnect.error.output.statusCode;
                if (reason === DisconnectReason.loggedOut) ahmadLog(`Session logged out.`, 'error');
            }
        });


        conn.ev.on('messages.upsert', async (msg) => {
            lastActivityAt.set(sanitizedNumber, Date.now());
            const arrivalTs = Date.now();
            try {
                // 🚨 BUG FIX (old commands "resending" themselves): Baileys emits
                // this event for BOTH brand-new realtime messages (type 'notify')
                // AND for messages replayed during a chat-history re-sync after a
                // reconnect (type 'append'/'prepend'). Without this check, every
                // reconnect (e.g. after any brief disconnect) caused old command
                // messages to be re-fed into the handler below, which re-ran the
                // matching command and re-sent its reply — looking like previously
                // used commands were firing again on their own.
                // 🚨 ROOT-CAUSE FIX: comparing against the original (pre-fix)
                // main.js confirms this whole msg.type-based filter was
                // something I added — it never existed before, and it's the
                // reason ".menu works in groups but not in someone's private
                // chat" started happening. WhatsApp/Baileys tags the SAME kind
                // of message ('notify' vs 'append') inconsistently between
                // group chats and private 1-on-1 chats, so gating on `type` is
                // unreliable. Switched entirely to checking the message's own
                // TIMESTAMP instead: a history-sync replay carries the
                // message's original (old) send time no matter its `type` or
                // chat type, while a message you just sent has a timestamp of
                // right now. This is a more universal signal than `type` and
                // fixes the private-chat regression without reopening the
                // original old-command-replay bug.
                const NOW_SEC = Math.floor(Date.now() / 1000);
                // 🚨 DIAGNOSTIC (Bunty: "public mode, naye banda ki pehli msg
                // pe kuch nahi — console mein bhi kuch nahi") — logs literally
                // every raw message the moment it arrives, before ANY
                // filtering happens. If this line is missing entirely for a
                // failed interaction, the message never reached Baileys/this
                // handler at all (a WhatsApp-side/connection issue, not
                // something in this bot's own filters). If it's present but
                // [DROP-DEBUG] follows, one of the filters below is the cause.
                for (const mm of (msg.messages || [])) {
                    if (config.DEBUG_LOGS) console.log(`[MSG-ARRIVED] from=${mm.key?.remoteJid} fromMe=${mm.key?.fromMe} id=${mm.key?.id} ts=${mm.messageTimestamp}`);
                    // Cache the free, session-independent @lid->real-jid hint
                    // straight off the incoming stanza — see lidAltCache
                    // declaration above for why this matters more than the
                    // signalRepository lookup for FIRST-TIME senders.
                    if (mm.key?.remoteJid?.endsWith('@lid') && mm.key.remoteJidAlt) {
                        lidAltCache.set(mm.key.remoteJid, mm.key.remoteJidAlt);
                    }
                    if (mm.key?.participant?.endsWith('@lid') && mm.key.participantAlt) {
                        lidAltCache.set(mm.key.participant, mm.key.participantAlt);
                    }
                }
                let messagesToProcess = msg.messages.filter(mm => {
                    // 🚨 REAL ROOT CAUSE FOUND (Bunty: ".chnfor/autoreact kabhi
                    // aata, kabhi nahi — koi pattern nahi": posts 1 lands, 2/3/4
                    // silently vanish, then 5 lands): this 60-second freshness
                    // filter exists to stop OLD history-sync replays of normal
                    // chat messages from re-triggering commands — but it was
                    // running for EVERY message including @newsletter (channel)
                    // posts. Channel posts can legitimately arrive a bit late —
                    // reconnect catch-up, WhatsApp-side batching/retry, slow
                    // network — and whenever a post's own timestamp happened to
                    // be >60s old by the time it was actually delivered, it got
                    // silently dropped right here, before autoreact or .chnfor
                    // ever got a chance to see it. That's exactly the "random
                    // missing post" pattern, with zero log trace (this filter
                    // had no logging). Channel/newsletter messages are now
                    // exempt from this freshness check entirely — the
                    // wasAlreadyRelayed/newsletterServerId dedup further below
                    // is what actually protects them from re-processing, so
                    // nothing is lost by letting them all through here.
                    if (mm.key && mm.key.remoteJid && mm.key.remoteJid.endsWith('@newsletter')) return true;
                    const rawTs = mm.messageTimestamp;
                    const ts = (rawTs && typeof rawTs === 'object' && typeof rawTs.toNumber === 'function')
                        ? rawTs.toNumber()
                        : Number(rawTs || 0);
                    if (!ts) return true; // no timestamp info at all — don't block, let it through
                    // 🚨 CRASH-SURVIVAL FIX: skip anything already handled
                    // before a previous crash — see BOOT_MARK_DIR comment
                    // above. `savedMark` is loaded once at connect and only
                    // ever moves forward, so this can't accidentally block
                    // genuinely new messages.
                    const savedMark = bootMarkTs.get(sanitizedNumber) || 0;
                    // 🚨 ROOT CAUSE FOUND (Bunty log: "msgTs=1785402672,
                    // savedMark=1785402672" — EXACTLY equal, not older):
                    // WhatsApp message timestamps are second-precision, not
                    // millisecond. Any two genuinely different messages
                    // arriving within the same second share the same
                    // timestamp — and since savedMark gets updated to the
                    // timestamp of literally every message right after it's
                    // processed, the very next fast-following message
                    // (extremely common in normal back-to-back chatting, not
                    // some rare edge case) would share that exact same-
                    // second timestamp and get silently dropped by the old
                    // `<=` comparison, treating a brand new message as
                    // already-handled just because it landed in the same
                    // second. Changed to strict `<` — only messages
                    // STRICTLY OLDER than the saved mark get skipped now.
                    if (ts < savedMark) {
                        if (config.DEBUG_LOGS) console.log(`[DROP-DEBUG] bootMark filter dropped a message from ${mm.key?.remoteJid} — msgTs=${ts}, savedMark=${savedMark}`);
                        return false;
                    }
                    const age = NOW_SEC - ts;
                    // 🚨 WIDENED (Bunty: "kisi ki chat mein random silent ho
                    // jata hai, kisi ko bhi, koi pattern nahi") — 60s was too
                    // tight for a real-world edge case: if the bot's socket
                    // hiccups/reconnects for even a few seconds (normal, not
                    // an error) and WhatsApp then delivers a small backlog on
                    // reconnect, any message that happened to sit for 60s+
                    // before delivery got silently dropped here — indistin-
                    // guishable from history-sync spam to this filter, but
                    // very much a real message the sender is waiting on.
                    // Matches "random, anyone, no pattern, totally silent"
                    // exactly. 120s gives real (delayed-but-genuine) messages
                    // more room while still catching actual history-sync
                    // replays, which are usually far older than either
                    // threshold anyway.
                    if (age >= 120) {
                        if (config.DEBUG_LOGS) console.log(`[DROP-DEBUG] freshness filter dropped a message from ${mm.key?.remoteJid} — ${age}s old (msgTs=${ts}, now=${NOW_SEC})`);
                        return false;
                    }
                    return true;
                });
                if (messagesToProcess.length === 0) return;
                for (const mm of messagesToProcess) {
                    const rawTs2 = mm.messageTimestamp;
                    const ts2 = (rawTs2 && typeof rawTs2 === 'object' && typeof rawTs2.toNumber === 'function') ? rawTs2.toNumber() : Number(rawTs2 || 0);
                    // Fire-and-forget on purpose: awaiting this inline would
                    // add a real network round-trip to Mongo in front of
                    // EVERY reply whenever the 1s throttle window opens,
                    // which directly fights the "speed better karo" ask.
                    // .catch() keeps it from ever becoming an unhandled
                    // rejection; the tiny window where a crash could land
                    // in the same instant as an in-flight write is an
                    // acceptable trade for not slowing down every command.
                    if (ts2) saveBootMark(sanitizedNumber, ts2).catch(e => ahmadLog(`BootMark save error: ${e.message}`, 'error'));
                }

                // 🚨 GAP FIX (Bunty: "cmd phir bhi dobara aa jati", deep dive):
                // wasAlreadyProcessed() used to only ever get checked against
                // `mek` (messages[0]) further below — every OTHER message in
                // a multi-message batch (antidelete/antiedit/antiviewonce all
                // loop over the FULL messagesToProcess array) had zero
                // ID-based duplicate protection at all. Filtering the whole
                // batch here means every downstream consumer gets the same
                // protection, not just the single command-dispatch path.
                const preFilterLen = messagesToProcess.length;
                messagesToProcess = messagesToProcess.filter(mm => {
                    if (mm.key && mm.key.remoteJid && mm.key.remoteJid.endsWith('@newsletter')) return true; // newsletters use their own dedup (newsletterServerId), not this
                    return !wasAlreadyProcessed(sanitizedNumber, mm.key && mm.key.id);
                });
                if (messagesToProcess.length === 0) return;

                // 🔍 PERF DEBUG (Ahmad: ".ping shows 1700ms processing, network
                // is only 6ms" — everything upstream of dispatch is fast on
                // paper, so this logs REAL elapsed time at each stage for the
                // very next command, to see exactly where the time actually
                // goes on your host instead of guessing).
                const __perf = [];
                const __mark = (label) => __perf.push(`${label}=${Date.now() - arrivalTs}ms`);
                __mark('dedupFilterDone');

                // Antidelete: modern WhatsApp usually reports "Delete for Everyone"
                // as a NEW message here (protocolMessage), not via messages.update.
                // 🚀 SPEED FIX (Bunty: "Usman se bhi fast karo"): these three
                // checks are fully independent of each other (antidelete
                // doesn't need antiedit's result, etc.) but were being
                // awaited one-after-another — three sequential round-trips
                // of latency on EVERY single message, before the command
                // handler even runs. Running them together with Promise.all
                // means the total wait is whichever ONE of them is slowest,
                // not the sum of all three — real time saved on every
                // message, not just commands.
                await Promise.all([
                    handleAntideleteUpsert(conn, messagesToProcess, ahmadStore),
                    handleAntieditUpsert(conn, messagesToProcess, ahmadStore),
                    Promise.all(messagesToProcess.map(upsertMek => handleAntiViewOnce(conn, upsertMek)))
                ]);
                __mark('antideleteEditViewOnceDone');

                // 🚨 ROOT-CAUSE FIX (Bunty: "console mein [CMD-DEBUG] tak
                // nahi aati, bilkul kuch nahi hota" — traced with the temp
                // diagnostic log): this used to grab ONLY messagesToProcess[0]
                // and bail out completely if IT had no decrypted content —
                // even when a LATER entry in the exact same batch had real,
                // decryptable content (e.g. WhatsApp resending/retrying a
                // message to a brand-new @lid contact while a Signal session
                // is still being established: the first attempt(s) in the
                // batch can arrive with empty content while a later one in
                // the SAME batch decrypts fine). Bailing on [0] alone threw
                // away every command that happened to land anywhere but the
                // very first slot — with zero logging, so it looked like the
                // message vanished entirely. Now: pick the first entry in the
                // batch that actually HAS decrypted content, falling back to
                // [0] (old behavior) only if literally none of them do —
                // logging that case so a genuine full-batch decrypt failure
                // is visible instead of silent.
                let mek = messagesToProcess.find(mm => mm.message) || messagesToProcess[0];
                if (!mek.message) {
                    console.log(`[DECRYPT-DEBUG] entire batch had no decrypted content — from=${mek.key?.remoteJid} fromMe=${mek.key?.fromMe} id=${mek.key?.id} batchSize=${messagesToProcess.length}`);
                    return;
                }
                // Self-bot: fromMe messages ARE owner commands, do not skip them

                // 🚨 BUG FIX (Ahmad: ".chnfor ek chhod kar ek forward karta
                // hai" — the "skip one, forward one" pattern): this generic
                // check is keyed on mek.key.id, which is fine for normal
                // chat messages but is NOT a reliable identity for
                // newsletter/channel posts (see the wasAlreadyRelayed
                // comment above — Baileys can redeliver/resend channel
                // posts with inconsistent key.id values). Channel messages
                // were hitting THIS generic check first and getting
                // silently dropped before ever reaching .chnfor's own,
                // correctly-keyed (newsletterServerId) relay dedup further
                // down — exactly every-other post, depending on how key.id
                // happened to collide. Newsletter chats now skip this
                // generic check entirely and rely solely on
                // wasAlreadyRelayed, which is the dedup actually built for them.
                // 🚨 De-duped at the batch level already (see the
                // messagesToProcess.filter(wasAlreadyProcessed...) block
                // above) — mek is messages[0] AFTER that filter ran, so it's
                // already confirmed new. Checking wasAlreadyProcessed again
                // here would incorrectly find it "already seen" (that same
                // call marks-as-seen too) and silently drop every command.
                const isNewsletterChat = mek.key && mek.key.remoteJid && mek.key.remoteJid.endsWith('@newsletter');

                // 🚀 PERFORMANCE OPTIMIZATION: Config is already fetched/cached in database.js
                const userConfig = await getUserConfigFromMongoDB(sanitizedNumber);
                __mark('userConfigDone');

                const outerType = getContentType(mek.message);
                if (outerType === 'ephemeralMessage') {
                    mek.message = mek.message.ephemeralMessage.message;
                } else if (outerType === 'viewOnceMessage' || outerType === 'viewOnceMessageV2' || outerType === 'viewOnceMessageV2Extension') {
                    mek.message = mek.message[outerType].message;
                }

                if (userConfig.READ_MESSAGE === 'true') conn.readMessages([mek.key]).catch(() => {});

                // Newsletter reactions + Channel auto-relay (.chnfor)
                // 🚨 REAL BUG FOUND (Ahmad: "chnfor mein kuch atta kuch nahi,
                // exact nahi ata" — screenshots showed 7 posts sent to source,
                // only every-other one landing in target): every check in
                // this section used to read only `mek`, which is
                // `messagesToProcess[0]` — i.e. just the FIRST message of
                // whatever `messages.upsert` delivered. WhatsApp frequently
                // batches multiple channel posts (or a post + a reaction on
                // it) into ONE upsert event with several entries in
                // `msg.messages` — so messages at index 1, 2, 3... were never
                // even looked at, let alone relayed. That's the actual
                // "skip one, forward one" pattern — not a dedup issue (the
                // wasAlreadyRelayed/newsletterServerId dedup below is still
                // correct and kept as-is). Fix: loop over EVERY message in
                // messagesToProcess for both the reaction and the relay,
                // instead of only the first.
                // 🚨 FEATURE (Ahmad: "jo log connect hein bot se, channel auto
                // follow to hein lakin ab yeh ho post auto react bhi ho, jo
                // jo paired hein" — every paired number should get auto-react
                // on the channel(s) THEY auto-follow, not just one hardcoded
                // channel): this used to react only to ONE fixed JID
                // (Ahmad's own channel), so every other paired user's bot
                // instance silently never reacted to anything. Now it reacts
                // to whichever channel(s) THIS number auto-follows — the
                // exact same list ensureChannelFollowed() above already
                // follows (config.AUTO_FOLLOW_JIDS, falling back to
                // config.CHANNEL_JID) — so auto-follow and auto-react always
                // cover the same channels for every user, automatically.
                // 🚚 NOTE: channel auto-REACT used to live here, looping over
                // messagesToProcess — it has moved to a dedicated, standalone
                // conn.ev.on('messages.upsert', ...) listener registered right
                // after connection (see "SPEED + RELIABILITY FIX" comment near
                // makeWASocket() above), so reactions fire instantly instead of
                // waiting behind dedup/antidelete/antiedit/antiviewonce/userConfig.
                // This block now only handles .chnfor relay, using the SAME
                // messagesToProcess loop (still needed here since relay can
                // forward text/image/video/audio and that logic depends on
                // context already set up in this handler).
                for (const nlMek of messagesToProcess) {
                    if (!nlMek.key || !nlMek.key.remoteJid || !nlMek.key.remoteJid.endsWith('@newsletter')) continue;

                    // 🆕 Channel auto-relay (.chnfor) — Bunty: "ek baar set karo,
                    // jab bhi source channel me post ho, auto target channel me
                    // chali jaye". Every incoming channel post is checked against
                    // saved relay mappings; if this source has one+ targets, the
                    // exact same content (text/image/video/audio) is copied over.
                    try {
                        const targets = (await getRelayTargets(nlMek.key.remoteJid)).filter(t => t !== nlMek.key.remoteJid);
                        if (targets.length) {
                            const nlContent = (getContentType(nlMek.message) === 'ephemeralMessage')
                                ? nlMek.message.ephemeralMessage.message
                                : (nlMek.message || {});
                            const dl = async (msgContent, mediaType) => {
                                const stream = await downloadContentFromMessage(msgContent, mediaType);
                                let buffer = Buffer.from([]);
                                for await (const chunk of stream) {
                                    buffer = Buffer.concat([buffer, chunk]);
                                    // 🚨 CRASH FIX: this runs automatically on every
                                    // channel post (not gated to a user command), so an
                                    // unbounded download here is the highest-risk spot for
                                    // an OOM crash — a single large channel video could
                                    // take down the whole bot with zero user action.
                                    if (buffer.length > 60 * 1024 * 1024) throw new Error('relay media too large (over 60MB)');
                                }
                                return buffer;
                            };
                            let payload = null;
                            if (nlContent.imageMessage) {
                                payload = { image: await dl(nlContent.imageMessage, 'image'), caption: nlContent.imageMessage.caption || undefined };
                            } else if (nlContent.videoMessage) {
                                payload = { video: await dl(nlContent.videoMessage, 'video'), caption: nlContent.videoMessage.caption || undefined };
                            } else if (nlContent.audioMessage) {
                                payload = { audio: await dl(nlContent.audioMessage, 'audio'), mimetype: 'audio/mp4' };
                            } else if (nlContent.extendedTextMessage?.text || nlContent.conversation) {
                                payload = { text: nlContent.extendedTextMessage?.text || nlContent.conversation };
                            }
                            // 🚨 BUG FIX (Ahmad: ".chnfor — post 1 goes, post 2
                            // doesn't, post 3 goes..."): the dedup check used
                            // to run BEFORE we knew whether this event even
                            // had real content. A reaction on a channel post
                            // (someone tapping an emoji) fires its own
                            // messages.upsert with the SAME newsletterServerId
                            // as the original post but NO actual content —
                            // if that reaction event happened to arrive
                            // before the real post's content event, it
                            // consumed the dedup slot first, so when the
                            // real post arrived moments later it looked like
                            // an "already relayed duplicate" and got
                            // silently skipped. Now the dedup is only
                            // checked/marked once we've confirmed there's a
                            // real payload to send, so a contentless
                            // reaction event can no longer block the actual post.
                            if (!payload) {
                                console.log(`[CHNFOR] no relayable content on ${nlMek.key.remoteJid} (serverId=${nlMek.newsletterServerId}) — likely a reaction/stub event, not a post. Skipped without consuming dedup.`);
                            } else if (wasAlreadyRelayed(nlMek.key.remoteJid, nlMek.newsletterServerId)) {
                                console.log(`[CHNFOR] serverId=${nlMek.newsletterServerId} on ${nlMek.key.remoteJid} already relayed — skipping duplicate.`);
                            } else {
                                console.log(`[CHNFOR] relaying serverId=${nlMek.newsletterServerId} from ${nlMek.key.remoteJid} to ${targets.length} target(s).`);
                                for (const targetJid of targets) {
                                    await conn.sendMessage(targetJid, payload).catch(e => {
                                        console.log(`[CHNFOR] relay to ${targetJid} failed:`, e.message);
                                    });
                                    // 🚨 ANTI-BAN FIX (Ahmad: "bot spamming na kare, users ka
                                    // number ban na ho") — relaying to multiple targets used to
                                    // fire sendMessage back-to-back with zero pacing, which is
                                    // exactly the burst pattern WhatsApp's spam detection flags.
                                    // Now .chnfor is open to every user too, so the number of
                                    // relay mappings hitting the bot's own WhatsApp number at
                                    // once can grow — a small randomized delay between each
                                    // target keeps sends looking human-paced instead of
                                    // machine-gunned.
                                    if (targets.length > 1) {
                                        await new Promise(r => setTimeout(r, 1200 + Math.floor(Math.random() * 800)));
                                    }
                                }
                            }
                        }
                    } catch (e) {
                        console.log('[CHNFOR] relay error:', e.message);
                    }
                }

                // Status handling
                if (mek.key && mek.key.remoteJid === 'status@broadcast') {
                    if (userConfig.AUTO_VIEW_STATUS === 'true') await conn.readMessages([mek.key]);
                    if (userConfig.AUTO_LIKE_STATUS === 'true') {
                        const botJid = await conn.decodeJid(conn.user.id);
                        const emojis = userConfig.AUTO_LIKE_EMOJI || config.AUTO_LIKE_EMOJI;
                        const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                        await conn.sendMessage(mek.key.remoteJid, { react: { text: randomEmoji, key: mek.key } }, { statusJidList: [mek.key.participant, botJid] });
                    }
                    if (userConfig.AUTO_STATUS_REPLY === 'true') {
                        const user = mek.key.participant;
                        await conn.sendMessage(user, { text: userConfig.AUTO_STATUS_MSG || config.AUTO_STATUS_MSG }, { quoted: mek });
                    }
                    return;
                }

                const m = sms(conn, mek);
                const type = getContentType(mek.message);
                const from = mek.key.remoteJid;
                const body = m.body || '';

                // 🆕 (Bunty: ".setprefix owner se hatao, har chat apna prefix
                // rakh sakay, no overall") — a chat's own prefix (set via
                // .setprefix, no owner check) wins if it has one; otherwise
                // falls back to the bot-wide default (.setprefixall,
                // owner-only, same config.PREFIX mechanism as before).
                // getCachedChatPrefix() is a synchronous Map read — costs
                // nothing extra on the hot path for the many chats that
                // never touch this.
                const chatPrefixOverride = getCachedChatPrefix(sanitizedNumber, from);
                const activePrefix = chatPrefixOverride || config.PREFIX;

                const isCmd = body.startsWith(activePrefix);
                const command = isCmd ? body.slice(activePrefix.length).trim().split(' ').shift().toLowerCase() : '';
                const args = body.trim().split(/ +/).slice(1);
                const q = args.join(' ');
                const text = q;
                const isGroup = from.endsWith('@g.us');

                // AUTO_REACT for normal chats (DM/group/personal) — controlled
                // by the user's .autoreact on/off toggle. This is SEPARATE
                // from channel/newsletter autoreact, which is its own
                // dedicated listener registered right after connection above
                // and is always on regardless of this toggle. Fire-and-forget
                // (not awaited) so it never adds latency to command replies,
                // and cooldown-limited per chat so it doesn't hammer WhatsApp
                // with a reaction on every single message (which is what was
                // causing throttling/slowdowns before).
                if (userConfig.AUTO_REACT === 'true' && !isCmd) {
                    const reactKey = `${conn.user.id}:${from}`;
                    const nowReact = Date.now();
                    const lastReact = lastReactAt.get(reactKey) || 0;
                    if (nowReact - lastReact >= 5000) {
                        lastReactAt.set(reactKey, nowReact);
                        const reactEmojis = ['❤️', '🔥', '😂', '👍', '😮', '🙏', '💯', '✨', '⚡', '💫'];
                        const randomReact = reactEmojis[Math.floor(Math.random() * reactEmojis.length)];
                        conn.sendMessage(from, { react: { text: randomReact, key: mek.key } })
                            .catch((e) => console.log('[AUTOREACT ERROR]', e.message));
                    }
                }

                // ✅ FIX: previously the code passed `quoted: mek` to every command,
                // which is the CURRENT incoming message, not the message being
                // replied to. That made `quoted.sender` resolve to the command
                // sender himself (so .kick removed the admin who typed it instead
                // of the replied person), and `quoted.key` point at the .del
                // command message itself (so .del deleted the wrong message).
                // Also `mentionedJid` was never provided at all, so @mention-based
                // targeting silently did nothing everywhere it was used.
                const mentionedJid = m.msg?.contextInfo?.mentionedJid || [];
                let quotedMsg = null;
                if (m.quoted && m.quoted.message) {
                    // 🚨 ROOT-CAUSE FIX (Bunty: ".setbotdp — 'Reply to an image'
                    // even though it genuinely IS an image"): the main incoming
                    // message already gets its ephemeralMessage wrapper peeled
                    // off (see the ephemeralMessage unwrap above), but the
                    // QUOTED message never did — so an image replied-to from a
                    // disappearing-messages chat, or sent as "view once", had
                    // its real content sitting one level deeper
                    // (ephemeralMessage.message.imageMessage /
                    // viewOnceMessage(V2).message.imageMessage). getContentType
                    // would then return "ephemeralMessage"/"viewOnceMessage"
                    // instead of "imageMessage", so every command checking
                    // m.quoted.mtype === 'imageMessage' (.setbotdp, .toimg,
                    // .sticker, .setbotaudio, etc.) failed on perfectly valid
                    // media. Unwrap the same way here before detecting the type.
                    let quotedContent = m.quoted.message;
                    const outerType = getContentType(quotedContent);
                    if (outerType === 'ephemeralMessage') {
                        quotedContent = quotedContent.ephemeralMessage.message;
                    } else if (outerType === 'viewOnceMessage' || outerType === 'viewOnceMessageV2' || outerType === 'viewOnceMessageV2Extension') {
                        quotedContent = quotedContent[outerType].message;
                    }
                    const qMsgType = getContentType(quotedContent);
                    quotedMsg = {
                        key: {
                            remoteJid: from,
                            id: m.quoted.stanzaId,
                            participant: m.quoted.participant,
                            fromMe: m.quoted.participant ? m.quoted.participant.split('@')[0] === conn.user.id.split(':')[0] : false
                        },
                        stanzaId: m.quoted.stanzaId,
                        message: quotedContent,
                        sender: m.quoted.participant,
                        mtype: qMsgType,
                        text: quotedContent?.conversation
                            || quotedContent?.extendedTextMessage?.text
                            || quotedContent?.imageMessage?.caption
                            || quotedContent?.videoMessage?.caption
                            || '',
                        download: async () => {
                            const content = quotedContent[qMsgType];
                            const mediaTypeMap = { imageMessage: 'image', videoMessage: 'video', audioMessage: 'audio', stickerMessage: 'sticker' };
                            const stream = await downloadContentFromMessage(content, mediaTypeMap[qMsgType] || 'image');
                            let buffer = Buffer.from([]);
                            for await (const chunk of stream) {
                                buffer = Buffer.concat([buffer, chunk]);
                                // 🚨 CRASH FIX: this shared download() helper is used by
                                // many media commands (.sticker, .toimg, etc.) — no size
                                // cap meant a large replied-to video could OOM-crash the
                                // whole bot process on a memory-constrained host.
                                if (buffer.length > 60 * 1024 * 1024) throw new Error('File too large (over 60MB).');
                            }
                            return buffer;
                        }
                    };
                    // keep m.quoted in sync so plugins reading m.quoted directly also benefit
                    m.quoted = quotedMsg;
                }

                let sender;
                if (mek.key.fromMe) {
                    // 🚨 ROOT-CAUSE FIX (Bunty: ".setbotname/.clear ka '✅
                    // success' aata hai but .menu purana hi dikhata hai"):
                    // this used to re-derive sender from conn.user.id
                    // ("123:45@lid".split(':')[0] + '@s.whatsapp.net'),
                    // which on newer WhatsApp accounts can resolve to a
                    // @lid-style id INSTEAD of the real phone number —
                    // producing a sender value that silently doesn't match
                    // the one every other read path uses. That meant a
                    // .setbotname you ran on yourself could save under one
                    // identity while .menu read from another — save
                    // succeeds, .menu still shows old. sanitizedNumber is
                    // already the verified-correct real phone number (see
                    // botNumber below) — reuse it here instead of
                    // re-deriving anything from conn.user.id.
                    sender = sanitizedNumber + '@s.whatsapp.net';
                } else if (mek.key.participant) {
                    // 🚨 CRITICAL FIX (Bunty: "mera dost setbotdp kare ya main
                    // karoon, ek hi chat mein dusre ki bhi change ho jati hai"):
                    // mek.key.participant can come through as a @lid-style id
                    // instead of the real @s.whatsapp.net phone-number jid on
                    // newer WhatsApp accounts (same root issue as the fromMe
                    // fix above and the botNumber fix below). Two different
                    // real people whose participant values happened to
                    // normalize inconsistently could end up reading/writing
                    // per-user settings (.setbotdp/.setbotname/.clear, etc.)
                    // under a key that collided with someone else's. Always
                    // run it through jidNormalizedUser so it's consistently
                    // resolved the same way everywhere else in this file uses it.
                    sender = jidNormalizedUser(mek.key.participant) || mek.key.participant;
                } else if (isGroup) {
                    // 🚨 CRITICAL FIX (Bunty: "mera dost .menustyle badle to
                    // mera bhi badal jata hai" — real per-user data leak):
                    // this used to fall back to mek.key.remoteJid, which in a
                    // GROUP is the GROUP's own jid, not any person. Whenever
                    // Baileys omitted `participant` (a real, if uncommon,
                    // occurrence on some newer WhatsApp accounts), every
                    // affected user in that group collapsed to the exact
                    // same `sender` value — so per-user settings
                    // (.menustyle, .antidelete, .setbotname, etc, all keyed
                    // by sender) would silently overwrite between different
                    // real people. Never collapse to the group's own jid —
                    // fall back to something that can't collide between two
                    // different people instead, and log it so this rare
                    // case is visible if it keeps happening.
                    ahmadLog(`sender fallback: mek.key.participant missing in group ${from} (msg id ${mek.key.id})`, 'error');
                    sender = `${mek.key.remoteJid}_unknown_${mek.pushName || mek.key.id || Date.now()}`;
                } else {
                    // DM: remoteJid genuinely IS the other person's own jid here — correct as-is.
                    sender = mek.key.remoteJid;
                }
                const senderNumber = sender.split('@')[0];
                // 🚨 ROOT-CAUSE FIX (".autoreact on" / most settings toggles
                // "not working"): botNumber used to be parsed straight out of
                // conn.user.id ("123:45@lid".split(':')[0] etc). On newer
                // WhatsApp multi-device accounts conn.user.id can resolve to
                // a @lid-style identifier instead of the real phone number,
                // so `.autoreact on` (and any other .set* command) was
                // saving the setting under a DIFFERENT record than the one
                // main.js reads from every message (which always uses
                // sanitizedNumber — the real phone number from pairing).
                // The write silently succeeded, the read silently missed it.
                // Using sanitizedNumber for both closes that gap.
                const botNumber = sanitizedNumber;
                const botNumber2 = await jidNormalizedUser(conn.user.id);
                const pushname = mek.pushName || 'User';

                const isMe = botNumber === senderNumber;
                // 🆕 (Bunty: "agar dono paired to?" — two paired numbers as
                // members of the SAME group): every paired number that's a
                // member of a group receives and processes that group's
                // messages independently through its OWN socket. So if
                // paired-user A runs `.antidelete on` in a shared group,
                // A's OWN session correctly handles it (isMe=true there) —
                // but paired-user B's session ALSO sees that same message,
                // and from B's session's point of view A is neither owner
                // nor isMe, so B's bot used to reply "❌ Owner only (group)"
                // right after A's own bot said "✅ ON" — a confusing,
                // wrong-looking denial for a command that was never aimed
                // at B's bot at all. `isPairedElsewhere` is true when the
                // sender is themselves a currently-active paired number
                // (checked via activeSockets, not any hardcoded number) —
                // used by owner/isMe-gated settings to STAY SILENT instead
                // of denying, since a genuinely unauthorized/random member
                // (not in activeSockets at all) still gets the normal
                // "Owner only" denial as before.
                const isPairedElsewhere = activeSockets.has(senderNumber);

                // 🆕 FEATURE (.kickinactive): fire-and-forget, throttled internally
                // (see data/GroupActivity.js) — never awaited, so it can never add
                // latency to message processing.
                if (isGroup) recordActivity(from, sender);

                // 🚨 FIX (Bunty: "auto recover hamari taraf se sirf bot
                // user [owner] ko jaye, kisi aur ko nahi"): this used to
                // trigger for ANY user's reply to a view-once — meaning a
                // random group member replying to someone else's
                // view-once got it auto-delivered to THEIR OWN dm too.
                // Moved below (after isOwner is resolved) and gated to
                // owner-only — see the isOwner-gated call further down.

                // ✅ OWNER CHECK — uses config.OWNER_NUMBER ONLY (settable, no
                // code edit needed).
                // 🚨 SECURITY FIX (Ahmad: "owner zone cmd only +923044975027
                // ho, koi aur nahi — abhi har koi use kar leta hai"): this
                // used to ALSO grant owner if `senderNumber === botNumber`
                // (i.e. "you're messaging the number the bot is paired
                // with"). That was meant to cover self-bot setups, but it
                // silently meant ANYONE who pairs/deploys their own copy of
                // this bot with their OWN number automatically becomes owner
                // of their own instance — bypassing config.OWNER_NUMBER
                // entirely, since for them senderNumber === botNumber is
                // always true. That's exactly why owner-only commands
                // (.eval, .broadcast, .exec, etc.) worked for people who
                // aren't +923044975027. Owner access is now locked to
                // config.OWNER_NUMBER only, no matter who paired the bot.
                // (Older bug this replaced: senderNumber used to be compared
                // against a hardcoded placeholder "923043975027" instead of
                // the real configured owner, which broke owner access for
                // the actual owner too — config.OWNER_NUMBER is still the
                // single source of truth here.)
                const ownerNumbers = (Array.isArray(config.OWNER_NUMBER)
                    ? config.OWNER_NUMBER
                    : [config.OWNER_NUMBER]
                ).map(n => String(n).replace(/[^0-9]/g, '').trim()).filter(Boolean);
                const isOwner = ownerNumbers.includes(senderNumber)
                    || (sender.endsWith('@lid') && await resolveIsOwner(conn, sender, ownerNumbers))
                    // 🆕 (Bunty: "sudo/listsudo/delsudo add karo") — sudo is
                    // a deliberate, explicit opt-in delegation BY the real
                    // owner (only isOwner/isMe can grant it — see .sudo
                    // command), not a default-broadened permission, so
                    // folding it into isOwner here is intentional and safe:
                    // it only ever contains numbers the owner personally
                    // chose to trust.
                    || await isSudo(botNumber, senderNumber);
                const isCreator = isOwner;

                // 🚨 ACCOUNT-SAFETY FIX (Bunty: "account restricted ho gaya,
                // meri taraf se randomly kisi ki DM mein view-once chala
                // gaya" — screenshot showed WhatsApp restricting the number
                // after it auto-messaged a contact it had never DM'd
                // before): this used to fire for ANY user who replied to a
                // view-once, ANYWHERE — including a total stranger in a
                // group the bot was never in a DM with. Auto-starting a
                // brand-new chat with a stranger to drop media in it is
                // exactly the kind of unsolicited-messaging pattern
                // WhatsApp's spam detection flags accounts for. Now this
                // only ever fires for the bot owner or the paired-number's
                // own user (isOwner || isMe) — the two people who
                // legitimately have an existing relationship with this bot
                // number — so it never opens a new chat with a stranger.
                // Random group members replying to a view-once now get
                // nothing auto-sent to them at all.
                // 🚨 REFINED (Bunty: "jo paired hoga usko usi ki chat mein
                // hi aaye, meri taraf se nahi — GC mein chahe admin hi ho,
                // koi reply kare to khud na ho, sirf jo paired hai uski
                // apni chat mein"): dropped the isOwner bypass here too —
                // this now fires ONLY for isMe (the number this specific
                // session is actually paired to). The global owner number
                // no longer auto-triggers this in a paired session's group
                // just by being present/admin there; it's strictly the
                // paired user's own reply, into their own chat, nobody
                // else at all (admin or not).
                if (quotedMsg && isMe) {
                    autoRecoverOnReply(conn, quotedMsg, sender, from, botNumber).catch(e => console.log('[AUTO-VV-REPLY]', e.message));
                }

                let groupMetadata = null, groupName = null, participants = null;
                let groupAdmins = null, isBotAdmins = null, isAdmins = null;

                // 🚨 SPEED FIX (the "50ms vs 1-3ms" gap): groupMetadata() and
                // resolveIsAdmin() are real network round-trips to WhatsApp's
                // servers. This used to run them on EVERY single group message
                // — including plain chatting with no command — before the
                // handler could even decide whether there was anything to do.
                // That's the biggest source of added latency in the whole
                // pipeline. Now it only runs when the result is actually
                // needed: for commands (permission checks) or messages that
                // might contain a link (antilink check below needs isAdmins/
                // isBotAdmins). Ordinary group chatter skips both network
                // calls entirely and falls straight through.
                const linkPattern = /(chat\.whatsapp\.com|wa\.me|t\.me|https?:\/\/|www\.[a-z0-9-]+\.[a-z]{2,}|\b[a-z0-9-]+\.(com|net|org|io|me|link|xyz|info|co)\b)/i;
                const mightBeLink = linkPattern.test(body);

                // 🚨 FEATURE (requested by Ahmad — .slowmode/.nightmode/
                // .lockmedia/.addbadword in plugins/group-extra.js): those
                // checks need real isAdmins/isBotAdmins too, on EVERY plain
                // group message — not just commands or link-looking text.
                // A per-group cache (lib/group-extra-cache.js) avoids paying
                // for a local settings lookup on every message: only the
                // FIRST message after a restart (or after a setting change)
                // re-reads it, everything after reuses the cached boolean.
                const groupExtraCache = require('./lib/group-extra-cache');
                let groupExtraActive = false;
                if (isGroup) {
                    groupExtraActive = groupExtraCache.get(from);
                    if (groupExtraActive === null) {
                        try {
                            const { getGroupSettings } = require('./data/GroupSettings');
                            const gx0 = await getGroupSettings(from);
                            groupExtraActive = !!(gx0.slowmodeSec > 0 || gx0.nightMode || gx0.mediaLock || (gx0.badwords && gx0.badwords.length) || gx0.groupEmoji || gx0.antiflood || gx0.antitag || gx0.antisticker || gx0.anticontact || gx0.antiforward);
                        } catch (_) { groupExtraActive = false; }
                        groupExtraCache.set(from, groupExtraActive);
                    }
                }

                if (isGroup && (isCmd || mightBeLink || groupExtraActive)) {
                    try {
                        // 🚨 REAL FIX (Ahmad: "group me command lagane pe bot
                        // late reply deta hai, doosra bot pehle jawab de
                        // deta hai"): conn.groupMetadata(from) is a real
                        // network round-trip to WhatsApp's servers, and this
                        // ran it fresh on EVERY single command in a group —
                        // no caching at all. Group name/participants/admins
                        // rarely change within a short window, so there's no
                        // need to pay that network cost every time. Cached
                        // with a 45s TTL + background refresh (identical
                        // pattern to the userConfig cache above): the first
                        // command after a restart or after the cache expires
                        // still gets fresh data, but every command in
                        // between reuses the in-memory copy instantly —
                        // this is what actually closes the "another bot
                        // replies first" gap.
                        const cached = groupMetadataCache.get(from);
                        const GROUP_META_TTL_MS = 45000;
                        if (cached && (Date.now() - cached.ts) < GROUP_META_TTL_MS) {
                            groupMetadata = cached.data;
                        } else if (cached) {
                            groupMetadata = cached.data; // serve stale immediately
                            if (!groupMetadataRefreshing.has(from)) {
                                groupMetadataRefreshing.add(from);
                                conn.groupMetadata(from)
                                    .then(fresh => groupMetadataCache.set(from, { data: fresh, ts: Date.now() }))
                                    .catch(() => {})
                                    .finally(() => groupMetadataRefreshing.delete(from));
                            }
                        } else {
                            groupMetadata = await conn.groupMetadata(from);
                            groupMetadataCache.set(from, { data: groupMetadata, ts: Date.now() });
                        }
                        groupName = groupMetadata.subject;
                        participants = groupMetadata.participants;
                        groupAdmins = getGroupAdmins(participants);
                        groupAdminsSnapshot.set(from, new Set(groupAdmins));
                        // 🚀 SPEED FIX (Ahmad: "gc may boht slow chalta, rocket speed chahiye"):
                        // these two resolveIsAdmin() calls were awaited one after another —
                        // run them together instead, so a group message pays for the slower
                        // of the two, not the sum of both.
                        [isBotAdmins, isAdmins] = await Promise.all([
                            resolveIsAdmin(conn, botNumber2, groupAdmins),
                            resolveIsAdmin(conn, sender, groupAdmins)
                        ]);
                    } catch (_) {}
                }

                // 🚨 SPEED FIX (Ahmad: "speed increase karo") — these were
                // `await`ed, so every single message (even a plain command
                // with no need for a typing indicator) blocked on a real
                // network round-trip to WhatsApp before the bot could go on
                // to actually handle it. Fire-and-forget instead — the
                // indicator doesn't need to finish before processing continues.
                if (userConfig.AUTO_TYPING === 'true') conn.sendPresenceUpdate('composing', from).catch(() => {});
                if (userConfig.AUTO_RECORDING === 'true') conn.sendPresenceUpdate('recording', from).catch(() => {});
                // (AUTO_REACT now fires earlier, right after isCmd is known — see above)

                // 🚀 SPEED FIX: antilink and the slowmode/nightmode/badword
                // checks below both used to call getGroupSettings(from)
                // separately for the SAME message — fetch once, reuse for both.
                let sharedGroupSettings = null;
                if (isGroup && !isAdmins && !isOwner && body) {
                    try {
                        const { getGroupSettings } = require('./data/GroupSettings');
                        sharedGroupSettings = await getGroupSettings(from);
                        const gSettings = sharedGroupSettings;
                        const linkFound = linkPattern.test(body);
                        if (gSettings.antilink && linkFound) {
                            const action = gSettings.antilinkAction || 'delete';
                            const canAct = isBotAdmins;
                            if (config.DEBUG_LOGS) console.log(`[ANTILINK DEBUG] chat=${from} action=${action} isBotAdmins=${isBotAdmins}`);
                            // 🚨 FIX ("antilink mein kuch nahi hota, sirf on hi hota"):
                            // when action was delete/kick and the bot wasn't a group
                            // admin, this used to skip EVERYTHING silently — no
                            // delete (expected, WhatsApp requires admin for that),
                            // but also no alert at all, so it looked like antilink
                            // was completely broken even though it was correctly
                            // ON. Now the alert always goes out; only the actual
                            // delete/kick action is skipped (and the alert says so)
                            // when the bot isn't admin.
                            if (action !== 'warn' && canAct) {
                                // Same LID-safe delete key as before.
                                await conn.sendMessage(from, {
                                    delete: { remoteJid: from, fromMe: false, id: mek.key.id, participant: sender }
                                });
                            }
                            const needsAdminNote = (action !== 'warn' && !canAct)
                                ? `\n┃❃│ ⚠️ Bot isn't admin — couldn't delete/kick.\n┃❃│ ⚠️ Make bot admin to enable this.`
                                : '';
                            // 🚨 FIX (requested by Ahmad — antilink alert was a bare
                            // one-liner): boxed + references .rules so the user
                            // knows where to check the actual group rules.
                            const antilinkAlert = `╭═══ 🔗 ANTI-LINK ═══⊷
┃❃╭──────────────
┃❃│ 🚫 Links aren't allowed here
┃❃│ 👤 @${sender.split('@')[0]}
┃❃│ ⚙️ Action: ${action.toUpperCase()}${needsAdminNote}
┃❃│ 📜 Check group rules: .rules
┃❃╰───────────────
╰═════════════════⊷`;
                            await conn.sendMessage(from, {
                                text: antilinkAlert,
                                mentions: [sender]
                            });
                            if (action === 'kick' && canAct) {
                                await conn.groupParticipantsUpdate(from, [sender], 'remove').catch(() => {});
                            }
                        }
                    } catch (e) { console.log('[ANTILINK ERROR]', e.message); }
                }

                // 🚨 FEATURE (requested by Ahmad — new gc commands: .slowmode,
                // .addbadword/.nightmode/.lockmedia via plugins/group-extra.js):
                // enforcement for those settings lives here, alongside the
                // existing antilink block above, so every group message is
                // checked once against all active protections.
                if (isGroup && !isAdmins && !isOwner) {
                    try {
                        const gx = sharedGroupSettings || await (require('./data/GroupSettings').getGroupSettings(from));

                        // Slowmode — silently delete messages sent faster than
                        // the configured interval (no spammy warning per msg).
                        if (gx.slowmodeSec > 0 && body) {
                            const key = `${from}:${sender}`;
                            const last = lastGroupMsgAt.get(key) || 0;
                            const now = Date.now();
                            if (now - last < gx.slowmodeSec * 1000) {
                                if (isBotAdmins) {
                                    await conn.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: mek.key.id, participant: sender } }).catch(() => {});
                                }
                            } else {
                                lastGroupMsgAt.set(key, now);
                            }
                        }

                        // Night mode — mute non-admins during the configured window.
                        if (gx.nightMode && body) {
                            const nowT = new Date();
                            const cur = nowT.getHours() * 60 + nowT.getMinutes();
                            const [sh, sm] = gx.nightMode.start.split(':').map(Number);
                            const [eh, em] = gx.nightMode.end.split(':').map(Number);
                            const startM = sh * 60 + sm, endM = eh * 60 + em;
                            const inWindow = startM <= endM ? (cur >= startM && cur < endM) : (cur >= startM || cur < endM);
                            if (inWindow) {
                                if (isBotAdmins) {
                                    await conn.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: mek.key.id, participant: sender } }).catch(() => {});
                                }
                                await conn.sendMessage(from, { text: `🌙 Night mode is active (${gx.nightMode.start}–${gx.nightMode.end}) — only admins can chat right now.`, mentions: [sender] }).catch(() => {});
                            }
                        }

                        // Media lock — delete media from non-admins.
                        const isMedia = ['imageMessage', 'videoMessage', 'stickerMessage', 'documentMessage'].includes(mek.type);
                        if (gx.mediaLock && isMedia && isBotAdmins) {
                            await conn.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: mek.key.id, participant: sender } }).catch(() => {});
                        }

                        // Badword filter — delete + warn on a banned word.
                        if (body && gx.badwords && gx.badwords.length) {
                            const lower = body.toLowerCase();
                            const hit = gx.badwords.find(w => lower.includes(w));
                            if (hit) {
                                if (isBotAdmins) {
                                    await conn.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: mek.key.id, participant: sender } }).catch(() => {});
                                }
                                await conn.sendMessage(from, { text: `🚫 @${sender.split('@')[0]}, that word isn't allowed here.`, mentions: [sender] }).catch(() => {});
                            }
                        }

                        // Group auto-react emoji.
                        if (gx.groupEmoji && body) {
                            await conn.sendMessage(from, { react: { text: gx.groupEmoji, key: mek.key } }).catch(() => {});
                        }

                        // 🆕 Anti-flood (Bunty: "gc me or kya kar sakte" wishlist) —
                        // if a non-admin sends more than `antifloodLimit` messages
                        // within `antifloodWindowSec` seconds, take the configured
                        // action. Tracks a rolling per-sender timestamp window in
                        // memory (floodTracker) — no DB writes per message, so it
                        // stays cheap even in busy groups.
                        if (gx.antiflood) {
                            const limit = gx.antifloodLimit || 6;
                            const windowMs = (gx.antifloodWindowSec || 10) * 1000;
                            const key = `${from}:${sender}`;
                            const now = Date.now();
                            const hits = (floodTracker.get(key) || []).filter(t => now - t < windowMs);
                            hits.push(now);
                            floodTracker.set(key, hits);

                            if (hits.length > limit) {
                                floodTracker.set(key, []); // reset so we don't re-trigger every message while over limit
                                const action = gx.antifloodAction || 'warn';
                                if (isBotAdmins) {
                                    await conn.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: mek.key.id, participant: sender } }).catch(() => {});
                                }
                                const floodAlert = `╭═══ 🌊 ANTI-FLOOD ═══⊷
┃❃╭──────────────
┃❃│ 🚫 @${sender.split('@')[0]} is sending too fast
┃❃│ ⚙️ Limit: ${limit} msgs / ${gx.antifloodWindowSec || 10}s
┃❃│ ⚙️ Action: ${action.toUpperCase()}${!isBotAdmins ? '\n┃❃│ ⚠️ Bot isn\'t admin — couldn\'t delete.' : ''}
┃❃╰───────────────
╰═════════════════⊷`;
                                await conn.sendMessage(from, { text: floodAlert, mentions: [sender] }).catch(() => {});
                                if (action === 'kick' && isBotAdmins) {
                                    await conn.groupParticipantsUpdate(from, [sender], 'remove').catch(() => {});
                                }
                            }
                        }

                        // 🆕 Anti-tag (Bunty: "anti features" wishlist) — blocks
                        // non-admins from mass-mentioning the group (@everyone-
                        // style spam). Threshold configurable via .antitag limit.
                        if (gx.antitag) {
                            const mentions = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid || [];
                            const threshold = gx.antitagLimit || 5;
                            if (mentions.length >= threshold) {
                                if (isBotAdmins) {
                                    await conn.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: mek.key.id, participant: sender } }).catch(() => {});
                                }
                                const action = gx.antitagAction || 'warn';
                                const tagAlert = `╭═══ 🏷️ ANTI-TAG ═══⊷
┃❃╭──────────────
┃❃│ 🚫 @${sender.split('@')[0]} mass-tagged ${mentions.length} people
┃❃│ ⚙️ Limit: ${threshold} mentions
┃❃│ ⚙️ Action: ${action.toUpperCase()}${!isBotAdmins ? '\n┃❃│ ⚠️ Bot isn\'t admin — couldn\'t delete.' : ''}
┃❃╰───────────────
╰═════════════════⊷`;
                                await conn.sendMessage(from, { text: tagAlert, mentions: [sender] }).catch(() => {});
                                if (action === 'kick' && isBotAdmins) {
                                    await conn.groupParticipantsUpdate(from, [sender], 'remove').catch(() => {});
                                }
                            }
                        }

                        // 🆕 Anti-sticker (Bunty: "anti features" wishlist) —
                        // deletes stickers from non-admins when enabled (handy
                        // for groups getting spammed with sticker floods).
                        if (gx.antisticker && mek.message?.stickerMessage) {
                            if (isBotAdmins) {
                                await conn.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: mek.key.id, participant: sender } }).catch(() => {});
                            } else {
                                await conn.sendMessage(from, { text: `⚠️ Anti-sticker is ON but bot isn't admin — couldn't delete @${sender.split('@')[0]}'s sticker.`, mentions: [sender] }).catch(() => {});
                            }
                        }

                        // 🆕 Anti-contact (Bunty: "users ke liye bhi") —
                        // deletes contact-card (vCard) spam from non-admins.
                        // Protects regular members from unsolicited/phishing
                        // contact cards being dropped in the group.
                        if (gx.anticontact && (mek.message?.contactMessage || mek.message?.contactsArrayMessage)) {
                            if (isBotAdmins) {
                                await conn.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: mek.key.id, participant: sender } }).catch(() => {});
                                await conn.sendMessage(from, { text: `🚫 Anti-contact is ON — deleted a contact card from @${sender.split('@')[0]}.`, mentions: [sender] }).catch(() => {});
                            } else {
                                await conn.sendMessage(from, { text: `⚠️ Anti-contact is ON but bot isn't admin — couldn't delete @${sender.split('@')[0]}'s contact card.`, mentions: [sender] }).catch(() => {});
                            }
                        }

                        // 🆕 Anti-forward (requested by user) — deletes/warns/kicks
                        // for messages forwarded from a channel or another chat.
                        const isForwarded = !!(mek.message?.contextInfo?.isForwarded || mek.message?.contextInfo?.forwardedNewsletterMessageInfo);
                        if (gx.antiforward && isForwarded) {
                            const action = gx.antiforwardAction || 'delete';
                            if (isBotAdmins && action !== 'warn') {
                                await conn.sendMessage(from, { delete: { remoteJid: from, fromMe: false, id: mek.key.id, participant: sender } }).catch(() => {});
                            }
                            
                            const forwardAlert = `╭═══ 🚫 ANTI-FORWARD ═══⊷
┃❃╭──────────────
┃❃│ 🚫 @${sender.split('@')[0]} forwarded a post
┃❃│ ⚙️ Action: ${action.toUpperCase()}${!isBotAdmins && action !== 'warn' ? '\n┃❃│ ⚠️ Bot isn\'t admin — couldn\'t delete.' : ''}
┃❃╰───────────────
╰═════════════════⊷`;
                            await conn.sendMessage(from, { text: forwardAlert, mentions: [sender] }).catch(() => {});
                            
                            if (action === 'kick' && isBotAdmins) {
                                await conn.groupParticipantsUpdate(from, [sender], 'remove').catch(() => {});
                            }
                        }

                    } catch (e) { console.log('[GROUP-EXTRA ENFORCEMENT ERROR]', e.message); }
                }

                // 🚨 BUG FIX (fake-sender / ugly-forward-box bug): this used to
                // (1) build a fake "quoted" message with hardcoded garbage jids
                // (13135550002@s.whatsapp.net / 0@s.whatsapp.net), and (2) wrap
                // every reply in a fake "forwarded from a newsletter/channel"
                // contextInfo. Together these made WhatsApp render every single
                // reply as a big "Forwarded many times → AI・Status → Contact:
                // AHMAD-MINI" box, and on @lid groups the fake jids could get
                // mis-resolved to a REAL group member — so replies looked like
                // they were coming from a random real member (e.g. showing a
                // group member's name) instead of the bot. Both were purely
                // cosmetic and not worth the risk/clutter, so replies are now
                // sent plain, just quoting the real incoming command message.
                const myquoted = mek;
                // 🚨 FEATURE (requested by Ahmad — "75% cmds forward msg
                // style"): brings back the channel-forwarded look for
                // command replies, but WITHOUT the part that actually broke
                // things before (see the removed-code note above this
                // block) — that old version faked the QUOTED sender with
                // garbage jids, which is what caused replies to mis-resolve
                // to a real random member on @lid groups. This only adds a
                // `forwardedNewsletterMessageInfo` contextInfo tag pointing
                // at the bot's REAL channel JID (same safe pattern already
                // used in admin-plus.js/fun-stickers.js/gc-setting.js) —
                // no fake sender, so the @lid mis-resolution bug can't
                // recur, while every command using this shared `reply()`
                // now shows the forwarded/channel look.
                const forwardCtx = {
                    forwardingScore: 999,
                    isForwarded: true,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: config.CHANNEL_JID || '120363427856127926@newsletter',
                        newsletterName: config.BOT_NAME || 'MINI AHMAD V077',
                        serverMessageId: 2
                    }
                };
                const reply = async (text) => {
                    // 🚨 FIX ("result chota box bara" — a one-line error like
                    // "❌ Use: .tiktokstalk <username>" was rendering inside
                    // the same big "Forwarded many times → View channel" box
                    // as real results, which looks disproportionate for a
                    // short message. Error/status one-liners (❌/✅ prefixed)
                    // now skip the forward decoration; genuine command
                    // results still get the channel-forwarded look.
                    const isShortStatus = /^[❌✅]/.test(text.trim()) && text.length < 200;
                    const payload = {
                        text: toFancyBold(text),
                        ...(isShortStatus ? {} : { contextInfo: forwardCtx })
                    };
                    // 🚨 ROOT-CAUSE FIX (Bunty: "kisi ki chat mein jaake command
                    // chalao to kuch nahi hota, mode se farq nahi padta"):
                    // command dispatch WAS succeeding (cmd.function ran fine —
                    // confirmed via [PERF] logs), but the reply silently never
                    // arrived. Root cause: `from` was a @lid-style jid (WhatsApp's
                    // newer privacy identity system — confirmed via
                    // [MSG-ARRIVED] from=...@lid logs), and this always called
                    // conn.sendMessage(from, ...) with that raw @lid jid, with NO
                    // error handling at all. Some Baileys versions/WA states can't
                    // reliably deliver a fresh send to a bare @lid jid without it
                    // first being resolved through the lid<->phone-number mapping
                    // store (same root issue already worked around for owner/
                    // admin checks in lib/jid-resolve.js) — the send call was
                    // throwing, but with zero .catch/logging anywhere in this
                    // function, it looked like the bot just "did nothing".
                    // Now: try the send as-is first (works for normal chats and
                    // @lid chats Baileys CAN handle directly); on failure for a
                    // @lid target, resolve to the real phone-number jid via
                    // signalRepository.lidMapping and retry once; and log
                    // (instead of silently swallowing) if both attempts fail, so
                    // this is visible in [DROP-DEBUG]-style diagnostics going forward.
                    try {
                        return await conn.sendMessage(from, payload, { quoted: mek });
                    } catch (e) {
                        if (from.endsWith('@lid')) {
                            try {
                                const lidMap = conn?.signalRepository?.lidMapping;
                                const realJid = lidAltCache.get(from) || (lidMap ? await lidMap.getPNForLID(from) : null);
                                if (realJid) {
                                    ahmadLog(`reply(): @lid send failed for ${from} (${e.message}) — retrying via resolved jid ${realJid}`, 'warning');
                                    return await conn.sendMessage(realJid, payload, { quoted: mek });
                                }
                            } catch (e2) {
                                ahmadLog(`reply(): @lid fallback also failed for ${from}: ${e2.message}`, 'error');
                                return;
                            }
                        }
                        ahmadLog(`reply(): sendMessage failed for ${from}: ${e.message}`, 'error');
                    }
                };
                const l = reply;

                if (isCmd) {
                    // 🚨 SPEED FIX (Ahmad: "bot bht slow hai"): these two stats
                    // writes were `await`ed BEFORE the command even started
                    // running — every single command paid for 2 sequential
                    // round-trips to MongoDB Atlas (often 100-300ms each
                    // depending on region) before the bot did any actual work.
                    // Stats are just counters for .topcmds/.stats — nothing
                    // downstream needs them to have finished before the command
                    // runs, so they're now fire-and-forget (no await). Errors
                    // are swallowed the same way incrementStats already
                    // swallows/logs its own internally.
                    incrementStats(sanitizedNumber, 'commandsUsed').catch(() => {});
                    // 🚨 FEATURE: per-command usage tracking for .topcmds — reuses
                    // the same per-day Stats doc/collection (Mongo-backed when
                    // MONGODB_URI is set), just adds one more counter field per
                    // command name instead of a whole new collection.
                    incrementStats(sanitizedNumber, `cmd_${command}`).catch(() => {});
                    // 🚨 PERF FIX: was a linear .find() (pattern scan, then a
                    // SECOND full alias scan) over all 500+ commands on every
                    // single message — see ahmad-core.js for the Map that
                    // replaces it. O(1) lookup now.
                    const cmd = events.commandMap.get(command);
                    if (cmd) {
                        // 🚨 BUG FIX (Ahmad: "public mode set kiya, phir bhi
                        // koi aur use nahi kar pata — kabhi kaam karta,
                        // kabhi nahi"): this used to check the shared GLOBAL
                        // config.WORK_TYPE, mutated in-place by
                        // getUserConfigFromMongoDB restore-on-connect (see
                        // above). This bot supports multiple numbers running
                        // in the same process (activeSockets Map) — every
                        // number's connect/reconnect overwrites that SAME
                        // global value with ITS OWN saved setting, so one
                        // number's private/public mode could silently stomp
                        // another's, and even a single number's own
                        // reconnects could race with a .mode change. userConfig
                        // (fetched earlier, already scoped correctly per
                        // botNumber and cached) is the real source of truth —
                        // reading from there instead removes the shared-state
                        // race entirely.
                        const effectiveWorkType = userConfig?.WORK_TYPE || config.WORK_TYPE;
                        // isMe: this instance's own owner (the number this
                        // bot is paired to) should always be able to use
                        // their own bot, even after they set it to private —
                        // otherwise setting .mode private would lock out the
                        // very person who set it.
                        if (effectiveWorkType === 'private' && !isOwner && !isMe) { if (config.DEBUG_LOGS) console.log(`[CMD DEBUG] BLOCKED by WORK_TYPE=private for ${sender}`); return; }

                        // 🚨 BUG FIX: .setcommandcooldown/.cooldown only ever SET
                        // config.CMD_COOLDOWN — nothing ever read it, so spamming
                        // commands rapid-fire was never actually throttled (risking
                        // API rate-limits or a WhatsApp spam flag on the bot number).
                        // Now it's enforced per sender, skipping silently (no extra
                        // reply spam) if they're still inside the cooldown window.
                        // Owner is exempt so testing/admin work isn't slowed down.
                        const cooldownSec = Number(config.CMD_COOLDOWN) || 0;
                        if (cooldownSec > 0 && !isOwner) {
                            const key = `${botNumber}:${sender}`;
                            const now = Date.now();
                            const last = lastCommandAt.get(key) || 0;
                            if (now - last < cooldownSec * 1000) return;
                            lastCommandAt.set(key, now);
                        }

                        __mark('preDispatch');
                        if (config.DEBUG_LOGS) console.log(`[PERF] .${command} breakdown: ${__perf.join(' | ')}`);

                        if (cmd.react) conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });
                        try {
                            const cmdResult = cmd.function(conn, mek, m, { from, quoted: quotedMsg, mentionedJid, body, isCmd, command, args, q, text, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, isPairedElsewhere, isCreator, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply, config, myquoted, arrivalTs });
                            // cmd.function is (almost) always async, so it returns a
                            // Promise immediately — errors thrown after its first
                            // `await` happen LATER, outside this try/catch's
                            // synchronous window. Attaching .catch() here is what
                            // actually catches those (the try/catch below only
                            // catches an immediate synchronous throw, e.g. a typo
                            // before any await).
                            if (cmdResult && typeof cmdResult.catch === 'function') {
                                cmdResult.catch(e => ahmadLog(`PLUGIN ERROR [${command}]: ${e.message}`, 'error'));
                            }
                        } catch (e) { ahmadLog(`PLUGIN ERROR [${command}]: ${e.message}`, 'error'); }
                    }
                }

                incrementStats(sanitizedNumber, 'messagesReceived').catch(() => {});
                if (isGroup) incrementStats(sanitizedNumber, 'groupsInteracted').catch(() => {});

                // 🆕 FEATURE (Bunty: ".aibyahmad on -> koi bhi is number ko
                // DM kare to AI fully samajh kar reply kare; gc mode; har
                // user apni personality/footer/ignore-list/hours/voice
                // .aibyahmad settings mein set kar sake"): plain
                // (non-command) chat only. Runs detached (not awaited) so it
                // never slows down normal command processing above.
                if (!isCmd && !isMe && !isGroup && body?.trim()) {
                    (async () => {
                        try {
                            const settings = await getAIAutoReplySettings(botNumber);
                            if (!settings.enabled) return;

                            if (looksLikeIdentityQuestion(body || '')) {
                                await conn.sendMessage(from, { text: identityAnswer(body) }, { quoted: mek });
                                return;
                            }

                            const historyKey = `${botNumber}:${sender}`;
                            const hist = aiAutoReplyHistory.get(historyKey) || [];
                            const historyText = hist.map(h => `Them: ${h.u}\nYou: ${h.a}`).join('\n');
                            const prompt = `You are personally replying to a WhatsApp message on behalf of the account owner, Bunty Ahmad (not as a generic bot/assistant — reply like a real, cool, and helpful person). ` +
                                `Your personality is "Sigma", confident but respectful. ` +
                                `${historyText ? `Recent conversation history (use this for context):\n${historyText}\n\n` : ''}` +
                                `CRITICAL INSTRUCTIONS:\n` +
                                `1. Reply in the EXACT same language and script the user is writing in (English, Roman Urdu, or Urdu script).\n` +
                                `2. Keep it natural, realistic, and reasonably short (like a real person on WhatsApp).\n` +
                                `3. DO NOT sound like a scripted bot. Use informal but polite tone.\n` +
                                `4. If they ask who you are, mention you are Bunty Ahmad's AI assistant.\n` +
                                `5. If the message is about money or sensitive personal matters, say you'll inform Bunty Ahmad about it.\n\n` +
                                `User's new message: ${body}`;

                            // 🆕 Human-like read + type delay (ban-risk
                            // reduction): an instant AI reply is one of the
                            // most obvious "this is a bot" signals. Mimic a
                            // real person: brief "seen" pause, then a typing
                            // duration roughly scaled to reply length.
                            await conn.readMessages([mek.key]).catch(() => {});
                            await new Promise(r => setTimeout(r, 1200 + Math.random() * 1800));
                            conn.sendPresenceUpdate('composing', from).catch(() => {});
                            const answer = await smartAI(prompt);
                            const typingMs = Math.min(8000, Math.max(1500, answer.length * 40));
                            await new Promise(r => setTimeout(r, typingMs));
                            hist.push({ u: body, a: answer });
                            if (hist.length > 5) hist.shift();
                            aiAutoReplyHistory.set(historyKey, hist);

                            await conn.sendMessage(from, { text: answer }, { quoted: mek });
                        } catch (e) {
                            ahmadLog(`[AIBYAHMAD] auto-reply failed for ${from}: ${e.message}`, 'error');
                        }
                    })();
                }

                // 🚨 SPEED FIX (Ahmad: ".ping 300-1000ms+ 🐢" — real CPU cost,
                // not network/DB): this used to run `events.commands.map(...)`
                // over ALL 528 registered commands on EVERY single message,
                // building a brand-new 25+ property ctx object for EACH one —
                // 528 object allocations per message, even though only a
                // handful of commands (afk.js, status-saver.js — the ones
                // with an `on: 'body'/'text'/'image'/'sticker'` listener)
                // ever actually use it. That's real synchronous CPU/GC work
                // on every message, which adds up fast on a CPU-limited host
                // like Katabump. The `on`-listener list is now computed ONCE
                // up front (see onListenerCommands below events.commands
                // registration) instead of re-filtering all 528 every time,
                // and ctx is built once and reused for whichever of the (few)
                // matching handlers actually fire.
                if (onListenerCommands.length) {
                    const ctx = { from, l, quoted: quotedMsg, mentionedJid, body, isCmd, command, args, q, text, isGroup, sender, senderNumber, botNumber2, botNumber, pushname, isMe, isOwner, isPairedElsewhere, isCreator, groupMetadata, groupName, participants, groupAdmins, isBotAdmins, isAdmins, reply, config, myquoted };
                    // 🚨 Same crash-safety fix as the main command dispatch
                    // above: these are async functions, called without await,
                    // so any error thrown after their first `await` was an
                    // unhandled promise rejection — enough to crash the whole
                    // bot process on its own, with no relation to the command
                    // someone actually typed. runListener() catches that.
                    const runListener = (fn) => {
                        try {
                            const res = fn(conn, mek, m, ctx);
                            if (res && typeof res.catch === 'function') {
                                res.catch(e => ahmadLog(`LISTENER ERROR: ${e.message}`, 'error'));
                            }
                        } catch (e) { ahmadLog(`LISTENER ERROR: ${e.message}`, 'error'); }
                    };
                    for (const evCmd of onListenerCommands) {
                        if (body && evCmd.on === 'body') runListener(evCmd.function);
                        else if (mek.q && evCmd.on === 'text') runListener(evCmd.function);
                        else if ((evCmd.on === 'image' || evCmd.on === 'photo') && mek.type === 'imageMessage') runListener(evCmd.function);
                        else if (evCmd.on === 'sticker' && mek.type === 'stickerMessage') runListener(evCmd.function);
                    }
                }

            } catch (e) { ahmadLog(`Message handler error: ${e.message}`, 'error'); }
        });

    } catch (err) {
        ahmadLog(`™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 ᥫᩣ Pair error: ${err.message}`, 'error');
        if (res && !res.headersSent) return res.json({ error: 'Internal Server Error', details: err.message });
    } finally {
        if (connectionLockKey) global[connectionLockKey] = false;
    }
}


router.get('/', (req, res) => res.sendFile(path.join(__dirname, 'pair.html')));

// 🔐 API key protection (Bunty: "Usman ki file mein API key protection hai,
// hamari mein nahi") — mirrors Usman-MD's requireApiKey middleware. Only
// enforced if config.PAIR_API_KEY is actually set; if it's blank (default),
// this is a no-op so nothing breaks for existing deployments/QR pages that
// don't send a key. Accepts the key via ?apikey=... query param or an
// x-api-key header.
function requireApiKey(req, res, next) {
    if (!config.PAIR_API_KEY) return next(); // protection disabled
    const provided = req.query.apikey || req.headers['x-api-key'];
    if (!provided || provided !== config.PAIR_API_KEY) {
        return res.status(401).json({ status: 'error', message: 'Invalid or missing API key' });
    }
    next();
}

// 🎛️ Public read — pair.html uses this to load bot name / tagline / bg music
// / channel link so the pairing page reflects whatever the owner set in the
// hidden admin panel, without exposing the admin key itself.
router.get('/site-settings', async (req, res) => {
    try {
        const settings = await getSiteSettings();
        res.json({ status: 'success', settings });
    } catch (e) { res.status(500).json({ error: 'Failed to load settings' }); }
});

// 🔐 Admin-only write, protected by config.ADMIN_PANEL_KEY. The hidden panel
// in pair.html sends this key in the request body after the owner unlocks it
// (tap the crest 5x or Ctrl+Shift+A, then enter the key).
router.post('/admin/site-settings', async (req, res) => {
    const { key, settings } = req.body || {};
    if (!key || key !== config.ADMIN_PANEL_KEY) {
        return res.status(401).json({ status: 'error', message: 'Invalid admin key' });
    }
    if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ status: 'error', message: 'Settings object required' });
    }
    // Only allow known fields to be written, so a bad payload can't inject
    // arbitrary junk into storage.
    const allowed = ['botName', 'welcomeMsg', 'welcomeVideo', 'channelLink', 'bgMusicUrl', 'heroTagline', 'botImageUrl', 'audioPopupEnabled'];
    const clean = {};
    for (const k of allowed) if (k in settings) clean[k] = settings[k];
    const saved = await setSiteSettings(clean);
    if (!saved) return res.status(500).json({ status: 'error', message: 'Failed to save' });
    res.json({ status: 'success', settings: saved });
});

router.post('/admin/verify-key', (req, res) => {
    const { key } = req.body || {};
    res.json({ valid: !!key && key === config.ADMIN_PANEL_KEY });
});

router.get('/code', requireApiKey, async (req, res) => { if (!req.query.number) return res.json({ error: 'Number required' }); await ahmadPair(req.query.number, res); });
router.get('/status', async (req, res) => {
    const { number } = req.query;
    if (!number) {
        const list = Array.from(activeSockets.keys()).map(n => { const s = getConnectionStatus(n); return { number: n, status: 'connected', connectionTime: s.connectionTime, uptime: `${s.uptime} seconds` }; });
        return res.json({ totalActive: activeSockets.size, connections: list });
    }
    const s = getConnectionStatus(number);
    res.json({ number, isConnected: s.isConnected, connectionTime: s.connectionTime, uptime: `${s.uptime} seconds` });
});
router.get('/disconnect', requireApiKey, async (req, res) => {
    const { number } = req.query;
    if (!number) return res.status(400).json({ error: 'Number required' });
    const n = number.replace(/[^0-9]/g, '');
    if (!activeSockets.has(n)) return res.status(404).json({ error: 'Not found' });
    try {
        const socket = activeSockets.get(n);
        await socket.ws.close(); socket.ev.removeAllListeners();
        activeSockets.delete(n); socketCreationTime.delete(n); ahmadStores.delete(n);
        if (presenceWatchers.has(n)) { clearInterval(presenceWatchers.get(n)); presenceWatchers.delete(n); }
        if (channelWatchers.has(n)) { clearInterval(channelWatchers.get(n)); channelWatchers.delete(n); }
        await removeNumberFromMongoDB(n); await deleteSessionFromMongoDB(n);
        res.json({ status: 'success', message: 'Disconnected' });
    } catch (e) { res.status(500).json({ error: 'Failed to disconnect' }); }
});
router.get('/active', (req, res) => res.json({ count: activeSockets.size, numbers: Array.from(activeSockets.keys()) }));
router.get('/ping', (req, res) => res.json({ status: 'active', message: '™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 ᥫᩣ is running 🔥', activeSessions: activeSockets.size }));
router.get('/connect-all', requireApiKey, async (req, res) => {
    try {
        const numbers = await getAllNumbersFromMongoDB();
        if (!numbers.length) return res.status(404).json({ error: 'No numbers found' });
        const results = [];
        for (const number of numbers) {
            if (activeSockets.has(number)) { results.push({ number, status: 'already_connected' }); continue; }
            const mockRes = { headersSent: false, json: () => {}, status: () => mockRes };
            await ahmadPair(number, mockRes);
            results.push({ number, status: 'connection_initiated' });
            await delay(1000);
        }
        res.json({ status: 'success', total: numbers.length, connections: results });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});
router.get('/update-config', async (req, res) => {
    const { number, config: configString } = req.query;
    if (!number || !configString) return res.status(400).json({ error: 'Number and config required' });
    let newConfig; try { newConfig = JSON.parse(configString); } catch (_) { return res.status(400).json({ error: 'Invalid config' }); }
    const n = number.replace(/[^0-9]/g, '');
    const socket = activeSockets.get(n);
    if (!socket) return res.status(404).json({ error: 'No active session' });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await saveOTPToMongoDB(n, otp, newConfig);
    try {
        await socket.sendMessage(jidNormalizedUser(socket.user.id), { text: `*🔐 ™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 ᥫᩣ — CONFIG UPDATE*\n\nOTP: ${otp}\nValid 5 minutes` });
        res.json({ status: 'otp_sent' });
    } catch (e) { res.status(500).json({ error: 'Failed to send OTP' }); }
});
router.get('/verify-otp', async (req, res) => {
    const { number, otp } = req.query;
    if (!number || !otp) return res.status(400).json({ error: 'Number and OTP required' });
    const n = number.replace(/[^0-9]/g, '');
    const verification = await verifyOTPFromMongoDB(n, otp);
    if (!verification.valid) return res.status(400).json({ error: verification.error });
    await updateUserConfigInMongoDB(n, verification.config);
    const socket = activeSockets.get(n);
    if (socket) await socket.sendMessage(jidNormalizedUser(socket.user.id), { text: '*✅ CONFIG UPDATED*' });
    res.json({ status: 'success' });
});
router.get('/stats', async (req, res) => {
    const { number } = req.query;
    if (!number) return res.status(400).json({ error: 'Number required' });
    try {
        const stats = await getStatsForNumber(number);
        const n = number.replace(/[^0-9]/g, '');
        const s = getConnectionStatus(n);
        res.json({ number: n, connectionStatus: s.isConnected ? 'Connected' : 'Disconnected', uptime: s.uptime, stats });
    } catch (e) { res.status(500).json({ error: 'Failed' }); }
});



async function autoReconnectFromMongoDB() {
    try {
        ahmadLog('Attempting auto-reconnect from MongoDB...', 'info');
        const numbers = await getAllNumbersFromMongoDB();
        if (!numbers.length) { ahmadLog('No numbers in MongoDB', 'info'); return; }
        for (const number of numbers) {
            if (!activeSockets.has(number)) {
                const mockRes = { headersSent: false, json: () => {}, status: () => mockRes };
                await ahmadPair(number, mockRes);
                await delay(2000);
            }
        }
        ahmadLog('Auto-reconnect completed', 'success');
    } catch (e) { ahmadLog(`autoReconnectFromMongoDB error: ${e.message}`, 'error'); }
}

setTimeout(() => { autoReconnectFromMongoDB(); }, 3000);



process.on('exit', () => {
    activeSockets.forEach((socket, number) => {
        try { socket.ws.close(); } catch (_) {}
        activeSockets.delete(number); socketCreationTime.delete(number);
    });
    const sessionDir = path.join(__dirname, 'session');
    if (fs.existsSync(sessionDir)) fs.emptyDirSync(sessionDir);
});

process.on('uncaughtException', async (err) => {
    await flushAllBootMarks();
    ahmadLog(`Uncaught exception: ${err.message}`, 'error');
});

// 🚨 FIX (Bunty: "koi cmd fail ho to bot crash hi jata hai, reconnect karna
// parta hai"): Node.js terminates the ENTIRE process on any unhandled promise
// rejection by default (since Node 15) — this had no handler at all, only
// uncaughtException (which is for SYNC throws, a different thing). Combined
// with the two dispatcher fixes above (which stop plugin/listener errors from
// becoming unhandled rejections in the first place), this is the final
// safety net for anywhere else in the codebase an async error might slip
// through uncaught — logs it and keeps the bot alive instead of dying.
process.on('unhandledRejection', async (reason) => {
    await flushAllBootMarks();
    ahmadLog(`Unhandled rejection: ${reason && reason.message ? reason.message : reason}`, 'error');
});

// 🚨 GAP FIX continued: Railway/host restarts and redeploys send SIGTERM
// (a graceful "please stop now") to the process — not a crash, but the
// exact same gap applies: whatever was processed in the last <1s before
// that signal might not be on disk yet. Flushing here means even a clean
// redeploy can't replay the last few seconds of messages either.
// process.exit() must wait for the flush to actually finish (it's now a
// real Mongo write, not a fire-and-forget local file write) or this would
// exit before the write ever went out, defeating the whole point.
process.on('SIGTERM', async () => { await flushAllBootMarks(); process.exit(0); });
process.on('SIGINT', async () => { await flushAllBootMarks(); process.exit(0); });

router.ahmadEvents = ahmadEvents;
module.exports = router;
