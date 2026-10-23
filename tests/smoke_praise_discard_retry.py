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
    const nativeConfirm=confirmUnsavedChangesAction;
    const check=(x,m)=>{if(!x)throw Error(m)},id=crypto.randomUUID(),vid=crypto.randomUUID(),uid=crypto.randomUUID();
    const original={song:{id,title:'원본',memo:'{}',praise_types:['ccm'],scripture_refs:[]},
     versions:[{id:vid,source_song_id:id,canonical_song_id:id,version_order:1,version_label:'기본',curated_version_name:'기본',praise_types:['ccm'],is_primary:true,lyric_signature:'original',subtitle:'원본 부제',original_title:'source title',deck_key:'source deck',source_count:7,audio_set:{timings:[1,2]}}],
     units:[{id:uid,version_id:vid,canonical_song_id:id,unit_order:1,curated_order:1,unit_kind:'verse',curated_unit_type:'Verse',text:'원본 가사',source_unit_id:crypto.randomUUID(),trigger:'source cue',slide_numbers:[2,3],review_note:'source review',review_status:'reviewed'}],relations:[]};
    let db,reads=0,writes=0,mode='ok',requests=[],late=null,releaseResponse,requestStarted;let started;
    const client={from(){throw Error('Non-atomic table write/read')},async rpc(name,{req}){
     if(name==='get_praise_snapshot_v1'){reads++;if(mode==='read-fail'||readBroken)return {error:{message:'offline'}};return {data:structuredClone(db)}}
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
     const answer={data:{snapshot:structuredClone(db)}};if(mode==='delay'){requestStarted();await new Promise(resolve=>releaseResponse=resolve)}return answer;
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
    const second=crypto.randomUUID();
    original.versions.push({...original.versions[0],id:second,version_order:2,is_primary:false,version_label:'다른 버전',curated_version_name:'다른 버전'});
    original.units.push({...original.units[0],id:crypto.randomUUID(),version_id:second,text:'다른 가사'});
    const parsed=praiseSnapshotSong(original);
    original.versions.forEach((v,i)=>v.audio_set={audioUrl:'https://example.test/'+i+'.mp3',audioName:'음원 '+i,starts:i?[0,8]:[0,4],enabled:!i,sourceSignature:MindexSongTiming.sourceSignature(parsed.versions[i])});
    const audio=original.versions.map(v=>JSON.stringify(v.audio_set));
    refs.detailPane=document.createElement('div');render=renderDetail=persistUiState=syncBrowserHistory=updateSaveState=()=>{};
    window.prompt=()=> '복사본';window.confirm=()=>true;assertPraiseVersionsUnused=async()=>{};
    const reopen=()=>{const fresh=praiseSnapshotSong(structuredClone(db));state.songs=[fresh];state.selectedSongId=id;state.selectedVersionId=fresh.versions[0].id;state.forms=structuredClone(fresh.versions[0].forms);captureCleanFingerprint('praise');state.dirty.forms=state.dirty.song=false;return fresh};
    const verify=(song)=>{for(const v of song.versions){const i=[vid,second].indexOf(v.id);if(i<0){check(!v.audio_set&&!renderVersionAudioSummary(v,v.forms),'copy inherited audio')}else{check(JSON.stringify(v.audio_set)===audio[i],'audio owner changed');const html=renderVersionAudioSummary(v,v.forms);check(html.includes('음원 '+i)&&!html.includes('확인 필요'),'summary mismatch')}}};
    currentSaveButtonState=()=>({available:true,dirty:true});requireClient=()=>true;showToast=()=>{};
    const begin=()=>{mode='delay';started=new Promise(resolve=>requestStarted=resolve);return saveAll()};
    const summary=()=>renderVersionAudioSummary(getSelectedVersion(),state.forms);
    focusSelectedItemAfterRender=renderSongList=renderConnectionStatus=()=>{};
    let readBroken=false,otherRow;
    client.from=table=>{const q={table,select:()=>q,order:()=>q};return q};
    fetchAllRows=async factory=>{const table=factory().table;if(readBroken)return {error:{message:'offline reload'}};return {data:structuredClone(table==='mindex_songs'?[db.song,otherRow]:table==='mindex_song_versions'?db.versions:table==='mindex_version_units'?db.units:[])}};
    attachSongRelations=async()=>{};
    for(const failure of ['before-send','lost-response','reject']){
      readBroken=false;let song=reset();otherRow={id:crypto.randomUUID(),title:'다른 곡',memo:'{}'};state.songs=[song,normalizeServerSong(otherRow)];
      edit(song,'첫 저장 요청');mode=failure;await saveAll();edit(song,'버릴 추가 입력');const oldRequest=requests[0].requestId;
      const before=JSON.stringify({song,forms:state.forms,dirty:state.dirty});
      readBroken=true;confirmUnsavedChangesAction=async()=> 'discard';await selectSong(otherRow.id);
      check(getSelectedSong()===song&&JSON.stringify({song,forms:state.forms,dirty:state.dirty})===before,'failed read lost input/dirty or navigated');
      check(praisePendingSaves.has(song)===(failure!=='reject'),'failed read changed pending request');
      readBroken=false;mode='ok';await selectSong(otherRow.id);check(getSelectedSong().id===otherRow.id,'successful discard blocked');
      check(!praisePendingSaves.has(song),'discard retained old retry');await selectSong(id);
      const returned=getSelectedSong();check(returned!==song&&!state.forms.some(f=>f.lyrics==='버릴 추가 입력'),'discarded draft returned');
      check(JSON.stringify(returned.versions[0].audio_set)===audio[0],'discard audio changed');
      edit(returned,'복귀 후 새 입력');await saveAll();check(requests.at(-1).requestId!==oldRequest,'old request replayed');check(db.units[0].text==='복귀 후 새 입력','new input not saved');
    }
    // Input arriving during the read must cancel discard without touching pending state.
    let song=reset();edit(song,'보존 입력');const rpc=client.rpc;client.rpc=async(...args)=>{const response=await rpc(...args);edit(song,'조회 중 추가 입력');return response};
    check(await discardUnsavedChanges()===false&&state.forms[0].lyrics==='조회 중 추가 입력'&&state.dirty.forms,'late input during discard lost');client.rpc=rpc;
    confirmUnsavedChangesAction=nativeConfirm;
    return 'failed read blocks navigation and retains dirty draft/retry; successful discard clears retry; return/new save and late input safe';
   }''')
   page.evaluate("()=>{state.client.rpc=async()=>({error:{message:'offline'}});window.discardUiResult=null;confirmSaveBeforeLeaving().then(value=>window.discardUiResult=value)}")
   page.get_by_role('button',name='저장 안 함',exact=True).click()
   page.wait_for_function("window.discardUiResult===false")
   assert page.evaluate("state.dirty.forms && state.forms[0].lyrics==='조회 중 추가 입력'")
   print(engine,'PASS',result,'actual discard dialog click',flush=True);browser.close()
finally:server.shutdown();server.server_close()
