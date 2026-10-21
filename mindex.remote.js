(() => {
 'use strict';
 if(isPresenterOutputRoute())return;
 const trigger=document.createElement('button');trigger.type='button';trigger.className='icon-btn';trigger.id='remotePanelBtn';trigger.textContent='원격';trigger.title='원격 조작';trigger.setAttribute('aria-label','원격 조작');
 document.getElementById('monitorPanelBtn')?.before(trigger);
 let session=null,opening=false;
 const panel=document.createElement('dialog');panel.className='monitor-panel';panel.setAttribute('aria-labelledby','remoteTitle');
 panel.innerHTML='<header><h2 id="remoteTitle">원격 조작</h2><button class="icon-btn" data-close aria-label="닫기">×</button></header><section class="monitor-section"><p>폰에서 Mindex Remote Controller를 열고 아래 코드를 입력해 주세요.</p><p><a data-link target="_blank" rel="noopener">리모컨 페이지 열기</a></p><p data-status role="status">예배 송출을 시작한 뒤 연결할 수 있어요.</p><p><strong data-code style="font-size:20px;letter-spacing:.06em;overflow-wrap:anywhere"></strong></p><p data-help></p><div class="monitor-toolbar"><button class="btn primary" data-start>연결 시작</button><button class="btn secondary" data-end disabled>연결 종료</button></div></section>';
 document.body.append(panel);const $=s=>panel.querySelector(s);
 $('[data-link]').href=location.protocol==='file:'?'https://min-dex.github.io/remote.html':new URL('remote.html',location.href).href;
 $('[data-close]').onclick=()=>panel.close();trigger.onclick=()=>panel.showModal();
 const text=s=>[s?.title,s?.body||s?.text||s?.bodyText||s?.content].filter(v=>typeof v==='string').join('\n').slice(0,1800);
 function adapter(serviceId,outputSession,outputWindow){
  function context(){
   const p=state.presenter,m=state.serviceMusic,slide=p.slides[p.index],sync=slide?.syncTimeline;
   const own=!!m.sourceKey&&(m.ownerServiceId===serviceId||(!m.ownerServiceId&&m.mode==='presenter-audio'&&sync?.audioSrc&&normalizePresenterMediaSource(sync.audioSrc)===normalizePresenterMediaSource(m.sourceKey)));
   const intro=slide?.type==='song-title'&&slide.songTimingEligible&&sync?.localTiming&&sync.intro;
   return {p,m,slide,sync,own,intro};
  }
  function read(){
   const {p,m,slide,sync,own,intro}=context();
   const live=p.serviceId===serviceId&&state.selectedServiceId===serviceId&&p.outputSessionId===outputSession&&p.outputWindow===outputWindow&&presenterControllerIsLive(serviceId)&&isPresenterOutputWindowOpen();
   const allowed=['prev','next',p.safetyBlank?'unblank':'blank'];
   if(!m.pending&&!m.fadeStop){
    if((own||intro)&&!m.playing)allowed.push('play');
    if(own&&m.playing)allowed.push('pause');
    if(own)allowed.push('stop');
    if(own&&m.playing&&m.autoSyncSuspended&&m.mode==='presenter-audio'&&sync?.localTiming&&slide.songTimingEligible&&m.timingGroupId===sync.groupId&&!p.safetyBlank&&!p.liveScripture?.active)allowed.push('resume');
   }
   const next=p.slides.slice(p.index+1).find(s=>!presenterSlideIsHidden(s));
   return {live,index:p.index,total:p.slides.length,blank:!!p.safetyBlank,current:text(p.liveScripture?.active?p.liveScripture.slide:slide),next:text(next),allowed,
    music:!own&&!intro?'연결된 음원 없음':m.pending?'음원 준비 중':m.fadeStop?'페이드아웃 중':`${m.playing?'재생 중':'정지 / 일시정지'}${sync?.localTiming?m.autoSyncSuspended?' · 자동 넘김 해제':' · 자동 넘김':''}`,
    // Compare identities without disclosing media URLs or the full worship source.
    version:compactTextSignature(JSON.stringify([p.sourceSignature,m.sourceKey,m.timingGroupId,m.mode,p.livePraise,p.liveScripture?.active]))};
  }
  async function execute(action){
   if(!read().live||!read().allowed.includes(action))throw Error('현재 상태에서는 이 조작을 할 수 없습니다.');
   const {p,m,slide,intro}=context();
   if(action==='prev'||action==='next')return runPresenterAction(action,serviceId,{scroll:false});
   if(action==='blank'||action==='unblank')return runPresenterAction('jump',serviceId,{index:action==='blank'?-1:p.index,scroll:false});
   if(action==='resume'){
    if(!window.MindexSongTiming?.resumeAutoSync(serviceId))throw Error('현재 음원의 자동 넘김을 복귀할 수 없습니다.');return;
   }
   if(action==='play'&&intro&&!m.playing&&(!m.sourceKey||m.timingGroupId!==slide.syncTimeline.groupId)){
    await window.MindexSongTiming?.play(serviceId,slide.songTimingElementId||slide.elementId);
   }else{
    const binding=m.mode==='presenter-audio'&&!serviceMusicSourceIsSlotOwned()?null:{serviceMusicSource:m.sourceKey,serviceMusicServiceId:m.ownerServiceId,serviceMusicLabel:m.sourceLabel,serviceMusicRepeatAllowed:String(m.repeatAllowed!==false)};
    await runServiceMusicAction(action==='stop'?'stop':'toggle',binding);
   }
   if(action==='play'&&!state.serviceMusic.playing)throw Error('송출 PC에서 음원 재생이 차단됐습니다. PC에서 한 번 재생해 주세요.');
  }
  return {read,execute};
 }
 $('[data-start]').onclick=async()=>{
  if(opening||session)return;
  if(!state.client||!presenterControllerIsLive(state.selectedServiceId)||!isPresenterOutputWindowOpen()){$('[data-status]').textContent='이 PC에서 예배 송출을 먼저 시작해 주세요.';return;}
  opening=true;$('[data-start]').disabled=true;
  try{
   const [{openRemote},{newCode,displayCode}]=await Promise.all([import('./mindex.remote-session.mjs'),import('./mindex.remote-core.mjs')]);
   const code=newCode(),a=adapter(state.presenter.serviceId,state.presenter.outputSessionId,state.presenter.outputWindow);
   session=await openRemote({client:state.client,code,host:true,...a,onClose:()=>{session=null;$('[data-code]').textContent='';$('[data-help]').textContent='';$('[data-start]').disabled=false;$('[data-end]').disabled=true;},onStatus:s=>{$('[data-status]').textContent=s;if(s==='리모컨 연결됨'){$('[data-code]').textContent='';$('[data-help]').textContent='한 대가 연결됐습니다. 언제든 연결을 종료할 수 있어요.';}}});
   $('[data-code]').textContent=displayCode(code);$('[data-help]').textContent='2분 안에 입력 · 한 번만 사용 · 코드를 아는 기기가 조작할 수 있어요.';$('[data-end]').disabled=false;
  }catch(e){$('[data-status]').textContent=e.message;$('[data-start]').disabled=false;}finally{opening=false;}
 };
 $('[data-end]').onclick=async()=>{const old=session;session=null;await old?.end();$('[data-code]').textContent='';$('[data-help]').textContent='';$('[data-start]').disabled=false;$('[data-end]').disabled=true;};
 window.addEventListener('pagehide',()=>session?.close());
 // Read-only adapter entry is also used by isolated regression tests.
 window.MindexRemote={adapter,open:()=>panel.showModal()};
})();
