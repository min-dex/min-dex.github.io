const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
const start = source.indexOf('function handlePresenterMediaPreviewError(');
const end = source.indexOf('function renderPresenterStaticAssetPreview(', start);
const ctx = vm.createContext({});
vm.runInContext(source.slice(start, end), ctx);
function fixture() {
  const message = { hidden: true };
  const image = { hidden: false, src: 'first.png', parentElement: { querySelector: () => message } };
  const details = { open: false };
  const group = { querySelector: s => s === 'details' ? details : s.includes('preview-image') ? image : message,
    querySelectorAll: () => buttons };
  const buttons = ['first.png', 'second.png'].map((url, i) => ({
    dataset: { referenceMediaSlide: url, referenceMediaName: `Image ${i + 1}` },
    closest: () => group, setAttribute(k, v) { this[k] = v; },
  }));
  return { image, message, details, buttons };
}
const a = fixture(), b = fixture();
ctx.handlePresenterMediaPreviewError(a.image);
assert.equal(a.image.hidden, true);
assert.equal(a.message.hidden, false);
ctx.selectPresenterMediaPreviewSlide(a.buttons[1]);
assert.equal(a.image.src, 'second.png');
assert.equal(a.image.alt, 'Image 2');
assert.equal(a.image.hidden, false);
assert.equal(a.message.hidden, true);
assert.equal(a.details.open, true);
assert.equal(a.buttons[0]['aria-pressed'], 'false');
assert.equal(a.buttons[1]['aria-pressed'], 'true');
assert.equal(b.image.src, 'first.png', 'another media group is unchanged');
assert.equal(b.details.open, false);
assert.doesNotThrow(() => ctx.selectPresenterMediaPreviewSlide({ closest: () => null }));
console.log('PASS media preview selection, error recovery, and group isolation');
