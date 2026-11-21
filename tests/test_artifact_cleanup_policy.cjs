// Execute the actual workflow policy against disposable synthetic metadata only.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../.github/workflows/artifact-cleanup.yml'),'utf8');
const script=source.split('          script: |\n')[1]?.split('\n').map(line=>line.slice(12)).join('\n');
assert(script,'cleanup workflow script must be present');
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
const policy=new AsyncFunction('github','context','core',script);
const size=100*1024*1024;
const old=new Date(Date.now()-60*60*1000).toISOString();
const row=(id,changes={})=>({id,name:'mindex-mac-internal',size_in_bytes:size,updated_at:old,expired:false,workflow_run:{id:101},...changes});
function fixture(artifacts,{statuses={},readError=false,deleteError=false}={}){
 const calls={reads:[],deletes:[],notices:[]};
 const actions={listArtifactsForRepo(){},async getWorkflowRun({run_id}){
  calls.reads.push(run_id);if(readError)throw Error('status read failed');
  return {data:{status:statuses[run_id]||'completed'}};
 },async deleteArtifact({artifact_id}){
  calls.deletes.push(artifact_id);if(deleteError)throw Error('delete failed');
 }};
 const github={rest:{actions},async paginate(api,options){
  assert.equal(api,actions.listArtifactsForRepo);assert.equal(options.owner,'fixture');
  assert.equal(options.repo,'disposable');return artifacts;
 }};
 const summary={addHeading(){return this;},addTable(){return this;},async write(){}};
 return {calls,execute:()=>policy(github,{repo:{owner:'fixture',repo:'disposable'},runId:777},{summary,notice:value=>calls.notices.push(value)})};
}
test('cleanup deletes only old large completed build duplicates; retains active runs, receipts and unknown files',async()=>{
 const f=fixture([
  row(1),row(2,{name:'github-pages'}),
  row(3,{name:'published-upgrade-intel'}),row(4,{name:'release-timing-123-1'}),
  row(5,{name:'mindex-mac-internal-extra'}),row(6,{size_in_bytes:size-1}),
  row(7,{updated_at:new Date().toISOString()}),row(8,{expired:true}),
  row(9,{workflow_run:{id:202}}),row(10,{workflow_run:{id:777}}),
  row(11,{workflow_run:null}),row(12,{workflow_run:{id:303}}),
 ],{statuses:{202:'in_progress',303:'queued'}});
 await f.execute();
 assert.deepEqual(f.calls.deletes,[1,2]);
 assert.deepEqual(f.calls.reads,[101,202,303]);
 assert.match(f.calls.notices[0],/Deleted 2 completed large artifacts/);
});
test('unknown run status and deletion failures stop cleanup rather than reporting success',async()=>{
 const unknown=fixture([row(1)],{readError:true});
 await assert.rejects(unknown.execute(),/status read failed/);
 assert.deepEqual(unknown.calls.deletes,[]);assert.deepEqual(unknown.calls.notices,[]);
 const failed=fixture([row(1),row(2)],{deleteError:true});
 await assert.rejects(failed.execute(),/delete failed/);
 assert.deepEqual(failed.calls.deletes,[1]);assert.deepEqual(failed.calls.notices,[]);
});
