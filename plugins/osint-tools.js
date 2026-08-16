// ============================================================================
// plugins/osint-tools.js — legal, passive OSINT / network-info tools
// ----------------------------------------------------------------------------
// Everything here only reads PUBLIC information that a domain/site owner
// already exposes to anyone (DNS records, WHOIS/RDAP registration data,
// SSL certificate details, HTTP response headers, certificate-transparency
// logs). Nothing here connects to arbitrary ports, brute-forces anything,
// or touches a target beyond what a normal browser visit already does.
// Built on Node's own core `dns`/`tls`/`crypto` modules + simple public
// APIs — no extra npm installs needed, so this works immediately after
// deploy with no `npm install` step.
// ============================================================================

const { cmd } = require('../ahmad-core');
const axios = require('axios');
const dns = require('dns').promises;
const tls = require('tls');
const crypto = require('crypto');
const { randomFooter, renderError } = require('../lib/menu-styles');

const FOOTER = "\n\n> " + randomFooter();
const fail = (reply, msg) => reply(renderError(msg));
const box = (title, lines) => `╭═══ 🕵️ ${title} ═══⊷\n${lines.map(l => `┃❃│ ${l}`).join('\n')}\n╰═════════════════⊷${FOOTER}`;
const cleanDomain = (s) => (s || '').replace(/^https?:\/\//i, '').split('/')[0].trim();

// 1) WHOIS / domain registration info via RDAP (free, keyless, standardized)
cmd({
    pattern: "whois",
    desc: "🕵️ Domain registration (WHOIS/RDAP) lookup",
    category: "osint",
    use: ".whois example.com",
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    const domain = cleanDomain(args[0]);
    if (!domain) return fail(reply, "Usage: .whois example.com");
    try {
        const { data } = await axios.get(`https://rdap.org/domain/${domain}`, { timeout: 15000 });
        const registrar = data.entities?.find(e => e.roles?.includes('registrar'))?.vcardArray?.[1]?.find(v => v[0] === 'fn')?.[3] || 'Unknown';
        const created = data.events?.find(e => e.eventAction === 'registration')?.eventDate || 'Unknown';
        const expires = data.events?.find(e => e.eventAction === 'expiration')?.eventDate || 'Unknown';
        const nameservers = (data.nameservers || []).map(n => n.ldhName).join(', ') || 'Unknown';
        reply(box('WHOIS', [
            `Domain: ${data.ldhName || domain}`,
            `Registrar: ${registrar}`,
            `Created: ${created}`,
            `Expires: ${expires}`,
            `Status: ${(data.status || []).join(', ') || 'Unknown'}`,
            `Nameservers: ${nameservers}`
        ]));
    } catch (e) { fail(reply, "WHOIS lookup failed — domain may not exist or RDAP unsupported for this TLD."); }
});

// 2) DNS records — pure Node core `dns` module, no external API at all
cmd({
    pattern: "dnslookup",
    alias: ["dns"],
    desc: "🕵️ Look up A/AAAA/MX/NS/TXT records for a domain",
    category: "osint",
    use: ".dnslookup example.com",
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    const domain = cleanDomain(args[0]);
    if (!domain) return fail(reply, "Usage: .dnslookup example.com");
    try {
        const [a, aaaa, mx, ns, txt] = await Promise.all([
            dns.resolve4(domain).catch(() => []),
            dns.resolve6(domain).catch(() => []),
            dns.resolveMx(domain).catch(() => []),
            dns.resolveNs(domain).catch(() => []),
            dns.resolveTxt(domain).catch(() => [])
        ]);
        reply(box('DNS RECORDS', [
            `Domain: ${domain}`,
            `A: ${a.join(', ') || 'none'}`,
            `AAAA: ${aaaa.join(', ') || 'none'}`,
            `MX: ${mx.map(r => r.exchange).join(', ') || 'none'}`,
            `NS: ${ns.join(', ') || 'none'}`,
            `TXT: ${txt.length ? txt.map(t => t.join('')).slice(0, 3).join(' | ') : 'none'}`
        ]));
    } catch (e) { fail(reply, "DNS lookup failed: " + e.message); }
});

// 3) SSL certificate info — pure Node core `tls` module
cmd({
    pattern: "sslinfo",
    alias: ["sslcheck"],
    desc: "🕵️ Check a site's SSL certificate details",
    category: "osint",
    use: ".sslinfo example.com",
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    const domain = cleanDomain(args[0]);
    if (!domain) return fail(reply, "Usage: .sslinfo example.com");
    try {
        const cert = await new Promise((resolve, reject) => {
            const socket = tls.connect(443, domain, { servername: domain, timeout: 10000 }, () => {
                resolve(socket.getPeerCertificate());
                socket.end();
            });
            socket.on('error', reject);
            socket.on('timeout', () => { socket.destroy(); reject(new Error('timed out')); });
        });
        if (!cert || !cert.subject) return fail(reply, "No certificate returned — site may not use HTTPS.");
        reply(box('SSL CERTIFICATE', [
            `Domain: ${domain}`,
            `Issued to: ${cert.subject?.CN || 'Unknown'}`,
            `Issuer: ${cert.issuer?.O || cert.issuer?.CN || 'Unknown'}`,
            `Valid from: ${cert.valid_from}`,
            `Valid to: ${cert.valid_to}`
        ]));
    } catch (e) { fail(reply, "SSL check failed: " + e.message); }
});

// 4) HTTP response headers — same info your browser's devtools shows
cmd({
    pattern: "headers",
    alias: ["httpheaders"],
    desc: "🕵️ Show a URL's HTTP response headers",
    category: "osint",
    use: ".headers https://example.com",
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    let url = args[0];
    if (!url) return fail(reply, "Usage: .headers https://example.com");
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try {
        const res = await axios.get(url, { timeout: 15000, validateStatus: () => true, maxRedirects: 5 });
        const lines = Object.entries(res.headers).slice(0, 12).map(([k, v]) => `${k}: ${v}`);
        reply(box(`HEADERS (${res.status})`, lines.length ? lines : ['No headers returned']));
    } catch (e) { fail(reply, "Header fetch failed: " + e.message); }
});

// 5) Subdomain discovery via crt.sh — PASSIVE ONLY: reads public
// certificate-transparency logs, never connects to the target itself.
cmd({
    pattern: "subdomains",
    alias: ["subfinder"],
    desc: "🕵️ Find known subdomains via certificate-transparency logs",
    category: "osint",
    use: ".subdomains example.com",
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    const domain = cleanDomain(args[0]);
    if (!domain) return fail(reply, "Usage: .subdomains example.com");
    try {
        const { data } = await axios.get(`https://crt.sh/?q=%25.${domain}&output=json`, { timeout: 20000 });
        const set = new Set((Array.isArray(data) ? data : []).flatMap(e => String(e.name_value).split('\n')));
        set.delete(domain);
        const list = [...set].filter(s => s.endsWith(domain)).slice(0, 20);
        if (!list.length) return fail(reply, "No subdomains found in certificate-transparency logs.");
        reply(box(`SUBDOMAINS (${list.length})`, list));
    } catch (e) { fail(reply, "Subdomain lookup failed (crt.sh may be slow/down), try again."); }
});

// 6) Hash generator — pure Node core `crypto` module
cmd({
    pattern: "hashgen",
    alias: ["hash"],
    desc: "🕵️ Generate MD5/SHA1/SHA256/SHA512 hash of text",
    category: "osint",
    use: ".hashgen hello world",
    filename: __filename
}, async (conn, mek, m, { text, args, reply }) => {
    const input = text || args.join(' ');
    if (!input) return fail(reply, "Usage: .hashgen <text>");
    const md5 = crypto.createHash('md5').update(input).digest('hex');
    const sha1 = crypto.createHash('sha1').update(input).digest('hex');
    const sha256 = crypto.createHash('sha256').update(input).digest('hex');
    reply(box('HASH RESULTS', [
        `MD5: ${md5}`,
        `SHA1: ${sha1}`,
        `SHA256: ${sha256}`
    ]));
});

// 7) User-Agent string parser — simple regex-based, no extra deps
cmd({
    pattern: "useragent",
    alias: ["ua", "uaparse"],
    desc: "🕵️ Parse a browser User-Agent string",
    category: "osint",
    use: ".ua Mozilla/5.0 (Windows NT 10.0; Win64; x64)...",
    filename: __filename
}, async (conn, mek, m, { text, args, reply }) => {
    const ua = text || args.join(' ');
    if (!ua) return fail(reply, "Usage: .ua <user-agent string>");
    const os = /Windows NT 10/.test(ua) ? 'Windows 10/11'
        : /Windows NT/.test(ua) ? 'Windows'
        : /Mac OS X/.test(ua) ? 'macOS'
        : /Android/.test(ua) ? 'Android'
        : /iPhone|iPad/.test(ua) ? 'iOS'
        : /Linux/.test(ua) ? 'Linux' : 'Unknown';
    const browser = /Edg\//.test(ua) ? 'Edge'
        : /Chrome\//.test(ua) ? 'Chrome'
        : /Firefox\//.test(ua) ? 'Firefox'
        : /Safari\//.test(ua) ? 'Safari' : 'Unknown';
    reply(box('USER-AGENT PARSED', [
        `OS: ${os}`,
        `Browser: ${browser}`,
        `Mobile: ${/Mobi/.test(ua) ? 'Yes' : 'No'}`
    ]));
});

// 8) Email deliverability check — format + real MX record check (core dns)
cmd({
    pattern: "mxcheck",
    alias: ["emailvalidate"],
    desc: "🕵️ Check if an email's domain can actually receive mail",
    category: "osint",
    use: ".mxcheck someone@example.com",
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    const email = args[0] || '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail(reply, "Usage: .mxcheck someone@example.com");
    const domain = email.split('@')[1];
    try {
        const mx = await dns.resolveMx(domain);
        if (!mx.length) return reply(box('MX CHECK', [`Email: ${email}`, `Result: ❌ No mail servers found`]));
        reply(box('MX CHECK', [
            `Email: ${email}`,
            `Result: ✅ Domain can receive mail`,
            `Top MX: ${mx.sort((a, b) => a.priority - b.priority)[0].exchange}`
        ]));
    } catch (e) { reply(box('MX CHECK', [`Email: ${email}`, `Result: ❌ Domain has no mail servers`])); }
});

// 9) Short-URL expander — follow redirects, show the real final URL
cmd({
    pattern: "urlexpand",
    alias: ["unshorten"],
    desc: "🕵️ Reveal the real URL behind a shortened link",
    category: "osint",
    use: ".urlexpand https://bit.ly/xxxxx",
    filename: __filename
}, async (conn, mek, m, { args, reply }) => {
    let url = args[0];
    if (!url) return fail(reply, "Usage: .urlexpand <short url>");
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
    try {
        const res = await axios.get(url, { timeout: 15000, maxRedirects: 10, validateStatus: () => true });
        const finalUrl = res.request?.res?.responseUrl || res.request?.responseURL || url;
        reply(box('URL EXPANDED', [`Short: ${url}`, `Real: ${finalUrl}`]));
    } catch (e) { fail(reply, "Couldn't resolve that URL: " + e.message); }
});

module.exports = {};
