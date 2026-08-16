// ============================================================================
// lib/ai-persona.js — shared identity/persona layer for every .ai/.gpt/etc
// command in the bot.
// ----------------------------------------------------------------------------
// Requested by Bunty: "koi puchay Ahmad x Bunty ya Ahmad ya Bunty to batain
// mere baray mein number ke sath" + "har language use karein" (reply in
// whatever language the person asked in).
//
// Free/unauthenticated AI proxy APIs (the ones this bot currently uses for
// .gpt/.ai/.deepseek/.gemini) don't reliably follow instructions buried
// inside a single prompt string — asking them to "always mention Bunty's
// number when asked about him" is not something you can depend on. So the
// identity question is answered DETERMINISTICALLY here — detected by
// keyword match, answered directly, without ever calling an external AI —
// guaranteed correct every time, instead of hoping a random free model
// cooperates. Every other (non-identity) question still goes to the AI as
// normal, just with a light language-matching instruction added.
// ============================================================================

const config = require('../config');

const IDENTITY_PATTERNS = [
    /\bahmad\s*[x×]\s*bunty\b/i,
    /\bbunty\s*[x×]\s*ahmad\b/i,
    /\bwho\s+(is|are)\s+(ahmad|bunty)\b/i,
    /\bkaun\s+(hai|hain)\s+(ahmad|bunty)\b/i,
    /\b(ahmad|bunty)\s+kaun\s+(hai|hain)\b/i,
    /\btum(hara|hare)?\s+(owner|malik|banane\s*wala|creator)\s+(kaun|kon)\b/i,
    /\bwho\s+(made|created|built|owns?)\s+you\b/i,
    /\byour\s+(owner|creator|developer|maker)\b/i,
    /\bapna\s+owner\s+bata/i,
    /\bmujhe\s+ahmad\s+ke\s+baray?\s+mein\s+bata/i,
    /\btell\s+me\s+about\s+(ahmad|bunty)\b/i,
];

function looksLikeIdentityQuestion(text) {
    if (!text) return false;
    return IDENTITY_PATTERNS.some(re => re.test(text));
}

// Very rough script/language detector — just enough to pick which of the 3
// pre-written answers to use. Not linguistically rigorous on purpose: a
// simple, predictable heuristic beats a fragile "smart" one here.
function detectLanguageStyle(text) {
    if (/[\u0600-\u06FF]/.test(text)) return 'urdu'; // Urdu/Arabic script present
    // crude Roman-Urdu signal: common Roman-Urdu words/particles
    if (/\b(hai|hain|kya|kaun|nahi|acha|tum|tumhara|kar|raha|rahi|mein|kaise)\b/i.test(text)) return 'roman-urdu';
    return 'english';
}

// Best-effort language-matching instruction for GENERAL (non-identity)
// questions — prepended into the prompt sent to the AI. Free proxy APIs
// don't always obey this perfectly, but it noticeably helps most of the
// time, and costs nothing when it doesn't.
function identityAnswer(text) {
    const style = detectLanguageStyle(text);
    const number = config.OWNER_NUMBER;
    const botName = config.BOT_NAME;

    if (style === 'urdu') {
        return `👑 *بنٹی احمد* اس بوٹ (${botName}) کے مالک اور ڈویلپر ہیں۔\n` +
               `📱 نمبر: +${number}\n` +
               `🤖 یہ بوٹ خود بنٹی احمد نے کوڈ کیا ہے — محنت اور مہارت کے ساتھ۔\n` +
               `🙏 اگر بوٹ پسند آیا تو ان کا شکریہ ادا کریں!`;
    }
    if (style === 'roman-urdu') {
        return `👑 *Bunty Ahmad* is bot (${botName}) ke owner aur developer hain.\n` +
               `📱 Number: +${number}\n` +
               `🤖 Ye poora bot khud Bunty Ahmad ne code kiya hai — mehnat aur skill ke sath.\n` +
               `🙏 Bot pasand aaya to unko thanks zaroor bolna!`;
    }
    return `👑 *Bunty Ahmad* is the owner and developer of this bot (${botName}).\n` +
           `📱 Number: +${number}\n` +
           `🤖 He built and coded this entire bot himself — with real passion and skill.\n` +
           `🙏 If you like the bot, give him a shoutout!`;
}

function withLanguageMatch(userText) {
    return `Reply in the SAME language and script the user is writing in (English, Roman Urdu, or Urdu script — match theirs exactly). Be clear, helpful, and reasonably detailed. User's message: ${userText}`;
}

module.exports = { looksLikeIdentityQuestion, identityAnswer, withLanguageMatch, detectLanguageStyle };
