const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require.resolve('../app.js'),'utf8');
const bind=source.slice(source.indexOf('function bindElectronDesktopEvents()'),source.indexOf('\nfunction loadInitialData()'));
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(initial){
 let status=initial || {status:'available',version:'1.2.3',presenterOpen:false};let live=false,dirty=false,accept=true;
 let confirms=0,installs=0,downloads=0;const messages=[];
 const bridge={isDesktop:true,onUpdateState:cb=>bridge.event=cb,onCheckUpdateRequested:cb=>bridge.manual=cb,
 getUpdateState:async()=>({ok:true,state:status}),checkForUpdates:async()=>({ok:true,state:status}),
 installUpdate:async()=>{installs++;status={...status,status:'installing'};return {ok:true};},
 downloadUpdate:async()=>{downloads++;status={...status,status:'downloaded'};bridge.event(status);return {ok:true};}};
 const ctx={window:{mindexElectron:bridge,confirm:()=>{confirms++;return accept;}},showToast:m=>messages.push(m),
 isPresenterOutputWindowOpen:()=>live,hasDirtyChanges:()=>dirty,currentSaveButtonState:()=>({dirty})};
 vm.runInNewContext(bind+'\nbindElectronDesktopEvents();',ctx);
 return {bridge,messages,live:v=>live=v,dirty:v=>dirty=v,accept:v=>accept=v,set:v=>status=v,counts:()=>({confirms,installs,downloads})};
}
test('declined update remains reachable from menu',async()=>{
 const f=fixture();f.accept(false);await tick();assert.equal(f.counts().confirms,1);
 await tick();assert.equal(f.counts().confirms,1);
 f.accept(true);await f.bridge.manual();await tick();await tick();assert.equal(f.counts().downloads,1);assert.equal(f.counts().installs,1);
});
test('no prompt during output; pending downloaded state offered after output closes',async()=>{
 const f=fixture();f.live(true);f.set({status:'downloaded',version:'1.2.3',presenterOpen:true});await tick();assert.equal(f.counts().confirms,0);
 f.live(false);f.set({status:'downloaded',version:'1.2.3',presenterOpen:false});f.bridge.event((await f.bridge.getUpdateState()).state);await tick();assert.equal(f.counts().installs,1);
});
test('unsaved changes block restart; saved work can install from menu',async()=>{
 const f=fixture();f.dirty(true);f.set({status:'downloaded',version:'1.2.3'});await tick();await tick();assert.equal(f.counts().installs,0);assert.ok(f.messages.some(m=>m.includes('먼저 저장')));
 f.dirty(false);await f.bridge.manual();await tick();assert.equal(f.counts().installs,1);
});

test('renderer reload recovers already-downloaded update without a new download',async()=>{
 const f=fixture({status:'downloaded',version:'1.2.3',presenterOpen:false});
 await tick();assert.equal(f.counts().downloads,0);assert.equal(f.counts().installs,1);
});
