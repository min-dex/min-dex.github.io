import {openRemote} from './mindex.remote-session.mjs?v=7';
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

export function createOutputRegistry(context,{interval=2000}={}){
 let record=null,busy=false,closed=false,retryAt=0;
 function remove(old){
  if(!old)return;old.session?.close();
  void adminRpc(old.client,'mindex_remote_output',{p_action:'remove',p_id:old.id,p_token:old.token}).catch(()=>{});
 }
 async function tick(){
  if(busy||closed||Date.now()<retryAt)return;busy=true;
  try{
   const c=context();
   if(record&&(!c||record.key!==c.key||record.client!==c.client)){const old=record;record=null;remove(old);}
   if(!c)return;
   if(!record){
    const r=await adminRpc(c.client,'mindex_remote_output',{p_action:'register'});
    const fresh=context();
    const next={...r,client:c.client,key:c.key,adapter:c.adapter,session:null,link:null,seen:0};
    if(closed||fresh?.key!==c.key||fresh?.client!==c.client){remove(next);return;}
    record=next;
   }
   const r=record;
   const value=await adminRpc(c.client,'mindex_remote_output',{p_action:'tick',p_id:r.id,p_token:r.token,p_info:c.info,p_ready:r.session?.listening?r.link:null});
   if(closed||record!==r)return;
   r.seen=performance.now();
   if(r.link!==value.link?.id){r.session?.close();r.session=null;r.link=value.link?.id||null;}
   if(value.link&&!r.session){
    const link=value.link.id;
    r.session=await openRemote({client:c.client,host:true,registration:relayRegistration(value.link.secret),
     read:()=>{const current=context();const s=r.adapter.read();return {...s,live:s.live&&current?.key===r.key&&current?.client===r.client&&performance.now()-r.seen<6000};},
     execute:r.adapter.execute,onClose:()=>{
      if(r.link===link){r.session=null;r.link=null;}
      void adminRpc(r.client,'mindex_remote_output',{p_action:'unlink',p_id:r.id,p_token:r.token,p_ready:link}).catch(()=>{});
     }});
   }
  }catch{const old=record;record=null;remove(old);retryAt=Date.now()+10000;}finally{busy=false;}
 }
 const timer=setInterval(tick,interval);void tick();
 return {close(){closed=true;clearInterval(timer);const old=record;record=null;remove(old);},tick};
}
