"""Offline real app lifecycle handlers: immutable retries and late-response guards."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,launch_chromium,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page();page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url+'?output=presenter&mindexSmokeRaw=1');page.wait_for_function("typeof createEmptyPraiseAtomic==='function'")
   print(engine,page.evaluate('''async()=>{
    const check=(x,m)=>{if(!x)throw Error(m)},snapshots=new Map(),receipts=new Map(),requests=[];
    let mode='ok',pause=null,notify=null;
    const snapshot=req=>({song:{id:req.songId,title:req.title,praise_types:req.praiseTypes,memo:'{}'},canonical:[],relations:[],units:[],versions:[{id:req.versionId,source_song_id:req.songId,canonical_song_id:req.songId,version_order:1,version_label:'기본',raw_section_name:'기본',curated_version_name:'기본',praise_types:req.praiseTypes,is_primary:true}]});
    const client={from(){throw Error('direct table access forbidden')},async rpc(name,{req,sid}){
      if(name==='get_praise_snapshot_v1')return {data:structuredClone(snapshots.get(sid))};
      requests.push({name,req:structuredClone(req)});if(notify){notify();notify=null}if(pause)await pause;
      if(mode==='before')throw Error('offline');
      if(mode==='deny')return {error:{code:'P0001',message:'PRAISE_IN_USE'}};
      if(receipts.has(req.requestId))return {data:structuredClone(receipts.get(req.requestId))};
      let data;
      if(name==='create_praise_v1'){const s=snapshot(req);snapshots.set(req.songId,s);data={snapshot:s};}
      else {check(name==='delete_empty_praise_v1','unexpected RPC');snapshots.delete(req.songId);data={deleted:true};}
      receipts.set(req.requestId,data);if(mode==='lost')throw Error('lost response');return {data:structuredClone(data)};
    }};
    state.client=client;state.config.url='https://offline.invalid';state.songs=[];state.services=[];state.serviceItems={};state.saving=false;state.loading=false;
    state.module='praise';state.songVersionTablesSupported=true;state.songVersionPraiseTypesSupported=true;
    state.songRelationsSupported=true;state.auth.session={user:{id:'fixture'}};state.connectionError='';
    render=()=>{};persistUiState=()=>{};updateSaveState=()=>{};clearSearchCaches=()=>{};renderCurrentServiceModuleDetail=()=>{};window.confirm=()=>true;
    const messages=[];showToast=(text)=>messages.push(text);
    const opts={title:'새 곡',praiseTypes:['ccm']};
    let unblock;pause=new Promise(r=>unblock=r);
    const p1=createEmptyPraiseAtomic(opts,'double'),p2=createEmptyPraiseAtomic(opts,'double');
    check(requests.length===1,'double click sent two requests');unblock();await Promise.all([p1,p2]);pause=null;
    check(state.songs.length===1,'duplicate local song');
    const fails=async fn=>{let did=false;try{await fn()}catch{did=true}check(did,'expected failure')};
    mode='lost';await fails(()=>createEmptyPraiseAtomic(opts,'retry'));const sent=requests.at(-1).req;
    mode='ok';const retried=await createEmptyPraiseAtomic({...opts,title:'changed'},'retry');check(requests.at(-1).req.requestId===sent.requestId&&retried.title==='새 곡','unknown create not immutable');
    mode='before';await fails(()=>createEmptyPraiseAtomic(opts,'before'));const before=requests.at(-1).req;mode='ok';await createEmptyPraiseAtomic(opts,'before');check(requests.at(-1).req.songId===before.songId,'pre-send retry identity changed');
    const svc={id:'service',type_id:'fixture'};state.services=[svc];state.selectedServiceId=svc.id;state.module='worship';
    resolveExistingPraiseSongForServiceInputAfterCatalogLoad=async()=>null;
    findDeferredServiceTextInput=()=>null;servicePraiseInputMode=()=> 'lyrics_db';
    const slot=()=>({id:crypto.randomUUID(),label:'찬양 1',raw_title:'새 곡',memo:'',sort_order:30});
    let item=slot(),sibling={id:'sibling',raw_title:'보존',sort_order:40,memo:'keep'};state.serviceItems[svc.id]=[item,sibling];
    pause=new Promise(r=>unblock=r);let reached=new Promise(r=>notify=r);let task=createPraiseSongFromServiceItem(0);await Promise.race([reached,new Promise((_,reject)=>setTimeout(()=>reject(Error('RPC not reached: '+messages.join('|'))),3000))]);
    const count=requests.length;await createPraiseSongFromServiceItem(0);check(requests.length===count,'service double click duplicated');item.raw_title='대기 중 바꾼 제목';unblock();await task;pause=null;
    check(!item.song_id&&item.raw_title==='대기 중 바꾼 제목'&&sibling.memo==='keep','late response overwrote edited item');
    item=slot();state.serviceItems[svc.id]=[item,sibling];pause=new Promise(r=>unblock=r);reached=new Promise(r=>notify=r);task=createPraiseSongFromServiceItem(0);await Promise.race([reached,new Promise((_,reject)=>setTimeout(()=>reject(Error('RPC not reached: '+messages.join('|'))),3000))]);
    const extra={id:'late-sibling',memo:'late'};state.serviceItems[svc.id]=[extra,item,{...sibling,raw_title:'새 형제 입력'}];unblock();await task;pause=null;
    check(state.serviceItems[svc.id].length===3&&state.serviceItems[svc.id][0].memo==='late'&&state.serviceItems[svc.id][2].raw_title==='새 형제 입력','siblings/order lost');
    check(state.serviceItems[svc.id][1].song_id,'created song not linked');
    const song=await createEmptyPraiseAtomic(opts,'delete');state.module='praise';state.selectedSongId=song.id;state.selectedVersionId=song.versions[0].id;state.forms=[];state.dirty.song=false;state.dirty.forms=false;
    const countBeforeDirty=requests.length;state.dirty.forms=true;state.forms=[{lyrics:'unsaved lyrics'}];await deleteSelectedSong();check(requests.length===countBeforeDirty&&state.forms[0].lyrics==='unsaved lyrics','dirty delete lost input');state.dirty.forms=false;state.forms=[];
    mode='deny';await deleteSelectedSong();check(state.songs.some(x=>x.id===song.id)&&snapshots.has(song.id),'linked rejection lost song');
    mode='lost';await deleteSelectedSong();const deleteReq=requests.at(-1).req;check(state.songs.some(x=>x.id===song.id),'lost reply discarded local song');
    mode='ok';await deleteSelectedSong();check(requests.at(-1).req.requestId===deleteReq.requestId&&!state.songs.some(x=>x.id===song.id),'delete replay failed');
    return 'PASS double click, immutable create/delete retries, late title edit, sibling insertion/reorder, linked deletion refusal';
   }'''),flush=True);browser.close()
finally:server.shutdown();server.server_close()
