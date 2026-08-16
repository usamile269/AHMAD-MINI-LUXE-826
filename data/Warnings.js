const jsondb = require('../lib/mongo');

// Stored locally now (JSON file via lib/jsondb.js) instead of MongoDB.
const Warning = jsondb.model('Warning');

async function getWarnCount(chatId, userId) {
    try {
        const doc = await Warning.findOne({ chatId, userId });
        return doc ? doc.count : 0;
    } catch (e) { return 0; }
}

async function incrementWarn(chatId, userId) {
    try {
        const doc = await Warning.findOneAndUpdate(
            { chatId, userId },
            { $inc: { count: 1 } },
            { upsert: true, new: true }
        );
        return doc.count;
    } catch (e) { return 0; }
}

async function decrementWarn(chatId, userId) {
    try {
        const doc = await Warning.findOneAndUpdate(
            { chatId, userId },
            { $inc: { count: -1 } },
            { new: true }
        );
        if (!doc) return 0;
        if (doc.count <= 0) {
            await Warning.deleteOne({ chatId, userId });
            return 0;
        }
        return doc.count;
    } catch (e) { return 0; }
}

async function resetWarn(chatId, userId) {
    try { await Warning.deleteOne({ chatId, userId }); return true; } catch (e) { return false; }
}

async function resetAllWarnsInChat(chatId) {
    try { await Warning.deleteMany({ chatId }); return true; } catch (e) { return false; }
}

module.exports = { Warning, getWarnCount, incrementWarn, decrementWarn, resetWarn, resetAllWarnsInChat };
