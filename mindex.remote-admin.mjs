import {openRemote} from './mindex.remote-session.mjs?v=8';
const messages={expired:'관리자 접속이 만료됐어요. PIN을 다시 입력해 주세요.',invalid_pin:'PIN을 확인해 주세요.',locked:'입력 횟수를 초과했어요. 15분 뒤 다시 시도해 주세요.',offline:'송출 PC의 응답이 없어요.',busy:'이미 연결 중이에요. 기존 연결을 종료한 뒤 다시 선택해 주세요.',unavailable:'관리자 연결을 아직 사용할 수 없어요.'};
export async function adminRpc(client,name,args){
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),5000);
 try{
  let request=client.rpc(name,args);if(request.abortSignal)request=request.abortSignal(abort.signal);
  const result=await Promise.race([request,new Promise((_,reject)=>abort.signal.addEventListener('abort',()=>reject(Error('연결 확인 시간이 지났어요.')),{once:true}))]);
  if(result?.error)throw Error('서버에 연결할 수 없어요.');
  if(!result?.data?.ok){const e=Error(messages[result?.data?.error]||'연결을 확인할 수 없어요.');e.code=result?.data?.error;throw e;}
  return result.data;
 }finally{clearTimeout(timer);}
}
export const relayRegistration=secret=>({secret,code:'',revoke:async()=>{}});

export function createOutputRegistry(context,{interval=2000,onUpdate=()=>{}}={}){
 let record=null,busy=false,closed=false,paused=false,retryAt=0;
 const update=()=>onUpdate({code:record?.code||'',connected:!!record?.guest?.session?.connected,available:!!record&&record.seen>0&&performance.now()-record.seen<6000});
 function rememberClosed(r,kind,id){r.closedLinks.add(kind+':'+id);if(r.closedLinks.size>128)r.closedLinks.delete(r.closedLinks.values().next().value);}
 function stopSlot(r,kind){const slot=r[kind];r[kind]=null;if(slot)rememberClosed(r,kind,slot.id);slot?.session?.close();}
 function remove(old){
  if(!old)return;stopSlot(old,'admin');stopSlot(old,'guest');
  void adminRpc(old.client,'mindex_remote_output',{p_action:'remove',p_id:old.id,p_token:old.token}).catch(()=>{});
 }
 async function syncSlot(r,c,kind,link){
  if(paused||closed)return;
  if(link&&r.closedLinks.has(kind+':'+link.id)){await adminRpc(r.client,'mindex_remote_output',{p_action:kind==='guest'?'unlink_guest':'unlink',p_id:r.id,p_token:r.token,p_ready:link.id});return;}
  if(r[kind]?.id!==link?.id)stopSlot(r,kind);
  if(!link||r[kind])return;
  const slot={id:link.id,session:null};r[kind]=slot;
  const a=kind==='guest'?(r.guestAdapter||r.adapter):r.adapter;
  slot.session=await openRemote({client:c.client,host:true,registration:relayRegistration(link.secret),
   read:()=>{const current=context();const s=a.read();return {...s,live:s.live&&current?.key===r.key&&current?.client===r.client&&performance.now()-r.seen<6000};},
   execute:a.execute,onStatus:update,onClose:()=>{
    rememberClosed(r,kind,slot.id);if(r[kind]===slot)r[kind]=null;update();
    void adminRpc(r.client,'mindex_remote_output',{p_action:kind==='guest'?'unlink_guest':'unlink',p_id:r.id,p_token:r.token,p_ready:link.id}).catch(()=>{});
   }});
  if(paused||closed||record!==r||r[kind]!==slot)slot.session.close();
 }
 async function tick(){
  if(busy||closed||paused||Date.now()<retryAt)return;busy=true;
  try{
   const c=context();
   if(record&&(!c||record.key!==c.key||record.client!==c.client)){const old=record;record=null;remove(old);update();}
   if(!c)return;
   if(!record){
    const r=await adminRpc(c.client,'mindex_remote_output',{p_action:'register'});
    const fresh=context();
    const next={...r,client:c.client,key:c.key,adapter:c.adapter,guestAdapter:c.guestAdapter,admin:null,guest:null,closedLinks:new Set(),seen:0};
    if(closed||fresh?.key!==c.key||fresh?.client!==c.client){remove(next);return;}
    record=next;update();if(paused)return;
   }
   const r=record;
   const value=await adminRpc(c.client,'mindex_remote_output',{p_action:'tick',p_id:r.id,p_token:r.token,p_info:{...c.info,guestReady:r.guest?.session?.listening?r.guest.id:null},p_ready:r.admin?.session?.listening?r.admin.id:null});
   if(closed||paused||record!==r)return;
   r.seen=performance.now();r.code=value.code||r.code;
   await syncSlot(r,c,'admin',value.link);await syncSlot(r,c,'guest',value.guest);update();
  }catch(e){
   if(record){stopSlot(record,'admin');stopSlot(record,'guest');}
   if(e.code==='expired'){const old=record;record=null;remove(old);}
   // A short outage must not create a replacement output/code. Retry the same owner.
   update();retryAt=Date.now()+3000;
  }finally{busy=false;}
 }
 let timer=setInterval(tick,interval);void tick();
 return {close(){closed=true;clearInterval(timer);const old=record;record=null;remove(old);update();},tick,
  suspend(){paused=true;clearInterval(timer);if(record){record.seen=0;stopSlot(record,'admin');stopSlot(record,'guest');}update();},
  resume(){if(closed||!paused)return;paused=false;timer=setInterval(tick,interval);return tick();},
  async disconnectGuest(){const r=record,s=r?.guest;if(!s)return;await s.session?.end();},
 };
}
