const jsondb = require('../lib/mongo');

// 🆕 FEATURE (Ahmad: "group management mein naya command add karo") —
// .kickinactive needs to know when each member last sent a message in a
// group. This tracks that.
//
// 🚀 PERFORMANCE: recordActivity() is called on every group message, so it
// MUST NOT slow message processing down (this bot has had a lot of work put
// into exactly that problem). Two protections against that:
//   1. It's always called fire-and-forget (no await) from main.js — a slow
//      write here can never delay a reply.
//   2. It's throttled to at most once per participant per group per 10
//      minutes via an in-memory Map, so an active chat doesn't hammer Mongo
//      with a write on every single message — only the FIRST message in
//      each 10-minute window actually touches the database.
const GroupActivity = jsondb.model('GroupActivity');

const THROTTLE_MS = 10 * 60 * 1000;
const lastWriteAttempt = new Map(); // `${groupId}:${participant}` -> ts

function recordActivity(groupId, participant) {
    if (!groupId || !participant) return;
    const key = `${groupId}:${participant}`;
    const now = Date.now();
    const last = lastWriteAttempt.get(key) || 0;
    if (now - last < THROTTLE_MS) return; // already recorded recently, skip
    lastWriteAttempt.set(key, now);

    // Genuinely fire-and-forget — caller never awaits this.
    GroupActivity.findOneAndUpdate(
        { groupId, participant },
        { groupId, participant, lastSeen: new Date().toISOString() },
        { upsert: true }
    ).catch(() => {}); // a missed activity write is not worth logging noise over
}

async function getInactiveMembers(groupId, allParticipants, days) {
    try {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        const docs = await GroupActivity.find({ groupId });
        const seenRecently = new Set(
            docs.filter(d => new Date(d.lastSeen).getTime() >= cutoff).map(d => d.participant)
        );
        // Anyone with NO record at all is treated as "unknown", not
        // "inactive" — we only started tracking recently, so silence isn't
        // proof of inactivity yet. Only flag people we've actually SEEN
        // active before but not within the window.
        const everSeen = new Set(docs.map(d => d.participant));
        return allParticipants.filter(p => everSeen.has(p) && !seenRecently.has(p));
    } catch (error) {
        console.error('❌ Error getting inactive members:', error.message);
        return [];
    }
}

module.exports = { recordActivity, getInactiveMembers };
