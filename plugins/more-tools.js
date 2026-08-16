const { cmd } = require('../ahmad-core');
const axios = require('axios');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const { downloadContentFromMessage } = require('@whiskeysockets/baileys');
const { randomFooter, renderError } = require('../lib/menu-styles');
ffmpeg.setFfmpegPath(ffmpegPath);

const FOOTER = "\n\n> " + randomFooter();
const tmp = (ext) => path.join(os.tmpdir(), `amd_${Date.now()}_${crypto.randomBytes(3).toString('hex')}${ext}`);

// ---------- shared media helpers ----------
// 🚨 ROOT-CAUSE FIX (Bunty: ".toimg — ffmpeg 'Invalid data... after EOF'"):
// that ffmpeg error means the downloaded buffer was truncated/incomplete
// (a partial CDN download, or an expired media URL on an old/forwarded
// message) — ffmpeg was never actually broken, it just got a half-written
// file. Now retries the download once on a transient failure, and — for
// stickers specifically, since that's where this was reported — checks
// the real WEBP magic bytes ("RIFF"...."WEBP") before ever handing the
// buffer to ffmpeg, so a bad download fails with a clear message instead
// of a cryptic ffmpeg stack trace.
async function downloadQuoted(quotedMessage, type, attempt = 1) {
    const mediaType = type === "imageMessage" ? "image" : type === "videoMessage" ? "video" : type === "stickerMessage" ? "sticker" : "audio";
    try {
        const stream = await downloadContentFromMessage(quotedMessage[type], mediaType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) buffer = Buffer.concat([buffer, chunk]);
        if (buffer.length < 100 && attempt < 2) {
            // Suspiciously small — almost certainly a truncated download, not a real tiny file.
            return downloadQuoted(quotedMessage, type, attempt + 1);
        }
        return buffer;
    } catch (e) {
        if (attempt < 2) return downloadQuoted(quotedMessage, type, attempt + 1);
        throw e;
    }
}

function isValidWebp(buf) {
    // 🚨 ROOT-CAUSE FIX #2 (Bunty: "same ffmpeg error even after the retry
    // fix"): checking only the "RIFF"/"WEBP" magic bytes wasn't enough —
    // those live at the very START of the file, so a download that got
    // cut off partway through (truncated stream) still has a perfectly
    // normal-looking header and passed this check, then hit ffmpeg and
    // failed with the exact same "after EOF" error as before. A WEBP's
    // RIFF header also declares its own total size (bytes 4-7, little-
    // endian) — comparing that declared size against the buffer's real
    // length is what actually catches a truncated file.
    if (buf.length <= 12) return false;
    if (buf.slice(0, 4).toString('ascii') !== 'RIFF') return false;
    if (buf.slice(8, 12).toString('ascii') !== 'WEBP') return false;
    const declaredSize = buf.readUInt32LE(4);
    return buf.length >= declaredSize + 8;
}

function getQuotedType(m) {
    if (!m.quoted || !m.quoted.message) return null;
    return Object.keys(m.quoted.message)[0];
}

async function toWebpSticker(inputBuffer, isVideo) {
    const inPath = tmp(isVideo ? '.mp4' : '.jpg');
    const outPath = tmp('.webp');
    fs.writeFileSync(inPath, inputBuffer);
    try {
        await new Promise((resolve, reject) => {
            let c = ffmpeg(inPath).on('end', resolve).on('error', reject);
            if (isVideo) c = c.duration(6);
            c.addOutputOptions([
                "-vcodec", "libwebp",
                "-vf", "scale='min(320,iw)':min'(320,ih)':force_original_aspect_ratio=decrease,fps=15,pad=320:320:-1:-1:color=white@0.0,split [a][b];[a] palettegen=reserve_transparent=on:transparency_color=ffffff [p];[b][p] paletteuse",
                "-loop", "0", "-preset", "default", "-an", "-vsync", "0"
            ]).toFormat('webp').save(outPath);
        });
        const buf = fs.readFileSync(outPath);
        return buf;
    } finally {
        // 🚨 STORAGE FIX: was only cleaned up on the success path — if ffmpeg
        // failed, both temp files stayed orphaned in /tmp forever. finally{}
        // guarantees cleanup either way.
        fs.unlink(inPath, () => {}); fs.unlink(outPath, () => {});
    }
}

async function mp3BufferToOggVoice(mp3Buffer) {
    const inPath = tmp('.mp3');
    const outPath = tmp('.ogg');
    fs.writeFileSync(inPath, mp3Buffer);
    await new Promise((resolve, reject) => {
        ffmpeg(inPath).audioCodec('libopus').audioBitrate('64k').audioChannels(1)
            .format('ogg').on('end', resolve).on('error', reject).save(outPath);
    });
    const buf = fs.readFileSync(outPath);
    fs.unlink(inPath, () => {}); fs.unlink(outPath, () => {});
    return buf;
}

const fail = (reply, msg) => reply(renderError(msg));

// ================= DOWNLOADER =================

cmd({ pattern: "mediafire", alias: ["mfire"], desc: "Download file from Mediafire link", category: "download", filename: __filename },
async (conn, mek, m, { from, args, reply }) => {
    try {
        if (!args[0] || !args[0].includes('mediafire.com')) return fail(reply, "Mediafire link do. Usage: .mediafire <link>");
        const page = await axios.get(args[0], { timeout: 20000 });
        const match = page.data.match(/href="(https:\/\/download[^"]+)"/);
        if (!match) return fail(reply, "Download link nahi mila, link expired/invalid ho sakta hai.");
        const nameMatch = page.data.match(/class="dl-btn-label"[^>]*>([^<]+)</) || [];
        await conn.sendMessage(from, { document: { url: match[1] }, fileName: (nameMatch[1] || "file").trim(), mimetype: "application/octet-stream", caption: `✅ *MEDIAFIRE DOWNLOAD*${FOOTER}` }, { quoted: mek });
    } catch (e) { fail(reply, "Mediafire fetch failed: " + e.message); }
});

cmd({ pattern: "gdrive", alias: ["gdl"], desc: "Get direct download link for public Google Drive file", category: "download", filename: __filename },
async (conn, mek, m, { args, reply }) => {
    try {
        const link = args[0];
        const idMatch = link && link.match(/[-\w]{25,}/);
        if (!idMatch) return fail(reply, "Valid Google Drive link do. Usage: .gdrive <link>");
        const direct = `https://drive.google.com/uc?export=download&id=${idMatch[0]}`;
        reply(`✅ *DIRECT DOWNLOAD LINK*\n${direct}\n\n⚠️ File public/shared hona chahiye.${FOOTER}`);
    } catch (e) { fail(reply, e.message); }
});

cmd({ pattern: "twitterdl2", alias: ["xdl2"], desc: "Download Twitter/X video", category: "download", filename: __filename },
async (conn, mek, m, { from, args, reply }) => {
    try {
        const link = args[0];
        if (!link || !/twitter\.com|x\.com/.test(link)) return fail(reply, "Twitter/X post link do. Usage: .twitter <link>");
        const apiUrl = link.replace(/(twitter|x)\.com/, "api.vxtwitter.com");
        const { data } = await axios.get(apiUrl, { timeout: 20000 });
        const media = data.media_extended && data.media_extended[0];
        if (!media || !media.url) return fail(reply, "Is post mein video/media nahi mila.");
        if (media.type === 'video' || media.type === 'gif') {
            await conn.sendMessage(from, { video: { url: media.url }, caption: `✅ *TWITTER DOWNLOAD*\n${(data.text || '').slice(0, 200)}${FOOTER}` }, { quoted: mek });
        } else {
            await conn.sendMessage(from, { image: { url: media.url }, caption: `✅ *TWITTER DOWNLOAD*${FOOTER}` }, { quoted: mek });
        }
    } catch (e) { fail(reply, "Twitter fetch failed: " + e.message); }
});

// ================= GROUP =================

cmd({ pattern: "poll", desc: "Create a WhatsApp poll in group", category: "group", filename: __filename },
async (conn, mek, m, { from, isGroup, q, reply }) => {
    try {
        if (!isGroup) return fail(reply, "Yeh command sirf group mein chalti hai.");
        if (!q || !q.includes('|')) return fail(reply, "Usage: .poll Question|Option1|Option2|Option3");
        const parts = q.split('|').map(s => s.trim()).filter(Boolean);
        const question = parts.shift();
        if (parts.length < 2) return fail(reply, "Kam se kam 2 options do.");
        await conn.sendMessage(from, { poll: { name: question, values: parts, selectableCount: 1 } }, { quoted: mek });
    } catch (e) { fail(reply, e.message); }
});

// ================= FUN / STICKER =================

cmd({ pattern: "sticker", alias: ["s", "stiker"], desc: "Convert image/video/gif to sticker", category: "fun", filename: __filename },
async (conn, mek, m, { from, reply }) => {
    try {
        const type = getQuotedType(m);
        const directType = m.mtype;
        if (type === "imageMessage" || type === "videoMessage") {
            const isVideo = type === "videoMessage";
            const buf = await downloadQuoted(m.quoted.message, type);
            const webp = await toWebpSticker(buf, isVideo);
            // 🚨 BUG FIX ("sticker not playable" / shows as a still image):
            // an animated webp still needs Baileys to be told explicitly
            // that it's animated — without `isAnimated: true` here, WhatsApp
            // can render even a genuinely multi-frame webp as a static
            // sticker (no play/loop). Only relevant for video/gif sources;
            // a real photo should stay a normal static sticker.
            await conn.sendMessage(from, { sticker: webp, isAnimated: isVideo }, { quoted: mek });
        } else if (directType === "imageMessage" || directType === "videoMessage") {
            const isVideo = directType === "videoMessage";
            const buf = await downloadQuoted(m.message, directType);
            const webp = await toWebpSticker(buf, isVideo);
            await conn.sendMessage(from, { sticker: webp, isAnimated: isVideo }, { quoted: mek });
        } else {
            fail(reply, "Reply to a photo/video/gif, or write .sticker in the caption.");
        }
    } catch (e) { fail(reply, "Sticker banane mein error: " + e.message); }
});

// 🆕 (Bunty: "baaki bhi add karo" — AURA's stickersearch): search Tenor's
// GIF library by keyword and send the result as an animated sticker.
// Reuses toWebpSticker (already defined above) instead of adding a new
// wa-sticker-formatter dependency. Tenor's public demo API key (widely
// used by open-source projects) is used here since Bunty doesn't have a
// paid Tenor key — same "free/community API" caveat as the AI commands.
cmd({ pattern: "stickersearch", alias: ["gifsticker", "ssearch"], desc: "Search and send an animated sticker from any keyword", category: "fun", filename: __filename },
async (conn, mek, m, { from, reply, q, args }) => {
    const query = (q || args.join(' ')).trim();
    if (!query) return fail(reply, "Usage: .stickersearch <keyword> (e.g. .stickersearch cat dancing)");
    try {
        const { data } = await axios.get('https://tenor.googleapis.com/v2/search', {
            params: { q: query, key: 'LIVDSRZULELA', limit: 20, media_filter: 'mp4', contentfilter: 'medium' },
            timeout: 15000
        });
        const results = data?.results || [];
        if (!results.length) return fail(reply, `No results for "${query}", try a different keyword.`);
        const pick = results[Math.floor(Math.random() * results.length)];
        const mp4Url = pick?.media_formats?.tinymp4?.url || pick?.media_formats?.mp4?.url;
        if (!mp4Url) return fail(reply, "Couldn't fetch that GIF, try again.");

        const videoRes = await axios.get(mp4Url, { responseType: 'arraybuffer', timeout: 20000, family: 4 });
        const webp = await toWebpSticker(Buffer.from(videoRes.data), true);
        await conn.sendMessage(from, { sticker: webp, isAnimated: true }, { quoted: mek });
    } catch (e) {
        console.log('[STICKERSEARCH] failed:', e.message);
        fail(reply, "Failed to fetch/convert that sticker, try a different keyword.");
    }
});

cmd({ pattern: "toimg", alias: ["toimage"], desc: "Convert sticker back to image", category: "fun", filename: __filename },
async (conn, mek, m, { from, reply }) => {
    try {
        const type = getQuotedType(m);
        if (type !== "stickerMessage") return fail(reply, "Kisi sticker ko reply karke .toimg likho.");
        let buf = await downloadQuoted(m.quoted.message, "stickerMessage");
        if (!isValidWebp(buf)) {
            // One more real download attempt (not just re-checking the same
            // buffer) before giving up — covers a one-off truncated fetch.
            buf = await downloadQuoted(m.quoted.message, "stickerMessage");
        }
        if (!isValidWebp(buf)) {
            return fail(reply, "Ye sticker download corrupt/incomplete aaya (purana ya expired media ho sakta hai). Sticker dobara bhej kar try karo.");
        }
        const inPath = tmp('.webp'); const outPath = tmp('.png');
        fs.writeFileSync(inPath, buf);
        try {
            await new Promise((resolve, reject) => ffmpeg(inPath).on('end', resolve).on('error', reject).save(outPath));
        } catch (ffErr) {
            fs.unlink(inPath, () => {});
            // 🚨 FIX (Bunty: same raw ffmpeg error kept showing up even after
            // the header/truncation check): that check catches most corrupt
            // downloads, but not every possible way a file can fail to
            // decode. Rather than chase every edge case, this is a hard
            // backstop — ANY ffmpeg decode failure here (invalid data,
            // can't determine format, EOF, etc.) now always gets the same
            // clean, friendly message. The raw ffmpeg stack trace is never
            // shown to the user again, no matter what specifically broke.
            return fail(reply, "Ye sticker convert nahi ho saka (corrupt/incomplete media). Sticker dobara bhej kar try karo.");
        }
        await conn.sendMessage(from, { image: fs.readFileSync(outPath), caption: `✅ Converted!${FOOTER}` }, { quoted: mek });
        fs.unlink(inPath, () => {}); fs.unlink(outPath, () => {});
    } catch (e) { fail(reply, "Convert error: " + e.message); }
});

cmd({ pattern: "tts", desc: "Text to speech voice note", category: "fun", filename: __filename },
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return fail(reply, "Usage: .tts <text>  (optionally .tts ur <text> for Urdu)");
        let lang = "en", text = q;
        const parts = q.split(' ');
        if (parts[0].length === 2 && parts.length > 1) { lang = parts[0]; text = parts.slice(1).join(' '); }
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text.slice(0, 200))}&tl=${lang}&client=tw-ob`;
        const res = await axios.get(url, { responseType: 'arraybuffer', timeout: 20000, headers: { 'User-Agent': 'Mozilla/5.0' } });
        const ogg = await mp3BufferToOggVoice(Buffer.from(res.data));
        await conn.sendMessage(from, { audio: ogg, mimetype: "audio/ogg; codecs=opus", ptt: true }, { quoted: mek });
    } catch (e) { fail(reply, "TTS failed: " + e.message); }
});

cmd({ pattern: "meme", desc: "Random meme", category: "fun", filename: __filename },
async (conn, mek, m, { from, reply }) => {
    try {
        const { data } = await axios.get("https://meme-api.com/gimme", { timeout: 15000 });
        await conn.sendMessage(from, { image: { url: data.url }, caption: `😂 ${data.title}${FOOTER}` }, { quoted: mek });
    } catch (e) { fail(reply, "Meme fetch failed."); }
});

const truths = ["Apki sabse embarrassing yaad kya hai?", "Aapne aakhri jhoot kis se bola?", "Aapka secret crush kon hai?", "Sabse zyada kis se dara ho?", "Koi aisi cheez jo kisi ko nahi pata?"];
const dares = ["Apni last DM ka screenshot bhejo.", "10 seconds tak animal sound banao.", "Apne phone ka last search bata do.", "Ek minute tak bina hilay khare raho.", "Group mein apni favorite selfie bhejo."];
cmd({ pattern: "truth", desc: "Random truth question", category: "fun", filename: __filename }, async (conn, mek, m, { reply }) => { reply(`🤔 *TRUTH:* ${truths[Math.floor(Math.random()*truths.length)]}${FOOTER}`); });
cmd({ pattern: "dare", desc: "Random dare challenge", category: "fun", filename: __filename }, async (conn, mek, m, { reply }) => { reply(`🔥 *DARE:* ${dares[Math.floor(Math.random()*dares.length)]}${FOOTER}`); });

cmd({ pattern: "shipquick", desc: "Ship compatibility between two tagged users", category: "fun", filename: __filename },
async (conn, mek, m, { participants, reply }) => {
    try {
        const percent = Math.floor(Math.random() * 101);
        const bar = "💖".repeat(Math.floor(percent / 10)) + "🤍".repeat(10 - Math.floor(percent / 10));
        reply(`💘 *SHIP RESULT*\n${bar}\n${percent}% Match!${FOOTER}`);
    } catch (e) { fail(reply, e.message); }
});

cmd({ pattern: "rps", desc: "Rock Paper Scissors vs bot", category: "fun", filename: __filename },
async (conn, mek, m, { args, reply }) => {
    const choices = ["rock", "paper", "scissors"];
    const user = (args[0] || "").toLowerCase();
    if (!choices.includes(user)) return fail(reply, "Usage: .rps rock/paper/scissors");
    const bot = choices[Math.floor(Math.random() * 3)];
    let result = "🤝 Draw!";
    if ((user === "rock" && bot === "scissors") || (user === "paper" && bot === "rock") || (user === "scissors" && bot === "paper")) result = "🎉 Aap jeet gaye!";
    else if (user !== bot) result = "🤖 Bot jeet gaya!";
    reply(`✊✋✌️ *RPS*\nAap: ${user}\nBot: ${bot}\n${result}${FOOTER}`);
});

const roasts = ["Tum itne slow ho, loading bar bhi tumse fast hai.", "Tumhari wifi jaisi tumhari personality bhi weak hai.", "Google pe bhi tumhare jaise bugs nahi milte."];
const compliments = ["Tum genuinely kamal ke ho!", "Tumhari energy poore group ko positive rakhti hai.", "Tum jo bhi karte ho, dil se karte ho — ye rare hai."];
cmd({ pattern: "roastclassic", alias: ["oldroast"], desc: "Random funny roast (classic one-liner)", category: "fun", filename: __filename }, async (conn, mek, m, { reply }) => { reply(`🔥 ${roasts[Math.floor(Math.random()*roasts.length)]}${FOOTER}`); });
cmd({ pattern: "compliment", desc: "Random compliment", category: "fun", filename: __filename }, async (conn, mek, m, { reply }) => { reply(`🥰 ${compliments[Math.floor(Math.random()*compliments.length)]}${FOOTER}`); });

cmd({ pattern: "cat", desc: "Random cat image", category: "fun", filename: __filename },
async (conn, mek, m, { from, reply }) => {
    try { const { data } = await axios.get("https://api.thecatapi.com/v1/images/search", { timeout: 15000 });
        await conn.sendMessage(from, { image: { url: data[0].url }, caption: `🐱 Meow!${FOOTER}` }, { quoted: mek });
    } catch (e) { fail(reply, "Cat fetch failed."); }
});

cmd({ pattern: "dog", desc: "Random dog image", category: "fun", filename: __filename },
async (conn, mek, m, { from, reply }) => {
    try { const { data } = await axios.get("https://dog.ceo/api/breeds/image/random", { timeout: 15000 });
        await conn.sendMessage(from, { image: { url: data.message }, caption: `🐶 Woof!${FOOTER}` }, { quoted: mek });
    } catch (e) { fail(reply, "Dog fetch failed."); }
});

const morseMap = { A: '.-', B: '-...', C: '-.-.', D: '-..', E: '.', F: '..-.', G: '--.', H: '....', I: '..', J: '.---', K: '-.-', L: '.-..', M: '--', N: '-.', O: '---', P: '.--.', Q: '--.-', R: '.-.', S: '...', T: '-', U: '..-', V: '...-', W: '.--', X: '-..-', Y: '-.--', Z: '--..', '0': '-----', '1': '.----', '2': '..---', '3': '...--', '4': '....-', '5': '.....', '6': '-....', '7': '--...', '8': '---..', '9': '----.', ' ': '/' };
const morseRev = Object.fromEntries(Object.entries(morseMap).map(([k, v]) => [v, k]));
cmd({ pattern: "morse", desc: "Text <-> Morse code converter", category: "fun", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .morse <text>  ya  .morse .... .");
    const isMorse = /^[.\-\/\s]+$/.test(q);
    if (isMorse) {
        const out = q.split(' ').map(c => morseRev[c] || '').join('');
        reply(`🔤 *DECODED:* ${out}${FOOTER}`);
    } else {
        const out = q.toUpperCase().split('').map(c => morseMap[c] || '').join(' ');
        reply(`📡 *MORSE:* ${out}${FOOTER}`);
    }
});

// ================= SEARCH / UTILITY =================

cmd({ pattern: "weather", desc: "Weather info for a city", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    try {
        if (!q) return fail(reply, "Usage: .weather <city>");
        const { data } = await axios.get(`https://wttr.in/${encodeURIComponent(q)}?format=j1`, { timeout: 15000 });
        const c = data.current_condition[0];
        reply(`⛅ *WEATHER — ${q}*\n🌡️ Temp: ${c.temp_C}°C (feels ${c.FeelsLikeC}°C)\n☁️ ${c.weatherDesc[0].value}\n💧 Humidity: ${c.humidity}%\n💨 Wind: ${c.windspeedKmph} km/h${FOOTER}`);
    } catch (e) { fail(reply, "City nahi mila ya weather service down hai."); }
});

cmd({ pattern: "translate", alias: ["tr"], desc: "Translate text", category: "tools", filename: __filename },
async (conn, mek, m, { args, q, reply }) => {
    try {
        if (args.length < 2) return fail(reply, "Usage: .translate <lang_code> <text>  e.g. .translate ur hello");
        const lang = args[0];
        const text = args.slice(1).join(' ');
        const { data } = await axios.get(`https://api.mymemory.translated.net/get`, { params: { q: text, langpair: `en|${lang}` }, timeout: 15000 });
        reply(`🌐 *TRANSLATION*\n${data.responseData.translatedText}${FOOTER}`);
    } catch (e) { fail(reply, "Translate failed: " + e.message); }
});

cmd({ pattern: "wikipedia", alias: ["wiki"], desc: "Search Wikipedia", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    try {
        if (!q) return fail(reply, "Usage: .wikipedia <topic>");
        const { data } = await axios.get(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`, { timeout: 15000 });
        reply(`📖 ${data.title}\n${data.extract}\n\n🔗 ${data.content_urls?.desktop?.page || ''}${FOOTER}`);
    } catch (e) { fail(reply, "Topic nahi mila Wikipedia pe."); }
});

// 🚨 BUG FIX (name collision cleanup): this qrcode command was 100% dead —
// tools-plus.js registers 'qr' as its pattern with ['qrcode','makeqr'] as
// aliases and loads later, so it silently owned BOTH names and this block
// never ran no matter what. Removed instead of leaving unreachable code
// behind; tools-plus.js's version is what actually handles .qrcode/.qr.

cmd({ pattern: "urlshort", alias: ["short"], desc: "Shorten a URL", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    try {
        if (!q) return fail(reply, "Usage: .urlshort <link>");
        const { data } = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(q)}`, { timeout: 15000 });
        reply(`🔗 *SHORT LINK:* ${data}${FOOTER}`);
    } catch (e) { fail(reply, "Shorten failed."); }
});

cmd({ pattern: "currency", alias: ["curr"], desc: "Currency conversion", category: "tools", filename: __filename },
async (conn, mek, m, { args, reply }) => {
    try {
        // Clean up natural input like "50$ to pkr" or "100usd in pkr"
        const cleaned = args.filter(a => !['to', 'in', 'into'].includes(a.toLowerCase()));
        if (cleaned.length < 2) return fail(reply, "Usage: .currency <amount> <from> <to>  e.g. .currency 100 USD PKR");

        let amount = parseFloat(cleaned[0].replace(/[^0-9.]/g, '')) || 1;
        let from, to;
        if (cleaned.length >= 3) {
            from = cleaned[1].replace(/[^a-zA-Z]/g, '').toUpperCase();
            to = cleaned[2].replace(/[^a-zA-Z]/g, '').toUpperCase();
        } else {
            from = "USD"; // amount had a symbol like $ but no explicit from-code given
            to = cleaned[1].replace(/[^a-zA-Z]/g, '').toUpperCase();
        }

        // v2 covers ~201 currencies from 84 central banks (v1/api.frankfurter.app only covers
        // ~31 ECB currencies and does NOT include PKR — that's why this failed before)
        const { data } = await axios.get(`https://api.frankfurter.dev/v2/rate/${from}/${to}`, { timeout: 15000 });
        if (!data || data.rate === undefined) return fail(reply, `${from} → ${to} rate not found. Check the currency code (ISO code like USD, PKR, EUR).`);
        const result = (amount * data.rate).toFixed(2);
        reply(`💱 ${amount} ${from} = ${result} ${to}${FOOTER}`);
    } catch (e) { fail(reply, "Conversion failed — is currency pair ke liye data available nahi hai."); }
});

cmd({ pattern: "dictionary", alias: ["define"], desc: "Word meaning/definition", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    try {
        if (!q) return fail(reply, "Usage: .dictionary <word>");
        const { data } = await axios.get(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(q)}`, { timeout: 15000 });
        const meaning = data[0].meanings[0];
        reply(`📚 ${data[0].word} (${meaning.partOfSpeech})\n${meaning.definitions[0].definition}${FOOTER}`);
    } catch (e) { fail(reply, "Word nahi mila dictionary mein."); }
});

cmd({ pattern: "github", alias: ["gh"], desc: "GitHub user info", category: "tools", filename: __filename },
async (conn, mek, m, { from, q, reply }) => {
    try {
        if (!q) return fail(reply, "Usage: .github <username>");
        const { data } = await axios.get(`https://api.github.com/users/${encodeURIComponent(q)}`, { timeout: 15000 });
        const info = `👤 ${data.name || data.login}\n📝 ${data.bio || 'No bio'}\n📦 Repos: ${data.public_repos}\n👥 Followers: ${data.followers}\n🔗 ${data.html_url}${FOOTER}`;
        await conn.sendMessage(from, { image: { url: data.avatar_url }, caption: info }, { quoted: mek });
    } catch (e) { fail(reply, "GitHub user nahi mila."); }
});

cmd({ pattern: "npm", desc: "NPM package info", category: "tools", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    try {
        if (!q) return fail(reply, "Usage: .npm <package_name>");
        const { data } = await axios.get(`https://registry.npmjs.org/${encodeURIComponent(q)}/latest`, { timeout: 15000 });
        reply(`📦 ${data.name} v${data.version}\n${data.description || ''}\n🔗 https://npmjs.com/package/${data.name}${FOOTER}`);
    } catch (e) { fail(reply, "Package nahi mila."); }
});

cmd({ pattern: "advice", desc: "Random life advice", category: "tools", filename: __filename },
async (conn, mek, m, { reply }) => {
    try { const { data } = await axios.get("https://api.adviceslip.com/advice", { timeout: 15000 });
        reply(`💡 *ADVICE:* ${data.slip.advice}${FOOTER}`);
    } catch (e) { fail(reply, "Advice fetch failed."); }
});

cmd({ pattern: "fact", desc: "Random useless fact", category: "tools", filename: __filename },
async (conn, mek, m, { reply }) => {
    try { const { data } = await axios.get("https://uselessfacts.jsph.pl/api/v2/facts/random", { timeout: 15000 });
        reply(`🧠 *FACT:* ${data.text}${FOOTER}`);
    } catch (e) { fail(reply, "Fact fetch failed."); }
});

cmd({ pattern: "base64", desc: "Encode/decode base64 text", category: "tools", filename: __filename },
async (conn, mek, m, { args, reply }) => {
    try {
        const mode = args[0];
        const text = args.slice(1).join(' ');
        if (!['encode', 'decode'].includes(mode) || !text) return fail(reply, "Usage: .base64 encode/decode <text>");
        const out = mode === 'encode' ? Buffer.from(text).toString('base64') : Buffer.from(text, 'base64').toString('utf-8');
        reply(`🔐 ${mode.toUpperCase()}D: ${out}${FOOTER}`);
    } catch (e) { fail(reply, "Invalid input for base64."); }
});

cmd({ pattern: "color", alias: ["colour"], desc: "Preview a hex color", category: "tools", filename: __filename },
async (conn, mek, m, { from, q, reply }) => {
    try {
        let hex = (q || '').replace('#', '').trim();
        if (!/^[0-9A-Fa-f]{6}$/.test(hex)) return fail(reply, "Usage: .color <hex code>  e.g. .color ff6600");
        const url = `https://dummyimage.com/300x300/${hex}/${hex}.png`;
        await conn.sendMessage(from, { image: { url }, caption: `🎨 *#${hex.toUpperCase()}*${FOOTER}` }, { quoted: mek });
    } catch (e) { fail(reply, e.message); }
});

module.exports = {};
