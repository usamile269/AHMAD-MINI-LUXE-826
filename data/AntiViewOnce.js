const jsondb = require('../lib/mongo');

// 🆕 SIMPLIFIED (Bunty: "voviewpath system boht zayada hai, remove all
// options — default private everywhere, .voviewpath sirf overall set kare"):
// ONE destination setting, not per-chat/groups/other. Default 'private'.
//
// 🚨 SCOPING FIX (Bunty: "yeh har user ka alag alag hoga na?"): this bot
// can run MULTIPLE paired WhatsApp numbers from the same deployment/Mongo
// (see main.js — botNumber/sanitizedNumber is already used to key
// lastCommandAt, lastReactAt, per-number config, etc.). The first version
// of this "overall" setting used one bare GLOBAL_KEY with no botNumber in
// it at all, meaning if this deployment (or shared Mongo) ever serves more
// than one paired number, .voviewpath on ONE person's bot would silently
// change it for EVERY paired number's bot too. Every key here is now
// namespaced by botNumber, so each paired number's overall setting is
// fully independent — exactly like PREFIX and every other per-number
// setting already works.
function globalKeyFor(botNumber) { return `${botNumber}::__GLOBAL__`; }
function chatKeyFor(botNumber, chatId) { return `${botNumber}::${chatId}`; }

const AntiViewOnce = jsondb.model('AntiViewOnce');

// .antiviewonce on/off is still per-chat (within one bot number) — a group
// deciding to enable auto-capture for itself is genuinely a per-chat thing.
const getAntiViewOnceStatus = async (botNumber, chatId) => {
    try {
        const [chatData, globalData] = await Promise.all([
            AntiViewOnce.findOne({ chatId: chatKeyFor(botNumber, chatId) }),
            AntiViewOnce.findOne({ chatId: globalKeyFor(botNumber) })
        ]);
        if (globalData && globalData.status) return true;
        return chatData ? chatData.status : false;
    } catch (e) { return false; }
};

const setAntiViewOnceStatus = async (botNumber, chatId, status) => {
    try {
        await AntiViewOnce.findOneAndUpdate({ chatId: chatKeyFor(botNumber, chatId) }, { status }, { upsert: true, new: true });
        return true;
    } catch (e) { return false; }
};

// sendTo is ONE value per bot number (overall for that number only).
// Defaults to 'private' when nothing has been set yet for that number.
const getAntiViewOnceSendTo = async (botNumber) => {
    try {
        const globalData = await AntiViewOnce.findOne({ chatId: globalKeyFor(botNumber) });
        return (globalData && globalData.sendTo) ? globalData.sendTo : 'private';
    } catch (e) { return 'private'; }
};

const setAntiViewOnceSendTo = async (botNumber, mode) => {
    try {
        await AntiViewOnce.findOneAndUpdate({ chatId: globalKeyFor(botNumber) }, { sendTo: mode }, { upsert: true, new: true });
        return true;
    } catch (e) { return false; }
};

module.exports = { AntiViewOnce, globalKeyFor, chatKeyFor, getAntiViewOnceStatus, setAntiViewOnceStatus, getAntiViewOnceSendTo, setAntiViewOnceSendTo };
