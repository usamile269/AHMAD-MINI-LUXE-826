const { cmd } = require('../ahmad-core');
const axios = require('axios');
const { runFallbackChain } = require('../lib/fallback-chain');

// 🔧 STANDARDIZED (was single-source, no fallback — died whenever movanest.xyz
// was slow/down). Now uses the shared runFallbackChain() helper with 3
// providers, same pattern as the YouTube downloader's multi-API chain.
async function takeScreenshot(url) {
  return runFallbackChain('SCREENSHOT', [
    {
      name: 'Movanest',
      run: async () => {
        const apiUrl = `https://movanest.xyz/v2/ssweb?url=${encodeURIComponent(url)}&width=1280&height=720&full_page=true`;
        const { data } = await axios.get(apiUrl, { timeout: 20000 });
        if (!data?.status || !data?.screenshot) throw new Error('bad response');
        return data.screenshot;
      }
    },
    {
      name: 'Microlink',
      run: async () => {
        const apiUrl = `https://api.microlink.io/?url=${encodeURIComponent(url)}&screenshot=true&meta=false`;
        const { data } = await axios.get(apiUrl, { timeout: 20000 });
        const shot = data?.data?.screenshot?.url;
        if (!shot) throw new Error('bad response');
        return shot;
      }
    },
    {
      name: 'WordPress mShots',
      run: async () => {
        // Keyless, no rate-limit key needed, always available as last resort.
        return `https://s.wordpress.com/mshots/v1/${encodeURIComponent(url)}?w=1280&h=720`;
      }
    }
  ]);
}

cmd({
  pattern: "screenshot",
  alias: ["ss", "webshot", "sitepic"],
  react: "🖥️",
  category: "tools",
  desc: "Take full HD desktop screenshot of a website",
  use: ".screenshot https://google.com",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    await conn.sendMessage(from, { react: { text: "🖥️", key: m.key } });

    if (!q) {
      await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
      return reply(`*🖥️ WEBSITE SCREENSHOT COMMAND*\n\nUse is tarah:\n*.screenshot <website URL>*\n\nExample:\n*.screenshot https://google.com*`);
    }

    const result = await takeScreenshot(q);
    if (!result.ok) {
      await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
      return reply("❌ Screenshot generate nahi hua — saare providers busy/down hain, thodi der baad try karo.");
    }

    await conn.sendMessage(from, {
      image: { url: result.value },
      caption: `🖥️ Screenshot of: ${q}`
    }, { quoted: mek });

    await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

  } catch (err) {
    console.error("SCREENSHOT COMMAND ERROR:", err.message);
    await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
    reply("❌ Screenshot generate nahi hua / API busy");
  }
});
