// Server-confirmed persistence. Memory is a read mirror, never durable fallback.
export function createServerState({rpc,token,scope,makeId=()=>crypto.randomUUID()}) {
 const rows=new Map(),uncertain=new Map(),running=new Map(),conflicts=new Map();let loaded=false,loading=false,loadBarrier=null;
 const validate=row=>row&&typeof row.key==='string'&&(row.value===null||typeof row.value==='string')
  &&/^[1-9][0-9]*$/.test(row.revision)&&typeof row.requestId==='string';
 async function load(){
  if(loading||running.size||uncertain.size)throw Error('STATE_PENDING');
  loading=true;
  let release;loadBarrier=new Promise(resolve=>{release=resolve});
  try{
  const {data,error}=await rpc('mindex_state_read_v1',{p_token:token,p_scope:scope});
  if(error)throw error;
  if(!Array.isArray(data)||data.some(r=>!validate(r))||new Set(data.map(r=>r.key)).size!==data.length)throw Error('INVALID_STATE_RESPONSE');
  const incoming=new Map(data.map(row=>[row.key,row]));
  for(const [key,previous] of rows){
   const next=incoming.get(key);
   if(!next||BigInt(next.revision)<BigInt(previous.revision))throw Error('STALE_STATE_RESPONSE');
  }
  rows.clear();data.forEach(r=>rows.set(r.key,{...r}));loaded=true;
  }finally{loading=false;release();loadBarrier=null}
 }
 function getItem(key){if(!loaded)throw Error('STATE_NOT_READY');return rows.get(key)?.value??null;}
 async function transmit(key, reconcile=true){
  const request=uncertain.get(key);if(!request)throw Error('NO_STATE_REQUEST');
  const {data,error}=await rpc('mindex_state_write_v1',request);
  if(error){
   // A newer revision can contain the very same value (e.g. a cleared journal).
   // Reconcile only an explicitly rejected CAS, never an uncertain network write.
   if(error.message==='STATE_REVISION_CONFLICT')conflicts.set(key,request.p_request_id);
   if(reconcile&&error.message==='STATE_REVISION_CONFLICT'){
    const latest=await rpc('mindex_state_read_v1',{p_token:token,p_scope:scope});
    if(latest.error)throw latest.error;
    if(!Array.isArray(latest.data)||latest.data.some(r=>!validate(r))||new Set(latest.data.map(r=>r.key)).size!==latest.data.length)throw Error('INVALID_STATE_RESPONSE');
    const row=latest.data.find(r=>r.key===key),previous=rows.get(key);
    if(!row||(previous&&BigInt(row.revision)<BigInt(previous.revision)))throw error;
    if(row.value===request.p_value){rows.set(key,{...row});uncertain.delete(key);conflicts.delete(key);return true;}
    if(row.value===(previous?.value??null)){
     rows.set(key,{...row});
     uncertain.set(key,{...request,p_revision:row.revision,p_request_id:makeId()});
     return transmit(key,false);
    }
   }
   throw error;
  }
  if(!validate(data)||data.key!==key||data.value!==request.p_value||data.requestId!==request.p_request_id
   ||BigInt(data.revision)!==BigInt(request.p_revision)+1n)throw Error('INVALID_STATE_RECEIPT');
  rows.set(key,{...data});uncertain.delete(key);conflicts.delete(key);return true;
 }
 function exclusive(key,task){
  if(running.has(key))return Promise.reject(Error('STATE_WRITE_IN_PROGRESS'));
  const promise=Promise.resolve().then(task).finally(()=>running.delete(key));running.set(key,promise);return promise;
 }
 function setItem(key,value){if(typeof key!=='string'||!key)return Promise.reject(Error('INVALID_STATE_KEY'));return exclusive(key,async()=>{
  if(loadBarrier)await loadBarrier;
  if(!loaded)throw Error('STATE_NOT_READY');
  if(uncertain.has(key))throw Error('STATE_RETRY_REQUIRED');
  const next=value===null?null:String(value),previous=rows.get(key);
  if(previous&&previous.value===next)return true;
  uncertain.set(key,{p_token:token,p_scope:scope,p_key:key,p_value:next,p_revision:previous?.revision||'0',p_request_id:makeId()});
  return transmit(key);
 });}
 async function reviewConflict(key){
  const request=uncertain.get(key);
  if(!request||conflicts.get(key)!==request.p_request_id)throw Error('STATE_CONFLICT_NOT_CONFIRMED');
  const {data,error}=await rpc('mindex_state_read_v1',{p_token:token,p_scope:scope});
  if(error)throw error;
  if(!Array.isArray(data)||data.some(r=>!validate(r))||new Set(data.map(r=>r.key)).size!==data.length)throw Error('INVALID_STATE_RESPONSE');
  const row=data.find(r=>r.key===key),previous=rows.get(key);
  if(!row||(previous&&BigInt(row.revision)<BigInt(previous.revision)))throw Error('STALE_STATE_RESPONSE');
  return {key,requestId:request.p_request_id,local:request.p_value,current:row.value,revision:row.revision};
 }
 function resolveConflict(review,choice,localValue=review.local){return exclusive(review.key,async()=>{
  if(!['current','local'].includes(choice)||(localValue!==null&&typeof localValue!=='string'))throw Error('INVALID_STATE_CHOICE');
  // Atomic requests must first be resolved through the worship receipt path.
  if(/^mindex\.atomic\./.test(review.key)&&choice!=='current')throw Error('ATOMIC_REQUEST_REQUIRES_REVIEW');
  const latest=await reviewConflict(review.key);
  if(JSON.stringify(latest)!==JSON.stringify(review))throw Error('STATE_CONFLICT_CHANGED');
  const request=uncertain.get(review.key);
  rows.set(review.key,{key:review.key,value:review.current,revision:review.revision,requestId:''});
  if(choice==='current'){uncertain.delete(review.key);conflicts.delete(review.key);return true;}
  uncertain.set(review.key,{...request,p_value:localValue,p_revision:review.revision,p_request_id:makeId()});
  conflicts.delete(review.key);
  return transmit(review.key);
 });}
 return {load,getItem,setItem,reviewConflict,resolveConflict,conflictKeys:()=>[...conflicts.keys()],removeItem:key=>setItem(key,null),retry:key=>exclusive(key,()=>transmit(key)),
  get ready(){return loaded},get pending(){return running.size>0||uncertain.size>0},
  keys:()=>[...rows.keys()],pendingKeys:()=>[...uncertain.keys()]};
}
