"""Confirmed, scoped version drafts and save-time reference protection (offline)."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,launch_chromium,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page();page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url,wait_until='domcontentloaded');page.wait_for_function("typeof deletePraiseVersion==='function' && !document.body.classList.contains('ui-booting')")
   result=page.evaluate('''async()=>{
    const ids=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'];
    const song={id:ids[0],title:'교회',versions:ids.slice(1).map((id,i)=>({id,name:i?'대흥교회':'기본',is_primary:!i,forms:[{id:crypto.randomUUID(),part_type:'Verse',part_number:1,lyrics:i?'삭제 대상':'보존 가사'}]}))};
    state.module='praise';state.saving=false;state.songVersionTablesSupported=true;state.songVersionPraiseTypesSupported=true;
    state.selectedVersionId=ids[1];state.forms=normalizeForms([{...song.versions[0].forms[0],lyrics:'저장 전 편집 가사'}]);state.dirty.forms=true;
    getSelectedSong=()=>song;render=()=>{};updateSaveState=()=>{};persistUiState=()=>{};syncBrowserHistory=()=>{};
    let messages=[],writes=[],usage=[],lookupError=null,confirmed=false,confirmations=[];
    showToast=m=>messages.push(m);window.confirm=m=>{confirmations.push(m);return confirmed};
    state.client={from(table){let q={select(){return q},in(k,v){q.ids=v;return q},eq(k,v){q.scope=[k,v];return q},limit(){return Promise.resolve({data:usage,error:lookupError})},upsert(rows){writes.push({table,op:'upsert',rows});return Promise.resolve({error:null})},delete(){q.op='delete';return q},then(resolve){writes.push({table,op:q.op,ids:q.ids,scope:q.scope});return Promise.resolve({data:[],error:null}).then(resolve)}};return q}};
    await deletePraiseVersion(ids[2]);if(song.versions.length!==2||writes.length)throw Error('cancel changed data');
    if(!confirmations[0].includes('教会')&&!confirmations[0].includes('교회'))throw Error('missing song');
    if(!confirmations[0].includes('대흥교회')||!confirmations[0].includes('되돌릴'))throw Error('missing deletion scope');
    confirmed=true;usage=[{id:'linked'}];await deletePraiseVersion(ids[2]);if(song.versions.length!==2)throw Error('linked deleted');
    usage=[];lookupError={message:'offline'};await deletePraiseVersion(ids[2]);if(song.versions.length!==2)throw Error('lookup failed open');
    lookupError=null;const existing=structuredClone(song.versions);
    await deletePraiseVersion(ids[2]);if(song.versions.length!==1||song.versions[0].forms[0].lyrics!=='저장 전 편집 가사'||writes.length)throw Error('draft preservation');
    const count=confirmations.length;await deletePraiseVersion(ids[1]);if(song.versions.length!==1||confirmations.length!==count)throw Error('last version deleted');
    ensureCanonicalSongRow=async()=>ids[0];fetchExistingSongVersions=async()=>existing;fetchExistingCanonicalSongVersions=async()=>[];fetchExistingVersionUnits=async()=>[];reserveExistingVersionUnitOrders=async()=>{};
    usage=[{id:'new-reference'}];let blocked=false;try{await saveSongVersions(song)}catch(e){blocked=true}if(!blocked||writes.length)throw Error('save reference guard');
    usage=[];await saveSongVersions(song);
    const deleted=writes.filter(w=>w.op==='delete');if(deleted.length!==1||deleted[0].ids.join()!==ids[2]||deleted[0].scope[1]!==song.id)throw Error('unscoped delete');
    writes=[];song._pendingVersionDeletes=[];blocked=false;try{await saveSongVersions(song)}catch(e){blocked=true}if(!blocked||writes.length)throw Error('unapproved remote delete');
    // Active target deletion switches to the retained version without transferring its lyrics.
    song.versions=structuredClone(existing);state.selectedVersionId=ids[2];state.forms=normalizeForms(existing[1].forms);await deletePraiseVersion(ids[2]);
    if(state.selectedVersionId!==ids[1]||state.forms[0].lyrics!=='보존 가사')throw Error('selection/lyrics crossed');
    const html=renderVersionTitleContent(song,song.versions[0],song.versions[0].forms);if(!html.includes('data-delete-version')||!html.includes('disabled'))throw Error('last button missing');
    song.versions=structuredClone(existing);state.selectedVersionId=ids[1];
    refs.detailPane.innerHTML=song.versions.map(v=>renderVersionCompareHead(song,v)).join('');
    window.__deleteConfirmCount=0;window.confirm=()=>{window.__deleteConfirmCount++;return false};
    return 'cancel, reference/error guards, dirty lyrics, selection, last-version protection, scoped save, concurrent-version protection';
   }''')
   button=page.get_by_role('button',name='대흥교회 버전 삭제',exact=True)
   button.click();button.press('Enter')
   assert page.evaluate("window.__deleteConfirmCount===2 && getSelectedSong().versions.length===2 && state.selectedVersionId.endsWith('002')")
   print('PASS',engine,result,'actual pointer/keyboard confirmation',flush=True);browser.close()
finally:server.shutdown()
