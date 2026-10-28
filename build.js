// Build: apply content/site.json (edited in /admin) to index.html and copy assets to dist/.
const fs = require('fs');
const { applyContent } = require('./lib/content');

const out = 'dist';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);

let content = {};
try { content = JSON.parse(fs.readFileSync('content/site.json', 'utf8')); } catch { /* no edits yet */ }

const html = applyContent(fs.readFileSync('index.html', 'utf8'), content);
fs.writeFileSync(out + '/index.html', html);
fs.copyFileSync('admin.html', out + '/admin.html');
fs.cpSync('img', out + '/img', { recursive: true });

const n = Object.keys(content.text || {}).length + Object.keys(content.images || {}).length;
console.log(`Built dist/ with ${n} edited fields`);
