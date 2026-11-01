"""Children's issued-print typography and margins; no operational reads/writes."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from pathlib import Path
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
out=Path('output/bulletin-print-reference-20261101');out.mkdir(parents=True,exist_ok=True)
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1600,'height':1200})
   page.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.route('**/print-reference-fixture.html',lambda r:r.fulfill(content_type='text/html',body='<meta charset="utf-8"><style>body{margin:0}svg{width:1600px;display:block}</style><script src="/mindex.inline-text.js"></script><script src="/mindex.bulletin.js"></script><main></main>'))
   page.goto(url.rsplit('/',1)[0]+'/print-reference-fixture.html')
   result=page.evaluate(r'''async()=>{
    const B=MindexBulletin;await B.readyAssets();await document.fonts.ready;
    const source=B.resolveSource({service:{id:'print-reference',service_type_id:'children',service_date:'2026-11-01'},sections:[],elements:[]});
    source.autoBackground={key:'26-C6.png',url:'assets/worship-backgrounds/26-C6.png'};
    source.order=[
     {id:'all',label:'기도',content:'',person:'다같이'},
     {id:'teacher',label:'설교',content:'',person:'박소영 전도사님'},
     {id:'child',label:'봉헌기도',content:'',person:'김하준 어린이'},
    ];
    const fields={news:'① 첫 번째 안내입니다.\n② 두 번째 안내입니다.',monthlyTheme:'섬김\n가진 것을 먼저 나누어요\n예수님을 본받아 섬겨요',memoryVerse:'비교용 말씀을 그대로 보존합니다.',memoryReference:'누가복음 10:36–37',issue:'32',leader:'서영윤 선생님 / 박소영 전도사님'};
    const doc={source,fields,settings:{design:'children',theme:'auto'},frames:B.defaultFrames('children'),inherited:{common:{},months:{}}};
    const before=JSON.stringify(doc),cases=[];
    for(const mode of ['preview','print']){
     const rendered=B.renderPages(doc,mode);if(rendered.issues.size)throw Error('default overflow: '+[...rendered.issues]);
     const [front,inside]=rendered.pages;
     const order=inside.querySelector('[data-frame-id=order]'),orderFrame=doc.frames.find(f=>f.id==='order');
     const edge=orderFrame.x+orderFrame.w;
     for(const text of ['이','박소영 전도사님','김하준 어린이']){
      const node=[...order.querySelectorAll('text')].find(n=>n.textContent===text);
      if(!node||node.getAttribute('text-anchor')!=='end'||Math.abs(Number(node.getAttribute('x'))-edge)>.001)throw Error('assignee right edge differs: '+text);
     }
     if(front.querySelectorAll('[data-children-corner]').length!==4||inside.querySelectorAll('[data-children-corner]').length!==2)throw Error('missing corner symbols');
     for(const id of ['website','issue','address','meeting'])if(front.querySelector('[data-frame-id='+id+'] text').getAttribute('fill')!=='#231f20')throw Error('low contrast margin '+id);
     const welcome=front.querySelector('[data-frame-id=welcome]'),lines=[...welcome.querySelectorAll('text')];
     if(lines.length!==2||lines.some(n=>n.getAttribute('text-anchor')!=='end'))throw Error('welcome must sit beside heading in two right-aligned lines');
     const size=n=>Number(n.getAttribute('font-size'))*72/25.4;
     if([...lines[0].querySelectorAll('tspan')].some(n=>Math.abs(size(n)-10)>.01)||[...lines[1].querySelectorAll('tspan')].some(n=>Math.abs(size(n)-12.5)>.01))throw Error('printed welcome sizes differ');
     if(![...welcome.querySelectorAll('tspan')].some(n=>n.textContent==='축복'&&n.getAttribute('font-weight')==='800'))throw Error('printed emphasis missing');
     const theme=inside.querySelector('[data-frame-id=monthlyTheme] tspan');
     if(theme.getAttribute('font-family')!=='MindexChildrenTheme'||!document.fonts.check('400 15px MindexChildrenTheme'))throw Error('printed theme face not loaded');
     const leaders=[...inside.querySelectorAll('[data-frame-id=leader] tspan')];
     for(const name of ['서영윤','박소영'])if(!leaders.some(n=>n.textContent===name&&Math.abs(size(n)-12.5)<.01&&n.getAttribute('font-weight')==='700'))throw Error('leader names missing');
     for(const role of [' 선생님',' 전도사님'])if(!leaders.some(n=>n.textContent===role&&Math.abs(size(n)-10)<.01&&n.getAttribute('font-weight')==='500'))throw Error('leader role too large');
     const notice=front.querySelector('[data-frame-id=notices]');
     const bold=[...notice.querySelectorAll('tspan')].filter(n=>n.getAttribute('font-weight')==='700').map(n=>n.textContent).join('');
     if(!bold.includes('잠들기 전, 잠언 읽기!')||!bold.includes('잠잠성경과 주보 모으기 시상식'))throw Error('issued recurring emphasis missing');
     for(const id of ['issue','meeting'])if(front.querySelector('[data-frame-id='+id+'] text').getAttribute('x')!=='288.5')throw Error('asymmetric outer margins');
     document.querySelector('main').replaceChildren(...rendered.pages);cases.push(mode);
    }
    if(JSON.stringify(doc)!==before)throw Error('renderer modified authored content or layout');
    const measureText=CanvasRenderingContext2D.prototype.measureText;
    // Reproduce small-font integer advances even on macOS. Vector measurements
    // and rendered SVG must remain identical; overflow checks stay enabled.
    CanvasRenderingContext2D.prototype.measureText=function(text){
     const metrics=measureText.call(this,text),size=Number(this.font.match(/([\d.]+)px/)[1]);
     const width=size<=20?[...text].reduce((sum,c)=>sum+Math.round(measureText.call(this,c).width),0):metrics.width;
     return new Proxy(metrics,{get:(target,key)=>key==='width'?width:Reflect.get(target,key,target)});
    };
    try{
     if(B.wrap('가'.repeat(10),27,10).length!==1)throw Error('integer hinting changed vector wrapping');
     const hinted=B.renderPages(doc,'print');
     if(hinted.issues.size||hinted.pages.map(p=>p.outerHTML).join('')!==document.querySelector('main').innerHTML)throw Error('integer hinting changed layout or overflow');
     if(hinted.pages[0].querySelectorAll('[data-frame-id=verse] text').length!==2)throw Error('printed motto citation must stay in two lines');
    }finally{CanvasRenderingContext2D.prototype.measureText=measureText;}
    const legacy=B.defaultFrames('children');
    Object.assign(legacy.find(f=>f.id==='newsTitle'),{y:77.5,w:128.5});
    Object.assign(legacy.find(f=>f.id==='welcome'),{x:10,y:90,w:128.5,h:12.5,size:12.5,align:'left'});
    for(const id of ['issue','meeting','insideBrand'])legacy.find(f=>f.id===id).w=128.5;
    const normalized=B.normalizeSnapshot({settings:{design:'children'},fields,frames:legacy});
    if(normalized.frames.find(f=>f.id==='welcome').x!==85||normalized.frames.find(f=>f.id==='newsTitle').y!==87.5)throw Error('untouched old defaults not upgraded');
    const custom=structuredClone(legacy);Object.assign(custom.find(f=>f.id==='welcome'),{x:70,y:82.5,w:65,h:15,size:15,align:'center'});
    const customBefore=JSON.stringify(custom),kept=B.normalizeSnapshot({settings:{design:'children'},fields,frames:custom});
    for(const key of ['x','y','w','h','size','align'])if(kept.frames.find(f=>f.id==='welcome')[key]!==custom.find(f=>f.id==='welcome')[key])throw Error('custom frame overwritten');
    if(JSON.stringify(custom)!==customBefore)throw Error('stored frames mutated');
    const explicit={...doc,fields:{...fields,welcome:'**직접 쓴 환영 문구**',notices:'◈ 직접 쓴 안내 문구입니다.'}};
    const explicitBefore=JSON.stringify(explicit),manual=B.renderPages(explicit,'print');
    if(!manual.pages[0].querySelector('[data-frame-id=welcome]').textContent.includes('직접 쓴 환영 문구')||JSON.stringify(explicit)!==explicitBefore)throw Error('authored wording changed');
    const adultSource=B.resolveSource({service:{id:'adult',service_type_id:'young-adult',service_date:'2026-09-20'},sections:[],elements:[]});
    const adult=B.renderPages({...doc,source:adultSource,settings:{design:'auto',theme:''},frames:B.defaultFrames()},'print');
    if(adult.pages.some(p=>p.querySelector('[data-children-corner]')))throw Error('children decoration leaked into adult layout');
    return {cases,sourceUnchanged:true,customFramesUnchanged:true};
   }''')
   assert result=={'cases':['preview','print'],'sourceUnchanged':True,'customFramesUnchanged':True},result
   page.locator('main > svg').nth(1).screenshot(path=str(out/(engine+'-inside.png')))
   page.locator('main > svg').first.screenshot(path=str(out/(engine+'-front.png')))
   print('PASS issued children welcome, black symmetric margins, six crosses, emphasis, legacy/custom preservation, preview/print and adult isolation',engine,flush=True)
   browser.close()
finally:server.shutdown()
