const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../mindex.scripture-repair-display.js'),'utf8');
const scope=JSON.parse(fs.readFileSync(require.resolve('../docs/bible-cache-repair-scope-20261014.json'),'utf8'));
const oldPersistent=new Map([['old','retained']]);
const affected=Object.entries(scope.repairs).flatMap(([id,r])=>Object.entries(r.chapters).flatMap(([bk,chs])=>chs.map(ch=>[id,bk,ch])));
assert.equal(affected.length,4737);
const state={bibleTranslations:[{id:'krv',name:'개역한글'}],bibleVerseCache:new Map(),module:'scripture',selectedBibleTranslationId:affected[0][0],selectedBookCode:affected[0][1],selectedBibleChapter:affected[0][2],bibleBookVerses:[{text:'old chapter'}]};
for(const a of affected)state.bibleVerseCache.set(a.join(':'),[{text:'stale'}]);state.bibleVerseCache.set('unrelated:GEN:1',[{text:'keep'}]);
let reloads=0;const c=vm.createContext({state,persistentBibleChapterCacheKey:(...a)=>a.join(':'),loadBibleBookVerses:()=>{reloads++;},document:{body:{},fonts:null,querySelectorAll:()=>[]},window:{addEventListener(){}},MutationObserver:class{observe(){}},requestAnimationFrame:f=>f()});
vm.runInContext(source,c);let count=0;
for(const [id,bk,ch] of affected){assert.notEqual(c.persistentBibleChapterCacheKey(id,bk,ch),[id,bk,ch].join(':'));assert.equal(state.bibleVerseCache.has([id,bk,ch].join(':')),false);count+=2;}
assert.equal(c.persistentBibleChapterCacheKey('krv','JER',33),'krv:JER:33.krv-20261014');assert.equal(c.persistentBibleChapterCacheKey('krv','GEN',1),'krv:GEN:1');assert.equal(c.persistentBibleChapterCacheKey('unrelated','GEN',1),'unrelated:GEN:1');assert.equal(state.bibleVerseCache.get('unrelated:GEN:1')[0].text,'keep');assert.equal(oldPersistent.get('old'),'retained');assert.equal(reloads,1);assert.equal(state.bibleBookVerses.length,0);
console.log(`PASS ${count+7} cache checks: all verified affected chapters refreshed, unrelated and KRV keys preserved, open reader reloaded, persistent originals untouched`);

let entries=0,translations=0;
const entryState={bibleTranslations:[],bibleVerseCache:new Map(),module:'home',bibleReaderError:''};
const e=vm.createContext({state:entryState,runModuleEntryLoads:()=>{entries++;return 'original-result';},loadBibleTranslations:options=>{assert.equal(options.silent,true);translations++;entryState.bibleTranslations.push({id:'loaded'});},persistentBibleChapterCacheKey:(...a)=>a.join(':'),document:{body:{},querySelectorAll:()=>[],fonts:null},window:{addEventListener(){}},MutationObserver:class{observe(){}},requestAnimationFrame:f=>f()});
vm.runInContext(source,e);assert.equal(e.runModuleEntryLoads('scripture'),'original-result');assert.equal(translations,1);e.runModuleEntryLoads('scripture');e.runModuleEntryLoads('praise');assert.equal(translations,1);assert.equal(entries,3);entryState.bibleTranslations=[];entryState.bibleReaderError='read error';e.runModuleEntryLoads('scripture');assert.equal(translations,1);
console.log('PASS scripture entry loads translations once, preserves original entry loads/return and does not retry a recorded read failure');
// Exercise the application's real persistent read/write functions, not a cache double API.
const app=fs.readFileSync(require.resolve('../app.js'),'utf8');
const functionSource=name=>{const a=app.indexOf(`function ${name}(`);assert(a>=0);return app.slice(a,app.indexOf('\n}',a)+2);};
const disk=new Map(),sample=affected[0],oldKey=sample.join(':'),stale={cachedAt:Date.now(),rows:[{text:'PRE_REPAIR_CACHE_SENTINEL'}]};disk.set(oldKey,JSON.stringify(stale));
const p=vm.createContext({state:{bibleTranslations:[],bibleVerseCache:new Map(),module:'home'},persistentBibleChapterCacheKey:(...a)=>a.join(':'),safeStorageGet:(_store,key)=>disk.get(key)||'',safeStorageSet:(_store,key,value)=>disk.set(key,value),normalizeServerBibleVerse:r=>r,BIBLE_CHAPTER_CACHE_TTL_MS:86400000,document:{body:{},querySelectorAll:()=>[],fonts:null},window:{addEventListener(){}},MutationObserver:class{observe(){}},requestAnimationFrame:f=>f()});
vm.runInContext(['readPersistentBibleChapterCache','writePersistentBibleChapterCache'].map(functionSource).join('\n'),p);
assert.equal(p.readPersistentBibleChapterCache(...sample)[0].text,'PRE_REPAIR_CACHE_SENTINEL');vm.runInContext(source,p);assert.equal(p.readPersistentBibleChapterCache(...sample),null);p.writePersistentBibleChapterCache(...sample,[{text:'CORRECTED_LIVE_BODY'}]);assert.equal(p.readPersistentBibleChapterCache(...sample)[0].text,'CORRECTED_LIVE_BODY');assert.equal(disk.get(oldKey),JSON.stringify(stale));
console.log('PASS actual persistent cache I/O: warm old body bypassed, fresh key populated, original cache retained without translation metadata loaded');

assert.equal(c.persistentBibleChapterCacheKey('f98f4683-e3d5-4829-82aa-8e2e8b8d2adf','GEN',1),'f98f4683-e3d5-4829-82aa-8e2e8b8d2adf:GEN:1.cog-genesis-one-20261014');
