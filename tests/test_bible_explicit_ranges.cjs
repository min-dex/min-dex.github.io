const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
const fn=name=>{const start=source.indexOf(`function ${name}(`);assert.ok(start>=0,name);return source.slice(start,source.indexOf('\n}',start)+2)};
const rows=[{book_code:'DEU',chapter:6,verse:18,verse_end:19,text:'합본',section_title:''},{book_code:'DEU',chapter:6,verse:20,text:'다음'}];
const state={bibleVerseCache:new Map([['t:DEU:6',rows]]),bibleBookVerses:rows,selectedBibleVerses:[19],selectedBibleVerse:19,selectedBibleChapter:6};
const c=vm.createContext({state,normalizeServerBibleVerse:r=>({...r}),sortBibleVerseRows:(a,b)=>a.verse-b.verse,escapeHtml:String,escapeAttr:String,
 bibleVerseCacheKey:(t,b,ch)=>`${t}:${b}:${ch}`});
vm.runInContext(['inferBibleVerseEndRanges','bibleVerseNumberLabel','getCachedServiceScriptureVerses','selectedBibleVerseRows','renderBibleVerseList','formatServiceScriptureBodySlideBlocks'].map(fn).join('\n'),c);
const omitted=c.inferBibleVerseEndRanges([{verse:20},{verse:22}]);assert.equal(omitted[0].verse_end,null,'a gap is not a combined verse');
assert.equal(c.inferBibleVerseEndRanges(rows)[0].verse_end,19);
assert.equal(c.getCachedServiceScriptureVerses({book:{code:'DEU'},chapter:6,verse:19},{id:'t'})[0].text,'합본');
assert.equal(c.getCachedServiceScriptureVerses({book:{code:'DEU'},chapter:6,verse:18,verseEnd:19},{id:'t'}).length,1);
assert.equal(c.selectedBibleVerseRows([19])[0].verse,18);
assert.equal(c.selectedBibleVerseRows([18,19]).length,1);
const html=c.renderBibleVerseList(rows);assert.ok(html.includes('<span>18–19</span>'));assert.ok(html.includes('aria-selected="true"'));
assert.equal(c.formatServiceScriptureBodySlideBlocks([rows[0]])[0],'18–19   합본');
console.log('PASS explicit ranges, omission gaps, inner-verse lookup, reader selection and slide labels');
