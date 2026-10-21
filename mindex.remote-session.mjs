import {pairing,identity,sessionKey,seal,unseal,id,createGate} from './mindex.remote-core.mjs';

// The relay carries ciphertext only. A code grants one ephemeral controller.
export async function openRemote({client,code,host=false,read,execute,onState=()=>{},onStatus=()=>{},onResult=()=>{},onClose=()=>{}}){
 const pair=await pairing(code),keys=await identity(),peer=id(),nonce=id();
 const gate=host?createGate({read,execute}):null;
 let channel,key,other,closed=false,ready=false,subscribed=false,reserved=false;
 let outgoing=0,incoming=0,sequence=0,lastSeen=performance.now(),snapshot=null,pending=null;
 let timer,expiry,ackTimer,queue=Promise.resolve(),queued=0,rateAt=0,rate=0;
 let freshRequest=id(),fresh=false;
 const born=performance.now();
 const status=s=>{if(!closed)onStatus(s);};
 async function send(message,pairMode=false){
  if(closed||!subscribed)return;
  const box=await seal(pairMode?pair.key:key,{...message,peer,seq:++outgoing},pair.topic);
  if(closed)return;
  const result=await channel.send({type:'broadcast',event:'packet',payload:{mode:pairMode?'pair':'session',box}});
  if(result!=='ok')throw Error('연결이 끊겼습니다. 새 코드로 다시 연결해 주세요.');
 }
 function close(reason='연결이 종료됐습니다.'){
  if(closed)return;closed=true;ready=false;fresh=false;snapshot=null;
  clearInterval(timer);clearTimeout(expiry);clearTimeout(ackTimer);gate?.close();
  Promise.resolve(client.removeChannel(channel)).catch(()=>{});onStatus(reason);onState(null);onClose();
 }
 async function end(){try{if(ready)await send({type:'end'});}catch{}finally{close();}}
 async function publish(request=''){
  if(!host||!ready)return;
  try{await send({type:'state',request,snapshot:gate.snapshot()});}catch(e){close(e.message);}
 }
 async function receive(packet){
  if(closed||!packet||!['pair','session'].includes(packet.mode))return;
  let m;try{m=await unseal(packet.mode==='pair'?pair.key:key,packet.box,pair.topic);}catch{return;}
  if(closed||!m||typeof m.peer!=='string'||m.peer.length>64||!Number.isSafeInteger(m.seq))return;
  if(packet.mode==='pair'){
   if(host&&m.type==='hello'&&!reserved&&performance.now()-born<120000){
    reserved=true;other=m.peer;
    try{key=await sessionKey(keys.privateKey,m.publicKey,pair.topic+':'+m.nonce);
     await send({type:'welcome',to:other,nonce:m.nonce,publicKey:keys.publicKey},true);
     clearTimeout(expiry);expiry=setTimeout(()=>close('연결 확인 시간이 지났습니다. 새 코드를 만들어 주세요.'),10000);
    }catch{close('연결 코드 확인에 실패했습니다.');}
   }else if(!host&&!key&&m.type==='welcome'&&m.to===peer&&m.nonce===nonce){
    other=m.peer;key=await sessionKey(keys.privateKey,m.publicKey,pair.topic+':'+nonce);
    await send({type:'ready',request:freshRequest});
   }
   return;
  }
  if(m.peer!==other||m.seq<=incoming)return;incoming=m.seq;lastSeen=performance.now();
  if(m.type==='end'){close('상대 기기에서 연결을 종료했습니다.');return;}
  if(host){
   if(m.type==='ready'&&!ready){gate.connect(other);ready=true;clearTimeout(expiry);status('리모컨 연결됨');await publish(m.request);}
   else if(ready&&m.type==='ping')await publish(m.request);
   else if(ready&&m.type==='command'){
    let result;try{result=await gate.command(other,m.command);}catch(e){result={id:m.command?.id,ok:false,message:e.message};}
    await send({type:'result',result});await publish();
   }
  }else if(m.type==='state'){
   if(!m.snapshot?.state||typeof m.snapshot.ticket!=='string')return;
   ready=true;clearTimeout(expiry);snapshot=m.snapshot;
   if(m.request===freshRequest)fresh=true;
   onState(snapshot.state);status(fresh?'연결됨':'최신 상태 확인 중');
  }else if(m.type==='result'&&pending===m.result?.id){
   pending=null;clearTimeout(ackTimer);onResult(m.result);
  }
 }
 channel=client.channel(pair.topic,{config:{broadcast:{self:false,ack:true}}})
  .on('broadcast',{event:'packet'},({payload})=>{
   const t=performance.now();if(t-rateAt>1000){rateAt=t;rate=0;}
   if(++rate>40||queued>=20)return;
   queued++;queue=queue.then(()=>receive(payload)).catch(e=>close(e.message)).finally(()=>queued--);
  });
 channel.subscribe(s=>{
  if(closed)return;
  if(s==='SUBSCRIBED'){
   subscribed=true;status(host?'코드를 입력하면 바로 연결됩니다.':'송출 PC를 찾는 중');
   if(!host)send({type:'hello',nonce,publicKey:keys.publicKey},true).catch(e=>close(e.message));
  }else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(s))close('연결이 끊겼습니다. 새 코드로 다시 연결해 주세요.');
 });
 expiry=setTimeout(()=>close('연결 코드가 만료됐습니다. 새 코드를 만들어 주세요.'),host?120000:15000);
 timer=setInterval(()=>{
  if(closed)return;
  if(performance.now()-born>8*3600000)return close('연결 시간이 만료됐습니다.');
  if(host){
   try{if(!read()?.live)return close('송출 종료 또는 예배 변경으로 연결이 종료됐습니다.');}catch{return close();}
   if(ready&&performance.now()-lastSeen>10000)return close('리모컨 응답이 없어 연결을 종료했습니다.');
   void publish();
  }else if(ready){
   if(performance.now()-lastSeen>3000){fresh=false;freshRequest=id();status('연결 확인 중 · 조작 잠김');}
   if(performance.now()-lastSeen>10000)return close('송출 PC 응답이 없습니다. 새 코드로 연결해 주세요.');
   send({type:'ping',request:freshRequest}).catch(e=>close(e.message));
  }
 },1000);
 return {
  close,end,
  get connected(){return ready&&!closed;},
  get usable(){return ready&&fresh&&!closed&&!pending&&performance.now()-lastSeen<=2500;},
  refresh(){fresh=false;freshRequest=id();if(ready)send({type:'ping',request:freshRequest}).catch(e=>close(e.message));},
  async command(action){
   if(!this.usable)throw Error('최신 연결 상태를 확인한 뒤 눌러 주세요.');
   const command={id:id(),action,sequence:++sequence,epoch:snapshot.epoch,revision:snapshot.revision,ticket:snapshot.ticket};
   pending=command.id;
   ackTimer=setTimeout(()=>{pending=null;fresh=false;freshRequest=id();onResult({ok:false,message:'실행 여부를 확인할 수 없습니다. 현재 화면을 확인해 주세요.'});},3000);
   try{await send({type:'command',command});}catch(e){close(e.message);throw e;}
  }
 };
}
