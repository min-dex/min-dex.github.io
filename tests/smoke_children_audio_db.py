"""Children DB ownership, failed-save retry, fresh storage and live-output gating. Offline only."""
import os,io,wave,json
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
buf=io.BytesIO()
with wave.open(buf,'wb') as w:
 w.setnchannels(1);w.setsampwidth(2);w.setframerate(8000);w.writeframes(b'\0\0'*8000*20)
fixture=r'''async()=>{
 const sid='children-db-service',service={id:sid,type_id:'fixture',date:'2026-10-18',title:'Fixture'};
 const song={id:'children-db-song',title:'어린이 DB',_relationalVersionsLoaded:true,memo:JSON.stringify({unknown:'preserve',childrenAudioSets:{other:{keep:true}}}),praise_types:['children'],versions:[{id:'children-db-version',name:'기본',_worshipVersionPersisted:true,is_primary:true,praise_types:['children'],forms:[{id:'v',part_type:'Verse',part_number:1,lyrics:'첫 가사',sort_order:1},{id:'c',part_type:'Chorus',lyrics:'마지막 가사',sort_order:2}]}]};
 const item={id:'children-db-item',service_id:sid,label:'찬양 1',raw_title:song.title,song_id:song.id,version_id:song.versions[0].id,sort_order:10,_worshipSectionKey:'praise',_worshipSectionTitle:'찬양',_worshipElementTemplateModified:true,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'children_audio',outputMode:'lyrics',forms:['V1','C']})};
 state.services=[service];state.serviceTypes=[{id:'fixture',name:'검증'}];state.songs=[song];state.serviceItems={[sid]:[item]};state.selectedServiceId=sid;state.module='presenter';state.loadedWorshipServiceIds=new Set([sid]);state.templateElementSuppressions.clear();state.presenter.serviceId=sid;state.presenter.sourceSignature='';state.presenter.slides=[];state.loading=false;
 renderPresenterControlState=()=>{};publishPresenterState=()=>{};
 window.originalItems=JSON.stringify(state.serviceItems);window.db={id:song.id,memo:song.memo};window.uploads=0;window.failSave=false;
 state.client={storage:{from(){return {upload:async()=>{uploads++;return {error:null}},getPublicUrl:()=>({data:{publicUrl:location.origin+'/clock.wav'}})}}},from(table){if(table!=='mindex_songs')throw Error('wrong owner '+table);let patch=null,filters=[];const q={select(){return q},update(p){patch=p;return q},eq(k,v){filters.push([k,v]);return q},is(k,v){filters.push([k,v]);return q},async single(){if(patch){if(failSave)return {error:{message:'injected save failure'}};if(!filters.every(([k,v])=>db[k]===v))return {error:{message:'conflict'}};Object.assign(db,patch)}return {data:structuredClone(db)}}};return q;}};
 await MindexSongTiming.ready;
 return {sid,song:structuredClone(song),item:structuredClone(item)};
}'''
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   def load():
    ctx=b.new_context();page=ctx.new_page()
    def route(r):
     if r.request.url.endswith('/clock.wav'):r.fulfill(body=buf.getvalue(),content_type='audio/wav')
     elif (urlsplit(r.request.url).netloc==urlsplit(url).netloc or r.request.url.startswith('blob:')) and r.request.method in ('GET','HEAD'):r.continue_()
     else:r.abort()
    page.route('**/*',route);page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof presenterSlidesForService==='function' && !!globalThis.MindexSongTiming && !document.body.classList.contains('ui-booting')")
    page.evaluate(fixture);return ctx,page
   ctx,page=load()
   assert page.evaluate("renderServicePraiseInputModeControl(state.serviceItems[state.selectedServiceId][0],0).includes('어린이: 음원 로드')")
   page.evaluate(r'''()=>{
    const sid=state.selectedServiceId,item=getServiceItems(sid).find(i=>i.id==='children-db-item'),entries=presenterSlidesForService(sid).map(slide=>({slide}));
    const html=renderPresenterBoardItemAudioControls(sid,{item,index:0,timingEntries:entries});
    if(!html.includes('data-song-timing-open')||html.includes('data-service-item-audio-file'))throw Error('children preparation must use DB set editor');
    const before=presenterControlBoardKey(state.services[0],entries.map(e=>e.slide),true);isPresenterOutputWindowOpen=()=>true;
    const after=presenterControlBoardKey(state.services[0],entries.map(e=>e.slide),true);if(before===after)throw Error('live buttons would not refresh');isPresenterOutputWindowOpen=()=>false;
   }''')
   page.evaluate("MindexSongTiming.open('children-db-service','children-db-item')")
   d=page.locator('[data-song-timing-dialog]');assert d.locator('[data-timing-save]').inner_text()=='곡 DB에 저장'
   d.locator('[data-timing-file]').set_input_files({'name':'fixture.wav','mimeType':'audio/wav','buffer':buf.getvalue()})
   page.wait_for_function("document.querySelector('[data-song-timing-dialog] audio').duration>19")
   for i,t in enumerate([2,8]):d.locator(f'[data-timing-start="{i}"]').fill(str(t))
   page.evaluate('failSave=true');d.locator('[data-timing-save]').click();page.wait_for_function("!document.querySelector('[data-timing-save]').disabled")
   assert 'injected' in d.locator('[data-timing-status]').inner_text()
   assert page.evaluate('uploads')==1
   page.evaluate('failSave=false');d.locator('[data-timing-save]').click();page.wait_for_function("document.querySelector('[data-timing-status]').textContent.includes('곡 DB에 저장했어요')")
   saved=page.evaluate('db');assert page.evaluate('uploads')==1
   assert json.loads(saved['memo'])['unknown']=='preserve'
   assert json.loads(saved['memo'])['childrenAudioSets']['other']=={'keep':True}
   assert page.evaluate('JSON.stringify(state.serviceItems)===originalItems')
   assert page.evaluate("!!JSON.parse(serializeSongMemo(state.songs[0],{omitVersions:true})).childrenAudioSets['children-db-version']")
   page.evaluate(r'''async()=>{
    const T=MindexSongTiming,song=state.songs[0],v=song.versions[0],before=db.memo;
    db.memo=JSON.stringify({...JSON.parse(before),concurrent:'keep'});
    let rejected=false;try{await T.saveToSong(song,v,T.childProfile(song,v),T.pagesFor(presenterSlidesForService(state.selectedServiceId)))}catch(e){rejected=true;}
    if(!rejected || !JSON.parse(db.memo).concurrent)throw Error('concurrent edit overwritten');db.memo=before;
   }''')
   ctx.close();ctx,page=load()
   page.evaluate("db=>{window.db=db;state.songs[0].memo=db.memo}",saved)
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
    await T.play(sid,item.id);
   }''')
   page.wait_for_function('state.serviceMusic.playing && state.serviceMusic.audio.currentTime>0')
   page.evaluate('state.serviceMusic.audio.currentTime=7.2');page.wait_for_function('state.presenter.slides[state.presenter.index]?.syncTimeline?.page===2')
   page.evaluate('isPresenterOutputWindowOpen=()=>false;startPresenterOutputWindowMonitor(state.selectedServiceId)')
   page.wait_for_function('!state.serviceMusic.playing')
   page.evaluate("isPresenterOutputWindowOpen=()=>true;MindexSongTiming.play(state.selectedServiceId,'children-db-item')")
   page.wait_for_function('state.serviceMusic.playing')
   page.evaluate(r'''()=>{
    stopPresenterOutput(state.selectedServiceId);if(state.serviceMusic.playing)throw Error('output stop left sync audio playing');const song=state.songs[0];song.versions[0].forms[0].lyrics='changed';
    if(presenterSlidesForService(state.selectedServiceId).some(s=>s.syncTimeline))throw Error('stale DB lyrics');
   }''')
   print(engine,'PASS children DB save/retry/fresh-context playback, owner isolation, live gating and stale lyrics')
   ctx.close();b.close()
finally:server.shutdown();server.server_close()
