"""Synthetic records only; compiled UI and native save roundtrip, no live writes."""
import os
from pathlib import Path
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,launch_chromium,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as pw:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(pw) if engine=='chromium' else pw.webkit.launch(headless=True)
   page=browser.new_page(viewport={'width':1100,'height':850})
   page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url)
   page.wait_for_function("typeof state!=='undefined' && typeof renderDetail==='function' && typeof MindexPraiseSelection==='object'")
   page.wait_for_function("!document.body.classList.contains('ui-booting') && getComputedStyle(document.getElementById('bootStatus')).visibility==='hidden'")
   print(engine,page.evaluate(r'''async()=>{
    const check=(v,m)=>{if(!v)throw Error(m)}, equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    const entry={id:'fixture:1',source:'선곡 시험 자료',source_date:'2026-01',key:'D–E',category:'2',theme:'위로',transition_note:'E 다음 시험곡 (3절)\n> G 마지막 시험곡',next:[{song_id:'SONG-CONT-0002-0001',title:'다음 시험곡',key:'E',note:'3절'}]};
    const make=(id,title,metadata)=>({id,revision:1,metadata:{title,metadata},content:{name:'기본',praise_types:['ccm'],is_primary:true,forms:[{id:crypto.randomUUID(),part_type:'Verse',part_number:1,lyrics:'보존할 시험 가사',sort_order:1}]},relations:{related:[],same_song:[]}});
    const records=[make('SONG-CONT-0001-0001','선곡 시험곡',{artist:'시험',selection_guidance:[entry]}),make('SONG-CONT-0002-0001','다음 시험곡',{})];
    const stored=new Map(records.map(r=>[r.id,structuredClone(r)]));let writes=0;
    const repo=MindexSingleSong.createRepository({read:async ids=>ids.map(id=>structuredClone(stored.get(id))),commit:async req=>{
     check(req.expectedRevision===stored.get(req.record.id).revision,'revision mismatch');writes++;const next={...structuredClone(req.record),revision:req.expectedRevision+1};stored.set(next.id,next);return structuredClone(next);
    }});
    installSingleSongSession(records,repo);state.module='praise';state.client={};state.connectionError='';state.loading=false;
    state.selectedSongId=state.selectedVersionId=records[0].id;state.forms=normalizeForms(records[0].content.forms);state.dirty.song=state.dirty.forms=false;
    captureCleanFingerprint('praise');render();
    const song=getSelectedSong();check(document.querySelector('.praise-selection').textContent.includes('위로'),'selection not rendered');
    check(MindexPraiseSelection.searchText(normalizeSongMetadata(song.metadata).selection_guidance).includes('위로'),'normalizer lost guidance');
    check(getSongSearchFields(song).some(f=>f.label==='선곡 정보'&&f.text==='위로'),'search index missed guidance');
    const content=structuredClone(stored.get(song.id).content);song.metadata=normalizeSongMetadata({...song.metadata,artist:'수정 시험'});
    check(await saveSongMeta(song),'save acknowledgement');check(writes===1,'save count');
    const fresh=(await readSingleSongs([song.id]))[0];check(equal(fresh.metadata.selection_guidance,[entry]),'guidance lost on unrelated edit');
    check(equal(stored.get(song.id).content,content),'content changed by metadata save');
    window.selectionWrites=()=>writes;captureCleanFingerprint('praise');render();
    return 'PASS compiled selection display + native metadata roundtrip and preserved content';
   }'''),flush=True)
   if os.environ.get('MINDEX_SELECTION_SCREENSHOT_DIR'):
    dest=Path(os.environ['MINDEX_SELECTION_SCREENSHOT_DIR']);dest.mkdir(parents=True,exist_ok=True)
    page.screenshot(path=str(dest/(engine+'-selection.png')),full_page=True)
   page.locator('.praise-selection [data-open-song]').click()
   page.wait_for_function("state.selectedSongId==='SONG-CONT-0002-0001'")
   assert page.locator('.praise-selection').count()==0
   assert page.evaluate('selectionWrites()')==1
   page.evaluate("state.selectedSongId=state.selectedVersionId='SONG-CONT-0001-0001';renderDetail()")
   page.set_viewport_size({'width':390,'height':850})
   assert page.locator('.praise-selection').evaluate('(el)=>el.scrollWidth<=el.clientWidth+1')
   page.locator('.praise-selection > summary').click()
   assert not page.locator('.praise-selection').evaluate('(el)=>el.open')
   browser.close()
finally:
 server.shutdown();server.server_close()
