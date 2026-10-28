// Build: render content/site.json into site.template.html and collect everything in dist/.
const fs = require('fs');
const { render } = require('./lib/render');

const out = 'dist';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out);

const data = JSON.parse(fs.readFileSync('content/site.json', 'utf8'));
const template = fs.readFileSync('site.template.html', 'utf8');
fs.writeFileSync(out + '/index.html', render(template, data));

// admin and its live preview use the same template and renderer
fs.copyFileSync('admin.html', out + '/admin.html');
fs.copyFileSync('site.template.html', out + '/site.template.html');
fs.copyFileSync('lib/render.js', out + '/render.js');
fs.cpSync('img', out + '/img', { recursive: true });

console.log(`Built dist/: ${(data.practices || []).length} practices, ${(data.masters || []).length} masters, ${(data.schedule || []).length} classes`);
