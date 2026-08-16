const { cmd } = require('../ahmad-core');
const { sleep } = require('../lib/functions');
const axios = require('axios');
const { randomFooter } = require('../lib/menu-styles');

cmd({
  pattern: "apk",
  alias: ["app", "playstore", "application"],
  react: "☺️",
  desc: "📱 Download APK via Aptoide",
  category: "download",
  use: ".apk <name>",
  filename: __filename
}, async (conn, mek, m, { from, reply, q }) => {

  try {
    await conn.sendMessage(from, {
      react: { text: "📱", key: m.key }
    });

    if (!q) {
      const display = `╭═══ 📱 APK DOWNLOADER ═══⊷
┃❃╭──────────────
┃❃│ ⚠️ No APK Name Provided
┃❃│ 💡 Use: .apk <app name>
┃❃│ 📝 Example: .apk whatsapp
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

    const apiUrl = `http://ws75.aptoide.com/api/7/apps/search/query=${encodeURIComponent(q)}/limit=1`;
    let data;
    try {
        const res = await axios.get(apiUrl, { timeout: 20000 });
        data = res.data;
    } catch (e) {
        data = null;
    }

    if (!data || !data.datalist || !data.datalist.list.length) {
      // Fallback: NexOracle
      try {
        const nexRes = await axios.get(`https://api.nexoracle.com/downloader/apk?apikey=free_key@maher_apis&q=${encodeURIComponent(q)}`, { timeout: 20000 });
        const nexData = nexRes.data?.result;
        if (nexData && nexData.dllink) {
          await conn.sendMessage(from, {
            image: { url: nexData.icon },
            caption: `╭═══ 📱 APK FOUND ═══⊷\n┃❃│ 📛 ${nexData.name}\n┃❃│ 📦 ${nexData.size || 'N/A'}\n┃❃│ ⏳ Downloading...\n╰═════════════════⊷\n\n> ${randomFooter()}`
          }, { quoted: mek });
          await conn.sendMessage(from, {
            document: { url: nexData.dllink },
            mimetype: "application/vnd.android.package-archive",
            fileName: `${nexData.name}.apk`
          }, { quoted: mek });
          await conn.sendMessage(from, { react: { text: "✅", key: m.key } });
          return;
        }
      } catch (e2) { /* fall through to not-found message */ }

      const display = `╭═══ 📱 APK DOWNLOADER ═══⊷
┃❃╭──────────────
┃❃│ ❌ APK Not Found
┃❃│ 🔍 Try different name
┃❃╰───────────────
╰═════════════════⊷

> ${randomFooter()}`;

      await conn.sendMessage(from, {
        text: display,
        quoted: mek
      });

      await conn.sendMessage(from, {
        react: { text: "❌", key: m.key }
      });

      return;
    }

    const app = data.datalist.list[0];
    const appSize = (app.size / 1048576).toFixed(2);

    // Send APK Info
    const display = `╭═══ 📱 APK FOUND ═══⊷
┃❃╭──────────────
┃❃│ 📛 Name: ${app.name.toUpperCase()}
┃❃│ 📦 Size: ${appSize} MB
┃❃│ 📦 Package: ${app.package}
┃❃│ 🔢 Version: ${app.file.vername}
┃❃│ ⏳ Downloading...
┃❃╰───────────────
╰═════════════════⊷

> ${randomFooter()}`;

    await conn.sendMessage(from, {
      text: display,
      quoted: mek
    });

    // Send Image
    await conn.sendMessage(from, {
      image: { url: app.icon },
      caption: `📱 ${app.name.toUpperCase()}\n📦 ${appSize} MB\n🔢 ${app.file.vername}`
    }, { quoted: mek });

    // Send APK File
    await conn.sendMessage(from, {
      document: { url: app.file.path || app.file.path_alt },
      mimetype: "application/vnd.android.package-archive",
      fileName: `${app.name.toUpperCase()}.apk`
    }, { quoted: mek });

    await conn.sendMessage(from, {
      react: { text: "✅", key: m.key }
    });

  } catch (err) {
    console.error("APK Error:", err);
    await conn.sendMessage(from, {
      react: { text: "❌", key: m.key }
    });
    reply("❌ *APK Download Failed!*");
  }
});