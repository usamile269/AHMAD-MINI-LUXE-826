// ============================================================================
// plugins/cybersec-edu.js — ethical-hacking / cybersecurity AWARENESS tools
// ----------------------------------------------------------------------------
// Scope, on purpose: everything here teaches concepts or checks something the
// user gives directly (their own password idea, a hash they already have, a
// public CVE ID, a port number). Nothing here scans, brute-forces, cracks,
// intercepts, or connects to any other person's device/account/network — so
// there's no "target" for it to be misused against. That line is intentional:
// real scanning/cracking/exploit tools give the same file real attack
// capability no matter how it's labeled, so those aren't in here.
// ============================================================================

const { cmd } = require('../ahmad-core');
const axios = require('axios');
const { randomFooter, renderError } = require('../lib/menu-styles');

const FOOTER = "\n\n> " + randomFooter();
const fail = (reply, msg) => reply(renderError(msg));
const box = (title, lines) => `╭═══ 🛡️ ${title} ═══⊷\n${lines.map(l => `┃❃│ ${l}`).join('\n')}\n╰═════════════════⊷${FOOTER}`;

// 1) Password strength checker — pure local math, nothing sent anywhere,
// nothing stored. Teaches WHY a password is weak/strong instead of cracking one.
cmd({
    pattern: "pwstrength",
    alias: ["passcheck", "pwcheck"],
    desc: "🛡️ Check how strong a password idea is (local only, never stored)",
    category: "cybersec",
    use: ".pwstrength MyTest123!",
    filename: __filename
}, async (conn, mek, m, { text, args, reply }) => {
    const pw = text || args.join(' ');
    if (!pw) return fail(reply, "Usage: .pwstrength <password>");

    const checks = {
        length: pw.length >= 12,
        upper: /[A-Z]/.test(pw),
        lower: /[a-z]/.test(pw),
        digit: /[0-9]/.test(pw),
        symbol: /[^A-Za-z0-9]/.test(pw),
        noCommon: !/^(password|123456|qwerty|letmein|admin|welcome|iloveyou)/i.test(pw),
        noRepeat: !/(.)\1{2,}/.test(pw)
    };
    const pool = (checks.upper ? 26 : 0) + (checks.lower ? 26 : 0) + (checks.digit ? 10 : 0) + (checks.symbol ? 32 : 0) || 1;
    const entropyBits = Math.round(pw.length * Math.log2(pool));
    const score = Object.values(checks).filter(Boolean).length;
    const verdict = score <= 3 ? "🔴 Weak" : score <= 5 ? "🟡 Okay" : "🟢 Strong";

    reply(box('PASSWORD STRENGTH', [
        `Verdict: ${verdict}`,
        `Estimated entropy: ~${entropyBits} bits`,
        `Length ≥12: ${checks.length ? '✅' : '❌'}`,
        `Upper+lower mix: ${checks.upper && checks.lower ? '✅' : '❌'}`,
        `Has digit: ${checks.digit ? '✅' : '❌'}`,
        `Has symbol: ${checks.symbol ? '✅' : '❌'}`,
        `Not a common password: ${checks.noCommon ? '✅' : '❌'}`,
        `No repeated chars: ${checks.noRepeat ? '✅' : '❌'}`,
        `Tip: use a random 4-word passphrase instead — longer beats clever.`
    ]));
});

// 2) Hash identifier — pattern-matches length/charset, doesn't crack anything
cmd({
    pattern: "hashid",
    desc: "🛡️ Identify what type a hash likely is, from its length/format",
    category: "cybersec",
    use: ".hashid 5f4dcc3b5aa765d61d8327deb882cf99",
    filename: __filename
}, async (conn, mek, m, { text, args, reply }) => {
    const h = (text || args.join(' ')).trim();
    if (!h) return fail(reply, "Usage: .hashid <hash>");
    if (!/^[a-fA-F0-9$./_-]+$/.test(h)) return fail(reply, "Doesn't look like a hex/standard hash string.");

    const guesses = [];
    if (/^[a-f0-9]{32}$/i.test(h)) guesses.push("MD5 (128-bit)");
    if (/^[a-f0-9]{40}$/i.test(h)) guesses.push("SHA-1 (160-bit)");
    if (/^[a-f0-9]{56}$/i.test(h)) guesses.push("SHA-224");
    if (/^[a-f0-9]{64}$/i.test(h)) guesses.push("SHA-256");
    if (/^[a-f0-9]{96}$/i.test(h)) guesses.push("SHA-384");
    if (/^[a-f0-9]{128}$/i.test(h)) guesses.push("SHA-512");
    if (/^\$2[aby]?\$/.test(h)) guesses.push("bcrypt");
    if (/^\$1\$/.test(h)) guesses.push("MD5-crypt (Unix)");
    if (/^\$6\$/.test(h)) guesses.push("SHA-512-crypt (Unix)");
    if (!guesses.length) guesses.push("Unrecognized — could be a salted/custom hash");

    reply(box('HASH ID', [
        `Input length: ${h.length} chars`,
        `Likely type(s): ${guesses.join(', ')}`,
        `Note: this is pattern-matching only — it does not and cannot reverse/crack the hash.`
    ]));
});

// 3) CVE lookup — public vulnerability database, informational (defensive
// awareness: "is my software affected", not an exploit generator)
cmd({
    pattern: "cve",
    desc: "🛡️ Look up a public CVE by ID (defensive/patch awareness)",
    category: "cybersec",
    use: ".cve CVE-2021-44228",
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    const id = (args[0] || '').toUpperCase();
    if (!/^CVE-\d{4}-\d{4,}$/.test(id)) return fail(reply, "Usage: .cve CVE-YYYY-NNNNN");
    try {
        const { data } = await axios.get(`https://cveawg.mitre.org/api/cve/${id}`, { timeout: 15000 });
        const desc = data?.containers?.cna?.descriptions?.find(d => d.lang === 'en')?.value || 'No description available.';
        const severity = data?.containers?.cna?.metrics?.[0]?.cvssV3_1?.baseSeverity
            || data?.containers?.cna?.metrics?.[0]?.cvssV3_0?.baseSeverity || 'Unknown';
        reply(box('CVE LOOKUP', [
            `ID: ${id}`,
            `Severity: ${severity}`,
            `Summary: ${desc.slice(0, 500)}${desc.length > 500 ? '…' : ''}`
        ]));
    } catch (e) { fail(reply, "Couldn't fetch that CVE — check the ID or try again later."); }
});

// 4) Common port reference — static educational table, doesn't scan any host
cmd({
    pattern: "portinfo",
    alias: ["portref"],
    desc: "🛡️ What a well-known port number is normally used for",
    category: "cybersec",
    use: ".portinfo 443",
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    const PORTS = {
        21: "FTP (file transfer, unencrypted)", 22: "SSH (secure remote login)",
        23: "Telnet (remote login, unencrypted — avoid)", 25: "SMTP (mail sending)",
        53: "DNS (domain name lookups)", 80: "HTTP (unencrypted web)",
        110: "POP3 (mail retrieval)", 143: "IMAP (mail retrieval)",
        443: "HTTPS (encrypted web)", 445: "SMB (Windows file sharing)",
        587: "SMTP submission (mail, with auth)", 993: "IMAPS (encrypted mail)",
        995: "POP3S (encrypted mail)", 3306: "MySQL database",
        3389: "RDP (Windows remote desktop)", 5432: "PostgreSQL database",
        6379: "Redis", 8080: "HTTP alternate (common for dev/proxies)"
    };
    const port = parseInt(args[0], 10);
    if (!port) return fail(reply, "Usage: .portinfo <port number>");
    reply(box('PORT REFERENCE', [
        `Port ${port}: ${PORTS[port] || 'Not in common reference list (could be app-specific or ephemeral).'}`,
        `Reminder: an open port isn't itself a vulnerability — what's listening on it matters.`
    ]));
});

// 5) Phishing-awareness quiz — teaches spotting scams, doesn't help run one
const PHISH_QUIZ = [
    { q: "An email says 'Your account will be suspended in 1 hour, click here now!' Red flag?", a: "Yes — urgency + pressure to click fast is a classic phishing tactic." },
    { q: "A link shows as 'paypal.com' but the actual URL is 'paypa1-secure.com'. Safe?", a: "No — always check the real domain, not just the display text." },
    { q: "A message asks you to 'verify' your password by replying to a text. Safe?", a: "No — legitimate services never ask you to send your password directly." },
    { q: "You get a WhatsApp message from a 'friend's' new number asking for urgent money. Safe?", a: "No — verify by calling their known number first; account/number spoofing is common." },
    { q: "A site has a padlock/HTTPS icon. Does that guarantee it's legitimate?", a: "No — HTTPS only means the connection is encrypted, not that the site is trustworthy." }
];
cmd({
    pattern: "phishquiz",
    desc: "🛡️ Random phishing-awareness quiz question",
    category: "cybersec",
    filename: __filename
}, async (conn, mek, m, { reply }) => {
    const pick = PHISH_QUIZ[Math.floor(Math.random() * PHISH_QUIZ.length)];
    reply(box('PHISHING AWARENESS', [pick.q, `Answer: ${pick.a}`]));
});

// 6) Random security best-practice tip
const SEC_TIPS = [
    "Use a password manager + unique passwords per site — reused passwords are the #1 way accounts get chained-hacked.",
    "Turn on 2FA (preferably an authenticator app, not SMS) everywhere it's offered.",
    "Never enter a password after clicking a link from an email/SMS — type the site's address yourself instead.",
    "Keep your OS and apps updated — most real-world breaches exploit known, already-patched bugs.",
    "Back up important data in at least 2 places — ransomware and phone loss both happen more than people expect.",
    "Public Wi-Fi: avoid logging into banking/sensitive accounts without a VPN.",
];
cmd({
    pattern: "sectip",
    alias: ["cybertip"],
    desc: "🛡️ Random cybersecurity best-practice tip",
    category: "cybersec",
    filename: __filename
}, async (conn, mek, m, { reply }) => {
    reply(box('SECURITY TIP', [SEC_TIPS[Math.floor(Math.random() * SEC_TIPS.length)]]));
});
