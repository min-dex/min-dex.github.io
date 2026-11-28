import os,sys,json
os.environ['MINDEX_SMOKE_OFFLINE']='1'
sys.path.insert(0,'tests')
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
from urllib.parse import urlsplit
from pathlib import Path
s,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=b.new_page()
   page.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.goto(url);page.wait_for_function("typeof state!=='undefined' && window.MindexBulletin && typeof loadServiceBulletinSource==='function'")
   result=page.evaluate(Path(__file__).with_suffix('.js').read_text())
   page.wait_for_function("document.querySelector('[data-bulletin-linked=news]') && document.querySelector('[data-bulletin-print]')?.disabled===false")
   assert page.locator('[data-bulletin-field=news]').count()==0
   assert page.locator('[data-bulletin-linked=sermonReference] strong').text_content()=='요한복음 1:9',page.locator('[data-bulletin-linked=sermonReference]').inner_text()
   field=page.locator('[data-bulletin-field=outline]');field.fill('1. 작성 중 대지');field.focus()
   field.evaluate('(el)=>el.setSelectionRange(4,4)')
   page.evaluate("window.linkSource.news='① 변경된 소식';window.linkSource.sermon='자동 갱신 설교';window.dispatchEvent(new Event('focus'))")
   page.wait_for_function("document.querySelector('.bulletin-canvas').textContent.includes('자동 갱신 설교')")
   assert field.input_value()=='1. 작성 중 대지'
   assert field.evaluate('(el)=>el===document.activeElement && el.selectionStart===4')
   assert '변경된 소식' in page.locator('.bulletin-canvas').inner_text()
   assert result['pass']; print('PASS',engine,'canonical projection, live changes/deletes and authored-input preservation');b.close()
finally:s.shutdown();s.server_close()
