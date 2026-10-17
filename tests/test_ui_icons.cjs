const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const root = path.resolve(__dirname, '..');
execFileSync(process.execPath, ['tools/build_ui_icons.cjs', '--check'], {cwd: root, stdio: 'inherit'});
function load(file) {
  const document = {createElementNS(namespace, tag) {
    return {namespace, tag, attrs: {}, children: [], setAttribute(k, v) { this.attrs[k] = v; }, appendChild(child) { this.children.push(child); }};
  }};
  const context = {document, console};
  vm.runInNewContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  return context.lucide;
}
const original = load('vendor/lucide.min.js');
const subset = load('mindex.icons.js');
const json = value => JSON.stringify(value);
for (const [name, icon] of Object.entries(subset.icons)) {
  assert.equal(json(icon), json(original.icons[name]), name);
  assert.equal(json(subset.createElement(icon, {width: 17, class: 'test', 'aria-label': name})), json(original.createElement(original.icons[name], {width: 17, class: 'test', 'aria-label': name})), name);
  function replace(api) {
    let result;
    const kebab = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
    const attrs = {'data-lucide': kebab, class: 'test', 'aria-label': 'label'};
    const node = {getAttribute: key => attrs[key], attributes: Object.entries(attrs).map(([name, value]) => ({name, value})), parentNode: {replaceChild: svg => { result = svg; }}};
    api.createIcons({icons: {[name]: api.icons[name]}, root: {querySelectorAll: selector => selector === '[data-lucide]' ? [node] : []}, attrs: {height: 19}});
    return result;
  }
  // Names with numeric/acronym alias spellings are exercised via createElement.
  if (!/[A-Z]{2}|\d/.test(name)) assert.equal(json(replace(subset)), json(replace(original)), name);
}
for (const name of ['Sun','Moon','Loader2','ChevronUp','ChevronDown','ScreenShare','ScreenShareOff','Eye','EyeOff','Play','Pause','CircleAlert']) assert.ok(subset.icons[name], name);
assert.ok(fs.statSync(path.join(root, 'mindex.icons.js')).size < 50000);
console.log('PASS pinned SVG and replacement parity, dynamic UI names, regenerated asset');
