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
    const initialRows=buildWorshipPersistenceRows(service,[selected],{},{},{singleSongCatalog:state.singleSongCatalog,singleSongStorage:'native',elementTypedStateColumns:{inputMode:true,contentState:true}});
    const persisted=initialRows.elements[0];selected.id=persisted.id;selected._worshipSectionId=persisted.section_id;
    state.serviceItems[service.id]=[selected];state.worshipSections=initialRows.sections;state.worshipElements=initialRows.elements;
    state.loadedWorshipServiceIds.add(service.id);state.client={};
    const field={value:'score_db',dataset:{serviceId:service.id,serviceItemIndex:'0',serviceItemField:'praise_input_mode'}};
    const options=serviceItemSelectSaveOptions(field);
    check(options.expectedPraiseReference.songId===record.id,'mode did not capture original native ID');
    updateServiceItemField(field,{deferPresenterRefresh:true});
    worshipElementTypedStateColumns=async()=>({inputMode:true,contentState:true});captureWorshipRecoverySnapshot=async()=>{};
    let commits=0,lastRow=null;worshipAtomicClient=async()=>({commit:async input=>{commits++;lastRow=input.rows.elements[0];throw Error('captured')}});
    try{await saveWorshipServiceElementPatch(service,selected.id,options)}catch(e){check(e.message==='captured','valid mode change failed: '+e.message)}
    check(commits===1&&lastRow.praise_record_id===record.id,'valid native mode save changed link/state '+JSON.stringify({commits,lastRow}));
    const live=getServiceItems(service.id).find(x=>x.id===selected.id);live.song_id=null;live.version_id=null;live.song_version_id=null;
    let blocked=false;try{await saveWorshipServiceElementPatch(service,selected.id,options)}catch(e){blocked=e.message.includes('찬양 연결이 달라져')}
    check(blocked&&commits===1,'lost reference reached atomic commit');
    blocked=false;try{await saveWorshipServiceInstance(service,options)}catch(e){blocked=e.message.includes('찬양 연결이 달라져')}
    check(blocked&&commits===1,'full-save fallback lost reference reached atomic commit');
    field.value='audio_praise';check(!serviceItemSelectSaveOptions(field).expectedPraiseReference,'explicit direct audio unlink incorrectly blocked');
    return 'PASS native mode reference capture, valid save, lost-link rejection before atomic commit, explicit direct mode';
   }'''),flush=True);browser.close()
finally:server.shutdown();server.server_close()
