const { cmd } = require('../ahmad-core');
const axios = require('axios');
const { randomFooter, renderError } = require('../lib/menu-styles');

const FOOTER = "\n\n> " + randomFooter();
const fail = (reply, msg) => reply(renderError(msg));
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

cmd({ pattern: "dadjoke", desc: "Random dad joke", category: "fun", filename: __filename },
async (conn, mek, m, { reply }) => {
    try {
        const { data } = await axios.get("https://icanhazdadjoke.com/", { headers: { Accept: "application/json" }, timeout: 15000 });
        reply(`😂 ${data.joke}${FOOTER}`);
    } catch (e) { fail(reply, "Joke fetch failed."); }
});

const riddles = [
    ["The taller I am, the less I weigh, and cutting me shorter still lets me work. What am I?", "Pencil"],
    ["I have no home but I'm always stuck in traffic. What am I?", "A road"],
    ["The more you take, the bigger it gets. What is it?", "A hole"],
    ["Everyone breaks me just by saying my name. What am I?", "Silence"],
    ["I have keys but no locks, space but no room. What am I?", "A keyboard"]
];
cmd({ pattern: "riddle", desc: "Random riddle", category: "fun", filename: __filename },
async (conn, mek, m, { reply }) => {
    const [q, a] = pick(riddles);
    reply(`🧠 *RIDDLE:*\n${q}\n\n||💡 Answer: ${a}||${FOOTER}`);
});

const wouldurather = [
    "Eat only one meal for the rest of your life, or never eat your favorite food again?",
    "Be able to teleport anywhere, or freeze time?",
    "Have every lie you tell get caught, or never be able to lie again?",
    "Always be 10 minutes late, or always arrive 20 minutes early?",
    "Be rich but bored, or poor but always happy?"
];
cmd({ pattern: "wouldurather", desc: "Random would-you-rather question", category: "fun", filename: __filename },
async (conn, mek, m, { reply }) => { reply(`🤔 *WOULD YOU RATHER:*\n${pick(wouldurather)}${FOOTER}`); });

const neverHaveIEver = [
    "Given someone a fake compliment.",
    "Skipped class and never got caught.",
    "Read someone's message and deliberately not replied.",
    "Thought something bad about someone but said something else.",
    "Ordered food at 3 AM."
];
cmd({ pattern: "neverhaveiever", alias: ["nhie"], desc: "Random never-have-I-ever prompt", category: "fun", filename: __filename },
async (conn, mek, m, { reply }) => { reply(`🙊 *NEVER HAVE I EVER:*\n${pick(neverHaveIEver)}${FOOTER}`); });

cmd({ pattern: "iqmeter", desc: "Random IQ meter (just for fun)", category: "fun", filename: __filename },
async (conn, mek, m, { reply }) => {
    const iq = Math.floor(Math.random() * 100) + 50;
    reply(`🧠 *IQ METER:* ${iq}\n${iq > 130 ? "Genius level! 🤓" : iq > 100 ? "Pretty smart! 😎" : "Well, not every day can be a good day 😂"}${FOOTER}`);
});

cmd({ pattern: "luckmeter", alias: ["luck"], desc: "How lucky are you today", category: "fun", filename: __filename },
async (conn, mek, m, { reply }) => {
    const luck = Math.floor(Math.random() * 101);
    const bar = "🍀".repeat(Math.floor(luck / 10)) + "⬛".repeat(10 - Math.floor(luck / 10));
    reply(`🍀 *TODAY'S LUCK:*\n${bar}\n${luck}%${FOOTER}`);
});

const zodiacTraits = {
    Aries: "Energetic and bold — you're the leader type.", Taurus: "Stable and loyal — you value consistency.",
    Gemini: "Curious and talkative — you bring conversations to life.", Cancer: "Emotional and caring — you look out for your loved ones.",
    Leo: "Confident and generous — the spotlight suits you.", Virgo: "Detail-oriented and practical — you like perfection.",
    Libra: "Balanced and social — you're the peace-maker.", Scorpio: "Intense and passionate — you go all in on whatever you do.",
    Sagittarius: "Adventurous and honest — you value freedom.", Capricorn: "Disciplined and ambitious — laser-focused on your goals.",
    Aquarius: "Independent and innovative — you think differently.", Pisces: "Dreamy and compassionate — you lead with your heart."
};
cmd({ pattern: "zodiac", desc: "Find your zodiac sign from birth date", category: "fun", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .zodiac DD-MM  e.g. .zodiac 15-08");
    const parts = q.split(/[-\/]/);
    if (parts.length < 2) return fail(reply, "Format: .zodiac DD-MM");
    const [d, mo] = parts.map(Number);
    const signs = [
        [20, "Capricorn"], [19, "Aquarius"], [21, "Pisces"], [20, "Aries"], [21, "Taurus"], [21, "Gemini"],
        [23, "Cancer"], [23, "Leo"], [23, "Virgo"], [23, "Libra"], [22, "Scorpio"], [22, "Sagittarius"], [32, "Capricorn"]
    ];
    const sign = d <= signs[mo - 1][0] ? signs[mo - 1][1] : signs[mo][1];
    reply(`♈ *ZODIAC SIGN: ${sign}*\n${zodiacTraits[sign]}${FOOTER}`);
});

const slapObjects = ["a big fish 🐟", "an old shoe 👞", "a TV remote 📺", "a wet towel 🧺", "a hot tandoor roti 🫓", "a cricket bat 🏏"];
cmd({ pattern: "slap", desc: "Playfully slap someone (tag them)", category: "fun", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const target = q || "themselves";
    reply(`👋 Slapped ${target} with ${pick(slapObjects)}! 😂${FOOTER}`);
});

const comebacks = [
    "I'm a bot, but I'm still busier than you 😎", "Error 404: Insult not found, try harder 😂",
    "Check your own WiFi before you try to roast me 📶", "I'm just code, but I still reply faster than you 🤖",
    "That insult didn't even compile 😂"
];
cmd({ pattern: "insultbot", desc: "Insult the bot and get a comeback", category: "fun", filename: __filename },
async (conn, mek, m, { reply }) => { reply(`🤖 ${pick(comebacks)}${FOOTER}`); });

const pickupLines = [
    "Are you Google? Because you have everything I've been searching for 😄",
    "Are you WiFi? Because I'm feeling a connection 📶",
    "Excuse me, do you have a map? I'm getting lost in your smile 😊",
    "Are you a calendar? Because my days feel incomplete without you 📅"
];
cmd({ pattern: "pickup", alias: ["pickupline"], desc: "Random funny pickup line", category: "fun", filename: __filename },
async (conn, mek, m, { reply }) => { reply(`😄 ${pick(pickupLines)}${FOOTER}`); });

const horrorLines = [
    "When everyone's asleep at night, my charger unplugs itself... 👻",
    "Looked in the mirror last night and saw myself wave — I never waved. 😨",
    "I was home alone when someone called my name from behind... I have no siblings. 🕯️"
];
cmd({ pattern: "horrorstory", alias: ["scary"], desc: "Short scary story", category: "fun", filename: __filename },
async (conn, mek, m, { reply }) => { reply(`👻 ${pick(horrorLines)}${FOOTER}`); });

const conspiracies = [
    "Birds aren't real — they're government drones watching us. 🐦",
    "Autocorrect secretly controls world politics. ⌨️",
    "Socks never actually get lost, they're partying in another dimension. 🧦",
    "Your WiFi router silently judges you every time you reconnect. 📡"
];
cmd({ pattern: "conspiracy", desc: "Random funny fake conspiracy theory", category: "fun", filename: __filename },
async (conn, mek, m, { reply }) => { reply(`🛸 *CONSPIRACY THEORY:*\n${pick(conspiracies)}${FOOTER}`); });

module.exports = {};
