// Prevent the whole server from crashing on an unexpected error anywhere in the app.
// Without these, any single unhandled rejection (a stray API call, a bad media message, etc.)
// kills the entire Node process on modern Node versions — which matches the "bot crashes,
// needs manual restart" symptom. Now it just gets logged and the bot keeps running.
// Prevent the whole server from crashing on an unexpected error anywhere in the app.
process.on('unhandledRejection', (reason) => {
    console.error('⚠️ Unhandled Rejection (bot kept running):', reason);
});
process.on('uncaughtException', (err) => {
    console.error('⚠️ Uncaught Exception (bot kept running):', err);
    // If it's a critical error that would normally kill the process, we log it and try to stay alive.
    // However, if the error is "EADDRINUSE", we should exit to let the host restart us properly.
    if (err.code === 'EADDRINUSE') {
        console.error('🚨 Port in use, exiting to allow host restart...');
        process.exit(1);
    }
});

// 🚨 AUTO-RESTART LOGIC: If the process somehow hangs or enters a bad state, 
// we want it to restart. Most cloud hosts (Railway, Render) will auto-restart 
// if the process exits with a non-zero code.
//
// 🚨 FIX (Ahmad: "Railway pe bot kabhi online kabhi offline randomly"):
// This used to check process.memoryUsage().heapUsed, which only measures
// V8's JS heap. It does NOT count Buffers, native addon memory, or Baileys'
// own socket/media buffers — all of which are large with this many plugins
// loaded. So heapUsed would read e.g. 200MB while the container's actual
// RAM (RSS) was already past Railway's real 512MB limit. Railway's own OOM
// killer would then kill the container WITHOUT this check ever firing —
// which looks exactly like "random offline", because the host does it
// abruptly with no log line, no code, no clean exit.
//
// Fix: check RSS (resident set size — the real physical memory the process
// holds), not heapUsed. Threshold set below Railway's 512MB hard limit so
// WE restart cleanly (fast reconnect, session preserved) before Railway
// force-kills the container. Also checks more often (2 min) so it catches
// spikes sooner.
const STABILITY_CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes
const RSS_LIMIT_MB = parseInt(process.env.RSS_LIMIT_MB, 10) || 400; // stay safely under Railway's 512MB
setInterval(() => {
    const mem = process.memoryUsage();
    const rssMB = mem.rss / 1024 / 1024;
    const heapMB = mem.heapUsed / 1024 / 1024;
    console.log(`📊 Memory — RSS: ${rssMB.toFixed(1)}MB | Heap: ${heapMB.toFixed(1)}MB`);
    if (rssMB > RSS_LIMIT_MB) {
        console.error(`🚨 RSS (${rssMB.toFixed(1)}MB) crossed ${RSS_LIMIT_MB}MB limit! Restarting cleanly before host force-kills us...`);
        process.exit(1);
    }
}, STABILITY_CHECK_INTERVAL);

const express = require('express');
const app = express();
const port = process.env.PORT || process.env.SERVER_PORT || process.env.APP_PORT || 8000;
const bodyParser = require('body-parser');
const cors = require('cors');

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

// 🚨 502 FIX (Ahmad screenshot: "Application failed to respond" on Railway):
// app.listen() now happens FIRST, before the heavy require('./main') below —
// which loads Baileys, connects to Mongo, and require()s 130+ plugin files.
// Previously, if ANY of that threw synchronously during require(), the
// process died before app.listen() was ever reached — the port never
// opened, Railway's proxy got no response at all, and that's exactly what
// produces a bare 502 with no useful error on screen. Binding the port
// immediately means Railway always gets SOME response, and a boot failure
// now shows up as a readable in-browser error (see the catch block below)
// instead of a silent gateway timeout.
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});

let pairRouter;
try {
    pairRouter = require('./main');
    app.use('/', pairRouter);
} catch (e) {
    console.error('🚨 FATAL: main.js failed to load — bot did not start:', e);
    app.use((req, res) => {
        res.status(500).send(
            `<pre>Bot failed to start.\n\n${e.stack || e.message}\n\nCheck Railway/Katabump deploy logs for the full error.</pre>`
        );
    });
}

// 🚨 STABILITY FIX (Ahmad: "bot lagate hi auto disconnect ho jata" on
// Katabump): many free/low-tier hosts put a service to sleep — or kill and
// respawn it — if it goes a while without receiving any EXTERNAL HTTP
// request, even though the WhatsApp socket inside is still perfectly alive.
// From the outside that looks exactly like "the bot randomly disconnects".
// If a public URL for this deployment is set (KEEP_ALIVE_URL, or the
// common Railway-style env vars), this pings that URL every 4 minutes to
// keep the host treating it as active. Completely inert if no URL is set —
// safe to leave in even when it doesn't apply to your host.
const KEEP_ALIVE_URL = process.env.KEEP_ALIVE_URL
    || (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null)
    || (process.env.RENDER_EXTERNAL_URL || null);
if (KEEP_ALIVE_URL) {
    const axios = require('axios');
    setInterval(() => {
        axios.get(KEEP_ALIVE_URL, { timeout: 10000 }).catch(() => {});
    }, 4 * 60 * 1000);
    console.log(`♻️ Keep-alive self-ping enabled: ${KEEP_ALIVE_URL}`);
} else {
    console.log('ℹ️ KEEP_ALIVE_URL not set — self-ping disabled. If your host sleeps idle services, set KEEP_ALIVE_URL to your app\'s public URL.');
}

// Start Telegram pairing bot
try {
    require('./telegram-pair');
} catch (e) {
    console.error('Telegram pairing bot failed to start:', e.message);
}

module.exports = app;
