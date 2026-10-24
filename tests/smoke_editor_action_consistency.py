"""Offline real-renderer button/disclosure regression; no persisted records."""
import os,sys
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urljoin
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
audit='--audit' in sys.argv
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1000,'height':900})
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url.rsplit('/',1)[0]+'/') else r.abort())
   page.goto(url);page.wait_for_function("typeof renderEmptyVersionState==='function'&&!document.body.classList.contains('ui-booting')")
   page.evaluate("""()=>{
    state.module='praise';state.songs=[{id:'actions',title:'버튼 검증',versions:[{id:'v',name:'기본',forms:[]}]}];state.selectedSongId='actions';state.selectedVersionId='v';state.forms=[];state.dirty.forms=false;state.client={from(){throw Error('Unexpected persistence')}};state.auth.session={user:{id:'offline'}};state.connectionError='';render();
   }""")
   icons=page.locator('[data-add-form] i,[data-add-form] svg').count()
   print(engine,'Praise empty/add icons',icons,flush=True)
   if not audit:assert icons==0
   page.locator('[data-add-form]').first.click()
   assert page.evaluate('state.forms.length>0')
   if not audit:assert page.locator('[data-add-form] i,[data-add-form] svg').count()==0
   page.goto(urljoin(url,'tests/fixtures/shell-print.html'))
   page.locator('[data-bulletin-section=monthly]').wait_for()
   monthly=page.locator('[data-bulletin-section=monthly]')
   print(engine,'Bulletin default monthly open',monthly.evaluate('e=>e.open'),'labeled action icons',page.locator('[data-bulletin-save] i,[data-bulletin-print] i,[data-bulletin-refresh] i').count(),flush=True)
   if not audit:
    assert not monthly.evaluate('e=>e.open')
    assert page.locator('[data-bulletin-save] i,[data-bulletin-print] i,[data-bulletin-refresh] i').count()==0
   for width in (390,1000):
    page.set_viewport_size({'width':width,'height':900})
    for theme in ('light','dark'):
     page.evaluate('(t)=>document.body.dataset.theme=t',theme)
     for wanted in (True,False):
      if monthly.evaluate('e=>e.open')!=wanted:monthly.locator('summary').click()
      page.locator('[data-bulletin-mode=layout]').click()
      page.locator('[data-bulletin-mode=content]').click()
      assert monthly.evaluate('e=>e.open')==wanted
     for label in ('data-bulletin-save','data-bulletin-print','data-bulletin-refresh'):
      assert page.locator('['+label+']').inner_text().strip()
     page.screenshot(path=f'/tmp/editor-actions-{engine}-{theme}-{width}.png')
   print('PASS',engine,'real add action; bulletin disclosure retention across modes, themes and widths',flush=True)
   browser.close()
finally:server.shutdown()
