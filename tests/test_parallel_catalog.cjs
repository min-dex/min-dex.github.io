const assert=require('node:assert/strict');
const api=require('../mindex.single-song.js');
const row=id=>({id,revision:1,metadata:{title:id},content:{name:'기본',forms:[]},relations:{same_song:[],related:[]}});
const records=[...Array.from({length:217},(_,i)=>row(`SONG-CONT-${String(i+1).padStart(4,'0')}-0001`)),...Array.from({length:237},(_,i)=>row(`SONG-HYMN-N${String(i+1).padStart(3,'0')}-0001`)),...Array.from({length:223},(_,i)=>row(`SONG-HYMN-T${String(i+1).padStart(3,'0')}-0001`)),row('knh-001')];
function fixture({rows=records,damage='',timeout=false}={}) {
 let active=0,peak=0,statusCalls=0;const calls=[];
 const status={protocol:1,idFormat:'4-4-4-4',phase:'native',epoch:'1',manifest:'fixture',recordCount:rows.length};
 return {calls,get peak(){return peak},get active(){return active},rpc:async(name,args)=>{
  if(name==='get_praise_storage_status_v1'){statusCalls++;return {data:{...status,manifest:damage==='drift'&&statusCalls>1?'changed':status.manifest}}}
  calls.push({...args});active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,1));active--;
  if(timeout&&args.after_id==='SONG-HYMN-N'&&args.page_size>25)return {error:{code:'57014'}};
  if(damage==='network'&&args.after_id==='SONG-HYMN-N')return {error:{code:'network'}};
  let page=structuredClone(rows.filter(r=>!args.after_id||r.id>args.after_id).slice(0,args.page_size));
  if(damage==='duplicate'&&args.after_id===null)page[1]=structuredClone(page[0]);
  if(damage==='omit'&&args.after_id===null)page.shift();
  if(damage==='invalid-overlap'&&args.after_id===null)page.at(-1).id='bad';
  return {data:{records:page,after:page.at(-1)?.id??null,epoch:'1',manifest:damage==='manifest'?'bad':'fixture'}};
 }};
}
(async()=>{
 const client=fixture();const [a,b]=await Promise.all([api.loadActivation(client),api.loadActivation(client)]);
 assert.deepEqual(a.records,records);assert.deepEqual(b.records,records);assert.equal(client.peak,3);assert.equal(client.calls.length,6);
 a.records[0].metadata.title='draft';assert.notEqual(b.records[0].metadata.title,'draft');
 const small=fixture({rows:records.slice(0,201)});assert.deepEqual((await api.loadActivation(small)).records,records.slice(0,201));assert.equal(small.peak,1);assert.equal(small.calls.length,2);
 const sparseRows=Array.from({length:438},(_,i)=>row(`SONG-HYMN-N${String(i+1).padStart(3,'0')}-0001`));
 const sparse=fixture({rows:sparseRows});assert.deepEqual((await api.loadActivation(sparse)).records,sparseRows);
 const retry=fixture({timeout:true});assert.deepEqual((await api.loadActivation(retry)).records,records);
 assert.deepEqual(retry.calls.filter(c=>c.after_id==='SONG-HYMN-N').map(c=>c.page_size),[200,100,25]);
 for(const damage of ['network','duplicate','omit','invalid-overlap','manifest','drift']){const f=fixture({damage});await assert.rejects(api.loadActivation(f),undefined,damage);assert.equal(f.active,0,'failed activation left running workers');}
 console.log('PASS full parallel catalog equality, three-worker bound, coalescing, sparse ranges, ordered IDs, same-cursor fallback and fail-closed drift/corruption');
})().catch(e=>{console.error(e);process.exitCode=1});
