const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {webcrypto}=require('node:crypto');
(async()=>{
 const {createServerState}=await import('../mindex.server-state.mjs');
 const storage=()=>{const values=new Map();return {values,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)}};
 const localStorage=storage(),sessionStorage=storage(),nodes=new Map(),events=new Map(),timers=new Map();let clock=0;
 const window={addEventListener:(name,fn)=>events.set(name,fn)};
 const sandbox={window,localStorage,sessionStorage,crypto:webcrypto,Uint8Array,console,Event,stateFactory:createServerState,
  document:{getElementById:id=>nodes.get(id),createElement:()=>({setAttribute(){},append(){}}),body:{append:node=>nodes.set(node.id,node)}},
  setTimeout:fn=>{timers.set(++clock,fn);return clock}};
 const source=fs.readFileSync(new URL('../mindex.server-storage.js',`file://${__filename}`),'utf8')
  .replace(/await import\(`\.\/mindex\.server-state\.mjs\?v=\$\{[^\n]+\}`\)/,'({createServerState:stateFactory})');
 vm.runInNewContext(source,sandbox);
 const bridge=window.MINDEX_SERVER_STORAGE,db=new Map(),writes=[];
 let release,block=false,fail=false;
 const client={rpc:async(name,args)=>{
  const scope=args.p_scope;
  if(name==='mindex_state_read_v1')return {data:[...db].filter(([k])=>k.startsWith(scope+':')).map(([,v])=>v)};
  writes.push({...args});if(block){block=false;await new Promise(resolve=>release=resolve)}
  if(fail)throw Error('offline');
  const id=scope+':'+args.p_key,old=db.get(id);
  if(old?.requestId===args.p_request_id)return {data:old};
  if((old?.revision||'0')!==args.p_revision)throw Error('STATE_REVISION_CONFLICT');
  const row={key:args.p_key,value:args.p_value,revision:String(BigInt(args.p_revision)+1n),requestId:args.p_request_id};
  db.set(id,row);return {data:row};
 }};
 assert.throws(()=>bridge.journal.getItem('mindex.atomic.pending.v1:s'),/NOT_READY/);
 assert.equal(bridge.queue('local','mindex.theme','dark'),false);
 await Promise.all([bridge.initialize(client,'fixture'),bridge.initialize(client,'fixture')]);
 assert.equal(localStorage.values.size,1);assert.equal(sessionStorage.values.size,1);
 block=true;
 const first=bridge.setItem('local','mindex.theme','dark');
 const second=bridge.setItem('local','mindex.theme','light');
 await new Promise(setImmediate);
 assert.equal(writes.length,1);assert.equal(bridge.getItem('local','mindex.theme'),null);
 assert.equal(bridge.pending,true);
 assert.equal(nodes.get("serverStorageStatus")?.hidden ?? true,true);
 let pendingWarned=false;events.get("beforeunload")({preventDefault(){pendingWarned=true}});assert.equal(pendingWarned,true);
 await assert.rejects(bridge.initialize({},'another-project'),/UNSAVED_CHANGES/);
 release();await Promise.all([first,second]);assert.equal(bridge.getItem('local','mindex.theme'),'light');
 assert.equal(db.get('shared:mindex.theme').revision,'2');assert.equal(bridge.pending,false);
 // Edit while a flush is in flight: a later timer must dispatch the new value.
 timers.clear();block=true;bridge.queue('session','mindex.ui.module','praise');
 const flush=bridge.flush();await new Promise(setImmediate);
 // Fire the already scheduled timer while the first request is blocked.
 for(const [id,fn] of [...timers]){timers.delete(id);fn()}
 bridge.queue('session','mindex.ui.module','scripture');
 release();await flush;
 for(const [id,fn] of [...timers]){timers.delete(id);fn()}
 await bridge.flush();assert.equal(bridge.getItem('session','mindex.ui.module'),'scripture');
 fail=true;bridge.queue('session','mindex.draft','unsaved');await bridge.flush();
 assert.equal(bridge.pending,true);assert.equal(bridge.getItem('session','mindex.draft'),null);
 assert.equal(nodes.get('serverStorageStatus').hidden,false);
 assert.match(nodes.get('serverStorageStatus').textContent,/보관하지 못한/);
 let warned=false;events.get('beforeunload')({preventDefault(){warned=true}});assert.equal(warned,true);
 const failedRequest=writes.at(-1).p_request_id;
 fail=false;assert.equal(await bridge.retry(),true);
 assert.equal(nodes.get('serverStorageStatus').hidden,true);
 assert.equal(writes.findLast(w=>w.p_key==='mindex.draft').p_request_id,failedRequest);
 assert.equal(bridge.getItem('session','mindex.draft'),'unsaved');
 assert.equal(localStorage.values.size,1);assert.equal(sessionStorage.values.size,1);
 // Reproducible scripture data stays memory-only and never enters app-state RPC.
 const count=writes.length;await bridge.setItem('local','mindex.bible.chapter.v3.fixture','corpus');
 await bridge.setItem('local','mindex.supabase.static.v1.fixture','catalog');
 assert.equal(writes.length,count);
 // Mutations read the confirmed value after replay, so concurrent manifests keep both entries.
 fail=true;await assert.rejects(bridge.updateItem('local','mindex.manifest',()=>JSON.stringify({a:1})),/offline/);
 fail=false;await bridge.updateItem('local','mindex.manifest',value=>JSON.stringify({...JSON.parse(value),b:2}));
 assert.deepEqual(JSON.parse(bridge.getItem('local','mindex.manifest')),{a:1,b:2});
 await Promise.all(['c','d'].map(key=>bridge.updateItem('local','mindex.manifest',value=>JSON.stringify({...JSON.parse(value),[key]:3}))));
 assert.deepEqual(JSON.parse(bridge.getItem('local','mindex.manifest')),{a:1,b:2,c:3,d:3});
 console.log('PASS server bridge confirmed mirror, serialized writes, project-change guard, in-flight queue edits, offline retry identity, unload warning and memory-only corpus cache');
})().catch(error=>{console.error(error);process.exitCode=1});
