// ============================================================================
// plugins/relationship-fun.js — "role assigner" fun commands
// ----------------------------------------------------------------------------
// Requested by Ahmad: the Urdu/Hindi-flavored fun commands from the
// reference menu (ishaq, bacha, chacha, bhai-bahan, etc) — same relationship
// generator idea, in OUR bot's own bold-box design.
//
// Built as ONE shared, tested engine looped over a role list instead of
// 45+ hand-written near-duplicate commands — same result, far less chance
// of any single one being broken.
// ============================================================================

const { cmd } = require('../ahmad-core');
const { randomFooter } = require('../lib/menu-styles');

const FOOTER = "\n\n> " + randomFooter();

// pattern, emoji, label shown in the message
const ROLES = [
    ['ishaq', '❤️', 'Ishaq'], ['bacha', '👶', 'Bacha'], ['bachi', '👧', 'Bachi'],
    ['dad', '👨', 'Dad'], ['mom', '👩', 'Mom'], ['son', '👦', 'Son'], ['daughter', '👧', 'Daughter'],
    ['boyfriend', '💑', 'Boyfriend'], ['girlfriend', '💑', 'Girlfriend'],
    ['husband', '🤵', 'Husband'], ['wife', '👰', 'Wife'],
    ['bhai', '🧑‍🤝‍🧑', 'Bhai'], ['bahan', '👭', 'Bahan'],
    ['chacha', '👨‍🦱', 'Chacha'], ['chachi', '👩‍🦱', 'Chachi'],
    ['mama', '🧔', 'Mama'], ['mami', '👩‍🦳', 'Mami'],
    ['nana', '👴', 'Nana'], ['nani', '👵', 'Nani'],
    ['bestfriend', '🤝', 'Best Friend'], ['enemy', '⚔️', 'Enemy'],
    ['crush', '😍', 'Crush'], ['teacher', '🧑‍🏫', 'Teacher'], ['student', '🧑‍🎓', 'Student'],
    ['rival', '🥊', 'Rival'], ['flirtmatch', '😘', 'Flirt Partner'],
    ['king', '👑', 'King'], ['queen', '👑', 'Queen'],
    ['slave', '⛓️', 'Slave'], ['master', '🎩', 'Master'],
    ['boss', '💼', 'Boss'], ['employee', '🧑‍💻', 'Employee'],
    ['pet', '🐾', 'Pet'], ['servant', '🧹', 'Servant'],
    ['idol', '🌟', 'Idol'], ['fan', '📣', 'Fan'],
    ['ghostrole', '👻', 'Ghost'], ['angel', '😇', 'Angel'], ['devil', '😈', 'Devil'],
    ['rich', '💰', 'Rich One'], ['poor', '🥲', 'Poor One'],
    ['genius', '🧠', 'Genius'], ['fool', '🤡', 'Fool'],
    ['twin', '👯', 'Twin'], ['partner', '🤝', 'Partner'],
    ['bodyguard', '🛡️', 'Bodyguard'], ['cosplaybuddy', '🎭', 'Cosplay Buddy'],
    ['stepbro', '🧑', 'Stepbro'], ['stepsis', '👩', 'Stepsis'],
    ['soulmate', '💞', 'Soulmate'], ['secretadmirer', '🕵️', 'Secret Admirer'],
    ['neighbor', '🏘️', 'Neighbor'], ['roommate', '🛏️', 'Roommate'],
    ['coworker', '💻', 'Coworker'], ['mentor', '🧑‍🏫', 'Mentor'], ['mentee', '🧑‍🎓', 'Mentee'],
    ['sensei', '🥋', 'Sensei'], ['disciple', '🙇', 'Disciple'],
    ['hero', '🦸', 'Hero'], ['villain', '🦹', 'Villain'], ['sidekick', '🥷', 'Sidekick'],
    ['knight', '⚔️', 'Knight'], ['princess', '👸', 'Princess'], ['prince', '🤴', 'Prince'],
    ['wizard', '🧙', 'Wizard'], ['witch', '🧙‍♀️', 'Witch'],
    ['vampire', '🧛', 'Vampire'], ['zombie', '🧟', 'Zombie'],
    ['travelbuddy', '✈️', 'Travel Buddy'], ['gymbuddy', '🏋️', 'Gym Buddy'],
    ['studybuddy', '📚', 'Study Buddy']
];

for (const [pattern, emoji, label] of ROLES) {
    cmd({
        pattern,
        desc: `${emoji} Randomly assign someone as your ${label}`,
        category: "fun",
        filename: __filename
    }, async (conn, mek, m, { from, isGroup, participants, sender, reply }) => {
        try {
            if (!isGroup) return reply(`❌ This command only works in groups.${FOOTER}`);
            const others = (participants || []).filter(p => p.id !== sender);
            if (!others.length) return reply(`❌ Not enough members in this group.${FOOTER}`);
            const picked = others[Math.floor(Math.random() * others.length)].id;

            const text =
                `╭═══ ${emoji} ${label.toUpperCase()} ═══⊷\n` +
                `┃❃│ @${sender.split('@')[0]}\n` +
                `┃❃│    ka ${label} hai 👇\n` +
                `┃❃│ @${picked.split('@')[0]}\n` +
                `╰═════════════════⊷${FOOTER}`;

            await conn.sendMessage(from, { text, mentions: [sender, picked] }, { quoted: mek });
        } catch (e) {
            reply(`❌ Failed: ${e.message}${FOOTER}`);
        }
    });
}

module.exports = {};
