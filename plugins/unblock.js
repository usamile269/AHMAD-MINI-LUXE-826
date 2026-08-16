const { cmd } = require('../arslan');

cmd({
  pattern: "unblock",
  alias: ["unb", "unblk", "unblok"],
  react: "🥰",
  category: "owner",
  desc: "Unblock user (reply or inbox)",
  filename: __filename
}, async (conn, mek, m, { from, reply, isOwner }) => {
  try {

    // 🔒 Owner only
    if (!isOwner) {
      return reply("*❌ 𝗧𝗵𝗶𝘀 𝗰𝗼𝗺𝗺𝗮𝗻𝗱 𝗶𝘀 𝗳𝗼𝗿 𝗼𝘄𝗻𝗲𝗿 𝗼𝗻𝗹𝘆.*");
    }

    let jid;

    // 📌 Reply case
    if (m.quoted) {
      jid = m.quoted.sender;
    }
    // 📌 Inbox case
    else if (from.endsWith("@s.whatsapp.net")) {
      jid = from;
    } 
    else {
      return reply("*📩 𝗣𝗹𝗲𝗮𝘀𝗲 𝗿𝗲𝗽𝗹𝘆 𝘁𝗼 𝗮 𝗺𝗲𝘀𝘀𝗮𝗴𝗲 𝗼𝗿 𝘀𝗲𝗻𝗱 𝘁𝗵𝗲 𝗻𝘂𝗺𝗯𝗲𝗿 𝗶𝗻 𝗶𝗻𝗯𝗼𝘅.*");
    }

    await conn.updateBlockStatus(jid, "unblock");

    await conn.sendMessage(from, {
      react: { text: "🥰", key: mek.key }
    });

    reply(`*MENE APKO UNBLOCK KAR DIYA HAI ☺️*`, { mentions: [jid] });

  } catch (e) {
    console.log("UNBLOCK ERROR:", e);
    reply("*❌ ❌ 𝗙𝗮𝗶𝗹𝗲𝗱 𝘁𝗼 𝘂𝗻𝗯𝗹𝗼𝗰𝗸. 𝗣𝗹𝗲𝗮𝘀𝗲 𝘁𝗿𝘆 𝗮𝗴𝗮𝗶𝗻.*");
  }
});
