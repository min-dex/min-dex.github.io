"""Forest print layout and explicit layout-only adoption; no production requests."""
import os,json
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from pathlib import Path
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server();out=Path('output/children-forest-20261101');out.mkdir(parents=True,exist_ok=True)
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1600,'height':1200})
   page.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.route('**/forest-fixture.html',lambda r:r.fulfill(content_type='text/html',body='<meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/styles.bulletin.css"><script src="/mindex.inline-text.js"></script><script src="/mindex.bulletin-forest.js"></script><script src="/mindex.bulletin.js"></script><main id="proof"></main><div id="host"></div>'))
   page.goto(url.rsplit('/',1)[0]+'/forest-fixture.html')
   result=page.evaluate(r'''async()=>{
    const B=MindexBulletin;await B.readyAssets();
    await Promise.all(['assets/bulletin/children-mark-2026-11.png',MindexBulletinForest.artwork].map(src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=resolve;i.onerror=reject;i.src=src})));
    const source=B.resolveSource({service:{id:'forest-fixture',service_type_id:'children',service_date:'2026-11-01'},sections:[],elements:[]});
    source.sermon='서로 돕는 어린이';source.scripture='누가복음 10:25-37';
    source.order=[{id:'creed',label:'사도신경',content:'숨겨야 할 전례문 전문',person:'다같이'},...['첫 번째 찬양','두 번째 찬양','세 번째 찬양','네 번째 찬양'].map((content,i)=>({id:'song'+i,label:'찬양',content,person:'다같이'})),{id:'call',label:'예배의 부름',content:'',person:'다같이'},{id:'reading',label:'성경봉독',content:source.scripture,person:'다같이'},{id:'sermon',label:'설교',content:source.sermon,person:'이교역 전도사님'},{id:'decision',label:'결단기도',content:'',person:'다같이'},{id:'offering',label:'봉헌기도',content:'',person:'김어린 어린이'},{id:'sending',label:'공동체고백',content:'원문 고백 전문',person:'다같이'},{id:'lords',label:'주기도문',content:'원문 기도 전문',person:'다같이'},{id:'news',label:'광고',content:'',person:'인도자'}];
    const fields={news:'① 오늘은 **함께 나누는 반별 모임**을 진행합니다.\n② 금요일 저녁에는 **온세대 예배**가 있습니다.',monthlyTheme:'섬김\n가진 것을 먼저 나누어요\n예수님을 본받아 섬겨요',memoryVerse:'네 생각에는 이 세 사람 중에 누가 강도 만난 자의 이웃이 되겠느냐\n이르되 자비를 베푼 자니이다\n예수께서 이르시되 가서 너도 이와 같이 하라 하시니라',memoryReference:'누가복음 10:36-37',issue:'32',leader:'김교사 선생님 / 이교역 전도사님',eventsText:'11월 1일 청년부 야외예배 / 다니엘기도회\n11월 8일 청년부 자율 셀 모임 / 다니엘기도회\n11월 15일 온세대 찬양예배 / 청년부 연합 셀 모임 / 다니엘기도회'};
    const doc={...B.normalizeSnapshot({fields,settings:{design:'children-forest',theme:'auto'}}),source};
    window.proofDoc=doc;const before=JSON.stringify(doc),cases=[];
    for(const mode of ['preview','print','layout']){
     const r=B.renderPages(doc,mode,'news');
     if(r.issues.size)throw Error('forest overflow '+[...r.issues]);
     if(r.pages.length!==2||r.pages.some(p=>p.getAttribute('viewBox')!=='0 0 297 210'))throw Error('wrong fold format');
     for(const id of ['coverTheme','readingHelp','readingFooter','insideChurch','insideBrand'])if(r.pages.some(p=>p.querySelector('[data-frame-id='+id+']')))throw Error('duplicate print furniture '+id);
     const text=r.pages.map(p=>p.textContent).join('\n');
     for(const phrase of ['함께 나누는 반별 모임','온세대 예배','원하고','김어린 어린이'].filter(x=>x!=='원하고'))if(!text.includes(phrase))throw Error('lost content '+phrase);
     for(const phrase of ['첫 번째 찬양','두 번째 찬양','세 번째 찬양','네 번째 찬양','다니엘기도회'])if(!text.includes(phrase))throw Error('lost source '+phrase);
     if(/숨겨야 할|원문 고백 전문|원문 기도 전문/.test(text))throw Error('liturgy bodies returned');
     if(mode==='layout'&&!r.pages[0].querySelector('[data-frame-hit=news]'))throw Error('layout handles missing');
     document.getElementById('proof').replaceChildren(...r.pages);cases.push(mode);
    }
    if(JSON.stringify(doc)!==before)throw Error('render mutated authored values');
    const target={};B.applyStored(target,{revision:3,...B.storedValue(doc)});
    if(target.settings.design!=='children-forest'||JSON.stringify(target.fields)!==JSON.stringify(doc.fields))throw Error('forest persistence lost data');
    const old={...B.normalizeSnapshot({fields,settings:{design:'children',theme:''}}),source};
    window.forestSource=source;window.forestFields=fields;window.oldContent=B.storedValue(old).content;window.row={service_id:source.id,revision:4,...B.storedValue(old)};window.docs=new Map();window.sent=[];
    window.editor=B.mount(document.getElementById('host'),{scope:'forest-offline',serviceId:source.id,services:[{id:source.id,label:'11/1 어린이부'}],documents:docs,loadSource:async()=>structuredClone(source),loadDraft:async()=>structuredClone(row),saveDraft:async(id,value,revision)=>{if(revision!==row.revision)throw Error('CAS mismatch');sent.push(structuredClone(value));row={service_id:id,revision:revision+1,...value};return structuredClone(row)}});
    return {cases,unchanged:true};
   }''')
   assert result=={'cases':['preview','print','layout'],'unchanged':True},result
   page.wait_for_function("document.querySelector('[data-bulletin-use-forest]')?.disabled===false")
   page.evaluate("window.oldContent=MindexBulletin.storedValue(docs.get('forest-fixture')).content")
   page.locator('[data-bulletin-use-forest]').click()
   page.wait_for_function("document.querySelector('[data-bulletin-field=coverTitle]')?.disabled===false")
   assert page.evaluate("JSON.stringify(MindexBulletin.storedValue(docs.get('forest-fixture')).content)===JSON.stringify(oldContent)")
   page.wait_for_function("document.querySelector('[data-bulletin-print]')?.disabled===false")
   assert '표지 · 소식 · 예배 순서 · 말씀과 읽기표' not in page.locator('#host').inner_text()
   page.locator('[data-bulletin-save]').click();page.wait_for_function('sent.length===1&&!docs.get("forest-fixture").dirty')
   assert page.evaluate("JSON.stringify(sent[0].content)===JSON.stringify(oldContent)&&sent[0].layout.design==='children-forest'")
   page.evaluate('editor.reload()');page.wait_for_function("document.querySelector('[data-bulletin-field=coverTitle]')?.disabled===false")
   assert page.locator('[data-bulletin-field=coverTitle]').input_value()=='서로 돕는 어린이'
   page.locator('[data-bulletin-field=coverTitle]').fill('직접 쓴 표지 제목')
   assert page.evaluate("forestSource.sermon==='서로 돕는 어린이'")
   page.locator('[data-bulletin-undo]').click();page.wait_for_function("document.querySelector('[data-bulletin-field=coverTitle]')?.value==='서로 돕는 어린이'")
   page.evaluate(r"""()=>{
    const B=MindexBulletin, doc=structuredClone(proofDoc);doc.fields.coverTitle='';
    const r=B.renderPages(doc,'print');
    if(r.pages[0].querySelector('[data-frame-id=coverTitle]').textContent)throw Error('explicit blank replaced');
    doc.fields.news='아주 긴 안내 문구 '.repeat(300);
    if(!B.renderPages(doc,'print').issues.has('news'))throw Error('overflow must block print');
    document.getElementById('proof').replaceChildren(...B.renderPages(proofDoc,'print').pages);
   }""")
   for index,name in [(0,'outside'),(1,'inside')]:
    page.locator('#proof > svg').nth(index).screenshot(path=str(out/(engine+'-'+name+'.png')))
   page.evaluate("editor.destroy();docs.clear();window.editor=MindexBulletin.mount(document.getElementById('host'),{scope:'forest-new',documents:docs,serviceId:'forest-new',services:[{id:'forest-new',label:'새 어린이부'}],loadSource:async()=>({...structuredClone(forestSource),id:'forest-new'}),loadDraft:async()=>null,saveDraft:async()=>{throw Error('unexpected write')}})")
   page.wait_for_function("document.querySelector('[data-bulletin-field=coverTitle]')?.disabled===false")
   assert page.evaluate("docs.get('forest-new').settings.design==='children-forest'&&sent.length===1")
   print('PASS forest preview/print/layout, source/content exact, layout-only CAS/reload, cover override/undo, no liturgy',engine,flush=True)
   browser.close()
finally:server.shutdown()
