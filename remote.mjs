import {openRemote} from './mindex.remote-session.mjs?v=5';
import {setupPhoneExperience} from './remote.screen.mjs?v=1';
window.lucide?.createIcons();
const screenAwake=setupPhoneExperience();
const $=id=>document.getElementById(id);
let session,view=null,opening=false,ending=false;
let client;
function reset(){session=null;state(null);$('pairForm').hidden=false;$('disconnect').hidden=true;$('code').value='';paint();}
function paint(){
 screenAwake.update({active:!!session?.connected,visible:!document.hidden});
 const usable=session?.usable&&!document.hidden;
 for(const button of document.querySelectorAll('[data-action]'))button.disabled=!usable||!view?.allowed?.includes(button.dataset.action);
 $('connect').disabled=opening||ending||!!session;
 $('disconnect').disabled=ending;
}
function state(value){
 view=value;$('controller').hidden=!value;
 if(!value)return paint();
 $('pairForm').hidden=true;$('position').textContent=`${value.index+1} / ${value.total}`;
 $('current').textContent=value.blank?'암전 중':value.current||'내용 없음';$('next').textContent=value.next||'마지막 슬라이드';
 $('music').textContent=value.music;
 $('blank').dataset.action=value.blank?'unblank':'blank';$('blank').querySelector('span').textContent=value.blank?'암전 해제':'암전';
 const icon=value.blank?'eye':'eye-off';
 if($('blank').querySelector('[data-lucide]')?.getAttribute('data-lucide')!==icon){
  $('blank').querySelector('[data-lucide]')?.remove();
  const glyph=document.createElement('i');glyph.dataset.lucide=icon;$('blank').prepend(glyph);window.lucide?.createIcons({root:$('blank')});
 }
 paint();
}
$('pairForm').addEventListener('submit',async e=>{
 e.preventDefault();if(opening||ending||session)return;opening=true;paint();$('result').textContent='';
 try{
  if(!window.supabase||!window.MINDEX_SUPABASE)throw Error('연결 준비에 실패했습니다. 페이지를 새로고침해 주세요.');
  client ||= window.supabase.createClient(window.MINDEX_SUPABASE.url,window.MINDEX_SUPABASE.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  session=await openRemote({client,onClose:reset,code:$('code').value,onState:state,onStatus:s=>{$('status').textContent=s;paint();},onResult:r=>{$('result').textContent=r.message;paint();}});
  $('disconnect').hidden=false;
 }catch(e){$('status').textContent=e.message;}finally{opening=false;paint();}
});
$('disconnect').onclick=async()=>{if(ending)return;ending=true;const old=session;session=null;paint();try{await old?.end();}finally{ending=false;}state(null);$('pairForm').hidden=false;$('disconnect').hidden=true;$('code').value='';paint();};
for(const button of document.querySelectorAll('[data-action]'))button.onclick=async()=>{
 try{const promise=session.command(button.dataset.action);$('result').textContent='처리 중…';paint();await promise;}catch(e){$('result').textContent=e.message;}paint();
};
document.addEventListener('visibilitychange',()=>{session?.refresh();paint();});
window.addEventListener('pagehide',()=>session?.close());
setInterval(paint,250);
paint();
