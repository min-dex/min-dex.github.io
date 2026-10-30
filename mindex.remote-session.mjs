import {pairing,identity,sessionKey,seal,unseal,id,createGate} from './mindex.remote-core.mjs?v=10';
import {obtainPairing} from './mindex.remote-pairing.mjs?v=4';

// The relay carries ciphertext only. A code grants one ephemeral controller.
export async function openRemote({client,code,host=false,registration:providedRegistration,read,execute,browse,onSlides=()=>{},onState=()=>{},onStatus=()=>{},onResult=()=>{},onClose=()=>{}}){
 const registration=providedRegistration||await obtainPairing(client,host,code);
 let pair,keys;try{pair=await pairing(registration.secret);keys=await identity();}catch(e){await registration.revoke();throw e;}
 const peer=id(),nonce=id();
 const gate=host?createGate({read,execute}):null;
 let channel,key,other,closed=false,ending=false,ready=false,subscribed=false,reserved=false;
 let outgoing=0,incoming=0,sequence=0,lastSeen=performance.now(),snapshot=null,pending=null;
 let timer,expiry,ackTimer,queue=Promise.resolve(),queued=0,rateAt=0,rate=0;
 let freshRequest=id(),fresh=false,changeTimer=null,lastState='',sendQueue=Promise.resolve();
 let browseRequest='',paused=false,held=false,lastWall=Date.now(),retryTimer=null,transport=0,sendEpoch=0;
 const born=performance.now();
 const status=s=>{if(!closed)onStatus(s);};
 const transportError=(generation=transport)=>Object.assign(Error('연결 복구 중에는 조작할 수 없습니다.'),{code:'remote_transport',generation});
 function handleFailure(error){if(error?.code==='remote_transport'){if(error.generation===transport)lost();}else close(error?.message);}
 async function send(message,pairMode=false){
  if(closed||!subscribed||paused)throw transportError();
  const generation=transport;
  const epoch=sendEpoch;
  // Serialize encryption/dispatch so a newer snapshot cannot overtake a result.
  // Transport acknowledgements do not block later dispatches or shutdown.
  const dispatch=sendQueue.then(async()=>{
   if(closed||generation!==transport||epoch!==sendEpoch||!subscribed||paused)return {};
   const box=await seal(pairMode?pair.key:key,{...message,peer,seq:++outgoing},pair.topic);
   if(closed||generation!==transport||epoch!==sendEpoch||!subscribed||paused)return {};
   let ack;try{ack=channel.send({type:'broadcast',event:'packet',payload:{mode:pairMode?'pair':'session',box}});}catch{throw transportError(generation);}
   return {ack:Promise.resolve(ack).catch(()=>{throw transportError(generation);})};
  });
  sendQueue=dispatch.then(()=>{},()=>{});
  const {ack}=await dispatch;if(!ack)return;
  const result=await ack;
  if(result!=='ok')throw transportError(generation);
 }
 function close(reason='연결이 종료됐습니다.'){
  if(closed)return;closed=true;ready=false;fresh=false;snapshot=null;
  transport++;clearInterval(timer);clearTimeout(retryTimer);clearTimeout(changeTimer);clearTimeout(expiry);clearTimeout(ackTimer);gate?.close();void registration.revoke();
  if(channel)Promise.resolve().then(()=>client.removeChannel(channel)).catch(()=>{});onStatus(reason);onState(null);onClose();
 }
 function hold(){
  if(closed)return;
  browseRequest='';
  if(!held){held=true;sendEpoch++;fresh=false;freshRequest=id();gate?.invalidate();
   clearTimeout(ackTimer);
   if(pending){pending=null;onResult({ok:false,message:'연결이 끊겨 실행 여부를 확인할 수 없습니다. 명령은 다시 보내지 않습니다.'});}
  }
  status('연결 복구 중 · 조작 잠김');
 }
 function retry(){
  if(closed||paused||retryTimer!==null)return;
  retryTimer=setTimeout(()=>{retryTimer=null;if(closed||paused)return;try{bind();}catch{retry();}},1500);
 }
 function lost(){
  if(closed||ending)return;
  if(!ready){close('연결 준비에 실패했습니다. 다시 연결해 주세요.');return;}
  subscribed=false;transport++;hold();
  const old=channel;channel=null;
  Promise.resolve().then(()=>old&&client.removeChannel(old)).catch(()=>{}).then(retry);
 }
 function refresh(){
  if(ending||closed)return;
  paused=false;hold();freshRequest=id();
  if(!subscribed){retry();return;}
  if(ready){if(host)void publish();else send({type:'ping',request:freshRequest}).catch(handleFailure);}
 }
 async function end(){if(closed||ending)return;ending=true;fresh=false;sendEpoch++;gate?.close();let deadline;try{if(ready)await Promise.race([send({type:'end'}),new Promise(resolve=>{deadline=setTimeout(resolve,1000);})]);}catch{}finally{clearTimeout(deadline);close();}}
 async function publish(request='',changedOnly=false){
  if(!host||!ready||paused||!subscribed||ending)return;
  try{
   if(!read()?.live){void end();return;}
   const snapshot=gate.snapshot(),signature=JSON.stringify(snapshot.state);
   if(changedOnly&&signature===lastState)return;
   lastState=signature;await send({type:'state',request,snapshot}).catch(handleFailure);
  }catch(e){close(e.message);}
 }
 async function receive(packet){
  if(ending||closed||!packet||!['pair','session'].includes(packet.mode))return;
  let m;try{m=await unseal(packet.mode==='pair'?pair.key:key,packet.box,pair.topic);}catch{return;}
  if(ending||closed||!m||typeof m.peer!=='string'||m.peer.length>64||!Number.isSafeInteger(m.seq))return;
  if(packet.mode==='pair'){
   if(host&&m.type==='hello'&&!reserved&&performance.now()-born<120000){
    reserved=true;other=m.peer;
    try{key=await sessionKey(keys.privateKey,m.publicKey,pair.topic+':'+m.nonce);
     await send({type:'welcome',to:other,nonce:m.nonce,publicKey:keys.publicKey},true);
     clearTimeout(expiry);expiry=setTimeout(()=>close('연결 확인 시간이 지났습니다. 같은 송출 코드로 다시 연결해 주세요.'),10000);
    }catch{close('연결 코드 확인에 실패했습니다. 같은 송출 코드로 다시 연결해 주세요.');}
   }else if(!host&&!key&&m.type==='welcome'&&m.to===peer&&m.nonce===nonce){
    other=m.peer;key=await sessionKey(keys.privateKey,m.publicKey,pair.topic+':'+nonce);
    await send({type:'ready',request:freshRequest});
   }
   return;
  }
  if(m.peer!==other||m.seq<=incoming)return;incoming=m.seq;
  if(m.type==='end'){close('상대 기기에서 연결을 종료했습니다.');return;}
  if(paused)return;
  lastSeen=performance.now();lastWall=Date.now();
  if(host){
   if(m.type==='ready'&&!ready){gate.connect(other);ready=true;clearTimeout(expiry);status('리모컨 연결됨');await publish(m.request);}
   else if(ready&&m.type==='ping'){held=false;await publish(m.request);}
   else if(ready&&m.type==='browse'&&!held&&browse&&typeof m.request==='string'&&m.request.length<=64){
    const result=browse(m.options);await send({type:'slides',request:m.request,result});
   }
   else if(ready&&m.type==='command'){
    let result;try{if(held)throw Error('최신 연결 상태를 확인해 주세요.');result=await gate.command(other,m.command);}catch(e){result={id:m.command?.id,ok:false,message:e.message};}
    await send({type:'result',result});await publish();
   }
  }else if(m.type==='state'){
   if(!m.snapshot?.state||typeof m.snapshot.ticket!=='string')return;
   ready=true;clearTimeout(expiry);snapshot=m.snapshot;
   if(m.request===freshRequest){fresh=true;held=false;}
   onState(snapshot.state);status(fresh?'연결됨':'최신 상태 확인 중');
  }else if(m.type==='slides'&&fresh&&!held&&m.request===browseRequest){
   browseRequest='';onSlides(m.result);
  }else if(m.type==='result'&&pending===m.result?.id){
   pending=null;clearTimeout(ackTimer);onResult(m.result);
  }
 }
 function bind(){
 const generation=++transport;
 channel=client.channel(pair.topic,{config:{broadcast:{self:false,ack:true}}})
  .on('broadcast',{event:'packet'},({payload})=>{
   if(closed||generation!==transport)return;
   const t=performance.now();if(t-rateAt>1000){rateAt=t;rate=0;}
   if(++rate>40||queued>=20)return;
   queued++;queue=queue.then(()=>generation===transport?receive(payload):null).catch(handleFailure).finally(()=>queued--);
  });
 channel.subscribe(s=>{
  if(closed||generation!==transport)return;
  if(s==='SUBSCRIBED'){
   subscribed=true;clearTimeout(retryTimer);retryTimer=null;
   if(ready){if(!paused)refresh();return;}
   status(host?'코드를 입력하면 바로 연결됩니다.':'송출 PC를 찾는 중');
   if(!host)send({type:'hello',nonce,publicKey:keys.publicKey},true).catch(e=>close(e.message));
  }else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(s))lost();
 });
 }
 try{bind();}catch(e){close('연결 준비에 실패했습니다. 같은 송출 코드로 다시 연결해 주세요.');throw e;}
 if(closed)throw Error('연결 준비에 실패했습니다. 같은 송출 코드로 다시 연결해 주세요.');
 expiry=setTimeout(()=>close('연결 대기 시간이 지났습니다. 같은 송출 코드로 다시 연결해 주세요.'),host?120000:15000);
 timer=setInterval(()=>{
  if(ending||closed)return;
  if(performance.now()-born>8*3600000)return close('연결 시간이 만료됐습니다. 같은 송출 코드로 다시 연결해 주세요.');
  if(host){
   try{if(!read()?.live)return void end();}catch{return close();}
   if(ready&&performance.now()-lastSeen>2500)hold();
   void publish();
  }else if(ready){
   if(performance.now()-lastSeen>2500)hold();
   if(!paused&&subscribed)send({type:'ping',request:freshRequest}).catch(handleFailure);
  }
 },1000);
 return {
  close,end,refresh,code:registration.code,
  suspend(){if(closed)return;paused=true;hold();},
  offline(){if(ready)lost();},
  notify(){
   if(!host||!ready||closed||changeTimer!==null)return;
   // Coalesce a single UI operation's synchronous changes; no extra polling.
   changeTimer=setTimeout(()=>{changeTimer=null;void publish('',true);},40);
  },
  get listening(){return subscribed&&!closed;},
  get connected(){return ready&&!closed;},
  get usable(){return ready&&fresh&&subscribed&&!paused&&!held&&!closed&&!pending&&Math.max(performance.now()-lastSeen,Date.now()-lastWall)<=2500;},
  async requestSlides(options={}){
   if(!this.usable)throw Error('최신 연결 상태를 확인한 뒤 열어 주세요.');
   browseRequest=id();await send({type:'browse',request:browseRequest,options}).catch(handleFailure);
  },
  async command(action,target){
   if(!this.usable)throw Error('최신 연결 상태를 확인한 뒤 눌러 주세요.');
   const command={id:id(),action,target,sequence:++sequence,epoch:snapshot.epoch,revision:snapshot.revision,ticket:snapshot.ticket};
   pending=command.id;
   ackTimer=setTimeout(()=>{pending=null;fresh=false;freshRequest=id();onResult({ok:false,message:'실행 여부를 확인할 수 없습니다. 현재 화면을 확인해 주세요.'});},3000);
   try{await send({type:'command',command});}catch(e){handleFailure(e);throw e;}
  }
 };
}
