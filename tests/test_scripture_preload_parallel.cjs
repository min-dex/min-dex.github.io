const { readRuntimeSource } = require('./helpers/runtime-source.cjs');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=readRuntimeSource('app.js');
const names=['preloadServiceItemScriptureReferences','preloadWorshipScriptureReferences'];
(async()=>{
 for(const name of names) for(const failure of [false,true]) {
  let bookDone,translationDone,started=[],parsed=0;
  const ctx=vm.createContext({state:{client:{},services:[{id:'s'}],bibleTranslations:[],bibleVerseCache:new Map()},console:{warn(){}},
   getServiceItems:()=>[{memo:''}],ensureBibleBookLookups:()=>{started.push('books');return new Promise(r=>bookDone=r)},
   loadBibleTranslations:()=>{started.push('translations');return new Promise((r,j)=>translationDone=failure?()=>j(Error('offline')):r)},
   selectedPresenterBibleTranslation:()=>({id:'t'}),serviceItemSupportsScriptureResolution:()=>true,
   parseServiceItemMemo:()=>({}),serviceItemScriptureReferences:()=>{parsed++;return []},
   serviceElementScriptureReferences:()=>{parsed++;return []},uniqueList:a=>[...new Set(a)]});
  const start=source.indexOf(`async function ${name}(`);vm.runInContext(source.slice(start,source.indexOf('\n}\n',start)+2),ctx);
  const task=name===names[0]?ctx[name]('s'):ctx[name]([{id:'section',service_id:'s'}],[{section_id:'section'}],{serviceId:'s'});
  assert.deepEqual(started,['books','translations'],'catalog requests must overlap');
  bookDone();await Promise.resolve();assert.equal(parsed,0,'must wait for both catalogs');
  translationDone();assert.equal(await task,false);assert.equal(parsed,failure?0:1);
 }

 for(const failure of [false,true]) {
  let books,translations,started=[],selected=0;
  const ctx=vm.createContext({state:{bibleTranslations:[]},requireClient:()=>true,
   ensureBibleBookLookups:()=>{started.push('books');return new Promise(r=>books=r)},
   loadBibleTranslations:()=>{started.push('translations');return new Promise((r,j)=>translations=failure?()=>j(Error('offline')):r)},
   selectedPresenterBibleTranslation:()=>{selected++;return null}});
  const start=source.indexOf('async function fetchServiceScriptureVerses(');
  vm.runInContext(source.slice(start,source.indexOf('\n}\n',start)+2),ctx);
  const task=ctx.fetchServiceScriptureVerses({});
  assert.deepEqual(started,['books','translations']);books();await Promise.resolve();assert.equal(selected,0);
  translations();
  if(failure) await assert.rejects(task,/offline/);
  else assert.equal((await task).length,0);
  assert.equal(selected,failure?0:1);
 }
 console.log('PASS direct fetch and both scripture preload paths overlap catalogs and retain readiness/error gates');
})().catch(e=>{console.error(e);process.exitCode=1});

// An explicit choice captured during entry must be resolved again after catalogue load.
(async()=>{
 for(const mode of ['validation','fetch']) for(const found of [true,false]) {
  const edition={id:'requested',name:'Requested'},other={id:'default',name:'Default'};
  const reference={book:{code:'GEN'},chapter:1,verse:1};
  const ctx=vm.createContext({state:{client:{},bibleTranslations:[],bibleReaderError:'',bibleVerseCache:new Map([['requested:GEN:1',[{verse:1,text:'retained'}]]])},
   ensureBibleBookLookups:async()=>{},loadBibleTranslations:async()=>{ctx.state.bibleTranslations=found?[edition,other]:[other]},
   selectedPresenterBibleTranslation:()=>other,serviceBibleTranslationById:id=>ctx.state.bibleTranslations.find(t=>t.id===id)||null,
   inspectScriptureReferences:()=>({valid:true,entries:[{raw:'창 1:1',reference}]}),requireClient:()=>true,
   bibleReferenceBookForTranslation:book=>book,getBibleChapterCount:()=>50,bibleVerseCacheKey:(id,code,ch)=>`${id}:${code}:${ch}`,
   getCachedServiceScriptureVerses:(ref,t)=>ctx.state.bibleVerseCache.get(`${t.id}:GEN:1`)});
  for(const name of ['fetchServiceScriptureVerses','validateScriptureReferences']) {
   const start=source.indexOf(`async function ${name}(`);vm.runInContext(source.slice(start,source.indexOf('\n}\n',start)+2),ctx);
  }
  const captured=Object.freeze({id:'',retiredId:'requested',name:'Pending'});
  const task=mode==='validation'?ctx.validateScriptureReferences('창 1:1',captured):ctx.fetchServiceScriptureVerses(reference,captured);
  if(!found&&mode==='validation')await assert.rejects(task,/역본을 불러오지/);
  else {const result=await task;assert.equal(mode==='validation'?result.translation.id:result.length,mode==='validation'?'requested':found?1:0);}
  assert.equal(captured.retiredId,'requested');assert.equal(captured.id,'');
 }
 console.log('PASS cold catalogue explicit edition re-resolved for validation/fetch; genuinely missing edition never falls back; selection preserved');
})().catch(error=>{console.error(error);process.exitCode=1});
