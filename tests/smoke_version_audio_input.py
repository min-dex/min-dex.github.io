"""Actual lyric input and version switching without replacing the focused editor."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,launch_chromium,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch(headless=True)
   page=b.new_page(viewport={'width':1200,'height':800});page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof updateVersionAudioSummary==='function' && !document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{
    const make=(id,name)=>{const v={id,name,praise_types:['children'],forms:[{id:id+'-f',part_type:'Verse',part_number:1,lyrics:'원래 가사'}]};v.forms=normalizeForms(v.forms);v.audio_set={audioUrl:'https://example.test/'+id+'.mp3',audioName:name+' 음원',starts:[0,2],enabled:true,sourceSignature:MindexSongTiming.sourceSignature(v)};return v};
    const a=make('a','A'),b=make('b','B');const song={id:'fixture-song',title:'입력 검증',versions:[a,b]};
    state.songs=[song];state.selectedSongId=song.id;state.selectedVersionId='a';state.forms=structuredClone(a.forms);state.module='praise';state.saving=false;state.dirty.song=false;state.dirty.forms=false;
    state.client={};requireClient=()=>true;persistUiState=()=>{};syncBrowserHistory=()=>{};updateSaveState=()=>{};
    // Keep real header/block rendering, delegated input events and selection/load functions.
    render=()=>{refs.detailPane.innerHTML=renderFormsTab(song);refreshIcons()};render();
    window.audioBefore=JSON.stringify(song.versions.map(v=>v.audio_set));
    window.bSummary=refs.detailPane.querySelector('[data-version-audio-summary="b"]');window.bHtml=bSummary.innerHTML;
   }''')
   field=page.locator('textarea[data-form-field="lyrics"]');field.fill('원래 가사 수정')
   assert page.locator('[data-version-audio-summary="a"]').inner_text().find('확인 필요')>=0
   page.evaluate('window.keptInput=document.activeElement')
   field.press('End');field.press('ArrowLeft');field.press('x')
   assert page.evaluate("document.activeElement===keptInput && keptInput.isConnected && keptInput.selectionStart===keptInput.value.length-1")
   assert page.evaluate("bSummary===document.querySelector('[data-version-audio-summary=\"b\"]') && bSummary.innerHTML===bHtml")
   field.fill('원래 가사');assert '확인 필요' not in page.locator('[data-version-audio-summary="a"]').inner_text()
   field.fill('저장하지 않은 A 가사')
   page.evaluate("selectVersion('b')")
   assert page.locator('textarea[data-form-field="lyrics"]').input_value()=='원래 가사'
   assert 'B 음원' in page.locator('[data-version-audio-summary="b"]').inner_text()
   assert '확인 필요' not in page.locator('[data-version-audio-summary="b"]').inner_text()
   page.locator('textarea[data-form-field="lyrics"]').fill('저장하지 않은 B 가사')
   page.evaluate("selectVersion('a')")
   assert page.locator('textarea[data-form-field="lyrics"]').input_value()=='저장하지 않은 A 가사'
   assert '확인 필요' in page.locator('[data-version-audio-summary="a"]').inner_text()
   assert page.evaluate('JSON.stringify(getSelectedSong().versions.map(v=>v.audio_set))===audioBefore && state.dirty.forms')
   page.screenshot(path='/tmp/mindex-audio-input-'+engine+'.png')
   print('PASS',engine,'real input, undo, caret/node identity, other header untouched, A/B drafts and audio preserved',flush=True);b.close()
finally:server.shutdown()
