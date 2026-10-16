const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const rows=new Map([['krv:PSA:72',['old']],['krv:PSA:73',['keep']],['rkb:PSA:72',['other']]]);
let size=60,override=false,reloads=0;
const box={offsetHeight:500,getBoundingClientRect:()=>({height:500,bottom:600}),querySelector:()=>null};
const text={closest:()=>box,style:{removeProperty(){size=60;override=false},set fontSize(v){size=parseFloat(v);override=true}},getBoundingClientRect:()=>({top:200}),get scrollHeight(){return size*12},get scrollWidth(){return 300},clientWidth:300};
const c=vm.createContext({state:{module:'scripture',selectedBibleTranslationId:'krv',selectedBookCode:'PSA',selectedBibleChapter:72,bibleBookVerses:['stale'],bibleTranslations:[{id:'krv',name:'개역한글'},{id:'rkb',name:'개역개정'}],bibleVerseCache:rows},loadBibleBookVerses:()=>{reloads++;},persistentBibleChapterCacheKey:(t,b,ch)=>`${t}:${b}:${ch}`,document:{body:{},querySelectorAll:()=>[text],fonts:{ready:{then:f=>f()}}},window:{addEventListener(){}},getComputedStyle:()=>({fontSize:'60px'}),requestAnimationFrame:f=>f(),MutationObserver:class{observe(){}}});
vm.runInContext(fs.readFileSync(require.resolve('../mindex.scripture-repair-display.js'),'utf8'),c);
assert.equal(c.persistentBibleChapterCacheKey('krv','PSA',72),'krv:PSA:72.krv-20261014');assert.equal(c.persistentBibleChapterCacheKey('krv','PSA',73),'krv:PSA:73');assert.equal(c.persistentBibleChapterCacheKey('rkb','PSA',72),'rkb:PSA:72');assert(!rows.has('krv:PSA:72'));assert(rows.has('krv:PSA:73')&&rows.has('rkb:PSA:72'));assert.equal(reloads,1);assert.equal(c.state.bibleBookVerses.length,0);assert(override);assert(text.scrollHeight<=387.5);assert(size>30);
console.log('PASS bounded long scripture fitting; only repaired KRV caches renew; unrelated chapters/translations retained');
// A single unbroken word can overflow horizontally without exceeding height.
Object.defineProperty(text,'scrollHeight',{get:()=>size});
Object.defineProperty(text,'scrollWidth',{get:()=>size*10});
size=60;override=false;
vm.runInContext(fs.readFileSync(require.resolve('../mindex.scripture-repair-display.js'),'utf8'),c);
assert(override,'horizontal-only overflow must trigger fitting');
assert(text.scrollWidth<=text.clientWidth+1);
assert(size>25,'retain the largest readable size');
console.log('PASS unbroken-word horizontal overflow triggers fitting');

const supplementary=JSON.parse(fs.readFileSync(require.resolve('../docs/bible-supplement-books-20261016.json'),'utf8'));
let supplementalChecks=0;
for(const book of supplementary.supplementBooks)for(const ch of book.chapterOptions){
 assert(c.persistentBibleChapterCacheKey('f98f4683-e3d5-4829-82aa-8e2e8b8d2adf',book.id,ch.key).endsWith('.cog-supplement-20261016'));
 assert.equal(c.persistentBibleChapterCacheKey('other',book.id,ch.key),`other:${book.id}:${ch.key}`);supplementalChecks+=2;
}
console.log(`PASS ${supplementalChecks} supplemental cache assertions; existing chapter scopes retained`);

// A transformed preview must retain the same layout-pixel fit as full output.
const outputSize=size;
box.getBoundingClientRect=()=>({height:62.5,bottom:75});
text.getBoundingClientRect=()=>({top:25});
vm.runInContext(fs.readFileSync(require.resolve('../mindex.scripture-repair-display.js'),'utf8'),c);
assert.equal(size,outputSize,'preview scale must not shrink the layout font');
console.log('PASS transformed preview retains output font size');
