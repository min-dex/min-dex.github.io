"""Offline actual Praise save path: two-editor conflict and interrupted RPCs."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,launch_chromium,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page();page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url+'?output=presenter&mindexSmokeRaw=1');page.wait_for_function("typeof praiseSnapshotSong==='function'")
   result=page.evaluate('''async()=>{
    const check=(x,m)=>{if(!x)throw Error(m)},id=crypto.randomUUID(),vid=crypto.randomUUID(),uid=crypto.randomUUID();
    const original={song:{id,title:'원본',memo:'{}',praise_types:['ccm'],scripture_refs:[]},
     versions:[{id:vid,source_song_id:id,canonical_song_id:id,version_order:1,version_label:'기본',curated_version_name:'기본',praise_types:['ccm'],is_primary:true,lyric_signature:'original',subtitle:'원본 부제',original_title:'source title',deck_key:'source deck',source_count:7,audio_set:{timings:[1,2]}}],
     units:[{id:uid,version_id:vid,canonical_song_id:id,unit_order:1,curated_order:1,unit_kind:'verse',curated_unit_type:'Verse',text:'원본 가사',source_unit_id:crypto.randomUUID(),trigger:'source cue',slide_numbers:[2,3],review_note:'source review',review_status:'reviewed'}],relations:[]};
    let db,reads=0,writes=0,mode='ok',requests=[],late=null;
    const client={from(){throw Error('Non-atomic table write/read')},async rpc(name,{req}){
     if(name==='get_praise_snapshot_v1'){reads++;if(mode==='read-fail')return {error:{message:'offline'}};return {data:structuredClone(db)}}
     check(name==='save_praise_v1','unexpected RPC');writes++;requests.push(structuredClone(req));
     if(mode==='before-send')throw Error('offline before request');
     if(mode==='race'){db.units[0].text='다른 기기 최신 가사';return {error:{code:'P0001',message:'PRAISE_CONFLICT'}}}
     if(db.song.memo.includes(req.requestId))return {data:{snapshot:structuredClone(db),replayed:true}};
     check(JSON.stringify(req.expected)===JSON.stringify(db),'CAS baseline differs');
     if(mode==='reject')return {error:{code:'P0001',message:'INJECTED_ROLLBACK'}};
     db.song={...db.song,...req.songPatch,memo:JSON.stringify({_praiseCommit:{id:req.requestId}})};
     if(req.versions)db.versions=req.versions.map(row=>({...db.versions.find(x=>x.id===row.id),...row}));
     if(req.units)db.units=req.units;
     if(late){late();late=null}
     if(mode==='lost-response')throw Error('response lost');
     return {data:{snapshot:structuredClone(db)}};
    }};
    state.client=client;state.config.url='https://offline.invalid';state.module='praise';
    state.songVersionTablesSupported=true;state.songVersionPraiseTypesSupported=true;state.songRelationsSupported=true;
    state.auth.session={user:{id:'offline'}};state.connectionError='';
    ensureCanonicalSongRow=async()=>id;
    fetchExistingSongVersions=async()=>structuredClone(db.versions);
    fetchExistingCanonicalSongVersions=async()=>structuredClone(db.versions);
    fetchExistingVersionUnits=async()=>structuredClone(db.units);
    clearSearchCaches=()=>{};
    const reset=()=>{db=structuredClone(original);reads=writes=0;requests=[];mode='ok';late=null;state.selectedSongId=id;state.selectedVersionId=vid;state.songs=[praiseSnapshotSong(db)];state.forms=structuredClone(state.songs[0].versions[0].forms);captureCleanFingerprint('praise');state.dirty.song=false;state.dirty.forms=false;return state.songs[0]};
    const edit=(song,text)=>{state.forms[0].lyrics=text;state.dirty.forms=true;writeFormsToSelectedVersion()};
    const fails=async fn=>{let failed=false;try{await fn()}catch{failed=true}check(failed,'expected failure')};
    let song=reset();edit(song,'내 가사');db.units[0].text='다른 기기 가사';await fails(()=>saveSongMeta(song));check(writes===0&&state.forms[0].lyrics==='내 가사','stale save wrote or lost draft');
    song=reset();edit(song,'내 가사');mode='read-fail';await fails(()=>saveSongMeta(song));check(writes===0&&state.dirty.forms,'failed read changed dirty state');
    song=reset();edit(song,'내 가사');mode='race';await fails(()=>saveSongMeta(song));check(db.units[0].text==='다른 기기 최신 가사'&&state.forms[0].lyrics==='내 가사','race overwrote');
    song=reset();edit(song,'내 가사');mode='before-send';await fails(()=>saveSongMeta(song));check(db.units[0].text==='원본 가사','pre-send changed server');mode='ok';check(await saveSongMeta(song),'retry did not finish');check(requests[0].requestId===requests[1].requestId,'retry request changed');
    song=reset();edit(song,'먼저 저장한 가사');mode='lost-response';await fails(()=>saveSongMeta(song));edit(song,'응답 대기 중 추가 가사');mode='ok';check(await saveSongMeta(song)===false,'late input marked clean');check(state.forms[0].lyrics==='응답 대기 중 추가 가사'&&state.dirty.forms,'late draft lost');check(requests[0].requestId===requests[1].requestId,'lost reply duplicated request');check(db.units[0].text==='먼저 저장한 가사','replay overwrote server');
    check(await saveSongMeta(song),'second explicit save failed');check(db.versions[0].source_count===7&&db.versions[0].deck_key==='source deck'&&db.versions[0].subtitle==='원본 부제','version provenance lost');check(db.units[0].source_unit_id===original.units[0].source_unit_id&&db.units[0].trigger==='source cue'&&db.units[0].review_note==='source review','unit provenance lost');check(db.units[0].text==='응답 대기 중 추가 가사','late draft not saved');
    song=reset();edit(song,'내 가사');mode='reject';await fails(()=>saveSongMeta(song));check(db.units[0].text==='원본 가사'&&state.dirty.forms,'rollback cleared input');
    return 'stale editor, read failure, CAS race, pre-send retry, lost reply replay, late typing preservation and explicit follow-up save';
   }''')
   print(engine,'PASS',result,flush=True);browser.close()
finally:server.shutdown();server.server_close()
