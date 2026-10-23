(() => {
 'use strict';
 if(isPresenterOutputRoute())return;
 const trigger=document.createElement('button');trigger.type='button';trigger.className='icon-btn';trigger.id='remotePanelBtn';trigger.innerHTML='<i data-lucide="smartphone"></i>';trigger.title='원격 조작';trigger.setAttribute('aria-label','원격 조작');
 document.getElementById('monitorPanelBtn')?.before(trigger);
 window.lucide?.createIcons({root:trigger});
 let session=null,opening=false,ending=false;
 const panel=document.createElement('dialog');panel.className='remote-panel';panel.setAttribute('aria-labelledby','remoteTitle');
 panel.innerHTML='<header><span class="remote-brand-mark" aria-hidden="true"></span><h2 id="remoteTitle">Mindex Remote</h2><button class="icon-btn" data-remote-close aria-label="닫기" title="닫기"><i data-lucide="x"></i></button></header><section class="remote-connection"><p data-remote-status role="status">연결 코드를 만들어 주세요.</p><strong data-remote-code></strong><p data-remote-help></p></section><footer class="remote-actions"><a class="btn secondary" data-remote-link target="_blank" rel="noopener"><i data-lucide="external-link"></i><span>Remote 열기</span></a><button class="btn primary" data-remote-start>연결 시작</button><button class="btn secondary" data-remote-end disabled hidden>연결 종료</button></footer>';
 document.body.append(panel);window.lucide?.createIcons({root:panel});const $=s=>panel.querySelector(s);
 function paintPanel(){
  const active=!!session||ending;
  $('[data-remote-start]').hidden=active;
  $('[data-remote-start]').disabled=opening||ending||active;
  $('[data-remote-end]').hidden=!active;
  $('[data-remote-end]').disabled=ending||!session;
  $('[data-remote-link]').hidden=!!session?.connected||ending;
 }
 $('[data-remote-link]').href=location.protocol==='file:'?'https://min-dex.github.io/remote.html':new URL('remote.html',location.href).href;
 $('[data-remote-close]').onclick=()=>panel.close();trigger.onclick=()=>panel.showModal();
 const text=s=>[s?.title,s?.body||s?.text||s?.bodyText||s?.content].filter(v=>typeof v==='string').join('\n').slice(0,1800);
 function adapter(serviceId,outputSession,outputWindow){
  let previewRevision,previews=new WeakMap();
  function preview(slide){
   if(!slide?.type)return '';
   if(previewRevision!==state.presenter.sourceSignature){previewRevision=state.presenter.sourceSignature;previews=new WeakMap();}
   if(previews.has(slide))return previews.get(slide);
   let html='';
   try{
    const template=document.createElement('template');template.innerHTML=renderPresenterSlideMiniPreview(slide,serviceId);
    template.content.querySelectorAll('script,style,link,meta,base,iframe,object,embed,audio,video,form,input,button').forEach(el=>el.remove());
    for(const el of template.content.querySelectorAll('*')){
     for(const attr of [...el.attributes])if(/^on/i.test(attr.name)||['href','srcdoc','srcset'].includes(attr.name))el.removeAttribute(attr.name);
     if(el.tagName==='IMG')el.setAttribute('loading','eager');
     if(el.hasAttribute('src')){
      const url=new URL(el.getAttribute('src'),location.href);
      if(['https:','http:'].includes(url.protocol))el.setAttribute('src',url.href);else el.removeAttribute('src');
     }
     if(/(?:blob:|data:|file:|javascript:)/i.test(el.getAttribute('style')||''))el.removeAttribute('style');
    }
    const stage=document.createElement('div');stage.style.cssText='position:fixed;left:-10000px;top:0;width:1920px;height:1080px;visibility:hidden;pointer-events:none';
    stage.append(template.content);document.body.append(stage);
    try{if(typeof fitPresenterPreviewText==='function')fitPresenterPreviewText(stage);html=stage.innerHTML;}finally{stage.remove();}
    if(new TextEncoder().encode(JSON.stringify(html)).length>4500)html='';
   }catch{}
   previews.set(slide,html);return html;
  }
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
    previewCurrent:p.safetyBlank?'<div style="width:100%;height:100%;background:#000"></div>':preview(p.liveScripture?.active?p.liveScripture.slide:slide),previewNext:preview(next),
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
 $('[data-remote-start]').onclick=async()=>{
  if(opening||ending||session)return;
  if(!state.client||!presenterControllerIsLive(state.selectedServiceId)||!isPresenterOutputWindowOpen()){$('[data-remote-status]').textContent='이 PC에서 예배 송출을 먼저 시작해 주세요.';return;}
  opening=true;paintPanel();
  try{
   const {openRemote}=await import('./mindex.remote-session.mjs?v=5');
   const a=adapter(state.presenter.serviceId,state.presenter.outputSessionId,state.presenter.outputWindow);
   session=await openRemote({client:state.client,host:true,...a,onClose:()=>{session=null;$('[data-remote-code]').textContent='';$('[data-remote-help]').textContent='';$('[data-remote-start]').disabled=false;$('[data-remote-end]').disabled=true;paintPanel();},onStatus:s=>{$('[data-remote-status]').textContent=s;if(s==='코드를 입력하면 바로 연결됩니다.'&&session)$('[data-remote-code]').textContent=session.code;if(s==='리모컨 연결됨'){$('[data-remote-code]').textContent='';$('[data-remote-help]').textContent='';$('[data-remote-link]').hidden=true;}}});
   $('[data-remote-code]').textContent=session.listening?session.code:'';$('[data-remote-help]').textContent='폰에서 코드 입력 · 2분간 유효';$('[data-remote-end]').disabled=false;
  }catch(e){$('[data-remote-status]').textContent=e.message;$('[data-remote-start]').disabled=false;}finally{opening=false;paintPanel();}
 };
 $('[data-remote-end]').onclick=async()=>{if(ending)return;ending=true;paintPanel();const old=session;session=null;try{await old?.end();}finally{ending=false;}$('[data-remote-code]').textContent='';$('[data-remote-help]').textContent='';$('[data-remote-start]').disabled=false;$('[data-remote-end]').disabled=true;paintPanel();};
 window.addEventListener('pagehide',()=>session?.close());
 // Read-only adapter entry is also used by isolated regression tests.
 window.MindexRemote={adapter,open:()=>panel.showModal()};
})();
