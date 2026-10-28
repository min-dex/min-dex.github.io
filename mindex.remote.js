(() => {
 'use strict';
 if(isPresenterOutputRoute())return;
 const trigger=document.createElement('button');trigger.type='button';trigger.className='icon-btn';trigger.id='remotePanelBtn';trigger.innerHTML='<i data-lucide="smartphone"></i>';trigger.title='원격 조작';trigger.setAttribute('aria-label','원격 조작');
 document.getElementById('monitorPanelBtn')?.before(trigger);window.lucide?.createIcons({root:trigger});
 let ending=false,remoteRevision=0,remoteBusy=false,remoteState={code:'',connected:false,available:false};
 const buttonLabel=()=>remoteState.code||'원격 조작';
 const codeFor=id=>hostContext()?.serviceId===id?remoteState.code||'':'';
 const panel=document.createElement('dialog');panel.className='remote-panel';panel.setAttribute('aria-labelledby','remoteTitle');
 panel.innerHTML='<header><span class="remote-brand-mark" aria-hidden="true"></span><h2 id="remoteTitle">Mindex Remote</h2><button class="icon-btn" data-remote-close aria-label="닫기" title="닫기"><i data-lucide="x"></i></button></header><section class="remote-connection"><p data-remote-status role="status"></p><strong data-remote-code></strong><p data-remote-help></p></section><footer class="remote-actions"><a class="btn secondary" data-remote-link target="_blank" rel="noopener"><i data-lucide="external-link"></i><span>Remote 열기</span></a><button class="btn secondary" data-remote-end disabled>연결 해제</button></footer>';
 document.body.append(panel);window.lucide?.createIcons({root:panel});const $=s=>panel.querySelector(s);
 function paintPanel(){
  for(const button of [trigger,...document.querySelectorAll('[data-presenter-remote]')]){
   let text=button.querySelector('[data-remote-button-label]');if(!text){text=document.createElement('span');text.dataset.remoteButtonLabel='';button.append(text);}
   if(button.dataset.remoteServiceId){const code=codeFor(button.dataset.remoteServiceId);button.hidden=!code;text.textContent=code;button.disabled=ending;button.setAttribute('aria-label','원격 조작 예배 코드 '+code);continue;}
   text.textContent=buttonLabel();button.disabled=ending;button.dataset.remotePairing=String(!!remoteState.code);
   button.title=remoteState.code?'송출 코드 '+remoteState.code:'원격 조작';button.setAttribute('aria-label',button.title);
  }
  $('[data-remote-code]').textContent=remoteState.code;
  $('[data-remote-status]').textContent=remoteState.code?(remoteState.available?(remoteState.connected?'연결됨':hostContext()?.output?'송출 코드':'송출 대기'):'연결 확인 중'):(isPresenterOutputWindowOpen()?'송출 코드 준비 중':'PC에서 예배 화면을 열면 코드가 표시됩니다.');
  $('[data-remote-help]').textContent=remoteState.code?'예배 화면에서 유지 · Remote에서 코드 입력':'';
  $('[data-remote-end]').disabled=ending||!remoteState.connected;
 }
 $('[data-remote-link]').href=location.protocol==='file:'?'https://min-dex.github.io/remote.html':new URL('remote.html',location.href).href;
 $('[data-remote-close]').onclick=()=>panel.close();
 function activate(){if(ending)return;void ensureRegistry();panel.showModal();}
 trigger.onclick=activate;document.addEventListener('click',event=>{if(event.target.closest('[data-presenter-remote]'))activate();});
 $('[data-remote-end]').onclick=async()=>{if(ending)return;ending=true;paintPanel();try{await registry?.disconnectGuest();}finally{ending=false;paintPanel();}};
 const text=s=>[s?.title,s?.body||s?.text||s?.bodyText||s?.content].filter(v=>typeof v==='string').join('\n').slice(0,1800);
 function adapter(serviceId,outputSession,outputWindow,admin=false,followOutput=admin){
  let slideSet,slideSignature,slideService,slideKey;
  function catalogKey(){const p=state.presenter;if(slideService!==p.serviceId||slideSet!==p.slides||slideSignature!==p.sourceSignature){slideService=p.serviceId;slideSet=p.slides;slideSignature=p.sourceSignature;slideKey=crypto.randomUUID();}return slideKey;}
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
   if(followOutput&&state.presenter.outputSessionId===outputSession&&state.presenter.outputWindow===outputWindow)serviceId=state.presenter.serviceId;
   const {p,m,slide,sync,own,intro}=context();
   const live=p.serviceId===serviceId&&(followOutput||state.selectedServiceId===serviceId)&&p.outputSessionId===outputSession&&p.outputWindow===outputWindow&&presenterControllerIsLive(serviceId)&&isPresenterOutputWindowOpen();
   const transparent=p.safetyBlank&&p.safetyBlankMode==='transparent';
   const allowed=['jump','prev','next',p.safetyBlank&&!transparent?'unblank':'blank',transparent?'untransparent':'transparent'];
   if(window.mindexElectron?.fullscreenPresenterOutput)allowed.push('output-fullscreen');
   if(window.mindexElectron?.setPresenterAlwaysOnTop)allowed.push(p.alwaysOnTop?'output-unpin':'output-pin');
   if(admin)allowed.push('output-stop');
   if(!m.pending&&!m.fadeStop){
    if((own||intro)&&!m.playing)allowed.push('play');
    if(own&&m.playing)allowed.push('pause');
    if(own)allowed.push('stop');
    if(own&&m.playing&&m.autoSyncSuspended&&m.mode==='presenter-audio'&&sync?.localTiming&&slide.songTimingEligible&&m.timingGroupId===sync.groupId&&!p.safetyBlank&&!p.liveScripture?.active)allowed.push('resume');
   }
   const video=presenterRemoteVideoState(serviceId);
   if(video?.ready)allowed.push(...(video.status==='playing'?['video-pause']:['video-play']), 'video-restart');
   const next=p.slides.slice(p.index+1).find(s=>!presenterSlideIsHidden(s));
   return {live,video,serviceTitle:serviceDisplayTypeName(state.services.find(s=>s.id===serviceId))||'예배',catalogKey:catalogKey(),index:p.index,total:p.slides.length,blank:!!p.safetyBlank&&!transparent,transparent:!!transparent,alwaysOnTop:!!p.alwaysOnTop,current:text(p.liveScripture?.active?p.liveScripture.slide:slide),next:text(next),nextTitle:[...new Set([next?.elementLabel||next?.sectionLabel,next?.elementTitle||next?.title].filter(Boolean))].join(' · ').slice(0,200),allowed,
    previewCurrent:p.safetyBlank&&p.safetyBlankMode==='transparent'?preview(presenterSafetyBlankSlide('transparent')):p.safetyBlank?'<div style="width:100%;height:100%;background:#000"></div>':preview(p.liveScripture?.active?p.liveScripture.slide:slide),previewNext:preview(next),
    music:!own&&!intro?'연결된 음원 없음':m.pending?'음원 준비 중':m.fadeStop?'페이드아웃 중':`${m.playing?'재생 중':'정지 / 일시정지'}${sync?.localTiming?m.autoSyncSuspended?' · 자동 넘김 해제':' · 자동 넘김':''}`,
    // Compare identities without disclosing media URLs or the full worship source.
    version:compactTextSignature(JSON.stringify([remoteRevision,p.serviceId,p.sourceSignature,presenterTransportSequence,m.playSerial,m.sourceKey,m.timingGroupId,m.mode,p.livePraise,p.liveScripture?.active]))};
  }
  async function perform(action,target){
   if(!read().live||!read().allowed.includes(action))throw Error('현재 상태에서는 이 조작을 할 수 없습니다.');
   const {p,m,slide,intro}=context();
   if(action==='jump'){
    if(!target||target.key!==catalogKey()||!Number.isSafeInteger(target.index)||target.index<0||target.index>=p.slides.length||presenterSlideIsHidden(p.slides[target.index]))throw Error('슬라이드가 변경됐습니다. 목록을 다시 열어 주세요.');
    return runPresenterAction('jump',serviceId,{index:target.index,scroll:false});
   }
   if(action==='output-fullscreen')return window.mindexElectron.fullscreenPresenterOutput();
   if(action==='output-pin'||action==='output-unpin'){
    const enabled=action==='output-pin';
    await window.mindexElectron.setPresenterAlwaysOnTop({enabled});
    p.alwaysOnTop=enabled;safeStorageSet('local',PRESENTER_ALWAYS_ON_TOP_STORAGE_KEY,enabled?'true':'false');
    remoteRevision++;renderPresenterControlState(serviceId);return;
   }
   if(action==='transparent'||action==='untransparent')return runPresenterAction('jump',serviceId,{index:action==='transparent'?-1:p.index,blankMode:'transparent',scroll:false});
   if(action==='output-stop'&&admin)return stopPresenterOutput(serviceId);
   if(action==='prev'||action==='next')return runPresenterAction(action,serviceId,{scroll:false});
   if(action==='blank'||action==='unblank')return runPresenterAction('jump',serviceId,{index:action==='blank'?-1:p.index,scroll:false});
   if(action.startsWith('video-'))return requestPresenterVideoCommand(serviceId,action.slice(6));
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
  function browse(options={}){
   if(!read().live)return null;
   const query=String(options?.query||'').slice(0,80).trim().toLocaleLowerCase();
   const all=state.presenter.slides.map((slide,index)=>({slide,index})).filter(({slide})=>!presenterSlideIsHidden(slide));
   const groups=[];let previous=null;
   for(const row of all){
    const identity=row.slide.elementId||row.slide.sectionId||row.slide.elementLabel||row.slide.sectionLabel||`slide-${row.index}`;
    if(!previous||previous.identity!==identity){previous={identity,index:row.index,rows:[],title:[...new Set([row.slide.elementLabel||row.slide.sectionLabel,row.slide.elementTitle].filter(Boolean))].join(' · ').slice(0,160)||String(row.slide.title||'예배').slice(0,160)};groups.push(previous);}
    previous.rows.push(row);
   }
   const directory=options?.mode==='groups'&&!query;
   const chosen=options?.key===catalogKey()?groups.find(g=>g.index===options.groupIndex):null;
   const rows=(chosen?chosen.rows:all).filter(({slide})=>[slide.sectionLabel,slide.elementLabel,slide.elementTitle,slide.title,text(slide)].join(' ').toLocaleLowerCase().includes(query));
   const pageSize=directory?12:6, source=directory?groups:rows;
   const currentGroup=groups.findIndex(g=>g.rows.some(r=>r.index===state.presenter.index));
   const requested=directory&&options?.atCurrent?Math.floor(Math.max(0,currentGroup)/pageSize)*pageSize:options?.offset;
   const offset=Number.isSafeInteger(requested)?Math.min(Math.max(0,requested),Math.max(0,Math.floor((source.length-1)/pageSize)*pageSize)):0;
   const result={key:catalogKey(),mode:directory?'groups':'slides',pageSize,offset,total:source.length,groupIndex:chosen?.index??null,items:directory?groups.slice(offset,offset+pageSize).map(g=>({index:g.index,title:g.title,count:g.rows.length,endIndex:g.rows.at(-1).index,current:g.rows.some(r=>r.index===state.presenter.index)})):rows.slice(offset,offset+pageSize).map(({slide,index})=>({index,groupKey:String(slide.elementId||slide.sectionId||'').slice(0,120),group:[...new Set([slide.elementLabel||slide.sectionLabel,slide.elementTitle].filter(Boolean))].join(' · ').slice(0,160)||'예배',title:String(slide.title||slide.elementLabel||'슬라이드').slice(0,80),text:text(slide).slice(0,300),preview:preview(slide)}))};
   // Keep each encrypted response below the transport envelope limit.
   for(const item of [...result.items].reverse())if(new TextEncoder().encode(JSON.stringify(result)).length>14000)item.preview='';
   return result;
  }
  return {read,browse,async execute(action,target){
   if(remoteBusy)throw Error('다른 조작을 처리 중입니다.');
   remoteBusy=true;remoteRevision++;
   try{return await perform(action,target);}finally{remoteBusy=false;remoteRevision++;registry?.notify();}
  }};
 }
 // One page owns one registry identity across standby/start/stop. No permanent PC ID.
 const hostKey=crypto.randomUUID();
 let starting=false;
 function hostContext(){
  if(!state.client)return null;
  const output=isPresenterOutputWindowOpen();
  const pending=!!state.presenter.outputPendingAt&&!isPresenterOutputHeartbeatOpen();
  const serviceId=output||pending?state.presenter.serviceId:state.module==='presenter'?state.selectedServiceId:null;
  if(!serviceId||(!output&&!pending&&!state.services.some(s=>s.id===serviceId)))return null;
  return {serviceId,output,pending};
 }
 function hostAdapter(admin=false){
  let current=null,sessionId=null,outputWindow=null;
  function outputAdapter(){
   const p=state.presenter;
   if(!current||sessionId!==p.outputSessionId||outputWindow!==p.outputWindow){
    sessionId=p.outputSessionId;outputWindow=p.outputWindow;current=adapter(p.serviceId,sessionId,outputWindow,admin,true);
   }
   return current;
  }
  function read(){
   const c=hostContext();if(!c)return {live:false};
   const p=state.presenter,busy=starting||c.pending;
   const outputState=busy?'starting':c.output?'live':'standby';
   const idle={index:-1,total:0,current:'송출 대기',next:'',previewCurrent:'',previewNext:'',music:'연결된 음원 없음',video:null,allowed:[]};
   const value=c.output?outputAdapter().read():idle;
   return {...value,live:true,outputState,serviceTitle:serviceDisplayTypeName(state.services.find(s=>s.id===c.serviceId))||'예배',
    allowed:busy||remoteBusy?[]:c.output?value.allowed:admin?['output-start']:[],
    version:JSON.stringify([value.version,c.serviceId,p.outputGeneration,outputState,remoteRevision,state.dirty.service,state.dirty.song,state.dirty.forms])};
  }
  return {read,browse:options=>hostContext()?.output?outputAdapter().browse(options):null,async execute(action,target){
   const c=hostContext();
   if(!c||!read().allowed.includes(action))throw Error('현재 상태에서는 이 조작을 할 수 없습니다.');
   if(action!=='output-start')return outputAdapter().execute(action,target);
   if(!admin||c.output||c.pending||remoteBusy||starting)throw Error('이미 송출을 준비 중입니다.');
   const client=state.client,generation=state.presenter.outputGeneration,serviceId=c.serviceId;
   const guard=()=>registryActive&&state.client===client&&state.module==='presenter'&&state.selectedServiceId===serviceId&&state.presenter.outputGeneration===generation;
   remoteBusy=true;starting=true;remoteRevision++;registry?.notify();
   try{
    await runPresenterAction('open',serviceId,{throwOnError:true,guard});
    if(!isPresenterOutputWindowOpen()&&!state.presenter.outputPendingAt)throw Error('송출을 시작하지 못했습니다. PC의 예배와 팝업 허용 상태를 확인해 주세요.');
   }finally{starting=false;remoteBusy=false;remoteRevision++;registry?.notify();}
  }};
 }
 let registry=null,registryLoading=false,registryActive=true,registryEpoch=0;
 const adminHost=hostAdapter(true),guestHost=hostAdapter(false);
 async function ensureRegistry(){
  if(!registryActive||registry||registryLoading||!hostContext())return;
  registryLoading=true;const epoch=registryEpoch;
  try{
   const {createOutputRegistry}=await import('./mindex.remote-admin.mjs?v=9');
   if(!registryActive||epoch!==registryEpoch)return;
   registry=createOutputRegistry(()=>{
    const c=hostContext();if(!c)return null;
    const service=state.services.find(s=>s.id===c.serviceId),device=document.getElementById('monitorName')?.value||'송출 PC';
    return {key:hostKey,client:state.client,adapter:adminHost,guestAdapter:guestHost,
     info:{title:serviceDisplayTypeName(service)||'예배',device:device+(c.output?'':' · 송출 대기'),position:c.output?`${state.presenter.index+1} / ${state.presenter.slides.length}`:'송출 대기'}};
   },{onUpdate:value=>{remoteState=value;paintPanel();}});
  }catch{}finally{registryLoading=false;}
 }
 let registryTimer=setInterval(ensureRegistry,2000);
 window.addEventListener('pagehide',event=>{registryActive=false;registryEpoch++;clearInterval(registryTimer);if(event.persisted)registry?.suspend();else{registry?.close();registry=null;}});
 window.addEventListener('pageshow',()=>{if(registryActive)return;registryActive=true;registryTimer=setInterval(ensureRegistry,2000);void registry?.resume();void ensureRegistry();});
 // Read-only adapter entry is also used by isolated regression tests.
 window.MindexRemote={adapter,hostAdapter,buttonLabel,codeFor,notify:()=>registry?.notify(),open:()=>panel.showModal()};
 paintPanel();
})();
