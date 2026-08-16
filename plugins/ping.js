const { cmd } = require('../ahmad-core');
const { toSansBoldItalic, randomFooter } = require('../lib/menu-styles');
const config = require('../config');
const os = require('os');

// 🎨 REDESIGN (Bunty: "channel forward style mein hai hi nahi 🫠"): the
// previous version only attached the channel-forward contextInfo to the
// throwaway "calculating..." placeholder message — the SECOND call (the
// one that actually `edit`s the message into its final, visible form) had
// no contextInfo at all, so the forward badge silently disappeared the
// moment the edit landed. Rewritten to never edit at all: the network-send
// timing is measured with a cheap, invisible presence-update probe first,
// then ONE single real message is sent with the full result AND the full
// channel-forward context attached from the very start — nothing to lose
// on a second call.
const channelContext = {
    forwardingScore: 999,
    isForwarded: true,
    forwardedNewsletterMessageInfo: {
        newsletterJid: config.CHANNEL_JID || "120363427856127926@newsletter",
        newsletterName: config.BOT_NAME,
        serverMessageId: 2,
    },
};

cmd({
  pattern: "ping",
  desc: "⚡ Check bot speed",
  category: "main",
  react: "⚡",
  filename: __filename
}, async (conn, mek, m, { from, reply, arrivalTs }) => {

  try {
    const processMs = Math.max(1, Date.now() - (arrivalTs || Date.now()));

    // Cheap, invisible network round-trip probe (a presence update touches
    // WhatsApp's servers just like a real send does, but produces no
    // visible message) — measured BEFORE the real reply, so the real
    // reply can be sent once, fully formed, contextInfo included from the
    // start.
    const sendStart = Date.now();
    await conn.sendPresenceUpdate('available', from).catch(() => {});
    const networkMs = Math.max(1, Date.now() - sendStart);

    const uptimeSec = process.uptime();
    const uh = Math.floor(uptimeSec / 3600);
    const um = Math.floor((uptimeSec % 3600) / 60);
    const us = Math.floor(uptimeSec % 60);
    const uptimeStr = `${uh}h ${um}m ${us}s`;

    const botName = config.BOT_NAME || 'AHMAD MINI';
    const B = toSansBoldItalic;

    // 🎨 REDESIGN (Bunty: ".ping ni sahi cmd response, usay luxury attractive
    // karo, fonts same hi hon but sab khoob attractive") — same Sans Bold
    // Italic font kept as-is, only the frame around it upgraded: thick
    // double-line ornate border instead of the plain single-line box, a
    // crown/gem header instead of a flat bracket title, and gold-diamond
    // bullets (◈) per stat row for a heavier "luxury dark gold" look.
    const text = `╭◆──「 ◆✦ ${B(botName)} ${B('PING')} ✦◆ 」──◆╮\n` +
        `┃\n` +
        `┃  ◈ ${B('STATUS')}   ➤ ${B('ONLINE')} 💛\n` +
        `┃  ◈ ${B('RESPONSE')} ➤ _${B('Pong!')}_ 🏓\n` +
        `┃  ◈ ${B('SPEED')}    ➤ ${B(String(networkMs))}${B('ms')} ⚡\n` +
        `┃  ◈ ${B('PROCESS')}  ➤ ${B(String(processMs))}${B('ms')} 🧠\n` +
        `┃  ◈ ${B('UPTIME')}   ➤ ${B(uptimeStr)} ⏱️\n` +
        `┃\n` +
        `╰◆──────────────────────◆╯\n` +
        `✦﹒${randomFooter()}`;

    const resultReaction = "⚡";

    await conn.sendMessage(from, {
      text,
      contextInfo: channelContext
    }, { quoted: mek });

    await conn.sendMessage(from, {
      react: { text: resultReaction, key: m.key }
    });

  } catch (e) {
    console.error(e);
    await conn.sendMessage(from, {
      react: { text: "❌", key: m.key }
    });
    reply("❌ *Failed!*");
  }
});
