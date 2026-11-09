// User-initiated device test only. No speakers, persistence or remote publishing.
import {createAudioBuses} from './output-routing.mjs';
export function mountCaptureInput({policy,onStart,onReady,onStop,video,root=document}){
 const $=id=>root.getElementById(id);let stream=null,context=null,buses=null,hall=null,broadcast=null,meter=null,timer=null,epoch=0,busy=false,disposed=false;
 const desktop=Boolean(window.youtubeOutput);
 const status=text=>$('captureStatus').textContent=text;
 function controls(){for(const id of ['capturePermission','captureRefresh','captureVideo','captureAudio','captureConnect'])$(id).disabled=busy||!!stream;$('captureDisconnect').disabled=!stream&&!busy;}
 async function refresh(){
  if(!navigator.mediaDevices?.enumerateDevices){status(desktop?'이 앱에서 장치 목록을 열 수 없습니다. 시스템의 카메라·마이크 설정을 확인해 주세요.':'장치 입력은 민덱스 설치 앱에서 열어 주세요.');return;}
  try{
   const devices=await navigator.mediaDevices.enumerateDevices();
   for(const [id,kind] of [['captureVideo','videoinput'],['captureAudio','audioinput']]){
    const select=$(id),old=select.value;select.replaceChildren(new Option(kind==='audioinput'?'오디오 없이':'영상 장치 선택',''));
    let n=0;for(const device of devices.filter(d=>d.kind===kind&&d.deviceId)){select.add(new Option(device.label||`${kind==='audioinput'?'오디오':'영상'} 입력 ${++n}`,device.deviceId));}
    if([...select.options].some(o=>o.value===old))select.value=old;
   }
   status('영상 장치와 오디오를 선택하세요. 장치 이름이 없으면 권한을 허용한 뒤 다시 확인하세요.');
  }catch{status(desktop?'장치 목록을 읽지 못했습니다. 앱의 카메라·마이크 권한을 확인해 주세요.':'장치 목록을 읽지 못했습니다. 브라우저의 카메라·마이크 권한을 확인해 주세요.');}
 }
 function stop(message='장치 연결 해제'){
  ++epoch;clearInterval(timer);timer=null;
  if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;video.muted=true;
  buses?.dispose();buses=null;void context?.close();context=null;hall=null;broadcast=null;meter=null;busy=false;
  $('captureLevel').textContent='입력 — · 유튜브 —';onStop();controls();status(message);
 }
 $('capturePermission').onclick=async()=>{
  if(busy||stream)return;busy=true;controls();const own=++epoch;
  try{const permission=await navigator.mediaDevices.getUserMedia({video:true,audio:true});permission.getTracks().forEach(t=>t.stop());if(own===epoch&&!disposed)await refresh();}
  catch{if(own===epoch)status(desktop?'카메라·마이크 권한을 허용하지 못했습니다. 시스템 설정에서 민덱스 권한을 확인해 주세요.':'카메라·마이크 권한을 허용하지 못했습니다. 브라우저 권한을 확인해 주세요.');}
  finally{if(own===epoch){busy=false;controls();}}
 };
 $('captureRefresh').onclick=refresh;
 $('captureConnect').onclick=async()=>{
  if(busy||stream)return;if(!$('captureVideo').value){status('영상 장치를 먼저 선택하세요.');return;}
  busy=true;controls();const own=++epoch;let acquired=null;
  try{
   acquired=await navigator.mediaDevices.getUserMedia({video:{deviceId:{exact:$('captureVideo').value},width:{ideal:1280},height:{ideal:720},frameRate:{ideal:30}},audio:$('captureAudio').value?{deviceId:{exact:$('captureAudio').value},echoCancellation:false,noiseSuppression:false,autoGainControl:false}:false});
   if(disposed||own!==epoch){acquired.getTracks().forEach(t=>t.stop());return;}
   stream=acquired;onStart();video.srcObject=stream;video.muted=true;await video.play();
   if(disposed||own!==epoch)return;
   if(stream.getAudioTracks().length){
    context=new AudioContext();const source=context.createMediaStreamSource(stream);buses=createAudioBuses(context,source);meter=context.createAnalyser();meter.fftSize=2048;
    hall=context.createMediaStreamDestination();broadcast=context.createMediaStreamDestination();buses.hall.connect(meter);meter.connect(hall);buses.broadcast.connect(broadcast);await context.resume();
   }
   if(disposed||own!==epoch)return;
   const update=()=>{buses?.apply(policy());let peak=0;if(meter){const data=new Float32Array(meter.fftSize);meter.getFloatTimeDomainData(data);for(const v of data)peak=Math.max(peak,Math.abs(v));}
    $('captureLevel').textContent=`입력 ${(peak*100).toFixed(1)}% · 유튜브 ${((policy().broadcast?peak:0)*100).toFixed(1)}%`;};
   update();timer=setInterval(update,100);
   stream.getTracks().forEach(t=>t.addEventListener('ended',()=>{if(own===epoch)stop('장치 연결이 끊겼습니다. 다시 연결해 주세요.');}));
   onReady?.();
   status(stream.getAudioTracks().length?'장치 연결됨 · 영상·오디오 신호 확인 · 스피커 출력 없음':'영상 연결됨 · 오디오는 선택하지 않았습니다.');
  }catch(error){if(own===epoch){stop(error?.name==='NotReadableError'?'장치를 열 수 없습니다. 다른 앱의 장치 사용 여부를 확인하세요.':'연결 실패 · 선택 장치·권한·케이블을 확인하세요.');}else acquired?.getTracks().forEach(t=>t.stop());}
  finally{if(own===epoch){busy=false;controls();}}
 };
 $('captureDisconnect').onclick=()=>stop();controls();void refresh();
 return {stop,applyPolicy(){buses?.apply(policy());},active:()=>!!stream,broadcastStream:()=>broadcast?.stream,dispose(){disposed=true;stop();}};
}
