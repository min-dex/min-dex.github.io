import assert from 'node:assert/strict';
import {createServerState} from '../mindex.server-state.mjs';
import {legacyStateDestination,migrateLegacyState,retireConfirmedLegacyState} from '../mindex.legacy-state.mjs';
const db=new Map();let writes=0,lose=false;
const rpc=async(name,args)=>{
 const key=args.p_scope+':'+args.p_key;
 if(name==='mindex_state_read_v1')return {data:[...db].filter(([id])=>id.startsWith(args.p_scope+':')).map(([,v])=>v)};
 writes++;const old=db.get(key);if(old?.requestId===args.p_request_id)return {data:old};
 if((old?.revision||'0')!==args.p_revision)throw Error('STATE_REVISION_CONFLICT');
 const row={key:args.p_key,value:args.p_value,revision:String(BigInt(args.p_revision)+1n),requestId:args.p_request_id};db.set(key,row);
 if(lose){lose=false;throw Error('response lost')};return {data:row};
};
const stores=Object.fromEntries(['device','session','shared'].map(scope=>[scope,createServerState({rpc,token:'test',scope})]));
await Promise.all(Object.values(stores).map(s=>s.load()));
const project='fixture';
for(const key of ['mindex.supabase.anonKey','mindex.server.identity:fixture','mindex.monitor.deviceReporter','mindex.bible.chapter.v3.x','mindex.atomic.pending.v1:service'])assert.equal(legacyStateDestination('local',key,project),null);
assert.equal(legacyStateDestination('session','mindex.atomic.pending.v2:["other","s"]',project),null);
const entries=[{scope:'local',key:'mindex.theme',value:'dark'},
 {scope:'local',key:'mindex.worshipRecoverySnapshot.latest.v1.s',value:'private'},
 {scope:'session',key:'mindex.ui.module',value:'service'}];
assert.equal((await migrateLegacyState({entries,project,legacyProject:'other',stores})).retained.length,3);assert.equal(writes,0);
await stores.shared.setItem('mindex.theme','light');await stores.session.removeItem('mindex.ui.module');
let result=await migrateLegacyState({entries,project,legacyProject:project,stores});
assert.equal(result.confirmed.length,1);assert.equal(result.retained.length,2);assert.equal(result.archived.length,2);
for(const entry of result.archived)assert.ok(JSON.parse(stores.device.getItem(entry.archiveKey)).sourceHash);
const archiveWrites=writes;await migrateLegacyState({entries,project,legacyProject:project,stores});assert.equal(writes,archiveWrites,'repeat migration cannot duplicate backups');
assert.equal(stores.shared.getItem('mindex.theme'),'light');assert.equal(stores.session.getItem('mindex.ui.module'),null);
const source=new Map(entries.map(e=>[e.key,e.value]));const access=()=>({getItem:key=>source.get(key),removeItem:key=>source.delete(key)});
source.set(entries[1].key,'newer edit');assert.deepEqual(retireConfirmedLegacyState(result,access),[]);
source.set(entries[1].key,'private');assert.deepEqual(retireConfirmedLegacyState(result,access),[entries[1].key]);
const lost=[{scope:'local',key:'mindex.ui.filter',value:'filter'}];lose=true;
result=await migrateLegacyState({entries:lost,project,legacyProject:project,stores});assert.equal(result.failed.length,1);assert.equal(result.confirmed.length,0);
result=await migrateLegacyState({entries:lost,project,legacyProject:project,stores});assert.equal(result.confirmed.length,1);assert.equal(db.get('device:mindex.ui.filter').revision,'1');
console.log('PASS legacy migration project/secret boundary, existing value/tombstone protection, readback, source-edit protection and lost-response replay');
