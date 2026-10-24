"""Slow hymn assets must not duplicate title frames or freeze a hovered board."""
import os
os.environ["MINDEX_SMOKE_OFFLINE"]="1"
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
remote=os.environ.get('MINDEX_PENDING_HYMN_URL','').rstrip('/')
server,url=(None,remote+'/') if remote else start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   try:
    page=browser.new_page(viewport={'width':1400,'height':900});page.set_default_timeout(8000)
    page.route('**/*',lambda r:r.abort() if '.supabase.co/' in r.request.url or r.request.method not in ('GET','HEAD') else r.continue_())
    page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof state !== \"undefined\" && typeof compactSearchValue === \"function\" && !document.body.classList.contains('ui-booting') && (typeof presenterElementTrailingBlankSlide==='function')")
    result=page.evaluate('''() => {
      const service={id:'pending-hymn-fixture',type_id:'fixture',date:'2026-10-14',title:'Fixture'};
      const song={id:'pending-song',title:'이 천지간 만물들아',hymn_no:'5',praise_types:['hymn'],_relationalVersionsLoaded:true,
        versions:[{id:'pending-version',name:'새찬송가',hymn_no:'5',praise_types:['hymn'],forms:[]}]};
      const item={id:'pending-item',service_id:service.id,label:'송영',raw_title:song.title,song_id:song.id,version_id:'pending-version',sort_order:1,
        _worshipSectionKey:'sending',_worshipSectionTitle:'파송',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'score_db',outputMode:'score'})};
      state.services=[service];state.serviceTypes=[{id:'fixture',name:'Fixture'}];state.serviceItems={[service.id]:[item]};state.songs=[song];
      state.selectedServiceId=service.id;state.selectedServiceTypeId='fixture';state.module='presenter';state.client={};state.connectionError='';state.serviceError='';
      state.loadedWorshipServiceIds=new Set([service.id]);state.loadedWorshipPresenterServiceIds=new Set([service.id]);
      state.presenter.serviceId=service.id;state.presenter.viewServiceId=service.id;state.presenter.sourceSignature='';state.presenter.slides=[];
      state.hymnScoreManifest={};state.hymnScoreManifestLoaded=false;
      canUseClientData=()=>false;loadServiceItems=async()=>{};hydratePresenterServiceData=async()=>false;
      warmServiceItemScriptureReferencesForService=()=>Promise.resolve(false);warmWorshipScriptureReferencesForService=()=>Promise.resolve(false);
      publishPresenterState=()=>{};getServiceItems=()=>[item];getServiceOutputItems=()=>[item];
      window.pendingFixtureBefore=JSON.stringify({song,item});
      const slides=presenterSlidesForService(service.id).filter(s=>s.elementId===item.id);
      if(!slides.some(s=>s.loadingContent))throw Error('missing loading frame');
      render();
      return {types:slides.map(s=>s.type)};
    }''')
    print(engine,'pending asset',result,flush=True)
    thumb=page.locator('#servicePresenterControls .svc-slide-thumb').first
    thumb.hover()
    page.evaluate('''() => {
      const root=document.querySelector('#servicePresenterControls');
      const query=root.querySelector.bind(root);
      root.querySelector=selector=>selector==='.svc-slide-thumb:hover'?query('.svc-slide-thumb'):query(selector);
      state.hymnScoreManifest={'5':{title:'이 천지간 만물들아',slides:[{url:'assets/hymn-scores/5/slide-01.webp'}]}};
      state.hymnScoreManifestLoaded=true;
      refreshPresenterForService('pending-hymn-fixture');
    }''')
    page.wait_for_function("document.querySelector('#servicePresenterControls [data-element-type=\"image\"]') || document.querySelector('#servicePresenterControls .presenter-slide--score')",timeout=4000)
    page.screenshot(path='/tmp/mindex-pending-hymn-'+engine+'.png')
    assert page.evaluate("""()=>{
      const blank=presenterSlidesForService('pending-hymn-fixture').find(s=>s.autoTrailingBlank);
      if(!blank)throw Error('missing loaded trailing blank');
      const html=renderPresenterSlideFrame(blank,{noChromakey:true});
      const restored={...blank,songTitle:'old title',songTitleContent:{title:'old title'},fullscreenSongTitle:true};
      return !html.includes('presenter-slide--fullscreen-song-title')&&!renderPresenterSlideFrame(restored,{noChromakey:true}).includes('old title');
    }"""),'loaded trailing blank rendered as duplicate song title'
    assert page.evaluate("JSON.stringify({song:state.songs[0],item:state.serviceItems['pending-hymn-fixture'][0]})===window.pendingFixtureBefore")
    print(engine,'PASS blank stays blank and delayed score replaces stale board while pointer stays over thumbnail; records unchanged',flush=True)
   finally:browser.close()
finally:
 if server:server.shutdown()
