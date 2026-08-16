const { cmd } = require('../arslan');
const config = require('../config');


cmd({
    pattern: "anti-call",
    react: "👑",
    alias: ["anticall"],
    desc: "Enable or disable welcome messages for new members",
    category: "owner",
    filename: __filename
},
async (conn, mek, m, { from, args, isCreator, reply }) => {
    if (!isCreator) return reply("*❌ 𝗧𝗵𝗶𝘀 𝗰𝗼𝗺𝗺𝗮𝗻𝗱 𝗶𝘀 𝗳𝗼𝗿 𝗼𝘄𝗻𝗲𝗿 𝗼𝗻𝗹𝘆.*");

    const status = args[0]?.toLowerCase();
    if (status === "on") {
        config.ANTI_CALL = "true";
        return reply("*👑 ANTI-CALL ACTIVATED 👑*");
    } else if (status === "off") {
        config.ANTI_CALL = "false";
        return reply("*👑 ANTI-CALL DE-ACTIVATED 👑*");
    } else {
        return reply(`*𝗨𝘀𝗮𝗴𝗲: .anticall on / off*`);
    }
});
