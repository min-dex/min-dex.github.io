const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const source = JSON.parse(fs.readFileSync(path.join(root, 'assets/hymn-scores/manifest.json'), 'utf8'));
const runtime = JSON.parse(fs.readFileSync(path.join(root, 'assets/hymn-scores/manifest.runtime.json'), 'utf8'));
const code = fs.readFileSync(path.join(root, 'mindex.presenter.js'), 'utf8');
const start = code.indexOf('function presenterHymnScoreAssetSlides(');
const end = code.indexOf('function presenterImageSourcesFromAssetUrl(', start);
assert(start >= 0 && end > start);
const context = vm.createContext({state: {hymnScoreManifest: source}, stripHymnNumber: value => value});
vm.runInContext(code.slice(start, end), context);
assert.deepEqual(Object.keys(runtime), Object.keys(source));
let slides = 0;
for (const number of Object.keys(source)) {
  context.state.hymnScoreManifest = source;
  const before = JSON.stringify(context.presenterHymnScoreAssetSlides({hymn_no: number}));
  context.state.hymnScoreManifest = runtime;
  const after = JSON.stringify(context.presenterHymnScoreAssetSlides({hymn_no: number}));
  assert.equal(after, before, `Score projection differs for hymn ${number}`);
  slides += source[number].slides.length;
}
console.log(`PASS ${Object.keys(source).length} hymns / ${slides} slides: identical URLs, names, form keys, labels and order`);
