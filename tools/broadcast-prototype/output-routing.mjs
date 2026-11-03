const blockedSlate=typeof Image==='undefined'?null:new Image();
if(blockedSlate)blockedSlate.src=new URL('./blocked-slate.png',import.meta.url).href;
// Prototype policy. No persistence, production commands, or YouTube connections.
export function createOutputPolicy(){
 let manual=false,excluded=false,pending=false;
 const read=()=>({hall:true,broadcast:!(manual||excluded||pending),manual,excluded,pending,reason:manual?'수동 방송 제외':excluded?'유튜브 송출 차단':pending?'자막 준비 중':'정상 방송'});
 return {read,setManual(v){manual=!!v;return read()},setExcluded(v){excluded=!!v;return read()},setPending(v){pending=!!v;return read()}};
}
// Real Web Audio routing primitive, no connection to physical speakers.
// Caller owns sources/destinations; exclusion gates the entire broadcast mix.
export function createAudioBuses(context,source){
 const hall=context.createGain(),broadcast=context.createGain();source.connect(hall);source.connect(broadcast);
 return {hall,broadcast,apply(policy){hall.gain.setValueAtTime(1,context.currentTime);broadcast.gain.cancelScheduledValues(context.currentTime);broadcast.gain.setValueAtTime(policy.broadcast?1:0,context.currentTime)},dispose(){source.disconnect(hall);source.disconnect(broadcast);hall.disconnect();broadcast.disconnect()}};
}
export function drawBroadcast(ctx,hall,policy){
 ctx.clearRect(0,0,1280,720);
 if(policy.broadcast){ctx.drawImage(hall,0,0,1280,720);return;}
 if((policy.manual||policy.excluded)&&blockedSlate?.complete&&blockedSlate.naturalWidth){ctx.drawImage(blockedSlate,0,0,1280,720);return;}
 ctx.fillStyle='#171b24';ctx.fillRect(0,0,1280,720);
 ctx.fillStyle='#e9e9e4';ctx.textAlign='center';ctx.font='600 42px "Mindex Presenter", sans-serif';if(policy.manual||policy.excluded){ctx.font='600 32px "Mindex Presenter", sans-serif';ctx.fillText('저작권 보호를 위해 해당 영상은 외부로 송출되지 않습니다.',640,330);ctx.fillText('잠시만 기다려 주시면 감사하겠습니다.',640,390);}else ctx.fillText('잠시 후 방송이 이어집니다',640,365);
}
