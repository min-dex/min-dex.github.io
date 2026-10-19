"""Audio-led worship bundle: actual atomic save and fresh-device playback, no song writes."""
import os,io,wave,json,re,threading,struct,zlib
from functools import partial
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import APP_DIR,MindexSmokeHandler,MindexSmokeServer,sync_playwright,launch_chromium
from smoke_app import prepare_server_state_fixture
buf=io.BytesIO()
with wave.open(buf,'wb') as w:
 w.setnchannels(1);w.setsampwidth(2);w.setframerate(8000);w.writeframes(b'\0\0'*8000*20)
def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
png=b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',2,2,8,2,0,0,0))+chunk(b'IDAT',zlib.compress((b'\x00'+b'\x28\x60\x90'*2)*2))+chunk(b'IEND',b'')
class AudioFixtureHandler(MindexSmokeHandler):
 def do_GET(self):
  path=urlsplit(self.path).path
  if path.startswith('/photo-') and path.endswith('.png'):
   self.send_response(200);self.send_header('Content-Type','image/png');self.send_header('Content-Length',str(len(png)));self.end_headers();self.wfile.write(png);return
  if not path.endswith(('/clock.wav','/replacement.wav')):return super().do_GET()
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
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   def page_for(context):
    page=context.new_page()
    page.route(re.compile(r'^https?://(?!'+re.escape(urlsplit(url).netloc)+r'/)'),lambda r:r.abort());page.goto(url+'?mindexSmokeRaw=1')
    page.wait_for_function("typeof buildWorshipPersistenceRows==='function' && !!globalThis.MindexSongTiming && !document.body.classList.contains('ui-booting')")
    prepare_server_state_fixture(page)
    return page
   context=b.new_context();page=page_for(context)
   page.evaluate(r'''()=>{
    const source='[[찬양]]\n[특송]\n- 음원 타이밍: '+JSON.stringify({version:1,starts:[2,6,10],lyricsFingerprint:'x'.repeat(10000)});
    if(normalizeServiceDocumentSnapshot({sourceText:source}).sourceText!==source)throw Error('current document truncated');
    const cut=source.slice(0,8000)+'\n[truncated]';
    if(parseServiceSourceText(cut,{allowTruncatedSnapshot:true}).length!==1)throw Error('legacy snapshot guard');
    for(const [text,options] of [[cut,{}],['[[찬양]]\n[특송]\n- 음원 타이밍: invalid',{allowTruncatedSnapshot:true}]]){
     let rejected=false;try{parseServiceSourceText(text,options)}catch{rejected=true}if(!rejected)throw Error('malformed current source accepted');
    }
   }''')
   ids=page.evaluate(r'''async()=>{
    const sid=crypto.randomUUID(),service={id:sid,type_id:'fixture',date:'2026-10-18',title:'Fixture',_worshipSourceRef:{}};
    state.services=[service];state.selectedServiceId=sid;state.module='presenter';state.serviceTypes=[{id:'fixture',name:'검증'}];state.songs=[];
    state.loadedWorshipServiceIds=new Set([sid]);state.templateElementSuppressions.clear();state.dirtyServiceElementIds.clear();state.dirtyServiceStructureIds.clear();
    state.serviceAliasSupported=true;
    const item=normalizeServiceItem({id:crypto.randomUUID(),service_id:sid,label:'특송',raw_title:'테스트 곡',_worshipSectionKey:'special_song',_worshipSectionTitle:'특송',_worshipElementTemplateModified:true,
     memo:serializeServiceItemMemo({elementType:'praise',inputMode:'audio_praise',outputMode:'lyrics',slides:['첫 가사','[INT]','마지막 가사'],audioAsset:{kind:'audio',name:'clock.wav',url:location.origin+'/'+'long-audio-path-'.repeat(150)+'/clock.wav'}})},0);
    const typed={inputMode:true,contentState:true};worshipElementTypedStateColumns=async()=>typed;
    const rows=buildWorshipPersistenceRows(service,[item],{}, {},{elementTypedStateColumns:typed});sanitizeWorshipPersistenceRows(rows,{elementTypedStateColumns:typed});compactWorshipPersistenceRows(rows);
    window.db={revision:'1',service:{id:sid,service_type_id:'fixture',service_date:service.date,title:'Fixture',source_ref:{}},...structuredClone(rows),slides:[]};
    state.worshipSections=rows.sections;state.worshipElements=rows.elements;state.serviceItems={[sid]:groupWorshipElements(rows.sections,rows.elements)[sid]};
    state.client={storage:{from(){return {upload(){throw Error('existing MR must not reupload')}}}},from(){throw Error('song or legacy write')},rpc:async(name,{req})=>{
     if(name==='get_worship_service_v1')return {data:structuredClone(db)};
     if(name!=='save_worship_service_v1')throw Error(name);
     if(window.failSave)return {error:{code:'P0001',message:'injected failure'}};
     for(const [key,patches] of [['sections',req.sectionPatches],['elements',req.elementPatches]]) for(const change of patches){const row=db[key].find(x=>x.id===change.id);Object.assign(row,change.patch);for(const [field,keys] of Object.entries(change.removeKeys||{}))for(const key of keys)delete row[field][key];}
     db.service.source_ref={mindexServiceDocument:req.document};db.revision=String(+db.revision+1);
     return {data:{aggregate:structuredClone(db),committedRevision:db.revision,replayed:false}};
    }};
    await (await worshipAtomicClient()).read(sid);
    saveServiceItemMutation=async(id,index)=>{await saveWorshipServiceElementPatch(service,state.serviceItems[id][index].id);return true};
    renderPresenterControlState=()=>{};publishPresenterState=()=>{};
    state.presenter.serviceId=sid;state.presenter.sourceSignature='';state.presenter.slides=[];
    await MindexSongTiming.ready;
    if(!renderServicePraiseInputModeControl(state.serviceItems[sid][0],0).includes('직접 추가: 음원'))throw Error('mode UI missing');
    if(serviceItemRequiresSongSelection(state.serviceItems[sid][0],service))throw Error('audio mode requires DB');
    return {serviceId:sid,elementId:state.serviceItems[sid][0].id};
   }''')
   page.evaluate("""x=>{
    const service=state.services.find(s=>s.id===x.serviceId),item=state.serviceItems[x.serviceId][0];
    const timingEntries=presenterSlidesForService(x.serviceId).filter(s=>s.elementId===item.id).map(slide=>({slide}));
    const host=document.createElement('div');host.id='photo-entry-fixture';
    host.innerHTML=renderPresenterBoardItemActions(x.serviceId,{service,item,index:0,timingEntries});document.body.append(host);
   }""",ids)
   page.get_by_role('button',name='사진·타이밍 편집',exact=True).click()
   page.wait_for_function("document.activeElement?.matches('[data-photo-section]')")
   d=page.locator('[data-song-timing-dialog]');assert d.locator('[data-timing-share]').count()==0
   d.locator('[data-timing-linked]').click();page.wait_for_function("(()=>{const a=document.querySelector('[data-song-timing-dialog] audio');return a.src.startsWith('blob:')&&a.readyState>=1&&a.duration>19&&!document.querySelector('[data-timing-save]').disabled})()")
   for i,t in enumerate([2,6,10]):d.locator(f'[data-timing-start="{i}"]').fill(str(t))
   page.evaluate('window.failSave=true');d.locator('[data-timing-save]').click();page.wait_for_function("!document.querySelector('[data-timing-save]').disabled");assert 'injected failure' in d.locator('[data-timing-status]').inner_text(),d.locator('[data-timing-status]').inner_text()
   assert not page.evaluate('db.elements[0].config.audioTiming')
   page.evaluate('window.failSave=false');d.locator('[data-timing-save]').click();page.wait_for_function("document.querySelector('[data-timing-status]').textContent.includes('예배에 저장했어요')")
   page.evaluate("""()=>{const service=state.services[0],doc=service._worshipSourceRef.mindexServiceDocument;if(doc.sourceText.length<=8000)throw Error('long source fixture too short');doc.sourceText=doc.sourceText.slice(0,8000)+'\\n[truncated]';}""")
   # Replacing the audio uploads once; a failed commit retains the upload for retry.
   page.evaluate("window.uploads=0;state.client.storage.from=()=>({upload:async()=>{uploads++;return {error:null}},getPublicUrl:()=>({data:{publicUrl:location.origin+'/replacement.wav'}}),remove:()=>{throw Error('must not delete uncertain audio')}})")
   d.locator('[data-timing-file]').set_input_files({'name':'replacement.wav','mimeType':'audio/wav','buffer':buf.getvalue()})
   page.wait_for_function("(()=>{const a=document.querySelector('[data-song-timing-dialog] audio');return a.src.startsWith('blob:')&&a.readyState>=1&&a.duration>19&&!document.querySelector('[data-timing-save]').disabled})()")
   for i,t in enumerate([2,6,10]):d.locator(f'[data-timing-start="{i}"]').fill(str(t))
   page.evaluate('window.failSave=true');d.locator('[data-timing-save]').click();page.wait_for_function("!document.querySelector('[data-timing-save]').disabled");assert 'injected failure' in d.locator('[data-timing-status]').inner_text(),d.locator('[data-timing-status]').inner_text()
   assert page.evaluate('db.elements[0].config.audioAsset.url').endswith('/clock.wav')
   page.evaluate('window.failSave=false');d.locator('[data-timing-save]').click();page.wait_for_function("document.querySelector('[data-timing-status]').textContent.includes('예배에 저장했어요')")
   assert page.evaluate('uploads')==1
   page.evaluate("window.photoUploads=0;state.client.storage.from=()=>({upload:async()=>{photoUploads++;return {error:null}},getPublicUrl:()=>({data:{publicUrl:location.origin+'/photo-'+photoUploads+'.png'}}),remove:()=>{throw Error('must not delete uncertain photos')}})")
   d.locator('[data-timing-photos]').set_input_files([{'name':f'{i:02}.png','mimeType':'image/png','buffer':png} for i in range(1,4)])
   d.get_by_text('시각 일괄 입력',exact=True).click()
   d.locator('[data-photo-times]').fill('6\n7.5\n11')
   assert d.locator('.song-photo-row').count()==3
   d.locator('[data-photo-anchor="0"]').select_option('1')
   d.locator('[data-timing-start="1"]').fill('6.5')
   assert d.locator('[data-photo-at="0"]').input_value()=='6.5'
   d.locator('[data-timing-start="1"]').fill('6')
   assert d.locator('[data-photo-at="0"]').input_value()=='6'
   assert d.locator('[data-photo-at="1"]').input_value()=='7.5'
   d.locator('[data-photo-replace="1"]').set_input_files({'name':'replacement-photo.png','mimeType':'image/png','buffer':png})
   assert d.locator('[data-photo-at="1"]').input_value()=='7.5'
   d.locator('[data-photo-editor]').screenshot(path=f'/tmp/mindex-photo-editor-{engine}.png')
   page.set_viewport_size({'width':390,'height':844})
   d.locator('[data-photo-editor]').screenshot(path=f'/tmp/mindex-photo-editor-{engine}-mobile.png')
   assert d.evaluate('(el)=>el.scrollWidth<=el.clientWidth+2')
   page.set_viewport_size({'width':1280,'height':900})


   page.evaluate('window.failSave=true');d.locator('[data-timing-save]').click();page.wait_for_function("!document.querySelector('[data-timing-save]').disabled")
   page.wait_for_function("document.querySelector('[data-timing-status]').textContent.includes('injected failure')")
   page.evaluate('window.failSave=false');d.locator('[data-timing-save]').click();page.wait_for_function("document.querySelector('[data-timing-status]').textContent.includes('예배에 저장했어요')")
   assert page.evaluate('photoUploads')==3
   assert d.locator('[data-timing-start]').count()==3
   saved=page.evaluate('db');assert saved['elements'][0]['config']['audioTiming']['starts']==[2,6,10]
   assert saved['elements'][0]['config']['audioTiming']['photos'][0]['slideIndex']==1
   assert '음원 타이밍' in saved['service']['source_ref']['mindexServiceDocument']['sourceText']
   assert not saved['service']['source_ref']['mindexServiceDocument']['sourceText'].endswith('[truncated]')
   assert not saved['elements'][0].get('song_id');assert saved['elements'][0]['config']['inputMode']=='audio_praise'
   context.close()
   # A separate storage context models another computer: no IndexedDB import or share action.
   context=b.new_context();page=page_for(context)
   page.evaluate(r'''async db=>{
    const sid=db.service.id;state.services=[{id:sid,type_id:'fixture',date:'2026-10-18'}];state.selectedServiceId=sid;state.serviceTypes=[{id:'fixture',name:'검증'}];state.songs=[];
    state.loadedWorshipServiceIds=new Set([sid]);state.templateElementSuppressions.clear();state.serviceItems=groupWorshipElements(db.sections,db.elements);
    renderPresenterControlState=()=>{};publishPresenterState=()=>{};state.presenter.serviceId=sid;state.presenter.sourceSignature='';state.presenter.slides=[];await MindexSongTiming.ready;
    const slides=presenterSlidesForService(sid),p=MindexSongTiming.pagesFor(slides);
    if(JSON.stringify(p.map(s=>s.syncTimeline?.start))!=='[2,6,10]')throw Error('fresh device lost timing');
    if(JSON.stringify(p.map(s=>s.syncTimeline?.lead))!=='[1,0,1]')throw Error('lead');
    const first=slides.findIndex(s=>s.syncTimeline?.page===1);
    for(const [t,n,photo] of [[6.1,2,1],[7.6,2,2],[9.1,3,2],[11.1,3,3],[7.6,2,2]]){
      const actual=presenterSyncedLyricsTargetForTime(slides,first,t).slide;
      if(actual.syncTimeline.page!==n || !actual.formBackgroundImage.endsWith('/photo-'+photo+'.png'))throw Error('independent timeline/seek');
      const frame=presenterOutputFrameStateForSlide(actual,{});
      if(!frame.formBackground || !frame.showBackground || frame.blankOutput)throw Error('photo output/blank');
    }
    const item=state.serviceItems[sid][0],original=item.memo,m=parseServiceItemMemo(original);
    m.slides[0]='수정';item.memo=serializeServiceItemMemo(m);
    if(MindexSongTiming.pagesFor(presenterSlidesForService(sid)).some(s=>s.syncTimeline))throw Error('changed lyrics inherited timing');item.memo=original;
    m.slides=['첫 가사','[INT]','마지막 가사'];m.audioAsset.url+='?changed';item.memo=serializeServiceItemMemo(m);
    if(MindexSongTiming.pagesFor(presenterSlidesForService(sid)).some(s=>s.syncTimeline))throw Error('changed audio inherited timing');item.memo=original;
    isPresenterOutputWindowOpen=()=>true;
    await MindexSongTiming.play(sid,item.id);
   }''',saved)
   page.wait_for_function('state.serviceMusic.playing')
   for time,n in [(1.1,1),(6.1,2),(9.1,3)]:
    page.evaluate('t=>state.serviceMusic.audio.currentTime=t',time);page.wait_for_function('n=>state.presenter.slides[state.presenter.index]?.syncTimeline?.page===n',arg=n)
   for time,n in [(7.6,2),(11.2,3),(7.6,2)]:
    page.evaluate('t=>state.serviceMusic.audio.currentTime=t',time)
    page.wait_for_function('n=>state.presenter.slides[state.presenter.index]?.formBackgroundImage?.endsWith("/photo-"+n+".png")',arg=n)
   page.evaluate('suspendServiceMusicAutoSync()')
   old_index=page.evaluate('state.presenter.index')
   page.evaluate('state.serviceMusic.audio.currentTime=14')
   page.wait_for_timeout(400)
   assert page.evaluate('state.presenter.index')==old_index
   assert page.evaluate('state.serviceMusic.playing')
   page.evaluate('''()=>{stopServiceMusicPlayback({render:false});const root=document.createElement('div');root.id='presenterOutputRoot';root.style.cssText='position:fixed;inset:0;z-index:999999';document.body.append(root)}''')
   for time,number,lyric in [(6.1,1,''),(7.6,2,''),(9.1,2,'마지막 가사'),(11.1,3,'마지막 가사'),(7.6,2,'')]:
    page.evaluate('''t=>{const slides=state.presenter.slides,index=slides.findIndex(s=>s.syncTimeline?.page===1),target=presenterSyncedLyricsTargetForTime(slides,index,t);renderPresenterOutput({slides,index:target.index,serviceId:state.presenter.serviceId,chromakey:false})}''',time)
    page.wait_for_function('''n=>{const root=document.querySelector('#presenterOutputRoot');return !root.hasAttribute('aria-busy')&&root.querySelector('.presenter-output-background img')?.src.endsWith('/photo-'+n+'.png')}''',arg=number)
    active=page.locator('#presenterOutputRoot .is-active').first
    assert active.inner_text().strip()==lyric,active.inner_text()
   page.evaluate('''()=>renderPresenterOutput({slides:state.presenter.slides,index:state.presenter.index,safetyBlank:true,chromakey:false})''')
   page.wait_for_function("document.querySelector('#presenterOutputRoot').classList.contains('is-blackout')")

   print(engine,'PASS atomic save failure/retry, DB-independent audio mode, fresh-device cues/playback, changed lyrics/audio invalidation',flush=True)
   context.close();b.close()
finally:server.shutdown();server.server_close()
