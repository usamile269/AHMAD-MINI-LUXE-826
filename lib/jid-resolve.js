// ============================================================================
// lib/jid-resolve.js — shared @lid <-> phone-number aware JID matching
// ----------------------------------------------------------------------------
// main.js has its own copy of this logic for the owner/admin check on every
// incoming message. This file exists so PLUGINS can reuse the exact same
// robust matching (instead of a naive `p.id === sender` string comparison,
// which silently breaks whenever WhatsApp hands out an @lid identity for one
// side of the comparison and a real @s.whatsapp.net number for the other —
// e.g. ".gwelcomevideo run from private DM said 'you're not an admin in any
// group' even when the user genuinely was, because the group's participant
// list used @lid ids while `sender` was a phone number, or vice versa).
// ============================================================================

const isJidInList = (jid, list) => {
    if (!jid || !list) return false;
    const num = jid.split('@')[0].split(':')[0];
    return list.some(item => item && item.split('@')[0].split(':')[0] === num);
};

// Extra safety net: if the plain numeric comparison above fails (e.g. sender
// is @lid but the list only has the @s.whatsapp.net number, or vice versa),
// ask Baileys' own lid<->phone-number mapping store to resolve the alternate
// identity and try again. Wrapped in try/catch since this internal API can
// vary between Baileys versions.
const resolveIsAdmin = async (conn, jid, list) => {
    if (isJidInList(jid, list)) return true;
    try {
        const isLid = jid.endsWith('@lid');
        const lidMap = conn?.signalRepository?.lidMapping;
        if (lidMap) {
            const alt = isLid
                ? await lidMap.getPNForLID(jid)
                : await lidMap.getLIDForPN(jid);
            if (alt && isJidInList(alt, list)) return true;
        }
    } catch (_) {}
    return false;
};

const resolveIsOwner = async (conn, jid, ownerList) => resolveIsAdmin(conn, jid, ownerList);

module.exports = { isJidInList, resolveIsAdmin, resolveIsOwner };
