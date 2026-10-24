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
    adminGate.close();gate.close();
    output.closed=true;check(!adapter.read().live,'closed output revoked');output.closed=false;
    state.serviceMusic.ownerServiceId='another-service';check(!adapter.read().allowed.includes('play'),'foreign audio protected');
    state.presenter.outputSessionId='new-session';check(!adapter.read().live,'replacement output revoked');clearServiceMusicSyncTimer();
    state.presenter.outputSessionId='fixture';let registrations=0,reports=0;
    state.client={async rpc(name,args){if(name!=='mindex_remote_output')return {data:{ok:true}};if(args.p_action==='register'){registrations++;return {data:{ok:true,id:crypto.randomUUID(),token:'fixture'}};}reports++;return {data:{ok:true,link:null}};}};
    const until=async f=>{for(let i=0;i<60;i++){if(f())return;await new Promise(r=>setTimeout(r,100));}throw Error('registry timeout');};
    await until(()=>registrations===1&&reports>0);const beforeReports=reports;window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true}));window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true}));await until(()=>reports>beforeReports);check(registrations===1,'page restore keeps output identity');
    window.dispatchEvent(new PageTransitionEvent('pagehide'));state.client=null;
    return 'PASS page restore registration; real navigation/blackout/music/auto-sync adapter, source ownership, autoplay failure and output identity';
   }'''),flush=True)
   browser.close()
finally:server.shutdown()
