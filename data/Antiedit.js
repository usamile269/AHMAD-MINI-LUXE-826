const jsondb = require('../lib/mongo');

// 🚨 SCOPING FIX (Bunty: "har user ki alag setting ho, koi ni change kar
// saky" — same fix as AntiViewOnce/Antidelete/ChatPrefix): keys namespaced
// by botNumber so each paired number's overall .editpath setting (and its
// per-chat overrides) are fully independent of every other paired number
// sharing the same deployment/Mongo.
function globalKeyFor(botNumber) { return `${botNumber}::__GLOBAL__`; }
function chatKeyFor(botNumber, chatId) { return `${botNumber}::${chatId}`; }

// Stored locally now (JSON file via lib/jsondb.js) instead of MongoDB.
const Antiedit = jsondb.model('Antiedit');

const getAntieditStatus = async (botNumber, chatId) => {
    try {
        const [chatData, globalData] = await Promise.all([
            Antiedit.findOne({ chatId: chatKeyFor(botNumber, chatId) }),
            Antiedit.findOne({ chatId: globalKeyFor(botNumber) })
        ]);
        if (globalData && globalData.status) return true;
        return chatData ? chatData.status : false;
    } catch (e) { return false; }
};

const getAntieditSendTo = async (botNumber, chatId) => {
    try {
        const [chatData, globalData] = await Promise.all([
            Antiedit.findOne({ chatId: chatKeyFor(botNumber, chatId) }),
            Antiedit.findOne({ chatId: globalKeyFor(botNumber) })
        ]);
        if (chatData && chatData.sendTo) return chatData.sendTo;
        if (globalData && globalData.sendTo) return globalData.sendTo;
        return 'same';
    } catch (e) { return 'same'; }
};

const setAntieditStatus = async (botNumber, chatId, status) => {
    try {
        await Antiedit.findOneAndUpdate({ chatId: chatKeyFor(botNumber, chatId) }, { status }, { upsert: true, new: true });
        return true;
    } catch (e) { return false; }
};

const setAntieditSendTo = async (botNumber, chatId, sendTo) => {
    try {
        await Antiedit.findOneAndUpdate({ chatId: chatKeyFor(botNumber, chatId) }, { sendTo }, { upsert: true, new: true });
        return true;
    } catch (e) { return false; }
};

const setAntieditGlobalStatus = async (botNumber, status) => {
    try {
        await Antiedit.findOneAndUpdate({ chatId: globalKeyFor(botNumber) }, { status }, { upsert: true, new: true });
        return true;
    } catch (e) { return false; }
};

const setAntieditGlobalSendTo = async (botNumber, sendTo) => {
    try {
        await Antiedit.findOneAndUpdate({ chatId: globalKeyFor(botNumber) }, { sendTo }, { upsert: true, new: true });
        return true;
    } catch (e) { return false; }
};

module.exports = { Antiedit, globalKeyFor, chatKeyFor, getAntieditStatus, setAntieditStatus, getAntieditSendTo, setAntieditSendTo, setAntieditGlobalStatus, setAntieditGlobalSendTo };
