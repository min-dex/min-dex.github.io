import {obtainOutputPairing} from './mindex.output-pairing.mjs?v=1';
import {adminRpc,relayRegistration} from './mindex.remote-admin.mjs?v=3';
import {createPreview} from './remote.preview.mjs?v=1';
import {openRemote} from './mindex.remote-session.mjs?v=8';
import {setupPhoneExperience} from './remote.screen.mjs?v=4';
window.lucide?.createIcons();
const screenAwake=setupPhoneExperience();
const $=id=>document.getElementById(id);
const currentPreview=createPreview($('current'),'현재 슬라이드'),nextPreview=createPreview($('next'),'다음 슬라이드');
let session,view=null,opening=false,ending=false;
let client;
let adminMode=false,adminToken=null,adminLink=null,listBusy=false;
function getClient(){
 if(!window.supabase||!window.MINDEX_SUPABASE)throw Error('연결 준비에 실패했습니다. 페이지를 새로고침해 주세요.');
 return client ||= window.supabase.createClient(window.MINDEX_SUPABASE.url,window.MINDEX_SUPABASE.anonKey,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
}
function connectionForms(){
 $('pairForm').hidden=adminMode||!!session;
 $('adminForm').hidden=!adminMode||!!adminToken;
 $('adminOutputs').hidden=!adminMode||!adminToken||!!session;
 $('adminLogout').hidden=!adminMode||!adminToken;
 $('stopOutput').hidden=!adminLink||!view;
 $('guestMode').setAttribute('aria-pressed',String(!adminMode));
 $('adminMode').setAttribute('aria-pressed',String(adminMode));
 for(const id of ['guestMode','adminMode','adminLogin','adminLogout'])$(id).disabled=opening||ending||!!session;
}
async function releaseAdminLink(){
 const link=adminLink;adminLink=null;
 if(link)await adminRpc(client,'mindex_remote_admin',{p_action:'disconnect',p_token:link.token,p_output:link.output,p_request:link.request}).catch(()=>{});
}
async function listOutputs(){
 if(!adminMode||!adminToken||listBusy||opening||session)return;listBusy=true;const token=adminToken;
 try{
  const data=await adminRpc(client,'mindex_remote_admin',{p_action:'list',p_token:token});
  if(token!==adminToken)return;
  const list=$('outputList');
  const signature=JSON.stringify(data.outputs);
  if(list.dataset.signature===signature)return;
  list.dataset.signature=signature;list.replaceChildren();
  if(!data.outputs.length){const p=document.createElement('p');p.textContent='송출 중인 예배가 없어요.';list.append(p);}
  for(const output of data.outputs){
   const button=document.createElement('button'),title=document.createElement('span'),detail=document.createElement('small');
   title.textContent=output.title;detail.textContent=`${output.device} · ${output.position} · ${output.code||output.id.slice(0,6)}`;
   button.append(title,detail);button.onclick=()=>connectAdmin(output.id);list.append(button);
  }
 }catch(e){$('status').textContent=e.message;if(e.code==='expired'){adminToken=null;connectionForms();}}
 finally{listBusy=false;}
}
async function connectAdmin(output){
 if(opening||ending||session||!adminToken)return;opening=true;paint();
 const token=adminToken,request=crypto.randomUUID();adminLink={token,output,request};
 try{
  $('status').textContent='송출 PC에 연결 중';
  const deadline=performance.now()+15000;let result;
  do{
   result=await adminRpc(client,'mindex_remote_admin',{p_action:'connect',p_token:token,p_output:output,p_request:request});
   if(result.ready)break;
   await new Promise(resolve=>setTimeout(resolve,500));
  }while(performance.now()<deadline&&adminToken===token);
  if(!result.ready||adminToken!==token)throw Error('송출 PC의 응답이 없어요. 다시 선택해 주세요.');
  session=await openRemote({client,registration:relayRegistration(result.secret),onClose:()=>{void releaseAdminLink();reset();},onState:state,onStatus:s=>{$('status').textContent=s;paint();},onResult:r=>{$('result').textContent=r.message;paint();}});
  $('disconnect').hidden=false;$('disconnect').textContent='송출 목록으로';
 }catch(e){await releaseAdminLink();$('status').textContent=e.message;}
 finally{opening=false;paint();}
}
$('guestMode').onclick=()=>{adminMode=false;connectionForms();};
$('adminMode').onclick=()=>{adminMode=true;connectionForms();void listOutputs();};
$('adminForm').onsubmit=async e=>{
 e.preventDefault();if(opening||ending)return;opening=true;paint();
 const pin=$('adminPin').value;$('adminPin').value='';
 try{const data=await adminRpc(getClient(),'mindex_remote_admin_login',{p_pin:pin});adminToken=data.token;$('status').textContent='관리자 접속됨';}
 catch(e){$('status').textContent=e.message;}finally{opening=false;paint();void listOutputs();}
};
$('adminLogout').onclick=async()=>{
 if(opening||ending||session)return;const token=adminToken;adminToken=null;ending=true;paint();
 try{await adminRpc(client,'mindex_remote_admin',{p_action:'logout',p_token:token});$('status').textContent='관리자 접속 종료';}
 catch(e){$('status').textContent=e.message;}finally{ending=false;paint();}
};
setInterval(listOutputs,3000);
window.addEventListener('pagehide',()=>{const token=adminToken;adminToken=null;if(token)void adminRpc(client,'mindex_remote_admin',{p_action:'logout',p_token:token}).catch(()=>{});});
function reset(){session=null;state(null);$('pairForm').hidden=false;$('disconnect').hidden=true;$('code').value='';paint();}
function paint(){
 connectionForms();
 screenAwake.update({active:!!session?.connected,visible:!document.hidden});
 const usable=session?.usable&&!document.hidden;
 for(const button of document.querySelectorAll('[data-action]'))button.disabled=!usable||!view?.allowed?.includes(button.dataset.action);
 $('connect').disabled=opening||ending||!!session;
 $('disconnect').disabled=ending;
}
function state(value){
 view=value;$('controller').hidden=!value;
 if(!value){currentPreview('','');nextPreview('','');return paint();}
 $('pairForm').hidden=true;$('position').textContent=`${value.index+1} / ${value.total}`;
 currentPreview(value.previewCurrent,value.blank?'암전 중':value.current||'내용 없음');nextPreview(value.previewNext,value.next||'마지막 슬라이드');
 $('music').textContent=value.music;
 $('videoControls').hidden=!value.video;
 $('videoStatus').textContent=value.video ? ({playing:'재생 중',paused:'일시정지',ended:'재생 완료',blocked:'PC에서 재생 허용 필요',loading:'영상 준비 중',error:'영상 재생 실패'}[value.video.status]||'영상 상태 확인 중') : '';
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
  client=getClient();
  $('disconnect').textContent='연결 종료';
  const registration=await obtainOutputPairing(client,$('code').value);
  session=await openRemote({client,registration,onClose:reset,onState:state,onStatus:s=>{$('status').textContent=s;paint();},onResult:r=>{$('result').textContent=r.message;paint();}});
  $('disconnect').hidden=false;
 }catch(e){$('status').textContent=e.message;}finally{opening=false;paint();}
});
$('disconnect').onclick=async()=>{if(ending)return;ending=true;const old=session;session=null;paint();try{await old?.end();}finally{ending=false;}state(null);$('pairForm').hidden=false;$('disconnect').hidden=true;$('code').value='';paint();};
for(const button of document.querySelectorAll('[data-action]'))button.onclick=async()=>{
 if(button.dataset.action==='output-stop'&&!confirm('선택한 예배의 송출을 종료할까요?'))return;
 try{const promise=session.command(button.dataset.action);$('result').textContent='처리 중…';paint();await promise;}catch(e){$('result').textContent=e.message;}paint();
};
document.addEventListener('visibilitychange',()=>{session?.refresh();paint();});
window.addEventListener('pagehide',()=>session?.close());
setInterval(paint,250);
paint();
