const { readRuntimeSource } = require('./helpers/runtime-source.cjs');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm'),fs=require('node:fs');
const bind=readRuntimeSource('mindex.desktop-ui.js');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(initial, platform, isDesktop = true){
 let status=initial || {status:'available',version:'1.2.3',presenterOpen:false};let live=false,dirty=false,accept=true;
 let confirms=0,installs=0,downloads=0,broadcasts=0;const messages=[];
 const buttons=Object.fromEntries(['desktopUpdateBtn','desktopBroadcastBtn'].map(id=>[id,{
  hidden:true,addEventListener(_name,callback){this.click=callback;},
 }]));
 const bridge={isDesktop,platform,onUpdateState:cb=>bridge.event=cb,
 getUpdateState:async()=>({ok:true,state:status}),checkForUpdates:async()=>({ok:true,state:status}),
 openBroadcast:async()=>{broadcasts++;return {ok:true};},
 installUpdate:async()=>{installs++;status={...status,status:'installing'};return status.manualInstall?{ok:true,installerOpened:true}:{ok:true};},
 downloadUpdate:async()=>{downloads++;status={...status,status:'downloaded'};bridge.event(status);return {ok:true};}};
 const ctx={window:{mindexElectron:bridge,confirm:()=>{confirms++;return accept;}},document:{getElementById:id=>buttons[id]},showToast:m=>messages.push(m),
 isPresenterOutputWindowOpen:()=>live,hasDirtyChanges:()=>dirty,currentSaveButtonState:()=>({dirty})};
 vm.runInNewContext(bind+'\nbindElectronDesktopEvents();',ctx);
 return {bridge,buttons,messages,live:v=>live=v,dirty:v=>dirty=v,accept:v=>accept=v,set:v=>status=v,counts:()=>({confirms,installs,downloads,broadcasts})};
}
for (const platform of ['win32','darwin']) {
test(platform+' toolbar reuses update guards and opens only the broadcast window',async()=>{
 const f=fixture({status:'downloaded',version:'1.2.3',presenterOpen:true},platform);
 f.live(true);await tick();
 assert.equal(f.buttons.desktopUpdateBtn.hidden,false);
 assert.equal(f.buttons.desktopBroadcastBtn.hidden,false);
 await f.buttons.desktopUpdateBtn.click();
 assert.equal(f.counts().installs,0);
 f.live(false);f.dirty(true);f.set({status:'downloaded',version:'1.2.3'});
 await f.buttons.desktopUpdateBtn.click();
 assert.equal(f.counts().installs,0);
 await f.buttons.desktopBroadcastBtn.click();
 assert.equal(f.counts().broadcasts,1);
 f.dirty(false);await f.buttons.desktopUpdateBtn.click();
 assert.equal(f.counts().installs,1);
});
}
test('web does not expose native toolbar actions',()=>{
 const web=fixture({status:'current'},undefined,false);
 assert(Object.values(web.buttons).every(button=>button.hidden));
});
test('declined update remains reachable from the toolbar',async()=>{
 const f=fixture();f.accept(false);await tick();assert.equal(f.counts().confirms,1);
 await tick();assert.equal(f.counts().confirms,1);
 f.accept(true);await f.buttons.desktopUpdateBtn.click();await tick();await tick();assert.equal(f.counts().downloads,1);assert.equal(f.counts().installs,1);
});
test('no prompt during output; pending downloaded state offered after output closes',async()=>{
 const f=fixture();f.live(true);f.set({status:'downloaded',version:'1.2.3',presenterOpen:true});await tick();assert.equal(f.counts().confirms,0);
 f.live(false);f.set({status:'downloaded',version:'1.2.3',presenterOpen:false});f.bridge.event((await f.bridge.getUpdateState()).state);await tick();assert.equal(f.counts().installs,1);
});
test('unsaved changes block restart; saved work can install from the toolbar',async()=>{
 const f=fixture();f.dirty(true);f.set({status:'downloaded',version:'1.2.3'});await tick();await tick();assert.equal(f.counts().installs,0);assert.ok(f.messages.some(m=>m.includes('먼저 저장')));
 f.dirty(false);await f.buttons.desktopUpdateBtn.click();await tick();assert.equal(f.counts().installs,1);
});

test('renderer reload recovers already-downloaded update without a new download',async()=>{
 const f=fixture({status:'downloaded',version:'1.2.3',presenterOpen:false});
 await tick();assert.equal(f.counts().downloads,0);assert.equal(f.counts().installs,1);
});

test('manual internal download preserves edits and never schedules an automatic install',async()=>{
 const f=fixture({status:'available',version:'1.0.1',manualInstall:true});f.dirty(true);await tick();assert.equal(f.counts().downloads,0);assert.equal(f.counts().installs,0);
});

test('internal download requires a second confirmation and rechecks unsaved edits before opening',async()=>{
 const f=fixture({status:'available',version:'1.0.6',manualInstall:true},'darwin');
 f.accept(false);await tick();
 f.accept(true);
 const baseDownload=f.bridge.downloadUpdate;
 f.bridge.downloadUpdate=async()=>{const result=await baseDownload();f.dirty(true);return result;};
 await f.buttons.desktopUpdateBtn.click();await tick();
 assert.equal(f.counts().installs,0);
 f.dirty(false);await f.buttons.desktopUpdateBtn.click();await tick();
 assert.equal(f.counts().downloads,1);assert.equal(f.counts().installs,1);
 assert(f.messages.some(m=>m.includes('설치 화면을 열었습니다')));
});

test('manual check distinguishes matching web, pending web changes and unverified web without restarting',async()=>{
 for(const webSync of ['matched','different','unknown']){
  const f=fixture({status:'current',manualInstall:true,webSync});await tick();await f.buttons.desktopUpdateBtn.click();
  assert.equal(f.counts().installs,0);assert.equal(f.counts().downloads,0);
  assert(f.messages.some(m=>m.includes(webSync==='matched'?'모두 최신':webSync==='different'?'다른 변경':'확인하지 못')));
 }
});
