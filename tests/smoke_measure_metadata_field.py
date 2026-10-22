"""Read-only measure slot follows selected version and rejects stale lyric hashes."""
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as pw:
  for engine in ['chromium','webkit']:
   b=launch_chromium(pw) if engine=='chromium' else pw.webkit.launch(headless=True)
   page=b.new_page(viewport={'width':1440,'height':900});page.route('**/*supabase*/**',lambda r:r.abort());page.goto(url+'?output=presenter&mindexSmokeRaw=1');page.wait_for_function("typeof renderSongMetadataDialog==='function' && !!globalThis.MindexHymnStructure && !document.body.classList.contains('ui-booting')")
   page.evaluate('''async()=>{
    const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
    const versions=[{id:'new-fixture',name:'새찬송가',hymn_no:141,forms:[{id:'a',part_type:'Verse',lyrics:'sample',order:1}]},{id:'union-fixture',name:'통일찬송가',hymn_no:132,forms:[{id:'b',part_type:'Verse',lyrics:'sample',order:1}]}];
    const records=Object.fromEntries(await Promise.all(versions.map(async(v,i)=>[v.id,{stanzaApproxMeasures:16+i,reviewStatus:'score_supported_approximation',parts:[{unitId:v.forms[0].id,kind:'Verse',textSha256:await hash('sample'),blockCount:1,approxMeasuresByBlock:[16+i],approxMeasures:16+i}]}])));
    const describe=MindexHymnStructure.describe;MindexHymnStructure.describe=(id,forms)=>describe(id,forms,records);
    state.songs=[{id:'fixture-song',title:'fixture',metadata:{},scripture:[],versions}];state.selectedSongId='fixture-song';state.selectedVersionId=versions[0].id;state.forms=versions[0].forms;state.dirty.song=false;state.dirty.forms=false;
    window.paintMeasure=()=>{document.querySelector('#measure-fixture')?.remove();const host=document.createElement('div');host.id='measure-fixture';document.body.append(host);host.innerHTML=renderSongMetadataDialog(state.songs[0]);};paintMeasure();
   }''')
   field=page.locator('input[data-hymn-structure-label]');page.wait_for_function("document.querySelector('input[data-hymn-structure-label]')?.value==='본절 약 16'")
   assert field.get_attribute('readonly') is not None
   assert field.get_attribute('data-song-meta-field') is None
   assert page.locator('.metadata-popover-grid .field').count()==12
   assert '새찬송가' in field.get_attribute('aria-label')
   page.evaluate("state.selectedVersionId='union-fixture';state.forms=state.songs[0].versions[1].forms;paintMeasure()")
   page.wait_for_function("document.querySelector('input[data-hymn-structure-label]')?.value==='본절 약 17'")
   assert '통일찬송가' in field.get_attribute('aria-label')
   page.evaluate("state.forms=[{...state.forms[0],lyrics:'changed'}];paintMeasure()")
   page.wait_for_function("document.querySelector('input[data-hymn-structure-label]')?.dataset.reviewStatus==='stale'")
   assert '재검토' in field.input_value()
   page.evaluate("state.songs[0].versions.push({id:'ccm',name:'English',forms:[]});state.selectedVersionId='ccm';state.forms=[];paintMeasure()")
   page.wait_for_function("document.querySelector('input[data-hymn-structure-label]')?.value==='미확인'")
   assert page.evaluate('!state.dirty.song && !state.dirty.forms')
   print(engine,'PASS 12 slots; version selection; readonly; stale/unknown; no dirty writes',flush=True);b.close()
finally:server.shutdown();server.server_close()
