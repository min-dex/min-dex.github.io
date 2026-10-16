const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../app.js'),'utf8');const a=source.indexOf('function purgeLegacyBibleCaches('),b=source.indexOf('\n}',a)+2;assert.ok(a>=0);
const entries=new Map([
 ['mindex.bible.chapter.v3.retired:GEN:1','discarded body'],
 ['mindex.bible.chapter.v3.active:GEN:1.old-version','obsolete earlier body'],
 ['mindex.bible.chapter.v2.old:JOB:1','earlier cache'],
 ['mindex.supabase.static.v1.mindex_bible_translations:id,name','old catalogue'],
 ['mindex.supabase.static.v1.mindex_bible_verses:*','old body query'],
 ['mindex.supabase.static.v1.mindex_scripture_books:*','old book query'],
 ['mindex.supabase.static.v1.mindex_songs:*','retain songs'],
 ['mindex.worship.document','retain personal service'],
 ['biblia.reader.v1','retain personal notes'],
 ['mindex.ui','retain preferences']]);
const storage={get length(){return entries.size},key:i=>[...entries.keys()][i],getItem:k=>entries.get(k),setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
const ctx=vm.createContext({});vm.runInContext(source.slice(a,b),ctx);assert.equal(ctx.purgeLegacyBibleCaches(storage),6);
for(const key of ['mindex.supabase.static.v1.mindex_songs:*','mindex.worship.document','biblia.reader.v1','mindex.ui'])assert.ok(entries.has(key));
entries.set('mindex.bible.chapter.v3.current:GEN:1','fresh official source');assert.equal(ctx.purgeLegacyBibleCaches(storage),0);assert.ok(entries.has('mindex.bible.chapter.v3.current:GEN:1'));
assert.equal(entries.get('mindex.bible.source-cache-purged.20261016'),'complete');
console.log('PASS all corpus-only caches purged once; notes,services,songs,preferences and fresh official caches preserved');
