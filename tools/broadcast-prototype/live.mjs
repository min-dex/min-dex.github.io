// Passive receiver: never acknowledges, publishes or issues presenter commands.
export function followPresenter({render,clear,status,onAccepted=()=>{},channelFactory=name=>new BroadcastChannel(name),onWindow=window}){
 let stopped=false,ended=false,selected='',snapshot=null,sequence=-1,version=0,pending=null,busy=false,lastKey='',generation=0;
 const channel=channelFactory('mindex.presenter');
 const number=id=>{const n=Number(String(id||'').split(':').at(-1));return Number.isSafeInteger(n)?n:-1;};
 async function drain(){if(busy||stopped)return;busy=true;try{while(pending&&!stopped){const job=pending;pending=null;try{const result=await render(job.slide,()=>!stopped&&job.version===version,job.label);if(job.version===version)status(result||job.label);}catch{if(job.version===version){clear();status('합성 연결 오류 · 다음 상태를 기다립니다');lastKey='';}}}}finally{busy=false;}}
 function accept(message){
  if(stopped||ended||!message||typeof message!=='object')return;
  if(message.type==='presenter-output-close'){
   if(!snapshot||message.outputSessionId!==snapshot.outputSessionId)return;
   ended=true;version++;pending=null;snapshot=null;lastKey='';clear();status('송출 종료 · 다시 연결하려면 따라오기 해제 후 켜세요');return;
  }
  if(message.type==='presenter-state'){
   const p=message.payload;if(!p?.serviceId||!p.outputSessionId||!p.snapshotId||!Array.isArray(p.slides)||p.slides.length>2000)return;
   if(!Number.isFinite(p.updatedAt)||Math.abs(Date.now()-p.updatedAt)>180000)return;
   const key=p.serviceId+'|'+p.outputSessionId;
   if(selected&&selected!==key)return;
   const seq=number(p.messageId);if(snapshot&&p.snapshotId===snapshot.snapshotId&&seq<=sequence)return;
   // Lock both output identity and transport generation; another tab cannot replace it.
   const transport=String(p.messageId).split(':').slice(0,-1).join(':');
   if(selected&&transport!==generation)return;
   if(selected&&seq<=sequence)return;
   selected=key;generation=transport;sequence=seq;snapshot=p;
  }else if(message.type==='presenter-navigation'){
   const p=message.payload;if(!snapshot||p?.snapshotId!==snapshot.snapshotId||number(p.messageId)<=sequence||p.updatedAt<snapshot.updatedAt)return;
   sequence=number(p.messageId);snapshot={...snapshot,...p,slides:snapshot.slides};
  }else return;
  version++;
  const slide=snapshot.liveScripture?.active?snapshot.liveScripture.slide:snapshot.slides[snapshot.index];
  if(snapshot.safetyBlank||snapshot.index<0||!slide){pending=null;lastKey='';clear(snapshot.safetyBlank?'blackout':'unavailable');status(snapshot.safetyBlank?'검정 화면':'자막 비움');return;}
  const key=JSON.stringify(slide);if(key===lastKey&&!pending&&!busy)return;lastKey=key;
  onAccepted(slide,selected+'|'+snapshot.index);
  pending={slide:structuredClone(slide),version,label:`${snapshot.serviceTitle||'예배'} · ${snapshot.index+1}장 · 실시간 따라오기`};void drain();
 }
 channel.onmessage=e=>accept(e.data);
 const relay=e=>{if(e.source!==onWindow.opener||!e.source)return;if(!['https://min-dex.github.io',location.origin].includes(e.origin))return;if(e.data?.type==='mindex-broadcast-passive')accept(e.data.message);};
 onWindow.addEventListener('message',relay);
 status('다음 송출 상태 대기 · 같은 주소의 민덱스 또는 읽기 전용 연결 도구');
 return {accept,stop(){stopped=true;version++;pending=null;channel.close();onWindow.removeEventListener('message',relay);clear();status('실시간 따라오기 해제');}};
}
