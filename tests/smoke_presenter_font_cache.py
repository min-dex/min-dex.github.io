"""Common presenter faces preserve browser wrapping and cache across releases."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
import json,threading
from pathlib import Path
from collections import Counter
from functools import partial
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from urllib.parse import urlsplit
from smoke_app import MindexSmokeServer,MindexSmokeHandler,launch_chromium,sync_playwright
ROOT=Path(__file__).resolve().parents[1]
records=json.loads((ROOT/'vendor/fonts/freesentation/common-manifest.json').read_text())['fonts']
compiled=json.loads((ROOT/'app.runtime.json').read_text())['version']
counts=Counter();release=compiled
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
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch();page=browser.new_page();counts.clear()
   for version in [compiled,'fixture-new-source-release']:
    release=version;page.goto(url,wait_until='load');page.wait_for_function("typeof state!=='undefined'&&!document.body.classList.contains('ui-booting')")
    assert page.evaluate('MINDEX_RELEASE')==version
    executed=page.locator('script[src]').evaluate_all('(nodes)=>nodes.map(n=>n.src)')
    expected='app.runtime.js' if version==compiled else 'app.js'
    assert any('/'+expected+'?v='+version in u for u in executed),executed
    page.evaluate('''async()=>{for(const w of [400,500,600,700,800,900])await document.fonts.load(`${w} 32px "Freesentation"`,'주일예배 찬양 말씀 AV To');}''')
    fontpaths={k:v for k,v in counts.items() if '/vendor/fonts/freesentation/' in k}
    assert len(fontpaths)==6 and all('MindexPresenterCommon-' in k and v==1 for k,v in fontpaths.items()),fontpaths
   result=page.evaluate('''async(records)=>{
    const samples=['주일예배 찬양 말씀 송출 시작','가나다라마바사 아자차카타파하','AV To W’ A” · (찬양) [말씀]','하나님의 은혜로 오늘도 주님을 찬양합니다'];
    let checks=0;
    for(const r of records){
     const f=new FontFace('Original Presenter',`url("./vendor/fonts/freesentation/${r.source}")`,{weight:String(r.weight)});document.fonts.add(await f.load());
     for(const width of [180,540])for(const text of [...samples,'漢 똠 힣 AV To 찬양']){
      const box=document.createElement('div');box.style.cssText=`font:${r.weight} 32px/1.4 "Freesentation";width:${width}px;overflow-wrap:anywhere`;box.textContent=text;document.body.append(box);
      box.getBoundingClientRect();await document.fonts.load(`${r.weight} 32px "Freesentation"`,text);await document.fonts.ready;
      const bounds=()=>{const range=document.createRange();range.selectNodeContents(box);return [...range.getClientRects()].map(r=>[r.width,r.height,r.top-box.getBoundingClientRect().top])};
      // Per-glyph metrics also check rare/common boundaries independent of font-run rectangles.
      const glyphs=()=>Array.from(text,(_,i)=>{const r=document.createRange();r.setStart(box.firstChild,i);r.setEnd(box.firstChild,i+1);const b=r.getBoundingClientRect();return [b.width,b.height,b.top-box.getBoundingClientRect().top,b.left-box.getBoundingClientRect().left]});
      const actual=JSON.stringify(glyphs());box.style.fontFamily='Original Presenter';const expected=JSON.stringify(glyphs());if(actual!==expected)throw Error('font metrics '+r.weight+' '+text+' '+actual+' '+expected);box.remove();checks++;
     }
    }return checks;
   }''',records)
   assert all(counts['/vendor/fonts/freesentation/'+r['source']]==1 for r in records),counts
   assert counts['/mindex-release.json']==2
   print('PASS',engine,result,'exact common/rare glyph wrapping cases, cached small fonts, fresh compiled/source releases',flush=True)
   browser.close()
finally:server.shutdown()
