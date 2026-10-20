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
                  const savedVersions=[{id:'saved-version',forms:[{id:'verse',lyrics:'보존할 찬양 가사'}]}];
                  state.songs=[{id:'progressive',title:'지연가사테스트',versions:savedVersions,_relationalVersionsLoaded:true}];
                  songCatalogLoaded=false;let fail;
                  attachRelationalSongVersions=()=>new Promise((resolve,reject)=>{fail=reject});
                  const overlapping=loadSongs();
                  for(let i=0;i<40&&!fail;i++)await new Promise(r=>setTimeout(r,10));
                  check(fail,'catalog version lookup did not start');
                  check(state.songs[0].versions===savedVersions,'metadata refresh erased hydrated lyrics');
                  fail(new Error('temporary lyrics failure'));await overlapping;
                  check(!songCatalogLoaded,'failed lyrics marked catalog complete');
                  check(state.songs[0].versions===savedVersions,'failed catalog erased linked lyrics');
                  check(!songLoadPromise,'failed load kept retry lock');
                  attachRelationalSongVersions=async()=>{};await loadSongs();
                  check(songCatalogLoaded,'retry without reload failed');
                  state.serviceTypes=[];renderPresenterDetail();
                  check(!document.querySelector('link[rel=prefetch][href*=chromakey-ready-loop]'),'controller eagerly downloads ready video');
                  return 'PASS visible song titles before delayed lyrics, complete-state boundary, no video prefetch';
                }'''))
            finally:browser.close()
finally:server.shutdown()
