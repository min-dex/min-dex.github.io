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
records=json.loads((ROOT/'vendor/fonts/paperlogy/manifest.json').read_text())['fonts']
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch();page=browser.new_page();counts.clear()
   for version in ['fixture-cache-v1','fixture-cache-v2']:
    release=version;page.goto(url,wait_until='load')
    page.wait_for_function("typeof state!=='undefined'&&!document.body.classList.contains('ui-booting')")
    assert page.evaluate('MINDEX_RELEASE')==version
    urls=page.locator('script[src]').evaluate_all('(nodes)=>nodes.map(n=>n.src)')
    assert all('/vendor/' in u or 'v='+version in u for u in urls),urls
    checks=page.evaluate('''async records=>{
     if(!getComputedStyle(document.body).fontFamily.startsWith('\"Pretendard Variable\"'))throw Error('Wrong UI default');
     const samples=['우리 살아가는 모든 날들이','세상 모든 민족이 구원을 얻기까지','AV To W’ A” · (찬양) [말씀] 0123456789','똠힣'];
     let checks=0;
     for(const record of records){
      const w=record.weight,probe=document.createElement('div');
      probe.style.cssText=`font:${w} 17px/1.5 "Paperlogy", "Pretendard Variable";width:280px;overflow-wrap:anywhere`;
      probe.textContent=samples.join(' ');document.body.append(probe);probe.getBoundingClientRect();
      await document.fonts.load(`${w} 17px "Paperlogy"`,probe.textContent);await document.fonts.ready;
      const loaded=[...document.fonts].find(f=>f.family==='Paperlogy'&&f.weight===String(w)&&f.status==='loaded');
      if(!loaded)throw Error('Missing face '+w);
      const expected=new FontFace('Expected Paperlogy',`url("./vendor/fonts/paperlogy/${record.file}")`,{weight:String(w)});document.fonts.add(await expected.load());
      for(const width of [120,280])for(const text of samples){
       probe.style.width=width+'px';probe.textContent=text;probe.style.fontFamily='"Paperlogy", "Pretendard Variable"';
       const bounds=()=>{const range=document.createRange();range.selectNodeContents(probe);return [...range.getClientRects()].map(r=>[r.width,r.height,r.top-probe.getBoundingClientRect().top])};
       const actual=JSON.stringify(bounds());probe.style.fontFamily='"Expected Paperlogy", "Pretendard Variable"';
       if(actual!==JSON.stringify(bounds()))throw Error('Font wrapping '+w+' '+text);checks++;
      }
      probe.remove();document.fonts.delete(expected);
     }
     const root=document.createElement('div');root.className='presenter-output-root';document.body.append(root);if(!getComputedStyle(root).fontFamily.startsWith('\"Mindex Presenter\"'))throw Error('Other service font changed');root.innerHTML=renderPresenterSlideFrame({type:'lyrics',elementType:'praise',layout:'lower_bar_text',text:'찬양'},{noChromakey:true,serviceId:'99df9e1b-1716-41fb-9ea0-f5ca4c99ee45'});if(!getComputedStyle(root.firstElementChild).fontFamily.startsWith('Paperlogy'))throw Error('Union font missing');
     const lyric={type:'lyrics',elementType:'praise',layout:'lower_bar_text',text:'찬양',songPosition:{title:'시험',labels:['V','C'],index:0}};
     const frame=renderPresenterSlideFrame(lyric,{noChromakey:true,serviceId:'99df9e1b-1716-41fb-9ea0-f5ca4c99ee45'});
     root.innerHTML='<div class="presenter-output-layer is-active">'+frame+'</div><div class="presenter-output-layer is-next">'+frame+'</div>';
     const [active,next]=root.children;active.dataset.songPositionKey=next.dataset.songPositionKey='same';
     activatePresenterOutputLayer(root,active,next,{cleanOutput:true,noChromakey:true},presenterOutputRenderState.token);
     const overlay=root.querySelector('.presenter-song-position-overlay');if(!overlay||!getComputedStyle(overlay.querySelector('.presenter-lyric-song-name')).fontFamily.startsWith('Paperlogy'))throw Error('Portal metadata lost scoped font');
     root._restoreSongPosition?.();
     root.innerHTML=renderPresenterSlideFrame({type:'lyrics',elementType:'praise',layout:'lower_bar_text',text:'찬양'},{noChromakey:false,serviceId:'99df9e1b-1716-41fb-9ea0-f5ca4c99ee45'});if(!getComputedStyle(root.firstElementChild).fontFamily.startsWith('Paperlogy'))throw Error('Union caption font missing');root.innerHTML=renderPresenterSlideFrame({type:'lyrics',elementType:'praise',layout:'lower_bar_text',text:'찬양'},{noChromakey:true,serviceId:'another'});if(getComputedStyle(root.firstElementChild).fontFamily.includes('Paperlogy'))throw Error('Union font leaked');root.remove();
     return checks;
    }''',records)
    assert checks==72
    assert all(counts['/vendor/fonts/paperlogy/'+r['file']]==1 for r in records),counts
   assert counts['/mindex-release.json']==2
   assert not any('PretendardVariable.woff2' in k for k in counts),'Paperlogy must cover common and rare Korean itself'
   print('PASS',engine,'nine self-hosted weights,',checks,'exact common/rare Korean wrapping cases and cache across fresh releases',flush=True)
   browser.close()
finally:server.shutdown()
