"""Offline, mocked RPC only. Never activates an operational store."""
import os
from pathlib import Path
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,launch_chromium,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as pw:
  for engine in ('chromium','webkit'):
   b=launch_chromium(pw) if engine=='chromium' else pw.webkit.launch(headless=True)
   page=b.new_page();page.route('**/*supabase*/**',lambda r:r.abort());page.route('**/app.runtime.js*',lambda r:r.fulfill(path=str(Path(__file__).resolve().parents[1]/'app.js'),content_type='text/javascript'));page.goto(url+'?mindexSmokeRaw=1')
   page.wait_for_function("typeof normalizeServerSong==='function' && typeof ensureSingleSongActivation==='function'")
   print(engine,page.evaluate('''async()=>{
    const check=(v,m)=>{if(!v)throw Error(m)};
    const records=Array.from({length:201},(_,i)=>({id:'SONG-CONT-'+String(i+1).padStart(4,'0')+'-0001',revision:1,metadata:{title:'fixture '+i,praise_types:['ccm']},content:{name:'기본',forms:[]},relations:{same_song:[],related:[]}}));
    delete globalThis.MINDEX_SINGLE_SONG_BOOTSTRAP_READY;
    let mode='native',calls=0,broken=false,drift=false,finalReads=0;
    const status=()=>({protocol:1,idFormat:'4-4-4-4',phase:mode,epoch:'1',recordCount:records.length,manifest:drift&&finalReads>1?'changed':'fixture'});
    const client={rpc:async(name,args)=>{
      calls++;if(broken)return {error:{code:'57014',message:'timeout'}};
      if(name==='get_praise_storage_status_v1'){finalReads++;return {data:status()};}
      if(name==='get_single_praise_catalog_page_v1'){
       const rows=records.filter(r=>!args.after_id||r.id>args.after_id).slice(0,args.page_size);
       return {data:{records:structuredClone(rows),after:rows.at(-1)?.id,epoch:'1',manifest:'fixture'}};
      }
      throw Error('unexpected '+name);
    }};
    state.client=client;state.dirty={};state.saving=false;state.singleSongRepository=null;
    state.songs=[{id:'legacy',title:'keep draft'}];state.forms=[{lyrics:'keep'}];
    await ensureSingleSongActivation();check(calls===0,'default-off switch ignored');
    globalThis.MINDEX_SINGLE_SONG_BOOTSTRAP_READY=true;
    mode='maintenance';let blocked=false;try{await ensureSingleSongActivation()}catch{blocked=true}check(blocked&&state.songs[0].id==='legacy','maintenance mutated UI');
    mode='native';broken=true;blocked=false;try{await ensureSingleSongActivation()}catch{blocked=true}check(blocked&&!state.singleSongRepository,'error fell back');broken=false;
    drift=true;finalReads=0;blocked=false;try{await ensureSingleSongActivation()}catch{blocked=true}check(blocked&&state.songs[0].id==='legacy','mixed manifest installed');drift=false;finalReads=0;
    state.dirty.forms=true;blocked=false;try{await ensureSingleSongActivation()}catch{blocked=true}check(blocked&&state.forms[0].lyrics==='keep','dirty draft lost');state.dirty={};finalReads=0;
    await Promise.all([ensureSingleSongActivation(),ensureSingleSongActivation()]);
    check(state.songs.length===201&&state.singleSongStorage==='native'&&state.songs[0]._singleSongRecord,'native install failed');
    const originalLoad=loadServiceData,originalAtomic=worshipAtomicClient;
    state.singleSongRepository=null;state.singleSongCatalog=null;state.singleSongStorage=null;
    state.module='home';state.selectedSongId=null;state.selectedScriptureId=null;state.selectedBookCode=null;
    let projected=false;
    loadServiceData=async()=>{check(state.singleSongStorage==='native'&&state.singleSongCatalog,'home projected before native activation');projected=true};
    worshipAtomicClient=async()=>({});
    await loadInitialData();check(projected,'home loader missing');
    loadServiceData=originalLoad;worshipAtomicClient=originalAtomic;
    const saved=state.singleSongRepository;state.client={rpc:()=>{throw Error('wrong project')}};
    blocked=false;try{await ensureSingleSongActivation()}catch{blocked=true}check(blocked&&state.singleSongRepository===saved,'project changed silently');
    const missing=await MindexSingleSong.loadActivation({rpc:async()=>({error:{code:'PGRST202',message:'get_praise_storage_status_v1 not found'}})});check(missing.phase==='legacy','explicit absent RPC');
    return 'PASS default-off, maintenance/network/drift fail closed, draft retention, paginated native install, coalescing and project boundary';
   }'''),flush=True);b.close()
finally:server.shutdown()
