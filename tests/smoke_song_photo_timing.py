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

 renderPresenterControlState=()=>{};publishPresenterState=()=>{};
 state.presenter.serviceId=service.id;state.presenter.sourceSignature='';state.presenter.slides=[];
 state.client.storage={};saveServiceItemMutation=async()=>true;
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
    if r.request.url.endswith('/fixture-clock.wav'):
     mime='audio/mpeg' if os.environ.get('MINDEX_TIMING_AUDIO_FILE') else 'audio/wav'
     range_header=r.request.headers.get('range','')
     if range_header.startswith('bytes='):
      first,last=range_header[6:].split('-');start=int(first or 0);end=min(int(last) if last else len(audio_bytes)-1,len(audio_bytes)-1)
      r.fulfill(status=206,body=audio_bytes[start:end+1],content_type=mime,headers={'Accept-Ranges':'bytes','Content-Range':f'bytes {start}-{end}/{len(audio_bytes)}'})
     else:r.fulfill(body=audio_bytes,content_type=mime,headers={'Accept-Ranges':'bytes'})
     return
    if r.request.method not in ('GET','HEAD'):writes.append(r.request.url);r.abort()
    elif urlsplit(r.request.url).netloc==urlsplit(url).netloc or r.request.url.startswith('blob:'):r.continue_()
    else:r.abort()
   page.route('**/*',route)
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof buildPresenterSlidesForServiceItem==='function' && !!globalThis.MindexSongTiming")
   page.wait_for_function("!document.body.classList.contains('ui-booting')");page.locator('#bootStatus').wait_for(state='hidden')
   for width in (390,600,800,1100):
    page.set_viewport_size({'width':width,'height':800})
    page.evaluate("void confirmUnsavedChangesAction().then(value=>window.popupChoice=value)")
    unsaved=page.locator('.unsaved-dialog')
    assert unsaved.locator('[data-unsaved-action]').count()==3
    assert unsaved.locator('.unsaved-dialog-copy p').count()==0
    assert unsaved.evaluate('(el)=>el.scrollWidth<=el.clientWidth+1')
    unsaved.screenshot(path=f'/tmp/mindex-popup-unsaved-{engine}-{width}.png')
    unsaved.locator('[data-unsaved-action="cancel"]').click()
    page.wait_for_function('window.popupChoice === "cancel"')
   ids=page.evaluate(fixture)
   page.evaluate('({serviceId,elementId})=>MindexSongTiming.open(serviceId,elementId)',ids)
   d=page.locator('[data-song-timing-dialog]');assert '예배 음원' in d.locator('h2').inner_text()
   d.locator('[data-timing-filename]').evaluate("e=>e.textContent='아주긴파일명LongFileName'.repeat(35)+'.wav'")
   d.locator('.song-timing-row label').first.evaluate("e=>e.prepend('공백없는긴가사LongLyrics'.repeat(35))")
   assert d.locator('.song-timing-photo').count()>=4
   assert d.locator('[data-photo-names]').count()==0
   for width in (390,600,800,1100):
    page.set_viewport_size({'width':width,'height':800})
    help=d.locator('[data-beat-help]')
    assert not help.evaluate('el=>el.open')
    help.locator('summary').focus();page.keyboard.press('Enter')
    assert help.evaluate('el=>el.open')
    assert '구간별로 기준 박' in help.inner_text()
    assert '기존 시각은 유지' in d.locator('[data-beat-status]').inner_text()
    assert d.evaluate('(el)=>el.scrollWidth<=el.clientWidth+1')
    d.locator('.song-timing-beats').screenshot(path=f'/tmp/mindex-popup-beat-{engine}-{width}.png')
    help.locator('summary').click()

   d.locator('[data-timing-linked]').click()
   page.wait_for_function("document.querySelector('[data-song-timing-dialog] audio').duration>90")
   count=d.locator('[data-timing-start]').count();assert count>10
   # Sequential stamp button records the actual preview audio clock.
   for i in range(count):
    page.evaluate('(t)=>{document.querySelector("[data-song-timing-dialog] audio").currentTime=t}',i*3)
    d.locator('[data-timing-next]').click()
    assert float(d.locator(f'[data-timing-start="{i}"]').input_value())==i*3
   d.locator('[data-timing-save]').click();page.wait_for_function("document.querySelector('[data-timing-status]').textContent.includes('저장했습니다.')")
   page.evaluate('photoTimingSnapshot=JSON.stringify({services:state.services,songs:state.songs,items:state.serviceItems})')
   for width in (390,600,800,1100):
    page.set_viewport_size({'width':width,'height':800});assert d.evaluate('(el)=>el.scrollWidth<=el.clientWidth+1')
    d.screenshot(path=f'/tmp/mindex-photo-timing-{engine}-{width}.png')
   d.evaluate('(el)=>el.scrollTop=0');d.screenshot(path=f'/tmp/mindex-photo-timing-{engine}-top.png')
   d.locator('[data-timing-close]').click()
   page.evaluate('''()=>{const {serviceId,elementId}=photoTiming;isPresenterOutputWindowOpen=()=>true;
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
    try:page.wait_for_function('(i)=>state.presenter.index===i',arg=t['i'])
    except Exception:
     print('SEEK FAILURE',t,page.evaluate('({index:state.presenter.index,time:state.serviceMusic.audio.currentTime,playing:state.serviceMusic.playing,mode:state.serviceMusic.mode,source:state.serviceMusic.sourceKey})'));raise
   print(engine,'PASS actual audio playback, photo and lyric advance, backward seek')
   page.evaluate('stopServiceMusicPlayback({render:false})')
   before=page.evaluate('state.presenter.index');page.evaluate('state.serviceMusic.audio.currentTime=90');page.wait_for_timeout(250);assert page.evaluate('state.presenter.index')==before
   print(engine,page.evaluate(r'''async()=>{
    const check=(v,m)=>{if(!v)throw Error(m)},T=MindexSongTiming,{serviceId,elementId}=photoTiming;
    const slides=presenterSlidesForService(serviceId),pages=T.pagesFor(slides.filter(s=>(s.progressionParentId||s.elementId)===elementId));
    check(pages.every(s=>s.syncTimeline?.serviceTiming && s.syncTimeline.lead===(s.type==='blank'||/^[\s♪♫♬♩]*$/.test(s.text||'')?0:1)),'lyric lead / instrumental photo timing wrong');
    for(let i=1;i<pages.length;i++){
     const at=slides.indexOf(pages[i-1]),time=Math.max(0,pages[i].syncTimeline.start-pages[i].syncTimeline.lead);
     check(presenterSyncedLyricsTargetForTime(slides,at,time-.01).slide.id===pages[i-1].id,'early transition');
     check(presenterSyncedLyricsTargetForTime(slides,at,time).slide.id===pages[i].id,'missed transition');
    }
    check(JSON.stringify({services:state.services,songs:state.songs,items:state.serviceItems})===photoTimingSnapshot,'source data changed');
    const svc={...state.services[0],id:'other-service'};state.services.push(svc);state.serviceItems[svc.id]=structuredClone(state.serviceItems[serviceId]);
    check(presenterSlidesForService(svc.id).some(s=>s.syncTimeline?.serviceTiming),'copied worship bundle lost timeline');
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
    runPresenterAction('next',serviceId,{scroll:false});check(state.serviceMusic.playing && state.serviceMusic.autoSyncSuspended,'manual must keep music and suspend sync');
    return 'PASS one-second lyric lead and exact instrumental photo cues, copied bundle, photo reorder stale guard, blackout/scripture guards, manual auto-sync release, no external DB writes';
   }'''))
   # Persisted timing and audio survive a browser reload, with identical fixture identity.
   snapshot=page.evaluate('photoTimingSnapshot')
   page.reload();page.wait_for_function("typeof buildPresenterSlidesForServiceItem==='function' && !!globalThis.MindexSongTiming")
   page.evaluate('''async data=>{const saved=JSON.parse(data.snapshot);state.services=saved.services;state.songs=saved.songs;state.serviceItems=saved.items;state.selectedServiceId=data.ids.serviceId;state.loadedWorshipServiceIds=new Set([data.ids.serviceId]);state.client={storage:{},from(){throw Error('DB forbidden')}};saveServiceItemMutation=async()=>true;renderPresenterControlState=()=>{};publishPresenterState=()=>{};}''',{'snapshot':snapshot,'ids':ids})
   assert page.evaluate('(id)=>presenterSlidesForService(id).some(s=>s.syncTimeline?.serviceTiming)',ids['serviceId'])
   page.evaluate('({serviceId,elementId})=>MindexSongTiming.open(serviceId,elementId)',ids)
   page.locator('[data-timing-enabled]').uncheck();page.locator('[data-timing-save]').click()
   page.wait_for_function("document.querySelector('[data-timing-status]').textContent.includes('저장했습니다.')")
   assert not page.evaluate('(id)=>presenterSlidesForService(id).some(s=>s.syncTimeline?.serviceTiming)',ids['serviceId'])
   assert not writes,writes
   print(engine,'PASS saved profile reload; zero external writes')
   browser.close()
finally:server.shutdown()
