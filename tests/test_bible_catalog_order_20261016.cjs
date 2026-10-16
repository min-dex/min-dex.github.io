const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');const start=source.indexOf('async function loadBibleBookVerses(');const code=source.slice(start,source.indexOf('\n}',start)+2);
(async()=>{
 for(const order of ['translations-first','books-first']){
  let requests=0;const state={client:{from:()=>query},module:'scripture',scriptureBooks:[],bibleTranslations:[],selectedBookCode:'DA1',selectedBibleTranslationId:'cog',selectedBibleChapter:13,bibleVerseCache:new Map()};
  const query={select(){return this},eq(){return this},order(){requests++;return Promise.resolve({data:[{book_code:'DA1',chapter:13,verse:1,text:'verified body'}],error:null})}};
  const c=vm.createContext({state,requireClient:()=>true,getBibleBooks:()=>[{code:'DA1'}],getBibleChapterOptions:()=>[3,13,14],bibleVerseCacheKey:(...p)=>p.join(':'),readPersistentBibleChapterCache:()=>null,writePersistentBibleChapterCache(){},persistUiState(){},render(){},bibleBookVerseLoadPromises:new Map(),inferBibleVerseEndRanges:x=>x,normalizeServerBibleVerse:x=>x,sortBibleVerseRows:(a,b)=>a.verse-b.verse});vm.runInContext(code,c);
  await c.loadBibleBookVerses();assert.equal(state.selectedBookCode,'DA1');assert.equal(state.selectedBibleChapter,13);assert.equal(requests,0);
  if(order==='translations-first')state.bibleTranslations=[{id:'cog'}];else state.scriptureBooks=[{code:'DA1'}];
  await c.loadBibleBookVerses();assert.equal(state.selectedBookCode,'DA1');assert.equal(requests,0);
  state.bibleTranslations=[{id:'cog'}];state.scriptureBooks=[{code:'DA1'}];await c.loadBibleBookVerses();assert.equal(requests,1);assert.equal(state.selectedBookCode,'DA1');assert.equal(state.selectedBibleChapter,13);assert.equal(state.bibleBookVerses[0].book_code,'DA1');
 }
 console.log('PASS both catalog arrival orders retain supplemental deep link until metadata settles');
})().catch(e=>{console.error(e);process.exitCode=1});
