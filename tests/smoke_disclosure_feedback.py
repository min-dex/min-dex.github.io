"""Actual worship editor disclosure feedback; fixture data, no backend writes."""
import os
from pathlib import Path
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
fixture=Path(__file__).with_name('smoke_editor_pane_bounds.py').read_text().split("page.evaluate('''",1)[1].split("''')",1)[0]
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   try:
    page=browser.new_page(viewport={'width':1440,'height':950})
    page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
    page.goto(url);page.wait_for_function("typeof renderServicePrepEditorDialog==='function'&&!document.body.classList.contains('ui-booting')")
    page.evaluate(fixture)
    for theme in ['light','dark']:
     for width in [1440,760,640]:
      page.set_viewport_size({'width':width,'height':950});page.evaluate('(t)=>applyTheme(t)',theme);page.evaluate("auditOpen('prep')")
      for selector in ['.svc-authoring-panel-head','.svc-item-note > summary']:
       el=page.locator(selector).first;el.scroll_into_view_if_needed();page.mouse.move(0,0)
       before=el.evaluate('(e)=>getComputedStyle(e).backgroundColor');el.hover()
       assert el.evaluate('(e)=>getComputedStyle(e).backgroundColor')!=before,(engine,theme,selector,'hover')
       page.keyboard.press('Tab');el.focus()
       assert el.evaluate('(e)=>e.matches(":focus-visible") && getComputedStyle(e).outlineWidth==="2px" && getComputedStyle(e).outlineStyle==="solid"'),(engine,theme,selector,'focus')
       opened=el.evaluate('(e)=>e.parentElement.open');el.press('Enter');assert el.evaluate('(e)=>e.parentElement.open')!=opened
       el.press('Space');assert el.evaluate('(e)=>e.parentElement.open')==opened
      page.evaluate('''()=>{
       for(const e of document.querySelectorAll('.svc-item-note-summary span')){
        const s=getComputedStyle(e);if(s.backgroundColor!=='rgba(0, 0, 0, 0)'||s.paddingLeft!=='0px'||s.paddingRight!=='0px')throw Error('metadata pill remains');
       }
       for(const e of document.querySelectorAll('.svc-authoring-panel-head,.svc-item-note > summary')){
        if(!e.checkVisibility())continue;const r=e.getBoundingClientRect(),children=[...e.children].filter(n=>n.checkVisibility());
        for(const c of children){const q=c.getBoundingClientRect();if(q.left<r.left-1||q.right>r.right+1)throw Error('header child overflow')}
       }
      }''')
      page.screenshot(path=f'/tmp/disclosure-{engine}-{theme}-{width}.png')
      print(engine,theme,width,'PASS hover, keyboard focus, Enter/Space, metadata and header bounds',flush=True)
   finally:browser.close()
finally:server.shutdown();server.server_close()
