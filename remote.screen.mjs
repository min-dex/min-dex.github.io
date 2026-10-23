// Wake Lock is a foreground convenience, never a connection or command permission.
export function createScreenAwake({request,onChange}){
 let active=false,visible=true,lock=null,pending=false,epoch=0;
 const wanted=()=>active&&visible;
 const announce=state=>onChange(state);
 const release=sentinel=>Promise.resolve().then(()=>sentinel.release()).catch(()=>{});
 function idle(){announce(!active?'idle':!visible?'hidden':request?'released':'unsupported');}
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
  const nextActive=values.active??active,nextVisible=values.visible??visible;
  if(active===nextActive&&visible===nextVisible)return;
  active=nextActive;visible=nextVisible;epoch++;
  if(!wanted()){const old=lock;lock=null;if(old)void release(old);idle();}
  else void acquire();
 }
 idle();return {update,retry(){void acquire();},close(){update({active:false});}};
}

export function setupPhoneExperience(){
 const $=id=>document.getElementById(id);
 const labels={unsupported:'화면 꺼짐 방지 미지원',blocked:'화면 꺼짐 방지를 허용하지 않았어요.',released:'화면 꺼짐 방지 해제됨'};
 const awake=createScreenAwake({request:navigator.wakeLock?.request?()=>navigator.wakeLock.request('screen'):null,onChange:state=>{
  $('screenStatus').textContent=labels[state]||'';$('screenRetry').hidden=!['blocked','released'].includes(state);
 }});
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
