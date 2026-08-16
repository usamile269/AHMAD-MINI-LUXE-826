const {
    proto,
    getContentType,
    jidNormalizedUser,
    downloadContentFromMessage
} = require('@whiskeysockets/baileys');

const sms = (conn, m) => {
    if (!m) return m;
    let M = proto.WebMessageInfo;
    
    if (m.key) {
        m.id = m.key.id;
        m.isBaileys = m.id.startsWith('BAE5') && m.id.length === 16;
        m.chat = m.key.remoteJid;
        m.fromMe = m.key.fromMe;
        m.isGroup = m.chat.endsWith('@g.us');
        m.sender = jidNormalizedUser(m.fromMe ? conn.user.id : (m.participant ? m.participant : m.key.participant ? m.key.participant : m.chat));
    }
    
    if (m.message) {
        m.mtype = getContentType(m.message);
        
        // Gestion ViewOnce / Ephemeral
        if (m.mtype === 'viewOnceMessageV2' || m.mtype === 'viewOnceMessage') {
             m.message = m.message[m.mtype].message;
             m.mtype = getContentType(m.message);
        }
        
        m.msg = m.message[m.mtype];
        // QUOTED MESSAGE
m.quoted = m.msg?.contextInfo?.quotedMessage
    ? {
        message: m.msg.contextInfo.quotedMessage,
        stanzaId: m.msg.contextInfo.stanzaId,
        participant: m.msg.contextInfo.participant
      }
    : null;
        
        // Récupération du texte (body)
        m.body = (m.mtype === 'conversation') ? m.message.conversation : 
                 (m.mtype == 'imageMessage') ? m.message.imageMessage.caption : 
                 (m.mtype == 'videoMessage') ? m.message.videoMessage.caption : 
                 (m.mtype == 'extendedTextMessage') ? m.message.extendedTextMessage.text : 
                 (m.mtype == 'buttonsResponseMessage') ? m.message.buttonsResponseMessage.selectedButtonId : 
                 (m.mtype == 'listResponseMessage') ? m.message.listResponseMessage.singleSelectReply.selectedRowId : 
                 (m.mtype == 'templateButtonReplyMessage') ? m.message.templateButtonReplyMessage.selectedId : 
                 (m.mtype === 'messageContextInfo') ? (m.message.buttonsResponseMessage?.selectedButtonId || m.message.listResponseMessage?.singleSelectReply.selectedRowId || m.text) : '';
                 
        // Alias pour répondre facilement
        // 🚀 SPEED + RELIABILITY BOOST: this is the most-used send path in the
        // whole bot. Standardized with the same @lid retry logic as main.js's
        // own reply() helper, so commands using m.reply (which is almost all
        // of them) finally work reliably in chats with newer @lid-style
        // identities.
        m.reply = async (text, chatId = m.chat, options = {}) => {
            try {
                return await conn.sendMessage(chatId, { text: text }, { quoted: m, ...options });
            } catch (e) {
                if (chatId.endsWith('@lid')) {
                    try {
                        // Attempt to resolve the real phone-number JID from Baileys' store
                        const realJid = await conn?.signalRepository?.lidMapping?.getPNForLID(chatId);
                        if (realJid) return await conn.sendMessage(realJid, { text: text }, { quoted: m, ...options });
                    } catch (_) {}
                }
                throw e;
            }
        };
    }
    return m;
};

module.exports = { sms };
                
                                             
// ᴘᴏᴡᴇʀᴇᴅ ʙʏ ™ 𝑨𝑯𝑴𝑨𝑫 𝑴𝑰𝑵𝑰 ᥫᩣ
