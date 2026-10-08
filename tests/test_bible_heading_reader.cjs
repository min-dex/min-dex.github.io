const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
const fn=name=>{
  const start=source.search(new RegExp(`(?:async )?function ${name}\\(`));
  assert.ok(start>=0,name);
  return source.slice(start,source.indexOf('\n}',start)+2);
};
const storage=new Map();
const row={book_code:'GEN',chapter:1,verse:1,text:'본문 [본문 주석]',section_title:'소제목 <보존>'};
storage.set('mindex.bible.chapter.v1.t:GEN:1',JSON.stringify({cachedAt:Date.now(),rows:[{...row,text:'[이전 제목] 본문',section_title:''}]}));
let requests=0;
const query={select(columns){this.columns=columns.split(',');return this},eq(){return this},order(){requests++;return Promise.resolve({data:[Object.fromEntries(this.columns.map(k=>[k,row[k]]))],error:null})}};
const state={selectedBibleTranslationId:'t',selectedBookCode:'GEN',selectedBibleChapter:1,
  selectedBibleVerses:[],selectedBibleVerse:1,bibleVerseCache:new Map(),bibleBookVerses:[],
  client:{from:()=>query},module:'scripture'};
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const context=vm.createContext({state,requireClient:()=>true,getBibleChapterOptions:()=>[1],render:()=>{},persistUiState:()=>{},
  inferBibleVerseEndRanges:rows=>rows,showToast:message=>{throw Error(message)},escapeHtml:escape,escapeAttr:escape,
  safeStorageGet:(_,key,fallback)=>storage.get(key)||fallback,safeStorageSet:(_,key,value)=>storage.set(key,value)});
vm.runInContext([
  source.match(/const BIBLE_CHAPTER_CACHE_PREFIX = .*;/)[0],source.match(/const BIBLE_CHAPTER_CACHE_TTL_MS = .*;/)[0],
  ...['bibleVerseCacheKey','persistentBibleChapterCacheKey','readPersistentBibleChapterCache','writePersistentBibleChapterCache',
    'normalizeServerBibleVerse','loadBibleBookVerses','renderBibleVerseList'].map(fn),
].join('\n'),context);
(async()=>{
  await context.loadBibleBookVerses();
  assert.equal(requests,1,'old cache must not hide headings or retain embedded titles');
  assert.equal(state.bibleBookVerses[0].section_title,row.section_title);
  const html=context.renderBibleVerseList(state.bibleBookVerses);
  assert.ok(html.includes('<div class="bible-section-title">소제목 &lt;보존&gt;</div>'));
  assert.ok(html.includes('<strong>본문 [본문 주석]</strong>'));
  state.bibleVerseCache.clear();state.bibleBookVerses=[];
  await context.loadBibleBookVerses();
  assert.equal(requests,1,'new persisted cache should preserve headings without another request');
  assert.equal(state.bibleBookVerses[0].section_title,row.section_title);
  console.log('PASS stale-cache invalidation, heading fetch/render/escaping and cache reload');
})().catch(error=>{console.error(error);process.exitCode=1});
