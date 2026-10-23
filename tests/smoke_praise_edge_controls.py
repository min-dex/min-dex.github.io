"""Offline empty/invalid states and native prompt cancellation; no DB writes."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,launch_chromium,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1440,'height':900})
   page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url);page.wait_for_function("typeof renderEmptyVersionState==='function'&&!document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{
    const song={id:crypto.randomUUID(),title:'빈 버전 검증',versions:['A','B'].map(name=>({id:crypto.randomUUID(),name,forms:[]}))};
    state.module='praise';state.songs=[song];state.selectedSongId=song.id;state.selectedVersionId=song.versions[0].id;state.forms=[];state.dirty.forms=false;state.dirty.song=false;
    state.client={from(){throw Error('unexpected DB write/read')}};state.connectionError='';state.saving=false;state.auth.session={user:{id:'offline'}};
    window.__edgeSong=song;render();
   }''')
   for width in (900,1440):
    page.set_viewport_size({'width':width,'height':900})
    for theme in ('light','dark'):
     page.evaluate('(theme)=>document.documentElement.dataset.theme=theme',theme)
     assert page.locator('.version-empty-state .btn').count()==2
     page.locator('.version-empty-state .btn').evaluate_all('''es=>{for(const e of es){const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(Math.abs(r.height-30)>1||s.paddingLeft!=='10px'||s.paddingRight!=='10px'||s.gap!=='5px')throw Error('empty button geometry');const parent=e.closest('.version-empty-state').getBoundingClientRect();if(r.left<parent.left||r.right>parent.right)throw Error('button overflow')}}''')
   before=page.evaluate('JSON.stringify(__edgeSong)')
   dialogs=[]
   def cancel(dialog):
    dialogs.append(dialog.type);dialog.dismiss()
   page.on('dialog',cancel)
   page.locator('[data-add-version]').first.click()
   page.locator('[data-delete-version]').last.click()
   assert dialogs==['prompt','confirm']
   assert page.evaluate('JSON.stringify(__edgeSong)')==before
   page.get_by_role('button',name='첫 가사 추가',exact=True).click()
   assert page.locator('.form-textarea').count()==1
   page.locator('.form-textarea').fill('보존할 미저장 가사')
   page.locator('[data-open-metadata]').click()
   dialog=page.get_by_role('dialog',name='찬양 메타데이터')
   assert dialog.is_visible()
   dialog.locator('[data-song-field="scripture"]').fill('없는성경 999:1')
   dialog.locator('[data-song-field="scripture"]').dispatch_event('change')
   assert dialog.locator('[data-song-field="scripture"]').get_attribute('aria-invalid')=='true'
   assert dialog.locator('[data-scripture-validation-hint]').is_visible()
   close=dialog.locator('[data-close-metadata]')
   assert close.evaluate("e=>e.getBoundingClientRect().height===35&&e.querySelector('svg').getBoundingClientRect().width===16")
   close.focus();assert close.evaluate('e=>e===document.activeElement')
   close.click();assert page.locator('.form-textarea').input_value()=='보존할 미저장 가사'
   page.evaluate("__edgeSong.versions=__edgeSong.versions.slice(0,1);render()")
   assert page.locator('[data-delete-version]').is_disabled()
   print(engine,'PASS empty actions, both themes, prompt/delete cancellation, metadata close/focus, draft retention and last-version disabled',flush=True)
   browser.close()
finally:server.shutdown();server.server_close()
