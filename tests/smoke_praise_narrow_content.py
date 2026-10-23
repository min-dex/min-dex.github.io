"""Offline Praise narrow/long-content regression; no operational writes."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,launch_chromium,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':900,'height':800})
   page.route('**/*supabase*/**',lambda r:r.abort());page.goto(url);page.wait_for_function("typeof renderEmptyVersionState==='function'&&!document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{
    const text='긴가사LongUnbrokenText'.repeat(18)+'\\n'+('줄바꿈을 보존하는 가사\\n'.repeat(18));
    const forms=normalizeForms([{id:'f1',part_type:'Verse',lyrics:text,sort_order:0}]);
    const song={id:'fixture',title:'아주 긴 찬양 제목 LongSongTitleWithoutSpaces'.repeat(8),scripture:'시편 1:1',versions:[{id:'v1',name:'긴 버전 이름'.repeat(15),forms},{id:'v2',name:'두번째 버전'.repeat(15),forms:[{id:'f2',part_type:'Verse',lyrics:text,sort_order:0}]}]};
    state.module='praise';state.songs=[song];state.selectedSongId=song.id;state.selectedVersionId='v1';state.forms=forms;state.dirty.forms=false;state.dirty.song=false;state.client={from(){throw Error('Unexpected DB access')}};state.connectionError='';state.saving=false;state.auth.session={user:{id:'offline'}};render();
   }''')
   original_lyrics=page.locator('.form-textarea').input_value()
   assert original_lyrics.count('\n')>=18
   for width in (1440,1024,768,600,390):
    page.set_viewport_size({'width':width,'height':800});page.wait_for_timeout(150)
    for theme in ('light','dark'):
     page.evaluate('(t)=>document.body.dataset.theme=t',theme)
     page.locator('.editor-head,.form-toolbar,.form-block,.form-preview-text,.form-textarea,.version-compare-title').evaluate_all("es=>{for(const e of es)if(e.scrollWidth>e.clientWidth+1)throw Error(e.className+' overflow '+e.scrollWidth+'/'+e.clientWidth)}")
     page.locator('.form-buttons .btn').evaluate_all("es=>{for(const e of es){const r=e.getBoundingClientRect(),p=e.parentElement.getBoundingClientRect();if(r.right>p.right+1||r.height!==30)throw Error('toolbar button clipped/shrunk')}}")
    page.locator('[data-open-metadata]').click()
    dialog=page.get_by_role('dialog',name='찬양 메타데이터')
    assert dialog.evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&e.scrollWidth<=e.clientWidth+1}')
    field=dialog.locator('[data-song-field="scripture"]')
    field.fill('없는성경주소'*30);field.dispatch_event('change')
    assert field.get_attribute('aria-invalid')=='true'
    assert dialog.evaluate('e=>e.scrollWidth<=e.clientWidth+1')
    dialog.locator('[data-close-metadata]').click()
    assert page.locator('.form-textarea').input_value()==original_lyrics
    assert page.locator('.form-textarea').evaluate('e=>e.scrollHeight<=e.clientHeight+1')
   # Empty and single-version layouts use the same bounded toolbar.
   for empty in (False,True):
    page.evaluate('(empty)=>{state.songs[0].versions=state.songs[0].versions.slice(0,1);if(empty){state.forms=[];state.songs[0].versions[0].forms=[]}render()}',empty)
    assert page.locator('.form-toolbar').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
   print(engine,'PASS 390/600/768/1024/1440px, both themes, long titles/lyrics, comparison, empty/single version and metadata validation',flush=True)
   browser.close()
finally:server.shutdown();server.server_close()
