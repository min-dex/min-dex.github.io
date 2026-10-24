const { readRuntimeSource } = require('./helpers/runtime-source.cjs');
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
function extract(file, name) {
  const source = readRuntimeSource(file);
  const start = source.indexOf('function ' + name + '(');
  assert(start >= 0);
  return source.slice(start, source.indexOf('\n}', start) + 2);
}
const context = vm.createContext({ state: { hymnScoreManifest: { '10': { title: '새찬송가', slides: [{ src: 'new-10.webp' }] } } },
  songHasPraiseType: (song, type) => song.praise_types.includes(type) });
for (const [file, name] of [['mindex.presenter.js', 'normalizedHymnScoreNumber'],
  ['mindex.presenter.js', 'presenterHymnScoreAssetSlides'], ['app.js', 'isNewHymnalScoreSong']]) {
  vm.runInContext(extract(file, name), context);
}
for (const number of ['통 10', '통10', '통일 10', '통일찬송가 10', '통일 찬송가 10장', '(통 10)']) {
  assert.equal(context.normalizedHymnScoreNumber(number), '');
  const song = {hymn_no:number,praise_types:['hymn'], title:'구판'};
  assert.equal(context.isNewHymnalScoreSong(song), false);
  assert.equal(context.presenterHymnScoreAssetSlides(song, {}, '').length, 0);
}
for (const number of ['10', '010']) {
  assert.equal(context.normalizedHymnScoreNumber(number), '10');
  assert.equal(context.isNewHymnalScoreSong({hymn_no:number,praise_types:['hymn']}), true);
}
// Existing old-edition versions of a new-hymnal song keep the explicitly linked new score.
assert.equal(context.presenterHymnScoreAssetSlides({hymn_no:'10'}, {hymn_no:'통 10'}, '')[0].url, 'new-10.webp');
assert.equal(context.presenterHymnScoreAssetSlides(null, {hymn_no:'통 10'}, '').length, 0);
assert.equal(context.normalizedHymnScoreNumber('새찬송가 10장'), '10');
console.log('PASS union hymn score isolation');
