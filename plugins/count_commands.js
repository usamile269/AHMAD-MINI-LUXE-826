const fs = require('fs');
const path = require('path');

let commands = [];
function cmd(obj, handler) {
    commands.push(obj);
}

// Mock the core
const mockCore = { cmd, commands };
global.require = (name) => {
    if (name.includes('ahmad-core')) return mockCore;
    if (name.includes('config')) return {};
    if (name.includes('menu-styles')) return { randomFooter: () => '' };
    if (name.includes('text-style')) return { toFancyBold: (t) => t };
    try { return require(name); } catch { return {}; }
};

const pluginsDir = '/home/ubuntu/mini-final-v3/plugins';
const files = fs.readdirSync(pluginsDir).filter(f => f.endsWith('.js'));

for (const file of files) {
    try {
        const content = fs.readFileSync(path.join(pluginsDir, file), 'utf8');
        // Replace require('../ahmad-core') with mock
        const script = content.replace(/require\(['"].*ahmad-core['"]\)/g, 'global.require("ahmad-core")')
                              .replace(/require\(['"].*config['"]\)/g, 'global.require("config")')
                              .replace(/require\(['"].*menu-styles['"]\)/g, 'global.require("menu-styles")')
                              .replace(/require\(['"].*text-style['"]\)/g, 'global.require("text-style")');
        
        // Execute in a way that captures cmd calls
        eval(script);
    } catch (e) {
        // console.error(`Error in ${file}:`, e.message);
    }
}

console.log(commands.length);
