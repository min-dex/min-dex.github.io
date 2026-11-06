"""Offline native editor discard: real form/dialog UI and delayed-read guards."""
import os
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from smoke_app import start_local_app_server, launch_chromium, sync_playwright
server, url = start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium', 'webkit'):
   browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
   page = browser.new_page()
   page.route('**/*supabase*/**', lambda r: r.abort())
   page.goto(url + '?mindexSmokeRaw=1')
   page.wait_for_function("typeof discardUnsavedChanges === 'function'")
   page.evaluate('''() => {
    const id='SONG-CONT-0001-0001', other='SONG-CONT-0002-0001';
    window.fixture={id,other,reads:0,legacy:0,mode:'ok'};
    const f=window.fixture;
    f.record={id,revision:1,metadata:{title:'원본 제목'},content:{name:'기본',praise_types:['ccm'],forms:[{id:'f1',part_type:'Verse',part_number:1,lyrics:'원본 가사',sort_order:0}],audio_set:{starts:[0,8]}},relations:{same_song:[other],related:[]}};
    f.peer={...structuredClone(f.record),id:other,metadata:{title:'다른 곡'},relations:{same_song:[id],related:[]}};
    f.repository=MindexSingleSong.createRepository({read:async ids=>{
     f.reads++;if(f.mode==='fail')throw Error('offline');
     if(f.mode==='delay')await new Promise(resolve=>f.release=resolve);
     return [structuredClone(f.record)];
    },commit:async()=>{throw Error('lost response')}});
    state.client={rpc:async name=>{if(name==='get_praise_snapshot_v1')f.legacy++;throw Error('network forbidden')}};state.config.url='https://offline.invalid';
    state.singleSongRepository=f.repository;state.auth.session={user:{id:'offline'}};state.connectionError='';
    state.saving=false;state.loading=false;state.services=[];state.serviceItems={};
    persistUiState=()=>{};
    f.reset=()=>{
     f.mode='ok';state.module='praise';state.singleSongRepository=f.repository;
     state.singleSongCatalog=MindexSingleSong.createCatalog([f.record,f.peer]);
     state.songs=state.singleSongCatalog.ids().map(id=>state.singleSongCatalog.appSong(id));
     state.selectedSongId=id;state.selectedVersionId=id;state.forms=normalizeForms(structuredClone(state.songs[0].versions[0].forms));
     state.dirty.song=state.dirty.forms=false;captureCleanFingerprint('praise');render();
    };f.reset();
   }''')
   page.locator('[data-form-field="lyrics"]').first.fill('버릴 가사')
   page.locator('[data-form-field="lyrics"]').first.press('Tab')
   page.wait_for_function("state.dirty.forms")
   page.evaluate("()=>{window.discardResult=null;confirmSaveBeforeLeaving().then(value=>window.discardResult=value)}")
   page.get_by_role('button', name='저장 안 함', exact=True).click()
   page.wait_for_function('window.discardResult !== null')
   assert page.evaluate('window.discardResult'), 'native discard dialog remained blocked'
   assert page.evaluate("fixture.legacy===0 && fixture.reads>=1 && state.forms[0].lyrics==='원본 가사'"), page.evaluate("({legacy:fixture.legacy,reads:fixture.reads,forms:state.forms})")
   assert page.evaluate("JSON.stringify(state.singleSongCatalog.get(fixture.id))===JSON.stringify(fixture.record) && JSON.stringify(state.singleSongCatalog.get(fixture.other))===JSON.stringify(fixture.peer)")
   result = page.evaluate('''async()=>{
    const f=fixture,check=(x,m)=>{if(!x)throw Error(m)};
    const edit=()=>{state.forms[0].lyrics='보존 초안';state.dirty.forms=true;writeFormsToSelectedVersion()};
    const snap=()=>JSON.stringify({songs:state.songs,forms:state.forms,catalog:state.singleSongCatalog.ids().map(id=>state.singleSongCatalog.get(id)),dirty:state.dirty});
    f.reset();edit();const before=snap();f.mode='fail';check(!await discardUnsavedChanges(),'failed read accepted');check(snap()===before,'failed read changed draft');
    for(const change of ['input','selection','repository','project','saving','module','pending','revision']){
     state.saving=false;f.reset();edit();f.mode='delay';
     const task=discardUnsavedChanges();await Promise.resolve();
     if(change==='input')state.forms[0].lyrics='늦은 입력';
     if(change==='selection')state.selectedSongId=f.other;
     if(change==='repository')state.singleSongRepository={};
     if(change==='project')state.config.url+='changed';
     if(change==='saving')state.saving=true;
     if(change==='module')state.module='home';
     if(change==='pending')praisePendingSaves.set(getSelectedSong(),{unknown:true});
     if(change==='revision')state.singleSongCatalog=MindexSingleSong.createCatalog([{...f.record,revision:2},f.peer]);
     const held=snap();f.release();check(!await task,change+' accepted stale discard');check(snap()===held,change+' lost state');
     praisePendingSaves.delete(state.songs[0]);
    }
    state.saving=false;f.reset();edit();
    try{await f.repository.save(f.record)}catch{}
    const pending=f.repository.pendingRecord(f.id),reads=f.reads,held=snap();
    check(!await discardUnsavedChanges(),'unknown commit discarded');check(f.reads===reads&&snap()===held,'unknown commit touched draft');
    check(JSON.stringify(pending)===JSON.stringify(f.repository.pendingRecord(f.id)),'retry lost');
    check(f.legacy===0,'legacy lookup used');
    return 'real textarea/dialog; read failure; input/selection/project/repository/save/module/pending/revision races; uncertain commit protected';
   }''')
   saved = page.evaluate("""async()=>{
    const f=fixture,check=(x,m)=>{if(!x)throw Error(m)};
    f.reset();
    f.record.content.forms=[{id:'v1',part_type:'Verse',part_number:null,lyrics:'원본 가사\\n둘째 줄\\n\\n다음 장',sort_order:0},{id:'c',part_type:'Chorus',lyrics:'반복 후렴',sort_order:1}];
    const forms=f.record.content.forms,audioForms=[...forms,forms[1]];
    const slides=fs=>fs.flatMap(x=>x.lyrics.split(/\\n\\s*\\n/).map(text=>({type:'lyrics',text})));
    f.record.content.audio_set={enabled:true,audioUrl:'https://example.invalid/a.wav',audioFingerprint:'hash',duration:80,starts:[1,10,20,30],forms:structuredClone(audioForms),sourceSignature:MindexSongTiming.sourceSignature({forms}),lyricsFingerprint:MindexSongTiming.fingerprint(slides(audioForms))};
    let writes=0;
    f.repository=MindexSingleSong.createRepository({read:async()=>[structuredClone(f.record)],commit:async req=>{writes++;check(req.expectedRevision===f.record.revision,'revision lost');f.record={...structuredClone(req.record),revision:f.record.revision+1};return structuredClone(f.record)}});
    f.reset();const audioBefore=structuredClone(f.record.content.audio_set),relations=JSON.stringify(f.record.relations);
    state.forms[0].lyrics='원본가사\\n둘째 줄\\n\\n다음 장';state.dirty.forms=true;
    await saveAll();check(!state.dirty.forms&&!state.saving,'save failed');
    check(JSON.stringify(f.record.content.audio_set.starts)===JSON.stringify(audioBefore.starts),'cues changed');
    check(f.record.content.audio_set.sourceSignature!==audioBefore.sourceSignature,'text fingerprint not committed');
    check(MindexSongTiming.audioStatus(getSelectedVersion())==='','saved timing invalid');
    check(JSON.stringify(f.record.relations)===relations,'relations changed');
    f.reset();check(state.forms[0].lyrics.startsWith('원본가사'),'reload lost correction');
    state.forms[0].lyrics='버릴 임시 변경';state.dirty.forms=true;writeFormsToSelectedVersion();
    check(await discardUnsavedChanges(),'discard failed');check(state.forms[0].lyrics.startsWith('원본가사'),'discard lost saved text');check(writes===1,'discard wrote data');
    state.forms[0].lyrics=state.forms[0].lyrics.replace('\\n','\\n\\n');state.dirty.forms=true;await saveAll();
    check(JSON.stringify(f.record.content.audio_set.starts)===JSON.stringify(audioBefore.starts),'split erased cues');
    check(Boolean(MindexSongTiming.audioStatus(getSelectedVersion())),'split accepted old timing');
    check(JSON.stringify(f.record.relations)===relations,'split changed links');
    return 'native CAS save/reload/discard preserves cues, repeated forms and links; split requests review';
   }""")
   print(engine, 'PASS', saved, flush=True)
   print(engine, 'PASS', result, flush=True)
   browser.close()
finally:
 server.shutdown();server.server_close()
