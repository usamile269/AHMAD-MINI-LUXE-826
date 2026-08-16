const { cmd } = require('../ahmad-core');
const axios = require('axios');
const config = require('../config');
const { randomFooter } = require('../lib/menu-styles');
const { smartAI } = require('../lib/ai-provider');

const FOOTER = '> ' + randomFooter();

function aiReply(title, response) {
    return `╭═══ 🤖 ${title} ═══⊷\n┃❃╭──────────────\n┃❃│ ${String(response).split('\n').join('\n┃❃│ ')}\n┃❃╰───────────────\n╰═════════════════⊷\n\n${FOOTER}`;
}

// Shared AI caller — reuses the SAME endpoints already proven working in
// ai-cmds.js (.gpt / .deepseek fallback chain), just with a custom prompt
// template per command. No new/unverified API domains introduced, so this
// rides on infrastructure that's already live and working for you.
async function callAI(prompt) {
    try {
        return await smartAI(prompt);
    } catch (e) {
        console.log('[AI-BATCH1] Groq+OpenRouter failed, trying old chain:', e.message);
    }
    try {
        const res = await axios.get(`https://gpt-3-5.apis-bj-devs.workers.dev/?prompt=${encodeURIComponent(prompt)}`, { timeout: 25000 });
        if (res.data?.reply) return res.data.reply;
        throw new Error('empty');
    } catch (e) {
        const res2 = await axios.get(`https://all-in-1-ais.officialhectormanuel.workers.dev/?query=${encodeURIComponent(prompt)}&model=deepseek`, { timeout: 25000 });
        const answer = res2.data?.response || res2.data?.reply || res2.data?.result || res2.data?.answer;
        if (!answer) throw new Error('AI service unavailable');
        return answer;
    }
}

function aiCmd(pattern, alias, desc, promptBuilder, emptyMsg) {
    cmd({ pattern, alias, desc, category: 'ai', react: '🤖', filename: __filename },
    async (conn, mek, m, { reply, args, quoted, from, q }) => {
        const input = q || args.join(' ') || quoted?.text;
        if (!input) return reply(emptyMsg);
        try {
            await conn.sendMessage(from, { react: { text: '⏳', key: mek.key } });
            const answer = await callAI(promptBuilder(input));
            await conn.sendMessage(from, { react: { text: '✅', key: mek.key } });
            reply(aiReply(desc.replace(/^[^\w]*/, '').toUpperCase(), answer));
        } catch (e) {
            await conn.sendMessage(from, { react: { text: '❌', key: mek.key } });
            reply('❌ AI service is busy right now, try again in a bit.');
        }
    });
}

// ==================== TRANSLATION & WRITING ====================
aiCmd('translateai', ['transai'], 'Translate text to any language',
    (i) => `Translate the following to ${i.includes('|') ? i.split('|')[0].trim() : 'English'}, reply with ONLY the translation, nothing else: "${i.includes('|') ? i.split('|')[1].trim() : i}"`,
    '❌ Format: .translateai language|text\nExample: .translateai Urdu|How are you?');

aiCmd('grammarfix', ['fixgrammar'], 'Fix grammar and spelling mistakes',
    (i) => `Fix all grammar and spelling mistakes in this text and reply with ONLY the corrected text: "${i}"`,
    '❌ Text do.\nExample: .grammarfix i has went to school yesterday');

aiCmd('paraphraseai', ['rewriteai'], 'Paraphrase/rewrite text',
    (i) => `Paraphrase this text in a different way, keep the same meaning, reply with ONLY the rewritten text: "${i}"`,
    '❌ Text do.\nExample: .paraphraseai The weather is very nice today');

aiCmd('summarizeai', ['summaryai'], 'Summarize a long text',
    (i) => `Summarize this text in 2-3 short sentences: "${i}"`,
    '❌ Text do jo summarize karni hai.');

aiCmd('emailwriter', ['aiemail'], 'Write a professional email',
    (i) => `Write a short, professional email about: ${i}`,
    '❌ Kis baare mein email chahiye batao.\nExample: .emailwriter requesting leave for 3 days');

aiCmd('coverletterai', ['coverletter'], 'Generate a cover letter',
    (i) => `Write a short, professional cover letter for this job: ${i}`,
    '❌ Job/role batao.\nExample: .coverletterai Frontend Developer at a tech startup');

aiCmd('resumetips', ['cvhelp'], 'Get resume/CV improvement tips',
    (i) => `Give 5 short, practical resume tips for someone applying as: ${i}`,
    '❌ Job role batao.\nExample: .resumetips Digital Marketer');

aiCmd('captionai', ['igcaption'], 'Generate an Instagram caption',
    (i) => `Write a short, catchy Instagram caption with 2-3 emojis for a photo about: ${i}`,
    '❌ Photo kis baare mein hai batao.\nExample: .captionai sunset at the beach');

// ==================== CODE ====================
aiCmd('codegenai', ['gencode'], 'Generate code from a description',
    (i) => `Write clean, working code for this request. Include the code in a code block: ${i}`,
    '❌ Kya code chahiye batao.\nExample: .codegenai a function to reverse a string in JavaScript');

aiCmd('debugcodeai', ['fixcode'], 'Find and fix bugs in code',
    (i) => `Find the bug(s) in this code and give the corrected version:\n${i}`,
    '❌ Paste the code (or reply to a code message).');

aiCmd('explaincodeai', ['codewhat'], 'Explain what a piece of code does',
    (i) => `Explain in simple terms what this code does:\n${i}`,
    '❌ Paste the code you want explained.');

aiCmd('codeconvertai', ['convertcode'], 'Convert code between languages',
    (i) => `Convert this code as requested, reply with ONLY the converted code: ${i}`,
    '❌ Format: .codeconvertai convert this Python to JavaScript: <code>');

// ==================== KNOWLEDGE / EXPLAINERS ====================
aiCmd('explainai', ['explainthis'], 'Explain any topic simply',
    (i) => `Explain this in simple, easy words like explaining to a beginner: ${i}`,
    '❌ Topic batao.\nExample: .explainai how does WiFi work');

aiCmd('factcheckai', ['isittrue'], 'Fact-check a claim',
    (i) => `Is this claim true or false? Give a short factual explanation: "${i}"`,
    '❌ Claim batao check karne ke liye.\nExample: .factcheckai the earth is flat');

aiCmd('mathsolverai', ['solvemath'], 'Solve a math problem step by step',
    (i) => `Solve this math problem step by step, show the working: ${i}`,
    '❌ Math problem do.\nExample: .mathsolverai (2x + 5 = 15, find x)');

aiCmd('synonymai', ['synonymfor'], 'Get synonyms for a word',
    (i) => `Give 5 synonyms for the word "${i}", comma separated, nothing else.`,
    '❌ Word do.\nExample: .synonymai happy');

aiCmd('antonymai', ['antonymfor'], 'Get antonyms for a word',
    (i) => `Give 5 antonyms for the word "${i}", comma separated, nothing else.`,
    '❌ Word do.\nExample: .antonymai happy');

// ==================== CREATIVE ====================
aiCmd('essayai', ['writeessay'], 'Write a short essay on a topic',
    (i) => `Write a short essay (150-200 words) about: ${i}`,
    '❌ Topic batao.\nExample: .essayai importance of education');

aiCmd('poemai', ['writepoem'], 'Write a poem on a topic',
    (i) => `Write a short, beautiful poem about: ${i}`,
    '❌ Topic batao.\nExample: .poemai friendship');

aiCmd('storyai', ['writestory'], 'Write a short story on a topic',
    (i) => `Write a short, creative story (under 150 words) about: ${i}`,
    '❌ Topic batao.\nExample: .storyai a robot who wants to be human');

aiCmd('quoteaigen', ['aiquote'], 'Generate an inspirational quote about a topic',
    (i) => `Write one short, original, inspirational quote about ${i}. Reply with ONLY the quote.`,
    '❌ Topic batao.\nExample: .quoteaigen success');

aiCmd('pickuplineai', ['aipickup'], 'Generate a fun pickup line',
    (i) => `Write one short, funny, cheesy pickup line about: ${i || 'general'}`,
    '');

aiCmd('roastai', ['airoast'], 'Get a light, funny AI roast (all in good fun)',
    (i) => `Write one short, playful, good-natured roast joke aimed at: ${i || 'a friend'}. Keep it light and non-offensive.`,
    '');

aiCmd('complimentai', ['complimentme'], 'Get a nice compliment',
    (i) => `Write one short, warm, genuine compliment for: ${i || 'someone having a rough day'}`,
    '');

aiCmd('nameideasai', ['bizname'], 'Get business/brand name ideas',
    (i) => `Suggest 5 creative business/brand name ideas for: ${i}. List them, nothing else.`,
    '❌ Business type batao.\nExample: .nameideasai a coffee shop');

// ==================== PLANNING / ADVICE ====================
aiCmd('adviceai', ['getadvice'], 'Get advice on a situation',
    (i) => `Give short, practical, kind advice for this situation: ${i}`,
    '❌ Situation batao.\nExample: .adviceai I have an exam tomorrow and haven\'t studied');

aiCmd('debateai', ['bothsides'], 'See both sides of a debate topic',
    (i) => `Give a short, balanced summary of BOTH sides of this debate topic: ${i}`,
    '❌ Topic batao.\nExample: .debateai should students have homework');

aiCmd('studyplanai', ['studyplan'], 'Generate a study plan',
    (i) => `Create a short, practical 7-day study plan for: ${i}`,
    '❌ Subject/exam batao.\nExample: .studyplanai final exams in mathematics');

aiCmd('tripplannerai', ['planmytrip'], 'Plan a short trip itinerary',
    (i) => `Create a short 3-day trip itinerary for: ${i}`,
    '❌ Destination batao.\nExample: .tripplannerai Lahore');

aiCmd('interviewprepai', ['interviewtips'], 'Get interview prep tips',
    (i) => `Give 5 short interview preparation tips for this role: ${i}`,
    '❌ Job role batao.\nExample: .interviewprepai Software Engineer');

aiCmd('businessideaai', ['bizidea'], 'Get a business idea in a niche',
    (i) => `Suggest one practical, low-investment business idea for this niche: ${i}`,
    '❌ Niche batao.\nExample: .businessideaai student side hustle');

aiCmd('recipeai', ['whatcancook'], 'Get a recipe idea from ingredients',
    (i) => `Suggest a simple recipe I can make using these ingredients: ${i}`,
    '❌ Ingredients batao (comma separated).\nExample: .recipeai eggs, tomato, onion');

aiCmd('dreaminterpretai', ['dreammeaning'], 'Get a fun dream interpretation',
    (i) => `Give a short, fun, non-serious interpretation of this dream (entertainment only): ${i}`,
    '❌ Describe your dream.\nExample: .dreaminterpretai I was flying over the ocean');

module.exports = {};
