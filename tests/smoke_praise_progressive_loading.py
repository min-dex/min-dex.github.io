from smoke_app import launch_chromium, start_local_app_server, sync_playwright
server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ('chromium','webkit'):
            browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
            try:
                page=browser.new_page()
                page.route('**/*supabase*/**',lambda r:r.abort())
                page.goto(url,wait_until='domcontentloaded')
                page.wait_for_function("typeof loadSongs==='function'")
                print(engine,page.evaluate('''async()=>{
                  const check=(v,m)=>{if(!v)throw Error(m)};
                  state.client={};state.config={...state.config,authRequired:false};
                  state.module='praise';state.search='';state.praiseTypeFilter='all';
                  state.selectedSongId=null;state.selectedVersionId=null;state.songs=[];
                  songCatalogLoaded=false;state.connectionError='';
                  fetchAllRows=async()=>({data:[{id:'progressive',title:'지연가사테스트',praise_types:['ccm']}],error:null});
                  let release;attachRelationalSongVersions=()=>new Promise(r=>{release=r});
                  attachSongRelations=async()=>{};
                  const loading=loadSongs();
                  for(let i=0;i<40&&!release;i++)await new Promise(r=>setTimeout(r,10));
                  check(release,'version loading did not start');
                  check(refs.songList.textContent.includes('지연가사테스트'),'list waits for all lyrics');
                  check(!songCatalogLoaded,'partial catalog marked complete');
                  check(!state.selectedSongId,'summary selected a song');
                  release();await loading;
                  check(songCatalogLoaded,'complete catalog not marked ready');
                  state.serviceTypes=[];renderPresenterDetail();
                  check(!document.querySelector('link[rel=prefetch][href*=chromakey-ready-loop]'),'controller eagerly downloads ready video');
                  return 'PASS visible song titles before delayed lyrics, complete-state boundary, no video prefetch';
                }'''))
            finally:browser.close()
finally:server.shutdown()
