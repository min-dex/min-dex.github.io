from pathlib import Path
"""Single-ID local fixture only. No Supabase access and no output/fullscreen window."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,launch_chromium,sync_playwright,APP_DIR
server,url=start_local_app_server()
try:
 with sync_playwright() as pw:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(pw) if engine=='chromium' else pw.webkit.launch(headless=True)
   page=browser.new_page()
   page.on('pageerror',lambda e:print('PAGE ERROR',str(e),flush=True))
   page.route('**/*supabase*/**',lambda r:r.abort())
   page.route('**/app.runtime.js*',lambda r:r.fulfill(path=str(Path(__file__).resolve().parents[1]/'app.js'),content_type='text/javascript'));page.goto(url+'?mindexSmokeRaw=1')
   page.wait_for_function("typeof normalizeServerSong==='function' && typeof installSingleSongSession==='function' && typeof MindexSingleSong==='object' && typeof MindexPresenterFreshness==='object'")
   print(engine,page.evaluate(r'''async()=>{
    const check=(v,m)=>{if(!v)throw Error(m)}, equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const uid=()=>crypto.randomUUID();
    const oldSong={id:uid(),title:'단일 곡 시험',praise_types:['ccm'],_relationalVersionsLoaded:true,metadata:{composer:'시험'},versions:[]};
    const v={id:uid(),name:'기본',_worshipVersionPersisted:true,praise_types:['ccm'],forms:[
     {id:uid(),part_type:'Verse',part_number:1,lyrics:'첫 줄\n둘째 줄\n\n셋째 줄\n넷째 줄',sort_order:1},
     {id:uid(),part_type:'Chorus',lyrics:'후렴 가사',sort_order:2},
     {id:uid(),part_type:'Coda',lyrics:'아멘',sort_order:3}]};
    oldSong.versions=[v];
    const service={id:uid(),type_id:'custom',date:'2026-10-24',title:'로컬 테스트'};
    const item={id:uid(),service_id:service.id,label:'찬양 1',raw_title:oldSong.title,song_id:oldSong.id,version_id:v.id,sort_order:1,
      memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'V1-C-V1-C-Coda',audioTiming:{starts:[0,5,10]}})};
    const section={sectionKey:'praise',sectionLabel:'찬양'};
    const render=(s,ver,i)=>{
     const plan=presenterFormPlanForServiceItem(ver,i,s);
     return presenterLyricsSlidesForServiceItem({item:i,section,index:0,song:s,version:ver,displayText:s.title,label:i.label,forms:plan.forms,formWarnings:plan.warnings})
       .map(x=>({type:x.type,text:x.text,formKey:x.formKey,formLabel:x.formLabel}));
    };
    const before=render(oldSong,v,item);
    const record={...MindexSingleSong.fromLegacySong(oldSong,v,'SONG-CONT-0001-0001'),revision:0};
    let stored=structuredClone(record),writes=0,saveGate=null,failAfterCommit=false;const receipts=new Map();
    const repository=MindexSingleSong.createRepository({read:async()=>[structuredClone(stored)],commit:async request=>{
      if(receipts.has(request.requestId))return structuredClone(receipts.get(request.requestId));
      check(request.expectedRevision===stored.revision,'CAS mismatch');writes++;if(saveGate)await saveGate;
      stored={...structuredClone(request.record),revision:stored.revision+1};receipts.set(request.requestId,structuredClone(stored));if(failAfterCommit){failAfterCommit=false;throw Error('lost acknowledgment');}return structuredClone(stored);
    }});
    installSingleSongSession([record],repository);
    const selected=state.singleSongCatalog.singleItem(item);
    state.services=[service];state.serviceItems={[service.id]:[selected]};state.selectedServiceId=service.id;
    const s=state.songs[0],ver=getServiceItemVersion(s,selected,service);
    check(equal(render(s,ver,selected),before),'lyrics/form/amen slide sequence changed');
    const text=serviceSourceItemLines(selected,service).join('\n');
    check(text.includes('- 곡 ID: SONG-CONT-0001-0001')&&!text.includes('버전 ID:'),'source has duplicate ID');
    const parsed=parseServiceSourceText('[[찬양]]\n'+text)[0];check(parsed.songId==='SONG-CONT-0001-0001'&&!parsed.versionId,'source reopen');
    const row1=buildWorshipPersistenceRows(service,[selected],{},{},{singleSongCatalog:state.singleSongCatalog});
    check(row1.elements[0].song_id===oldSong.id&&row1.elements[0].song_version_id===v.id,'atomic compatibility refs');
    const reopened=groupWorshipElements(row1.sections,row1.elements)[service.id][0];
    check(reopened.song_id==='SONG-CONT-0001-0001'&&!reopened.song_version_id,'DB reopen single identity');
    check(equal(render(s,getServiceItemVersion(s,reopened,service),reopened),before),'saved/reopened output changed');
    const nativeRows=buildWorshipPersistenceRows(service,[selected],{},{},{singleSongCatalog:state.singleSongCatalog,singleSongStorage:'native'});
    check(nativeRows.elements[0].praise_record_id==='SONG-CONT-0001-0001'&&nativeRows.elements[0].song_id===null&&nativeRows.elements[0].song_version_id===null,'native single reference');
    const nativeRow=nativeRows.elements[0];
    nativeRow.content_state={state:'filled',reason:'song',inputMode:'lyrics_db',elementType:'praise',required:false};
    nativeRow.config.contentState=structuredClone(nativeRow.content_state);
    sanitizeWorshipPersistenceRows(nativeRows,{elementTypedStateColumns:{inputMode:true,contentState:true}});
    check(nativeRow.praise_record_id===record.id&&nativeRow.content_state.state==='filled'&&nativeRow.config.contentState.reason==='song','native linked praise became empty during save sanitization');
    check(worshipElementHasPersistedContent({praise_record_id:record.id}),'native-only hidden row is not preserved');
    const nativeAgain=groupWorshipElements(nativeRows.sections,nativeRows.elements)[service.id][0];
    check(equal(render(s,getServiceItemVersion(s,nativeAgain,service),nativeAgain),before),'native reopen output changed');
    const second={...structuredClone(selected),id:uid(),label:'찬양 2',sort_order:2};
    const items=[structuredClone(selected),structuredClone(second)];
    const group={groupId:'fixture-medley',primaryItemId:items[0].id,itemIds:items.map(i=>i.id),title:'시험 메들리'};
    items.forEach((i,n)=>{const memo=parseServiceItemMemo(i.memo);memo.connectedPraise={...group,role:n?'secondary':'primary'};i.memo=serializeServiceItemMemo(memo);});
    const medleyRows=buildWorshipPersistenceRows(service,items,{},{},{singleSongCatalog:state.singleSongCatalog});
    const medleyAgain=groupWorshipElements(medleyRows.sections,medleyRows.elements)[service.id];
    const linked=serviceItemConnectedPraise(medleyAgain[0]);
    check(equal(linked.itemIds,medleyAgain.map(i=>i.id)),'medley member IDs changed');
    check(linked.primaryItemId===medleyAgain[0].id,'medley primary changed');
    for(const ordering of [[second,selected],[selected]]){
      const rows=buildWorshipPersistenceRows(service,ordering,{},{},{singleSongCatalog:state.singleSongCatalog});
      const again=groupWorshipElements(rows.sections,rows.elements)[service.id];
      check(equal(again.map(i=>i.label),ordering.map(i=>i.label)),'move/delete order changed');
    }
    check(await saveSongMeta(s)===true,'unchanged save acknowledgment');check(writes===1,'single record not saved');
    stored.relations={same_song:[],related:['ccm-002']};
    const reloaded=await readSingleSongs(['SONG-CONT-0001-0001']);check(equal(state.singleSongCatalog.get('SONG-CONT-0001-0001').relations,stored.relations),'fresh metadata catalog stayed stale');check(equal(render(reloaded[0],getServiceItemVersion(reloaded[0],selected,service),selected),before),'record save/reload changed output');
    let release;saveGate=new Promise(resolve=>{release=resolve;});
    const saving=saveSongMeta(s);s.title='저장 중 바꾼 제목';release();
    check(await saving===false,'late edits wrongly acknowledged');
    check(s.title==='저장 중 바꾼 제목'&&state.dirty.song,'late draft was lost');
    saveGate=null;failAfterCommit=true;
    let failed=false;try{await saveSongMeta(s)}catch{failed=true}check(failed,'unknown outcome not reproduced');
    s.title='응답 유실 중 추가 편집';
    check(await saveSongMeta(s)===false,'retry acknowledged newer draft');
    check(s.title==='응답 유실 중 추가 편집','retry erased newer draft');
    let blocked=false;try{await readSingleSongs(['ccm-999'])}catch{blocked=true}check(blocked,'missing fresh record accepted');
    state.dirty.song=false;state.dirty.forms=false;state.presenter.outputPendingAt=0;
    let live=false,notices=[];
    isPresenterOutputWindowOpen=()=>live;hydratePresenterServiceData=async()=>{};
    getServiceOutputItems=()=>[selected];serviceItemsShouldUseDocumentSlideFallback=()=>false;
    state.client={from:()=>({select(){return this},eq(){return this},async single(){return {data:{id:service.id,save_revision:1}}}})};
    showToast=text=>notices.push(text);
    await MindexPresenterFreshness.verify(service.id);live=true;
    const frozen=MindexPresenterFreshness.song('SONG-CONT-0001-0001',service.id);
    const prior=frozen.versions[0].forms[0].lyrics;
    stored.content.forms[0].lyrics='DB에서 변경한 가사';stored.revision++;
    await MindexPresenterFreshness.checkLiveRevision();
    check(notices.length===1,'single-record revision notification missing');
    check(frozen.versions[0].forms[0].lyrics===prior,'live output changed mid-session');
    live=false;await MindexPresenterFreshness.verify(service.id);
    check(state.songs[0].versions[0].forms[0].lyrics==='DB에서 변경한 가사','restart did not refresh');
    const childSong={...oldSong,id:uid(),praise_types:['children']};
    const childVersion={...structuredClone(v),id:uid(),praise_types:['children'],lyric_signature:'child-signature'};
    let childStore={...MindexSingleSong.fromLegacySong(childSong,childVersion,'kid-001'),revision:0};
    const childRepo=MindexSingleSong.createRepository({read:async()=>[structuredClone(childStore)],commit:async request=>{
      check(request.expectedRevision===childStore.revision,'audio CAS');childStore={...request.record,revision:childStore.revision+1};return structuredClone(childStore);
    }});
    installSingleSongSession([childStore],childRepo);state.client={from(){throw Error('legacy audio write attempted')}};
    window.MINDEX_CONTENT_LIVE={publish(){}};
    const child=state.songs[0],cv=child.versions[0],audioSlides=cv.forms.map(f=>({type:'lyrics',text:f.lyrics}));
    const audioDraft={audioUrl:'https://example.test/fixture.mp3',audioName:'test',audioFingerprint:'test-hash',duration:20,starts:[1,5,9],enabled:true,
      lyricsFingerprint:MindexSongTiming.fingerprint(audioSlides),sourceSignature:MindexSongTiming.sourceSignature(cv),forms:structuredClone(cv.forms)};
    await MindexSongTiming.saveToVersion(child,cv,audioDraft,audioSlides);
    check(equal(childStore.content.audio_set.starts,[1,5,9]),'single-record audio timing save failed');
    check(equal(childStore.content.forms,childVersion.forms),'audio save modified lyrics/forms');
    return 'PASS single ID source/save/reopen, order/delete/medley, lyrics/form/amen, late edits/retry, live freeze/restart, audio CAS';
   }'''),flush=True)
   browser.close()
finally:
 server.shutdown();server.server_close()
