"""Real output rendering of split Verse markers; external requests blocked."""
import os
from urllib.parse import urlsplit
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
remote=os.environ.get('MINDEX_VERSE_URL')
server,url=(None,remote) if remote else start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   try:
    page=b.new_page(viewport={'width':1280,'height':720})
    page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc and r.request.method in ('GET','HEAD') else r.abort())
    page.goto(url+'?output=presenter');page.wait_for_function("typeof renderPresenterOutput==='function' && !!document.getElementById('presenterOutputRoot')")
    for marker,number in [('V1A','1'),('V1B','1'),('V2B','2'),('C1A','')]:
     page.evaluate('''marker=>{renderPresenterOutput({serviceId:'verse-fixture',serviceType:'wednesday',chromakey:true,index:0,slides:[{id:marker,elementType:'praise',layout:'lower_bar_text',type:'lyrics',marker,text:'가사 첫 줄\\n다음 가사',title:'표시 검증'}]})}''',marker)
     page.wait_for_timeout(250)
     result=page.evaluate('''number=>{const host=document.querySelector('#presenterOutputRoot > .presenter-output-layer.is-active');const marks=host.querySelectorAll('[data-verse-no]');if(marks.length!==(number?1:0))throw Error('number count');if(!number)return 'non-verse excluded';const el=marks[0],s=getComputedStyle(el,'::before'),line=getComputedStyle(el),r=el.getBoundingClientRect();if(el.dataset.verseNo!==number||s.content.replaceAll('"','')!==number)throw Error('wrong number');if(s.display==='none'||s.visibility==='hidden'||parseFloat(s.fontSize)>=parseFloat(line.fontSize))throw Error('hidden or full-size number');if(r.left-parseFloat(s.right)-parseFloat(s.width)<-10)throw Error('clipped number');return {number,position:s.position,font:s.fontSize,lineFont:line.fontSize};}''',number)
     if number:page.screenshot(path=f'/tmp/mindex-verse-{engine}-{marker}.png')
     print(engine,marker,'PASS',result,flush=True)
   finally:b.close()
finally:
 if server:server.shutdown();server.server_close()
