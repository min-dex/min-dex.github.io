"""Candidate welcome UI: mock identity/storage only, no operational traffic."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from pathlib import Path
from smoke_app import sync_playwright,launch_chromium
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 for engine in ('chromium','webkit'):
  browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
  for theme in ('light','dark'):
   for channel in ('release','development','test','missing'):
    page=browser.new_page(viewport={'width':390,'height':844})
    errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
    page.route('**/*',lambda r:r.abort())
    page.set_content(f'<html data-theme="{theme}"><body data-theme="{theme}" class="ui-booting"><main class="home-start"></main></body></html>')
    page.add_style_tag(content=(ROOT/'styles.css').read_text()+(ROOT/'styles-product.css').read_text())
    assert page.evaluate("getComputedStyle(document.body).getPropertyValue('--panel').trim()")==('#232320' if theme=='dark' else '#f4f4ef')
    page.evaluate('''channel=>{window.writes=[];window.store=new Map([['existing-draft','keep']]);
     window.MINDEX_SERVER_STORAGE={ready:false,getItem:(scope,key)=>store.get(key)||null,setItem:async(scope,key,value)=>{writes.push({scope,key,value});if(window.rejectSave)throw Error('offline');store.set(key,value)}};
     window.fetch=async()=>({ok:channel!=='missing',json:async()=>({schema:1,productVersion:'1.0.0',channel,changes:['예배와 말씀 편집 개선','긴 설명 '.repeat(60)],upgradeNotes:'편집 내용은 먼저 저장해 주세요.'})});}''',channel)
    page.add_script_tag(content=(ROOT/'mindex.disclosure-state.js').read_text())
    page.add_script_tag(content=(ROOT/'mindex.product-welcome.js').read_text())
    page.evaluate("document.querySelector('main').innerHTML=MindexProductWelcome.markup();MindexProductWelcome.mount()")
    page.wait_for_timeout(50);assert page.locator('dialog[open]').count()==0
    page.evaluate("MINDEX_SERVER_STORAGE.ready=true;dispatchEvent(new Event('mindex-server-storage-ready'))")
    page.wait_for_timeout(50);assert page.locator('dialog[open]').count()==0
    page.evaluate("document.body.classList.remove('ui-booting')")
    if channel=='release':
     page.locator('dialog[open]').wait_for();page.keyboard.press('Escape');page.wait_for_function("store.get('mindex.product.releaseSeen.v1')==='1.0.0'")
     assert page.evaluate("store.get('mindex.product.releaseSeen.v1')")=='1.0.0'
     page.evaluate('MindexProductWelcome.mount()');assert page.locator('dialog[open]').count()==0
    else:
     page.wait_for_timeout(80);assert page.locator('dialog[open]').count()==0
    page.click('[data-product-notes]')
    if channel=='missing':
     assert page.locator('.product-welcome-status').is_visible()
    else:
     page.locator('dialog[open]').wait_for()
     page.evaluate('window.rejectSave=true')
     page.get_by_role('button',name='닫기',exact=True).click()
     page.wait_for_function("document.activeElement.matches('[data-product-notes]')")
    page.click('summary');page.wait_for_timeout(80)
    page.evaluate("document.querySelector('main').innerHTML=MindexProductWelcome.markup();MindexProductWelcome.mount()")
    assert not page.locator('details').evaluate('e=>e.open')
    assert page.evaluate("store.get('existing-draft')")=='keep'
    assert page.evaluate("writes.every(x=>x.key==='mindex.product.releaseSeen.v1'||x.key.startsWith('mindex.ui.disclosure.v1:'))")
    for width in (320,390,768,1280):
     page.set_viewport_size({'width':width,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    assert not errors,errors
    page.close()
  browser.close();print('PASS',engine,'themes, channel gating, boot/storage readiness, first-run, close/save failure, draft preservation, collapse, widths')
