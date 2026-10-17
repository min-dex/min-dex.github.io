const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('mindex.presenter.js', 'utf8');
const c = vm.createContext({
  document: {},
  PRESENTER_ELEMENT_TYPES: { PRAISE: 'praise' },
  PRESENTER_SLIDE_LAYOUTS: { LOWER_BAR_TEXT: 'lower-bar-text' },
});
vm.runInContext(source, c);
Object.assign(c, {
  presenterSlideElementType: slide => slide.elementType,
  presenterSlideLayout: slide => slide.layout,
  presenterDisplayLines: slide => slide.lines,
  presenterLineCharEstimate: line => line.length,
  escapeAttr: text => text,
  escapePresenterSlideLine: text => text,
});
const slide = { elementType: 'praise', layout: 'lower-bar-text', type: 'lyrics', lines: ['가사 첫 줄', '다음 줄'] };
for (const [marker, expected] of [['V1','1'],['V1A','1'],['V1B','1'],['v2a','2'],['Verse 12 B','12'],['2절','2'],['C1A',''],['PC1A',''],['Coda A',''],['V1AB','']]) {
  const current = { ...slide, marker };
  assert.equal(c.presenterLyricVerseNumber(current), expected, marker);
  const html = c.renderPresenterSlideText(current);
  assert.equal((html.match(/data-verse-no=/g)||[]).length, expected ? 1 : 0, marker);
  if (expected) assert.ok(html.includes(`data-verse-no="${expected}"`), marker);
}
assert.equal(c.presenterLyricVerseNumber({...slide,formLabel:'V3B'}),'3');
assert.equal(c.presenterLyricVerseNumber({...slide,marker:'V1A',type:'song-title'}),'');
assert.equal(c.presenterLyricVerseNumber({...slide,marker:'V1A',layout:'full-text'}),'');
const numbered = c.renderPresenterSlideText({...slide,marker:'V1A',lines:['1. 가사 첫 줄','다음 줄']});
assert.ok(!numbered.includes('1. 가사'));
assert.ok(numbered.includes('data-verse-no="1"'));
console.log('PASS verse segment markers, one rendered number, non-verse exclusions and inline-number deduplication');
