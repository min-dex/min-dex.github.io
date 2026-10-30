"""Exercise real presenter/music actions; only output window/audio hardware are fake."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium,prepare_server_state_fixture
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1280,'height':900});page.add_init_script('window.open=()=>null')
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc and r.request.method in ('GET','HEAD') else r.abort())
   page.goto(url);page.wait_for_function("typeof MindexRemote==='object' && !document.body.classList.contains('ui-booting')")
   prepare_server_state_fixture(page)
   print(engine,page.evaluate('''async()=>{
    const check=(x,m)=>{if(!x)throw Error(m)},sid='remote-adapter';state.client=null;
    state.services=[{id:sid,type_id:'fixture',title:'검증 예배'}];state.serviceTypes=[{id:'fixture',name:'예배'}];
    state.serviceItems={[sid]:['첫 번째','두 번째','마지막'].map((title,i)=>({id:'remote-'+i,service_id:sid,label:'설교',raw_title:title,sort_order:i+1,_worshipSectionKey:'sermon',_worshipElementTemplateModified:true,memo:serializeServiceItemMemo({elementType:'title',inputMode:'manual',outputMode:'title'})}))};
    state.loadedWorshipServiceIds=new Set([sid]);state.selectedServiceId=sid;state.module='presenter';state.loading=false;
    preparePresenterService(sid);state.presenter.index=0;state.presenter.outputSessionId='fixture';
    const output={closed:false,postMessage(){}};state.presenter.outputWindow=output;
    const {createGate,id}=await import('./mindex.remote-core.mjs');
    const adapter=MindexRemote.adapter(sid,'fixture',output);
    check(adapter.read().live,'host live');await adapter.execute('next');check(state.presenter.index===1,'real next');
    await adapter.execute('prev');check(state.presenter.index===0,'real previous');
    // Keep real presenter actions; substitute only scripture lookup/network.
    const originalBuild=buildLiveScriptureSlide;
    check(adapter.read().allowed.includes('scripture-show')&&adapter.read().allowed.includes('sermon-title'),'scripture actions missing '+JSON.stringify({slides:state.presenter.slides.map(s=>({id:s.elementId,type:s.type})),items:state.serviceItems[sid].map(i=>({id:i.id,label:i.label,key:i._worshipSectionKey,match:isPresenterPreparationSermonTitleItem(i)}))}));
    buildLiveScriptureSlide=async query=>({type:'scripture',title:query,text:'검증 말씀',layout:'lower-bar-text'});
    await adapter.execute('scripture-show',{query:'요 3:16'});
    check(state.presenter.liveScripture.active&&adapter.read().liveReference==='요 3:16','remote scripture not published');
    await adapter.execute('sermon-title');
    check(state.presenter.slides[state.presenter.index].elementId==='remote-0'&&!state.presenter.liveScripture.active,'real sermon return did not clear overlay');
    for(const query of ['', 'x'.repeat(201), 123]){
     let denied=false;try{await adapter.execute('scripture-show',{query})}catch{denied=true}check(denied,'invalid query allowed');
    }
    const before=state.presenter.liveScripture;
    buildLiveScriptureSlide=async()=>{throw Error('조회 실패')};
    let failed=false;try{await adapter.execute('scripture-show',{query:'요 3:16'})}catch(e){failed=e.message==='조회 실패'}
    check(failed&&state.presenter.liveScripture===before,'lookup failure altered output');
    let finish;buildLiveScriptureSlide=()=>new Promise(resolve=>finish=resolve);
    const pending=adapter.execute('scripture-show',{query:'요 3:16'}).then(()=>false,()=>true);
    runPresenterAction('next',sid,{scroll:false});finish({title:'늦은 말씀',text:'늦음'});
    check(await pending,'late lookup overwrote PC navigation');
    check(!state.presenter.liveScripture.active,'late scripture remained active');
    buildLiveScriptureSlide=originalBuild;
    await adapter.execute('jump',{index:0,key:adapter.read().catalogKey});
    const catalog=adapter.browse({offset:0});check(catalog.total===state.presenter.slides.filter(s=>!presenterSlideIsHidden(s)).length&&catalog.items.length===Math.min(6,catalog.total),'visible catalog');
    check(state.presenter.index===0,'browse does not navigate');
    await adapter.execute('jump',{index:2,key:catalog.key});check(state.presenter.index===2,'real direct jump');
    for(const target of [{index:-1,key:catalog.key},{index:999,key:catalog.key},{index:1.5,key:catalog.key},{index:0,key:'stale'}]){
     let denied=false;try{await adapter.execute('jump',target)}catch{denied=true}check(denied,'invalid jump rejected');
    }
    state.presenter.slides[1].hidden=true;let hiddenDenied=false;try{await adapter.execute('jump',{index:1,key:catalog.key})}catch{hiddenDenied=true}check(hiddenDenied,'hidden jump rejected');state.presenter.slides[1].hidden=false;
    await adapter.execute('jump',{index:0,key:catalog.key});
    const source=state.presenter.sourceSignature;state.presenter.sourceSignature='edited';
    let denied=false;try{await adapter.execute('jump',{index:1,key:catalog.key})}catch{denied=true}check(denied,'old catalog rejected');state.presenter.sourceSignature=source;

    await adapter.execute('blank');check(state.presenter.safetyBlank,'real blackout');
    await adapter.execute('unblank');check(!state.presenter.safetyBlank,'real unblank');
    const audio={paused:true,ended:false,currentTime:12,src:'fixture.wav',pause(){this.paused=true},play(){this.paused=false;return Promise.resolve()},removeAttribute(){this.src=''},load(){}};
    Object.assign(state.serviceMusic,{audio,sourceKey:'fixture.wav',mode:'presenter-audio',ownerServiceId:'',playing:false,pending:false,fadeStop:null,fadeStopEnabled:false,timingGroupId:'fixture-group',autoSyncSuspended:true});
    for(const [i,s] of state.presenter.slides.entries()){s.syncTimeline={groupId:'fixture-group',audioSrc:'fixture.wav',localTiming:true,start:i*10};s.songTimingEligible=true;}
    check(adapter.read().allowed.includes('play'),'eligible sync playback');
    await adapter.execute('play');check(!audio.paused&&state.serviceMusic.playing,'real play');check(state.serviceMusic.mode==='presenter-audio','sync mode retained');
    state.serviceMusic.autoSyncSuspended=true;await adapter.execute('resume');check(!state.serviceMusic.autoSyncSuspended,'real automatic sync resume');
    await adapter.execute('pause');check(audio.paused&&!state.serviceMusic.playing,'real pause');
    await adapter.execute('play');await adapter.execute('stop');check(audio.paused&&audio.currentTime===0,'real stop');
    audio.play=()=>Promise.reject(Error('blocked'));let blocked=false;try{await adapter.execute('play')}catch{blocked=true}check(blocked,'autoplay failure not acknowledged as success');
    for(const patch of [{pending:true},{fadeStop:{active:true}}]){
     Object.assign(state.serviceMusic,{pending:false,fadeStop:null},patch);
     check(!adapter.read().allowed.includes('play'),'busy audio must be locked');
     let rejected=false;try{await adapter.execute('play')}catch{rejected=true}check(rejected,'busy audio must reject execution');
    }
    Object.assign(state.serviceMusic,{pending:false,fadeStop:null});
    const gate=createGate(adapter);let snapshot=gate.connect('phone'),sequence=0;
    const command=action=>({...snapshot,id:id(),sequence:++sequence,action});
    const staleNavigation=command('next'),originalIndex=state.presenter.index;
    runPresenterAction('next',sid,{scroll:false});runPresenterAction('prev',sid,{scroll:false});
    check(state.presenter.index===originalIndex,'local next/prev returns to same slide');
    let stale=false;try{await gate.command('phone',staleNavigation)}catch{stale=true}check(stale,'ABA navigation rejected');
    snapshot=gate.snapshot();const staleAudio=command('play');
    stopServiceMusicPlayback({render:false});
    stale=false;try{await gate.command('phone',staleAudio)}catch{stale=true}check(stale,'same-state local stop invalidates audio command');
    snapshot=gate.snapshot();const fresh=command('next');
    check((await gate.command('phone',fresh)).ok,'fresh remote command');
    const after=state.presenter.index;await gate.command('phone',fresh);check(state.presenter.index===after,'duplicate command cannot move twice');
    const adminAdapter=MindexRemote.adapter(sid,'fixture',output,true),adminGate=createGate(adminAdapter);
    const adminSnapshot=adminGate.connect('admin');snapshot=gate.snapshot();const guestCommand=command('next');
    check((await adminGate.command('admin',{...adminSnapshot,id:id(),sequence:1,action:'next'})).ok,'admin command');
    let crossStale=false;try{await gate.command('phone',guestCommand)}catch{crossStale=true}check(crossStale,'guest stale command after admin refused');
    check(!adapter.read().allowed.includes('output-stop')&&adminAdapter.read().allowed.includes('output-stop'),'admin-only stop');
    state.selectedServiceId='another-editor';check(adminAdapter.read().live&&!adapter.read().live,'admin retains actual output while PC browses another service');state.selectedServiceId=sid;
    const followingGuest=MindexRemote.adapter(sid,'fixture',output,false,true);
    const transferGate=createGate(followingGuest),beforeTransfer=transferGate.connect('returning-phone');
    const oldCatalog=followingGuest.browse({offset:0}).key;
    state.presenter.serviceId='next-output';state.selectedServiceId='next-output';
    check(adminAdapter.read().live&&followingGuest.read().live&&!adapter.read().live,'remote did not follow same-session worship transfer');
    let oldDenied=false;try{await transferGate.command('returning-phone',{...beforeTransfer,id:id(),sequence:1,action:'next'})}catch{oldDenied=true}
    check(oldDenied,'old worship command accepted after transfer');
    check(followingGuest.browse({offset:0}).key!==oldCatalog,'old worship catalog retained');
    transferGate.close();
    const rejoined=createGate(MindexRemote.adapter('next-output','fixture',output,false,true));
    const freshTransfer=rejoined.connect('rejoined-phone'),oldRun=runPresenterAction;
    let operatedService='';runPresenterAction=(action,serviceId)=>{operatedService=serviceId};
    try {
      const result=await rejoined.command('rejoined-phone',{...freshTransfer,id:id(),sequence:1,action:'next'});
      check(result.ok&&operatedService==='next-output','rejoined phone targeted previous worship');
      let replayDenied=false;try{await rejoined.command('rejoined-phone',{...beforeTransfer,id:id(),sequence:2,action:'next'})}catch{replayDenied=true}
      check(replayDenied,'old-session command accepted after rejoin');
    } finally { runPresenterAction=oldRun;rejoined.close(); }
    state.presenter.serviceId=sid;state.selectedServiceId=sid;
    adminGate.close();gate.close();
    output.closed=true;check(!adapter.read().live,'closed output revoked');output.closed=false;
    state.serviceMusic.ownerServiceId='another-service';check(!adapter.read().allowed.includes('play'),'foreign audio protected');
    state.presenter.outputSessionId='new-session';check(!adapter.read().live,'replacement output revoked');clearServiceMusicSyncTimer();
    state.presenter.outputSessionId='fixture';let registrations=0,reports=0,lastInfo=null;
    state.client={async rpc(name,args){if(name!=='mindex_remote_output')return {data:{ok:true}};if(args.p_action==='register'){registrations++;return {data:{ok:true,id:crypto.randomUUID(),token:'fixture'}};}reports++;if(args.p_action==='tick')lastInfo=args.p_info;return {data:{ok:true,link:null}};}};
    const until=async f=>{for(let i=0;i<60;i++){if(f())return;await new Promise(r=>setTimeout(r,100));}throw Error('registry timeout');};
    await until(()=>registrations===1&&reports>0);const beforeReports=reports;window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));await until(()=>reports>beforeReports);check(registrations===1,'page restore keeps output identity');
    // All supported types have a concrete official name, with no title/date fallback.
    const types=Object.values(SERVICE_CATEGORIES).flat();
    for(const type of types){
     const official=serviceTypeDisplayName(type),service={type_id:type,title:'옛 제목',date:'2026-10-18',_worshipSourceRef:{sunday_main_variant:'all_generations',friday_variant_name:'옛 세부명'}};
     check(official&&official!==type&&official!=='예배','missing official name: '+type);
     const original=JSON.stringify(service);
     check(serviceDisplayTypeName(service)===official,'official name: '+type);
     check(serviceDisplayTypeName({...service,alias:'  특별  예배 '})==='특별 예배','alias priority: '+type);
     check(JSON.stringify(service)===original,'name rendering mutated source');
    }
    // Names sent to Remote must use the same display contract as the main app.
    for(const [service,expected] of [
     [{id:sid,type_id:'children',title:''},'어린이부 예배'],
     [{id:sid,type_id:'children',title:'옛 제목'},'어린이부 예배'],
     [{id:sid,type_id:'fixture',title:'저장 제목',alias:'베데스다 예배'},'베데스다 예배'],
     [{id:sid,type_id:'friday',title:'',_worshipSourceRef:{friday_variant_name:'삼삼오오예배'}},'금요기도회'],
     [{id:sid,type_id:'friday',alias:'삼삼오오예배'},'삼삼오오예배'],
     [{id:sid,type_id:'sunday-main',alias:'온세대 찬양예배'},'온세대 찬양예배']
    ]){
     state.services=[service];check(serviceDisplayTypeName(service)===expected,'main display fixture');
     const before=reports;MindexRemote.notify();await until(()=>reports>before&&lastInfo?.title===expected);
    }
    state.services=[];MindexRemote.notify();await until(()=>lastInfo?.title==='예배');
    // A controller identity survives output stop/start; no operational media/window is used.
    state.services=[{id:sid,type_id:'children'}];state.module='presenter';state.selectedServiceId=sid;
    state.presenter.outputWindow=null;state.presenter.outputConnectedAt=0;state.presenter.outputPendingAt=0;state.presenter.outputStopAt=Date.now();
    const host=MindexRemote.hostAdapter(true),guest=MindexRemote.hostAdapter(false);
    check(host.read().outputState==='standby'&&host.read().allowed.includes('output-start'),'standby admin start');
    check(!guest.read().allowed.length,'standby guest cannot operate');
    let guestDenied=false;try{await guest.execute('output-start')}catch{guestDenied=true}check(guestDenied,'guest start rejected');
    MindexRemote.notify();await until(()=>lastInfo?.position==='송출 대기');check(registrations===1,'stop changed registry identity');
    const gateA=createGate(host),gateB=createGate(MindexRemote.hostAdapter(true));
    const snapA=gateA.connect('admin-a'),snapB=gateB.connect('admin-b');
    const savedRun=runPresenterAction;let starts=0,finishStart;
    runPresenterAction=async(action,service,options)=>{
     check(action==='open'&&service===sid&&options.throwOnError,'wrong start path');starts++;
     await new Promise(r=>finishStart=r);if(!options.guard())throw Error('selection changed');
     state.presenter.serviceId=sid;state.presenter.outputSessionId='started';state.presenter.outputGeneration++;
     state.presenter.outputStopAt=0;state.presenter.outputWindow={closed:false,postMessage(){}};
    };
    try{
     const commandA={...snapA,id:id(),sequence:1,action:'output-start'};
     const pending=gateA.command('admin-a',commandA);
     check(host.read().outputState==='starting'&&!host.read().allowed.length,'start lock');
     let duplicateDenied=false;try{await gateB.command('admin-b',{...snapB,id:id(),sequence:1,action:'output-start'})}catch{duplicateDenied=true}
     check(duplicateDenied&&starts===1,'simultaneous start repeated');finishStart();check((await pending).ok,'start failed');
     check(host.read().outputState==='live'&&host.read().allowed.includes('output-stop'),'live actions not restored');
     await gateA.command('admin-a',commandA);check(starts===1,'start replay executed');
     state.presenter.outputWindow=null;state.presenter.outputConnectedAt=0;state.presenter.outputStopAt=Date.now();state.presenter.outputGeneration++;
     check(host.read().outputState==='standby'&&gateA.connected,'stop disconnected controller');
     const next=gateA.snapshot();const cancelled=gateA.command('admin-a',{...next,id:id(),sequence:2,action:'output-start'});
     state.selectedServiceId='changed';finishStart();check(!(await cancelled).ok&&!state.presenter.outputWindow,'selection race started wrong output');
     state.selectedServiceId=sid;
     runPresenterAction=async()=>{throw Error('팝업 허용 필요')};
     const failed=await gateA.command('admin-a',{...gateA.snapshot(),id:id(),sequence:3,action:'output-start'});
     check(!failed.ok&&failed.message.includes('팝업')&&host.read().allowed.includes('output-start'),'failure recovery');
     MindexRemote.notify();await until(()=>lastInfo?.position==='송출 대기');check(registrations===1,'restart changed code identity');
    }finally{runPresenterAction=savedRun;gateA.close();gateB.close();}
    const savedPreflight=MindexPresenterFreshness.beforeOpen,originalItems=JSON.stringify(state.serviceItems);
    MindexPresenterFreshness.beforeOpen=async(service,options)=>{
     check(service===sid&&options.guard(),'actual open lost guard');
     state.presenter.outputWindow={closed:false,postMessage(){},focus(){},close(){this.closed=true}};
     return true;
    };
    try{
     await host.execute('output-start');check(isPresenterOutputWindowOpen(),'actual start did not open');
     state.presenter.outputPendingAt=0;state.presenter.outputConnectedAt=Date.now();
     await host.execute('output-stop');check(!isPresenterOutputWindowOpen()&&host.read().outputState==='standby','actual stop did not return standby');
     await host.execute('output-start');check(isPresenterOutputWindowOpen(),'actual restart failed');
     check(JSON.stringify(state.serviceItems)===originalItems,'start/stop changed worship data');
    }finally{MindexPresenterFreshness.beforeOpen=savedPreflight;state.presenter.outputWindow=null;state.presenter.outputPendingAt=0;state.presenter.outputConnectedAt=0;state.presenter.outputStopAt=Date.now();stopPresenterOutputWindowMonitor();}


    window.dispatchEvent(new PageTransitionEvent('pagehide'));state.client=null;
    return 'PASS shared worship names in registry; page restore registration; real navigation/blackout/music/auto-sync adapter, source ownership, autoplay failure and output identity';
   }'''),flush=True)
   browser.close()
finally:server.shutdown()
