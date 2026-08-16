// Telegram-based WhatsApp Pairing Bot
// Send your number to this Telegram bot, get pairing code back

const axios = require('axios');
const config = require('./config');
const router = require('./main');
const express = require('express');
const { saveTelegramUser, getAllTelegramUsers, getTelegramUserCount } = require('./lib/database');

const TELEGRAM_TOKEN = config.TELEGRAM_BOT_TOKEN;
if (!TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN is not set! Set it in your host\'s environment variables (Railway/Render/etc → Variables). Get a token from @BotFather on Telegram. telegram-pair.js will not work until this is set.');
}
const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_TOKEN}`;

let lastUpdateId = 0;

// 📇 Remembers which Telegram chat asked for which WhatsApp number's pairing
// code, so when that number actually finishes connecting (event fired from
// main.js), we know where to send the "Connected Successfully" message.
const chatIdByNumber = new Map();

// ✅ Fires the moment a number's WhatsApp connection actually goes live —
// not just when the pairing code was handed out, but when linking the
// device really completed.
if (router.ahmadEvents) {
    router.ahmadEvents.on('connected', async (sanitizedNumber) => {
        const chatId = chatIdByNumber.get(sanitizedNumber);
        if (!chatId) return;
        await sendTelegramMessage(chatId,
            `⚡━━━━━━━━━━━━━━⚡\n   *${BOT_NAME}*\n   ✅ 𝗖𝗢𝗡𝗡𝗘𝗖𝗧𝗘𝗗 𝗦𝗨𝗖𝗖𝗘𝗦𝗦𝗙𝗨𝗟𝗟𝗬\n⚡━━━━━━━━━━━━━━⚡\n\n` +
            `\`${sanitizedNumber}\` is linked and live on WhatsApp 🎉\n\n` +
            `───────────────\n` +
            `*© 𓆩⚘ Powered by ${BOT_NAME} ⚘𓆪*`
        );
        chatIdByNumber.delete(sanitizedNumber);
    });
}

async function getPairingCodeInternal(number) {
    return new Promise((resolve, reject) => {
        const app = express();
        app.use('/', router);
        const server = app.listen(0, () => {
            const port = server.address().port;
            axios.get(`http://localhost:${port}/code?number=${number}`)
                .then(res => {
                    server.close();
                    resolve(res.data);
                })
                .catch(err => {
                    server.close();
                    reject(err);
                });
        });
    });
}

const BOT_NAME = config.BOT_NAME || '™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 ᥫᩣ';
const CHANNEL_LINK = config.CHANNEL_LINK || '';
const SUPPORT_TELEGRAM_ID = '7943215966'; // Telegram user ID — opens a direct chat, not a WhatsApp number
const GROUP_CHAT_LINK = 'https://t.me/teamlegend1';

// ⚡ Neon/Cyber themed random banners — a different vibe on each /start,
// same idea as the WhatsApp welcome message's rotating headers.
const startBanners = [
    `⚡━━━━━━━━━━━━━━⚡\n   🔥 *${BOT_NAME}* 🔥\n   𝗪𝗛𝗔𝗧𝗦𝗔𝗣𝗣 𝗣𝗔𝗜𝗥𝗜𝗡𝗚 𝗕𝗢𝗧\n⚡━━━━━━━━━━━━━━⚡`,
    `🌐『 *${BOT_NAME}* 』🌐\n   ⚡ 𝗖𝗢𝗡𝗡𝗘𝗖𝗧 · 𝗣𝗔𝗜𝗥 · 𝗚𝗢 ⚡`,
    `▓▓▓ *${BOT_NAME}* ▓▓▓\n   💥 𝗟𝗘𝗧'𝗦 𝗚𝗘𝗧 𝗬𝗢𝗨 𝗖𝗢𝗡𝗡𝗘𝗖𝗧𝗘𝗗 💥`,
    `🔷━━━━━━━━━━━━━━🔷\n   *${BOT_NAME}* 𝗜𝗦 𝗢𝗡𝗟𝗜𝗡𝗘\n🔷━━━━━━━━━━━━━━🔷`
];
function randomBanner() {
    return startBanners[Math.floor(Math.random() * startBanners.length)];
}

// 🎛️ Buttons attached to messages — Join Channel + Support + Group always
// available, "How It Works" guide only shown where it's actually useful
// (start + errors). Support opens a direct Telegram chat via the owner's
// Telegram user ID (tg://user?id=...) — this is NOT a WhatsApp number, so
// tapping it opens Telegram, not WhatsApp.
function mainButtons({ guide = false } = {}) {
    const rows = [];
    if (CHANNEL_LINK) rows.push([{ text: '💚 Join WhatsApp Channel', url: CHANNEL_LINK }]);
    if (GROUP_CHAT_LINK) rows.push([{ text: '👥 Join Group Chat', url: GROUP_CHAT_LINK }]);
    if (SUPPORT_TELEGRAM_ID) rows.push([{ text: '🛠️ Support / Owner', url: `tg://user?id=${SUPPORT_TELEGRAM_ID}` }]);
    if (guide) rows.push([{ text: '📖 How It Works', callback_data: 'guide' }]);
    return rows.length ? { inline_keyboard: rows } : undefined;
}

async function sendTelegramMessage(chatId, text, keyboard = mainButtons()) {
    try {
        await axios.post(`${TELEGRAM_API}/sendMessage`, {
            chat_id: chatId,
            text: text,
            parse_mode: 'Markdown',
            reply_markup: keyboard
        });
    } catch (e) {
        console.error('Telegram send error:', e.message);
    }
}

async function answerCallback(callbackQueryId) {
    try {
        await axios.post(`${TELEGRAM_API}/answerCallbackQuery`, { callback_query_id: callbackQueryId });
    } catch (e) {
        console.error('Telegram callback answer error:', e.message);
    }
}

const guideText =
    `⚡━━━━━━━━━━━━━━⚡\n   📖 *${BOT_NAME}* — 𝗛𝗢𝗪 𝗜𝗧 𝗪𝗢𝗥𝗞𝗦\n⚡━━━━━━━━━━━━━━⚡\n\n` +
    `▰▱▱ *STEP 1/3* — Send your WhatsApp number with country code (e.g. \`923001234567\`)\n\n` +
    `▰▰▱ *STEP 2/3* — I'll send you back a pairing code in a few seconds\n\n` +
    `▰▰▰ *STEP 3/3* — Open *WhatsApp → Linked Devices → Link with phone number* and enter the code\n\n` +
    `That's it — you're connected! 🚀`;

// 🛡️ Admin panel — only this Telegram ID can use /admin, broadcast, etc.
// Reuses the same ID as the Support button; add more IDs to the array if
// more than one person should have admin access.
const ADMIN_IDS = [SUPPORT_TELEGRAM_ID].filter(Boolean).map(String);
function isAdmin(chatId) {
    return ADMIN_IDS.includes(String(chatId));
}

// 📢 When an admin taps "Broadcast Message", we remember their chat ID here
// and treat their VERY NEXT message (text, photo, video, document, voice,
// anything) as the broadcast payload — copyMessage forwards it as-is to
// every known user, so any media type "just works" without special-casing it.
let awaitingBroadcastFrom = null;

async function runBroadcast(sourceMessage) {
    const adminChatId = sourceMessage.chat.id;
    awaitingBroadcastFrom = null;
    const users = await getAllTelegramUsers();
    await sendTelegramMessage(adminChatId, `📢 *${BOT_NAME}*\nBroadcasting to *${users.length}* users...`, undefined);

    let sent = 0, failed = 0;
    for (const uid of users) {
        if (String(uid) === String(adminChatId)) continue;
        try {
            await axios.post(`${TELEGRAM_API}/copyMessage`, {
                chat_id: uid,
                from_chat_id: adminChatId,
                message_id: sourceMessage.message_id
            });
            sent++;
        } catch (e) {
            failed++;
        }
        await new Promise(r => setTimeout(r, 40)); // gentle pacing, avoids Telegram flood limits
    }

    await sendTelegramMessage(adminChatId,
        `⚡━━━━━━━━━━━━━━⚡\n   ✅ 𝗕𝗥𝗢𝗔𝗗𝗖𝗔𝗦𝗧 𝗖𝗢𝗠𝗣𝗟𝗘𝗧𝗘\n⚡━━━━━━━━━━━━━━⚡\n\n📤 Sent: *${sent}*\n❌ Failed: *${failed}*\n👥 Total: *${users.length}*`
    );
}

function adminPanelKeyboard() {
    return {
        inline_keyboard: [
            [{ text: '📢 Broadcast Message', callback_data: 'admin_broadcast' }],
            [{ text: '📊 Refresh Stats', callback_data: 'admin_stats' }],
            [{ text: '❌ Cancel', callback_data: 'admin_cancel' }]
        ]
    };
}

async function sendAdminPanel(chatId) {
    const totalUsers = await getTelegramUserCount();
    await sendTelegramMessage(chatId,
        `⚡━━━━━━━━━━━━━━⚡\n   🛡️ *${BOT_NAME} — ADMIN PANEL*\n⚡━━━━━━━━━━━━━━⚡\n\n` +
        `👥 Total Users: *${totalUsers}*\n\n` +
        `Choose an action below 👇`,
        adminPanelKeyboard()
    );
}

async function pollTelegram() {
    try {
        const res = await axios.get(`${TELEGRAM_API}/getUpdates`, {
            params: { offset: lastUpdateId + 1, timeout: 30 }
        });

        const updates = res.data.result;
        for (const update of updates) {
            lastUpdateId = update.update_id;

            // 📖 "How It Works" / 🛡️ admin panel inline button presses
            if (update.callback_query) {
                const cq = update.callback_query;
                await answerCallback(cq.id);
                const cbChatId = cq.message.chat.id;

                if (cq.data === 'guide') {
                    await sendTelegramMessage(cbChatId, guideText, mainButtons());
                } else if (cq.data === 'admin_broadcast' && isAdmin(cbChatId)) {
                    awaitingBroadcastFrom = cbChatId;
                    await sendTelegramMessage(cbChatId,
                        `📢 *${BOT_NAME}*\nSend me the broadcast now — text, photo, video, document, voice, anything. It goes out to every user as soon as I get it.\n\nSend /cancel to back out.`,
                        undefined
                    );
                } else if (cq.data === 'admin_stats' && isAdmin(cbChatId)) {
                    await sendAdminPanel(cbChatId);
                } else if (cq.data === 'admin_cancel' && isAdmin(cbChatId)) {
                    awaitingBroadcastFrom = null;
                    await sendTelegramMessage(cbChatId, `❌ Cancelled.`, mainButtons());
                }
                continue;
            }

            const message = update.message;
            if (!message) continue;

            const chatId = message.chat.id;

            // 📇 Track every user who's ever messaged the bot (for broadcast).
            saveTelegramUser(chatId, {
                username: message.from?.username,
                firstName: message.from?.first_name
            }).catch(() => {});

            // 📢 Admin's next message after tapping "Broadcast Message" — capture
            // it (any type: text/photo/video/etc.) and send it out, instead of
            // treating it as a normal chat message.
            if (awaitingBroadcastFrom && chatId === awaitingBroadcastFrom) {
                if (message.text && message.text.trim() === '/cancel') {
                    awaitingBroadcastFrom = null;
                    await sendTelegramMessage(chatId, `❌ Broadcast cancelled.`, mainButtons());
                } else {
                    await runBroadcast(message);
                }
                continue;
            }

            if (!message.text) continue;

            const text = message.text.trim();

            if (text === '/admin' || text === '/panel') {
                if (!isAdmin(chatId)) {
                    await sendTelegramMessage(chatId, `🚫 *${BOT_NAME}*\nYou're not authorized to use this.`);
                } else {
                    await sendAdminPanel(chatId);
                }
                continue;
            }

            if (text === '/start') {
                await sendTelegramMessage(chatId,
                    `${randomBanner()}\n\n` +
                    `▰▱▱ *STEP 1/3* — Send me your WhatsApp number *with country code* (no \`+\` or spaces) and I'll get you a pairing code instantly 🚀\n\n` +
                    `📱 *Example:* \`923001234567\`\n\n` +
                    `───────────────\n` +
                    `*© 𓆩⚘ Powered by ${BOT_NAME} ⚘𓆪*`,
                    mainButtons({ guide: true })
                );
                continue;
            }

            if (/^\d{10,15}$/.test(text)) {
                chatIdByNumber.set(text, chatId);
                await sendTelegramMessage(chatId, `⏳ *${BOT_NAME}*\n▰▰▱ Requesting pairing code for \`${text}\`...`, undefined);
                try {
                    const result = await getPairingCodeInternal(text);
                    if (result.code) {
                        await sendTelegramMessage(chatId,
                            `⚡━━━━━━━━━━━━━━⚡\n   *${BOT_NAME}*\n   ✅ 𝗣𝗔𝗜𝗥𝗜𝗡𝗚 𝗖𝗢𝗗𝗘 𝗥𝗘𝗔𝗗𝗬\n⚡━━━━━━━━━━━━━━⚡\n\n` +
                            `╭─────────────╮\n` +
                            `   \`${result.code}\`\n` +
                            `╰─────────────╯\n\n` +
                            `▰▰▰ *STEP 3/3* — Open *WhatsApp → Linked Devices → Link with phone number* and enter this code.\n\n` +
                            `📩 I'll message you here the moment it's actually connected ✅\n\n` +
                            `───────────────\n` +
                            `*© 𓆩⚘ Powered by ${BOT_NAME} ⚘𓆪*`
                        );
                    } else {
                        await sendTelegramMessage(chatId, `⚠️ *${BOT_NAME}*\n${JSON.stringify(result)}`);
                    }
                } catch (e) {
                    await sendTelegramMessage(chatId, `❌ *${BOT_NAME}*\nError: ${e.message}`);
                }
            } else {
                await sendTelegramMessage(chatId, `❌ *${BOT_NAME}*\nPlease send a valid number with country code (e.g. \`923001234567\`)`, mainButtons({ guide: true }));
            }
        }
    } catch (e) {
        console.error('Telegram poll error:', e.message);
    }

    setTimeout(pollTelegram, 2000);
}

console.log('🤖 Telegram pairing bot starting...');
console.log('   Open Telegram, find your bot, and send /start');
pollTelegram();
