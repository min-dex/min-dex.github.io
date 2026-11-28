"""Preview and print SVG omit liturgy bodies without changing saved source/fields."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium

server,url=start_local_app_server()
base=url.rsplit('/',1)[0]
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1400,'height':1000})
   page.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.route('**/bulletin-liturgy-fixture.html',lambda r:r.fulfill(content_type='text/html',body='<meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/styles.bulletin.css"><script src="/mindex.inline-text.js"></script><script src="/mindex.bulletin-forest.js"></script><script src="/mindex.bulletin.js"></script><main id="rendered"></main><iframe id="print-view"></iframe>'))
   page.goto(base+'/bulletin-liturgy-fixture.html')
   page.wait_for_function('!!window.MindexBulletin')
   result=page.evaluate('''async()=>{
    const B=MindexBulletin;
    await B.readyAssets();await document.fonts.ready;
    const data={service:{id:'liturgy-browser',service_date:'2026-11-01',service_type_id:'children'},sections:[],elements:[],songs:[{id:'song',title:'보존할 찬양 제목'}]};
    const rows=[['creed','사도신경','faith.creed'],['opening','예배의 부름',''],['community_confession','공동체고백','community.confession'],['lords_prayer','주기도문','sending.lords_prayer'],['custom','함께 드리는 고백','faith.creed']];
    rows.forEach(([key,label,slotKey],i)=>{data.sections.push({id:'s'+i,section_key:key,title:label,sort_order:i});data.elements.push({id:'e'+i,section_id:'s'+i,element_type:'body',title:label,body:('LITURGY-'+i+' 본문을 지면에 표시하지 않습니다. ').repeat(20),person:'다같이',source_ref:{label,slotKey},sort_order:1});});
    data.sections.push({id:'p',section_key:'praise',title:'찬양',sort_order:6},{id:'r',section_key:'scripture_reading',title:'성경봉독',sort_order:7},{id:'w',section_key:'sermon',title:'설교',sort_order:8},{id:'a',section_key:'announcements',title:'광고',sort_order:9});
    data.elements.push({id:'song',section_id:'p',element_type:'praise',song_id:'song',sort_order:1},{id:'reading',section_id:'r',element_type:'scripture_body',scripture_reference:'누가복음 10:25–37',sort_order:1},{id:'sermon',section_id:'w',element_type:'title_person',title:'보존할 설교 제목',person:'설교 담당',source_ref:{slotKey:'sermon.title'},sort_order:1},{id:'news',section_id:'a',element_type:'body',body:'원래 광고 내용',sort_order:1});
    const original=JSON.stringify(data),checks=[];
    for(const serviceType of ['children','young_adult']){
    const departmentData={...data,service:{...data.service,service_type_id:serviceType}};
    for(const compactOrder of [true,false]){
     const source=B.resolveSource({...departmentData,settings:{compactOrder}});
     const doc={source,fields:{news:'① 사도신경을 배우는 사용자 모임 안내',outline:'사용자가 직접 적은 요점'},settings:{design:'children',theme:'',compactOrder},frames:B.defaultFrames('children'),inherited:{common:{},months:{}}};
     const stored=B.storedValue(doc),beforeStored=JSON.stringify(stored);
     const restored={};B.applyStored(restored,{...stored,revision:1});
     // A saved publication retains its old full body, even if the worship source changes.
     const newer=B.resolveSource({...departmentData,elements:data.elements.map(e=>e.body?{...e,body:'NEW WORSHIP BODY'}:e),settings:{compactOrder}});
     restored.source=B.applySourceSnapshot(newer,restored.sourceSnapshot);
     if(!restored.source.order.find(r=>r.id==='e1').content.includes('LITURGY-1'))throw Error('saved publication source changed');
     for(const design of ['children','simple','editorial','auto']){
      const value={...restored,settings:{...restored.settings,design,theme:''},frames:B.defaultFrames(design)};
      const before=JSON.stringify(value);
      for(const mode of ['preview','print']){
       const output=B.renderPages(value,mode);
       const text=output.pages.map(p=>p.textContent).join(' ');
       if(text.includes('LITURGY-')||text.includes('NEW WORSHIP BODY'))throw Error(design+'/'+mode+' leaked a liturgical body');
       for(const label of ['사도신경','예배의 부름','공동체고백','주기도문','함께 드리는 고백'])if(!text.replace(/\s/g,'').includes(label.replace(/\s/g,'')))throw Error('missing liturgy label '+label);
       for(const content of ['보존할 찬양 제목','누가복음 10:25–37','보존할 설교 제목','사용자 모임 안내'])if(!text.replace(/\s/g,'').includes(content.replace(/\s/g,'')))throw Error('normal content missing '+content);
       if(output.issues.has('order'))throw Error(design+'/'+mode+' still overflows order');
       document.getElementById('rendered').replaceChildren(...output.pages);
       if(mode==='print'){
        const frame=document.getElementById('print-view').contentDocument;
        frame.open();frame.write('<!doctype html><body>'+output.pages.map(p=>p.outerHTML).join('')+'</body>');frame.close();
        if(frame.querySelectorAll('svg').length!==2||frame.body.textContent.includes('LITURGY-'))throw Error('print iframe differs');
       }
       checks.push(design+'/'+mode+'/'+compactOrder);
      }
      if(JSON.stringify(value)!==before)throw Error('renderer rewrote manual fields/layout/source snapshot');
     }
     if(JSON.stringify(stored)!==beforeStored)throw Error('stored publication mutated');
    }
    }
    if(JSON.stringify(data)!==original)throw Error('worship aggregate changed');
    return {checks:checks.length,worshipUnchanged:true,storedUnchanged:true};
   }''')
   assert result=={'checks':32,'worshipUnchanged':True,'storedUnchanged':True},result
   print('PASS bulletin liturgy preview/print and iframe, two departments/four layouts, both compaction choices, publication/manual data and worship preservation',engine,flush=True)
   # Exercise the real print entry point, without opening an OS print dialog.
   page.evaluate("""()=>{
    const create=document.createElement.bind(document);window.printCalls=[];
    document.createElement=(tag,...args)=>{const el=create(tag,...args);if(tag==='iframe')el.addEventListener('load',()=>{
     el.contentWindow.print=()=>{printCalls.push({parent:document.title,frame:el.contentDocument.title});if(window.failPrint)throw Error('fixture print failed');};
    });return el;};
   }""")
   for department,label,issue in [('young-adult','청년부','32'),('youth','청소년부','36'),('children','어린이부','34'),('youth','청소년부','')]:
    page.evaluate("""({department,issue})=>{
     window.filenameEditor?.destroy();document.title='Mindex';document.querySelector('#rendered').replaceChildren();
     const B=MindexBulletin,source=B.resolveSource({service:{id:'filename-'+department+issue,service_type_id:department,service_date:'2026-11-22'},sections:[],elements:[]});
     source.order=[{id:'sermon',label:'설교',content:'인쇄 검사',person:'담당자'}];source.issue='99';
     window.filenameEditor=B.mount(document.querySelector('#rendered'),{serviceId:source.id,scope:'filename-offline',services:[{id:source.id,label:department}],loadSource:async()=>source,
      loadDraft:async()=>({revision:1,...B.storedValue({...B.normalizeSnapshot({fields:{issue,news:'',outline:''},settings:{design:'simple',theme:''}}),source})})});
    }""",{'department':department,'issue':issue})
    page.wait_for_function("document.querySelector('[data-bulletin-print]')?.disabled===false")
    before=page.evaluate('printCalls.length')
    page.locator('[data-bulletin-print]').evaluate('(button)=>button.click()')
    try:page.wait_for_function('(n)=>printCalls.length===n+1',arg=before)
    except Exception:
     print('PRINT_DIAGNOSTIC',engine,department,issue,page.evaluate("({calls:printCalls,status:document.querySelector('.bulletin-status')?.textContent,title:document.title,frame:document.querySelector('.bulletin-print-frame')?.contentDocument?.title})"),flush=True)
     raise
    expected=f'{label} 주보 2026-11-22'+(f' (제{issue}호)' if issue else '')
    assert page.evaluate('printCalls.at(-1)')=={'parent':expected,'frame':expected}
    page.evaluate("document.querySelector('.bulletin-print-frame').contentWindow.dispatchEvent(new Event('afterprint'))")
    assert page.title()=='Mindex'
   # An exception or leaving the editor also restores the app title.
   page.evaluate('window.failPrint=true')
   page.locator('[data-bulletin-print]').evaluate('(button)=>button.click()')
   page.wait_for_function("document.querySelector('.bulletin-status').textContent.includes('fixture print failed')")
   assert page.title()=='Mindex'
   page.evaluate('window.failPrint=false')
   before=page.evaluate('printCalls.length')
   page.locator('[data-bulletin-print]').evaluate('(button)=>button.click()')
   page.wait_for_function('(n)=>printCalls.length===n+1',arg=before)
   page.evaluate('filenameEditor.destroy()')
   assert page.title()=='Mindex'
   print('PASS PDF filename: three departments, explicit empty issue, parent/iframe title, afterprint/error/destroy restoration',engine,flush=True)
   browser.close()
finally:server.shutdown()
