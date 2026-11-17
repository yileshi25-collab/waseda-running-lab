const fs = require('node:fs');
const vm = require('node:vm');
for (const file of fs.readdirSync('.').filter(file => file.endsWith('.js'))) {
  new vm.Script(fs.readFileSync(file, 'utf8'), {filename:file});
}
const html = fs.readFileSync('index.html', 'utf8');
let count = 0;
for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  if (!/\bsrc\s*=/.test(match[1])) new vm.Script(match[2], {filename:`index.html:inline-${++count}`});
}
console.log(`JavaScript syntax OK, including ${count} inline scripts.`);
