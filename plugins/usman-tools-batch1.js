// Ported from Usman-MD (free/simple API tools): tinyurl, pastebin, tempmail, ocr
const { cmd } = require('../ahmad-core');
const axios = require('axios');
const FormData = require('form-data');

// ==================== TINYURL ====================
cmd({
    pattern: "tinyurl",
    alias: ["shorturl"],
    desc: "🔗 Shorten a long URL",
    category: "tools",
    react: "🔗",
    filename: __filename,
    use: ".tinyurl <link>"
}, async (conn, mek, m, { from, args, q, reply }) => {
    try {
        const link = (q || args.join(" ") || "").trim();
        if (!link || !/^https?:\/\//i.test(link)) {
            return reply("❎ Please provide a valid link.\n\n📌 Example: *.tinyurl https://example.com*");
        }
        const { data } = await axios.get(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(link)}`, { timeout: 15000 });
        const short = String(data).trim();
        if (!short || !short.startsWith("http")) return reply("❌ Failed to shorten that link.");
        reply(`🔗 *URL Shortener*\n\n✨ Original: ${link}\n🎯 Shortened: ${short}`);
    } catch (e) {
        reply(`⚠️ Error: ${e.message}`);
    }
});

// ==================== PASTEBIN ====================
cmd({
    pattern: "pastebin",
    alias: ["paste"],
    desc: "📋 Paste text and get a shareable link",
    category: "tools",
    react: "📋",
    filename: __filename,
    use: ".pastebin <text>"
}, async (conn, mek, m, { from, args, q, reply }) => {
    try {
        const content = (q || args.join(" ") || "").trim();
        if (!content) return reply("❎ Provide the text to paste.\n\n📌 Example: .pastebin hello world");

        let url = null;
        try {
            const { data } = await axios.get("https://dpaste.org/api/", { params: { content, format: "url" }, timeout: 15000 });
            url = typeof data === "string" ? data.trim() : (data?.link || data?.url);
        } catch (_) {
            const { data } = await axios.post("https://api.paste.ee/v1/pastes", { sections: [{ contents: content }] }, {
                headers: { "X-Auth-Token": process.env.PASTEE_KEY || "public" },
                timeout: 15000
            });
            url = data?.link || data?.url;
        }
        if (!url) return reply("❌ Failed to create paste, try again.");
        reply(`📋 *Pasted!*\n\n🔗 ${url}`);
    } catch (e) {
        reply(`⚠️ Error: ${e.message}`);
    }
});

// ==================== TEMPMAIL ====================
cmd({
    pattern: "tempmail",
    desc: "📧 Generate a new temporary email address",
    category: "tools",
    react: "📧",
    filename: __filename,
    use: ".tempmail"
}, async (conn, mek, m, { from, reply }) => {
    try {
        let response;
        try {
            response = await axios.get('https://apis.davidcyriltech.my.id/temp-mail', {
                timeout: 15000,
                headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" }
            });
        } catch (_) {
            response = await axios.get('https://api.princetechn.com/api/tools/tempmail?apikey=prince', { timeout: 15000 });
        }
        const { email, session_id, expires_at } = response.data || {};
        if (!email) return reply("❌ Temp-mail service is down right now, try again in a bit.");

        const expiresDate = new Date(expires_at);
        const timeString = expiresDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
        const dateString = expiresDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

        reply(`📧 *TEMPORARY EMAIL GENERATED*\n\n✉️ *Email Address:*\n${email}\n\n⏳ *Expires:*\n${timeString} • ${dateString}\n\n🔑 *Session ID:*\n\`\`\`${session_id}\`\`\`\n\n_Email will expire after 24 hours_`);
    } catch (e) {
        reply(`❌ Error: ${e.message}`);
    }
});

// ==================== OCR ====================
cmd({
    pattern: "ocr",
    alias: ["readtext"],
    desc: "📄 Extract text from an image",
    category: "tools",
    react: "📄",
    filename: __filename,
    use: "<reply to an image with .ocr>"
}, async (conn, mek, m, { from, quoted, reply }) => {
    try {
        if (!quoted || quoted.mtype !== 'imageMessage') {
            return reply("❌ Reply to an image with *.ocr*");
        }

        const buffer = await quoted.download();

        const form = new FormData();
        form.append("apikey", process.env.OCR_API_KEY || "K81241004488957"); // OCR.space free demo key
        form.append("language", "eng");
        form.append("isOverlayRequired", "false");
        form.append("file", buffer, { filename: "image.jpg", contentType: "image/jpeg" });

        const { data } = await axios.post("https://api.ocr.space/parse/image", form, {
            headers: form.getHeaders(),
            maxBodyLength: Infinity,
            timeout: 30000
        });

        const text = data?.ParsedResults?.[0]?.ParsedText?.trim();
        if (!text) return reply("❌ Couldn't extract any text from that image.");
        reply(`📄 *Extracted Text*\n\n${text}`);
    } catch (e) {
        reply(`⚠️ Error: ${e.message}`);
    }
});
