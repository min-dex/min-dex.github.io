/* Local-only, read-only rehearsal. Takes explicit private artifact paths; no network. */
'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const [catalogPath,planPath]=process.argv.slice(2);
if(!catalogPath||!planPath)throw Error('Provide catalog.private.json and plan.json');
const bytes=fs.readFileSync(catalogPath),records=JSON.parse(bytes),plan=JSON.parse(fs.readFileSync(planPath));
const byId=new Map(records.map(r=>[r.id,r]));assert.equal(byId.size,records.length);
const reserved=new Set();
for(const r of plan.records)if(r.idCandidate)reserved.add(r.idCandidate);
// Include retired candidates: never turn a deleted ID back into a new allocation.
for(const id of plan.summary.retiredCandidateIds||[])reserved.add(typeof id==='string'?id:id.id);
let groups=0,related=0;
for(const r of records){
 assert(reserved.has(r.id),'record absent from frozen plan');
 assert(Array.isArray(r.relations?.same_song)&&Array.isArray(r.relations?.related));
 for(const key of ['same_song','related']){
  const targets=r.relations[key];assert.equal(new Set(targets).size,targets.length);
  for(const id of targets){assert(id!==r.id&&byId.has(id),'dangling/self link');
   if(key==='same_song')assert.deepEqual([...byId.get(id).relations.same_song,id].sort(),[...targets,r.id].sort(),'group is not a complete symmetric set');
   else related++;
  }
 }
 if(r.relations.same_song.length&&[r.id,...r.relations.same_song].sort()[0]===r.id)groups++;
 // Shadow roundtrip: serialize/load/store without changing any protected payload.
 const roundtrip=JSON.parse(JSON.stringify(r));assert.deepEqual(roundtrip.content,r.content);assert.deepEqual(roundtrip.legacy,r.legacy);
}
const counters={};for(const id of reserved){const m=/^((?:ccm|kid))-(\d+)$/.exec(id||'');if(m)counters[m[1]]=Math.max(counters[m[1]]||0,Number(m[2]));}
assert.deepEqual(fs.readFileSync(catalogPath),bytes);
console.log(JSON.stringify({status:'PASS',catalogSha256:crypto.createHash('sha256').update(bytes).digest('hex'),records:records.length,sameSongGroups:groups,relatedEdges:related,reservedIds:reserved.size,nextNumbers:Object.fromEntries(Object.entries(counters).map(([k,v])=>[k,v+1])),productionWrites:0,scope:'offline graph/payload/allocator rehearsal; no production migration'},null,2));
