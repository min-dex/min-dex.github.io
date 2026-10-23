"""Inactive same-song version buttons target the right forms and preserve drafts."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server, launch_chromium, sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1400,'height':900})
   page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url)
   page.wait_for_function("typeof runVersionFormAction==='function' && !document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{
    const versions=['A','B'].map(name=>({id:crypto.randomUUID(),name,forms:[0,1].map(i=>({id:crypto.randomUUID(),part_type:'Verse',part_number:i+1,lyrics:name+i,sort_order:i+1}))}));
    const song={id:crypto.randomUUID(),title:'버전 버튼 검증',versions};
    state.module='praise';state.songs=[song];state.selectedSongId=song.id;state.selectedVersionId=versions[0].id;
    state.forms=normalizeForms(versions[0].forms.map(f=>({...f})));state.forms[0].lyrics='미저장 초안';state.dirty.forms=true;
    state.client={};state.saving=false;state.connectionError='';state.auth.session={user:{id:'offline'}};
    window.__fixture={song,versions};window.__copied='';copyText=text=>window.__copied=text;
    render();
   }''')
   bid=page.evaluate('__fixture.versions[1].id')
   tags=page.locator(f'[data-type-version-id="{bid}"]')
   assert tags.count()==3
   page.locator(f'[data-type-version-id="{bid}"][data-version-type-toggle="children"]').click()
   assert page.evaluate("__fixture.versions[1].praise_types.includes('children')&&!(__fixture.versions[0].praise_types||[]).includes('children')&&getSelectedVersionId()===__fixture.versions[0].id&&state.forms[0].lyrics==='미저장 초안'")
   assert page.locator(f'[data-type-version-id="{bid}"][data-version-type-toggle="children"]').get_attribute('aria-pressed')=='true'
   controls=page.locator(f'[data-form-version-id="{bid}"]')
   assert controls.count()==8
   assert page.locator(f'[data-form-version-id="{bid}"][data-form-action="up"][data-index="0"]').is_disabled()
   assert page.locator(f'[data-form-version-id="{bid}"][data-form-action="down"][data-index="1"]').is_disabled()
   page.locator(f'[data-form-version-id="{bid}"][data-form-action="copy"][data-index="1"]').click()
   assert page.evaluate("__copied==='B1'&&getSelectedVersionId()===__fixture.versions[0].id&&state.forms[0].lyrics==='미저장 초안'")
   page.locator(f'[data-form-version-id="{bid}"][data-form-action="down"][data-index="0"]').click()
   page.wait_for_function("state.forms[0]?.lyrics==='B1'")
   assert page.evaluate("getSelectedVersionId()===__fixture.versions[1].id&&__fixture.versions[0].forms[0].lyrics==='미저장 초안'")
   aid=page.evaluate('__fixture.versions[0].id')
   page.locator(f'[data-form-version-id="{aid}"][data-form-action="delete"][data-index="1"]').click()
   page.wait_for_function("state.forms.length===1")
   assert page.evaluate("state.forms[0].lyrics==='미저장 초안'&&__fixture.versions[1].forms[0].lyrics==='B1'")
   page.screenshot(path=f'/tmp/mindex-inactive-version-{engine}.png')
   print(engine,'PASS inactive controls, boundaries, targeted copy/move/delete and unsaved draft preservation',flush=True)
   browser.close()
finally:
 server.shutdown();server.server_close()
