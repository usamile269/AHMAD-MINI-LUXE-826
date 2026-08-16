const { cmd } = require("../ahmad-core");
const yts = require("yt-search");
const axios = require("axios");
const { randomFooter } = require('../lib/menu-styles');

function normalizeYouTubeUrl(url) {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/shorts\/|youtube\.com\/.*[?&]v=)([a-zA-Z0-9_-]{11})/);
  return match ? `https://youtube.com/watch?v=${match[1]}` : null;
}

async function fetchDownloadData(url, retries = 2) {
  try {
    const apiUrl = `https://jawad-tech.vercel.app/download/ytdl?url=${encodeURIComponent(url)}`;
    const response = await axios.get(apiUrl, { timeout: 12000 });
    const data = response.data;
    if (data.status === true && data.result) {
      return { video_url: data.result.mp4, title: data.result.title || "YouTube Video" };
    }
    throw new Error("API failed");
  } catch (e) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 1000));
      return fetchDownloadData(url, retries - 1);
    }
    console.log('[VIDEO2 jawad-tech] failed:', e.message);
    return null;
  }
}

cmd({
  pattern: "video2",
  alias: ["ytmp5", "vdl2"],
  react: "🎥",
  desc: "YouTube Video Downloader",
  category: "download",
  use: ".video2 <name or link>",
  filename: __filename
}, async (conn, mek, m, { from, q, reply, prefix, command }) => {
  try {

    if (!q) return reply(`╭═══ 🎥 VIDEO DL ═══⊷\n┃❃│ ⚠️ Use: ${prefix + command} <name or link>\n┃❃│ 📝 Example: .video2 shape of you\n╰═════════════════⊷\n\n> ${randomFooter()}`);

    await conn.sendMessage(from, { react: { text: "🔍", key: m.key } });

    const url = normalizeYouTubeUrl(q);
    let ytdata;

    if (url) {
      const res = await yts(url);
      ytdata = res.videos?.[0];
    } else {
      const res = await yts(q);
      if (!res.videos?.length) return reply("❌ No video found!");
      ytdata = res.videos[0];
    }

    if (!ytdata) return reply("❌ Video info not found!");

    const infoText =
`╭═══ 🎥 VIDEO DOWNLOADER ═══⊷
┃❃╭──────────────
┃❃│ 📌 ${ytdata.title}
┃❃│ 🎬 ${ytdata.author?.name || "Unknown"}
┃❃│ ⏱ ${ytdata.timestamp || "N/A"}
┃❃│ 👁 ${ytdata.views?.toLocaleString() || "N/A"}
┃❃│ ⏳ Downloading...
┃❃╰───────────────
╰═════════════════⊷

> ${randomFooter()}`;

    await conn.sendMessage(from, {
      image: { url: ytdata.thumbnail || ytdata.image },
      caption: infoText
    }, { quoted: mek });

    await conn.sendMessage(from, { react: { text: "⏳", key: m.key } });

    const dlData = await fetchDownloadData(ytdata.url);
    if (!dlData?.video_url) return reply("❌ Download link nahi mila!");

    // 🚀 SPEED FIX (Bunty: "gc may video play/download slow"): this used
    // to always pull the ENTIRE video into a RAM buffer first (arraybuffer,
    // no size cap at all) before handing it to Baileys — so a bigger video
    // meant a long extra wait AND real OOM risk on a memory-constrained
    // host, which itself causes slowdowns/restarts felt across every group
    // the bot is in. Handing Baileys the direct URL instead lets it stream
    // the video straight through, so sending starts immediately instead of
    // waiting for a full download-then-upload round trip.
    try {
      await conn.sendMessage(from, {
        video: { url: dlData.video_url },
        mimetype: "video/mp4",
        caption: `╭═══ ✅ DONE ═══⊷\n┃❃│ 📌 ${dlData.title}\n╰═════════════════⊷\n\n> ${randomFooter()}`
      }, { quoted: mek });
    } catch (err) {
      console.log('[VIDEO2 send] streaming failed, falling back to buffered send:', err.message);
      // Fallback: some hosts/links don't stream cleanly — buffer it, but
      // capped so it can never blow up RAM like before.
      try {
        const videoBuffer = await axios.get(dlData.video_url, {
          responseType: "arraybuffer",
          timeout: 25000,
          maxContentLength: 30 * 1024 * 1024,
          maxBodyLength: 30 * 1024 * 1024
        });
        await conn.sendMessage(from, {
          video: Buffer.from(videoBuffer.data),
          mimetype: "video/mp4",
          caption: `╭═══ ✅ DONE ═══⊷\n┃❃│ 📌 ${dlData.title}\n╰═════════════════⊷\n\n> ${randomFooter()}`
        }, { quoted: mek });
      } catch (err2) {
        console.log('[VIDEO2 send] fallback failed:', err2.message);
        return reply("❌ Video send failed (file too large or invalid link).");
      }
    }

    await conn.sendMessage(from, { react: { text: "✅", key: m.key } });

  } catch (e) {
    console.log("VIDEO2 ERROR:", e);
    await conn.sendMessage(from, { react: { text: "❌", key: m.key } });
    reply("⚠️ Something went wrong!");
  }
});
