const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const modules=fs.readFileSync('index.html','utf8').match(/const modules = \[([\s\S]*?)\];/)[1];
assert.ok(modules.indexOf('"mindex.service-entry.js"')<modules.indexOf('"app.js"'),'startup read owner must execute before app init');
const tick=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const requests=[];
 const c={state:{client:{},module:'home',services:['keep'],dirty:{forms:true}},document:{addEventListener(){}},console:{warn(){}},WORSHIP_SERVICE_TYPE_SELECT:'fixture'};
 c.window=c;
 const read=kind=>new Promise((resolve,reject)=>requests.push({kind,resolve,reject}));
 c.fetchCachedSupabasePaged=()=>read('types');c.fetchWorshipServiceListRows=()=>read('services');
 vm.createContext(c);vm.runInContext(fs.readFileSync('mindex.service-entry.js','utf8'),c);
 return {c,requests,api:c.MINDEX_SERVICE_ENTRY};
}
(async()=>{
 let {c,requests,api}=fixture();
 api.prepareInitialReads();assert.deepEqual(requests.map(r=>r.kind),['types','services']);
 let done=false;const pending=api.readInitialLists().then(v=>{done=true;return v});await tick();assert.equal(done,false);
 requests[1].resolve(['service']);await tick();assert.equal(done,false);
 requests[0].resolve(['type']);assert.equal(JSON.stringify(await pending),'[["type"],["service"]]');
 assert.deepEqual(c.state.services,['keep']);assert.equal(c.state.dirty.forms,true);
 ({c,requests,api}=fixture());api.prepareInitialReads();requests[1].reject(Error('list failed'));requests[0].resolve([]);await tick();
 await assert.rejects(api.readInitialLists(),/list failed/);
 const retry=api.readInitialLists();requests[2].resolve(['retry type']);requests[3].resolve(['retry service']);await retry;
 ({c,requests,api}=fixture());const old=api.prepareInitialReads();old.discard();
 requests[0].resolve(['stale']);requests[1].resolve(['stale']);const fresh=api.readInitialLists();assert.equal(requests.length,4);
 requests[2].resolve(['new']);requests[3].resolve(['new']);assert.equal(JSON.stringify(await fresh),'[["new"],["new"]]');
 ({c,requests,api}=fixture());api.prepareInitialReads();const changed=api.readInitialLists();c.state.client={};requests[0].resolve([]);requests[1].resolve([]);
 await assert.rejects(changed,/연결이 변경/);assert.deepEqual(c.state.services,['keep']);
 // Actual startup starts detached queries immediately, but calls the service
 // loader only after ID activation. Failure and navigation discard the receipt.
 ({c,requests,api}=fixture());let release,discarded=0;
 const prepare=api.prepareInitialReads;api.prepareInitialReads=()=>{const t=prepare();return {discard(){discarded++;t.discard()}}};
 c.ensureSingleSongActivation=()=>new Promise(r=>release=r);c.isServiceDataModule=()=>c.state.module==='home';
 c.loadServiceData=async()=>{assert.equal(c.activated,true);const rows=await api.readInitialLists();assert.equal(rows[1][0],'prepared');};
 c.worshipAtomicClient=async()=>{};c.scheduleBackgroundSongLoad=()=>{};
 const source=fs.readFileSync('app.js','utf8');vm.runInContext(source.slice(source.indexOf('async function loadInitialData()'),source.indexOf('\nfunction isServiceDataModule')),c);
 const startup=c.loadInitialData();assert.equal(requests.length,2);assert.deepEqual(c.state.services,['keep']);
 requests[0].resolve([]);requests[1].resolve(['prepared']);c.activated=true;release();await startup;assert.equal(discarded,0);
 const navigated=c.loadInitialData();c.state.module='manuals';requests[2].resolve([]);requests[3].resolve([]);release();await navigated;assert.equal(discarded,1);
 c.state.module='home';c.ensureSingleSongActivation=async()=>{throw Error('activation failed')};
 await assert.rejects(c.loadInitialData(),/activation failed/);assert.equal(discarded,2);
 requests[4].resolve([]);requests[5].reject(Error('discarded read'));await tick();
 console.log('PASS detached startup overlap, activation-before-adoption, error settlement/retry, discard/navigation/client/draft guards');
})().catch(e=>{console.error(e);process.exitCode=1});
