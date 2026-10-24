from pathlib import Path
"""Offline UI lifecycle. No operational DB, audio or output windows."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,launch_chromium,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as pw:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(pw) if engine=='chromium' else pw.webkit.launch(headless=True)
   page=browser.new_page()
   page.route('**/*supabase*/**',lambda r:r.abort())
   page.route('**/app.runtime.js*',lambda r:r.fulfill(path=str(Path(__file__).resolve().parents[1]/'app.js'),content_type='text/javascript'));page.goto(url+'?mindexSmokeRaw=1')
   page.wait_for_function("typeof normalizeServerSong==='function' && typeof installSingleSongSession==='function'")
   print(engine,page.evaluate(r'''async()=>{
    const check=(v,m)=>{if(!v)throw Error(m)};
    let number=0,attempts=[],lost=false;const rows=new Map(),receipts=new Map();
    const repository=MindexSingleSong.createRepository({read:async ids=>ids.map(id=>structuredClone(rows.get(id))),commit:async req=>{
      const r={...req.record,revision:req.expectedRevision+1};rows.set(r.id,r);return structuredClone(r);
    },mutate:async req=>{
      attempts.push(structuredClone(req));if(receipts.has(req.requestId))return structuredClone(receipts.get(req.requestId));
      let result;
      if(req.operation==='create'){
        const id=req.baseId?req.baseId+'-001':'ccm-'+String(++number).padStart(3,'0');
        const r={id,revision:1,metadata:req.metadata,content:req.content,relations:{same_song:[],related:[]}};rows.set(id,structuredClone(r));
        result={id,records:[r],deleted:[]};
      }else if(req.operation==='delete') {rows.delete(req.id);result={records:[],deleted:[req.id]};}
      else {
        const ids=Object.keys(req.expectedRevisions);result={records:[],deleted:[]};
        for(const id of ids){const r=structuredClone(rows.get(id));r.revision++;
         r.relations[req.operation]=req.operation==='related'?req.members:req.members.filter(x=>x!==id);
         rows.set(id,r);result.records.push(r);
        }
      }
      receipts.set(req.requestId,structuredClone(result));if(lost){lost=false;throw Error('lost response');}return structuredClone(result);
    }});
    installSingleSongSession([],repository);state.client={rpc(){throw Error('legacy RPC used')},from(){throw Error('legacy table used')}};
    state.module='praise';state.loading=false;state.saving=false;state.dirty.song=false;state.dirty.forms=false;
    render=()=>{};renderDetail=()=>{};updateSaveState=()=>{};persistUiState=()=>{};showToast=()=>{};window.confirm=()=>true;
    const a=await createEmptyPraiseAtomic({title:'a',praiseTypes:['ccm']});
    const b=await createEmptyPraiseAtomic({title:'b',praiseTypes:['ccm']});
    check(a.id==='ccm-001'&&a.versions.length===1&&a.versions[0].id===a.id,'new song has dual identity');
    state.selectedSongId=a.id;state.selectedVersionId=a.id;state.forms=[];
    check(renderSingleSongRelations(a).includes('같은 곡으로 묶기'),'relationship UI missing');
    await editSingleSongRelation(a,'same_song',b.id);check(a.same_song_ids.includes(b.id),'group edit not applied');
    check(linkedSongVersionEntries(a).some(entry=>entry.song.id===b.id),'same-song version comparison missing');
    await editSingleSongRelation(a,'same_song',b.id,true);check(!a.same_song_ids.includes(b.id),'split not applied');
    await editSingleSongRelation(a,'related',b.id);check(a.related_song_ids.includes(b.id),'related edit not applied');
    await editSingleSongRelation(a,'related',b.id,true);
    const original=JSON.stringify(rows.get(a.id).content);
    lost=true;window.prompt=()=> '다른 편곡';await addSingleSongArrangement(a);
    check(repository.pendingMutation(`arrangement:${a.id}`),'lost result not retained');
    await addSingleSongArrangement(a);
    const creation=attempts.filter(x=>x.baseId===a.id);check(creation.length===2&&creation[0].requestId===creation[1].requestId,'arrangement retry creates duplicate');
    check(JSON.stringify(rows.get(a.id).content)===original,'source content changed');
    state.selectedSongId=b.id;state.selectedVersionId=b.id;state.forms=[];state.dirty.song=false;state.dirty.forms=false;
    await deletePraiseVersion(b.id);check(!rows.has(b.id)&&!state.songs.some(x=>x.id===b.id),'native version deletion fell into legacy path');
    lost=true;let failed=false;try{await createEmptyPraiseAtomic({title:'retry',praiseTypes:['ccm']},'retry')}catch{failed=true}
    check(failed,'lost response not simulated');
    const retry=await createEmptyPraiseAtomic({title:'retry',praiseTypes:['ccm']},'retry');
    const requests=attempts.filter(r=>r.metadata?.title==='retry');check(requests[0].requestId===requests[1].requestId,'create retry ID changed');
    check(retry.id==='ccm-003','create duplicate');
    let denied=false;try{await saveSongRelationsIfAvailable(a)}catch{denied=true}check(denied,'UUID relation fallback allowed');
    for(const f of [saveSongVersions,ensureCanonicalSongRow]){let blocked=false;try{await f(a)}catch{blocked=true}check(blocked,'legacy write helper accepted native record');}
    return 'PASS native create/delete/relations/arrangement retry; no legacy writes or source content changes';
   }'''),flush=True)
   browser.close()
finally: server.shutdown()
