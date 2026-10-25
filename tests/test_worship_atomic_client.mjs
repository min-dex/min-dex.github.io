import assert from 'node:assert/strict';
import {createWorshipAtomicClient, prepareWorshipRowsCommit, prepareWorshipRowsCreate} from '../mindex.worship-atomic-client.mjs';

const baseline = {revision:'1', service:{id:'service', service_type_id:'fixture', service_date:'2026-10-12'},
  sections:[{id:'section', service_id:'service', title:'Section'}],
  elements:[{id:'element', section_id:'section', title:'Original',config:{keep:true,clear:true}},
    {id:'sibling', section_id:'section', title:'Sibling'}], slides:[]};
const input = {serviceId:'service',rows:{sections:[],elements:[{...baseline.elements[0],title:'Changed',config:{keep:true}}]},
  document:{sourceText:'Changed'}};
const prepared=prepareWorshipRowsCommit({...input,baseline});
assert.deepEqual(prepared.deleteElementIds,[]);
assert.equal(prepared.elementPatches.length,1);
assert.deepEqual(prepared.elementPatches[0].removeKeys,{config:['clear']});
assert.deepEqual(baseline.elements[0].config,{keep:true,clear:true});
assert.throws(()=>prepareWorshipRowsCommit({...input,baseline,deleteElementIds:['element']}),/INVALID_STRUCTURE/);
assert.equal(prepareWorshipRowsCommit({...input,baseline,metadata:{service_date:'2026-10-13'}}).metadataPatch.service_date,'2026-10-13');
assert.throws(()=>prepareWorshipRowsCommit({...input,baseline,rows:{sections:[],elements:[{id:'x',section_id:'foreign'}]}}),/OWNERSHIP/);
console.log('PASS partial row scope, explicit removals, ownership, date patch and immutable input');

const memory=new Map();
const journal={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
let mode='network',calls=[],db=structuredClone(baseline);
const client=createWorshipAtomicClient({journal,makeId:()=> 'request',rpc:async(name,args)=>{
  if(name==='get_worship_service_v1')return {data:structuredClone(db)};
  calls.push(structuredClone(args.req));
  if(mode==='network')throw Error('Network lost');
  if(mode==='conflict')return {error:{code:'P0001',message:'REVISION_CONFLICT'}};
  return {data:{replayed:true,committedRevision:'2',aggregate:{...db,revision:'2'}}};
}});
await client.read('service');
await assert.rejects(client.commit(input),/Network lost/);
const pending=client.pending('service');assert.ok(pending);
mode='ok';
await assert.rejects(client.commit({...input,document:{sourceText:'Newer draft'}}),/RETRY_COMMITTED/);
assert.deepEqual(calls[1],calls[0]);assert.equal(client.pending('service'),null);
await assert.rejects(client.commit(input),/RELOAD_REQUIRED/);
assert.equal(calls.length,2);
db={...db,revision:'2'};await client.read('service');
mode='conflict';await assert.rejects(client.commit(input),e=>e.message==='REVISION_CONFLICT');
assert.equal(client.pending('service'),null);
await assert.rejects(client.commit(input),/RELOAD_REQUIRED/);
console.log('PASS uncertain retry uses original request; newer draft not acknowledged; known rollback clears request');

await client.read('service');mode='network';await assert.rejects(client.commit(input),/Network lost/);
mode='conflict';await assert.rejects(client.commit(input),e=>e.message==='REVISION_CONFLICT');
assert.equal(client.pending('service'),null);
db={...db,revision:'10'};await client.read('service',{adopt:false});
assert.equal(client.baseline('service').revision,'2');
console.log('PASS conflict after uncertain retry and non-adopting background reads');

const localDraft = {items:[{id:'element',title:'Unsaved'}],sourceText:'local'};
const priorBaseline = client.baseline('service');
const review = await client.inspectConflict('service', localDraft);
assert.equal(review.latest.revision, '10');
assert.deepEqual(client.baseline('service'), priorBaseline);
localDraft.items[0].title = 'New typing';
assert.equal(review.draft.items[0].title, 'Unsaved');
await assert.rejects(client.commit(input),/RELOAD_REQUIRED/);
db = null;
assert.equal((await client.inspectConflict('service', localDraft)).latest, null);
db = {...baseline, service:{id:'another-service'}};
await assert.rejects(client.inspectConflict('service', localDraft), /INVALID_CONFLICT_SNAPSHOT/);
db = {...baseline, revision:'not-a-revision'};
await assert.rejects(client.inspectConflict('service', localDraft), /INVALID_CONFLICT_SNAPSHOT/);
db = {...baseline, revision:'10'};
await client.read('service');mode='network';
await assert.rejects(client.commit(input), /Network lost/);
const uncertain = client.pending('service');
await client.inspectConflict('service', localDraft);
assert.deepEqual(client.pending('service'), uncertain);
assert.equal(client.baseline('service').revision, '10');
console.log('PASS conflict inspection freezes draft, handles deletion, validates identity, never adopts or clears pending writes');

const recoveryMemory = new Map();
let recoveryDb = structuredClone(baseline), releaseRead = null, recoveryWrites = [];
const recovery = createWorshipAtomicClient({
  journal:{getItem:k=>recoveryMemory.get(k)||null,setItem:(k,v)=>recoveryMemory.set(k,v),removeItem:k=>recoveryMemory.delete(k)},
  makeId:()=> 'recovery-save', rpc:async (name,args)=> {
    if (name === 'get_worship_service_v1') {
      if (releaseRead) await releaseRead();
      return {data:structuredClone(recoveryDb)};
    }
    recoveryWrites.push(args.req);
    return {data:{aggregate:{...recoveryDb,revision:'12'},committedRevision:'12',replayed:false}};
  },
});
await recovery.read('service');
recoveryDb = {...recoveryDb,revision:'11'};
const recoveryReview = await recovery.inspectConflict('service', localDraft);
await assert.rejects(recovery.reopenReviewed(recoveryReview,{beforeAdopt:()=>false}),/DRAFT_NOT_PRESERVED/);
assert.equal(recovery.baseline('service').revision,baseline.revision);
await assert.rejects(recovery.reopenReviewed(recoveryReview,{beforeAdopt:()=>{throw Error('LOCAL_DRAFT_CHANGED')}}),/LOCAL_DRAFT_CHANGED/);
recoveryDb = {...recoveryDb,revision:'12'};
let guardCalls = 0;
await assert.rejects(recovery.reopenReviewed(recoveryReview,{beforeAdopt:()=>{guardCalls++;return true}}),/REVIEW_OUTDATED/);
assert.equal(guardCalls,0);
recoveryDb = {...recoveryDb,revision:'11'};
await recovery.reopenReviewed(recoveryReview,{beforeAdopt:()=>{guardCalls++;return true}});
assert.equal(recovery.baseline('service').revision,'11');
assert.equal(recoveryWrites.length,0);
await recovery.commit(input);
assert.equal(recoveryWrites[0].expectedRevision,'11');
await assert.rejects(client.reopenReviewed(await client.inspectConflict('service',localDraft),{beforeAdopt:()=>true}),/PENDING_REQUEST/);
console.log('PASS explicit recovery refuses changed review, unarchived/changed draft and pending write; next save uses reviewed revision');

const creation = {service:{...baseline.service,created_at:'client time',source_ref:{custom:true}},
  rows:{sections:baseline.sections,elements:baseline.elements},document:{sourceText:'New',updatedAt:'one'}};
const createPayload=prepareWorshipRowsCreate(creation);
assert.equal(createPayload.metadataPatch.created_at,undefined);
assert.equal(createPayload.metadataPatch.service_type_id,undefined);
assert.equal(createPayload.elements.length,2);
let lost=true, replayCalls=[];
memory.clear();
const lifecycle=createWorshipAtomicClient({journal,makeId:()=> 'stable-id',rpc:async(name,{req})=>{
  replayCalls.push({name,req:structuredClone(req)});
  if(lost){lost=false;throw Error('Response lost')}
  return {data:name==='create_worship_service_v1'
    ? {aggregate:{...baseline,revision:'1'},committedRevision:'1',replayed:true}
    : {aggregate:null,deleted:true,currentRevision:'2',committedRevision:'2',replayed:true}};
}});
const identity=['fixture','2026-10-12'];
assert.equal(await lifecycle.creationId(identity),await lifecycle.creationId(identity));
await assert.rejects(lifecycle.create(creation),/Response lost/);
const recovered=await lifecycle.create({...creation,document:{...creation.document,updatedAt:'two'}});
assert.equal(recovered.service.id,'service');
assert.deepEqual(replayCalls[0],replayCalls[1]);
lost=true;await assert.rejects(lifecycle.remove('service'),/Response lost/);
assert.equal(await lifecycle.remove('service'),true);
assert.deepEqual(replayCalls[2],replayCalls[3]);
assert.equal(await lifecycle.remove('service'),true);
assert.equal(replayCalls.length,4);
await lifecycle.finishCreation(identity,'stable-id');
assert.equal([...memory.keys()].length,0);
console.log('PASS creation identity, ignored client timestamps, exact create/delete retry and tombstone receipt');

const sharedMemory = new Map();
const sharedJournal = {getItem:k=>sharedMemory.get(k)||null,setItem:(k,v)=>sharedMemory.set(k,v),removeItem:k=>sharedMemory.delete(k)};
const projectCalls = [];
let disconnected = true;
const projectClient = namespace => createWorshipAtomicClient({namespace,journal:sharedJournal,makeId:()=>`${namespace}-request`,
  rpc:async(name,args)=> {
    if (name === 'get_worship_service_v1') return {data:structuredClone(baseline)};
    projectCalls.push({namespace,request:structuredClone(args.req)});
    if (disconnected) throw Error('offline');
    return {data:{replayed:true,committedRevision:'2',aggregate:{...baseline,revision:'2'}}};
  }});
const projectA = projectClient('project-A'), projectB = projectClient('project-B');
await projectA.read('service'); await projectB.read('service');
await assert.rejects(projectA.commit(input),/offline/);
const projectARequest = projectA.pending('service');
assert.equal(projectB.pending('service'),null);
await assert.rejects(projectB.commit({...input,document:{sourceText:'B draft'}}),/offline/);
assert.notDeepEqual(projectB.pending('service'),projectARequest);
disconnected = false;
const reloadedA = projectClient('project-A');
assert.deepEqual(reloadedA.pending('service'),projectARequest);
await assert.rejects(reloadedA.commit(input),/RETRY_COMMITTED/);
assert.equal(projectB.pending('service').request.document.sourceText,'B draft');
assert.deepEqual(projectCalls[2].request,projectARequest.request);
assert.equal(projectCalls[2].namespace,'project-A');
sharedJournal.setItem('mindex.atomic.pending.v1:service',JSON.stringify(projectARequest));
const unknownProject = projectClient('project-C');
await unknownProject.read('service');
const priorCalls = projectCalls.length;
await assert.rejects(unknownProject.commit(input),/PENDING_PROJECT_UNKNOWN/);
assert.equal(projectCalls.length,priorCalls);
assert.ok(sharedJournal.getItem('mindex.atomic.pending.v1:service'));
console.log('PASS project-scoped durable retries survive reload, preserve sibling project requests and block unscoped legacy replay');

const remoteJournalMap = new Map();
const remoteJournal = {getItem:k=>remoteJournalMap.get(k)||null,setItem:(k,v)=>remoteJournalMap.set(k,v),removeItem:k=>remoteJournalMap.delete(k)};
const remoteClient = createWorshipAtomicClient({journal:remoteJournal,rpc:async()=>{throw Error('offline')}});
remoteClient.adoptRemote('service',baseline);
remoteClient.adoptRemote('service',{...baseline,revision:'3'});
assert.equal(remoteClient.baseline('service').revision,'3');
assert.throws(()=>remoteClient.adoptRemote('service',baseline),/STALE_REMOTE/);
assert.throws(()=>remoteClient.adoptRemote('other',baseline),/INVALID_REMOTE/);
assert.throws(()=>remoteClient.adoptRemote('service',{...baseline,elements:null}),/INVALID_REMOTE/);
await assert.rejects(remoteClient.commit(input),/offline/);
assert.throws(()=>remoteClient.adoptRemote('service',{...baseline,revision:'4'}),/PENDING_REQUEST/);
assert.equal(remoteClient.baseline('service').revision,'3');
console.log('PASS exact remote adoption rejects stale/malformed snapshots and unresolved writes');


// Empty/non-praise services also need the native protocol, frozen before journaling.
for (const operation of ['create','commit','remove']) {
  const entries=new Map(), seen=[];let native=true;
  const fixture=createWorshipAtomicClient({usesSingleSongStorage:()=>native,makeId:()=>`native-${operation}`,
    journal:{getItem:k=>entries.get(k)||null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)},
    rpc:async(name,args)=>{if(name==='get_worship_service_v1')return {data:structuredClone(baseline)};seen.push(structuredClone(args.req));throw Error('offline');}});
  await fixture.read('service');
  const run=()=>operation==='create'?fixture.create({service:baseline.service,rows:{sections:[],elements:[]},document:{sourceText:'empty'}})
    :operation==='commit'?fixture.commit(input):fixture.remove('service');
  await assert.rejects(run(),/offline/);
  assert.equal(seen[0].singleSongProtocol,1);
  assert.equal(fixture.pending('service').request.singleSongProtocol,1);
  native=false;
  await assert.rejects(run(),/offline/);
  assert.deepEqual(seen[1],seen[0]);
}
console.log('PASS native empty-service create/save/delete and immutable protocol retry');

// A JSONB round trip reorders object keys, but not song-form/medley arrays.
// Editing one person must not update every element's unchanged nested config.
{
  const config = {inputMode:'lyrics_db',formPreset:{forms:['V1','V2','V1'],strength:'manual'},
    connectedPraise:{itemIds:['a','b'],primaryItemId:'a'},audioTiming:{cues:[{at:0,slide:0},{at:8,slide:1}]}};
  const reorder = value => Array.isArray(value) ? value.map(reorder)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).reverse().map(([k,v])=>[k,reorder(v)])) : value;
  const base = {revision:'1',service:{id:'s',source_ref:{a:1,b:2}},
    sections:[{id:'sec',service_id:'s',config:{a:1,b:2}}],
    elements:Array.from({length:24},(_,i)=>({id:'e'+i,section_id:'sec',person:'',config:reorder(config),source_ref:{b:2,a:1}}))};
  const rows={sections:[{...base.sections[0],config:{b:2,a:1}}],
    elements:base.elements.map((e,i)=>({...e,person:i===2?'Edited':'',config:structuredClone(config),source_ref:{a:1,b:2}}))};
  const before=structuredClone({base,rows});
  const patch=prepareWorshipRowsCommit({serviceId:'s',baseline:base,rows,document:{}});
  assert.deepEqual(patch.sectionPatches,[]);
  assert.deepEqual(patch.elementPatches,[{id:'e2',patch:{person:'Edited'}}]);
  assert.deepEqual({base,rows},before);
  rows.elements[3].config.formPreset.forms=['V2','V1','V1'];
  rows.elements[4].config.connectedPraise.itemIds=['b','a'];
  rows.elements[5].config.audioTiming.cues[1].at=9;
  delete rows.elements[6].config.inputMode;
  const changed=prepareWorshipRowsCommit({serviceId:'s',baseline:base,rows,document:{}});
  assert.deepEqual(changed.elementPatches.map(p=>p.id),['e2','e3','e4','e5','e6']);
  assert.deepEqual(changed.elementPatches.at(-1).removeKeys,{config:['inputMode']});
  console.log('PASS JSONB key order skips 23 redundant writes; ordered forms/medleys/timing and removals remain changes');
}
{
  const memory=new Map();let fail=true, writes=0;
  const c=createWorshipAtomicClient({journal:{getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)},
    makeId:()=> 'timeout-'+(++writes), rpc:async(name)=>name==='get_worship_service_v1'?{data:structuredClone(baseline)}:
      fail?{error:{code:'57014',message:'canceling statement due to statement timeout'}}:
      {data:{aggregate:{...baseline,revision:'2'},committedRevision:'2',replayed:false}}});
  await c.read('service');const draft=structuredClone(input);
  await assert.rejects(c.commit(draft),e=>e.code==='57014');
  assert.equal(c.pending('service'),null);assert.equal(c.baseline('service').revision,'1');
  assert.deepEqual(draft,input);fail=false;await c.commit(draft);
  assert.equal(c.baseline('service').revision,'2');assert.equal(c.pending('service'),null);
  console.log('PASS proven SQL timeout preserves draft/baseline and permits explicit retry');
}
