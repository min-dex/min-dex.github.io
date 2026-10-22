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
    const adapter=MindexRemote.adapter(sid,'fixture',output);
    check(adapter.read().live,'host live');await adapter.execute('next');check(state.presenter.index===1,'real next');
    await adapter.execute('prev');check(state.presenter.index===0,'real previous');
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
    output.closed=true;check(!adapter.read().live,'closed output revoked');output.closed=false;
    state.serviceMusic.ownerServiceId='another-service';check(!adapter.read().allowed.includes('play'),'foreign audio protected');
    state.presenter.outputSessionId='new-session';check(!adapter.read().live,'replacement output revoked');clearServiceMusicSyncTimer();
    return 'PASS real navigation/blackout/music/auto-sync adapter, source ownership, autoplay failure and output identity';
   }'''),flush=True)
   browser.close()
finally:server.shutdown()
