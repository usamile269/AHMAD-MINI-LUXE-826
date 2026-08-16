const { cmd } = require('../ahmad-core');
const { sleep } = require('../lib/functions');
const { fetchGif, gifToSticker } = require('../lib/sticker-utils');
const { randomFooter } = require('../lib/menu-styles');

cmd({
    pattern: "attp",
    alias: ["attptext", "textsticker", "namesticker", "stickername", "at", "att", "atp"],
    react: "✨",
    desc: "Convert text into animated sticker",
    category: "sticker",
    use: ".attp <text>",
    filename: __filename
}, async (conn, mek, m, { from, args, reply }) => {

    try {
        await conn.sendMessage(from, {
            react: { text: "✨", key: m.key }
        });

        if (!args[0]) {
            const display = `╭═══ ✨ ATTP STICKER ═══⊷
┃❃╭──────────────
┃❃│ 🥺 No Text Provided
┃❃│ 💡 Use: .attp <text>
┃❃│ 📝 Example: .attp Bilal
┃❃╰───────────────
╰═════════════════⊷

> ${randomFooter()}`;

            await conn.sendMessage(from, {
                text: display,
                quoted: mek
            });

            await conn.sendMessage(from, {
                react: { text: "⚠️", key: m.key }
            });

            return;
        }

        const text = encodeURIComponent(args.join(" "));

        const loading = `╭═══ ✨ ATTP STICKER ═══⊷
┃❃╭──────────────
┃❃│ ✨ Making Sticker...
┃❃│ 📝 Text: ${args.join(" ")}
┃❃│ ⏳ Please wait...
┃❃╰───────────────
╰═════════════════⊷

> ${randomFooter()}`;

        await conn.sendMessage(from, {
            text: loading,
            quoted: mek
        });

        const gifBuffer = await fetchGif(
            `https://api-fix.onrender.com/api/maker/attp?text=${text}`
        );

        const sticker = await gifToSticker(gifBuffer);

        await conn.sendMessage(
            from,
            { sticker, isAnimated: true },
            { quoted: mek }
        );

        await conn.sendMessage(from, {
            react: { text: "✅", key: m.key }
        });

    } catch (e) {
        console.log("ATTP ERROR:", e);
        await conn.sendMessage(from, {
            react: { text: "❌", key: m.key }
        });
        reply("❌ *Sticker banane me error aya!*");
    }
});