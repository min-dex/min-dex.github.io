"""Offline recorded audio clock through lyrics + form photos; no production writes."""
import ast, io, os, wave
from pathlib import Path
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server, sync_playwright, launch_chromium
# Reuse the established repeated-form placement fixture, stopping before its assertions.
source=ast.parse(Path(__file__).with_name('smoke_progression_media.py').read_text())
script=next(ast.literal_eval(n.value) for n in source.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SCRIPT' for t in n.targets))
fixture=script.split(' const build=items=>')[0]+r'''
 const lyricsMedia=addPresenterReferenceMedia(service.id,'praise',{afterItemId:parent.id,mediaPlacement:{...placement,formKey:plan.groups[6].key},render:false,focus:false});
 const lm=parseServiceItemMemo(lyricsMedia.memo);lm.asset={...mediaMemo.asset,slides:mediaMemo.asset.slides.map(s=>({...s,url:s.url+'?chorus=1'}))};lyricsMedia.memo=serializeServiceItemMemo(lm);
 const liveParent=getServiceItems(service.id).find(i=>i.id===parent.id);const pm=parseServiceItemMemo(liveParent.memo);pm.audioAsset={kind:'audio',name:'fixture-clock.wav',url:location.origin+'/fixture-clock.wav'};liveParent.memo=serializeServiceItemMemo(pm);
 await MindexSongTiming.ready;
 renderPresenterControlState=()=>{};publishPresenterState=()=>{};
 state.presenter.serviceId=service.id;state.presenter.sourceSignature='';state.presenter.slides=[];
 window.photoTiming={serviceId:service.id,elementId:parent.id};
 window.photoTimingSnapshot=JSON.stringify({services:state.services,songs:state.songs,items:state.serviceItems});
 return photoTiming;
}'''
buffer=io.BytesIO()
with wave.open(buffer,'wb') as wav:
 wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(8000);wav.writeframes(b'\0\0'*8000*120)
audio_bytes=Path(os.environ['MINDEX_TIMING_AUDIO_FILE']).read_bytes() if os.environ.get('MINDEX_TIMING_AUDIO_FILE') else buffer.getvalue()
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1100,'height':800});page.set_default_timeout(15000)
   writes=[]
   def route(r):
    if r.request.url.endswith('/fixture-clock.wav'):r.fulfill(body=audio_bytes,content_type='audio/mpeg' if os.environ.get('MINDEX_TIMING_AUDIO_FILE') else 'audio/wav');return
    if r.request.method not in ('GET','HEAD'):writes.append(r.request.url);r.abort()
    elif urlsplit(r.request.url).netloc==urlsplit(url).netloc or r.request.url.startswith('blob:'):r.continue_()
    else:r.abort()
   page.route('**/*',route)
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof buildPresenterSlidesForServiceItem==='function' && !!globalThis.MindexSongTiming")
   page.wait_for_function("!document.body.classList.contains('ui-booting')");page.locator('#bootStatus').wait_for(state='hidden')
   ids=page.evaluate(fixture)
   page.evaluate('({serviceId,elementId})=>MindexSongTiming.open(serviceId,elementId)',ids)
   d=page.locator('[data-song-timing-dialog]');assert '가사·사진' in d.locator('h2').inner_text()
   assert d.locator('.song-timing-photo').count()>=4
   d.locator('[data-timing-linked]').click()
   page.wait_for_function("document.querySelector('[data-song-timing-dialog] audio').duration>90")
   count=d.locator('[data-timing-start]').count();assert count>10
   # Sequential stamp button records the actual preview audio clock.
   for i in range(count):
    page.evaluate('(t)=>{document.querySelector("[data-song-timing-dialog] audio").currentTime=t}',i*3)
    d.locator('[data-timing-next]').click()
    assert float(d.locator(f'[data-timing-start="{i}"]').input_value())==i*3
   d.locator('[data-timing-save]').click();page.wait_for_function("document.querySelector('[data-timing-status]').textContent.includes('저장했어요')")
   for width in (390,1100):
    page.set_viewport_size({'width':width,'height':800});assert d.evaluate('(el)=>el.scrollWidth<=el.clientWidth+1')
    d.screenshot(path=f'/tmp/mindex-photo-timing-{engine}-{width}.png')
   d.evaluate('(el)=>el.scrollTop=0');d.screenshot(path=f'/tmp/mindex-photo-timing-{engine}-top.png')
   d.locator('[data-timing-close]').click()
   page.evaluate('''()=>{const {serviceId,elementId}=photoTiming;
    const entries=presenterSlidesForService(serviceId).map(slide=>({slide}));
    refs.detailPane.innerHTML=MindexSongTiming.controls(serviceId,entries);
   }''')
   page.evaluate("state.serviceMusic.objectUrl='blob:unrelated-manual-audio'")
   page.locator('[data-song-timing-play]').first.click()
   page.wait_for_function('state.serviceMusic.playing && state.serviceMusic.audio.currentTime>0')
   targets=page.evaluate('''()=>state.presenter.slides.map((s,i)=>({i,page:s.syncTimeline?.page,time:s.syncTimeline?.start,photo:!!s.formBackgroundImage,text:s.text})).filter(s=>s.page>0)''')
   photos=[t for t in targets if t['photo']];assert len(photos)>=4
   for t in [photos[0],photos[-1],targets[-1],targets[0]]:
    page.evaluate('''t=>{const input=document.querySelector('[data-song-timing-seek]');if(!input)throw Error('seek control missing');input.max=state.serviceMusic.audio.duration;input.value=t;input.dispatchEvent(new Event('input',{bubbles:true}));}''',t['time']+.15)
    page.wait_for_function('(i)=>state.presenter.index===i',arg=t['i'])
   print(engine,'PASS actual audio playback, photo and lyric advance, backward seek')
   page.evaluate('stopServiceMusicPlayback({render:false})')
   before=page.evaluate('state.presenter.index');page.evaluate('state.serviceMusic.audio.currentTime=90');page.wait_for_timeout(250);assert page.evaluate('state.presenter.index')==before
   print(engine,page.evaluate(r'''async()=>{
    const check=(v,m)=>{if(!v)throw Error(m)},T=MindexSongTiming,{serviceId,elementId}=photoTiming;
    const slides=presenterSlidesForService(serviceId),pages=T.pagesFor(slides.filter(s=>(s.progressionParentId||s.elementId)===elementId));
    check(pages.every(s=>s.syncTimeline?.serviceTiming && s.syncTimeline.lead===0),'exact timing missing');
    for(let i=1;i<pages.length;i++){
     const at=slides.indexOf(pages[i-1]),time=pages[i].syncTimeline.start;
     check(presenterSyncedLyricsTargetForTime(slides,at,time-.01).slide.id===pages[i-1].id,'early transition');
     check(presenterSyncedLyricsTargetForTime(slides,at,time).slide.id===pages[i].id,'missed transition');
    }
    check(JSON.stringify({services:state.services,songs:state.songs,items:state.serviceItems})===photoTimingSnapshot,'source data changed');
    const svc={...state.services[0],id:'other-service'};state.services.push(svc);state.serviceItems[svc.id]=structuredClone(state.serviceItems[serviceId]);
    check(!presenterSlidesForService(svc.id).some(s=>s.syncTimeline?.serviceTiming),'other service inherited timeline');
    state.services.pop();delete state.serviceItems[svc.id];
    const media=getServiceItems(serviceId).find(i=>parseServiceItemMemo(i.memo).mediaPlacement),original=media.memo;
    let memo=parseServiceItemMemo(media.memo);memo.asset.slides.reverse().forEach((s,i)=>s.order=i+1);media.memo=serializeServiceItemMemo(memo);
    check(!presenterSlidesForService(serviceId).some(s=>s.syncTimeline?.serviceTiming),'photo reorder not invalidated');
    media.memo=original;
    const parent=getServiceItems(serviceId).find(i=>i.id===elementId),parentMemo=parent.memo;
    const changed=parseServiceItemMemo(parentMemo);changed.audioAsset.url+='?replacement';parent.memo=serializeServiceItemMemo(changed);
    check(!presenterSlidesForService(serviceId).some(s=>s.syncTimeline?.serviceTiming),'changed audio connection inherited old timeline');
    parent.memo=parentMemo;
    check(presenterSlidesForService(serviceId).some(s=>s.syncTimeline?.serviceTiming),'restored order unavailable');
    state.presenter.safetyBlank=true;state.serviceMusic.playing=true;
    check(!syncServiceMusicSyncedLyricsWithCurrentTime({render:false,publish:false,scroll:false}),'blackout advanced');
    state.presenter.safetyBlank=false;state.presenter.liveScripture={active:true};
    check(!syncServiceMusicSyncedLyricsWithCurrentTime({render:false,publish:false,scroll:false}),'scripture advanced');
    state.presenter.liveScripture.active=false;
    runPresenterAction('next',serviceId,{scroll:false});check(!state.serviceMusic.playing,'manual did not pause');
    return 'PASS exact cues, isolated service, photo reorder stale guard, blackout/scripture guards, manual pause, unchanged DB records';
   }'''))
   # Persisted timing and audio survive a browser reload, with identical fixture identity.
   snapshot=page.evaluate('photoTimingSnapshot')
   page.reload();page.wait_for_function("typeof buildPresenterSlidesForServiceItem==='function' && !!globalThis.MindexSongTiming")
   page.evaluate('''async data=>{await MindexSongTiming.ready;const saved=JSON.parse(data.snapshot);state.services=saved.services;state.songs=saved.songs;state.serviceItems=saved.items;state.selectedServiceId=data.ids.serviceId;state.loadedWorshipServiceIds=new Set([data.ids.serviceId]);state.client={from(){throw Error('DB forbidden')}};renderPresenterControlState=()=>{};publishPresenterState=()=>{};}''',{'snapshot':snapshot,'ids':ids})
   assert page.evaluate('(id)=>presenterSlidesForService(id).some(s=>s.syncTimeline?.serviceTiming)',ids['serviceId'])
   page.evaluate('({serviceId,elementId})=>MindexSongTiming.open(serviceId,elementId)',ids)
   page.locator('[data-timing-enabled]').uncheck();page.locator('[data-timing-save]').click()
   page.wait_for_function("document.querySelector('[data-timing-status]').textContent.includes('저장했어요')")
   assert not page.evaluate('(id)=>presenterSlidesForService(id).some(s=>s.syncTimeline?.serviceTiming)',ids['serviceId'])
   assert not writes,writes
   print(engine,'PASS saved profile reload; zero external writes')
   browser.close()
finally:server.shutdown()
