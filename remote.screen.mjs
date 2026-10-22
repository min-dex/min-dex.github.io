// Wake Lock is a foreground convenience, never a connection or command permission.
export function createScreenAwake({request,onChange}){
 let active=false,visible=true,enabled=true,lock=null,pending=false,epoch=0;
 const wanted=()=>active&&visible&&enabled;
 const announce=state=>onChange(state);
 const release=sentinel=>Promise.resolve().then(()=>sentinel.release()).catch(()=>{});
 function idle(){announce(!enabled?'off':!active?'idle':!visible?'hidden':request?'released':'unsupported');}
 async function acquire(){
  if(!wanted()){idle();return;}
  if(!request){announce('unsupported');return;}
  if(lock||pending)return;
  const generation=epoch;pending=true;announce('requesting');
  try{
   const sentinel=await request();
   if(generation!==epoch||!wanted()){await release(sentinel);return;}
   if(sentinel.released){announce('released');return;}
   lock=sentinel;announce('held');
   sentinel.addEventListener('release',()=>{if(lock===sentinel){lock=null;idle();}});
  }catch{if(generation===epoch&&wanted())announce('blocked');}
  finally{pending=false;if(generation!==epoch&&wanted())void acquire();}
 }
 function update(values){
  const nextActive=values.active??active,nextVisible=values.visible??visible,nextEnabled=values.enabled??enabled;
  if(active===nextActive&&visible===nextVisible&&enabled===nextEnabled)return;
  active=nextActive;visible=nextVisible;enabled=nextEnabled;epoch++;
  if(!wanted()){const old=lock;lock=null;if(old)void release(old);idle();}
  else void acquire();
 }
 idle();return {update,retry(){void acquire();},close(){update({active:false});}};
}

export function setupPhoneExperience(){
 const $=id=>document.getElementById(id);
 const labels={idle:'연결하면 화면을 켜 둡니다.',off:'화면 꺼짐 방지 꺼짐',hidden:'화면으로 돌아오면 다시 시도합니다.',requesting:'화면 유지 요청 중…',held:'화면 켜짐 유지 중',unsupported:'이 브라우저에서는 화면 유지가 지원되지 않습니다.',blocked:'절전 설정 또는 브라우저가 화면 유지를 허용하지 않았습니다.',released:'화면 유지가 해제됐습니다.'};
 const awake=createScreenAwake({request:navigator.wakeLock?.request?()=>navigator.wakeLock.request('screen'):null,onChange:state=>{
  $('screenStatus').textContent=labels[state];$('screenRetry').hidden=!['blocked','released'].includes(state);
 }});
 $('keepAwake').addEventListener('change',()=>awake.update({enabled:$('keepAwake').checked}));
 $('screenRetry').onclick=()=>awake.retry();
 document.addEventListener('visibilitychange',()=>awake.update({visible:!document.hidden}));
 window.addEventListener('pagehide',()=>awake.close());
 awake.update({visible:!document.hidden});
 let prompt=null,installedByEvent=false;const mode=matchMedia('(display-mode: standalone)');
 function installation(){const installed=installedByEvent||mode.matches||navigator.standalone===true;$('installHelp').hidden=installed;$('installApp').hidden=installed||!prompt;}
 window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();prompt=event;installation();});
 window.addEventListener('appinstalled',()=>{installedByEvent=true;prompt=null;installation();});
 mode.addEventListener('change',installation);installation();
 $('installApp').onclick=async()=>{
  const current=prompt;if(!current)return;prompt=null;installation();
  try{await current.prompt();await current.userChoice;}catch{}finally{installation();}
 };
 return awake;
}
