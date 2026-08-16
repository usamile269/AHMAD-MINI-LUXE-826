// 🆕 (Bunty: "sudo/listsudo/delsudo add karo") — a botNumber-scoped list
// of trusted numbers granted owner-level command access, without being
// the actual config.OWNER_NUMBER. Same botNumber-scoping pattern used by
// every other per-session data model in this bot (Antidelete, AntiViewOnce,
// etc), so one paired user's sudo list can never leak into another's.
const jsondb = require('../lib/mongo');
const Sudo = jsondb.model('Sudo');

function keyFor(botNumber) { return botNumber; }

// 🚀 SPEED FIX: this gets checked on EVERY message from EVERY non-owner
// sender (since isOwner's || short-circuits mean isSudo only runs when the
// sender isn't already the owner — the common case), so a DB round-trip
// per message here would regress every non-owner interaction across the
// whole bot. Cached per botNumber with a short TTL, same pattern as
// UserConfig/UserBotSettings elsewhere in this bot.
const sudoCache = new Map(); // botNumber -> { list, ts }
const SUDO_CACHE_TTL_MS = 30 * 1000;

async function getSudoList(botNumber) {
    const cached = sudoCache.get(botNumber);
    if (cached && (Date.now() - cached.ts) < SUDO_CACHE_TTL_MS) return cached.list;
    try {
        const doc = await Sudo.findOne({ botNumber: keyFor(botNumber) });
        const list = doc?.numbers || [];
        sudoCache.set(botNumber, { list, ts: Date.now() });
        return list;
    } catch {
        return cached?.list || [];
    }
}

async function isSudo(botNumber, numberOrJid) {
    const number = String(numberOrJid).replace(/[^0-9]/g, '');
    const list = await getSudoList(botNumber);
    return list.includes(number);
}

async function addSudo(botNumber, numberOrJid) {
    const number = String(numberOrJid).replace(/[^0-9]/g, '');
    const list = await getSudoList(botNumber);
    if (list.includes(number)) return { added: false, already: true };
    const updated = [...list, number];
    await Sudo.findOneAndUpdate({ botNumber: keyFor(botNumber) }, { botNumber: keyFor(botNumber), numbers: updated }, { upsert: true });
    sudoCache.set(botNumber, { list: updated, ts: Date.now() });
    return { added: true };
}

async function removeSudo(botNumber, numberOrJid) {
    const number = String(numberOrJid).replace(/[^0-9]/g, '');
    const list = await getSudoList(botNumber);
    if (!list.includes(number)) return { removed: false };
    const updated = list.filter((n) => n !== number);
    await Sudo.findOneAndUpdate({ botNumber: keyFor(botNumber) }, { numbers: updated }, { upsert: true });
    sudoCache.set(botNumber, { list: updated, ts: Date.now() });
    return { removed: true };
}

module.exports = { getSudoList, isSudo, addSudo, removeSudo };
