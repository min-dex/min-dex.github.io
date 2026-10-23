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
for (const entry of Object.values(source)) {
  for (const slide of entry.slides) {
    if (!slide.reviewedAsset) continue;
    const bytes = fs.readFileSync(path.join(root, slide.src));
    assert.equal(require('node:crypto').createHash('sha256').update(bytes).digest('hex'), slide.reviewedAsset.sha256);
    assert(fs.existsSync(path.join(root, slide.reviewedAsset.original)), 'Original evidence must remain available');
  }
}
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

// Reviewed score boundaries: a continuation page must travel with its verse,
// including when the user selects, repeats or reorders verses.
function extractFunction(name) {
  const begin = code.indexOf(`function ${name}(`);
  const finish = code.indexOf('\nfunction ', begin + 1);
  assert(begin >= 0 && finish > begin, name);
  return code.slice(begin, finish);
}
Object.assign(context, {
  compactSearchValue: value => String(value).replace(/\s+/g, '').toLowerCase(),
  presenterScoreFormSequence: item => ({forms: item.labels || [], titleSequence: true}),
  presenterFormDisplayLabel: form => form.label,
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../mindex.worship-model.js'), 'utf8'), context);
for (const name of ['normalizePresenterFormPresetLabel', 'presenterFormTargetsMatch', 'presenterScoreImageSourcesForFormSequence']) {
  vm.runInContext(extractFunction(name), context);
}
assert.deepEqual(runtime['4'].slides.map(slide => path.basename(slide.src)), ['slide-02.webp', 'slide-03.webp']);
for (const [number, verseCount, pagesPerVerse] of [['106', 3, 3], ['466', 5, 3], ['570', 3, 4]]) {
  const images = runtime[number].slides;
  const forms = images.map(slide => slide.scoreFormLabel ? {label: slide.scoreFormLabel} : null);
  assert.equal(images.length, verseCount * pagesPerVerse);
  const plans = [[], Array.from({length: verseCount}, (_, i) => i + 1), [verseCount, 1, verseCount]];
  for (let verse = 1; verse <= verseCount; verse++) plans.push([verse]);
  for (const plan of plans) {
    const selected = context.presenterScoreImageSourcesForFormSequence(images, forms, [], {labels: plan.map(v => `V${v}`)});
    const expected = plan.length ? plan.flatMap(v => images.slice((v - 1) * pagesPerVerse, v * pagesPerVerse)) : images;
    assert.equal(JSON.stringify(selected.imageSources), JSON.stringify(expected), `${number}: ${plan}`);
    assert.equal(selected.scoreForms.length, expected.length);
  }
}
console.log('PASS reviewed 4/106/466/570 page order, complete verse selection, repeats and reorder');
for (const number of ['163', '166']) {
  const images = runtime[number].slides;
  const forms = images.map(slide => slide.scoreFormLabel ? {label: slide.scoreFormLabel} : null);
  for (const labels of [['V2'], ['V2','V1','V2']]) {
    const selected = context.presenterScoreImageSourcesForFormSequence(images, forms, [], {labels});
    const expected = [images[0], ...labels.flatMap(label => {
      const verse = Number(label.slice(1));
      return images.slice(1+(verse-1)*2, 1+verse*2);
    })];
    assert.equal(JSON.stringify(selected.imageSources), JSON.stringify(expected));
    assert.equal(selected.scoreForms[0], null);
  }
}
console.log('PASS 163/166 score opening retained once with selected/repeated verses');
