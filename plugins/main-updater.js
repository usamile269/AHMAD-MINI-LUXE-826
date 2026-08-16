const { cmd } = require("../command");
const fs = require("fs");

cmd({
    pattern: "update",
    alias: ["restart"],
    desc: "Restart bot",
    category: "owner",
    react: "🚀",
    filename: __filename
},
async (conn, mek, m, { from, reply, isCreator, sender }) => {

    try {

        let sudoList = [];
        if (fs.existsSync("./lib/sudo.json")) {
            sudoList = JSON.parse(fs.readFileSync("./lib/sudo.json"));
        }

        const isSudo = sudoList.includes(sender);

        if (!isCreator && !isSudo) {
            return reply("❌ only owner command use");
        }

        await reply("*BOT RESTART*");

        setTimeout(() => {
            require('child_process').exec("pm2 restart all");
        }, 1000);

    } catch (e) {
        console.error(e);
        reply("❌ Error");
    }
});