"""Read-only DB preflight and live lyric isolation; no native output window."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as pw:
  for engine in ['chromium','webkit']:
   b=launch_chromium(pw) if engine=='chromium' else pw.webkit.launch(headless=True)
   page=b.new_page();page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url+'?output=presenter');page.wait_for_function('!!window.MindexPresenterFreshness')
   result=page.evaluate('''async()=>{
    const check=(ok,msg)=>{if(!ok)throw Error(msg)};
    const sid='00000000-0000-4000-8000-000000000001',songId='00000000-0000-4000-8000-000000000002',vid='00000000-0000-4000-8000-000000000003';
    const item={id:'element',song_id:songId,version_id:vid,label:'찬양',raw_title:'fixture',memo:JSON.stringify({inputMode:'lyrics_db',formHint:'V-V',audioTiming:{starts:[0,4]}})};
    state.services=[{id:sid,type_id:'fixture'}];state.serviceItems={[sid]:[item]};state.selectedServiceId=sid;state.config.url='fixture';state.dirty.song=false;state.dirty.forms=false;state.presenter.outputPendingAt=0;
    window.live=false;isPresenterOutputWindowOpen=()=>live;hydratePresenterServiceData=async()=>{};
    getServiceOutputItems=id=>state.serviceItems[id]||[];serviceDocumentPresenterSlides=()=>[{type:'lyrics',text:'OLD_SNAPSHOT'}];
    let fail='',revision='1',requests=0,release=null;const notices=[];showToast=text=>notices.push(text);
    const db={mindex_songs:[{id:songId,title:'fixture',memo:null}],mindex_song_versions:[{id:vid,source_song_id:songId,canonical_song_id:songId,version_label:'기본',version_order:1}],mindex_version_units:[{id:'unit',version_id:vid,unit_kind:'Verse',text:'NEW_DB',unit_order:1}]};
    state.client={from(table){const filters={};const q={select(){return q},in(k,v){filters[k]=v;return q},eq(){return q},order(){return q},async single(){return {data:{id:sid,save_revision:revision}}},async range(){requests++;if(fail===table)throw Error('network');if(release)await new Promise(r=>{release=r});return {data:(db[table]||[]).filter(row=>Object.entries(filters).every(([k,v])=>v.includes(row[k])))}}};return q}};
    let reserved;window.open=()=>reserved={closed:false,location:{replace(url){reserved.url=url}},close(){this.closed=true},focus(){}};
    presenterOutputWindowFeatures=()=>'';resolvePresenterTargetScreenRect=()=>null;presenterOutputUrl=()=>url;
    const original=JSON.stringify(item);
    const gate=MindexPresenterFreshness.beforeOpen,prepare=preparePresenterService;
    MindexPresenterFreshness.beforeOpen=async()=>false;serviceNavigationBlocked=()=>false;
    preparePresenterService=()=>{throw Error('published before verification')};
    await openPresenterOutput(sid);MindexPresenterFreshness.beforeOpen=gate;preparePresenterService=prepare;
    fail='mindex_version_units';check(!await MindexPresenterFreshness.beforeOpen(sid),'failure admitted');check(reserved.closed&&!reserved.url,'failure navigated');
    fail='';check(await MindexPresenterFreshness.beforeOpen(sid),'valid rejected');check(reserved.url,'no navigation');check(songById(songId).versions[0].forms[0].lyrics==='NEW_DB','stale cache');check(JSON.stringify(item)===original,'links/forms/timing changed');
    const n=requests;live=true;songById(songId).versions[0].forms[0].lyrics='LATER_EDIT';
    check(presenterSongForServiceItem(item,'fixture','찬양',state.services[0]).versions[0].forms[0].lyrics==='NEW_DB','live lyrics replaced');
    MindexPresenterFreshness.notify(songId);MindexPresenterFreshness.notify(songId);check(notices.filter(x=>x.includes('현재 송출')).length===1,'notice missing/duplicate');
    check(await MindexPresenterFreshness.beforeOpen(sid)&&requests===n,'live refreshed');
    live=false;db.mindex_version_units[0].text='LATEST';check(await MindexPresenterFreshness.beforeOpen(sid),'restart');check(songById(songId).versions[0].forms[0].lyrics==='LATEST','restart stale');
    live=true;state.presenter.serviceId=sid;
    db.mindex_version_units[0].text='NEXT';
    const activate=await MindexPresenterFreshness.verify(sid,null,true);
    check(MindexPresenterFreshness.song(songId,sid).versions[0].forms[0].lyrics==='LATEST','preflight replaced live snapshot');
    activate();check(MindexPresenterFreshness.song(songId,sid).versions[0].forms[0].lyrics==='NEXT','transition snapshot not activated');
    live=true;revision='2';await MindexPresenterFreshness.checkLiveRevision();check(notices.filter(x=>x.includes('현재 송출')).length===2,'revision notice');live=false;
    state.serviceItems[sid]=[];check(!await MindexPresenterFreshness.beforeOpen(sid)&&reserved.closed,'snapshot admitted');state.serviceItems[sid]=[item];
    const savedVersions=db.mindex_song_versions;db.mindex_song_versions=[];check(!await MindexPresenterFreshness.beforeOpen(sid),'missing version admitted');db.mindex_song_versions=savedVersions;
    hydratePresenterServiceData=()=>new Promise(r=>{release=r});const waiting=MindexPresenterFreshness.beforeOpen(sid);check(!await MindexPresenterFreshness.beforeOpen(sid),'duplicate prepare');state.selectedServiceId='other';const finish=release;release=null;finish();check(!await waiting,'navigation race');
    state.selectedServiceId=sid;const cancelled=MindexPresenterFreshness.beforeOpen(sid);state.presenter.outputGeneration++;const cancelFinish=release;release=null;cancelFinish();check(!await cancelled,'stop during preparation ignored');
    check(JSON.stringify(item)===original,'persistent item changed');return {failureBlocks:true,freshRead:true,liveFrozen:true,notice:true,restartFresh:true,legacyBlocked:true,duplicateAndNavigationGuard:true};
   }'''.replace('()=>url','()=>location.href'))
   print(engine,'PASS',result,flush=True);b.close()
finally:server.shutdown();server.server_close()
