// 🚨 SPEED FIX (Ahmad: "download etc me speed boht kam hai"): most download
// commands here try several fallback APIs in sequence (see lib/fallback-
// chain.js) — if provider #1 is down/rate-limited, the bot doesn't move to
// provider #2 until provider #1's own call times out. Several of these
// JSON-lookup calls (just "give me the file's URL", not the actual file)
// had 20-30s timeouts, so one dead provider alone could cost 20-30 real
// seconds before the bot even tried the next option — with 3-4 providers
// per command, a fully-dead first pick meant a full minute+ of silence.
// Lowered those lookup-call timeouts to 10s (a healthy API answers in
// under 2s normally, so 10s is still generous slack, not aggressive).
// Timeouts on the actual media-file downloads (responseType: 'arraybuffer')
// are untouched — those need the extra time for genuinely large files.
const { cmd } = require('../ahmad-core');
const axios = require('axios');
const yts = require('yt-search');
const config = require('../config');
const path = require('path');
const fs = require('fs');
const { fakevCard } = require('../lib/fakevCard');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
const { randomFooter, toSansBold } = require('../lib/menu-styles');
// 🆕 (Bunty: "queue wala crash na ho") — bounds how many yt-dlp/ffmpeg
// jobs run at the same time across the whole bot.
const { heavyQueue } = require('../lib/queue');
ffmpeg.setFfmpegPath(ffmpegPath);

const FOOTER = randomFooter();

// 🚨 SPEED FIX (Bunty: ".play/.video bohot slow" — root cause found): this
// AXIOS_DEFAULTS timeout, plus the even longer 60s/120s timeouts on the
// actual file-download step below, are used by an 8-deep fallback cascade
// (dlAudio) / 6-deep cascade (dlVideo) that runs STRICTLY ONE AFTER ANOTHER.
// Free scraper APIs like these go down or rate-limit constantly — and every
// time an early one was dead, the bot silently waited up to its FULL
// timeout before trying the next, method after method. Worst case before
// this fix: 30s+120s+120s+60s+30s+120s+... could add up to several
// MINUTES before a working method was even reached. Every timeout in this
// cascade is now much shorter, so a dead API fails fast and the bot moves
// on to the next method quickly instead of hanging.
const AXIOS_DEFAULTS = {
    timeout: 10000,
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json, text/plain, */*'
    }
};

// Still used by the separate .video/.ytmp4 command below (untouched in this
// fix — Bunty asked specifically for .play, not .video) — kept so that
// command doesn't break.
let ytdl = null;
try { ytdl = require('@distube/ytdl-core'); } catch { ytdl = null; }

// 🚨 REWRITE (Bunty: ".play API se nahi, pkg.js se banao" — all 6 free
// scraper APIs were confirmed dead from live logs: Vreden/Alya = DNS dead,
// Okatsu = now paid (402), Cobalt public = blocked YouTube + needs auth
// (400), Yupra/EliteProTech = timing out. ytdl-core also confirmed dead via
// YouTube's "Sign in to confirm you're not a bot" check. .play (ytmp3) now
// goes through ONLY the yt-dlp package (yt-dlp-wrap) — no HTTP scraper APIs
// at all. yt-dlp is community-updated within days of every YouTube change,
// which is why it's the one method still standing.
//
// IMPORTANT — even yt-dlp itself hits the same "Sign in to confirm you're
// not a bot" wall on datacenter hosts (Railway/Render) without a real
// logged-in session. Fix: export your YouTube cookies once (browser
// extension "Get cookies.txt LOCALLY" while logged into youtube.com) and
// upload the file as /cookies.txt at the project root (next to config.js).
// If that file exists it's passed to yt-dlp automatically; if it's missing,
// yt-dlp still runs but may hit the bot-check on some videos.
const YTDlpWrapLib = (() => {
    try { return require('yt-dlp-wrap').default || require('yt-dlp-wrap'); }
    catch { return null; }
})();
const YTDLP_BIN = path.join(__dirname, '..', 'bin', 'yt-dlp' + (process.platform === 'win32' ? '.exe' : ''));
const COOKIES_PATH = path.join(__dirname, '..', 'cookies.txt');
let ytDlpWrap = null;

// One-time binary fetch + reusable wrap instance. Safe to call every
// command run — after the first successful download this just returns the
// cached instance immediately.
//
// 🚨 CRASH FIX (Bunty screenshot: "ImportError: You are using an
// unsupported version of Python. Only Python versions 3.10 and above are
// supported by yt-dlp") — YTDlpWrapLib.downloadFromGithub() was pulling
// the default `yt-dlp` release asset, which is a Python zipapp that runs
// against whatever python3 is already on the host. Railway's container
// has Python 3.9, so EVERY yt-dlp call died with this ImportError — the
// last-resort fallback was silently broken the whole time, so whenever
// both quick-try APIs were down too (as in the screenshots), .play/.video
// had zero working paths left. Fix: fetch the standalone `yt-dlp_linux`
// binary instead — it bundles its own Python runtime inside the
// executable, so it doesn't care what (or whether) system Python is
// installed. Same yt-dlp-wrap API works with either binary.
async function ensureYtDlp() {
    if (!YTDlpWrapLib) throw new Error('yt-dlp-wrap package missing — run: npm install yt-dlp-wrap');
    if (ytDlpWrap) return ytDlpWrap;
    // If a bin/ directory persists across redeploys (e.g. a mounted volume)
    // it may still hold the OLD broken python-zipapp binary from before
    // this fix — the marker file below only exists once the standalone
    // yt-dlp_linux build has actually been written, so its absence forces
    // one clean re-download instead of reusing a binary that's known-bad.
    const VERIFIED_MARKER = YTDLP_BIN + '.linux-verified';
    const needsFreshBinary = process.platform !== 'win32'
        ? (!fs.existsSync(YTDLP_BIN) || !fs.existsSync(VERIFIED_MARKER))
        : !fs.existsSync(YTDLP_BIN);
    if (needsFreshBinary) {
        fs.mkdirSync(path.dirname(YTDLP_BIN), { recursive: true });
        console.log('[YTDLP] binary not found, downloading standalone yt-dlp_linux (one-time)...');
        if (process.platform === 'win32') {
            // Windows dev machines: the python-zipapp build is fine there
            // since it's just for local testing, not the Railway deploy.
            await YTDlpWrapLib.downloadFromGithub(YTDLP_BIN);
        } else {
            // 🚨 CRASH/OOM FIX (Bunty: "bot offline ho jata, .play per crash"
            // — logs showed the process getting SIGKILLed by the host right
            // after "binary ready"): responseType 'arraybuffer' pulled the
            // entire ~40MB binary into memory as one buffer, then
            // Buffer.from() made a SECOND full copy before it ever touched
            // disk. On a memory-constrained host (KataBump/Railway free
            // tier) that spike — on top of whatever else the bot already
            // had in RAM — was enough to trip the OOM killer and take the
            // whole process down, not just the .play command. Streaming
            // the response straight to a file never holds more than a
            // small chunk in memory at once.
            const writer = fs.createWriteStream(YTDLP_BIN);
            const dlRes = await axios.get(
                'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux',
                { responseType: 'stream', timeout: 60000 }
            );
            try {
                await new Promise((resolve, reject) => {
                    dlRes.data.pipe(writer);
                    writer.on('finish', resolve);
                    writer.on('error', reject);
                    dlRes.data.on('error', reject);
                });
            } catch (streamErr) {
                // Partial/corrupt file — remove it so the next attempt
                // re-downloads clean instead of reusing broken bytes.
                try { if (fs.existsSync(YTDLP_BIN)) fs.unlinkSync(YTDLP_BIN); } catch {}
                throw streamErr;
            }
            fs.chmodSync(YTDLP_BIN, 0o755);
            fs.writeFileSync(VERIFIED_MARKER, String(Date.now()));
        }
        console.log('[YTDLP] binary ready:', YTDLP_BIN);
    }
    ytDlpWrap = new YTDlpWrapLib(YTDLP_BIN);
    return ytDlpWrap;
}

function cookieArgs() {
    return fs.existsSync(COOKIES_PATH) ? ['--cookies', COOKIES_PATH] : [];
}

// 🚨 FIX (Bunty: ".play mein audio error, .video theek hai") — root cause:
// dlAudio's yt-dlp fallback runs `-x --audio-format mp3`, which makes yt-dlp
// do its OWN internal ffmpeg post-processing (extract + convert audio) —
// that's a SEPARATE ffmpeg call from the fluent-ffmpeg one used above for the
// opus conversion, and yt-dlp has no idea the @ffmpeg-installer/ffmpeg binary
// (`ffmpegPath`) even exists. It only looks for an `ffmpeg` binary on the
// system PATH. On hosts without ffmpeg installed globally (Railway etc.)
// that lookup fails, so `-x` silently errors out — while .video's plain
// `-f best[ext=mp4]/best` usually grabs an already-muxed stream and never
// needs that internal ffmpeg step at all, which is exactly why "video works,
// play doesn't". Passing --ffmpeg-location points yt-dlp at the SAME
// installed binary fluent-ffmpeg already uses, for both commands.
function ffmpegLocationArgs() {
    return ['--ffmpeg-location', path.dirname(ffmpegPath)];
}

// RapidAPI — Social Download All-in-One (requires your own key — get one at rapidapi.com)
const RAPID_API_KEY = config.RAPID_API_KEY || '';
const RAPID_API_URL = 'https://social-download-all-in-one.p.rapidapi.com/v1/social/autolink';

function chanCtx() {
    return {
        forwardingScore: 999, isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: config.CHANNEL_JID || '120363427856127926@newsletter',
            newsletterName: config.BOT_NAME || '™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 ᥫᩣ',
            serverMessageId: 2
        }
    };
}

function dlBox(title, lines, emoji = '⬇️') {
    return `╭═══ ${emoji} ${toSansBold(title)} ═══⊷\n┃❃╭──────────────\n${lines.map(l=>`┃❃│ ${toSansBold(l)}`).join('\n')}\n┃❃╰───────────────\n╰═════════════════⊷\n\n> ✦﹒𝙊𝘽𝙎𝙄𝘿𝙄𝘼𝙉 𝙇𝙐𝙓𝙀 𝘼𝙃𝙈𝘼𝘿 𝙈𝙄𝙉𝙄`;
}

// Universal social media downloader (RapidAPI)
async function socialDownload(url) {
    if (!RAPID_API_KEY) throw new Error('RapidAPI key not configured. Set RAPID_API_KEY in config.js.');
    const res = await axios.post(RAPID_API_URL, { url }, {
        headers: {
            'Content-Type': 'application/json',
            'X-RapidAPI-Host': 'social-download-all-in-one.p.rapidapi.com',
            'X-RapidAPI-Key': RAPID_API_KEY
        },
        timeout: 10000
    });
    return res.data;
}

// YouTube search helper
async function ytSearch(query) {
    const isUrl = query.includes('youtube.com') || query.includes('youtu.be');
    if (isUrl) {
        // 🚀 SPEED FIX (Bunty: "downloading slow hai" — root cause found): this
        // used to always spin up a FULL yt-dlp subprocess (--dump-json) just to
        // get the title/thumbnail for the "⏳ Downloading..." preview message —
        // then dlAudio/dlVideo below spins up a SECOND yt-dlp subprocess for the
        // actual download. Two full yt-dlp processes back-to-back, every single
        // time a link is pasted, roughly doubled the wait. YouTube's own oEmbed
        // endpoint returns title/author/thumbnail in one lightweight HTTP call
        // (no subprocess, no bot-check, no cookies needed) — use that first and
        // only fall back to the slower yt-dlp dump-json if oEmbed itself fails
        // (e.g. private/age-restricted videos oEmbed can't see).
        try {
            const oembed = await axios.get('https://www.youtube.com/oembed', {
                params: { url: query, format: 'json' },
                timeout: 6000
            });
            return {
                url: query,
                title: oembed.data.title,
                duration: '', // not available via oEmbed — omitted from the preview box
                views: '',
                author: oembed.data.author_name || 'Unknown',
                thumb: oembed.data.thumbnail_url
            };
        } catch (e) {
            console.log('[YTSEARCH] oEmbed failed, falling back to yt-dlp dump-json:', e.message);
        }
        const wrap = await ensureYtDlp();
        const raw = await wrap.execPromise([query, '--dump-json', '--no-playlist', '--skip-download', ...cookieArgs()]);
        const info = JSON.parse(raw.trim().split('\n')[0]);
        return {
            url: query,
            title: info.title,
            duration: (info.duration || 0) + 's',
            views: (info.view_count || 0).toLocaleString(),
            author: info.uploader || info.channel || 'Unknown',
            thumb: info.thumbnail
        };
    }
    // 🔍 DIAGNOSTIC FIX (Bunty: "sari api sahi hein, kuch bhi nahi chal
    // raha" — root cause found): yt-search scrapes YouTube's own search
    // page HTML with cheerio, which breaks whenever YouTube changes that
    // page's structure — completely independent of the 6 download APIs
    // below. If this throws, EVERY non-URL query (i.e. ".play <song
    // name>", not a pasted link) fails before ever reaching a download API,
    // and used to show the exact same "Download failed!" message — making
    // it look like the download APIs were the problem when they were never
    // even tried. Tagged separately here so it's obvious in logs.
    let search;
    try {
        search = await yts(query);
    } catch (e) {
        console.log('[YTSEARCH] yt-search itself threw (YouTube page format may have changed):', e.message);
        throw new Error('YTSEARCH_FAILED: ' + e.message);
    }
    if (!search.videos?.length) throw new Error('No results');
    const v = search.videos[0];
    return { url: v.url, title: v.title, duration: v.timestamp, views: v.views?.toLocaleString() || '0', author: v.author?.name, thumb: v.thumbnail };
}

// 🚨 BUG FIX: dlAudio() used to write whatever bytes an API returned straight
// to disk and consider it "success" — if an API was down/rate-limited and
// returned an HTML error page or an empty/tiny body instead of real audio,
// that garbage got saved as .mp3 and sent to the user, causing WhatsApp's
// "this audio is not available / something is wrong with the audio file".
// This checks the buffer actually looks like audio before accepting it.
// 🚨 BUG FIX: even with the header/signature check, a download that gets cut
// short mid-stream (network hiccup, server closing early) still starts with
// a perfectly valid audio header — isLikelyAudio alone can't catch that. This
// compares the server's declared Content-Length against what we actually
// received; a mismatch means the file is truncated/incomplete.
function isTruncatedDownload(axiosResponse, buffer) {
    const declaredLen = Number(axiosResponse.headers?.['content-length']);
    if (!declaredLen) return false; // server didn't tell us, can't check — allow it through
    return buffer.length < declaredLen - 500; // small tolerance for chunked edge cases
}

function isLikelyAudio(buffer) {
    if (!buffer || buffer.length < 15000) return false; // real songs are always well over this
    const head = buffer.slice(0, 12);
    const asText = head.toString('utf8', 0, 20).trim().toLowerCase();
    if (asText.startsWith('<') || asText.startsWith('{') || asText.startsWith('<!doctype')) return false; // HTML/JSON error body
    // Common audio signatures: ID3 (mp3), MPEG frame sync, OGG, RIFF/WAVE, ftyp (m4a/mp4 audio)
    if (head.slice(0, 3).toString('latin1') === 'ID3') return true;
    if (head[0] === 0xFF && (head[1] & 0xE0) === 0xE0) return true; // raw MPEG frame sync
    if (head.slice(0, 4).toString('latin1') === 'OggS') return true;
    if (head.slice(0, 4).toString('latin1') === 'RIFF') return true;
    if (head.slice(4, 8).toString('latin1') === 'ftyp') return true;
    return true; // unknown-but-large binary: allow it through rather than false-reject valid exotic encodings
}

// 🚨 BUG FIX: even after validating the buffer looks like SOME kind of audio,
// the caller always sent it to WhatsApp declaring mimetype 'audio/mpeg' (MP3)
// regardless of what the source API actually returned (some give back m4a/aac,
// opus/webm, or ogg containers). WhatsApp trusts the declared mimetype to pick
// how to play the file — a real m4a file labeled as audio/mpeg still shows
// "something is wrong with the audio file" even though the bytes are fine.
// This inspects the actual bytes and returns the correct mimetype/extension.
function detectAudioFormat(buffer) {
    const head = buffer.slice(0, 12);
    if (head.slice(0, 3).toString('latin1') === 'ID3' || (head[0] === 0xFF && (head[1] & 0xE0) === 0xE0)) {
        return { mimetype: 'audio/mpeg', ext: 'mp3' };
    }
    if (head.slice(4, 8).toString('latin1') === 'ftyp') {
        return { mimetype: 'audio/mp4', ext: 'm4a' };
    }
    if (head.slice(0, 4).toString('latin1') === 'OggS') {
        return { mimetype: 'audio/ogg', ext: 'ogg' };
    }
    if (head.slice(0, 4).toString('latin1') === 'RIFF') {
        return { mimetype: 'audio/wav', ext: 'wav' };
    }
    // Fallback: still claim mp3, but this only happens for unrecognized headers.
    return { mimetype: 'audio/mpeg', ext: 'mp3' };
}

// 🚨 FIX (Bunty screenshot: "Connection was lost" statusCode=408 mid-.play,
// logged as "PLUGIN ERROR [play]: Connection Closed") — this isn't the bot
// process crashing (index.js's unhandledRejection/uncaughtException guards
// plus main.js's own per-plugin try/catch already prevent that — confirmed
// by "Normal closure... no restart needed" right after in the same log).
// What actually happens: Baileys' WhatsApp socket drops and reconnects
// while a slow multi-second download is still in flight, so the FINAL
// conn.sendMessage() (sending the actual audio/video) throws because the
// socket it was holding a reference to is now dead — even though a fresh
// socket is already back up a moment later. Previously this just failed
// the whole command with no retry. Now: on a connection-shaped error, wait
// for the reconnect to settle, then retry the send once on the current
// (now-live) connection before giving up for real.
async function sendWithRetry(conn, jid, content, options) {
    try {
        return await conn.sendMessage(jid, content, options);
    } catch (e) {
        const msg = String(e.message || '');
        const isConnIssue = /connection|closed|timed?\s?out|408|ECONNRESET|socket/i.test(msg);
        if (!isConnIssue) throw e;
        console.log('[SEND RETRY] connection blip on send, retrying once in 3s:', msg);
        await new Promise(r => setTimeout(r, 3000));
        return await conn.sendMessage(jid, content, options); // let it throw for real if this one also fails
    }
}

// 🚨 BUG FIX (Bunty: "kabhi thumbnail hi aata hai, uske baad na video na
// error" — silence after the thumbnail): the final "❌ Download failed!"
// message in .play/.video's catch blocks used to be a bare, un-awaited
// `reply(...)` call — a fire-and-forget promise with NO retry and nothing
// awaiting it. If that one text send hit the exact same kind of transient
// group-send hiccup that thumbnails already needed a fix for, it silently
// became an unhandled rejection: the user saw the thumbnail, then nothing
// — not even an error — because the message telling them it failed had
// itself failed to send, invisibly. This is now awaited AND retried once,
// same as the real media sends already are, so the person always gets
// SOME message back — either the result or a real "it failed" notice.
async function replyWithRetry(conn, from, mek, text) {
    try {
        await conn.sendMessage(from, { text }, { quoted: mek });
    } catch (e) {
        console.log('[ERROR-REPLY] first attempt failed, retrying once in 2s:', e.message);
        try {
            await new Promise(r => setTimeout(r, 2000));
            await conn.sendMessage(from, { text }, { quoted: mek });
        } catch (e2) {
            console.log('[ERROR-REPLY] gave up, message never reached the chat:', e2.message);
        }
    }
}

// 🚀 SPEED FIX (Bunty confirmed: JawadTech is permanently dead, don't even
// try it anymore — every attempt was pure wasted time). Straight to
// AdeelXtech, then yt-dlp if that fails. Timeout kept tight since there's
// no longer a second API to race against.
// 🚨 CRASH FIX (Bunty: "kabhi kabhi bot crash reconnect karna parta") — root
// cause: this ran as the FIRST attempt for EVERY .video and as the fallback
// for .play, buffering the ENTIRE video into RAM via responseType:
// 'arraybuffer' with NO size limit — AdeelXtech returns whatever quality it
// wants (often 720p/1080p+, uncapped). On a memory-constrained host
// (Railway/Goku free tier ~512MB-1GB), a longer/higher-res video blew the
// heap and got the whole container OOM-killed — this shows up as "bot
// crashed, had to reconnect", a separate failure mode from the (also real)
// "Download failed!" case where every provider legitimately failed. Capping
// maxContentLength/maxBodyLength makes axios abort the moment the response
// crosses the cap instead of finishing the buffer in memory — it throws and
// falls through to the safer yt-dlp path below (already capped to 480p and
// written to disk, not RAM) instead of crashing the process.
const MAX_QUICKAPI_VIDEO_BYTES = 20 * 1024 * 1024; // 🚨 (Bunty: ".play thumbnail late, phir bot crash") lowered from 30MB — on a memory-constrained host, several of these buffers held in Node memory at once (queue allows up to 4 concurrent) can add up to a real OOM risk. 20MB is still plenty for a short clip's video, smaller worst-case footprint.

// 🚀 RE-ENABLED (Bunty confirmed JawadTech is back up and working again,
// wants it added for real speed on both .play and .video): this was
// previously removed after Bunty confirmed it was permanently dead — that
// was true at the time, but APIs do come back. Used two ways below:
//   - .video: send the returned mp4 link straight to WhatsApp as a URL
//     reference (conn.sendMessage(..., { video: { url } })) — NO
//     server-side download/re-upload roundtrip at all, exactly the fast
//     pattern Bunty's own working snippet used. This is the biggest
//     speed win available: skips the download-then-reupload entirely.
//   - .play: still needs actual bytes (to run through the existing
//     opus/voice-note conversion pipeline), so its bytes are downloaded
//     and the audio extracted via ffmpeg — slower than the video path,
//     but still just one API call instead of spawning yt-dlp.
async function getJawadTechResult(videoUrl) {
    const apiUrl = `https://jawad-tech.vercel.app/download/ytdl?url=${encodeURIComponent(videoUrl)}`;
    const { data } = await axios.get(apiUrl, { ...AXIOS_DEFAULTS, timeout: 3000 });
    if (!data?.status || !data?.result?.mp4) throw new Error('JawadTech: no usable result');
    return {
        mp4: data.result.mp4,
        title: data.result.title || null,
        thumbnail: data.result.thumbnail || null,
        duration: data.result.duration || null
    };
}

async function getAdeelXtechVideoLink(videoUrl) {
    const apiUrl = `https://adeel-xtech-apis.vercel.app/api/ytmp4?url=${encodeURIComponent(videoUrl)}`;
    const { data } = await axios.get(apiUrl, { ...AXIOS_DEFAULTS, timeout: 3000 });
    return (data?.status && data?.result?.video_download) || null;
}

// 🆕 (Bunty: "BUNTY_MD wali file may .song/.video fully working hai, hamare
// may bhi lagao, branding hamari rahay") — ported straight from that
// confirmed-working code as extra providers in the SAME quick-API chains
// below, not a replacement UI/box/branding stays exactly as it was.
async function getEliteProTechAudioLink(videoUrl) {
    const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(videoUrl)}&format=mp3`;
    const { data } = await axios.get(apiUrl, { ...AXIOS_DEFAULTS, timeout: 3000 });
    return (data?.success && data?.downloadURL) || null;
}
async function getEliteProTechVideoLink(videoUrl) {
    const apiUrl = `https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(videoUrl)}&format=mp4`;
    const { data } = await axios.get(apiUrl, { ...AXIOS_DEFAULTS, timeout: 3000 });
    return (data?.success && data?.downloadURL) || null;
}
async function getYupraAudioLink(videoUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp3?url=${encodeURIComponent(videoUrl)}`;
    const { data } = await axios.get(apiUrl, { ...AXIOS_DEFAULTS, timeout: 3000 });
    return (data?.success && data?.data?.download_url) || null;
}
async function getYupraVideoLink(videoUrl) {
    const apiUrl = `https://api.yupra.my.id/api/downloader/ytmp4?url=${encodeURIComponent(videoUrl)}`;
    const { data } = await axios.get(apiUrl, { ...AXIOS_DEFAULTS, timeout: 3000 });
    return (data?.success && data?.data?.download_url) || null;
}
async function getOkatsuAudioLink(videoUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp3?url=${encodeURIComponent(videoUrl)}`;
    const { data } = await axios.get(apiUrl, { ...AXIOS_DEFAULTS, timeout: 3000 });
    return data?.dl || null;
}
async function getOkatsuVideoLink(videoUrl) {
    const apiUrl = `https://okatsu-rolezapiiz.vercel.app/downloader/ytmp4?url=${encodeURIComponent(videoUrl)}`;
    const { data } = await axios.get(apiUrl, { ...AXIOS_DEFAULTS, timeout: 3000 });
    return (data?.result && data.result.mp4) || null;
}
async function getAlyaAudioLink(videoUrl) {
    const apiUrl = `https://api.alyachan.pro/api/ytmp3?url=${encodeURIComponent(videoUrl)}&apikey=G7I6X7`;
    const { data } = await axios.get(apiUrl, { ...AXIOS_DEFAULTS, timeout: 3000 });
    return (data?.status && data?.data?.url) || null;
}
async function getVredenAudioLink(videoUrl) {
    const apiUrl = `https://api.vreden.my.id/api/ytmp3?url=${encodeURIComponent(videoUrl)}`;
    const { data } = await axios.get(apiUrl, { ...AXIOS_DEFAULTS, timeout: 3000 });
    return (data?.status && data?.result?.download?.url) || null;
}

// 🚀 RELIABILITY FIX (Bunty: "gc me downloader kabhi to chalta hai kabhi
// nahi" — intermittent, no fixed pattern): since JawadTech was dropped
// there's only ONE quick-API provider left (AdeelXtech). A single provider
// having a momentary blip (cold start, brief rate-limit, one slow response)
// used to fail the whole quick path instantly and fall through straight to
// the much slower yt-dlp route — which is exactly the "sometimes fast,
// sometimes crawls" pattern. One short retry catches those transient blips
// without meaningfully slowing down the common case where it just works.
//
// 🚨 EMPTIED (Bunty: "jo fail hai sab nikal do, only jo working wo rakho")
// — across every single log Bunty's sent in this whole debugging session,
// NONE of AdeelXtech/EliteProTech/Yupra ever once succeeded for video:
// AdeelXtech = timeout every time, Yupra = timeout every time, EliteProTech
// now returns 410 Gone (the endpoint's been permanently removed, not just
// down). The only quick video source that's actually worked is JawadTech's
// direct-URL fast path, which runs separately before this chain even
// starts (see the ytmp4 command handler). Leaving this array empty means
// a dead JawadTech attempt falls straight to yt-dlp instead of burning
// another 9-10s probing three endpoints that have never once worked.
const VIDEO_LINK_PROVIDERS = [];

async function raceQuickApis(videoUrl) {
    let lastError;
    for (const provider of VIDEO_LINK_PROVIDERS) {
        try {
            const link = await provider.method(videoUrl);
            if (!link) throw new Error(`${provider.name}: no usable result`);
            const vidRes = await axios.get(link, {
                responseType: 'arraybuffer',
                timeout: 20000,
                maxContentLength: MAX_QUICKAPI_VIDEO_BYTES,
                maxBodyLength: MAX_QUICKAPI_VIDEO_BYTES
            });
            const buf = Buffer.from(vidRes.data);
            if (buf.length < 15000) throw new Error(`${provider.name}: file too small`);
            return buf;
        } catch (e) {
            console.log(`[QUICK-VIDEO] ${provider.name} failed:`, e.message);
            lastError = e;
        }
    }
    throw lastError || new Error('All quick-video providers failed');
}

// 🚀 EASY-MODE FIX (Bunty: ".play bhi aisay fast/no-cookies, audio wala") —
// same idea as getQuickVideoLink for .video: ask AdeelXtech for a direct
// audio link first, skip yt-dlp (and its cookies dependency) entirely when
// this works. Unlike video though, we still pull the bytes into memory and
// run them through the EXISTING isLikelyAudio/opus-conversion pipeline
// below (rather than handing WhatsApp a raw URL) — audio has a real history
// in this bot of "audio not available" errors caused by wrong/raw
// mimetypes (see the CRASH/BUG FIX comments above), so keeping the proven
// validate+convert step is worth the small extra memory cost (audio files
// are only a few MB, nowhere near the video OOM risk this bot hit).
// Capped at 20MB and marked invalid if it doesn't look like real audio, so
// a dead/wrong-shaped API response falls straight through to yt-dlp.
const MAX_QUICKAPI_AUDIO_BYTES = 20 * 1024 * 1024;

// 🚨 EMPTIED (Bunty: "jo fail hai sab nikal do, only jo working wo rakho")
// — same three providers, same result: not one single success for audio
// across every log Bunty's sent (AdeelXtech = 500 every time, EliteProTech
// = timeout/now 410, Yupra = timeout every time). No quick-audio source has
// ever actually worked in this whole debugging session, so .play now skips
// straight to yt-dlp instead of burning ~9s probing dead endpoints first.
// If a genuinely working free API turns up later, add it back here.
const AUDIO_LINK_PROVIDERS = [];

async function getQuickAudioBuffer(videoUrl) {
    let lastError;
    for (const provider of AUDIO_LINK_PROVIDERS) {
        try {
            const link = await provider.method(videoUrl);
            if (!link) throw new Error(`${provider.name}: no usable result`);
            const res = await axios.get(link, {
                responseType: 'arraybuffer',
                timeout: 20000,
                maxContentLength: MAX_QUICKAPI_AUDIO_BYTES,
                maxBodyLength: MAX_QUICKAPI_AUDIO_BYTES
            });
            const buf = Buffer.from(res.data);
            if (!isLikelyAudio(buf)) throw new Error(`${provider.name}: response not valid audio`);
            return buf;
        } catch (e) {
            console.log(`[QUICK-AUDIO] ${provider.name} failed:`, e.message);
            lastError = e;
        }
    }
    throw lastError || new Error('All quick-audio providers failed');
}

async function dlAudio(videoUrl, outPath) {
    // Easy no-cookies path first: quick direct audio link, validated then
    // written straight to outPath — same file the rest of this function
    // (and the caller's opus-conversion step) already expects.
    try {
        const buf = await getQuickAudioBuffer(videoUrl);
        fs.writeFileSync(outPath, buf);
        return;
    } catch (e) {
        console.log('[YTMP3] quick no-cookies audio link failed, falling back to yt-dlp:', e.message);
    }

    // 🚨 ORDER BUG FIX (Bunty: ".play phir se slow ho gaya"): the comment
    // right below this used to say "try yt-dlp bestaudio FIRST... the old
    // video-API-then-strip method is now just the FALLBACK" — but the
    // actual code order had it backwards: the slow JawadTech path (download
    // an ENTIRE video, then strip audio with ffmpeg) was running BEFORE the
    // fast yt-dlp bestaudio-only extraction. Every single .play that missed
    // the quick-audio-link path was paying for a full video download it
    // didn't need before even trying the fast option. Swapped to match
    // what the comment always said the order should be.
    //
    // 🚀 SPEED FIX (Bunty: "search fast hai but download slow, seconds mein
    // chahiye") — yt-dlp -f bestaudio downloads only the small audio-only
    // stream directly, no wasted video bandwidth, no local re-encode of a
    // full video.
    //
    // 🚀 SPEED FIX (Bunty: "download cmds slow hein"): this used to pass
    // -x --audio-format mp3 --audio-quality 0, which makes yt-dlp run its
    // OWN ffmpeg pass to transcode the raw downloaded stream into mp3 —
    // and then the .play command handler (downloaders.js, ytmp3 cmd)
    // ALWAYS runs a SECOND ffmpeg pass afterward anyway, converting that
    // mp3 into opus/ogg (WhatsApp voice-note format). Every single .play
    // was paying for two full audio transcodes back-to-back for no
    // benefit — the intermediate mp3 was thrown away immediately after
    // being created. Now yt-dlp just saves the raw bestaudio stream
    // as-is (webm/opus or m4a, whatever YouTube serves) with no
    // postprocessing of its own; the handler's existing single ffmpeg
    // pass converts that raw stream straight to opus. isLikelyAudio()
    // below and the handler's ffmpeg step both work on file BYTES, not
    // the .mp3 name in outPath, so this is safe even though the actual
    // container isn't really mp3 — one transcode instead of two, so this
    // step should noticeably cut real time off every successful .play.
    const wrap = await ensureYtDlp();
    const fastArgs = [videoUrl, '-f', 'bestaudio/best',
        '--no-playlist', '-o', outPath, ...cookieArgs(), ...ffmpegLocationArgs()];
    try {
        await wrap.execPromise(fastArgs);
        if (fs.existsSync(outPath) && isLikelyAudio(fs.readFileSync(outPath))) return;
        try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch {}
    } catch (e) {
        console.log('[YTMP3] fast yt-dlp bestaudio failed, falling back to JawadTech:', e.message);
    }

    // 🚀 RE-ENABLED (Bunty confirmed JawadTech working again): downloads the
    // (small-ish, capped) video bytes and strips audio via ffmpeg — the
    // slow path, now correctly LAST-resort-before-plain-yt-dlp instead of
    // first.
    try {
        const jt = await getJawadTechResult(videoUrl);
        const vidRes = await axios.get(jt.mp4, {
            responseType: 'arraybuffer', timeout: 20000, family: 4,
            maxContentLength: MAX_QUICKAPI_VIDEO_BYTES, maxBodyLength: MAX_QUICKAPI_VIDEO_BYTES
        });
        const tempVideoPath = outPath.replace(/\.mp3$/, '_jt_temp.mp4');
        fs.writeFileSync(tempVideoPath, Buffer.from(vidRes.data));
        // 🚨 MEMORY FIX (Bunty: ".play crash" — OOM risk on constrained
        // hosts): the video is now safely on disk, so drop the in-memory
        // copy immediately instead of holding both the Buffer AND the file
        // for the whole ffmpeg conversion — cuts this step's peak memory
        // roughly in half.
        vidRes.data = null;
        try {
            await new Promise((resolve, reject) => {
                ffmpeg(tempVideoPath).noVideo().audioCodec('libmp3lame').audioBitrate('128k').format('mp3')
                    .on('end', resolve).on('error', reject).save(outPath);
            });
        } finally {
            try { fs.unlinkSync(tempVideoPath); } catch {}
        }
        if (fs.existsSync(outPath) && isLikelyAudio(fs.readFileSync(outPath))) return;
        try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch {}
    } catch (e) {
        console.log('[YTMP3] JawadTech fallback failed, falling back to quick API race:', e.message);
    }

    let videoBuf = null;
    try {
        videoBuf = await raceQuickApis(videoUrl);
    } catch (e) {
        const msgs = (e.errors || [e]).map(x => x.message).join(' | ');
        console.log('[YTMP3] quick API fallback also failed:', msgs);
    }
    if (videoBuf) {
        const tempVideoPath = outPath.replace(/\.mp3$/, '_race_temp.mp4');
        fs.writeFileSync(tempVideoPath, videoBuf);
        try {
            await new Promise((resolve, reject) => {
                ffmpeg(tempVideoPath).noVideo().audioCodec('libmp3lame').audioBitrate('128k').format('mp3')
                    .on('end', resolve).on('error', reject).save(outPath);
            });
        } finally {
            try { fs.unlinkSync(tempVideoPath); } catch {}
        }
        if (fs.existsSync(outPath) && isLikelyAudio(fs.readFileSync(outPath))) return;
    }

    // Last resort: plain yt-dlp extraction without forcing bestaudio, in case
    // that format simply isn't available for this video.
    const args = [videoUrl, '-x', '--audio-format', 'mp3', '--audio-quality', '0',
        '--no-playlist', '-o', outPath, ...cookieArgs(), ...ffmpegLocationArgs()];
    try {
        await wrap.execPromise(args);
    } catch (e) {
        throw new Error('yt-dlp: ' + e.message);
    }
    if (!fs.existsSync(outPath) || !isLikelyAudio(fs.readFileSync(outPath))) {
        try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch {}
        throw new Error('yt-dlp: no valid audio produced (bot-check likely — check /cookies.txt)');
    }
}

async function dlVideo(videoUrl, outPath) {
    // 🚨 SPEED FIX (Ahmad screenshot: ".video/.play too slow" — logs showed
    // "[YTMP4] quick path took 22751ms" immediately followed by "[YTMP4] both
    // quick APIs failed, falling back to yt-dlp" with the SAME 403 error):
    // the ytmp4 command handler already calls raceQuickApis() once (and logs
    // its own failure) right before calling this function — this second
    // in-function call was retrying the exact same dead AdeelXtech endpoint
    // a second time, paying its full 7s+20s timeout (x2 for the internal
    // retry) again for a guaranteed-identical 403. Removed; this function
    // now goes straight to yt-dlp, which is the only path that ever actually
    // succeeds once AdeelXtech is down.

    // 🚀 SPEED FIX #2 (Bunty: "thumbnail turant aata hai, video bohot late" —
    // means the fast no-cookies quick-API path is failing often and falling
    // through to this yt-dlp path every time, which was inherently slower):
    // 1) 480p often has NO single pre-merged file on YouTube anymore, so
    //    yt-dlp was silently grabbing separate video+audio streams and
    //    merging them locally — an extra local ffmpeg mux step and, more
    //    importantly, TWO separate downloads instead of one. Dropping to
    //    360p makes a real single-file progressive format available far
    //    more often, skipping the merge entirely.
    // 2) --concurrent-fragments 4 lets yt-dlp pull multiple pieces of a
    //    fragmented/DASH stream at once instead of one at a time — a real
    //    speedup on longer videos even when a merge does still happen.
    const wrap = await ensureYtDlp();
    const args = [videoUrl, '-f', 'best[height<=360][ext=mp4]/best[height<=360]/best[ext=mp4]/best', '--no-playlist',
        '--merge-output-format', 'mp4', '--concurrent-fragments', '4', '-o', outPath, ...cookieArgs(), ...ffmpegLocationArgs()];
    try {
        await wrap.execPromise(args);
    } catch (e) {
        throw new Error('yt-dlp: ' + e.message);
    }
    if (!fs.existsSync(outPath) || fs.statSync(outPath).size < 15000) {
        try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch {}
        throw new Error('yt-dlp: no valid video produced (bot-check likely — check /cookies.txt)');
    }
}

// ══════════════════════════════════
// ★ UNIVERSAL DOWNLOADER (1 cmd)
// ══════════════════════════════════

// 1. dl — TikTok, Instagram, Facebook, Twitter ALL-IN-ONE
cmd({ pattern: 'dl', alias: ['download', 'save', 'get'], desc: 'Download from TikTok/Instagram/Facebook/Twitter (all-in-one)', category: 'download', react: '⬇️' },
async (conn, mek, m, { reply, args, from, q }) => {
    const url = q || args[0];
    if (!url || !url.startsWith('http')) return reply(dlBox('DOWNLOADER', [
        '❌ Social media link do!',
        '📝 Usage: .dl <link>',
        '✅ Supports: TikTok, Instagram,',
        '   Facebook, Twitter, YouTube'
    ], '⬇️'));
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const data = await socialDownload(url);
        if (!data || data.error) throw new Error(data?.message || 'Download failed');

        const medias = data.medias || data.links || [];
        const title = data.title || data.desc || 'Downloaded Media';
        const thumb = data.thumbnail || data.thumb || null;

        if (!medias.length) throw new Error('No media found');

        // Find best video quality
        const video = medias.find(m => m.quality === 'hd' || m.type === 'video' || m.ext === 'mp4') || medias[0];
        const videoUrl = video?.url || video?.link;

        if (!videoUrl) throw new Error('No download URL');

        const isVideo = video?.ext === 'mp4' || video?.type === 'video' || videoUrl.includes('.mp4');

        if (isVideo) {
            await conn.sendMessage(from, {
                video: { url: videoUrl },
                caption: dlBox('DOWNLOADED', [
                    `📛 ${title.slice(0, 50)}`,
                    `🎬 Quality: ${video?.quality || 'Standard'}`,
                    `✅ Done!`
                ], '⬇️'),
                contextInfo: chanCtx()
            }, { quoted: fakevCard });
        } else {
            await conn.sendMessage(from, {
                image: { url: videoUrl },
                caption: dlBox('DOWNLOADED', [`📛 ${title.slice(0, 50)}`, `✅ Done!`], '⬇️'),
                contextInfo: chanCtx()
            }, { quoted: fakevCard });
        }
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply('❌ Download failed! Check the link or try a different one.');
    }
});

// ══════════════════════════════════
// ★ TIKTOK (2 cmds — tikwm confirmed)
// ══════════════════════════════════

// 2. tiktok
cmd({ pattern: 'tiktok', alias: ['tt', 'tik', 'ttdl', 'tiktokdl'], desc: 'Download TikTok (no watermark)', category: 'download', react: '🎵' },
async (conn, mek, m, { reply, args, from, q }) => {
    const url = q || args[0];
    if (!url || !url.includes('tiktok')) return reply(dlBox('TIKTOK', ['❌ TikTok link do!', '📝 .tiktok <link>'], '🎵'));
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        // Try tikwm first (confirmed working)
        const res = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`, { timeout: 10000 });
        if (!res.data?.data) throw new Error('tikwm failed');
        const d = res.data.data;
        const videoUrl = d.play.startsWith('http') ? d.play : `https://tikwm.com${d.play}`;
        // Fetch actual bytes with proper headers — handing WhatsApp a raw URL directly
        // can result in a black screen / no-sound video (tikwm's CDN needs a browser-like UA)
        const videoRes = await axios.get(videoUrl, { responseType: 'arraybuffer', timeout: 40000, headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Referer': 'https://www.tiktok.com/' } });
        await conn.sendMessage(from, {
            video: Buffer.from(videoRes.data),
            mimetype: 'video/mp4',
            caption: dlBox('TIKTOK', [
                `📛 ${d.title?.slice(0, 50) || 'TikTok Video'}`,
                `👤 @${d.author?.unique_id || 'unknown'}`,
                `❤️ ${d.digg_count?.toLocaleString() || '0'} likes`,
                `👁️ ${d.play_count?.toLocaleString() || '0'} views`
            ], '🎵'),
            contextInfo: chanCtx()
        }, { quoted: fakevCard });
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch {
        // Fallback: RapidAPI
        try {
            const data = await socialDownload(url);
            const video = data.medias?.find(m => m.type === 'video' || m.ext === 'mp4') || data.medias?.[0];
            if (!video?.url) throw new Error('No video');
            await conn.sendMessage(from, { video: { url: video.url }, caption: dlBox('TIKTOK', ['✅ Downloaded!'], '🎵'), contextInfo: chanCtx() }, { quoted: fakevCard });
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        } catch {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            reply('❌ TikTok download failed!');
        }
    }
});

// 3. tiktokmp3
cmd({ pattern: 'tiktokmp3', alias: ['ttaudio', 'ttmp3'], desc: 'Download TikTok audio only', category: 'download', react: '🎵' },
async (conn, mek, m, { reply, args, from, q }) => {
    const url = q || args[0];
    if (!url || !url.includes('tiktok')) return reply('❌ Usage: .tiktokmp3 <tiktok link>');
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const res = await axios.get(`https://tikwm.com/api/?url=${encodeURIComponent(url)}`, { timeout: 10000 });
        if (!res.data?.data?.music) throw new Error('No audio');
        await conn.sendMessage(from, { audio: { url: res.data.data.music }, mimetype: 'audio/mpeg', ptt: false }, { quoted: fakevCard });
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply('❌ TikTok audio failed!');
    }
});

// ══════════════════════════════════
// ★ INSTAGRAM (1 cmd — RapidAPI)
// ══════════════════════════════════

// 4. igdl
cmd({ pattern: 'igdl', alias: ['instagram', 'insta', 'ig', 'igdl2', 'igdl4', 'ig3'], desc: 'Download Instagram reel/post', category: 'download', react: '📸' },
async (conn, mek, m, { reply, args, from, q }) => {
    const url = q || args[0];
    if (!url || !url.includes('instagram')) return reply('❌ Usage: .igdl <instagram link>');
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

        // 🚀 SPEED FIX (Ahmad: "downloading boht slow hai"): these 6 lookup
        // methods used to run one after another (if(!mediaUrl){...}) — a dead
        // provider meant waiting out its full 10s timeout before even trying
        // the next one. Now raced in parallel; whichever resolves first wins.
        let mediaUrl = null, isVid = true;

        const igMethods = [
            // Method 1: Vreden (same provider already confirmed reliable for YouTube)
            async () => {
                const res = await axios.get(`https://api.vreden.my.id/api/igdl?url=${encodeURIComponent(url)}`, { timeout: 10000 });
                const item = res.data?.result?.data?.[0] || res.data?.result?.[0];
                if (!item?.url) throw new Error('Vreden igdl: no url');
                return { url: item.url, isVid: !(item.type === 'image' || (item.url || '').includes('.jpg')) };
            },
            // Method 2: ruhend-scraper (npm package, actively maintained, dedicated Instagram scraper)
            async () => {
                const { igdl } = require('ruhend-scraper');
                const res = await igdl(url);
                const item = res?.data?.[0] || res?.[0];
                if (!item?.url) throw new Error('ruhend-scraper: no url');
                return { url: item.url, isVid: (item.type !== 'image' && !(item.url || '').includes('.jpg')) };
            },
            // Method 3: Cobalt.tools (real open-source project, supports Instagram)
            async () => {
                const cobalt = await axios.post('https://api.cobalt.tools/',
                    { url, downloadMode: 'auto' },
                    { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, timeout: 10000 }
                );
                if (!cobalt.data?.url) throw new Error('Cobalt: no url');
                return { url: cobalt.data.url, isVid: true };
            },
            // Method 4: Vreden — second, different endpoint (genuinely separate fallback)
            async () => {
                const res = await axios.get(`https://api.vreden.my.id/api/igdownload?url=${encodeURIComponent(url)}`, { timeout: 10000 });
                const item = (res.data?.result || [])[0];
                if (!item?.url) throw new Error('Vreden igdownload: no url');
                return { url: item.url, isVid: (item.type === 'video' || !(item.url || '').includes('.jpg')) };
            },
            // Method 5: r-bots free API (unverified, obscure — last resort now)
            async () => {
                const res = await axios.get(`https://r-bots-free-apis.co08.art/api/v1/api/igdl?quality=480&url=${encodeURIComponent(url)}`, { timeout: 10000 });
                const item = res.data?.result?.[0] || res.data?.data?.[0] || res.data?.medias?.[0];
                if (!item?.url) throw new Error('r-bots: no url');
                return { url: item.url, isVid: (item.type !== 'image') };
            },
            // Method 6: RapidAPI (needs config.RAPID_API_KEY — shared default key may be exhausted)
            async () => {
                const data = await socialDownload(url);
                const medias = data.medias || [];
                const video = medias.find(m => m.type === 'video' || m.ext === 'mp4') || medias[0];
                if (!video?.url) throw new Error('RapidAPI: no url');
                return { url: video.url, isVid: (video.ext === 'mp4' || video.type === 'video') };
            },
        ];

        try {
            const winner = await Promise.any(igMethods.map(fn => fn()));
            mediaUrl = winner.url;
            isVid = winner.isVid;
        } catch (e) {
            console.log(`[IGDL] All 6 parallel methods failed for url: ${url}`);
        }

        if (!mediaUrl) { console.log(`[IGDL] All 6 methods failed for url: ${url}`); throw new Error('No media'); }
        if (isVid) {
            await conn.sendMessage(from, { video: { url: mediaUrl }, caption: dlBox('INSTAGRAM', ['✅ Downloaded!'], '📸'), contextInfo: chanCtx() }, { quoted: fakevCard });
        } else {
            await conn.sendMessage(from, { image: { url: mediaUrl }, caption: dlBox('INSTAGRAM', ['✅ Downloaded!'], '📸'), contextInfo: chanCtx() }, { quoted: fakevCard });
        }
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e) {
        console.log('[IGDL] final failure:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply('❌ Instagram download failed! Post public honi chahiye.');
    }
});

// ══════════════════════════════════
// ★ FACEBOOK (1 cmd — RapidAPI)
// ══════════════════════════════════

// 5. fb
cmd({ pattern: 'fb', alias: ['facebook', 'fbdl', 'facebookdl'], desc: 'Download Facebook video', category: 'download', react: '📘' },
async (conn, mek, m, { reply, args, from, q }) => {
    const url = q || args[0];
    if (!url || (!url.includes('facebook') && !url.includes('fb.watch'))) return reply('❌ Usage: .fb <facebook link>');
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        let video;
        try {
            const data = await socialDownload(url);
            const medias = data.medias || [];
            video = medias.find(m => m.quality === 'hd') || medias.find(m => m.type === 'video') || medias[0];
            if (!video?.url) throw new Error('No video');
        } catch (e) {
            // 🆕 FALLBACK (Bunty: "koi aur API dekh lo" — verified reachable):
            // .fb had zero fallback before — one RapidAPI hiccup meant an
            // instant, guaranteed failure. Second, independent source now.
            console.log('[FB] primary (RapidAPI) failed, trying siputzx:', e.message);
            const { data } = await axios.get(`https://api.siputzx.my.id/api/d/facebook?url=${encodeURIComponent(url)}`, { timeout: 15000, family: 4 });
            const item = data?.data?.[0] || data?.data?.url || data?.url || data?.result;
            const link = typeof item === 'string' ? item : (item?.url || item?.hd || item?.sd);
            if (!link) throw new Error('siputzx: no url either');
            video = { url: link, quality: 'SD' };
        }
        await conn.sendMessage(from, {
            video: { url: video.url },
            caption: dlBox('FACEBOOK', [`✅ Downloaded!`, `🎬 Quality: ${video?.quality || 'SD'}`], '📘'),
            contextInfo: chanCtx()
        }, { quoted: fakevCard });
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e) {
        console.log('[FB] both sources failed:', e.message);
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply('❌ FB download failed! Public video honi chahiye.');
    }
});

// ══════════════════════════════════
// ★ TWITTER / X (1 cmd — RapidAPI)
// ══════════════════════════════════

// 6. twitter
cmd({ pattern: 'twitter', alias: ['x', 'tweet', 'twitterdl'], desc: 'Download Twitter/X video', category: 'download', react: '🐦' },
async (conn, mek, m, { reply, args, from, q }) => {
    const url = q || args[0];
    if (!url || (!url.includes('twitter') && !url.includes('x.com') && !url.includes('t.co'))) return reply('❌ Usage: .twitter <twitter/x link>');
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const data = await socialDownload(url);
        const medias = data.medias || [];
        const video = medias.find(m => m.quality === 'hd') || medias.find(m => m.type === 'video') || medias[0];
        if (!video?.url) throw new Error('No media');
        await conn.sendMessage(from, {
            video: { url: video.url },
            caption: dlBox('TWITTER/X', [`📛 ${data.title?.slice(0,50) || 'Tweet'}`, `✅ Downloaded!`], '🐦'),
            contextInfo: chanCtx()
        }, { quoted: fakevCard });
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply('❌ Twitter download failed!');
    }
});

// ══════════════════════════════════
// ★ YOUTUBE (4 cmds — ytdl-core)
// ══════════════════════════════════

// 7. ytmp3 / song / play
cmd({ pattern: 'ytmp3', alias: ['song', 'play'], desc: 'Download YouTube as MP3', category: 'download', react: '🎵' },
async (conn, mek, m, { reply, args, from }) => {
    const query = args.join(' ');
    if (!query) return reply(dlBox('YOUTUBE MP3', ['❌ Song name ya link do!', '📝 .play <song name>', '🔗 .play <youtube link>'], '🎵'));
    if (!YTDlpWrapLib) return reply('❌ Run npm install on the server: yt-dlp-wrap');
    let outPath, opusPath; // declared here (not inside try) so the catch block can clean them up too
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const __searchStart = Date.now();
        const video = await ytSearch(query);
        console.log(`[YTMP3] search took ${Date.now() - __searchStart}ms`);

        // 🚀 SPEED FIX (Bunty: ".video fast hai but .play slow, kabhi download
        // ke baad kuch nahi aata"): getQuickAudioBuffer() already existed
        // (built for exactly this) but was never actually called here — this
        // handler went straight to yt-dlp + local ffmpeg conversion every
        // single time, which is the heavy/slow path AND the one most likely
        // to silently hang or fail with no message (yt-dlp cookies issues,
        // ffmpeg conversion errors). Try the quick direct-audio API first,
        // same pattern .video already uses successfully; only fall through
        // to yt-dlp below if it fails.
        try {
            const __quickStart = Date.now();
            const quickBuf = await getQuickAudioBuffer(video.url);
            console.log(`[YTMP3] quick-API path took ${Date.now() - __quickStart}ms`);
            await conn.sendMessage(from, {
                image: { url: video.thumb },
                caption: dlBox('YOUTUBE MP3', [
                    `🎵 ${video.title?.slice(0, 50)}`,
                    `👤 ${video.author}`,
                    ...(video.duration ? [`⏱️ ${video.duration}`] : []),
                    `✅ Downloaded!`
                ], '🎵'),
                contextInfo: chanCtx()
            }, { quoted: fakevCard }).catch(e => console.log('[YTMP3] quick thumbnail send failed (non-fatal):', e.message));
            const { mimetype, ext } = detectAudioFormat(quickBuf);
            await sendWithRetry(conn, from, {
                audio: quickBuf,
                mimetype,
                fileName: `${video.title?.slice(0,30)}.${ext}`,
                ptt: false
            }, { quoted: fakevCard });
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            return;
        } catch (e) {
            console.log('[YTMP3] quick-API path failed, falling back to yt-dlp:', e.message);
        }

        outPath = path.join('/tmp', `ytaudio_${Date.now()}.mp3`);
        // 🆕 QUEUE (crash prevention): the heavy yt-dlp download + ffmpeg
        // opus conversion below is the CPU/RAM-intensive part. If it's busy
        // (4 already running), this waits its turn and tells the user
        // instead of piling on top and risking a crash under load.
        await heavyQueue.run(async () => {
        const __dlStart = Date.now();
        // 🚨 BUG FIX (Bunty: "gc mein .video/.play 'Download failed!' deta,
        // private mein chal jaata"): Promise.all rejects the INSTANT any one
        // of its promises rejects — the thumbnail/caption send here wasn't
        // wrapped in its own catch, so if THAT send failed (groups are more
        // prone to this: bigger payload, occasional rate-limits/hiccups
        // sending media into a group vs a private DM), the whole Promise.all
        // threw and aborted the ENTIRE command with a generic "Download
        // failed!" — even when the actual audio download had succeeded or
        // was still in progress. The thumbnail is cosmetic; its failure
        // should never cancel the real download.
        const [__] = await Promise.all([
            dlAudio(video.url, outPath),
            conn.sendMessage(from, {
                image: { url: video.thumb },
                caption: dlBox('YOUTUBE MP3', [
                    `🎵 ${video.title?.slice(0, 50)}`,
                    `👤 ${video.author}`,
                    ...(video.duration ? [`⏱️ ${video.duration}`] : []),
                    ...(video.views ? [`👁️ ${video.views}`] : []),
                    `⏳ Downloading...`
                ], '🎵'),
                contextInfo: chanCtx()
            }, { quoted: fakevCard }).catch(e => console.log('[YTMP3] thumbnail send failed (non-fatal):', e.message))
        ]);
        console.log(`[YTMP3] download took ${Date.now() - __dlStart}ms`);
        if (!fs.existsSync(outPath)) throw new Error('Failed');

        // 🚨 BUG FIX: sending the raw downloaded bytes (mp3/m4a/whatever) with
        // a guessed mimetype kept producing "audio not available" on WhatsApp.
        // The bot's OWN .menu voice note plays reliably every time because it
        // converts to ogg/opus (WhatsApp's own native voice-note codec) via
        // ffmpeg before sending — so do the exact same conversion here instead
        // of trying to just get the mimetype label right on the raw file.
        opusPath = path.join('/tmp', `ytaudio_opus_${Date.now()}.ogg`);
        let sentAsOpus = false;
        try {
            const __convStart = Date.now();
            await new Promise((resolve, reject) => {
                ffmpeg(outPath)
                    .audioCodec('libopus')
                    .audioBitrate('64k')
                    .audioChannels(1)
                    .outputOptions(['-compression_level 0', '-application audio'])
                    .format('ogg')
                    .on('end', resolve)
                    .on('error', reject)
                    .save(opusPath);
            });
            console.log(`[YTMP3] opus conversion took ${Date.now() - __convStart}ms`);
            const __uploadStart = Date.now();
            await sendWithRetry(conn, from, {
                audio: fs.readFileSync(opusPath),
                mimetype: 'audio/ogg; codecs=opus',
                ptt: false
            }, { quoted: fakevCard });
            console.log(`[YTMP3] upload took ${Date.now() - __uploadStart}ms`);
            sentAsOpus = true;
            fs.unlink(opusPath, () => {});
        } catch (e) {
            console.log('[YTMP3 OPUS CONVERT] failed, falling back to raw file:', e.message);
            // 🚨 STORAGE FIX: a failed ffmpeg conversion can still leave a
            // partial/corrupt .ogg file on disk — clean it up immediately
            // instead of leaving it orphaned in /tmp.
            try { if (fs.existsSync(opusPath)) fs.unlinkSync(opusPath); } catch {}
        }

        if (!sentAsOpus) {
            // Fallback: original behavior, in case ffmpeg conversion itself fails.
            const audioBuf = fs.readFileSync(outPath);
            const { mimetype, ext } = detectAudioFormat(audioBuf);
            const __uploadStart2 = Date.now();
            await sendWithRetry(conn, from, {
                audio: audioBuf,
                mimetype,
                fileName: `${video.title?.slice(0,30)}.${ext}`,
                ptt: false
            }, { quoted: fakevCard });
            console.log(`[YTMP3] fallback upload took ${Date.now() - __uploadStart2}ms`);
        }
        fs.unlinkSync(outPath);
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        }, async (position) => {
            await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
            await replyWithRetry(conn, from, mek, `⏳ High demand right now — you're #${position} in line. Hang tight, coming right up!`);
        });
    } catch (e) {
        // 🚨 STORAGE FIX: clean up any leftover temp files on any error path,
        // instead of leaving them orphaned in /tmp forever.
        try { if (outPath && fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch {}
        try { if (opusPath && fs.existsSync(opusPath)) fs.unlinkSync(opusPath); } catch {}
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        console.log('[YTMP3 FINAL ERROR]', e.message);
        if (String(e.message).startsWith('YTSEARCH_FAILED')) {
            await replyWithRetry(conn, from, mek, '❌ YouTube search failed (not a download issue) — paste a direct YouTube link instead of a song name and try again.');
        } else if (/bot-check/i.test(e.message)) {
            await replyWithRetry(conn, from, mek, '❌ YouTube bot-check blocked this (no cookies.txt) — add cookies.txt to the server root, otherwise this will often fail.');
        } else {
            await replyWithRetry(conn, from, mek, '❌ Download failed! Try a direct YouTube link.');
        }
    }
});

// 8. ytmp4 / video
cmd({ pattern: 'ytmp4', alias: ['video', 'yta', 'ytv'], desc: 'Download YouTube as MP4', category: 'download', react: '🎬' },
async (conn, mek, m, { reply, args, from }) => {
    const query = args.join(' ');
    if (!query) return reply(dlBox('YOUTUBE MP4', ['❌ Video name ya link do!', '📝 .ytmp4 <name>'], '🎬'));
    if (!YTDlpWrapLib) return reply('❌ Run npm install on the server: yt-dlp-wrap');
    let outPath; // declared here (not inside try) so the catch block can clean it up too
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const video = await ytSearch(query);
        const __dlStart = Date.now();

        // 🚀 FASTEST PATH (Bunty confirmed JawadTech working again): send
        // the returned mp4 link straight to WhatsApp as a URL reference —
        // WhatsApp fetches it directly, zero server-side download or
        // re-upload. This is the exact pattern from Bunty's own
        // confirmed-fast working code. Only downside: if the link expires
        // fast or WhatsApp can't fetch it, the video just never arrives —
        // so this is given a short window before moving on, and every
        // other (slower but proven-reliable) path below still runs
        // exactly as before if this doesn't pan out.
        try {
            const jt = await getJawadTechResult(video.url);
            // 🚨 SPEED FIX (Ahmad screenshot: logs showed WhatsApp itself
            // failing to fetch the returned ydl.ymcdn.org URL, then the
            // @lid-resolver retry (main.js) fetching that SAME broken URL a
            // second time with no cap — two full unbounded fetch failures
            // back to back before this ever fell through. A dead/unfetchable
            // link is exactly the risk called out in the comment above this
            // block ("if the link expires fast or WhatsApp can't fetch it,
            // the video just never arrives") — bounding it with a race
            // means that risk now costs at most 12s instead of whatever
            // Baileys' own fetch+retry timeout happens to be.
            await Promise.race([
                conn.sendMessage(from, {
                    video: { url: jt.mp4 },
                    mimetype: 'video/mp4',
                    caption: dlBox('YOUTUBE MP4', [`🎬 ${(jt.title || video.title)?.slice(0,50)}`], '🎬'),
                    contextInfo: chanCtx()
                }, { quoted: fakevCard }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('JawadTech direct-URL send timed out')), 12000))
            ]);
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            console.log(`[YTMP4] JawadTech direct-URL path took ${Date.now() - __dlStart}ms`);
            return;
        } catch (e) {
            console.log('[YTMP4] JawadTech fast path failed, falling back:', e.message);
        }

        // 🚨 BUG FIX (Bunty: "gc mein Download failed!, private mein chal
        // jaata") — same root cause as .play: the thumbnail send here wasn't
        // caught on its own, so any hiccup sending media into a group (more
        // common there than in a DM) rejected this whole Promise.all and
        // aborted the real video download too. Thumbnail failure is now
        // non-fatal.
        const [quickResult] = await Promise.all([
            raceQuickApis(video.url).then(buf => ({ ok: true, buf })).catch(e => ({ ok: false, e })),
            conn.sendMessage(from, {
                image: { url: video.thumb },
                caption: dlBox('YOUTUBE MP4', [
                    `🎬 ${video.title?.slice(0, 50)}`,
                    ...(video.duration ? [`⏱️ ${video.duration}`] : []),
                    `⏳ Downloading...`
                ], '🎬'),
                contextInfo: chanCtx()
            }, { quoted: fakevCard }).catch(e => console.log('[YTMP4] thumbnail send failed (non-fatal):', e.message))
        ]);
        console.log(`[YTMP4] quick path took ${Date.now() - __dlStart}ms`);

        // Easy no-cookies path first: actually download the video bytes
        // (capped at 30MB — see MAX_QUICKAPI_VIDEO_BYTES — so this can never
        // OOM the process like the old uncapped version did) and send the
        // real file, not just a URL reference.
        if (quickResult.ok) {
            await sendWithRetry(conn, from, {
                video: quickResult.buf,
                mimetype: 'video/mp4',
                caption: dlBox('YOUTUBE MP4', [`🎬 ${video.title?.slice(0,50)}`], '🎬'),
                contextInfo: chanCtx()
            }, { quoted: fakevCard });
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            return;
        } else {
            console.log('[YTMP4] quick buffer path failed, falling back to yt-dlp:', quickResult.e.message);
        }

        outPath = path.join('/tmp', `ytvideo_${Date.now()}.mp4`);
        // 🆕 QUEUE (crash prevention): yt-dlp video download is the
        // heaviest, slowest path here — bound its concurrency like ytmp3.
        await heavyQueue.run(async () => {
        const __dlStart2 = Date.now();
        await dlVideo(video.url, outPath);
        console.log(`[YTMP4] download took ${Date.now() - __dlStart2}ms`);
        if (!fs.existsSync(outPath)) throw new Error('Failed');
        const size = fs.statSync(outPath).size;
        if (size > 50*1024*1024) { fs.unlinkSync(outPath); return replyWithRetry(conn, from, mek, '❌ Video too large! Try a shorter one.'); }
        await sendWithRetry(conn, from, {
            video: fs.readFileSync(outPath),
            mimetype: 'video/mp4',
            caption: dlBox('YOUTUBE MP4', [`🎬 ${video.title?.slice(0,50)}`], '🎬'),
            contextInfo: chanCtx()
        }, { quoted: fakevCard });
        fs.unlinkSync(outPath);
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        }, async (position) => {
            await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
            await replyWithRetry(conn, from, mek, `⏳ High demand right now — you're #${position} in line. Hang tight, coming right up!`);
        });
    } catch (e) {
        // 🚨 STORAGE FIX: on any error after download, outPath was never
        // cleaned up — orphaned video files (up to 50MB each) piled up in
        // /tmp forever since these download APIs fail often. Now always
        // cleaned up regardless of where the error happened.
        try { if (outPath && fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch {}
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        console.log('[YTMP4 FINAL ERROR]', e.message);
        if (String(e.message).startsWith('YTSEARCH_FAILED')) {
            await replyWithRetry(conn, from, mek, '❌ YouTube search failed (not a download issue) — paste a direct YouTube link instead of a video name and try again.');
        } else if (/bot-check/i.test(e.message)) {
            await replyWithRetry(conn, from, mek, '❌ YouTube bot-check blocked this (no cookies.txt) — add cookies.txt to the server root, otherwise this will often fail.');
        } else {
            await replyWithRetry(conn, from, mek, '❌ Download failed!');
        }
    }
});

// ══════════════════════════════════
// ★ MEDIA TOOLS (3 cmds)
// ══════════════════════════════════

// 11. dp
cmd({ pattern: 'dp', alias: ['getpp', 'profilepic', 'pfp'], desc: 'Get profile picture', category: 'download', react: '🖼️' },
async (conn, mek, m, { reply, args, from, quoted, sender, mentionedJid }) => {
    // 🚨 FIX (Ahmad: ".getpp karo to jahan use karo wahan ki pic ni aati" —
    // tagging/@mentioning someone was ignored entirely): this only ever
    // checked args[0] (a raw typed number) or a replied message's sender.
    // Tagging a user (.getpp @someone) never resolved to their JID at all,
    // so it silently fell through to the command sender's OWN picture
    // instead — which is exactly the "shows my pic instead of theirs" bug.
    // mentionedJid is now checked first (most common way people tag
    // someone), before the raw-number and reply-quote fallbacks.
    const target = (mentionedJid && mentionedJid[0])
        || (args[0] ? `${args[0].replace(/[^0-9]/g,'')}@s.whatsapp.net` : null)
        || quoted?.sender
        || sender;
    try {
        const ppUrl = await conn.profilePictureUrl(target, 'image');
        await conn.sendMessage(from, {
            image: { url: ppUrl },
            caption: dlBox('PROFILE PIC', [`👤 @${target.split('@')[0]}`], '🖼️'),
            contextInfo: chanCtx()
        }, { quoted: fakevCard });
    } catch { reply("❌ Couldn't get the profile picture — private account!"); }
});

// 12. sticker & 13. toimg — (kept in more-tools.js instead, to avoid duplicate command definitions)

// ══════════════════════════════════
// ★ NEW PLATFORMS (Ahmad: "downloader mein naye platforms add karo")
// ══════════════════════════════════

// 14. soundcloud — via cobalt.tools (already proven reliable, used above for YT/IG)
cmd({ pattern: 'soundcloud', alias: ['sc', 'scdl'], desc: 'Download SoundCloud track', category: 'download', react: '🎧' },
async (conn, mek, m, { reply, args, from, q }) => {
    const url = q || args[0];
    if (!url || !url.includes('soundcloud.com')) return reply(dlBox('SOUNDCLOUD', ['❌ SoundCloud link do!', '📝 .soundcloud <link>'], '🎧'));
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const cobalt = await axios.post('https://api.cobalt.tools/',
            { url, downloadMode: 'audio', filenameStyle: 'basic' },
            { headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' }, timeout: 12000 }
        );
        if (!cobalt.data?.url) throw new Error('No url');
        const audioRes = await axios.get(cobalt.data.url, { responseType: 'arraybuffer', timeout: 25000 });
        await conn.sendMessage(from, {
            audio: Buffer.from(audioRes.data),
            mimetype: 'audio/mpeg',
            ptt: false
        }, { quoted: fakevCard });
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply('❌ SoundCloud download failed! Check the link or try again later.');
    }
});

// 15. spotify — Spotify doesn't allow direct audio downloads (DRM-protected),
// so this uses Spotify's own public oEmbed API (no key needed, official) to
// get the real track title + artist, then reuses the exact same YouTube
// search + download pipeline as .song — the same trick most "Spotify
// downloader" bots actually use under the hood.
cmd({ pattern: 'spotify', alias: ['spotifydl'], desc: 'Download a Spotify track (via YouTube match)', category: 'download', react: '🟢' },
async (conn, mek, m, { reply, args, from, q }) => {
    const url = q || args[0];
    if (!url || !url.includes('spotify.com')) return reply(dlBox('SPOTIFY', ['❌ Spotify track link do!', '📝 .spotify <link>'], '🟢'));
    if (!YTDlpWrapLib) return reply('❌ Run npm install on the server: yt-dlp-wrap');
    let outPath, opusPath;
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const meta = await axios.get(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, { timeout: 10000 });
        const title = meta.data?.title;
        if (!title) throw new Error('Could not read Spotify track info');

        const video = await ytSearch(title);
        outPath = path.join('/tmp', `spotify_${Date.now()}.mp3`);
        await Promise.all([
            dlAudio(video.url, outPath),
            conn.sendMessage(from, {
                image: { url: video.thumb },
                caption: dlBox('SPOTIFY', [`🟢 ${title.slice(0, 50)}`, `⏳ Downloading...`], '🟢'),
                contextInfo: chanCtx()
            }, { quoted: fakevCard }).catch(e => console.log('[SPOTIFY] thumbnail send failed (non-fatal):', e.message))
        ]);
        if (!fs.existsSync(outPath)) throw new Error('Download failed');

        opusPath = path.join('/tmp', `spotify_opus_${Date.now()}.ogg`);
        let sentAsOpus = false;
        try {
            await new Promise((resolve, reject) => {
                ffmpeg(outPath).audioCodec('libopus').audioBitrate('64k').audioChannels(1)
                    .outputOptions(['-compression_level 0', '-application audio']).format('ogg')
                    .on('end', resolve).on('error', reject).save(opusPath);
            });
            await conn.sendMessage(from, { audio: fs.readFileSync(opusPath), mimetype: 'audio/ogg; codecs=opus', ptt: false }, { quoted: fakevCard });
            sentAsOpus = true;
            fs.unlink(opusPath, () => {});
        } catch (e) {
            try { if (fs.existsSync(opusPath)) fs.unlinkSync(opusPath); } catch {}
        }
        if (!sentAsOpus) {
            const audioBuf = fs.readFileSync(outPath);
            const { mimetype, ext } = detectAudioFormat(audioBuf);
            await conn.sendMessage(from, { audio: audioBuf, mimetype, fileName: `${title.slice(0, 30)}.${ext}`, ptt: false }, { quoted: fakevCard });
        }
        fs.unlinkSync(outPath);
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e) {
        try { if (outPath && fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch {}
        try { if (opusPath && fs.existsSync(opusPath)) fs.unlinkSync(opusPath); } catch {}
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply('❌ Spotify download failed! No track match found or the link is wrong.');
    }
});

// ══════════════════════════════════
// ★ PINTEREST SEARCH (1 cmd — keyword search, multiple results)
// ══════════════════════════════════
// 🚨 NEW (Bunty: "pin search api use karo, only one pic aati hai, kafi
// zyada pics chahiye"): this is a keyword SEARCH (many results), separate
// from any single-URL pin downloader. Uses this bot's own dlBox/chanCtx/
// fakevCard helpers already defined above, so branding matches the rest of
// AHMAD MINI automatically (config.BOT_NAME / config.CHANNEL_JID) — no
// hardcoded "Usman-MD" or other bot's name anywhere in this file.
function normalizePinResults(payload) {
    if (!payload) return [];
    const container = payload.result || payload.data || payload.pins || payload;
    const arr = Array.isArray(container) ? container : (container.data || container.result || []);
    if (!Array.isArray(arr)) return [];
    return arr.map(item => {
        if (typeof item === 'string') return { url: item, isVideo: false };
        const url = item.url || item.image || item.image_url || item.thumbnail || item.video || item.link;
        const isVideo = !!item.video || item.type === 'video' || /\.mp4($|\?)/i.test(url || '');
        return url ? { url, isVideo } : null;
    }).filter(Boolean);
}

async function searchPinterest(query) {
    // Method 1: Siputzx (free, no key)
    try {
        const res = await axios.get(`https://api.siputzx.my.id/api/s/pinterest?query=${encodeURIComponent(query)}`, AXIOS_DEFAULTS);
        const results = normalizePinResults(res.data);
        if (results.length) return results;
    } catch (e) { console.log('[PINSEARCH Siputzx] failed:', e.message); }

    // Method 2: Vreden — 🚨 KNOWN DEAD (confirmed via live logs: api.vreden.my.id
    // is DNS-dead, ENOTFOUND) — kept only as a harmless no-op fallback in case
    // the domain ever comes back; don't rely on this one.
    try {
        const res = await axios.get(`https://api.vreden.my.id/api/pinterest?query=${encodeURIComponent(query)}`, AXIOS_DEFAULTS);
        const results = normalizePinResults(res.data);
        if (results.length) return results;
    } catch (e) { console.log('[PINSEARCH Vreden] failed:', e.message); }

    // Method 3: Okatsu
    try {
        const res = await axios.get(`https://okatsu-rolezapiiz.vercel.app/search/pinterest?query=${encodeURIComponent(query)}`, AXIOS_DEFAULTS);
        const results = normalizePinResults(res.data);
        if (results.length) return results;
    } catch (e) { console.log('[PINSEARCH Okatsu] failed:', e.message); }

    throw new Error('No results found — all search methods failed');
}

cmd({ pattern: 'pinsearch', alias: ['pins', 'pinterestsearch', 'pinterest'], desc: 'Search Pinterest for images/videos by keyword', category: 'download', react: '🔍' },
async (conn, mek, m, { reply, args, from }) => {
    const query = args.join(' ').trim();
    if (!query) return reply(dlBox('PINTEREST SEARCH', ['❌ Keyword do!', '📝 .pinsearch <keyword>'], '🔍'));
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const results = await searchPinterest(query);
        if (!results.length) throw new Error('No results found');

        const picks = results.slice(0, 5);
        for (let i = 0; i < picks.length; i++) {
            const item = picks[i];
            const caption = i === 0
                ? dlBox('PINTEREST SEARCH', [`🔎 ${query}`, `📸 ${picks.length} results`], '📌')
                : undefined;
            try {
                if (item.isVideo) {
                    await conn.sendMessage(from, { video: { url: item.url }, mimetype: 'video/mp4', caption, contextInfo: chanCtx() }, { quoted: fakevCard });
                } else {
                    await conn.sendMessage(from, { image: { url: item.url }, caption, contextInfo: chanCtx() }, { quoted: fakevCard });
                }
            } catch (e) {
                console.log(`[PINSEARCH] failed to send result ${i}:`, e.message);
            }
        }
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
    } catch (e) {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        console.log('[PINSEARCH FINAL ERROR]', e.message);
        reply('❌ Pinterest search failed! Try again later or change your keyword.');
    }
});
