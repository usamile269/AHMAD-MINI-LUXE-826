const { cmd } = require('../ahmad-core');
const axios = require('axios');
const config = require('../config');
const { randomFooter } = require('../lib/menu-styles');
const { looksLikeIdentityQuestion, identityAnswer, withLanguageMatch } = require('../lib/ai-persona');
const { smartAI, looksLikeErrorPayload } = require('../lib/ai-provider');

const FOOTER = randomFooter();

// 🚨 FIX (Bunty: "Ai working ni Ahmad mini ka koi bhi") — gpt/deepseek/gemini
// all pointed at random personal workers.dev Cloudflare Worker proxies
// (apis-bj-devs, officialhectormanuel, bjcoderx). These are hobby projects
// with no uptime guarantee and had gone dark, which is why every one of
// these commands was failing — including the "fallback", which just pointed
// at the same dead gpt-3-5.apis-bj-devs.workers.dev host as the primary, so
// there was no real second option.
// felix-rdx-unlimited-free-apis.vercel.app is the endpoint plugins/felix-apis.js
// already uses for the working .ai and .imagine commands, so it's a proven-live
// host rather than another guess. It's now the last-resort fallback for all
// three chat commands: each still tries its own named model first (in case
// those come back up), but if that fails, it lands on a host we know is up
// instead of a second dead one.
const FELIX_BASE = 'https://felix-rdx-unlimited-free-apis.vercel.app/api/v1/api';

async function felixFallback(q) {
    const res = await axios.get(`${FELIX_BASE}/gptlogic`, {
        params: { q, prompt: 'Be friendly, helpful, and knowledgeable — answer thoroughly. Always reply in the SAME language and script the user wrote in (English, Roman Urdu, or Urdu script).' },
        timeout: 25000
    });
    const answer = res.data && res.data.response;
    if (looksLikeErrorPayload(answer)) throw new Error('Felix fallback returned an upstream error payload, not a real answer');
    return answer;
}
// (Groq/OpenRouter chain now lives in lib/ai-provider.js — smartAI() below
// tries both before anyone falls back to the old proxy chain here.)

function aiReply(model, response) {
    return `╭═══ 🤖 ${model} ═══⊷\n┃❃╭──────────────\n┃❃│ ${response.split('\n').join('\n┃❃│ ')}\n┃❃╰───────────────\n╰═════════════════⊷\n\n${FOOTER}`;
}

// 🆕 (Bunty: "GPT ko sabse heavy banao, har language use kare, koi Ahmad/
// Bunty ke baray mein pouchay to number ke sath batain") — real per-chat
// conversation memory now, instead of the dead unused stub this used to be.
// Free proxy APIs only take a single flat prompt string (no separate
// message-array like real chat APIs), so recent turns get folded into the
// prompt text itself — capped at the last 3 exchanges so the prompt doesn't
// balloon in size or cost extra latency.
const chatHistory = {}; // from -> [{u, a}, ...] capped at 3

function buildPromptWithMemory(from, q) {
    const hist = chatHistory[from] || [];
    const historyText = hist.map(h => `User: ${h.u}\nAssistant: ${h.a}`).join('\n');
    const base = withLanguageMatch(q);
    return historyText ? `Previous conversation:\n${historyText}\n\nNew message — ${base}` : base;
}

function saveToHistory(from, q, answer) {
    if (!chatHistory[from]) chatHistory[from] = [];
    chatHistory[from].push({ u: q, a: answer });
    if (chatHistory[from].length > 3) chatHistory[from].shift();
}

// 1. gpt / ai — flagship AI command
cmd({ pattern: 'gpt', alias: ['chatgpt'], desc: 'Chat with GPT AI (remembers recent context, replies in your language)', category: 'ai', react: '🤖' },
async (conn, mek, m, { reply, args, quoted, from }) => {
    const q = args.join(' ') || quoted?.text;
    if (!q) return reply(`❌ Usage: .gpt <your question>\n📝 Example: .gpt What is AI?`);

    // Identity questions ("who is Ahmad/Bunty") are answered directly —
    // guaranteed correct, not dependent on a free AI proxy following
    // instructions reliably.
    if (looksLikeIdentityQuestion(q)) {
        return reply(aiReply('GPT', identityAnswer(q)));
    }

    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const prompt = buildPromptWithMemory(from, q);
        try {
            const answer = await smartAI(prompt);
            saveToHistory(from, q, answer);
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            return reply(aiReply('GPT', answer));
        } catch (e) {
            console.log('[GPT] Groq failed/skipped, trying old chain:', e.message);
        }
        const res = await axios.get(`https://gpt-3-5.apis-bj-devs.workers.dev/?prompt=${encodeURIComponent(prompt)}`, { timeout: 20000 });
        if (!res.data?.reply || looksLikeErrorPayload(res.data.reply)) throw new Error('No reply');
        saveToHistory(from, q, res.data.reply);
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        reply(aiReply('GPT', res.data.reply));
    } catch {
        try {
            const answer = await felixFallback(withLanguageMatch(q));
            if (!answer) throw new Error('No reply');
            saveToHistory(from, q, answer);
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            return reply(aiReply('GPT', answer));
        } catch {}
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply('❌ GPT failed, try again!');
    }
});

// 2. deepseek
cmd({ pattern: 'deepseek', alias: ['ds'], desc: 'Chat with DeepSeek AI', category: 'ai', react: '🧠' },
async (conn, mek, m, { reply, args, quoted, from }) => {
    const q = args.join(' ') || quoted?.text;
    if (!q) return reply(`❌ Usage: .deepseek <your question>`);
    if (looksLikeIdentityQuestion(q)) return reply(aiReply('DEEPSEEK AI', identityAnswer(q)));
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const prompt = withLanguageMatch(q);
        try {
            const answer = await smartAI(prompt);
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            return reply(aiReply('DEEPSEEK AI', answer));
        } catch (e) {
            console.log('[DEEPSEEK] Groq failed, trying old chain:', e.message);
        }
        const res = await axios.get(`https://all-in-1-ais.officialhectormanuel.workers.dev/?query=${encodeURIComponent(prompt)}&model=deepseek`, { timeout: 25000 });
        const answer = res.data?.response || res.data?.reply || res.data?.result || res.data?.answer;
        if (!answer || looksLikeErrorPayload(answer)) throw new Error('No reply');
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        reply(aiReply('DEEPSEEK AI', answer));
    } catch {
        try {
            const answer = await felixFallback(withLanguageMatch(q));
            if (answer) {
                await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
                return reply(aiReply('AI (Fallback)', answer));
            }
        } catch {}
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply('❌ DeepSeek failed, try again!');
    }
});

// 3. gemini
cmd({ pattern: 'gemini', alias: ['gem', 'google-ai'], desc: 'Chat with Gemini AI', category: 'ai', react: '💫' },
async (conn, mek, m, { reply, args, quoted, from }) => {
    const q = args.join(' ') || quoted?.text;
    if (!q) return reply(`❌ Usage: .gemini <your question>`);
    if (looksLikeIdentityQuestion(q)) return reply(aiReply('GEMINI', identityAnswer(q)));
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const prompt = withLanguageMatch(q);
        try {
            const answer = await smartAI(prompt);
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            return reply(aiReply('GEMINI 1.5', answer));
        } catch (e) {
            console.log('[GEMINI] Groq failed, trying old chain:', e.message);
        }
        const res = await axios.get(`https://gemini-1-5-flash.bjcoderx.workers.dev/?text=${encodeURIComponent(prompt)}`, { timeout: 25000 });
        const answer = res.data?.response || res.data?.reply || res.data?.result || res.data?.answer || (typeof res.data === 'string' ? res.data : null);
        if (!answer || looksLikeErrorPayload(answer)) throw new Error('No reply');
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        reply(aiReply('GEMINI 1.5', answer));
    } catch {
        try {
            const answer = await felixFallback(withLanguageMatch(q));
            if (answer) {
                await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
                return reply(aiReply('AI (Fallback)', answer));
            }
        } catch {}
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply('❌ Gemini failed, try again!');
    }
});

// 4. imagine / ai image
cmd({ pattern: 'gsearch', alias: ['google', 'search'], desc: 'Search the web', category: 'ai', react: '🔍' },
async (conn, mek, m, { reply, args, from }) => {
    const q = args.join(' ');
    if (!q) return reply('❌ Usage: .gsearch <query>\n📝 Example: .gsearch best food in Pakistan');
    try {
        await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
        const res = await axios.get(`https://google-search.bjcoderx.workers.dev/?q=${encodeURIComponent(q)}`, { timeout: 15000 });
        const results = res.data?.results || res.data?.data || [];
        if (!results.length) throw new Error('No results');
        const lines = results.slice(0,5).map((r,i) => `${i+1}. ${r.title || r.name}\n┃❃│    🔗 ${r.link || r.url || ''}`);
        await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
        reply(`╭═══ 🔍 GOOGLE SEARCH ═══⊷\n┃❃│ 🔎 Query: ${q}\n┃❃╭──────────────\n┃❃│ ${lines.join('\n┃❃│ ')}\n┃❃╰───────────────\n╰═════════════════⊷\n\n${FOOTER}`);
    } catch {
        await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
        reply(`❌ Search failed. Try: https://google.com/search?q=${encodeURIComponent(q)}`);
    }
});

// 6. currency
