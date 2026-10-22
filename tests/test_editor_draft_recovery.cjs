const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),crypto=require('node:crypto');
function fixture(){
 const state={module:'scripture',selectedScriptureId:'s',scriptures:[{id:'s',text:'original'}],dirty:{scripture:false},client:{},serviceMusic:{},cleanFingerprints:{scripture:'base'}};
 const archives=[],toasts=[];
 const context={state,structuredClone,crypto,queueMicrotask,Event,showToast:m=>toasts.push(m),refs:{detailPane:{querySelectorAll:()=>[]}},
  dirtyModuleFingerprint:()=>JSON.stringify(state.scriptures[0]),dirtyModuleValue:()=>state.scriptures[0],hasDirtyChanges:()=>state.dirty.scripture,
  isPresenterOutputWindowOpen:()=>false,updateSaveState:()=>{},document:{addEventListener:()=>{}},
  window:{addEventListener:()=>{},confirm:()=>true,render:()=>{},MINDEX_SERVER_STORAGE:{setItem:async(scope,k,v)=>archives.push(JSON.parse(v))}}};
 vm.createContext(context);vm.runInContext(fs.readFileSync('mindex.editor-drafts.js','utf8'),context);
 const draft={schema:1,module:'scripture',id:'s',base:JSON.stringify(state.scriptures[0]),value:{id:'s',text:'draft'},fields:[]};
 return {context,state,draft,archives,toasts,restore:()=>context.window.MINDEX_EDITOR_DRAFTS.restoreDraft(draft)};
}
(async()=>{
 let f=fixture();f.context.window.MINDEX_SERVER_STORAGE.setItem=async()=>{throw Error('offline')};
 assert.equal(await f.restore(),false);assert.equal(f.state.scriptures[0].text,'original');assert.equal(f.state.dirty.scripture,false);
 f=fixture();assert.equal(await f.restore(),true,JSON.stringify(f.toasts));assert.equal(f.archives.find(a=>a.current).current.text,'original');assert.equal(f.archives.find(a=>a.draft).draft.value.text,'draft');assert.equal(f.state.scriptures[0].text,'draft');assert.equal(f.state.dirty.scripture,true);
 for(const mutate of [f=>{f.state.scriptures[0].text='typing';f.state.dirty.scripture=true},f=>{f.state.client={}},f=>{f.state.selectedScriptureId='other'},f=>{f.state.serviceMusic.playing=true}]){
  f=fixture();let release;f.context.window.MINDEX_SERVER_STORAGE.setItem=()=>new Promise(r=>release=r);
  const pending=f.restore();mutate(f);release();assert.equal(await pending,false);assert.notEqual(f.state.scriptures[0].text,'draft');
 }
 for(const failAt of [2,3]){
  f=fixture();let writes=0;f.context.window.MINDEX_SERVER_STORAGE.setItem=async(scope,key,value)=>{if(++writes===failAt)throw Error('offline');f.archives.push(JSON.parse(value))};
  assert.equal(await f.restore(),false);assert.equal(f.state.scriptures[0].text,'original');
  f.context.window.MINDEX_SERVER_STORAGE.setItem=async(scope,key,value)=>f.archives.push(JSON.parse(value));
  assert.equal(await f.restore(),true);assert.ok(f.archives.some(a=>a.value?.text==='original'));
 }
 f=fixture();f.state.dirty.scripture=true;assert.equal(await f.restore(),true);assert.ok(f.archives.some(a=>a.value?.text==='original'));
 f=fixture();f.context.window.confirm=()=>false;assert.equal(await f.restore(),undefined);assert.equal(f.archives.length,0);assert.equal(f.state.scriptures[0].text,'original');
 f=fixture();
 const service={id:'w',title:'Youth',_worshipSourceTextDraft:'current source'};
 Object.assign(f.state,{module:'service',selectedServiceId:'w',services:[service],serviceItems:{w:[{id:'i',text:'current lyric'}]},serviceTypes:[],dirtyServiceElementIds:new Map([['w',new Set(['i'])]]),dirtyServiceStructureIds:new Set(['w']),dirtyServiceTypeIds:new Set()});
 f.state.dirty.service=true;f.context.serviceSourceTextareaForService=()=>({value:'current source'});
 f.context.dirtyModuleValue=()=>({service:f.state.services[0],items:f.state.serviceItems.w,serviceTypes:[]});
 f.context.dirtyModuleFingerprint=()=>JSON.stringify(f.context.dirtyModuleValue());
 const serviceDraft={schema:1,module:'service',id:'w',base:f.context.dirtyModuleFingerprint(),value:{service:{id:'w',title:'Youth'},items:[{id:'i',text:'recovered lyric'}],serviceTypes:[]},sourceText:'saved source',elementIds:['i'],structure:true,fields:[]};
 assert.equal(await f.context.window.MINDEX_EDITOR_DRAFTS.restoreDraft(serviceDraft),true);
 assert.equal(f.state.serviceItems.w[0].text,'recovered lyric');assert.equal(f.state.services[0]._worshipSourceTextDraft,'saved source');
 assert.ok(f.archives.some(a=>a.sourceText==='current source'&&a.value.items[0].text==='current lyric'));
 console.log('PASS recovery archive failure, both originals retained, user cancellation and asynchronous edit/project/selection/music guards');
})().catch(e=>{console.error(e);process.exitCode=1});
