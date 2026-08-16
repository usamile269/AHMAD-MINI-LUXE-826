const fs = require('fs');
const path = require('path');

let commands = [];
function cmd(info, func) {
    commands.push(info);
}
function aiCmd(pattern, alias, desc, usage, handler) {
    commands.push({ pattern, alias, desc, category: 'ai' });
}

// Mocking required modules
const mocks = {
    '../ahmad-core': { cmd, aiCmd, commands },
    './ahmad-core': { cmd, aiCmd, commands },
    '../config': {},
    './config': {},
    '../lib/menu-styles': { randomFooter: () => '' },
    '../lib/text-style': { toFancyBold: (t) => t },
    '../lib/database': { getStatsForNumber: () => [] },
    '../lib/fakevCard': { fakevCard: {} },
    '../lib/functions': { runtime: () => '' },
    '../data/UserBotSettings': { getUserBotSettings: () => ({}) },
    'axios': { get: () => Promise.resolve({ data: {} }), post: () => Promise.resolve({ data: {} }) },
    'moment-timezone': () => ({ tz: () => ({ format: () => '' }) }),
    'fluent-ffmpeg': () => ({ audioCodec: () => ({ audioBitrate: () => ({ audioChannels: () => ({ format: () => ({ on: () => ({ on: () => ({ save: () => {} }) }) }) }) }) }) }),
    '@ffmpeg-installer/ffmpeg': { path: '' }
};

global.require = (name) => {
    if (mocks[name]) return mocks[name];
    if (name.startsWith('.') || name.startsWith('/')) return {}; // Ignore local requires
    try {
        return require(name);
    } catch (e) {
        return {};
    }
};

const pluginsDir = '/home/ubuntu/zip-extracted/plugins';
const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'));

for (const file of files) {
    try {
        const content = fs.readFileSync(path.join(pluginsDir, file), 'utf8');
        // Simple replacement to use our global.require
        const script = content.replace(/require\(['"]([^'"]+)['"]\)/g, 'global.require("$1")');
        
        // Wrap in a function to avoid global scope pollution
        (function() {
            const __filename = file;
            const __dirname = pluginsDir;
            eval(script);
        })();
    } catch (e) {
        // console.error(`Error in ${file}:`, e.message);
    }
}

console.log(commands.length);
