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
 f=fixture();assert.equal(await f.restore(),true,JSON.stringify(f.toasts));assert.equal(f.archives[0].current.text,'original');assert.equal(f.archives[0].draft.value.text,'draft');assert.equal(f.state.scriptures[0].text,'draft');assert.equal(f.state.dirty.scripture,true);
 for(const mutate of [f=>{f.state.scriptures[0].text='typing';f.state.dirty.scripture=true},f=>{f.state.client={}},f=>{f.state.selectedScriptureId='other'},f=>{f.state.serviceMusic.playing=true}]){
  f=fixture();let release;f.context.window.MINDEX_SERVER_STORAGE.setItem=()=>new Promise(r=>release=r);
  const pending=f.restore();mutate(f);release();assert.equal(await pending,false);assert.notEqual(f.state.scriptures[0].text,'draft');
 }
 f=fixture();f.context.window.confirm=()=>false;assert.equal(await f.restore(),undefined);assert.equal(f.archives.length,0);assert.equal(f.state.scriptures[0].text,'original');
 console.log('PASS recovery archive failure, both originals retained, user cancellation and asynchronous edit/project/selection/music guards');
})().catch(e=>{console.error(e);process.exitCode=1});
