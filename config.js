const fs = require('fs');
const dotenv = require('dotenv');

if (fs.existsSync('.env')) {
    dotenv.config({ path: '.env' });
}

module.exports = {
    // 🚨 STORAGE FIX (Bunty: "storage boht ho raha, kaafi jin ki need nahi"):
    // several diagnostic console.log lines were left ON permanently and fire
    // on EVERY single incoming message (not just relevant ones) — on a busy
    // bot that's thousands of log lines an hour, and hosts like KataBump
    // persist stdout to disk, so that log volume is real disk usage. Those
    // lines are now gated behind this flag, OFF by default. Flip to `true`
    // only while actively debugging a specific issue, then set back to
    // false — don't leave it on.
    // 🚨 CHANGED (Bunty: "bot kisi ki chat mein random silent ho jata hai,
    // koi pattern nahi") — turned on so [DROP-DEBUG]/[MSG-ARRIVED]/[CMD
    // DEBUG] lines show up in Railway's logs. Only 6 places in the whole
    // codebase gate on this, so it won't flood the logs. Without this on,
    // a message getting silently dropped (freshness filter, bootMark,
    // WORK_TYPE=private, etc.) leaves literally zero trace anywhere — this
    // is the only way to actually SEE which filter is dropping a given
    // message instead of guessing blind.
    DEBUG_LOGS: false,
    // ===========================================================
    // 1. CONFIGURATION DE BASE (Session & Database)
    // ===========================================================
    SESSION_ID: process.env.SESSION_ID || "MINI BOT",
    // Hardcoded MongoDB for immediate run
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb+srv://romy6220_db_user:jCaKwpMVHVLOeqi7@cluster0.tjswwlb.mongodb.net/?appName=Cluster0',

    // 🆕 (Bunty: ".url/.owner/.menu ke liye reliable upload host — kabhi
    // band na ho") — used for signed uploads via lib/cloudinary.js.
    // ⚠️ Same as MONGODB_URI above: this is a real secret sitting in
    // plaintext in a tracked file. .gitignore already protects git-based
    // pushes, but a manual browser upload to GitHub bypasses that — as
    // flagged before. Rotate this key if it's ever pushed anywhere public.
    // 🆕 (Bunty: "mini_bot unsigned preset use karo") — unsigned upload
    // preset is now the primary method (simpler, no API secret needed in
    // upload requests at all). API key/secret kept below in case signed
    // uploads are ever needed for something else later.
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || 'qdskwzyn',
    CLOUDINARY_UPLOAD_PRESET: process.env.CLOUDINARY_UPLOAD_PRESET || 'mini_bot',
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || '499249265193317',
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || 'omOIflH8DQyMu9Par9RpeBxKR0A',
    

    // ===========================================================
    // 2. INFORMATIONS DU BOT
    // ===========================================================
    PREFIX: process.env.PREFIX || '.',
    OWNER_NUMBER: '923044975027', // Hardcoded as requested
    // 🆕 (Bunty: "bot name > Ahmad mini karo is style may, footer obsidian
    // jo hai etc bold, or yeh fonts") — renamed to "Ahmad Mini" and styled
    // with the same bold-italic-serif Unicode font already used in the
    // footer branding ("𝙊𝘽𝙎𝙄𝘿𝙄𝘼𝙉 𝙇𝙐𝙓𝙀 • ™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 ᥫᩣ" — see
    // lib/menu-styles.js FOOTERS), so the bot name and the footer now
    // visually match everywhere.
    BOT_NAME: "™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 ᥫᩣ",
    RAPID_API_KEY: process.env.RAPID_API_KEY || 'b98acee8f5msh4a4fba7da6018ddp1caf30jsn44a2220ad16f',
    // 🆕 (Bunty: "Groq api lagain?") — Groq's free tier (console.groq.com,
    // no card needed) is a real, fast, reliable LLM host — used as the new
    // PRIMARY source for .gpt/.deepseek/.gemini in plugins/ai-cmds.js,
    // ahead of the old flaky personal workers.dev proxies (kept as
    // fallback). No default value on purpose: this needs Bunty's own free
    // key. Get one at https://console.groq.com/keys and set GROQ_API_KEY
    // in .env (or paste it here) — until then these commands just skip
    // straight to the old fallback chain, nothing breaks.
    GROQ_API_KEY: process.env.GROQ_API_KEY || '',
    // 🆕 (Bunty: "yeh bhi lagao") — OpenRouter, second real AI provider.
    // Used as the tier RIGHT AFTER Groq in the fallback chain (Groq first
    // since it's fastest; OpenRouter next since it's also a real paid-grade
    // provider, ahead of the old flaky workers.dev proxies).
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY || '',
    CHANNEL_JID: process.env.CHANNEL_JID || '120363407376142647@newsletter',
    
    // ✅ Auto-follow list
    // 🚨 REMOVED (Bunty: "ek channel sold ho gaya, uski jid hatao") —
    // 120363427856127926@newsletter no longer belongs to us (sold), so it's
    // taken out of both autofollow and autoreact (they share this same
    // list) — everything else (the other 3 JIDs, both features themselves)
    // stays exactly as it was.
    AUTO_FOLLOW_JIDS: [
        '120363407376142647@newsletter',
        '120363428287033693@newsletter',
        '120363366922413790@newsletter'
    ],
    
    CHANNEL_POST_JIDS: [
        '120363407376142647@newsletter',
        '120363428287033693@newsletter'
    ],
    BOT_FOOTER: "> 𝙊𝘽𝙎𝙄𝘿𝙄𝘼𝙉 𝙇𝙐𝙓𝙀 𝘼𝙃𝙈𝘼𝘿 𝙈𝙄𝙉𝙄",
    
    WORK_TYPE: process.env.WORK_TYPE || "public", 

    // Optimized speed: reduced cooldown
    CMD_COOLDOWN: 0, 
    
    // ===========================================================
    // 3. FONCTIONNALITÉS AUTOMATIQUES (STATUTS)
    // ===========================================================
    AUTO_VIEW_STATUS: 'true', 
    AUTO_LIKE_STATUS: 'true', 
    AUTO_LIKE_EMOJI: ['❤️', '🌹', '✨', '🥰', '🌹', '😍', '💞', '💕', '☺️', '🤗'], 
    
    AUTO_STATUS_REPLY: 'false', 
    AUTO_STATUS_MSG: '🤗', 
    
    // ===========================================================
    // 4. FONCTIONNALITÉS DE CHAT & PRÉSENCE
    // ===========================================================
    READ_MESSAGE: 'false', 
    AUTO_TYPING: 'false', 
    AUTO_RECORDING: 'false', 
    AUTO_REACT: 'false', // 🚨 CHANGED (Bunty: "autoreact default off ho, channel wala always on") — normal DM/group auto-react now off by default; channel/newsletter auto-react is separate and always on regardless of this.
    
    // ===========================================================
    // 5. GESTION DES GROUPES
    // ===========================================================
    WELCOME_ENABLE: 'true',
    GOODBYE_ENABLE: 'true',
    WELCOME_MSG: null, 
    GOODBYE_MSG: null, 
    WELCOME_IMAGE: null, 
    GOODBYE_IMAGE: null,
    
    GROUP_INVITE_LINK: 'https://chat.whatsapp.com/HE7P1KjA1gxBR3pcuQ110S',
    
    // ===========================================================
    // 6. SÉCURITÉ & ANTI-CALL
    // ===========================================================
    ANTI_CALL: 'false', 
    REJECT_MSG: '*CALL LATER PLEASE ☺️🌹*',
    
    // ===========================================================
    // 7. IMAGES & LIENS
    // ===========================================================
    IMAGE_PATH: 'https://files.catbox.moe/fdewhk.png',
    // 🚨 FIX (Bunty: "pic nahi aa rahi, menu slow, catbox unreliable —
    // yeh naya image host use karo"): allmenu.js checks config.MENU_IMAGE
    // specifically (not IMAGE_PATH) — that key never existed in config.js
    // before, so it always silently fell through to a hardcoded catbox.moe
    // URL no matter what. Added properly here now.
    // 🆕 (Bunty: "overall bot dp/audio yeh lagao") — both moved to Bunty's
    // own Cloudinary account.
    MENU_IMAGE: 'https://res.cloudinary.com/qdskwzyn/image/upload/v1785495694/AhmadHosting_ms8u1aiw10x6yr.jpg',
    MENU_AUDIO: 'https://res.cloudinary.com/qdskwzyn/video/upload/v1785497379/AhmadHosting_ms8v1ejbw6v6z0.mp3',
    WELCOME_VIDEO_PATH: 'https://files.catbox.moe/rs1u1s.mp4',
    CHANNEL_LINK: '',
    
    // ===========================================================
    // 8. EXTERNAL API
    // ===========================================================
    TELEGRAM_BOT_TOKEN: '8688123635:AAHpVAHL0z9FCsehvKsdYVOwlq2fyx1T9i8',
    TELEGRAM_CHAT_ID: '923044975027',

    // ===========================================================
    // 9. ADMIN PANEL
    // ===========================================================
    ADMIN_PANEL_KEY: 'bunty-admin-2026',
    // 🔐 Optional API key protection for the /code (pairing), /disconnect,
    // and /connect-all endpoints — same idea as Usman-MD's requireApiKey
    // middleware. Leave blank ('') to keep these endpoints public exactly
    // as before (default, so nothing breaks for existing deployments). Set
    // PAIR_API_KEY env var (or edit this default) to require callers to
    // send it as ?apikey=... or an x-api-key header.
    PAIR_API_KEY: process.env.PAIR_API_KEY || ''
    
};
