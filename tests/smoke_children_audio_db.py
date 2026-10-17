"""Children DB ownership, failed-save retry, fresh storage and live-output gating. Offline only."""
import os,io,wave,json,re,threading
from functools import partial
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import APP_DIR,MindexSmokeHandler,MindexSmokeServer,sync_playwright,launch_chromium
buf=io.BytesIO()
with wave.open(buf,'wb') as w:
 w.setnchannels(1);w.setsampwidth(2);w.setframerate(8000);w.writeframes(b'\0\0'*8000*20)
fixture=r'''async()=>{
 const sid='children-db-service',service={id:sid,type_id:'fixture',date:'2026-10-18',title:'Fixture'};
 const song={id:'children-db-song',title:'어린이 DB',_relationalVersionsLoaded:true,memo:JSON.stringify({unknown:'preserve',childrenAudioSets:{other:{keep:true}}}),praise_types:['children'],versions:[{id:'children-db-version',name:'기본',_worshipVersionPersisted:true,lyric_signature:'fixture-signature',audio_set:null,is_primary:true,praise_types:['children'],forms:[{id:'v',part_type:'Verse',part_number:1,lyrics:'첫 가사',sort_order:1},{id:'c',part_type:'Chorus',lyrics:'마지막 가사',sort_order:2}]}]};
 const item={id:'children-db-item',service_id:sid,label:'찬양 1',raw_title:song.title,song_id:song.id,version_id:song.versions[0].id,sort_order:10,_worshipSectionKey:'praise',_worshipSectionTitle:'찬양',_worshipElementTemplateModified:true,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'children_audio',outputMode:'lyrics',forms:['V1','C']})};
 state.services=[service];state.serviceTypes=[{id:'fixture',name:'검증'}];state.songs=[song];state.serviceItems={[sid]:[item]};state.selectedServiceId=sid;state.module='presenter';state.loadedWorshipServiceIds=new Set([sid]);state.templateElementSuppressions.clear();state.presenter.serviceId=sid;state.presenter.sourceSignature='';state.presenter.slides=[];state.loading=false;
 renderPresenterControlState=()=>{};publishPresenterState=()=>{};
 window.originalItems=JSON.stringify(state.serviceItems);window.db={id:song.versions[0].id,lyric_signature:'fixture-signature',audio_set:null};window.uploads=0;window.failSave=false;
 state.client={storage:{from(){return {upload:async()=>{uploads++;return {error:null}},getPublicUrl:()=>({data:{publicUrl:location.origin+'/clock.wav'}})}}},from(table){if(table!=='mindex_song_versions')throw Error('wrong owner '+table);let patch=null,filters=[];const q={update(p){if(Object.keys(p).join()!=='audio_set')throw Error('wrong fields');patch=p;return q},eq(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},async select(){if(failSave)return {error:{message:'injected save failure'}};if(!filters.every(([k,v])=>(k==='audio_set'&&v!==null?JSON.stringify(db[k]):db[k])===v))return {data:[]};Object.assign(db,patch);return {data:[structuredClone(db)]}}};return q;}};
 await MindexSongTiming.ready;
 return {sid,song:structuredClone(song),item:structuredClone(item)};
}'''
class AudioFixtureHandler(MindexSmokeHandler):
 def do_GET(self):
  if urlsplit(self.path).path!='/clock.wav':return super().do_GET()
  # Native media decoding must consume a real HTTP byte stream. Playwright's
  # fulfilled responses can stall Linux WebKit after a backward seek.
  data=buf.getvalue();span=re.fullmatch(r'bytes=(\d+)-(\d*)',self.headers.get('Range',''))
  start=int(span[1]) if span else 0
  end=min(int(span[2]) if span and span[2] else len(data)-1,len(data)-1)
  self.send_response(206 if span else 200)
  self.send_header('Content-Type','audio/wav');self.send_header('Accept-Ranges','bytes')
  if span:self.send_header('Content-Range',f'bytes {start}-{end}/{len(data)}')
  self.send_header('Content-Length',str(end-start+1));self.end_headers()
  try:self.wfile.write(data[start:end+1])
  except (BrokenPipeError,ConnectionResetError):pass
server=MindexSmokeServer(('127.0.0.1',0),partial(AudioFixtureHandler,directory=str(APP_DIR)))
threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_address[1]}/index.html'
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   print(engine,'starting DB audio checks',flush=True)
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   def load():
    ctx=b.new_context();page=ctx.new_page();page.set_default_timeout(15000)
    # Block every external request, but leave local HTTP media unintercepted.
    page.route(re.compile(r'^https?://(?!'+re.escape(urlsplit(url).netloc)+r'/)'),lambda r:r.abort());page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof presenterSlidesForService==='function' && !!globalThis.MindexSongTiming && !document.body.classList.contains('ui-booting')")
    page.evaluate(fixture);return ctx,page
   ctx,page=load()
   assert page.evaluate("renderServicePraiseInputModeControl(state.serviceItems[state.selectedServiceId][0],0).includes('어린이: 음원 불러오기')")
   page.evaluate(r'''()=>{
    const sid=state.selectedServiceId,item=getServiceItems(sid).find(i=>i.id==='children-db-item'),entries=presenterSlidesForService(sid).map(slide=>({slide}));
    const html=renderPresenterBoardItemAudioControls(sid,{item,index:0,timingEntries:entries});
    if(!html.includes('data-song-timing-open')||html.includes('data-service-item-audio-file'))throw Error('children preparation must use DB set editor');
    const before=presenterControlBoardKey(state.services[0],entries.map(e=>e.slide),true);isPresenterOutputWindowOpen=()=>true;
    const after=presenterControlBoardKey(state.services[0],entries.map(e=>e.slide),true);if(before===after)throw Error('live buttons would not refresh');isPresenterOutputWindowOpen=()=>false;
   }''')
   page.evaluate("MindexSongTiming.open('children-db-service','children-db-item')")
   d=page.locator('[data-song-timing-dialog]');assert d.locator('[data-timing-save]').inner_text()=='곡 버전에 저장'
   d.locator('[data-timing-file]').set_input_files({'name':'fixture.wav','mimeType':'audio/wav','buffer':buf.getvalue()})
   page.wait_for_function("document.querySelector('[data-song-timing-dialog] audio').duration>19")
   for i,t in enumerate([2,8]):d.locator(f'[data-timing-start="{i}"]').fill(str(t))
   page.evaluate('failSave=true');d.locator('[data-timing-save]').click();page.wait_for_function("!document.querySelector('[data-timing-save]').disabled")
   assert 'injected' in d.locator('[data-timing-status]').inner_text()
   assert page.evaluate('uploads')==1
   page.evaluate('failSave=false');d.locator('[data-timing-save]').click();page.wait_for_function("document.querySelector('[data-timing-status]').textContent.includes('곡 버전에 음원·타이밍을 저장했어요')")
   print(engine,'DB save/retry passed',flush=True)
   saved=page.evaluate('db');assert page.evaluate('uploads')==1
   assert saved['audio_set']['starts']==[2,8]
   assert page.evaluate('JSON.stringify(state.serviceItems)===originalItems')
   assert page.evaluate("JSON.parse(state.songs[0].memo).unknown==='preserve'")
   page.evaluate(r'''async()=>{
    const T=MindexSongTiming,song=state.songs[0],v=song.versions[0],before=db.audio_set;
    db.audio_set={...before,concurrent:'keep'};
    let rejected=false;try{await T.saveToVersion(song,v,{...v.audio_set},T.pagesFor(presenterSlidesForService(state.selectedServiceId)))}catch(e){rejected=true;}
    if(!rejected || !db.audio_set.concurrent)throw Error('concurrent edit overwritten');db.audio_set=before;
   }''')
   print(engine,'opening independent storage context',flush=True)
   ctx.close();ctx,page=load()
   page.evaluate("db=>{window.db=db;state.songs[0].versions[0].audio_set=db.audio_set}",saved)
   page.evaluate(r'''async()=>{
    const T=MindexSongTiming,sid=state.selectedServiceId,item=state.serviceItems[sid][0];
    const pages=T.pagesFor(presenterSlidesForService(sid));
    if(JSON.stringify(pages.map(s=>s.syncTimeline?.start))!=='[2,8]')throw Error('fresh DB restore');
    if(!T.audioFor(pages,item.id)?.url.endsWith('/clock.wav'))throw Error('manager audio');
    let entries=pages.map(slide=>({slide}));
    if(T.controls(sid,entries).includes('data-song-timing-play'))throw Error('offline autoplay button');
    await T.play(sid,item.id);if(state.serviceMusic.playing)throw Error('offline playback');
    isPresenterOutputWindowOpen=()=>true;
    if(!T.controls(sid,entries).includes('data-song-timing-play'))throw Error('live autoplay hidden');
    state.presenter.serviceId='other';await T.play(sid,item.id);if(state.serviceMusic.playing)throw Error('wrong service playback');state.presenter.serviceId=sid;
    const m=item.memo;item.memo=serializeServiceItemMemo({...parseServiceItemMemo(m),inputMode:'lyrics_db'});
    if(presenterSlidesForService(sid).some(s=>s.syncTimeline))throw Error('ordinary lyrics activated audio');item.memo=m;
    refs.detailPane.innerHTML=T.controls(sid,entries);
   }''')
   page.locator('[data-song-timing-play]').click()
   page.wait_for_function('state.serviceMusic.playing && state.serviceMusic.audio.currentTime>0')
   page.evaluate('state.serviceMusic.audio.currentTime=7.2');page.wait_for_function('state.presenter.slides[state.presenter.index]?.syncTimeline?.page===2')
   page.evaluate("runPresenterAction('prev',state.selectedServiceId,{scroll:false});window.manualIndex=state.presenter.index;window.manualTime=state.serviceMusic.audio.currentTime")
   page.wait_for_function('state.serviceMusic.audio.currentTime>manualTime+.3')
   page.evaluate("if(state.serviceMusic.audio.paused || state.presenter.index!==manualIndex || !state.serviceMusic.autoSyncSuspended)throw Error('manual navigation interrupted music or snapped back')")
   page.evaluate("state.serviceMusic.audio.currentTime=8.5")
   page.wait_for_function('state.serviceMusic.audio.currentTime>8.7')
   page.evaluate("if(state.presenter.index!==manualIndex)throw Error('seek re-enabled auto sync');stopServiceMusicPlayback({render:false});const resume=document.createElement('button');resume.id='resume-test';resume.textContent='resume';resume.onclick=()=>runServiceMusicAction('toggle');refs.detailPane.prepend(resume)")
   page.locator('#resume-test').click()
   try:page.wait_for_function('state.serviceMusic.playing && !state.serviceMusic.audio.paused')
   except Exception:
    print(engine,'resume diagnostic',page.evaluate("JSON.stringify({playing:state.serviceMusic.playing,pending:state.serviceMusic.pending,paused:state.serviceMusic.audio.paused,time:state.serviceMusic.audio.currentTime,seeking:state.serviceMusic.audio.seeking,ready:state.serviceMusic.audio.readyState,network:state.serviceMusic.audio.networkState,ended:state.serviceMusic.audio.ended,mode:state.serviceMusic.mode,source:state.serviceMusic.sourceKey,owner:state.serviceMusic.ownerServiceId,slotOwned:serviceMusicSourceIsSlotOwned(),slide:state.presenter.index,manualIndex,toast:document.querySelector('#toast')?.textContent})"),flush=True)
    raise
   page.evaluate("if(!state.serviceMusic.autoSyncSuspended || state.presenter.index!==manualIndex)throw Error('resume re-enabled auto sync')")
   page.evaluate("window.mediaTrace=[];['play','playing','pause','waiting','seeking','seeked','error','abort','ended'].forEach(type=>state.serviceMusic.audio.addEventListener(type,()=>mediaTrace.push({type,time:state.serviceMusic.audio.currentTime,paused:state.serviceMusic.audio.paused})))")
   page.evaluate('isPresenterOutputWindowOpen=()=>false;startPresenterOutputWindowMonitor(state.selectedServiceId)')
   page.wait_for_function('!state.serviceMusic.playing')
   page.evaluate("isPresenterOutputWindowOpen=()=>true")
   page.locator('[data-song-timing-play]').click()
   try:page.wait_for_function('state.serviceMusic.playing')
   except Exception:
    print(engine,page.evaluate('JSON.stringify({trace:mediaTrace,playing:state.serviceMusic.playing,pending:state.serviceMusic.pending,ready:state.serviceMusic.audio.readyState,network:state.serviceMusic.audio.networkState,source:state.serviceMusic.sourceKey,service:state.presenter.serviceId,toast:document.querySelector("#toast")?.textContent})'),flush=True)
    raise
   page.evaluate("if(state.serviceMusic.autoSyncSuspended)throw Error('explicit restart did not re-enable sync')")
   page.evaluate(r'''()=>{
    stopPresenterOutput(state.selectedServiceId);if(state.serviceMusic.playing)throw Error('output stop left sync audio playing');
    const serial=state.serviceMusic.playSerial;state.serviceMusic.pending=true;
    state.serviceMusic.audio.dispatchEvent(new Event('ended'));
    confirmServiceMusicPlayback({paused:false,ended:false},serial);
    if(state.serviceMusic.pending || state.serviceMusic.playing)throw Error('late play completion revived ended audio');
    const song=state.songs[0];song.versions[0].forms[0].lyrics='changed';
    if(presenterSlidesForService(state.selectedServiceId).some(s=>s.syncTimeline))throw Error('stale DB lyrics');
   }''')
   print(engine,'PASS children DB save/retry/fresh-context playback, owner isolation, live gating and stale lyrics')
   ctx.close();b.close()
finally:server.shutdown();server.server_close()
