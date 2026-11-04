"""Offline freeze/navigation and read-only staged refresh; no real output/media."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as pw:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(pw) if engine=='chromium' else pw.webkit.launch()
   page=browser.new_page();page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("!!globalThis.MindexPresenterRefresh && !document.body.classList.contains('ui-booting')")
   print(engine,page.evaluate('''async()=>{
    const check=(v,m)=>{if(!v)throw Error(m)};
    const sid=crypto.randomUUID(),eid=crypto.randomUUID();
    const service={id:sid,type_id:'fixture',date:'2000-01-01',title:'Fixture',_worshipSourceRef:{}};
    state.services=[service];state.selectedServiceId=sid;state.songs=[];state.module='presenter';
    state.serviceTypes=[{id:'fixture',name:'시험'}];state.dirty.service=false;state.dirty.song=false;state.dirty.forms=false;
    state.dirtyServiceElementIds.clear();state.dirtyServiceStructureIds.clear();
    const item=normalizeServiceItem({id:eid,service_id:sid,label:'설교',raw_title:'이전 제목',assignee:'담당자',
      _worshipSectionKey:'sermon',_worshipSectionTitle:'설교',_worshipSlotKey:'test.0',_worshipElementTemplateModified:true,
      memo:serializeServiceItemMemo({elementType:'title_person',inputMode:'text'})},0);
    const rows=buildWorshipPersistenceRows(service,[item],{}, {},{elementTypedStateColumns:{inputMode:true,contentState:true}});
    let remote={revision:'2',service:{id:sid,service_type_id:'fixture',service_date:'2000-01-01',title:'Fixture',source_ref:{}},...structuredClone(rows)};
    state.worshipSections=structuredClone(rows.sections);state.worshipElements=structuredClone(rows.elements);
    state.serviceItems={[sid]:groupWorshipElements(rows.sections,rows.elements)[sid]};state.loadedWorshipServiceIds=new Set([sid]);
    preparePresenterService(sid);state.presenter.outputWindow={closed:false,postMessage(){}};state.presenter.outputSessionId='freeze-fixture';
    state.presenter.outputGeneration=5;state.presenter.channel=null;
    const originalSlides=JSON.stringify(state.presenter.slides),originalItems=JSON.stringify(state.serviceItems[sid]);
    let reads=0,adopts=0,failure=false,delay=null;
    const atomic={pending:()=>null,read:async(id,options)=>{reads++;check(id===sid&&options.adopt===false,'read must be service scoped and unadopted');if(delay)await delay;if(failure)throw Error('offline fixture');return structuredClone(remote)},adoptRemote:()=>{adopts++}};
    worshipAtomicClient=async()=>atomic;MindexPresenterFreshness.freshSongs=async()=>[];
    state.client={fixture:true};state.config.url='https://fixture.invalid';
    const originalRender=renderPresenterControlState;renderPresenterControlState=()=>{};
    const audio={paused:false,ended:false,currentTime:37.5,pause(){throw Error('audio stopped')},play(){throw Error('audio restarted')}};
    state.serviceMusic.audio=audio;state.serviceMusic.playing=true;state.serviceMusic.autoSyncSuspended=true;
    state.serviceMusic.ownerServiceId=sid;state.serviceMusic.sourceKey='fixture.wav';state.serviceMusic.mode='presenter-audio';
    const transport=publishPresenterPayload;const sent=[];publishPresenterPayload=(payload,options)=>{sent.push(structuredClone(payload));transport(payload,options)};
    // Live navigation must remain held, including output-side local actions.
    runPresenterAction('freeze',sid);check(MindexPresenterRefresh.frozen(sid),'manual freeze missing');
    const frozen=MindexPresenterRefresh.payload(presenterStatePayload());
    check(frozen.outputFrozen,'transport freeze flag missing');
    runPresenterAction('last',sid);check(JSON.stringify(state.presenter.slides)===originalSlides&&state.presenter.index===frozen.index,'navigation moved held output');
    check(applyPresenterActionToPayload(frozen,'next').index===frozen.index,'output-side navigation bypassed freeze');
    runPresenterAction('blackout',sid);check(state.presenter.safetyBlank,'freeze blocked safety');
    runPresenterAction('blackout',sid);check(!state.presenter.safetyBlank,'freeze blocked safety restore');
    const dom=document.createElement('main');dom.className='presenter-output-root';dom.innerHTML='<div class="presenter-output-layer is-active"><video muted></video></div>';
    const video=dom.querySelector('video');MindexPresenterRefresh.output(dom,{...frozen,outputFrozen:false});
    check(MindexPresenterRefresh.output(dom,frozen)&&dom.querySelector('video')===video,'freeze replaced running video node');
    const stage=document.createElement('main');stage.id='presenterOutputRoot';stage.className='presenter-output-root';document.body.append(stage);
    const output={...frozen,outputFrozen:false,chromakey:false,backgroundImages:[],backgroundImage:'',slides:[{id:'held',type:'title-content',elementType:'title_content',layout:'center_text',title:'현재 송출',bodyText:'보존'}],index:0};
    renderPresenterOutput(output);await new Promise(requestAnimationFrame);await new Promise(requestAnimationFrame);
    const active=stage.querySelector('.presenter-output-layer.is-active');check(active,'fixture output not painted');
    renderPresenterOutput({...output,outputFrozen:true,slides:[{...output.slides[0],title:'다음 화면'}]});
    check(stage.querySelector('.is-active')===active && stage.textContent.includes('현재 송출') && !stage.textContent.includes('다음 화면'),'frozen output repainted');
    stage.remove();clearPresenterOutputAutoAdvanceTimer();
    // A successful refresh preserves a manually engaged freeze.
    remote.service.title='갱신한 예배명';
    check(await MindexPresenterRefresh.refresh(sid),'manual refresh failed');
    check(state.services[0].title==='갱신한 예배명','fresh aggregate was not adopted');
    check(state.serviceMusic.audio===audio&&audio.currentTime===37.5&&!audio.paused,'refresh reset audio');
    check(reads===1&&adopts===1&&MindexPresenterRefresh.frozen(sid),'manual freeze not retained');
    runPresenterAction('freeze',sid);check(!MindexPresenterRefresh.frozen(sid),'manual unfreeze missing');
    // Failed reads leave every authored/local row intact and auto-unfreeze.
    const before=JSON.stringify({items:state.serviceItems[sid],sections:state.worshipSections,elements:state.worshipElements});failure=true;
    check(!await MindexPresenterRefresh.refresh(sid),'failed read accepted');
    check(!MindexPresenterRefresh.frozen(sid)&&before===JSON.stringify({items:state.serviceItems[sid],sections:state.worshipSections,elements:state.worshipElements}),'failed refresh mutated data or held output');failure=false;
    // A user edit arriving during a read wins and must never be adopted over.
    let release;delay=new Promise(resolve=>release=resolve);
    const pending=MindexPresenterRefresh.refresh(sid);await new Promise(resolve=>setTimeout(resolve,0));
    check(MindexPresenterRefresh.frozen(sid),'automatic hold missing');
    state.serviceItems[sid][0].raw_title='未保存の入力';state.dirty.service=true;release();
    check(!await pending&&state.serviceItems[sid][0].raw_title==='未保存の入力'&&!MindexPresenterRefresh.frozen(sid),'late draft overwritten');
    check(!JSON.stringify(sent.at(-1).slides).includes('未保存の入力'),'failed refresh published an unsaved draft');
    const calls=reads;check(!await MindexPresenterRefresh.refresh(sid)&&reads===calls,'dirty refresh issued reads');
    state.dirty.service=false;delay=null;
    // A slow response after the deadline cannot adopt data or undo blackout.
    let late;delay=new Promise(resolve=>late=resolve);failure=true;
    const nativeTimeout=window.setTimeout;
    window.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,ms===15000?20:ms,...args);
    const countBefore=adopts,slow=MindexPresenterRefresh.refresh(sid);
    await new Promise(resolve=>nativeTimeout(resolve,0));runPresenterAction('blackout',sid);
    check(!await slow,'timeout refresh accepted');
    check(sent.at(-1).safetyBlank===true&&!MindexPresenterRefresh.frozen(sid),'timeout changed safety or left an automatic hold');
    window.setTimeout=nativeTimeout;failure=false;late();await new Promise(resolve=>nativeTimeout(resolve,10));
    check(adopts===countBefore,'late timed-out response adopted');runPresenterAction('blackout',sid);delay=null;
    // Duplicate refresh clicks share one operation; the latest complete snapshot is applied.
    let done;delay=new Promise(resolve=>done=resolve);const first=MindexPresenterRefresh.refresh(sid);
    check(!await MindexPresenterRefresh.refresh(sid),'duplicate refresh started');done();check(await first,'final refresh failed');
    check(!MindexPresenterRefresh.frozen(sid),'automatic hold not released');
    check(JSON.stringify(state.serviceItems[sid])===originalItems,'unchanged server content drifted');
    // Refreshing a standby service cannot replace another live service's verified song snapshot.
    state.presenter.serviceId='other-live';state.presenter.outputSessionId='other-session';delay=null;
    MindexPresenterFreshness.adoptRefresh('other-live','5',[{id:'sentinel',title:'현재 송출 판본'}]);
    check(await MindexPresenterRefresh.refresh(sid),'standby refresh failed');
    check(MindexPresenterFreshness.song('sentinel','other-live')?.title==='현재 송출 판본','standby refresh changed the live song snapshot');
    renderPresenterControlState=originalRender;state.presenter.outputWindow=null;
    return 'PASS manual/automatic hold, safety restore, output-side navigation, media node, read failure, late drafts, duplicate clicks and original rows';
   }'''))
   browser.close()
finally:server.shutdown()
