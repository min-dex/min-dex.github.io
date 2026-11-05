const assert=require('node:assert/strict');
const fs=require('node:fs');
const api=require('../mindex.single-song.js');
const html=fs.readFileSync('index.html','utf8');
assert(html.indexOf('"mindex.catalog-cache.js"')<html.indexOf('"mindex.single-song.js"'));
assert(JSON.parse(fs.readFileSync('package.json')).build.files.includes('mindex.catalog-cache.js'));
const records=[1,2].map(i=>({id:`SONG-CONT-000${i}-0001`,revision:1,metadata:{title:'fixture'+i},content:{name:'기본',forms:[]},relations:{same_song:[],related:[]}}));
const status={protocol:1,idFormat:'4-4-4-4',phase:'native',epoch:'1',manifest:'fixture',recordCount:2};
let saved=null,reads=0,writes=0,removed=0,broken=false,damage='';
global.MindexCatalogCache={
 read:async()=>{reads++;if(broken)throw Error('disk unavailable');const result=structuredClone(saved);if(result&&damage==='epoch')result.status.epoch='old';if(result&&damage==='duplicate')result.records[1]=structuredClone(result.records[0]);return result},
 write:async(c,p)=>{writes++;saved=structuredClone({status:p.status,records:p.records})},
 remove:async()=>{removed++;saved=null},
};
function client(change={}){const calls=[];return {calls,rpc:async(name,args)=>{calls.push(name);if(change.error)return {error:{code:'network'}};if(name==='get_praise_storage_status_v1')return {data:{...status,...change}};if(name==='get_single_praise_records_v1')return {data:structuredClone(records)};return {data:{records:structuredClone(records),after:records.at(-1).id,epoch:change.epoch||'1',manifest:change.manifest||'fixture'}}}}}
(async()=>{
 const a=client();await api.loadActivation(a,{persistent:true});assert.equal(a.calls.length,3);assert.equal(writes,1);
 const b=client();const [x,y]=await Promise.all([api.loadActivation(b,{persistent:true}),api.loadActivation(b,{persistent:true})]);assert.equal(b.calls.length,1);assert.deepEqual(x.records,records);assert.notEqual(x.repository,y.repository);assert.equal(writes,1);
 x.records[0].metadata.title='draft';assert.equal(y.records[0].metadata.title,'fixture1');
 await y.repository.read([records[0].id]);assert.equal(b.calls.at(-1),'get_single_praise_records_v1','selected readers must stay fresh');
 const before=reads;const authenticated=client();await api.loadActivation(authenticated);assert.equal(reads,before);assert.equal(authenticated.calls.length,3,'persistence must be explicit opt-in');
 const changed=client({epoch:'2',manifest:'updated'});await api.loadActivation(changed,{persistent:true});assert.equal(changed.calls.length,3,'server epoch/manifest change reused disk cache');
 for(const mode of ['epoch','duplicate']){damage=mode;const c=client();await api.loadActivation(c,{persistent:true});assert.equal(c.calls.length,3,mode);damage='';}
 broken=true;const disk=client();await api.loadActivation(disk,{persistent:true});assert.equal(disk.calls.length,3);broken=false;
 const unavailable=client({error:true});await assert.rejects(api.loadActivation(unavailable,{persistent:true}));assert.equal(unavailable.calls.length,1);assert.equal(saved,null,'status failure must clear trust');
 const legacy=client({phase:'legacy'});await api.loadActivation(legacy,{persistent:true});assert.equal(legacy.calls.length,1);
 const maintenance=client({phase:'maintenance'});await assert.rejects(api.loadActivation(maintenance,{persistent:true}));assert.equal(maintenance.calls.length,1);
 assert(removed>=4);console.log('PASS fresh-status cache opt-in, fail-closed maintenance/network, corrupt snapshot fallback, coalescing, independent records and fresh selected readers');
})().catch(e=>{console.error(e);process.exitCode=1});
