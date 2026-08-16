const fs = require('fs');
const path = require('path');

let commandList = [];
function cmd(info, func) {
    if (info.pattern) commandList.push(info.pattern);
}
function aiCmd(pattern, alias, desc, usage, handler) {
    commandList.push(pattern);
}

// Mocking required modules
const mocks = {
    '../ahmad-core': { cmd, aiCmd, commands: [] },
    './ahmad-core': { cmd, aiCmd, commands: [] },
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
    if (name.startsWith('.') || name.startsWith('/')) return {}; 
    try { return require(name); } catch (e) { return {}; }
};

const pluginsDir = '/home/ubuntu/mini-final-v3/plugins';
const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'));

for (const file of files) {
    try {
        const content = fs.readFileSync(path.join(pluginsDir, file), 'utf8');
        const script = content.replace(/require\(['"]([^'"]+)['"]\)/g, 'global.require("$1")');
        (function() {
            const __filename = file;
            const __dirname = pluginsDir;
            eval(script);
        })();
    } catch (e) {}
}

const uniquePatterns = [...new Set(commandList)];
console.log(uniquePatterns.length);
