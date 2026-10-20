"""Offline shared seek, focused progress, dragging and transport ownership."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1280,'height':800})
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url.rsplit('/',1)[0]+'/') else r.abort())
   page.goto(url+'?mindexSmokeRaw=1')
   page.wait_for_function("typeof handleNavigationRailClick==='function'&&!document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{
    state.client={};state.connectionError='';state.serviceError='';state.serviceTypes=[{id:'sunday-main',name:'주일예배 [3부]'}];state.services=[];
    state.scriptures=[{id:'fixture',title:'Fixture',text:'Original'}];state.scripturesLoaded=true;state.scriptureBooks=[{code:'GEN',koreanName:'창세기',englishName:'Genesis'}];
    state.bibleTranslations=[{id:'fixture',name:'개역개정'}];state.selectedBibleTranslationId='fixture';
    state.songs=[];songCatalogLoaded=true;state.calendarLoaded=true;state.calendarData=[{date:'2026-10-25',liturgical:'Fixture'}];
    state.referenceLinksLoaded=true;state.referenceLinks=[];state.uiVerses={};
    window.fixtureOriginalRecords=JSON.stringify([state.services,state.scriptures,state.songs,state.calendarData]);
    window.fixtureTransport=JSON.stringify([state.presenter,state.serviceMusic]);
    clearDirtyState();render();
   }''')
   print(engine,page.evaluate("""()=>{
    const check=(v,m)=>{if(!v)throw Error(m)};
    const audio=getServiceMusicAudio();
    Object.defineProperty(audio,'currentTime',{configurable:true,writable:true,value:0});
    Object.defineProperty(audio,'duration',{configurable:true,value:120});
    state.serviceMusic.sourceKey='fixture-track';state.serviceMusic.mode='manual';state.serviceMusic.ownerServiceId='owner';state.serviceMusic.playing=false;
    renderGlobalPlaybackControls();
    let input=document.querySelector('[data-song-timing-seek]');
    check(input&&!input.disabled&&Number(input.max)===120,'generic transport unavailable');
    input.value='42';input.dispatchEvent(new Event('input',{bubbles:true}));
    check(audio.currentTime===42&&!state.serviceMusic.playing&&state.serviceMusic.ownerServiceId==='owner','seek changed playback/owner');
    check(!document.querySelector('[data-song-timing-resume]'),'manual audio offers sync resume');
    state.serviceMusic.playing=true;input.focus();audio.currentTime=45;MindexSongTiming.updateTransport(audio);
    check(Number(input.value)===45,'focused slider stopped following playback');
    input.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));input.value='50';audio.currentTime=47;MindexSongTiming.updateTransport(audio);
    check(Number(input.value)===50,'clock fought pointer drag');
    document.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));
    check(Number(input.value)===47&&state.serviceMusic.playing,'release failed to follow playing clock');
    input.value='60';input.dispatchEvent(new Event('input',{bubbles:true}));
    check(audio.currentTime===60&&state.serviceMusic.playing,'seek stopped playback');
    for(const module of ['home','praise','scripture','bulletin']) {state.module=module;render();check(state.serviceMusic.audio===audio&&audio.currentTime===60&&state.serviceMusic.playing&&state.serviceMusic.ownerServiceId==='owner','navigation reset transport');}
    input=document.querySelector('[data-song-timing-seek]');

    input.dataset.source='stale';input.value='60';input.dispatchEvent(new Event('input',{bubbles:true}));
    check(audio.currentTime===60,'stale source changed audio');
    input.dataset.source='fixture-track';
    Object.defineProperty(audio,'duration',{configurable:true,value:Infinity});
    audio.dispatchEvent(new Event('durationchange'));check(input.disabled&&Number(input.max)===0,'unbounded duration');
    Object.defineProperty(audio,'duration',{configurable:true,value:90});
    audio.dispatchEvent(new Event('loadedmetadata'));check(!input.disabled&&Number(input.max)===90,'metadata did not enable seeking');
    const dot=document.querySelector('.global-playback-indicator');check(getComputedStyle(dot).position==='absolute','indicator reserves space');
    return 'PASS manual seek, owner/pause preservation, stale source, unknown duration, metadata, compact button';
   }"""),flush=True)
   page.locator('.global-playback-trigger').click()
   for theme in ('light','dark'):
    page.evaluate('(t)=>applyTheme(t)',theme)
    for width in (1280,390):
     page.set_viewport_size({'width':width,'height':800})
     assert page.locator('#globalPlaybackPanel').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
     assert page.locator('[data-song-timing-seek]').evaluate('(e)=>e.getBoundingClientRect().width>250')
   browser.close()
finally:server.shutdown()
