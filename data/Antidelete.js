const jsondb = require('../lib/mongo');

// 🚨 SCOPING FIX (Bunty: "har user ki alag setting ho, koi ni change kar
// saky" — same fix already applied to AntiViewOnce/ChatPrefix): this bot
// can run multiple paired numbers off one deployment/Mongo. GLOBAL_KEY used
// to be one bare, unscoped string, so .delpath (overall) on one paired
// number would leak into every other paired number sharing the same
// database. Every key here is now namespaced by botNumber, so each
// number's overall antidelete setting — and its per-chat overrides — are
// fully independent and untouchable by any other number.
function globalKeyFor(botNumber) { return `${botNumber}::__GLOBAL__`; }
function chatKeyFor(botNumber, chatId) { return `${botNumber}::${chatId}`; }

// Stored locally now (JSON file via lib/jsondb.js) instead of MongoDB.
// Field shape stays the same: { chatId, status, sendTo }. No `sendTo` default
// on purpose — see getAntideleteSendTo below for why (a per-chat doc should
// only override the global preference once `.delpath` is actually run in
// that specific chat).
const Antidelete = jsondb.model('Antidelete');

const getAntideleteStatus = async (botNumber, chatId) => {
    try {
        const [chatData, globalData] = await Promise.all([
            Antidelete.findOne({ chatId: chatKeyFor(botNumber, chatId) }),
            Antidelete.findOne({ chatId: globalKeyFor(botNumber) })
        ]);
        if (globalData && globalData.status) return true;
        return chatData ? chatData.status : false;
    } catch (e) { return false; }
};

const getAntideleteSendTo = async (botNumber, chatId) => {
    try {
        const [chatData, globalData] = await Promise.all([
            Antidelete.findOne({ chatId: chatKeyFor(botNumber, chatId) }),
            Antidelete.findOne({ chatId: globalKeyFor(botNumber) })
        ]);
        if (chatData && chatData.sendTo) return chatData.sendTo;
        if (globalData && globalData.sendTo) return globalData.sendTo;
        return 'same';
    } catch (e) { return 'same'; }
};

const setAntideleteStatus = async (botNumber, chatId, status) => {
    try {
        await Antidelete.findOneAndUpdate({ chatId: chatKeyFor(botNumber, chatId) }, { status }, { upsert: true, new: true });
        return true;
    } catch (e) { return false; }
};

const setAntideleteSendTo = async (botNumber, chatId, sendTo) => {
    try {
        await Antidelete.findOneAndUpdate({ chatId: chatKeyFor(botNumber, chatId) }, { sendTo }, { upsert: true, new: true });
        return true;
    } catch (e) { return false; }
};

// Used by .antideleteall/.delpathall — writes directly to the GLOBAL doc
// for this botNumber, instead of going through chatKeyFor (which would
// double-namespace the key if you passed globalKeyFor(botNumber) as a
// "chatId").
const setAntideleteGlobalStatus = async (botNumber, status) => {
    try {
        await Antidelete.findOneAndUpdate({ chatId: globalKeyFor(botNumber) }, { status }, { upsert: true, new: true });
        return true;
    } catch (e) { return false; }
};

const setAntideleteGlobalSendTo = async (botNumber, sendTo) => {
    try {
        await Antidelete.findOneAndUpdate({ chatId: globalKeyFor(botNumber) }, { sendTo }, { upsert: true, new: true });
        return true;
    } catch (e) { return false; }
};

module.exports = { Antidelete, globalKeyFor, chatKeyFor, getAntideleteStatus, setAntideleteStatus, getAntideleteSendTo, setAntideleteSendTo, setAntideleteGlobalStatus, setAntideleteGlobalSendTo };
// POWERED BY Ahmad
