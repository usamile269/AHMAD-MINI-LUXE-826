const { cmd } = require('../arslan');
const { setAntideleteStatus, getAntideleteStatus } = require('../data/Antidelete');

cmd({
    pattern: "antidelete",
    alias: ["antidel"],
    desc: "Turn Antidelete on/off",
    category: "owner",
    react: "🛡️"
},
async(conn, mek, m, { args, isOwner, reply, from }) => {
    if (!isOwner) return reply("*❌ 𝗧𝗵𝗶𝘀 𝗰𝗼𝗺𝗺𝗮𝗻𝗱 𝗶𝘀 𝗳𝗼𝗿 𝗼𝘄𝗻𝗲𝗿 𝗼𝗻𝗹𝘆.*");
    const mode = args[0]?.toLowerCase();

    if (mode === 'on' || mode === 'enable') {
        await setAntideleteStatus(from, true);
        await reply("*👑 ANTI-DELETE ACTIVATED 👑*");
    } else if (mode === 'off' || mode === 'disable') {
        await setAntideleteStatus(from, false);
        await reply("*👑 ANTI-DELETE DE-ACTIVATED 👑*");
    } else {
        const current = await getAntideleteStatus(from);
        await reply(`*⚙️ *𝗔𝗻𝘁𝗶-𝗗𝗲𝗹𝗲𝘁𝗲* is currently: *${current ? "ON" : "OFF"}*`);
    }
});
