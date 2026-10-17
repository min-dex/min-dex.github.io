// Keep Lucide's pinned runtime unchanged; ship only icons referenced by UI sources.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'vendor/lucide.min.js'), 'utf8');
if (crypto.createHash('sha256').update(source).digest('hex') !== '3c91b931c3b7192e3d96bbf5398a10506062221f8c9a18809fdc05405af7051a') {
  throw new Error('Lucide changed: review runtime extraction before rebuilding.');
}
const context = {};
vm.runInNewContext(source, context);
// Conservative token scan includes conditional icon names and other literals,
// not only data-lucide markup. Extra matching icons are harmless.
const inputs = fs.readdirSync(root).filter(name => /\.(?:js|html)$/.test(name) && name !== 'mindex.icons.js');
const tokens = new Set(inputs.flatMap(name => fs.readFileSync(path.join(root, name), 'utf8').match(/[A-Za-z][A-Za-z0-9_-]*/g) || []));
const keys = new Set([...tokens].map(token => token.replace(/^([a-z])|[\s-_]+(\w)/g, (_, first, next) => (next || first).toUpperCase())));
const icons = Object.fromEntries(Object.entries(context.lucide.icons).filter(([key]) => keys.has(key)));
// The hash above pins these exact boundaries. All SVG creation, accessibility,
// attribute merging, template handling and legacy-name support stay upstream.
const runtime = source.slice(0, source.indexOf(',Fa=[['));
const createIcons = source.slice(source.indexOf('LA=({icons:'), source.indexOf(';a.AArrowDown='));
if (!runtime.endsWith('t)}') || !createIcons.startsWith('LA=')) throw new Error('Unexpected Lucide boundaries');
const output = `${runtime};const SA=Object.freeze(${JSON.stringify(icons)});const ${createIcons};Object.assign(a,SA);a.createElement=Pa;a.createIcons=LA;a.icons=SA}));\n`;
const target = path.join(root, 'mindex.icons.js');
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== output) throw new Error('Run node tools/build_ui_icons.cjs to refresh UI icons');
} else fs.writeFileSync(target, output);
console.log(`UI icons: ${Object.keys(icons).length}/${Object.keys(context.lucide.icons).length}, ${Buffer.byteLength(output)}/${Buffer.byteLength(source)} bytes`);
