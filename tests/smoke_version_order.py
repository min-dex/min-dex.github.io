"""Offline version movement: real controls, draft preservation and save/reload."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server, launch_chromium, sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={"width":1400,"height":900})
   page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url,wait_until='domcontentloaded')
   page.wait_for_function("typeof movePraiseVersion==='function' && !document.body.classList.contains('ui-booting')")
   page.evaluate('''() => {
    const ids=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'];
    const song={id:'20000000-0000-4000-8000-000000000001',title:'버전 순서 검증',versions:ids.map((id,i)=>({id,name:['기본','다른 마무리','편곡'][i],version_order:(i+1)*2,is_primary:!i,forms:[{id:crypto.randomUUID(),part_type:'Verse',part_number:1,lyrics:'보존 '+i,sort_order:1}]}))};
    state.module='praise';state.songs=[song];state.selectedSongId=song.id;state.selectedVersionId=ids[1];
    state.forms=normalizeForms([{...song.versions[1].forms[0],lyrics:'미저장 입력 보존'}]);state.dirty.forms=true;
    state.saving=false;state.client={};state.auth.session={user:{id:"offline-fixture"}};state.connectionError="";state.songVersionTablesSupported=true;state.songVersionPraiseTypesSupported=true;
    window.__orderFixture={ids,song,forms:JSON.stringify(state.forms),primary:getDefaultVersionId(song)};
    render();
   }''')
   button=page.get_by_role('button',name='다른 마무리 버전 앞으로 이동',exact=True)
   button.click()
   assert page.get_by_role('button',name='다른 마무리 버전 앞으로 이동',exact=True).is_disabled()
   assert page.get_by_role('button',name='다른 마무리 버전 뒤로 이동',exact=True).evaluate('(e)=>e===document.activeElement')
   page.evaluate('''async()=>{
    const {song,ids,forms,primary}=window.__orderFixture;
    const check=(ok,msg)=>{if(!ok)throw Error(msg)};
    check(song.versions.map(v=>v.id).join() === [ids[1],ids[0],ids[2]].join(),'move');
    check(getSelectedVersionId()===ids[1]&&getDefaultVersionId(song)===primary,'selection/primary');
    check(state.forms[0].lyrics==='미저장 입력 보존'&&song.versions[0].forms[0].lyrics==='미저장 입력 보존','dirty lyrics');
    const memo=serializeSongMemo(song);const restored=normalizeSongVersions(song,JSON.parse(memo).versions);
    check(restored[0].id===ids[1]&&restored[1].is_primary&&!restored[0].is_primary,'memo order/primary');
    state.saving=true;movePraiseVersion(ids[1],1);check(song.versions[0].id===ids[1],'saving lock');state.saving=false;
    const writes=[];const existing=structuredClone(song.versions);
    ensureCanonicalSongRow=async()=>song.id;fetchExistingSongVersions=async()=>existing;fetchExistingCanonicalSongVersions=async()=>[];
    fetchExistingVersionUnits=async()=>[];reserveExistingVersionUnitOrders=async()=>{};
    state.client={from(table){const q={select(){return q},in(){return q},eq(){return q},limit(){return Promise.resolve({data:[],error:null})},upsert(rows){writes.push({table,rows});return Promise.resolve({error:null})},then(resolve){return Promise.resolve({data:[],error:null}).then(resolve)}};return q}};
    await saveSongVersions(song);
    const rows=writes.find(w=>w.table==='mindex_song_versions').rows;
    check(rows[0].version_order<rows[1].version_order&&!rows[0].is_primary&&rows[1].is_primary,'persisted order/primary');
    check(!writes.some(w=>w.table==='mindex_worship_elements'),'worship mutated');
    const fresh={id:song.id,title:song.title,memo,versions:[]};
    attachRelationalSongVersionRows(rows,writes.find(w=>w.table==='mindex_version_units').rows,null,[fresh]);
    check(fresh.versions[0].id===ids[1]&&getDefaultVersionId(fresh)===primary,'reload order/primary');
    check(fresh.versions[0].forms[0].lyrics==='미저장 입력 보존','reload lyrics');
   }''')
   page.get_by_role('button',name='다른 마무리 버전 뒤로 이동',exact=True).press('Enter')
   assert page.evaluate('getSelectedSong().versions[1].id===window.__orderFixture.ids[1]')
   page.screenshot(path='/tmp/mindex-version-order-'+engine+'.png')
   print('PASS',engine,'click/Enter, draft, primary, memo, relational save/reload',flush=True)
   browser.close()
finally:server.shutdown()
