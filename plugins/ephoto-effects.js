const { cmd } = require('../ahmad-core');
const axios = require('axios');
const { ephotoText } = require('../lib/ephoto');
const { randomFooter } = require('../lib/menu-styles');

// 🆕 (Bunty: "hacker aesthetic, aur bhi jo 360 photo api use karta")
// 20 ephoto360-backed text-into-image effects, all sharing one small
// builder function below instead of 20 near-identical command blocks.
const EFFECTS = [
    { pattern: 'hacker', emoji: '💀', label: 'Hacker / Anonymous', url: 'https://en.ephoto360.com/create-anonymous-hacker-avatars-cyan-neon-677.html' },
    { pattern: 'matrix', emoji: '🟩', label: 'Matrix', url: 'https://en.ephoto360.com/matrix-text-effect-154.html' },
    { pattern: 'neonlight', emoji: '💡', label: 'Neon Light', url: 'https://en.ephoto360.com/create-colorful-neon-light-text-effects-online-797.html' },
    { pattern: 'glitchtext', emoji: '📺', label: 'Digital Glitch', url: 'https://en.ephoto360.com/create-digital-glitch-text-effects-online-767.html' },
    { pattern: 'firetext', emoji: '🔥', label: 'Flame Lettering', url: 'https://en.ephoto360.com/flame-lettering-effect-372.html' },
    { pattern: 'icetext', emoji: '❄️', label: 'Ice', url: 'https://en.ephoto360.com/ice-text-effect-online-101.html' },
    { pattern: 'devilwings', emoji: '😈', label: 'Neon Devil Wings', url: 'https://en.ephoto360.com/neon-devil-wings-text-effect-online-683.html' },
    { pattern: 'thundertext', emoji: '⚡', label: 'Thunder', url: 'https://en.ephoto360.com/thunder-text-effect-online-97.html' },
    { pattern: 'purpletext', emoji: '💜', label: 'Purple', url: 'https://en.ephoto360.com/purple-text-effect-online-100.html' },
    { pattern: 'snowtext', emoji: '🌨️', label: '3D Snow', url: 'https://en.ephoto360.com/create-a-snow-3d-text-effect-free-online-621.html' },
    { pattern: 'metallictext', emoji: '⚙️', label: '3D Metal', url: 'https://en.ephoto360.com/impressive-decorative-3d-metal-text-effect-798.html' },
    { pattern: 'lighttext', emoji: '🔮', label: 'Futuristic Light', url: 'https://en.ephoto360.com/light-text-effect-futuristic-technology-style-648.html' },
    { pattern: 'leavestext', emoji: '🍃', label: 'Green Brush', url: 'https://en.ephoto360.com/green-brush-text-effect-typography-maker-online-153.html' },
    { pattern: 'paint3d', emoji: '🎨', label: '3D Colorful Paint', url: 'https://en.ephoto360.com/create-3d-colorful-paint-text-effect-online-801.html' },
    { pattern: 'sandtext', emoji: '🏖️', label: 'Sand Writing', url: 'https://en.ephoto360.com/write-names-and-messages-on-the-sand-online-582.html' },
    { pattern: 'roseCake', emoji: '🌹', label: 'Rose Birthday Cake', url: 'https://en.ephoto360.com/write-name-on-red-rose-birthday-cake-images-462.html' },
    { pattern: 'blackpinklogo', emoji: '🖤', label: 'BLACKPINK Style Logo', url: 'https://en.ephoto360.com/create-a-blackpink-style-logo-with-members-signatures-810.html' },
    { pattern: '1917text', emoji: '🎬', label: '1917 Style', url: 'https://en.ephoto360.com/1917-style-text-effect-523.html' },
    { pattern: 'arenacover', emoji: '⚔️', label: 'Arena of Valor Cover', url: 'https://en.ephoto360.com/create-cover-arena-of-valor-by-mastering-360.html' },
];

for (const effect of EFFECTS) {
    cmd({
        pattern: effect.pattern,
        desc: `Create a "${effect.label}" text/photo effect`,
        category: 'tools',
        react: effect.emoji,
        use: `.${effect.pattern} <text>`
    }, async (conn, mek, m, { from, reply, args, text, q }) => {
        try {
            const input = (text || q || args.join(' ')).trim();
            if (!input) return reply(`❌ Text de do.\n💡 Use: .${effect.pattern} <text>`);
            if (input.length > 40) return reply('❌ 40 characters se kam text rakho.');

            await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });

            const imageUrl = await ephotoText(effect.url, input);

            // 🚨 Pre-fetch ourselves with a retry, instead of handing
            // Baileys a raw { url } — same reliability fix already applied
            // to .menu/.owner/welcome-message elsewhere in this bot, since
            // ephoto360's generated-image CDN can be exactly as flaky as
            // any other external host.
            let buf;
            try {
                const res = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000, family: 4 });
                buf = Buffer.from(res.data);
            } catch (e1) {
                console.log(`[${effect.pattern.toUpperCase()}] image fetch attempt 1 failed:`, e1.message);
                await new Promise((res) => setTimeout(res, 1200));
                const res2 = await axios.get(imageUrl, { responseType: 'arraybuffer', timeout: 15000, family: 4 });
                buf = Buffer.from(res2.data);
            }

            await conn.sendMessage(from, {
                image: buf,
                caption: `${effect.emoji} *${effect.label}*\n\n> ${randomFooter()}`
            }, { quoted: mek });
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        } catch (e) {
            console.log(`[${effect.pattern.toUpperCase()}] failed:`, e.message);
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            reply('❌ Effect generate nahi ho saka, dobara try karo.');
        }
    });
}
