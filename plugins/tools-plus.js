const { cmd } = require('../ahmad-core');
const axios = require('axios');
const config = require('../config');
const { fakevCard } = require('../lib/fakevCard');
const { randomFooter } = require('../lib/menu-styles');

const FOOTER = '> ' + randomFooter();

function box(title, lines, emoji = '🔧') {
    return `╭═══ ${emoji} ${title} ═══⊷\n┃❃╭──────────────\n${lines.map(l=>`┃❃│ ${l}`).join('\n')}\n┃❃╰───────────────\n╰═════════════════⊷\n\n${FOOTER}`;
}

function chanCtx() {
    return {
        forwardingScore: 999,
        isForwarded: true,
        forwardedNewsletterMessageInfo: {
            newsletterJid: config.CHANNEL_JID || '120363427856127926@newsletter',
            newsletterName: config.BOT_NAME || '™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 ᥫᩣ',
            serverMessageId: 2
        }
    };
}

// ══════════════════════════════════
// ★ JID TOOLS (3)
// ══════════════════════════════════

// 1. jid
cmd({ pattern: 'channeljid', alias: ['chjid', 'chanid'], desc: 'Get channel JID from a channel link (or a forwarded channel message)', category: 'tools', react: '📢', use: '.channeljid <channel link>  OR  reply to a forwarded channel post' },
async (conn, mek, m, { from, args, reply, quoted }) => {
    // 🚨 FIX (requested by Ahmad): this only ever worked by reading
    // contextInfo off a FORWARDED channel post — if you just had the channel
    // LINK, there was no way to use it. But a whatsapp.com/channel/<code>
    // link already directly contains the JID (<code>@newsletter), so we can
    // resolve it straight from the link with no forwarding needed.
    const linkArg = args.find(a => a.includes('whatsapp.com/channel/'));
    if (linkArg) {
        const code = linkArg.split('whatsapp.com/channel/')[1].split('?')[0].split('/')[0];
        try {
            // 🚨 BUG FIX: the invite code in a channel link is NOT the JID —
            // it must be resolved via newsletterMetadata('invite', code) to
            // get the real JID (this is also what was causing the
            // "GraphQL server error: Bad Request" on .followchannel).
            const meta = await conn.newsletterMetadata('invite', code);
            const jid = meta?.id;
            if (!jid) return reply(box('CHANNEL JID', ['❌ Could not resolve this link — it may be wrong or expired.'], '📢'));
            const name = meta?.name?.text || meta?.name || 'Unknown';
            return conn.sendMessage(from, {
                text: box('CHANNEL JID', [`📢 Name: ${name}`, `🆔 JID: ${jid}`, `💡 Set this in config:`, `   CHANNEL_JID: '${jid}'`], '📢'),
                contextInfo: chanCtx()
            }, { quoted: fakevCard });
        } catch (e) {
            return reply(box('CHANNEL JID', [`❌ Couldn't resolve this link: ${e.message}`], '📢'));
        }
    }

    const ctx = quoted?.message?.contextInfo || mek?.message?.contextInfo;
    const jid = ctx?.forwardedNewsletterMessageInfo?.newsletterJid;
    const name = ctx?.forwardedNewsletterMessageInfo?.newsletterName;
    if (!jid) return reply(box('CHANNEL JID', ['❌ Usage: .channeljid <channel link>', '💡 Or forward a post from the channel and reply to it with .channeljid'], '📢'));
    await conn.sendMessage(from, {
        text: box('CHANNEL JID', [`📢 Name: ${name || 'Unknown'}`, `🆔 JID: ${jid}`, `💡 Set this in config:`, `   CHANNEL_JID: '${jid}'`], '📢'),
        contextInfo: chanCtx()
    }, { quoted: fakevCard });
});

// 3. grouplink
cmd({ pattern: 'country', alias: ['countryinfo', 'nation'], desc: 'Get info about any country', category: 'tools', react: '🌍' },
async (conn, mek, m, { from, args, reply }) => {
    const name = args.join(' ');
    if (!name) return reply('❌ Usage: .country <country name>');
    try {
        const res = await axios.get(`https://restcountries.com/v3.1/name/${encodeURIComponent(name)}`, { timeout: 10000 });
        const c = res.data[0];
        const currencies = Object.values(c.currencies || {}).map(x => `${x.name} (${x.symbol})`).join(', ');
        const languages = Object.values(c.languages || {}).join(', ');
        await conn.sendMessage(from, {
            text: box('COUNTRY INFO', [
                `🌍 ${c.flag} ${c.name.common}`,
                `🏛️ Capital: ${c.capital?.[0] || 'N/A'}`,
                `🌐 Region: ${c.region}`,
                `👥 Population: ${c.population?.toLocaleString()}`,
                `💰 Currency: ${currencies.slice(0, 40)}`,
                `🗣️ Languages: ${languages.slice(0, 60)}`,
                `📞 Calling Code: +${c.idd?.root?.replace('+','')}${c.idd?.suffixes?.[0] || ''}`,
                `⏰ Timezone: ${c.timezones?.[0]}`
            ], '🌍'),
            contextInfo: chanCtx()
        }, { quoted: fakevCard });
    } catch { reply(`❌ Country "${name}" not found!`); }
});

// 6. ipinfo
cmd({ pattern: 'ipinfo', alias: ['ip', 'checkip'], desc: 'Get info about any IP address', category: 'tools', react: '🌐' },
async (conn, mek, m, { from, args, reply }) => {
    const ip = args[0] || '';
    try {
        // 🚨 FIX (".ip lookup failed" even after the slash fix): ipapi.co's
        // free tier is capped at 1000 req/day per IP and returns an error
        // once that's hit — with the bot's traffic all coming from one
        // shared hosting IP, it kept tripping this. Switched to ip-api.com
        // (45 req/min, no key, much more generous for a hosted bot), and
        // still appends a Google Maps link from the returned lat/long.
        const res = await axios.get(`http://ip-api.com/json/${ip}`, {
            params: { fields: 'status,message,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,query' },
            timeout: 10000
        });
        const d = res.data;
        if (d.status !== 'success') throw new Error(d.message || 'lookup failed');
        const mapsLink = (d.lat && d.lon) ? `https://www.google.com/maps?q=${d.lat},${d.lon}` : null;
        await conn.sendMessage(from, {
            text: box('IP INFO', [
                `🌐 IP: ${d.query}`,
                `📍 City: ${d.city}`,
                `🗺️ Region: ${d.regionName}`,
                `🌍 Country: ${d.country} (${d.countryCode})`,
                `📮 Postal: ${d.zip || 'N/A'}`,
                `🌏 Timezone: ${d.timezone}`,
                `📡 ISP: ${(d.isp || d.org || 'N/A').slice(0, 40)}`,
                ...(mapsLink ? [`🗺️ Maps: ${mapsLink}`] : [])
            ], '🌐'),
            contextInfo: chanCtx()
        }, { quoted: fakevCard });
    } catch (e) { reply(`❌ IP lookup failed! (${e.message})`); }
});

// 7. qr
cmd({ pattern: 'qr', alias: ['qrcode', 'makeqr'], desc: 'Generate QR code from text/link', category: 'tools', react: '📱' },
async (conn, mek, m, { from, args, reply, q }) => {
    const text = q || args.join(' ');
    if (!text) return reply('❌ Usage: .qr <text or link>');
    try {
        const url = `https://api.qrserver.com/v1/create-qr-code/?size=512x512&data=${encodeURIComponent(text)}`;
        await conn.sendMessage(from, {
            image: { url },
            caption: box('QR CODE', [`📝 Data: ${text.slice(0, 50)}`, `✅ Scan to get the content`], '📱'),
            contextInfo: chanCtx()
        }, { quoted: fakevCard });
    } catch { reply('❌ QR generation failed!'); }
});

// 8. github
cmd({ pattern: 'numberfact', alias: ['numfact', 'mathfact'], desc: 'Get a fact about any number', category: 'tools', react: '🔢' },
async (conn, mek, m, { from, args, reply }) => {
    const num = args[0] || Math.floor(Math.random() * 1000);
    try {
        const res = await axios.get(`http://numbersapi.com/${num}?json`, { timeout: 10000 });
        await conn.sendMessage(from, {
            text: box('NUMBER FACT', [`🔢 Number: ${num}`, ``, `📌 ${res.data.text}`], '🔢'),
            contextInfo: chanCtx()
        }, { quoted: fakevCard });
    } catch { reply('❌ Could not get number fact!'); }
});

// ══════════════════════════════════
// ★ FUN EXTRA (8)
// ══════════════════════════════════

// 11. catfact
cmd({ pattern: 'catfact', alias: ['meow'], desc: 'Random cat fact with image', category: 'fun', react: '🐱' },
async (conn, mek, m, { from, reply }) => {
    try {
        const [factRes, imgRes] = await Promise.all([
            axios.get('https://catfact.ninja/fact', { timeout: 10000 }),
            axios.get('https://api.thecatapi.com/v1/images/search', { timeout: 10000 })
        ]);
        await conn.sendMessage(from, {
            image: { url: imgRes.data[0]?.url },
            caption: box('CAT FACT 🐱', [`🐱 ${factRes.data.fact}`], '🐱'),
            contextInfo: chanCtx()
        }, { quoted: fakevCard });
    } catch { reply('❌ Could not fetch cat fact!'); }
});

// 12. dog
cmd({ pattern: 'wouldyourather', alias: ['wyr', 'rather'], desc: 'Would you rather game', category: 'fun', react: '🤔' },
async (conn, mek, m, { from, reply }) => {
    const questions = [
        ["Be able to fly", "Be invisible"],
        ["Always speak your mind", "Never speak again"],
        ["Be rich and ugly", "Poor and beautiful"],
        ["Have 10 close friends", "1 best friend"],
        ["Live without music", "Live without movies"],
        ["Know how you die", "Know when you die"],
        ["Be always hot", "Always cold"],
        ["Have no internet", "No phone for a month"],
        ["Be famous", "Be the best friend of someone famous"],
        ["Have super strength", "Super speed"],
        ["Eat only sweet food", "Only salty food forever"],
        ["Never use social media again", "Never watch Netflix again"]
    ];
    const [a, b] = questions[Math.floor(Math.random() * questions.length)];
    await conn.sendMessage(from, {
        text: box('WOULD YOU RATHER 🤔', [`🔵 A) ${a}`, ``, `🔴 B) ${b}`, ``, `💬 Reply A or B!`], '🤔'),
        contextInfo: chanCtx()
    }, { quoted: fakevCard });
});

// 18. neverhaveiever
cmd({ pattern: 'base64encode', alias: ['b64enc', 'encode'], desc: 'Encode text to Base64', category: 'tools', react: '🔒' },
async (conn, mek, m, { from, args, reply, q }) => {
    const text = q || args.join(' ');
    if (!text) return reply('❌ Usage: .base64encode <text>');
    const encoded = Buffer.from(text).toString('base64');
    await conn.sendMessage(from, {
        text: box('BASE64 ENCODE', [`📝 Input: ${text.slice(0, 40)}`, ``, `🔒 Encoded:`, `${encoded}`], '🔒'),
        contextInfo: chanCtx()
    }, { quoted: fakevCard });
});

// 20. base64decode
cmd({ pattern: 'base64decode', alias: ['b64dec', 'decode'], desc: 'Decode Base64 text', category: 'tools', react: '🔓' },
async (conn, mek, m, { from, args, reply, q }) => {
    const text = q || args.join(' ');
    if (!text) return reply('❌ Usage: .base64decode <base64 text>');
    try {
        const decoded = Buffer.from(text, 'base64').toString('utf8');
        await conn.sendMessage(from, {
            text: box('BASE64 DECODE', [`🔒 Input: ${text.slice(0, 40)}`, ``, `🔓 Decoded:`, `${decoded}`], '🔓'),
            contextInfo: chanCtx()
        }, { quoted: fakevCard });
    } catch { reply('❌ Invalid Base64 text!'); }
});

// 21. password
