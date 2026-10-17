"""Real browser HTTP cache, fresh release resolution, font metrics and fallback."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
import json,threading
from pathlib import Path
from collections import Counter
from functools import partial
from http.server import SimpleHTTPRequestHandler
from urllib.parse import urlsplit
from smoke_app import MindexSmokeServer,MindexSmokeHandler,launch_chromium,sync_playwright
ROOT=Path(__file__).resolve().parents[1]
counts=Counter();release='fixture-cache-v1'
class Handler(MindexSmokeHandler):
 def do_GET(self):
  path=urlsplit(self.path).path;counts[path]+=1
  if path=='/mindex-release.json':
   self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(json.dumps({'version':release}).encode());return
  super().do_GET()
 def end_headers(self):
  self.send_header('Cache-Control','public, max-age=600' if '/vendor/fonts/' in self.path else 'no-store')
  SimpleHTTPRequestHandler.end_headers(self)
server=MindexSmokeServer(('127.0.0.1',0),partial(Handler,directory=str(ROOT)));threading.Thread(target=server.serve_forever,daemon=True).start();url=f'http://127.0.0.1:{server.server_port}/'
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch();page=browser.new_page();counts.clear();release='fixture-cache-v1'
   errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   # No routing: Playwright routes would disable the browser's real HTTP cache.
   for version in ['fixture-cache-v1','fixture-cache-v2']:
    release=version;page.goto(url,wait_until='load')
    try:page.wait_for_function("typeof state!=='undefined'&&!document.body.classList.contains('ui-booting')")
    except Exception:
     print('BOOT FAILURE',engine,version,errors,page.evaluate("({state:typeof state,release:window.MINDEX_RELEASE,failed:document.body.dataset.bootFailed,status:document.getElementById('bootStatus')?.textContent,resources:performance.getEntriesByType('resource').filter(r=>r.name.includes('retry')).map(r=>r.name)})"),flush=True)
     raise
    page.evaluate('''async()=>{for(const w of [400,700,900])await document.fonts.load(`${w} 17px "Pretendard Variable"`,'주일예배 찬양 말씀 AV To');await document.fonts.ready;}''')
    actual=page.evaluate('MINDEX_RELEASE')
    assert actual==version,(engine,version,actual,page.evaluate("performance.getEntriesByType('resource').filter(e=>e.name.includes('mindex-release')).map(e=>({name:e.name,duration:e.duration}))"))
    urls=page.locator('script[src]').evaluate_all('(nodes)=>nodes.map(n=>n.src)')
    assert all('/vendor/' in u or 'v='+version in u for u in urls),urls
    fonts={k:v for k,v in counts.items() if '/vendor/fonts/pretendard/' in k}
    assert fonts and all(v==1 for v in fonts.values()),(engine,fonts)
    assert not any('Common.woff2' in k or 'PretendardVariable.woff2' in k for k in fonts),fonts
   assert counts['/mindex-release.json']==2,'release was not refreshed'
   page.evaluate('''async()=>{await document.fonts.load('400 17px "Pretendard Variable"','漢');await document.fonts.ready;}''')
   assert not any('PretendardVariable.woff2' in k for k in counts),'unsupported glyph fetched a font that cannot display it'
   result=page.evaluate('''async()=>{
    const f=new FontFace('Original UI','url("./vendor/fonts/pretendard/MindexSans-Common.woff2")',{weight:'45 930'});document.fonts.add(await f.load());
    const samples=['MINDEX 2026 10 18','AV To W’ A” · (찬양) [말씀]','주일예배 찬양 말씀 송출 시작','가나다라마바사 아자차카타파하','제1기 중보기도학교 수료식'];
    let checks=0;
    for(const weight of [400,700,900])for(const width of [120,280])for(const text of samples){
     const box=document.createElement('div');box.style.cssText=`font: ${weight} 17px/1.5 "Pretendard Variable";width:${width}px;overflow-wrap:anywhere`;box.textContent=text;document.body.append(box);
     box.getBoundingClientRect();await document.fonts.ready;const bounds=()=>{const range=document.createRange();range.selectNodeContents(box);return [...range.getClientRects()].map(r=>[r.width,r.height,r.top-box.getBoundingClientRect().top])};
     const actual=JSON.stringify(bounds());box.style.fontFamily='Original UI';const expected=JSON.stringify(bounds());if(actual!==expected)throw Error('font metrics '+text+' '+actual+' '+expected);box.remove();checks++;
    }
    const rare=document.createElement('div');rare.style.fontFamily='"Pretendard Variable"';rare.textContent='똠';document.body.append(rare);rare.getBoundingClientRect();await document.fonts.load('400 17px \"Pretendard Variable\"','똠');await document.fonts.ready;
    return checks;
   }''')
   assert any('PretendardVariable.woff2' in k for k in counts),'full fallback missing'
   print('PASS',engine,'cached fonts across fresh releases, resolved-only scripts,',result,'exact wrapping/metric cases and rare fallback',flush=True)
   browser.close()
finally:server.shutdown()
