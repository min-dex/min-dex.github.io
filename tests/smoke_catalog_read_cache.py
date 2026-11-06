"""Real IndexedDB, synthetic catalogs and blocked external requests only."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
FIXTURE='''()=>{
 window.fixtureRecords=Array.from({length:4},(_,i)=>({id:'SONG-CONT-000'+(i+1)+'-0001',revision:1,metadata:{title:'fixture '+i},content:{name:'기본',forms:[{id:'v',lyrics:'원문\\n둘째 줄'}]},relations:{same_song:[],related:[]}}));
 window.fixtureStatus={protocol:1,idFormat:'4-4-4-4',phase:'native',epoch:'1',manifest:'read-cache-fixture',recordCount:4};
 window.fixtureClient=(url='https://cache-fixture.invalid',key='fixture-public',status=fixtureStatus)=>{
  const calls=[];return {supabaseUrl:url,supabaseKey:key,calls,rpc:async(name,args)=>{
   calls.push(name);if(name==='get_praise_storage_status_v1')return {data:structuredClone(status)};
   const rows=fixtureRecords.filter(r=>!args.after_id||r.id>args.after_id).slice(0,args.page_size);
   return {data:{records:structuredClone(rows),after:rows.at(-1)?.id??null,epoch:status.epoch,manifest:status.manifest}};
  }};
 };
 window.checkCache=(ok,message)=>{if(!ok)throw Error(message)};
}'''
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=b.new_page();page.route('**/*supabase*/**',lambda r:r.abort());page.goto(url)
   page.wait_for_function("typeof ensureSingleSongActivation==='function'&&!document.body.classList.contains('ui-booting')")
   page.evaluate(FIXTURE)
   page.evaluate('''async()=>{
    const c=fixtureClient(),prepared=await MindexSingleSong.loadActivation(c,{persistent:true});
    checkCache(c.calls.length===3,'initial catalog must come from server');
    await MindexCatalogCache.write(c,prepared);
    const copy=await MindexCatalogCache.read(c,fixtureStatus);checkCache(copy&&JSON.stringify(copy.records)===JSON.stringify(fixtureRecords),'IDB roundtrip changed source');
    copy.records[0].metadata.title='edited';checkCache((await MindexCatalogCache.read(c,fixtureStatus)).records[0].metadata.title==='fixture 0','cached records shared');
    checkCache(!await MindexCatalogCache.read(fixtureClient('https://other-project.invalid'),fixtureStatus),'project leaked');
    checkCache(!await MindexCatalogCache.read(fixtureClient(undefined,'different-key'),fixtureStatus),'connection key leaked');
    checkCache(!await MindexCatalogCache.read(c,{...fixtureStatus,manifest:'changed'}),'stale manifest trusted');
   }''')
   page.reload();page.wait_for_function("typeof ensureSingleSongActivation==='function'&&!document.body.classList.contains('ui-booting')");page.evaluate(FIXTURE)
   result=page.evaluate('''async()=>{
    const c=fixtureClient(),prepared=await MindexSingleSong.loadActivation(c,{persistent:true});
    checkCache(c.calls.length===1&&prepared.fromReadCache,'reload redownloaded unchanged catalog');
    checkCache(JSON.stringify(prepared.records)===JSON.stringify(fixtureRecords),'reload source changed');
    if(singleSongActivationPending)await singleSongActivationPending.promise.catch(()=>{});
    state.client=fixtureClient();state.config.authRequired=false;state.singleSongRepository=null;state.singleSongCatalog=null;
    state.forms=[{id:'draft',lyrics:'미저장 원문'}];state.dirty.forms=true;
    const before=JSON.stringify([state.forms,state.presenter,state.serviceMusic]);let blocked=false;
    try{await ensureSingleSongActivation()}catch{blocked=true}
    checkCache(blocked&&JSON.stringify([state.forms,state.presenter,state.serviceMusic])===before&&!state.singleSongRepository,'cache replaced dirty editor/transport');
    state.dirty={};state.client=fixtureClient();state.config.authRequired=true;
    await ensureSingleSongActivation();checkCache(state.client.calls.length===3,'authenticated mode reused disk cache');
    // Accidental payload corruption must fail checksum and fall back to RPC.
    await new Promise((resolve,reject)=>{const req=indexedDB.open('mindex-native-read-cache-v1',1);req.onerror=reject;req.onsuccess=()=>{
     const db=req.result,tx=db.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots'),cursor=store.openCursor();
     cursor.onsuccess=()=>{const v=cursor.result;if(!v)return;if(v.value.signature.includes('read-cache-fixture')){const entry=v.value;entry.body+=' ';v.update(entry);}v.continue()};
     tx.oncomplete=()=>{db.close();resolve()};tx.onerror=reject;
    }});
    const recovered=fixtureClient();await MindexSingleSong.loadActivation(recovered,{persistent:true});checkCache(recovered.calls.length===3,'corruption was installed');
    // A changed revision index can use a verified previous disk snapshot across clients.
    const deltaClient=fixtureClient('https://delta-fixture.invalid');
    await MindexCatalogCache.write(deltaClient,{status:fixtureStatus,records:fixtureRecords});
    const updated=structuredClone(fixtureRecords.slice(1));
    updated[0].revision=2;
    updated[0].content.forms[0].lyrics='변경된 원문';
    const latest={...fixtureStatus,manifest:'delta-latest',recordCount:updated.length,catalogIndex:1};
    const downloaded=[];
    deltaClient.rpc=async(name,args)=>{
      if(name==='get_praise_storage_status_v1')return {data:latest};
      if(name==='get_praise_catalog_index_v1')return {data:{epoch:latest.epoch,manifest:latest.manifest,entries:updated.map(row=>[row.id,row.revision])}};
      if(name==='get_single_praise_records_v1'){
        downloaded.push(...args.ids);
        return {data:structuredClone(updated.filter(row=>args.ids.includes(row.id)))};
      }
      throw Error('unexpected full catalog download');
    };
    const delta=await MindexSingleSong.loadActivation(deltaClient,{persistent:true});
    checkCache(JSON.stringify(delta.records)===JSON.stringify(updated)&&downloaded.join()===updated[0].id,'revision index did not preserve source and fetch only changed record');
    checkCache(!await MindexCatalogCache.read(deltaClient,{...latest,epoch:'2'},{allowPrevious:true}),'old epoch snapshot reused');
    // A blocked/quota-denied browser cache cannot stop authoritative reads.
    const descriptor=Object.getOwnPropertyDescriptor(window,'indexedDB');
    Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){throw Error('fixture denied')}}});
    try{const disabled=fixtureClient('https://denied.invalid');await MindexSingleSong.loadActivation(disabled,{persistent:true});checkCache(disabled.calls.length===3,'storage failure stopped server reads')}
    finally{if(descriptor)Object.defineProperty(window,'indexedDB',descriptor);else delete window.indexedDB}
    const savedDescriptor=Object.getOwnPropertyDescriptor(window,'indexedDB');
    Object.defineProperty(window,'indexedDB',{configurable:true,value:{open(){return {}}}});
    try{
     const bounded=await Promise.race([MindexCatalogCache.read(fixtureClient('https://blocked.invalid'),fixtureStatus).then(v=>v===null),new Promise(resolve=>setTimeout(()=>resolve(false),1000))]);
     checkCache(bounded,'blocked IndexedDB stalled activation');
    }finally{if(savedDescriptor)Object.defineProperty(window,'indexedDB',savedDescriptor);else delete window.indexedDB}
    // Removal during hashing wins over a pending write (no cache resurrection).
    const race=fixtureClient('https://race.invalid'),original=crypto.subtle.digest;let release;
    crypto.subtle.digest=function(algorithm,bytes){
     if(new TextDecoder().decode(bytes).includes('"title":"race-marker"'))return new Promise(resolve=>{release=()=>original.call(crypto.subtle,algorithm,bytes).then(resolve)});
     return original.call(crypto.subtle,algorithm,bytes);
    };
    try{
     const raceRecords=structuredClone(fixtureRecords);raceRecords[0].metadata.title='race-marker';
     const pending=MindexCatalogCache.write(race,{status:fixtureStatus,records:raceRecords});
     const deadline=Date.now()+2000;while(!release&&Date.now()<deadline)await new Promise(r=>setTimeout(r,10));
     checkCache(release,'hash race not reached');await MindexCatalogCache.remove(race);release();
     checkCache(!await pending&&!await MindexCatalogCache.read(race,fixtureStatus),'removed cache resurrected');
    }finally{crypto.subtle.digest=original}
    return 'PASS real IDB reload, fresh manifest/project/key guards, checksum fallback, storage failure/timeout, write/remove race and draft/auth/transport preservation';
   }''')
   print(engine,result,flush=True);b.close()
finally:server.shutdown()
