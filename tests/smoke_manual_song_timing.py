"""Direct lyrics timing uses occurrence identity, retains source data, and reloads offline."""
import io, os, wave
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from smoke_app import start_local_app_server, sync_playwright, launch_chromium

FIXTURE = r'''async()=>{
 const service={id:'manual-timing-service',type_id:'fixture',date:'2026-10-18',title:'검증'};
 state.services=[service];state.selectedServiceId=service.id;state.module='presenter';
 state.client={from(){throw Error('Unexpected DB access')}};
 state.serviceTypes=[{id:'fixture',name:'검증'}];state.serviceError='';state.loading=false;
 state.loadedWorshipServiceIds=new Set([service.id]);state.templateElementSuppressions.clear();
 state.songs=[];
 const item=normalizeServiceItem({id:'manual-timing-item',service_id:service.id,label:'특송',raw_title:'직접 입력 곡',
  _worshipSectionKey:'special_song',_worshipSectionTitle:'특송',
  memo:serializeServiceItemMemo({elementType:'praise',inputMode:'manual_praise',outputMode:'lyrics',
   slides:['첫 가사\n둘째 줄','[INT]','마지막 가사'],audioAsset:{kind:'audio',url:location.origin+'/clock.wav',name:'clock.wav'}})},0);
 state.serviceItems={[service.id]:[item]};
 renderPresenterControlState=()=>{};publishPresenterState=()=>{};
 state.presenter.serviceId=service.id;state.presenter.sourceSignature='';state.presenter.slides=[];
 window.originalManual=JSON.stringify({services:state.services,items:state.serviceItems,songs:state.songs});
 await MindexSongTiming.ready;
 return {serviceId:service.id,elementId:item.id};
}'''
buf=io.BytesIO()
with wave.open(buf,'wb') as w:
 w.setnchannels(1);w.setsampwidth(2);w.setframerate(8000);w.writeframes(b'\0\0'*8000*20)
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page();writes=[]
   def route(r):
    if r.request.url.endswith('/clock.wav'):r.fulfill(body=buf.getvalue(),content_type='audio/wav')
    elif r.request.method not in ('GET','HEAD'):writes.append(r.request.url);r.abort()
    elif urlsplit(r.request.url).netloc==urlsplit(url).netloc or r.request.url.startswith('blob:'):r.continue_()
    else:r.abort()
   page.route('**/*',route)
   def load():
    page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof buildPresenterSlidesForServiceItem==='function' && !!globalThis.MindexSongTiming")
    page.wait_for_function("!document.body.classList.contains('ui-booting')")
    return page.evaluate(FIXTURE)
   ids=load()
   page.evaluate('x=>MindexSongTiming.open(x.serviceId,x.elementId)',ids)
   d=page.locator('[data-song-timing-dialog]');assert d.locator('[data-timing-start]').count()==3
   d.locator('[data-timing-linked]').click();page.wait_for_function("document.querySelector('[data-song-timing-dialog] audio').duration>19")
   for i,t in enumerate([2,6,10]):d.locator(f'[data-timing-start="{i}"]').fill(str(t))
   page.evaluate(r'''async ids=>{const T=MindexSongTiming,s=T.pagesFor(presenterSlidesForService(ids.serviceId));const audio=await (await fetch('/clock.wav')).blob();const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await audio.arrayBuffer())),b=>b.toString(16).padStart(2,'0')).join('');await T.save({key:s[0].songTimingKey,audio,audioName:'clock.wav',audioFingerprint:hash,duration:20,lyricsFingerprint:T.fingerprint(s),starts:[2,6,10],enabled:true},s)}''',ids)
   d.locator('[data-timing-close]').click()
   ids=load()
   page.evaluate('x=>MindexSongTiming.play(x.serviceId,x.elementId)',ids)
   page.wait_for_function('state.serviceMusic.playing && state.serviceMusic.audio.currentTime>0')
   page.evaluate('state.serviceMusic.audio.currentTime=9.1')
   page.wait_for_function('state.presenter.slides[state.presenter.index]?.syncTimeline?.page===3')
   page.evaluate('stopServiceMusicPlayback({render:false})')
   print(engine,page.evaluate(r'''()=>{
    const T=MindexSongTiming,check=(x,m)=>{if(!x)throw Error(m)},sid='manual-timing-service';
    const item=state.serviceItems[sid][0],pages=()=>T.pagesFor(presenterSlidesForService(sid));
    check(JSON.stringify(pages().map(s=>s.syncTimeline?.start))==='[2,6,10]','reload lost starts');
    check(JSON.stringify(pages().map(s=>s.syncTimeline?.lead))==='[1,0,1]','instrumental lead');
    const timed=pages()[0],title={...timed,type:'title',syncTimeline:undefined};
    const controls=T.controls(sid,[{slide:title},{slide:timed}],{audioSource:'fixture'});
    check(controls.includes('data-song-timing-play'),'title-first group hid saved playback');
    check((controls.match(/data-song-timing-play/g)||[]).length===1,'duplicate playback controls');
    const slides=presenterSlidesForService(sid),first=slides.findIndex(s=>s.syncTimeline?.page===1);
    check(presenterSyncedLyricsTargetForTime(slides,first,6).slide.syncTimeline.page===2,'instrumental clock');
    check(presenterSyncedLyricsTargetForTime(slides,first,9).slide.syncTimeline.page===3,'lyric lead');
    check(JSON.stringify({services:state.services,items:state.serviceItems,songs:state.songs})===originalManual,'source changed');
    const memo=item.memo,m=parseServiceItemMemo(memo);m.slides[0]='수정된 가사';item.memo=serializeServiceItemMemo(m);
    check(!pages().some(s=>s.syncTimeline),'edited lyrics inherited timing');item.memo=memo;
    m.slides=['첫 가사\n둘째 줄','[INT]','마지막 가사'];m.audioAsset.url+='?replacement';item.memo=serializeServiceItemMemo(m);
    check(!pages().some(s=>s.syncTimeline),'changed audio inherited timing');item.memo=memo;
    state.services.push({...state.services[0],id:'other-service'});
    state.serviceItems['other-service']=[{...item,service_id:'other-service'}];
    check(!presenterSlidesForService('other-service').some(s=>s.syncTimeline),'service isolation');
    return 'PASS direct lyrics without song/version, reload, cue clock, invalidation, no source writes';
   }'''))
   assert not writes,writes
   browser.close()
finally:server.shutdown();server.server_close()
