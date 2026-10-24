import {obtainOutputPairing} from './mindex.output-pairing.mjs?v=4';
import {adminRpc,relayRegistration} from './mindex.remote-admin.mjs?v=6';
import {createPreview} from './remote.preview.mjs?v=2';
import {openRemote} from './mindex.remote-session.mjs?v=11';
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
 $('pairForm').hidden=!!adminToken||!!session;
 $('adminOutputs').hidden=!adminMode||!adminToken||!!session;
 $('adminLogout').hidden=!adminMode||!adminToken||!!session;
 $('adminContext').hidden=!adminLink||!view;
 if(adminLink){$('selectedOutputTitle').textContent=adminLink.title;$('selectedOutputCode').textContent=adminLink.code?'코드 '+adminLink.code:'';}
 $('stopOutput').hidden=!adminLink||!view;
 $('adminLogout').disabled=opening||ending||!!session;
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
   const button=document.createElement('button'),row=document.createElement('span'),title=document.createElement('span'),code=document.createElement('span'),detail=document.createElement('small');
   row.className='output-row';code.className='output-code';
   title.textContent=output.title||'예배';code.textContent=output.code?'코드 '+output.code:'코드 준비 중';
   detail.textContent=[output.device,output.position].filter(Boolean).join(' · ');
   row.append(title,code);button.append(row,detail);button.onclick=()=>connectAdmin(output);list.append(button);
  }
 }catch(e){$('status').textContent=e.message;if(e.code==='expired'){adminToken=null;connectionForms();}}
 finally{listBusy=false;}
}
async function connectAdmin(selected){
 const output=selected.id;
 if(opening||ending||session||!adminToken)return;opening=true;paint();
 const token=adminToken,request=crypto.randomUUID();adminLink={token,output,request,title:selected.title||'예배',code:selected.code||''};
 try{
  $('status').textContent='송출 PC에 연결 중';
  const deadline=performance.now()+15000;let result;
  do{
   result=await adminRpc(client,'mindex_remote_admin',{p_action:'connect',p_token:token,p_output:output,p_request:request});
   if(result.ready)break;
   await new Promise(resolve=>setTimeout(resolve,500));
  }while(performance.now()<deadline&&adminToken===token);
  if(!result.ready||adminToken!==token)throw Error('송출 PC의 응답이 없어요. 다시 선택해 주세요.');
  session=await openRemote({client,registration:relayRegistration(result.secret),onClose:()=>{void releaseAdminLink();reset();},onSlides:renderSlides,onState:state,onStatus:s=>{$('status').textContent=s;paint();},onResult:remoteResult});
  $('disconnect').hidden=true;
 }catch(e){await releaseAdminLink();$('status').textContent=e.message;}
 finally{opening=false;paint();}
}
$('adminLogout').onclick=async()=>{
 if(opening||ending||session)return;const token=adminToken;adminToken=null;adminMode=false;ending=true;paint();
 try{await adminRpc(client,'mindex_remote_admin',{p_action:'logout',p_token:token});$('status').textContent='관리자 접속 종료';}
 catch(e){$('status').textContent=e.message;}finally{ending=false;paint();}
};
setInterval(listOutputs,3000);
window.addEventListener('pagehide',event=>{if(event.persisted)return;const token=adminToken;adminToken=null;if(token)void adminRpc(client,'mindex_remote_admin',{p_action:'logout',p_token:token}).catch(()=>{});});
function reset(){$('slidesDialog').close();clearTimeout(slidesTimer);slidesData=null;jumpPending=false;session=null;state(null);$('pairForm').hidden=false;$('disconnect').hidden=true;$('code').value='';paint();}
function paint(){
 connectionForms();
 screenAwake.update({active:!!session?.connected,visible:!document.hidden});
 const usable=session?.usable&&!document.hidden;
 $('slidesOpen').disabled=!usable||!view?.allowed?.includes('jump');
 paintSlides(usable);
 for(const button of document.querySelectorAll('[data-action]'))button.disabled=!usable||!view?.allowed?.includes(button.dataset.action);
 $('connect').disabled=opening||ending||!!session;
 $('disconnect').disabled=ending;
 $('backOutputs').disabled=ending||opening;
}
function state(value){
 view=value;$('controller').hidden=!value;
 if(!value){currentPreview('','');nextPreview('','');return paint();}
 $('pairForm').hidden=true;$('position').textContent=`${value.index+1} / ${value.total}`;
 currentPreview(value.previewCurrent,value.blank?'암전 중':value.current||'내용 없음');nextPreview(value.previewNext,value.next||'마지막 슬라이드');
 $('music').textContent=value.music;
 $('videoStatus').textContent=value.video ? ({playing:'재생 중',paused:'일시정지',ended:'재생 완료',blocked:'PC에서 재생 허용 필요',loading:'영상 준비 중',error:'영상 재생 실패'}[value.video.status]||'영상 상태 확인 중') : '연결된 영상 없음';
 $('blank').dataset.action=value.blank?'unblank':'blank';$('blank').querySelector('span').textContent=value.blank?'암전 해제':'암전';
 const icon=value.blank?'eye':'eye-off';
 if($('blank').querySelector('[data-lucide]')?.getAttribute('data-lucide')!==icon){
  $('blank').querySelector('[data-lucide]')?.remove();
  const glyph=document.createElement('i');glyph.dataset.lucide=icon;$('blank').prepend(glyph);window.lucide?.createIcons({root:$('blank')});
 }
 paint();
}
const slidePreviews=[];
let slidesData=null,slidesLoading=false,slidesTimer=null,jumpPending=false;
function paintSlides(usable){
 if(!$('slidesDialog').open)return;
 const current=!!slidesData&&slidesData.key===view?.catalogKey;
 for(const b of $('slidesList').querySelectorAll('button')){
  b.disabled=!usable||!current||slidesLoading||jumpPending;
  b.setAttribute('aria-current',String(Number(b.dataset.index)===view?.index));
 }
 $('slidesPrev').disabled=!usable||slidesLoading||!slidesData||slidesData.offset===0;
 $('slidesNext').disabled=!usable||slidesLoading||!slidesData||slidesData.offset+6>=slidesData.total;
 if(!usable)$('slidesStatus').textContent='연결 확인 중 · 이동 잠김';
 else if(current&&$('slidesStatus').textContent==='연결 확인 중 · 이동 잠김')$('slidesStatus').textContent='원하는 슬라이드를 선택하세요.';
 else if(slidesData&&!current)$('slidesStatus').textContent='슬라이드가 변경됐어요. 검색을 눌러 새 목록을 받아 주세요.';
}
async function loadSlides(offset=0){
 if(!session?.usable)return;
 slidesLoading=true;$('slidesStatus').textContent='불러오는 중…';paint();clearTimeout(slidesTimer);
 slidesTimer=setTimeout(()=>{slidesLoading=false;$('slidesStatus').textContent='목록을 받지 못했어요. 검색을 눌러 다시 시도해 주세요.';paint();},5000);
 try{await session.requestSlides({offset,query:$('slidesQuery').value});}catch(e){clearTimeout(slidesTimer);slidesLoading=false;$('slidesStatus').textContent=e.message;paint();}
}
function renderSlides(data){
 if(!$('slidesDialog').open||!data||!Array.isArray(data.items))return;
 clearTimeout(slidesTimer);slidesLoading=false;slidesData=data;
 for(const preview of slidePreviews.splice(0))preview.dispose();
 const list=$('slidesList');list.replaceChildren();let group='';
 for(const item of data.items){
  if(item.group!==group){const h=document.createElement('h3');h.textContent=item.group;list.append(h);group=item.group;}
  const b=document.createElement('button'),mini=document.createElement('div'),label=document.createElement('span');
  b.type='button';b.dataset.index=item.index;mini.className='slide-preview';label.textContent=`${item.index+1}. ${item.title}`;
  b.append(mini,label);list.append(b);if(item.preview){const draw=createPreview(mini,`${item.index+1}번 슬라이드`);slidePreviews.push(draw);draw(item.preview,item.text);}
  else{mini.classList.add('slide-text-preview');const excerpt=document.createElement('span');excerpt.textContent=item.text||item.title;mini.append(excerpt);}
  b.onclick=async()=>{
   if(!session?.usable||jumpPending||data.key!==view?.catalogKey)return;
   jumpPending=true;$('slidesStatus').textContent='이동 중…';paint();
   try{await session.command('jump',{index:item.index,key:data.key});}catch(e){jumpPending=false;$('slidesStatus').textContent=e.message;paint();}
  };
 }
 $('slidesStatus').textContent=data.total?'원하는 슬라이드를 선택하세요.':'검색 결과가 없어요.';
 $('slidesPage').textContent=data.total?`${Math.floor(data.offset/6)+1} / ${Math.ceil(data.total/6)}`:'0 / 0';paint();
}
function remoteResult(r){
 $('result').textContent=r.message;
 if(jumpPending){jumpPending=false;if(r.ok)$('slidesDialog').close();else $('slidesStatus').textContent=r.message;}
 paint();
}
$('slidesOpen').onclick=()=>{slidesData=null;$('slidesList').replaceChildren();$('slidesQuery').value='';$('slidesDialog').showModal();void loadSlides();};
$('slidesClose').onclick=()=>$('slidesDialog').close();
$('slidesDialog').addEventListener('close',()=>{clearTimeout(slidesTimer);slidesLoading=false;for(const preview of slidePreviews.splice(0))preview.dispose();$('slidesList').replaceChildren();});
$('slidesSearch').onsubmit=e=>{e.preventDefault();void loadSlides();};
$('slidesPrev').onclick=()=>loadSlides(Math.max(0,(slidesData?.offset||0)-6));
$('slidesNext').onclick=()=>loadSlides((slidesData?.offset||0)+6);
$('pairForm').addEventListener('submit',async e=>{
 e.preventDefault();if(opening||ending||session)return;opening=true;paint();$('result').textContent='';
 try{
  if(!window.supabase||!window.MINDEX_SUPABASE)throw Error('연결 준비에 실패했습니다. 페이지를 새로고침해 주세요.');
  client=getClient();
  const entry=await adminRpc(client,'mindex_remote_entry',{p_code:$('code').value.trim()});
  if(entry.kind==='admin'){
   adminMode=true;adminToken=entry.token;$('code').value='';
   $('status').textContent='예배를 선택해 주세요.';return;
  }
  if(entry.kind!=='guest')throw Error('연결 응답을 확인할 수 없어요.');
  $('disconnect').textContent='연결 종료';
  const registration=await obtainOutputPairing(client,$('code').value);
  session=await openRemote({client,registration,onClose:reset,onSlides:renderSlides,onState:state,onStatus:s=>{$('status').textContent=s;paint();},onResult:remoteResult});
  $('disconnect').hidden=false;
 }catch(e){$('status').textContent=e.message;}finally{opening=false;paint();if(adminMode&&adminToken)void listOutputs();}
});
async function disconnectController(){
 if(ending||opening)return;ending=true;const old=session;session=null;paint();
 try{await old?.end();await releaseAdminLink();}finally{ending=false;}
 reset();if(adminMode&&adminToken){$('status').textContent='예배를 선택해 주세요.';void listOutputs();}
}
$('disconnect').onclick=disconnectController;
$('backOutputs').onclick=disconnectController;
for(const button of document.querySelectorAll('[data-action]'))button.onclick=async()=>{
 if(button.dataset.action==='output-stop'&&!confirm('선택한 예배의 송출을 종료할까요?'))return;
 try{const promise=session.command(button.dataset.action);$('result').textContent='처리 중…';paint();await promise;}catch(e){$('result').textContent=e.message;}paint();
};
document.addEventListener('visibilitychange',()=>{if(document.hidden)session?.suspend();else session?.refresh();paint();});
window.addEventListener('offline',()=>{session?.offline();paint();});
window.addEventListener('online',()=>{session?.refresh();paint();});
window.addEventListener('pagehide',event=>{if(event.persisted)session?.suspend();else session?.close();});
window.addEventListener('pageshow',event=>{if(event.persisted){session?.refresh();paint();}});
setInterval(paint,250);
paint();
