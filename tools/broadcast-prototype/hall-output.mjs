// Own popup only; no operational presenter channels or stored window identifiers.
export function mountHallOutput({getFrame,root=document}){
 const $=id=>root.getElementById(id);let popup=null,timer=null,disposed=false;
 function status(text){$('hallOutputStatus').textContent=text;$('hallOutputClose').disabled=!popup||popup.closed;}
 function close(){clearInterval(timer);timer=null;if(popup&&!popup.closed)popup.close();popup=null;status('본당 출력 창 닫힘');}
 $('hallOutputOpen').onclick=()=>{
  if(disposed)return;
  if(popup&&!popup.closed){popup.focus();return;}
  const token=crypto.randomUUID(),url=new URL('./hall-output.html',import.meta.url);url.hash=token;
  popup=window.open(url.href,'mindex-test-hall-'+token,'popup,width=1280,height=720');
  if(!popup){status('팝업이 차단됐습니다. 이 사이트의 팝업을 허용하고 다시 열어 주세요.');return;}
  const own=popup;
  own.addEventListener('load',()=>{try{
   if(disposed||own!==popup||own.closed)return;
   if(typeof own.attachHallOutput!=='function')throw Error('output page');
   own.attachHallOutput(token,getFrame);status('본당 출력 창 열림 · 본당에 연결된 화면으로 옮긴 뒤 전체 화면을 누르세요.');
  }catch{if(own===popup){close();status('출력 창 연결 실패 · 다시 열어 주세요.');}}},{once:true});
  status('본당 출력 창 준비 중');timer=setInterval(()=>{if(popup?.closed){clearInterval(timer);timer=null;popup=null;status('본당 출력 창 닫힘');}},300);
 };
 $('hallOutputClose').onclick=close;status('본당 출력 대기 중');
 return ()=>{disposed=true;close();};
}
