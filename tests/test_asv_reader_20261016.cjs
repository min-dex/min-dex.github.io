const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');
function fn(name){const a=source.indexOf(`function ${name}(`);assert.ok(a>=0);return source.slice(a,source.indexOf('\n}',a)+2);}
const entries=new Map([['mindex.supabase.static.v1.mindex_bible_translations:id','old catalogue'],['mindex.bible.chapter.v3.existing:GEN:1','current official body'],['mindex.ui','preferences'],['biblia.reader.v1','notes'],['mindex.worship.document','service']]);
const storage={get length(){return entries.size},key:i=>[...entries.keys()][i],getItem:k=>entries.get(k),setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
const c=vm.createContext({Array,state:{bibleBookVerses:[1],selectedBibleVerses:[],selectedBibleVerse:21},escapeHtml:s=>String(s).replace(/</g,'&lt;'),escapeAttr:String,bibleVerseNumberLabel:v=>String(v.verse)});
c.window=c;c.document={querySelectorAll:()=>[],addEventListener(){}};c.addEventListener=()=>{};
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../mindex.disclosure-state.js'),'utf8'),c);
vm.runInContext(fn('refreshAsvCatalogueCache')+'\n'+fn('renderBibleVerseList'),c);c.refreshAsvCatalogueCache(storage);
assert.equal(entries.has('mindex.supabase.static.v1.mindex_bible_translations:id'),false);assert.equal(entries.size,5);entries.set('mindex.supabase.static.v1.mindex_bible_translations:id','new catalogue');c.refreshAsvCatalogueCache(storage);assert.equal(entries.get('mindex.supabase.static.v1.mindex_bible_translations:id'),'new catalogue');
const html=c.renderBibleVerseList([{verse:21,text:'',metadata:{notes:['<source note>']}}]);assert.ok(html.includes('독립 본문 없음'));assert.ok(html.includes('&lt;source note>'));assert.ok(html.indexOf('</p>')<html.indexOf('<details'));assert.ok(!html.match(/<strong>[^<]+/));
assert.doesNotThrow(()=>c.renderBibleVerseList([{verse:1,text:'body',metadata:{notes:{bad:true}}}]));
console.log('PASS ASV catalogue refresh preserves current bodies/personal/service data and runs once; source footnotes are escaped siblings, never verse body.');
