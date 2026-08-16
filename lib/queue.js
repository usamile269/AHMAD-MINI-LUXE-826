// ============================================================================
// lib/queue.js — concurrency-limited queue for HEAVY operations.
// ----------------------------------------------------------------------------
// (Bunty: "queue wala crash na ho") — commands like .ytmp4/.ytmp3/.video2
// spawn real yt-dlp/ffmpeg processes and hold large buffers in memory. If
// 20 people run those at the exact same moment, the bot tries to run 20
// ffmpeg processes at once — that's what was actually crashing/freezing it
// (CPU + RAM exhaustion), not a code bug in any single command.
//
// This caps how many HEAVY jobs run at the same time (default 4). Anyone
// past that limit just waits in line — same result, no crash, only a short
// queue delay under real load.
// ============================================================================

class HeavyQueue {
    constructor(maxConcurrent = 4) {
        this.maxConcurrent = maxConcurrent;
        this.running = 0;
        this.waiting = [];
    }

    // queuePosition: how many jobs are ahead of a NEW job right now (for
    // showing the user "N log tumse aage hain" before they even start).
    queuePosition() {
        return this.waiting.length + Math.max(0, this.running - this.maxConcurrent);
    }

    async run(fn, onQueued) {
        if (this.running >= this.maxConcurrent) {
            const position = this.waiting.length + 1;
            if (onQueued) { try { onQueued(position); } catch {} }
            await new Promise(resolve => this.waiting.push(resolve));
        }
        this.running++;
        try {
            return await fn();
        } finally {
            this.running--;
            const next = this.waiting.shift();
            if (next) next();
        }
    }
}

// One shared queue for all download/transcode-heavy commands across the
// whole bot (video, audio, sticker/video conversions). Keeps total
// concurrent heavy work bounded no matter which command triggered it.
// 🚨 LOWERED 4 -> 1 (Bunty's own KataBump logs confirmed a real OOM kill,
// exit code 137, with Node's baseline RSS already ~294MB before any
// download even started): this host's memory ceiling is clearly very
// tight. Since AdeelXtech's quick API is currently dead (confirmed via his
// logs — consistent HTTP 500), almost every .play/.video is now falling
// through to the heavier yt-dlp/ffmpeg path, which is exactly the risky
// one. Serializing heavy jobs one-at-a-time is the safest setting until
// either the host gets more RAM or the quick API comes back up — it costs
// some speed under simultaneous load, but a slower reply beats a full
// container crash for everyone using the bot at that moment.
const heavyQueue = new HeavyQueue(1);

module.exports = { HeavyQueue, heavyQueue };
