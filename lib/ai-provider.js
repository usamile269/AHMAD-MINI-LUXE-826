// ============================================================================
// lib/ai-provider.js — single shared "ask an AI" entry point.
// ----------------------------------------------------------------------------
// Previously this exact Groq -> OpenRouter -> (caller's own old proxy)
// logic was copy-pasted into plugins/ai-cmds.js AND plugins/ahmad-ai-batch1.js
// separately. Pulled out here so there's one place to update keys/models/
// order, and so the new .aiby DM auto-reply feature (main.js) can reuse the
// exact same reliable chain instead of a third copy.
// ============================================================================

const axios = require('axios');
const http = require('http');
const https = require('https');
const config = require('../config');

// 🆕 SPEED FIX (Bunty: "speed maintain/tez karay wo add"): a plain axios
// call opens a fresh TCP+TLS connection every single request. keepAlive
// agents reuse the same connection across calls to the same host, which
// shaves real time off every Groq/OpenRouter request (most noticeable when
// the bot is getting hit with several AI commands close together).
const keepAliveHttp = new http.Agent({ keepAlive: true, maxSockets: 50 });
const keepAliveHttps = new https.Agent({ keepAlive: true, maxSockets: 50 });
const fastAxios = axios.create({ httpAgent: keepAliveHttp, httpsAgent: keepAliveHttps });

async function groqReply(prompt) {
    if (!config.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');
    const res = await fastAxios.post('https://api.groq.com/openai/v1/chat/completions', {
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens: 1024
    }, {
        headers: { Authorization: `Bearer ${config.GROQ_API_KEY}`, 'Content-Type': 'application/json' },
        timeout: 15000
    });
    const answer = res.data?.choices?.[0]?.message?.content;
    if (!answer) throw new Error('Groq: no reply');
    return answer;
}

async function openRouterReply(prompt) {
    if (!config.OPENROUTER_API_KEY) throw new Error('OPENROUTER_API_KEY not set');
    const res = await fastAxios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: 'meta-llama/llama-3.3-70b-instruct:free',
        messages: [{ role: 'user', content: prompt }]
    }, {
        headers: {
            Authorization: `Bearer ${config.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://ahmad-mini.bot',
            'X-Title': 'Ahmad Mini'
        },
        timeout: 15000
    });
    const answer = res.data?.choices?.[0]?.message?.content;
    if (!answer) throw new Error('OpenRouter: no reply');
    return answer;
}

// Detects a raw upstream error payload (e.g. Pollinations rate-limit JSON)
// getting passed through as if it were a real answer — used by the old
// free-proxy fallbacks that live outside this file.
function looksLikeErrorPayload(text) {
    if (!text || typeof text !== 'string') return false;
    const t = text.trim();
    if (!t.startsWith('{')) return false;
    try {
        const parsed = JSON.parse(t);
        return !!(parsed.error || parsed.status === 429 || parsed.deprecation_notice);
    } catch {
        return /"error"\s*:|queue full|pollinations\.ai/i.test(t);
    }
}

// 🆕 SPEED FIX (Bunty: "speed maintain/tez karay wo add"): RACES Groq and
// OpenRouter at the same time instead of trying them one after another —
// whichever answers first wins, so a slow-but-not-dead provider never adds
// its own latency on top of the other. Only falls through to sequential
// (old behavior) if one of the two keys isn't configured at all.
async function keylessReply(prompt) {
    // 🚀 LIFETIME AUTO-FIX: uses a public keyless API as the ultimate fallback
    // so the bot never stays silent even if all keys are missing/expired.
    const res = await fastAxios.get(`https://api.giftedtech.my.id/api/ai/gpt4?apikey=gifted&q=${encodeURIComponent(prompt)}`, { timeout: 20000 });
    const answer = res.data?.result;
    if (!answer || looksLikeErrorPayload(answer)) throw new Error('Keyless: no reply');
    return answer;
}

async function smartAI(prompt) {
    // 🚀 AUTO-MODE: tries every available path until one works.
    // 1. If both keys exist, race them for maximum speed.
    if (config.GROQ_API_KEY && config.OPENROUTER_API_KEY) {
        try {
            return await Promise.any([groqReply(prompt), openRouterReply(prompt)]);
        } catch (_) {}
    }
    // 2. Try Groq (if key exists)
    if (config.GROQ_API_KEY) {
        try { return await groqReply(prompt); } catch (_) {}
    }
    // 3. Try OpenRouter (if key exists)
    if (config.OPENROUTER_API_KEY) {
        try { return await openRouterReply(prompt); } catch (_) {}
    }
    // 4. ULTIMATE AUTO-FALLBACK: Keyless API (Always works out of the box)
    try {
        return await keylessReply(prompt);
    } catch (e) {
        // Final fallback: Pollinations (Truly keyless/public)
        const res = await fastAxios.get(`https://text.pollinations.ai/${encodeURIComponent(prompt)}?model=openai&system=You+are+Ahmad+Mini+Luxe+AI+assistant`, { timeout: 15000 });
        if (res.data && !looksLikeErrorPayload(res.data)) return res.data;
        throw new Error('All AI providers failed: ' + e.message);
    }
}

// 🆕 (.aibyahmad voice on): transcribe an incoming WhatsApp voice note via
// Groq's Whisper endpoint, then it gets treated as normal text for smartAI.
async function transcribeVoiceNote(audioBuffer) {
    if (!config.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');
    const FormData = require('form-data');
    const form = new FormData();
    form.append('file', audioBuffer, { filename: 'voice.ogg', contentType: 'audio/ogg' });
    form.append('model', 'whisper-large-v3');
    const res = await fastAxios.post('https://api.groq.com/openai/v1/audio/transcriptions', form, {
        headers: { Authorization: `Bearer ${config.GROQ_API_KEY}`, ...form.getHeaders() },
        timeout: 30000
    });
    return res.data?.text || null;
}

module.exports = { groqReply, openRouterReply, smartAI, looksLikeErrorPayload, transcribeVoiceNote };
