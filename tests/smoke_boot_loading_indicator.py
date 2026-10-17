"""Visible startup feedback works before assets, and never blocks completion."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from pathlib import Path
from urllib.parse import urlsplit
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   for reduced in (False,True):
    page=browser.new_page(viewport={'width':1200,'height':800},color_scheme='dark',reduced_motion='reduce' if reduced else 'no-preference');held=[];blocking=True
    def route(r):
     u=urlsplit(r.request.url)
     if u.hostname!='127.0.0.1':r.abort();return
     if blocking and u.path.endswith('/mindex.constants.js'):held.append(r);return
     r.continue_()
    page.route('**/*',route);page.goto(url,wait_until='domcontentloaded')
    page.wait_for_function("document.getElementById('bootStage').textContent==='화면 파일 불러오는 중…'")
    assert page.locator('.mindex-boot-loading').is_visible()
    animation=page.locator('.mindex-boot-spinner').evaluate('e=>getComputedStyle(e).animationName')
    assert animation==('none' if reduced else 'mindex-boot-spin'),animation
    page.wait_for_function("document.getElementById('bootDelay').textContent.length>0",timeout=7000)
    page.wait_for_function("document.getElementById('bootStage').textContent.includes('다시 시도')")
    elapsed=page.locator('#bootElapsed').text_content();assert int(elapsed.split('초')[0])>=4
    if engine=='chromium' and not reduced:
     out=Path(__file__).resolve().parents[1]/'output/startup-network/boot-loading.png';out.parent.mkdir(parents=True,exist_ok=True);page.screenshot(path=str(out))
    blocking=False
    for r in held:r.continue_()
    try:page.wait_for_function("typeof state!=='undefined'&&!document.body.classList.contains('ui-booting')",timeout=8000)
    except Exception:
     print(page.evaluate("({failed:document.body.dataset.bootFailed,stage:document.getElementById('bootStage').textContent,state:typeof state,scripts:[...document.scripts].map(s=>s.src).filter(Boolean),animations:document.getElementById('bootStatus').getAnimations({subtree:true}).map(a=>({name:a.animationName,timing:a.effect.getComputedTiming()}))})"),flush=True)
     raise
    assert page.evaluate("document.body.dataset.bootFailed!=='true'")
    frozen=page.locator('#bootElapsed').text_content();page.wait_for_timeout(1100);assert frozen==page.locator('#bootElapsed').text_content(),(frozen,page.locator('#bootElapsed').text_content(),page.evaluate('document.body.className'))
    assert not page.locator('#bootStatus').is_visible()
    print('PASS',engine,'reduced' if reduced else 'animated','stage, retry, elapsed, completion, timer cleanup',flush=True)
    page.close()
   page=browser.new_page();page.route('**/*supabase.co/**',lambda r:r.abort());page.goto(url+'?output=presenter',wait_until='domcontentloaded');assert not page.locator('#bootStatus').is_visible();page.close();browser.close()
finally:server.shutdown()
