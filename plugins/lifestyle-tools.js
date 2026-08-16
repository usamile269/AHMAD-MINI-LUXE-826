const { cmd } = require('../ahmad-core');
const axios = require('axios');

cmd({
    pattern: 'prayertime',
    alias: ['namaz', 'prayer'],
    desc: 'Get Islamic prayer times for a city',
    category: 'tools',
    react: '🕌',
    use: '.prayertime <city>'
}, async (conn, mek, m, { from, reply, args, text }) => {
    const city = (text || args.join(' ')).trim() || 'Karachi';
    try {
        const { data } = await axios.get('https://api.aladhan.com/v1/timingsByCity', {
            params: { city, country: 'PK', method: 1 }, timeout: 10000
        });
        const t = data?.data?.timings;
        if (!t) return reply('❌ Us city ke prayer times nahi mile.');
        reply(
            `🕌 *Prayer Times — ${city}*\n\n` +
            `🌅 Fajr: ${t.Fajr}\n☀️ Dhuhr: ${t.Dhuhr}\n🌤️ Asr: ${t.Asr}\n` +
            `🌇 Maghrib: ${t.Maghrib}\n🌙 Isha: ${t.Isha}`
        );
    } catch (e) {
        console.log('[PRAYERTIME] failed:', e.message);
        reply('❌ Prayer times fetch nahi ho sake, dobara try karo.\n💡 Use: .prayertime Lahore');
    }
});

const ZODIAC_SIGNS = ['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces'];
const HOROSCOPE_LINES = [
    'A pleasant surprise awaits you today.', 'Focus on what truly matters — the rest can wait.',
    'A conversation today could change your perspective.', 'Trust your instincts, they\'re sharper than usual.',
    'Good news travels toward you.', 'A small risk today pays off later.',
    'Someone from your past may reach out.', 'Your energy is contagious today — use it wisely.',
    'Patience is your strength today, not weakness.', 'An opportunity hides in a small task.',
    'Today favors bold decisions.', 'Rest is productive too — don\'t skip it.'
];

cmd({
    pattern: 'horoscope',
    desc: 'Get today\'s (fun, not real) horoscope for your zodiac sign',
    category: 'fun',
    react: '🔮',
    use: '.horoscope <sign>'
}, async (conn, mek, m, { reply, args, text }) => {
    const sign = (text || args[0] || '').trim().toLowerCase();
    if (!sign || !ZODIAC_SIGNS.includes(sign)) {
        return reply(`❌ Use: .horoscope <sign>\n\nSigns: ${ZODIAC_SIGNS.join(', ')}`);
    }
    // Deterministic per sign+day, so it doesn't change every time you ask
    // on the same day, but does change daily.
    const dayKey = new Date().toISOString().slice(0, 10);
    let seed = 0;
    for (const ch of (sign + dayKey)) seed += ch.charCodeAt(0);
    const line = HOROSCOPE_LINES[seed % HOROSCOPE_LINES.length];
    reply(`🔮 *${sign.charAt(0).toUpperCase() + sign.slice(1)} — Today's Horoscope*\n\n${line}\n\n_Just for fun — not a real astrological reading 😄_`);
});
