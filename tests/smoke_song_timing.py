"""Isolated Elem timing integration: no remote requests or production records."""
import io
import os
import wave
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server, sync_playwright, launch_chromium
fixture = r'''async () => {
 await MindexSongTiming.ready;
 // Output-only test shell has no controller panel or external display.
 renderPresenterControlState=()=>{};publishPresenterState=()=>{};
 const service={id:'timing-fixture',type_id:'wednesday',date:'2026-10-14',title:'Timing fixture'};
 const song={id:'timing-song',title:'동기화 테스트',_relationalVersionsLoaded:true,versions:[{id:'timing-version',name:'Default',_worshipVersionPersisted:true,is_primary:true,praise_types:['children'],forms:[
 {id:'verse',part_type:'Verse',part_number:1,lyrics:'첫째 줄\n둘째 줄',sort_order:1},
 {id:'chorus',part_type:'Chorus',lyrics:'후렴 첫째\n후렴 둘째',sort_order:2}]}]};
 const item={id:'timing-item',service_id:service.id,label:'찬양 1',raw_title:song.title,song_id:song.id,version_id:'timing-version',sort_order:10,
 _worshipSectionKey:'praise',_worshipSectionTitle:'찬양',_worshipSlotKey:'praise.song.1',_worshipElementTemplateModified:true,
 memo:serializeServiceItemMemo({elementType:'praise',inputMode:'children_audio',outputMode:'lyrics',forms:['V1','C']})};
 const second={...item,id:'medley-member',label:'찬양 2',sort_order:20,_worshipSlotKey:'praise.song.2',memo:serializeServiceItemMemo({...parseServiceItemMemo(item.memo),connectedPraise:{groupId:'fixture-medley',order:1}})};
 state.services=[service];state.songs=[song];state.serviceItems={[service.id]:[item,second]};state.selectedServiceId=service.id;
 state.presenter.serviceId=service.id;state.presenter.sourceSignature='';state.presenter.slides=[];state.module='presenter';
 state.loadedWorshipServiceIds=new Set([service.id]);
 state.client={from(){throw Error('DB access forbidden')},rpc(){throw Error('DB access forbidden')}};
 const slides=presenterSlidesForService(service.id);
 window.timingFixtureBefore=JSON.stringify({songs:state.songs,items:state.serviceItems});
 if(!slides.some(s=>s.songTimingKey))throw Error('No timing-enabled lyrics: '+JSON.stringify(slides.map(s=>[s.type,s.text])));
 return slides.filter(s=>s.elementId===item.id).map(s=>({type:s.type,text:s.text}));
}'''
remote_url=os.environ.get('MINDEX_TIMING_URL','').rstrip('/')
server,url=(None,remote_url+'/') if remote_url else start_local_app_server()
buffer=io.BytesIO()
with wave.open(buffer,'wb') as wav:
 wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(8000);wav.writeframes(b'\0\0'*8000*20)
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   try:
    page=browser.new_page()
    page.set_default_timeout(8000)
    blocked_writes=[]
    def route(request):
     if request.request.method not in ('GET','HEAD'):
      blocked_writes.append(request.request.url);request.abort();return
     if urlsplit(request.request.url).netloc==urlsplit(url).netloc or request.request.url.startswith('blob:'): request.continue_()
     else: request.abort()
    page.route('**/*',route)
    page.goto(url+'?output=presenter&mindexSmokeRaw=1')
    page.wait_for_function("typeof buildPresenterSlidesForServiceItem==='function' && !!globalThis.MindexSongTiming")
    print(engine,page.evaluate(fixture))
    page.evaluate("MindexSongTiming.open('timing-fixture','timing-item')")
    dialog=page.locator('[data-song-timing-dialog]')
    dialog.locator('[data-timing-file]').set_input_files({'name':'fixture.wav','mimeType':'audio/wav','buffer':buffer.getvalue()})
    page.wait_for_function("Math.abs(document.querySelector('[data-song-timing-dialog] audio').duration-20)<0.1")
    inputs=dialog.locator('[data-timing-start]')
    assert inputs.count()==2
    page.evaluate("async()=>{const audio=document.querySelector('[data-song-timing-dialog] audio');audio.muted=true;await audio.play();audio.pause();audio.currentTime=2;}")
    page.wait_for_function("Math.abs(document.querySelector('[data-song-timing-dialog] audio').currentTime-2)<0.1")
    dialog.locator('[data-timing-stamp=\"0\"]').click()
    assert float(inputs.nth(0).input_value())==2
    inputs.nth(1).fill('8')
    dialog.locator('[data-timing-save]').click()
    page.wait_for_function("!document.querySelector('[data-timing-save]').disabled")
    print('save status',dialog.locator('[data-timing-status]').text_content(),flush=True)
    page.wait_for_function("document.querySelector('[data-timing-status]').textContent.includes('저장했어요')")
    dialog.screenshot(path='/tmp/mindex-song-timing-'+engine+'.png')
    dialog.locator('[data-timing-close]').click()
    print(engine,page.evaluate(r'''() => {
      const check=(ok,msg)=>{if(!ok)throw Error(msg)};
      check(JSON.stringify(SERVICE_PRAISE_INPUT_MODES.map(x=>x[1]))===JSON.stringify(['가사 로드','가사 직접 입력','찬송가: 악보 로드','어린이: 음원 로드']),'four labels/order');
      check(servicePraiseInputMode({label:'찬양 1'})==='lyrics_db','default mode');
      const service=state.services[0],song=state.songs[0];
      let item=getServiceItems(service.id).find(x=>x.id==='timing-item');
      updateSaveState=()=>{};renderCurrentServiceModuleDetail=()=>{};
      const originalItems=structuredClone(state.serviceItems[service.id]);
      const memo=item.memo,identity=JSON.stringify([item.id,item.song_id,item.version_id,item.sort_order]);
      const setMode=mode=>{updateServiceItemField({value:mode,dataset:{serviceId:service.id,serviceItemIndex:String(getServiceItems(service.id).findIndex(x=>x.id==='timing-item')),serviceItemField:'praise_input_mode'}});item=getServiceItems(service.id).find(x=>x.id==='timing-item');};
      const lyrics=()=>presenterSlidesForService(service.id).filter(s=>s.elementId===item.id&&s.type==='lyrics');
      setMode('lyrics_db');
      check(lyrics().every(s=>!s.syncTimeline?.localTiming),'ordinary lyrics enabled audio');
      item.memo=serializeServiceItemMemo({...parseServiceItemMemo(item.memo),forms:['C','V1'],formHint:'C-V1'});
      setMode('children_audio');
      check(lyrics()[0]?.text.startsWith('첫째'),'saved set form was replaced by worship form');
      check(lyrics().every(s=>s.syncTimeline?.localTiming),'saved set failed after mode switch');
      check(JSON.stringify([item.id,item.song_id,item.version_id,item.sort_order])===identity,'mode changed identity/order');
      const ordinary={...song,versions:[{...song.versions[0],praise_types:['ccm']}]};
      check(serviceSelectableSongVersions(ordinary,item,service).length===0,'nonchildren version accepted');
      const typed={inputMode:true,contentState:true};
      const rows=buildWorshipPersistenceRows(service,[item],{}, {},{elementTypedStateColumns:typed});
      sanitizeWorshipPersistenceRows(rows,{elementTypedStateColumns:typed});compactWorshipPersistenceRows(rows);
      const reopened=groupWorshipElements(rows.sections,rows.elements)[service.id].find(x=>x.song_id===song.id);
      check(reopened&&servicePraiseInputMode(reopened,parseServiceItemMemo(reopened.memo),service)==='children_audio','mode lost on persistence round trip '+JSON.stringify({rows:rows.elements,reopened}));
      check(reopened.version_id===item.version_id,'version link lost on persistence round trip');
      state.serviceItems[service.id]=originalItems;
      return 'PASS four modes/default, children-only versions, mode switch identity, designated form and persistence round trip';
    }'''))
    # Real controller audio/timeupdate path, before deterministic clock boundary checks.
    page.evaluate("""() => {
      state.presenter.safetyBlank=false;state.presenter.liveScripture={active:false};
      state.presenter.index=presenterSlidesForService('timing-fixture').findIndex(s=>s.elementId==='timing-item'&&s.type==='lyrics');
      const play=document.createElement('button');play.id='fixture-play';play.textContent='Play';play.style.cssText='position:fixed;top:0;left:0;z-index:2147483647';play.onclick=()=>runServiceMusicAction('toggle');document.body.append(play);
    }""")
    page.locator('#fixture-play').click()
    page.wait_for_function("state.serviceMusic.playing && state.serviceMusic.audio.currentTime>0")
    page.evaluate("state.serviceMusic.audio.currentTime=7.1")
    page.wait_for_function("state.presenter.slides[state.presenter.index]?.syncTimeline?.page===2")
    page.evaluate("stopServiceMusicPlayback({render:false})")
    print(engine,'PASS real controller playback and timeupdate automatic advance')
    print(engine,page.evaluate(r'''() => {
      const check=(ok,msg)=>{if(!ok)throw Error(msg)};
      const slides=presenterSlidesForService('timing-fixture');
      const first=slides.findIndex(s=>s.elementId==='timing-item'&&s.type==='lyrics');
      const lyrics=slides.filter(s=>s.elementId==='timing-item'&&s.type==='lyrics');
      check(lyrics.length===2 && lyrics.every(s=>s.syncTimeline?.localTiming),'runtime timing missing');
      check(presenterSlideAudioSource(lyrics[0]).startsWith('blob:'),'local audio source rejected');
      check(presenterSyncedLyricsTargetForTime(slides,first,6.9).slide.id===lyrics[0].id,'early advance');
      check(presenterSyncedLyricsTargetForTime(slides,first,7).slide.id===lyrics[1].id,'one-second lead');
      check(presenterSyncedLyricsTargetForTime(slides,first,19).slide.elementId==='timing-item','medley cross-talk');
      check(presenterSyncTimelineForSlide({syncTimeline:{groupId:'x',audioSrc:lyrics[0].syncTimeline.audioSrc,start:null}}).start===null,'intro null becomes zero');
      state.presenter.index=first;state.presenter.safetyBlank=false;state.presenter.liveScripture={active:false};
      const audio=getServiceMusicAudio();audio.src=lyrics[0].syncTimeline.audioSrc;
      state.serviceMusic.sourceKey=audio.src;state.serviceMusic.mode='presenter-audio';state.serviceMusic.playing=true;
      // Control clock without real output windows or network writes.
      Object.defineProperty(audio,'currentTime',{configurable:true,value:7,writable:true});
      check(syncServiceMusicSyncedLyricsWithCurrentTime({render:false,publish:false,scroll:false}),'clock advance failed');
      state.serviceMusic.playing=false;audio.currentTime=2;
      check(!syncServiceMusicSyncedLyricsWithCurrentTime({render:false,publish:false,scroll:false}),'paused advanced');
      state.serviceMusic.playing=true;state.presenter.safetyBlank=true;
      check(!syncServiceMusicSyncedLyricsWithCurrentTime({render:false,publish:false,scroll:false}),'blank advanced');
      state.presenter.safetyBlank=false;state.presenter.liveScripture.active=true;
      check(!syncServiceMusicSyncedLyricsWithCurrentTime({render:false,publish:false,scroll:false}),'scripture advanced');
      state.presenter.liveScripture.active=false;
      check(syncServiceMusicSyncedLyricsWithCurrentTime({render:false,publish:false,scroll:false}),'backward seek failed');
      runPresenterAction('next','timing-fixture',{scroll:false});
      check(!state.serviceMusic.playing,'manual navigation did not pause');
      stopServiceMusicPlayback({render:false});
      check(JSON.stringify({songs:state.songs,items:state.serviceItems})===window.timingFixtureBefore,'records changed: '+window.timingFixtureBefore+' AFTER '+JSON.stringify({songs:state.songs,items:state.serviceItems}));
      return 'PASS playback, seek, pause, source/group isolation, immutable song/service data';
    }'''))
    page.reload();page.wait_for_function("typeof buildPresenterSlidesForServiceItem==='function' && !!globalThis.MindexSongTiming")
    page.evaluate(fixture)
    assert page.evaluate("presenterSlidesForService('timing-fixture').some(s=>s.syncTimeline?.localTiming)")
    page.evaluate("MindexSongTiming.open('timing-fixture','timing-item')")
    assert page.locator('[data-timing-start="1"]').input_value()=='8'
    page.locator('[data-timing-enabled]').uncheck();page.locator('[data-timing-save]').click()
    page.wait_for_function("document.querySelector('[data-timing-status]').textContent.includes('저장했어요')")
    assert not page.evaluate("presenterSlidesForService('timing-fixture').some(s=>s.syncTimeline?.localTiming)")
    page.locator('[data-timing-enabled]').check();page.locator('[data-timing-save]').click()
    page.wait_for_function("presenterSlidesForService('timing-fixture').some(s=>s.syncTimeline?.localTiming)")
    # Replacement bytes invalidate all recorded timestamps; cancel keeps persisted data.
    replacement=bytearray(buffer.getvalue());replacement[-1]=1
    page.locator('[data-timing-file]').set_input_files({'name':'changed.wav','mimeType':'audio/wav','buffer':bytes(replacement)})
    page.wait_for_function("document.querySelector('[data-timing-start]').value===''")
    page.locator('[data-timing-save]').click()
    page.wait_for_function("document.querySelector('[data-timing-status]').textContent.includes('시각')")
    page.locator('[data-timing-close]').click()
    assert page.evaluate("presenterSlidesForService('timing-fixture').some(s=>s.syncTimeline?.localTiming)")
    page.evaluate("state.songs[0].versions[0].forms[0].lyrics='가사가 바뀜';state.songs[0].versions[0].updated_at='changed'")
    assert not page.evaluate("presenterSlidesForService('timing-fixture').some(s=>s.syncTimeline?.localTiming)")
    assert not blocked_writes,blocked_writes
    print(engine,'PASS persistent reload, disable/re-enable, changed audio reset, cancel, stale lyrics block; no network writes')
   finally: browser.close()
finally:
 if server: server.shutdown()
