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
    const readCount=calls;
    check(await reuseVerifiedSingleSongCatalog(state),'verified initial snapshot not reused');
    check(calls===readCount+1,'reuse downloaded full records instead of status');
    state.dirty.forms=true;
    check(!await reuseVerifiedSingleSongCatalog(state)&&calls===readCount+1,'draft triggered cache/network');
    state.dirty={};
    const beforeList=calls,canonical=JSON.stringify(state.songs);
    await loadSongsOnce({searchOnly:true});
    check(calls===beforeList+1&&JSON.stringify(state.songs)===canonical,'initial list redownloaded or changed native content');
    const originalRpc=client.rpc;
    client.rpc=async()=>({data:{...status(),manifest:'remote update'}});
    check(!await reuseVerifiedSingleSongCatalog(state),'changed manifest reused catalog');
    client.rpc=async()=>({error:{code:'network'}});blocked=false;
    try{await reuseVerifiedSingleSongCatalog(state)}catch{blocked=true}
    check(blocked,'failed status trusted visible catalog');
    client.rpc=async()=>{state.dirty.forms=true;return {data:status()}};
    check(!await reuseVerifiedSingleSongCatalog(state),'draft arriving during status read was ignored');
    state.dirty={};client.rpc=originalRpc;
    const snapshot=await MindexSingleSong.loadActivation(client),afterSnapshot=calls;
    snapshot.records[0].metadata.title='consumer edit';
    const [sharedA,sharedB]=await Promise.all([MindexSingleSong.loadActivation(client),MindexSingleSong.loadActivation(client)]);
    check(calls===afterSnapshot+1,'concurrent manifest read not coalesced');
    check(sharedA.records[0].metadata.title!=='consumer edit','consumer mutated cache');
    sharedA.records[0].metadata.title='other edit';
    check(sharedB.records[0].metadata.title!=='other edit','concurrent consumers share mutable records');
    broken=true;blocked=false;try{await MindexSingleSong.loadActivation(client)}catch{blocked=true}
    check(blocked,'failed status reused cached snapshot');broken=false;
    const beforeRetry=calls;await MindexSingleSong.loadActivation(client);
    check(calls===beforeRetry+5,'failed status retained trusted snapshot');
    const previousStatus=status;
    const isolatedCalls=[];
    let epoch='2',manifest='new',phase='native';
    const isolated={rpc:async(name,args)=>{
      isolatedCalls.push(name);
      if(name==='get_praise_storage_status_v1')return {data:{...previousStatus(),epoch,manifest,phase}};
      const reply=await client.rpc(name,args);return {data:{...reply.data,epoch,manifest}};
    }};
    await MindexSingleSong.loadActivation(isolated);check(isolatedCalls.length===5,'different client reused snapshot');
    manifest='changed';await MindexSingleSong.loadActivation(isolated);check(isolatedCalls.length===10,'changed manifest reused snapshot');
    epoch='3';await MindexSingleSong.loadActivation(isolated);check(isolatedCalls.length===15,'changed epoch reused snapshot');
    phase='maintenance';blocked=false;try{await MindexSingleSong.loadActivation(isolated)}catch{blocked=true}
    check(blocked,'maintenance served cached snapshot');
    const originalLoad=loadServiceData,originalAtomic=worshipAtomicClient;
    state.singleSongRepository=null;state.singleSongCatalog=null;state.singleSongStorage=null;
    state.module='home';state.selectedSongId=null;state.selectedScriptureId=null;state.selectedBookCode=null;
    let projected=false;
    loadServiceData=async()=>{check(state.singleSongStorage==='native'&&state.singleSongCatalog,'home projected before native activation');projected=true};
    worshipAtomicClient=async()=>({});
    await loadInitialData();check(projected,'home loader missing');
    loadServiceData=originalLoad;worshipAtomicClient=originalAtomic;
    const saved=state.singleSongRepository;
    const batches=[];state.singleSongRepository={read:async ids=>{batches.push(ids.length);return records.filter(r=>ids.includes(r.id))}};
    const reread=await readSingleSongs(records.map(r=>r.id));
    check(reread.length===201&&JSON.stringify(batches)==='[100,100,1]','unbounded native reread');
    state.singleSongRepository=saved;state.client={rpc:()=>{throw Error('wrong project')}};
    blocked=false;try{await ensureSingleSongActivation()}catch{blocked=true}check(blocked&&state.singleSongRepository===saved,'project changed silently');
    finalReads=0;const pageCalls=[];let timeoutOnce=true;
    const smallClient={rpc:async(name,args)=>{
      if(name==='get_single_praise_catalog_page_v1'){
        pageCalls.push({after:args.after_id,size:args.page_size});
        if(timeoutOnce){timeoutOnce=false;return {error:{code:'57014',message:'timeout'}};}
      }
      return client.rpc(name,args);
    }};
    const recovered=await MindexSingleSong.loadActivation(smallClient);
    check(recovered.records.length===201&&pageCalls[0].size===100&&pageCalls[1].size===25&&pageCalls[0].after===pageCalls[1].after&&pageCalls.slice(1).every(p=>p.size===25),'timeout retry changed cursor or lost records');
    let repeated=0;blocked=false;
    try{await MindexSingleSong.loadActivation({rpc:async(name,args)=>name==='get_single_praise_catalog_page_v1'?(repeated++,{error:{code:'57014'}}):client.rpc(name,args)})}catch{blocked=true}
    check(blocked&&repeated===2,'persistent timeout retried indefinitely or installed partial records');
    const missing=await MindexSingleSong.loadActivation({rpc:async()=>({error:{code:'PGRST202',message:'get_praise_storage_status_v1 not found'}})});check(missing.phase==='legacy','explicit absent RPC');
    return 'PASS default-off, maintenance/network/drift fail closed, draft retention, paginated native install, coalescing and project boundary';
   }'''),flush=True);b.close()
finally:server.shutdown()
