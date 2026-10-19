import {createServerState} from './mindex.server-state.mjs';
const kinds=new Set(['praise','scripture','service','references','bulletin','bulletin-template']);
export function validHandoff(value,project){return value?.schema===1&&value.project===project&&kinds.has(value.kind)&&typeof value.id==='string'&&value.id.length>0&&typeof value.author==='string'&&typeof value.updatedAt==='number'&&value.draft&&typeof value.draft==='object';}
export function createDraftHandoff({rpc,token,project,author,changed=()=>{},announce=()=>{}}){
 const store=createServerState({rpc,token,scope:'device'}),queue=new Map(),sent=new Map();
 let ready=false,busy=null,error=null,read=null;
 const prefix='mindex.handoff.draft.v1:';
 async function keyFor(kind,id){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(kind+':'+id));return prefix+author+':'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}
 async function refresh(){
  if(busy||store.pending)return false;
  if(read)return read;
  read=store.load().then(()=>{ready=true;error=null;changed();return true}).catch(e=>{error=e;changed();throw e}).finally(()=>{read=null});return read;
 }
 function publish(kind,id,draft,label=''){
  const serialized=JSON.stringify(draft),identity=kind+':'+id;
  if(!kinds.has(kind)||!id)throw Error('INVALID_HANDOFF');
  if(sent.get(identity)===serialized||queue.get(identity)?.serialized===serialized)return;
  queue.set(identity,{kind,id,draft:structuredClone(draft),label:String(label).slice(0,160),serialized,updatedAt:Date.now()});changed();
 }
 async function flush(){
  if(busy)return busy;
  busy=(async()=>{
   if(read)await read;
   if(!ready){await store.load();ready=true;}
   for(const key of store.pendingKeys())await store.retry(key);
   for(const [identity,item] of [...queue]){
    const key=await keyFor(item.kind,item.id);
    await store.setItem(key,JSON.stringify({schema:1,project,author,...item,serialized:undefined}));
    sent.set(identity,item.serialized);if(queue.get(identity)===item)queue.delete(identity);
    announce();
   }
   error=null;
  })().catch(e=>{error=e;throw e}).finally(()=>{busy=null;changed();});return busy;
 }
 function list(kind,id){if(!ready)return [];return store.keys().filter(k=>k.startsWith(prefix)).flatMap(key=>{
  try{const value=JSON.parse(store.getItem(key));return validHandoff(value,project)&&(!kind||value.kind===kind)&&(!id||value.id===id)?[{...value,key}]:[]}catch{return []}
 }).sort((a,b)=>b.updatedAt-a.updatedAt);}
 return {refresh,publish,flush,list,get pending(){return queue.size>0||store.pending||!!busy},get error(){return error},get ready(){return ready}};
}
