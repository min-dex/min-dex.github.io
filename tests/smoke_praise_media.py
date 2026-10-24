"""Catalog media reads the right edition/profile without editing records or Worship playback."""
import io,json,math,os,struct,wave
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import launch_chromium,start_local_app_server,sync_playwright

buf=io.BytesIO()
with wave.open(buf,'wb') as wav:
 wav.setnchannels(1);wav.setsampwidth(2);wav.setframerate(8000)
 wav.writeframes(b''.join(struct.pack('<h',int(1200*math.sin(2*math.pi*220*i/8000))) for i in range(48000)))
wave_bytes=buf.getvalue()
server,url=start_local_app_server()
try:
 with sync_playwright() as pw:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(pw) if engine=='chromium' else pw.webkit.launch(headless=True)
   page=browser.new_page(viewport={'width':1280,'height':950});counts={'manifest':0,'audio':0,'writes':0};base=url.rsplit('/',1)[0]
   def route(request):
    req=request.request
    if req.method not in ('GET','HEAD'):
     counts['writes']+=1;request.abort();return
    if not req.url.startswith(base+'/'):request.abort();return
    if '/tests/praise-preview.wav' in req.url:
     counts['audio']+=1;request.fulfill(status=200,content_type='audio/wav',body=wave_bytes);return
    if '/assets/hymn-scores/manifest.runtime.json' in req.url:
     counts['manifest']+=1
     if counts['manifest']==1:request.fulfill(status=503,body='unavailable');return
     request.fulfill(status=200,content_type='application/json',body=json.dumps({'301':{'title':'테스트','slides':[{'url':'assets/icon-192.png','scoreFormLabel':'Verse 1'},{'url':'assets/icon-512.png','scoreFormLabel':'Verse 2'}]}}));return
    request.continue_()
   page.route('**/*',route);page.goto(url);page.wait_for_function("typeof MindexPraiseMedia==='object'&&!document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{
    state.config={...state.config,authRequired:false};state.client={};state.connectionError='';state.module='praise';state.loading=false;state.metadataPopupOpen=false;
    const version=(id,name)=>({id,name,version_label:name,curated_version_name:name,hymn_no:'301',praise_types:['hymn'],_worshipVersionPersisted:true,forms:[{id:id+'-v',part_type:'Verse',part_number:1,lyrics:'보존할 가사'}],audio_set:{audioUrl:'/tests/praise-preview.wav?edition='+id,audioName:name+' 음원',enabled:true,starts:[0],sourceSignature:'saved-profile'}});
    state.songs=[{id:'catalog',title:'자료 확인',memo:'',hymn_no:'301',praise_types:['hymn'],_relationalVersionsLoaded:true,versions:[version('new','새찬송가'),version('union','통일 460 자료 확인')]},{id:'empty',title:'자료 없는 곡',memo:'',versions:[{id:'empty-v',name:'기본',forms:[]}]}];
    state.selectedSongId='catalog';state.selectedVersionId='new';state.forms=normalizeForms(structuredClone(state.songs[0].versions[0].forms));state.forms[0].lyrics='미저장 가사';state.dirty.forms=true;
    state.hymnScoreManifest={};state.hymnScoreManifestLoaded=false;clearSearchCaches();
    window.mediaBefore=JSON.stringify(state.songs);window.mediaDraft=JSON.stringify(state.forms);
    state.serviceMusic.audio={currentTime:17,paused:false,pause(){throw Error('Catalog preview touched Worship audio')}};state.serviceMusic.sourceKey='preserve-service.mp3';state.serviceMusic.timingGroupId='keep-group';state.serviceMusic.autoSyncSuspended=true;
    renderDetail();
   }''')
   panels=page.locator('[data-praise-version-media]');assert panels.count()==2
   assert page.locator('[data-praise-media-version="new"] [data-praise-score-preview]').count()==1
   assert page.locator('[data-praise-media-version="union"] [data-praise-score-preview]').count()==0
   assert counts['manifest']==0
   assert page.locator('audio.praise-audio-preview').evaluate_all("nodes=>nodes.every(a=>a.paused&&a.preload==='none')")
   panel=page.locator('[data-praise-media-version="new"]');panel.locator('summary').click()
   panel.locator('[data-praise-score-retry]').wait_for();assert page.evaluate('state.selectedVersionId')=='new'
   panel.locator('[data-praise-score-retry]').click();panel.locator('.praise-score-previews a').first.wait_for();assert panel.locator('.praise-score-previews a').count()==2
   assert counts['manifest']==2
   assert panel.locator('.praise-score-previews a').first.get_attribute('rel')=='noopener noreferrer'
   # Native controls are activated by a trusted test gesture; audio is muted in background tests.
   page.evaluate('''()=>{const button=document.createElement('button');button.id='test-preview-play';button.textContent='test preview';button.style.cssText='position:fixed;top:0;right:0;z-index:99999';button.onclick=()=>{const a=document.querySelector('[data-praise-media-version="new"] audio');a.muted=true;a.play()};document.body.append(button)}''')
   page.locator('#test-preview-play').click();page.wait_for_function("(()=>{const a=document.querySelector('[data-praise-media-version=\"new\"] audio');return !a.paused&&a.currentTime>.1})()")
   page.evaluate("window.oldCatalogPreview=document.querySelector('[data-praise-media-version=\"new\"] audio');window.previewTime=oldCatalogPreview.currentTime;renderDetail()")
   page.wait_for_timeout(100)
   assert page.evaluate("document.querySelector('[data-praise-media-version=\"new\"] audio')===oldCatalogPreview&&!oldCatalogPreview.paused&&oldCatalogPreview.currentTime>=previewTime"),(engine,'same-record rerender reset preview')
   union=page.locator('[data-praise-media-version="union"]');union.locator('summary').click()
   page.evaluate("document.querySelector('#test-preview-play').onclick=()=>{const a=document.querySelector('[data-praise-media-version=\"union\"] audio');a.muted=true;a.play()}")
   page.locator('#test-preview-play').click();page.wait_for_function("!document.querySelector('[data-praise-media-version=\"union\"] audio').paused&&document.querySelector('[data-praise-media-version=\"new\"] audio').paused")
   assert page.evaluate('state.selectedVersionId')=='new','Media selected surrounding version header'
   union.locator('summary').click();page.wait_for_function("document.querySelector('[data-praise-media-version=\"union\"] audio').paused")
   page.evaluate("document.querySelector('#test-preview-play').onclick=()=>{const a=document.querySelector('[data-praise-media-version=\"new\"] audio');a.muted=true;a.play()}")
   page.locator('#test-preview-play').click();page.wait_for_function('!oldCatalogPreview.paused')
   page.evaluate("state.selectedSongId='empty';state.selectedVersionId='empty-v';state.forms=[];renderDetail()")
   page.wait_for_function('oldCatalogPreview.paused&&!oldCatalogPreview.hasAttribute("src")')
   assert page.locator('[data-praise-version-media]').count()==0
   assert page.evaluate("JSON.stringify(state.songs)===mediaBefore&&state.serviceMusic.audio.currentTime===17&&state.serviceMusic.sourceKey==='preserve-service.mp3'&&state.serviceMusic.timingGroupId==='keep-group'&&state.serviceMusic.autoSyncSuspended")
   assert counts['writes']==0,counts
   page.evaluate("state.selectedSongId='catalog';state.selectedVersionId='new';state.forms=JSON.parse(mediaDraft);renderDetail()")
   assert page.evaluate('JSON.stringify(state.forms)===mediaDraft&&JSON.stringify(state.songs)===mediaBefore')
   # The catalog also supports a record exposed as one same-ID version.
   page.evaluate("""()=>{const prior=state.songs[0],v=structuredClone(prior.versions[0]);v.id='same-record';const s={...structuredClone(prior),id:'same-record',versions:[v]};state.songs=[s];state.selectedSongId=s.id;state.selectedVersionId=v.id;state.forms=normalizeForms(structuredClone(v.forms));window.sameRecordBefore=JSON.stringify(s);renderDetail()}""")
   same=page.locator('[data-praise-media-song="same-record"][data-praise-media-version="same-record"]');assert same.count()==1
   same.locator('summary').focus();page.keyboard.press('Enter');page.wait_for_function("document.querySelector('[data-praise-media-song=\"same-record\"]').open")
   assert page.evaluate("state.selectedSongId==='same-record'&&state.selectedVersionId==='same-record'&&JSON.stringify(state.songs[0])===sameRecordBefore")

   for width in (1100,400):
    page.set_viewport_size({'width':width,'height':950})
    assert page.locator('[data-praise-version-media]').evaluate_all("nodes=>nodes.every(n=>n.scrollWidth<=n.clientWidth+1)")
   print(engine,'PASS lazy score/retry, correct edition/audio, no auto-play, native playback, rerender/close/leave lifecycle, unsaved/source/Worship preservation',flush=True)
   browser.close()
finally:server.shutdown()
