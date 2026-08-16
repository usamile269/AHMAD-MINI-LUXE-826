// ============================================================================
// plugins/osint-batch2.js — 6 more legal, passive domain/network-info tools,
// same rules as osint-tools.js: only reads PUBLIC info a site already
// exposes, no port scanning, no brute-forcing, no personal-data lookup on
// individuals (no phone/email/person tracing — that's a privacy line this
// bot doesn't cross). Built on core Node modules + public DoH, no npm add.
// ============================================================================

const { cmd } = require('../ahmad-core');
const axios = require('axios');
const dns = require('dns').promises;
const { randomFooter, renderError } = require('../lib/menu-styles');

const FOOTER = "\n\n> " + randomFooter();
const fail = (reply, msg) => reply(renderError(msg));
const box = (title, lines) => `╭═══ 🕵️ ${title} ═══⊷\n${lines.map(l => `┃❃│ ${l}`).join('\n')}\n╰═════════════════⊷${FOOTER}`;
const cleanDomain = (s) => (s || '').replace(/^https?:\/\//i, '').split('/')[0].trim();

// 1) Full DNS record dump (A, AAAA, MX, TXT, NS, CNAME in one shot)
cmd({ pattern: "dnsrecords", alias: ["dnsall"], desc: "🕵️ Full DNS record dump for a domain", category: "osint", use: ".dnsrecords example.com", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const domain = cleanDomain(q);
    if (!domain) return fail(reply, "Usage: .dnsrecords example.com");
    try {
        const results = {};
        const types = ['A', 'AAAA', 'MX', 'TXT', 'NS', 'CNAME'];
        await Promise.all(types.map(async (t) => {
            try {
                const fn = { A: dns.resolve4, AAAA: dns.resolve6, MX: dns.resolveMx, TXT: dns.resolveTxt, NS: dns.resolveNs, CNAME: dns.resolveCname }[t];
                results[t] = await fn(domain);
            } catch { results[t] = null; }
        }));
        const lines = types.map(t => {
            if (!results[t] || !results[t].length) return `${t}: (none)`;
            if (t === 'MX') return `MX: ${results[t].map(r => r.exchange).join(', ')}`;
            if (t === 'TXT') return `TXT: ${results[t].map(r => r.join('')).slice(0, 2).join(' | ')}`;
            return `${t}: ${results[t].join(', ')}`;
        });
        reply(box(`DNS RECORDS: ${domain}`, lines));
    } catch (e) {
        fail(reply, `DNS lookup failed: ${e.message}`);
    }
});

// 2) ASN / network owner info for an IP (public RDAP data, same style as .whois)
cmd({ pattern: "asninfo", alias: ["asn"], desc: "🕵️ Find the network/ASN owner of an IP", category: "osint", use: ".asninfo 8.8.8.8", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const ip = (q || '').trim();
    if (!ip) return fail(reply, "Usage: .asninfo 8.8.8.8");
    try {
        const { data } = await axios.get(`https://rdap.org/ip/${ip}`, { timeout: 12000 });
        const lines = [
            `IP: ${ip}`,
            `Network: ${data.name || 'N/A'}`,
            `Range: ${data.startAddress || '?'} - ${data.endAddress || '?'}`,
            `Country: ${data.country || 'N/A'}`,
        ];
        reply(box("ASN / IP INFO", lines));
    } catch (e) {
        fail(reply, `Lookup failed: ${e.message}`);
    }
});

// 3) robots.txt fetcher — shows what a site allows/disallows crawlers
cmd({ pattern: "robotscheck", alias: ["robotstxt"], desc: "🕵️ Fetch a site's robots.txt rules", category: "osint", use: ".robotscheck example.com", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const domain = cleanDomain(q);
    if (!domain) return fail(reply, "Usage: .robotscheck example.com");
    try {
        const { data } = await axios.get(`https://${domain}/robots.txt`, { timeout: 12000, validateStatus: () => true });
        const snippet = typeof data === 'string' ? data.slice(0, 800) : JSON.stringify(data).slice(0, 800);
        reply(box(`ROBOTS.TXT: ${domain}`, [snippet || '(empty or not found)']));
    } catch (e) {
        fail(reply, `Could not fetch robots.txt: ${e.message}`);
    }
});

// 4) sitemap.xml presence + first few URLs
cmd({ pattern: "sitemapcheck", desc: "🕵️ Check a site's sitemap.xml", category: "osint", use: ".sitemapcheck example.com", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    const domain = cleanDomain(q);
    if (!domain) return fail(reply, "Usage: .sitemapcheck example.com");
    try {
        const { data } = await axios.get(`https://${domain}/sitemap.xml`, { timeout: 12000, validateStatus: () => true });
        const text = typeof data === 'string' ? data : '';
        const locs = [...text.matchAll(/<loc>(.*?)<\/loc>/g)].slice(0, 5).map(m => m[1]);
        if (!locs.length) return reply(box(`SITEMAP: ${domain}`, ["No sitemap.xml found or it's empty."]));
        reply(box(`SITEMAP: ${domain}`, [`Found ${locs.length}+ URLs, first few:`, ...locs]));
    } catch (e) {
        fail(reply, `Could not fetch sitemap.xml: ${e.message}`);
    }
});

// 5) HTTP status/redirect chain checker
cmd({ pattern: "httpstatus", alias: ["statuscheck"], desc: "🕵️ Check a URL's HTTP status code + redirects", category: "osint", use: ".httpstatus https://example.com", filename: __filename },
async (conn, mek, m, { q, reply }) => {
    if (!q) return fail(reply, "Usage: .httpstatus https://example.com");
    let url = q.trim();
    if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
    try {
        const res = await axios.get(url, { timeout: 12000, maxRedirects: 5, validateStatus: () => true });
        const chain = res.request?._redirectable?._redirects?.map(r => r.url) || [];
        const lines = [`URL: ${url}`, `Final status: ${res.status} ${res.statusText || ''}`];
        if (chain.length) lines.push(`Redirects: ${chain.length}`);
        reply(box("HTTP STATUS", lines));
    } catch (e) {
        fail(reply, `Could not reach that URL: ${e.message}`);
    }
});

// 6) favicon fetcher — grabs a site's favicon image
cmd({ pattern: "faviconfetch", alias: ["favicon"], desc: "🕵️ Fetch a site's favicon image", category: "osint", use: ".faviconfetch example.com", filename: __filename },
async (conn, mek, m, { from, q, reply }) => {
    const domain = cleanDomain(q);
    if (!domain) return fail(reply, "Usage: .faviconfetch example.com");
    try {
        const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=256`;
        await conn.sendMessage(from, { image: { url }, caption: `🕵️ Favicon for ${domain}${FOOTER}` }, { quoted: mek });
    } catch (e) {
        fail(reply, `Could not fetch favicon: ${e.message}`);
    }
});
