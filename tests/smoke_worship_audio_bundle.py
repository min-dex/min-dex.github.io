"""Audio-led worship bundle: actual atomic save and fresh-device playback, no song writes."""
import os,io,wave,json
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
buf=io.BytesIO()
with wave.open(buf,'wb') as w:
 w.setnchannels(1);w.setsampwidth(2);w.setframerate(8000);w.writeframes(b'\0\0'*8000*20)
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   def page_for(context):
    page=context.new_page()
    def route(r):
     if r.request.url.endswith(('/clock.wav','/replacement.wav')):r.fulfill(body=buf.getvalue(),content_type='audio/wav')
     elif urlsplit(r.request.url).netloc==urlsplit(url).netloc or r.request.url.startswith('blob:'):r.continue_()
     else:r.abort()
    page.route('**/*',route);page.goto(url+'?mindexSmokeRaw=1')
    page.wait_for_function("typeof buildWorshipPersistenceRows==='function' && !!globalThis.MindexSongTiming && !document.body.classList.contains('ui-booting')")
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
    if(!renderServicePraiseInputModeControl(state.serviceItems[sid][0],0).includes('음원·가사'))throw Error('mode UI missing');
    if(serviceItemRequiresSongSelection(state.serviceItems[sid][0],service))throw Error('audio mode requires DB');
    return {serviceId:sid,elementId:state.serviceItems[sid][0].id};
   }''')
   page.evaluate('x=>MindexSongTiming.open(x.serviceId,x.elementId)',ids)
   d=page.locator('[data-song-timing-dialog]');assert d.locator('[data-timing-share]').count()==0
   d.locator('[data-timing-linked]').click();page.wait_for_function("document.querySelector('[data-song-timing-dialog] audio').duration>19")
   for i,t in enumerate([2,6,10]):d.locator(f'[data-timing-start="{i}"]').fill(str(t))
   page.evaluate('window.failSave=true');d.locator('[data-timing-save]').click();page.wait_for_function("!document.querySelector('[data-timing-save]').disabled");assert 'injected failure' in d.locator('[data-timing-status]').inner_text(),d.locator('[data-timing-status]').inner_text()
   assert not page.evaluate('db.elements[0].config.audioTiming')
   page.evaluate('window.failSave=false');d.locator('[data-timing-save]').click();page.wait_for_function("document.querySelector('[data-timing-status]').textContent.includes('예배에 저장했어요')")
   page.evaluate("""()=>{const service=state.services[0],doc=service._worshipSourceRef.mindexServiceDocument;if(doc.sourceText.length<=8000)throw Error('long source fixture too short');doc.sourceText=doc.sourceText.slice(0,8000)+'\\n[truncated]';}""")
   # Replacing the audio uploads once; a failed commit retains the upload for retry.
   page.evaluate("window.uploads=0;state.client.storage.from=()=>({upload:async()=>{uploads++;return {error:null}},getPublicUrl:()=>({data:{publicUrl:location.origin+'/replacement.wav'}}),remove:()=>{throw Error('must not delete uncertain audio')}})")
   d.locator('[data-timing-file]').set_input_files({'name':'replacement.wav','mimeType':'audio/wav','buffer':buf.getvalue()})
   page.wait_for_function("document.querySelector('[data-song-timing-dialog] audio').duration>19")
   for i,t in enumerate([2,6,10]):d.locator(f'[data-timing-start="{i}"]').fill(str(t))
   page.evaluate('window.failSave=true');d.locator('[data-timing-save]').click();page.wait_for_function("!document.querySelector('[data-timing-save]').disabled");assert 'injected failure' in d.locator('[data-timing-status]').inner_text(),d.locator('[data-timing-status]').inner_text()
   assert page.evaluate('db.elements[0].config.audioAsset.url').endswith('/clock.wav')
   page.evaluate('window.failSave=false');d.locator('[data-timing-save]').click();page.wait_for_function("document.querySelector('[data-timing-status]').textContent.includes('예배에 저장했어요')")
   assert page.evaluate('uploads')==1
   saved=page.evaluate('db');assert saved['elements'][0]['config']['audioTiming']['starts']==[2,6,10]
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
    const item=state.serviceItems[sid][0],original=item.memo,m=parseServiceItemMemo(original);
    m.slides[0]='수정';item.memo=serializeServiceItemMemo(m);
    if(MindexSongTiming.pagesFor(presenterSlidesForService(sid)).some(s=>s.syncTimeline))throw Error('changed lyrics inherited timing');item.memo=original;
    m.slides=['첫 가사','[INT]','마지막 가사'];m.audioAsset.url+='?changed';item.memo=serializeServiceItemMemo(m);
    if(MindexSongTiming.pagesFor(presenterSlidesForService(sid)).some(s=>s.syncTimeline))throw Error('changed audio inherited timing');item.memo=original;
    await MindexSongTiming.play(sid,item.id);
   }''',saved)
   page.wait_for_function('state.serviceMusic.playing')
   for time,n in [(1.1,1),(6.1,2),(9.1,3)]:
    page.evaluate('t=>state.serviceMusic.audio.currentTime=t',time);page.wait_for_function('n=>state.presenter.slides[state.presenter.index]?.syncTimeline?.page===n',arg=n)
   page.evaluate('stopServiceMusicPlayback({render:false})')
   print(engine,'PASS atomic save failure/retry, DB-independent audio mode, fresh-device cues/playback, changed lyrics/audio invalidation',flush=True)
   context.close();b.close()
finally:server.shutdown();server.server_close()
