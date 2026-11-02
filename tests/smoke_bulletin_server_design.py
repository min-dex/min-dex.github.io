"""Server children template: appearance, CAS, weekly isolation and future inheritance."""
import os,json
from pathlib import Path
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1500,'height':1100})
   page.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.route('**/server-design-fixture.html',lambda r:r.fulfill(content_type='text/html',body='<meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/styles.bulletin.css"><script src="/mindex.inline-text.js"></script><script src="/mindex.bulletin-forest.js"></script><script src="/mindex.bulletin.js"></script><div id="host" style="height:1000px"></div>'))
   page.goto(url.rsplit('/',1)[0]+'/server-design-fixture.html')
   page.evaluate(r'''async()=>{
    const B=MindexBulletin;await B.readyAssets();const cache=new Map();
    window.MINDEX_SERVER_STORAGE={ready:true,getItem:(_,k)=>cache.get(k),keys:()=>[...cache.keys()],setItem:async(_,k,v)=>cache.set(k,v),queue:(_,k,v)=>{cache.set(k,v);return true}};
    window.docs=new Map();window.rows={};window.sent=[];window.template=null;window.templateSent=[];window.templateFail=false;window.holdSave=false;
    const source=id=>{const s=B.resolveSource({service:{id,service_type_id:id==='youth'?'young_adult':'children',service_date:id==='old'?'2026-11-08':'2026-11-22'},sections:[],elements:[]});s.sermon='원래 설교';s.order=[{id:'sermon',label:'설교',content:s.sermon,person:'김교역 전도사님'}];return s};
    window.getSource=source;
    rows.youth={revision:1,...B.storedValue({...B.normalizeSnapshot({settings:{design:'simple',theme:''}}),source:source('youth')})};
    window.youthTemplate={template_key:B.TEMPLATE_KEY,revision:1,...B.templateValue({...B.normalizeSnapshot({fields:{welcome:'청년 공통 환영'},settings:{design:'simple',theme:''}}),source:source('youth')})};
    rows.old={revision:3,...B.storedValue({...B.normalizeSnapshot({fields:{news:'직접 작성한 소식',welcome:'직접 쓴 환영',memoryVerse:'직접 쓴 말씀',coverTitle:'',monthlyTheme:'원래 월 주제'},settings:{design:'children-forest',theme:'auto'}}),source:source('old')})};
    window.options={scope:'design-fixture',documents:docs,serviceId:'old',services:[{id:'old',label:'저장된 주보'},{id:'future',label:'새 주보'},{id:'youth',label:'청년부'}],loadSource:async id=>structuredClone(source(id)),loadDraft:async id=>structuredClone(rows[id]||null),saveDraft:async(id,value,revision)=>{if(revision!==(rows[id]?.revision||0))throw Error('weekly CAS conflict');sent.push(structuredClone(value));return rows[id]={revision:revision+1,...structuredClone(value)}},loadTemplate:async key=>{if(key===B.TEMPLATE_KEY)return structuredClone(youthTemplate);if(key!=='children-forest')throw Error('wrong template key');return structuredClone(template)},saveTemplate:async(key,value,revision)=>{templateSent.push({key,value:structuredClone(value),revision});if(holdSave)await new Promise(resolve=>window.releaseSave=resolve);if(templateFail||revision!==(template?.revision||0))throw Error('다른 곳에서 공통 양식을 변경했습니다.');return template={template_key:key,revision:revision+1,...structuredClone(value)}}};
    window.editor=B.mount(document.getElementById('host'),options);
   }''')
   page.wait_for_function("document.querySelector('[data-bulletin-template-edit]')?.disabled===false&&docs.get('old')?.dbLoaded")
   page.evaluate("window.before=JSON.stringify(MindexBulletin.storedValue(docs.get('old')).content)")
   page.locator('[data-bulletin-template-edit]').click();page.wait_for_function("document.querySelector('[data-bulletin-design-color=cover]')?.disabled===false")
   assert '어린이부 공통 양식' in page.locator('#host').inner_text()
   page.get_by_text('색상',exact=True).click()
   page.locator('[data-bulletin-design-color=cover]').fill('#dceafb')
   page.locator('[data-bulletin-frame]').select_option('newsTitle')
   page.locator('[data-bulletin-design-label=newsTitle]').fill('우리의 소식')
   page.locator('[data-bulletin-dimension=size]').select_option('20')
   page.locator('[data-bulletin-family]').select_option('MindexChildrenTheme')
   page.locator('[data-bulletin-frame]').select_option('readingHelp')
   page.locator('[data-bulletin-hidden]').check()
   page.locator('[data-bulletin-design-label=readingHelp]').fill('함께 읽어요')
   page.get_by_text('로고와 그림',exact=True).click()
   page.locator('[data-bulletin-design-image=logo]').set_input_files({'name':'broken.png','mimeType':'image/png','buffer':b'not a valid image'})
   page.wait_for_function("document.querySelector('.bulletin-status').textContent.includes('이미지를 불러오지')")
   page.locator('[data-bulletin-save]').click();page.wait_for_function("document.querySelector('.bulletin-status').textContent.includes('이미지를 불러오지')")
   assert page.evaluate('templateSent.length===0'), 'Broken artwork must not publish a common template'
   page.locator('[data-bulletin-undo]').click();page.wait_for_function("document.querySelector('[data-bulletin-print]')?.disabled===false")
   page.locator('[data-bulletin-design-image=logo]').set_input_files({'name':'logo.png','mimeType':'image/png','buffer':Path('assets/bulletin/children-mark-2026-11.png').read_bytes()})
   page.wait_for_function("document.querySelector('[data-bulletin-print]')?.disabled===false")
   page.locator('[data-bulletin-save]').click();page.wait_for_function('template?.revision===1')
   assert page.evaluate("template.layout.appearance.assets.logo.startsWith('data:image/png;base64,')&&template.template_key==='children-forest'&&template.layout.appearance.palette.cover==='#dceafb'&&template.layout.appearance.labels.newsTitle==='우리의 소식'&&template.layout.appearance.visible.readingHelp===true&&template.layout.frames.find(f=>f.id==='newsTitle').size===20&&template.layout.frames.find(f=>f.id==='newsTitle').family==='MindexChildrenTheme'")
   assert page.evaluate("!Object.hasOwn(template.common,'news')&&!Object.hasOwn(template.common,'memoryVerse')&&!Object.hasOwn(template.common,'coverTitle')&&sent.length===0&&JSON.stringify(MindexBulletin.storedValue(docs.get('old')).content)===before")
   proof=Path('output/bulletin-server-design-20261102');proof.mkdir(parents=True,exist_ok=True)
   for index,name in [(0,'outside'),(1,'inside')]:page.locator('.bulletin-canvas svg').nth(index).screenshot(path=str(proof/(engine+'-'+name+'.png')))
   page.evaluate('''()=>{window.printCalls=0;const d=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'contentWindow');Object.defineProperty(HTMLIFrameElement.prototype,'contentWindow',{get(){const w=d.get.call(this);if(w)w.print=()=>{printCalls++;w.dispatchEvent(new w.Event('afterprint'))};return w}})}''')
   page.locator('[data-bulletin-print]').click();page.wait_for_function('printCalls===1')
   assert page.evaluate("(()=>{const d=document.querySelector('iframe').contentDocument;return d.querySelectorAll('svg').length===2&&d.body.textContent.includes('우리의 소식')&&d.body.textContent.includes('함께 읽어요')&&d.querySelector('image').getAttribute('href').startsWith('data:image/png;base64,')})()")
   page.locator('[data-bulletin-template-exit]').click();page.wait_for_function("document.querySelector('[data-bulletin-field=news]')?.disabled===false")
   assert page.locator('[data-bulletin-field=news]').input_value()=='직접 작성한 소식'
   # Common save never silently rewrites the already-saved issue.
   assert page.evaluate("docs.get('old').settings.appearance===undefined")
   page.locator('[data-bulletin-template-apply]').click();page.wait_for_function("docs.get('old').settings.appearance?.palette.cover==='#dceafb'&&document.querySelector('[data-bulletin-print]')?.disabled===false")
   assert page.evaluate("docs.get('old').fields.welcome==='직접 쓴 환영'&&docs.get('old').fields.coverTitle===''&&docs.get('old').fields.news==='직접 작성한 소식'&&docs.get('old').fields.memoryVerse==='직접 쓴 말씀'")
   page.locator('[data-bulletin-save]').click();page.wait_for_function('sent.length===1')
   page.evaluate('editor.reload()');page.wait_for_function("document.querySelector('[data-bulletin-field=news]')?.disabled===false")
   assert page.evaluate("docs.get('old').settings.appearance.palette.cover==='#dceafb'&&docs.get('old').fields.news==='직접 작성한 소식'")
   # The next new issue inherits the server template, but not the previous weekly copy.
   page.locator('[data-bulletin-service]').select_option('future');page.wait_for_function("docs.get('future')?.settings.appearance?.palette.cover==='#dceafb'")
   assert page.locator('[data-bulletin-field=news]').input_value()!='직접 작성한 소식'
   assert page.evaluate("docs.get('future').settings.templateKey==='children-forest'&&docs.get('future').settings.templateRevision===1")
   page.locator('[data-bulletin-save]').click();page.wait_for_function('sent.length===2')
   # Conflicts retain edits in the separate template draft and keep the issue untouched.
   page.locator('[data-bulletin-template-edit]').click();page.wait_for_function("document.querySelector('[data-bulletin-design-color=cover]')?.disabled===false")
   page.locator('[data-bulletin-frame]').select_option('readingHelp')
   late=page.locator('[data-bulletin-design-label=readingHelp]');late.fill('저장할 안내');page.evaluate('holdSave=true')
   page.locator('[data-bulletin-save]').click();page.wait_for_function('typeof releaseSave==="function"')
   late.fill('저장 중 새 안내');late.evaluate('n=>{window.retained=n;n.setSelectionRange(4,4)}')
   page.evaluate('releaseSave();holdSave=false');page.wait_for_function('template.revision===2&&!document.querySelector("[data-bulletin-save]").disabled')
   assert late.evaluate('n=>n===retained&&document.activeElement===n&&n.selectionStart===4')
   assert late.input_value()=='저장 중 새 안내'
   assert page.evaluate("template.layout.appearance.labels.readingHelp==='저장할 안내'")
   page.get_by_text('색상',exact=True).click()
   page.locator('[data-bulletin-design-color=cover]').fill('#eef0dd');page.evaluate('templateFail=true')
   page.locator('[data-bulletin-save]').click();page.wait_for_function("document.querySelector('.bulletin-status').textContent.includes('다른 곳에서')")
   assert page.locator('[data-bulletin-design-color=cover]').input_value()=='#eef0dd'
   page.locator('[data-bulletin-template-exit]').click();page.wait_for_function("document.querySelector('[data-bulletin-field=news]')?.disabled===false")
   assert page.evaluate("docs.get('future').settings.appearance.palette.cover==='#dceafb'&&template.revision===2&&sent.length===2&&!docs.get('future').dirty&&!editor.canApplyUpdate()")
   page.locator('[data-bulletin-service]').select_option('youth');page.wait_for_function("docs.get('youth')?.source?.department==='young-adult'")
   page.locator('[data-bulletin-template-edit]').click();page.wait_for_function("document.querySelector('[data-bulletin-setting=itemGap]')?.disabled===false")
   assert page.locator('[data-bulletin-design-color]').count()==8
   page.get_by_role('button',name='내용',exact=True).click()
   assert page.locator('[data-bulletin-field=welcome]').input_value()=='청년 공통 환영'
   page.locator('[data-bulletin-template-exit]').click();page.wait_for_function("document.querySelector('[data-bulletin-service]')?.disabled===false")
   page.locator('[data-bulletin-service]').select_option('future');page.wait_for_function("document.querySelector('[data-bulletin-field=coverTitle]')?.disabled===false")
   page.locator('[data-bulletin-template-edit]').click();page.wait_for_function("document.querySelector('[data-bulletin-design-color=cover]')?.disabled===false")
   assert page.locator('[data-bulletin-design-color=cover]').input_value()=='#eef0dd'
   page.locator('[data-bulletin-frame]').select_option('readingHelp')
   assert page.locator('[data-bulletin-design-label=readingHelp]').input_value()=='저장 중 새 안내'
   assert page.evaluate('template.revision===2&&youthTemplate.revision===1&&sent.length===2')
   # Untrusted persisted style keys cannot inject markup, CSS or executable assets.
   assert page.evaluate("(()=>{const a=MindexBulletinForest.normalizeAppearance({palette:{ink:'url(javascript:evil)'},assets:{logo:'javascript:evil'},visible:{unknown:true}});return a.palette.ink==='#294b3b'&&a.assets.logo.startsWith('assets/')&&!Object.hasOwn(a.visible,'unknown')})()")
   print('PASS server children design: appearance/labels/visibility/frames CAS, issue isolation, explicit apply, reload, future inheritance, conflict retention, safe schema',engine,flush=True)
   # Every supported department and old/new renderer uses the same server design workflow.
   for design in ('simple','editorial','ink','panels','children','children-forest'):
    page.evaluate(r'''design=>{
     editor.destroy();window.docs=new Map();window.rows={};window.template=null;window.templateSent=[];window.sent=[];
     const B=MindexBulletin,department=design.startsWith('children')?'children':'young-adult';
     window.allSource=id=>({...getSource(id),department,id,events:'원래 월 일정',common:{welcome:'상속된 환영'},order:[{id:'sermon',label:'설교',content:'주간 말씀',person:'담당자'}]});
     const initial={...B.normalizeSnapshot({fields:{news:'원래 소식',welcome:'',motto:'직접 쓴 표어',outline:'원래 요점'},settings:{design,theme:''},months:{'2026-11':'내 일정'},inherited:{common:{staff:'상속된 섬김이'}}}),source:allSource('saved')};
     rows.saved={revision:3,...B.storedValue(initial)};window.original=JSON.stringify(rows.saved.content);
     window.editor=B.mount(document.getElementById('host'),{scope:'all-design-'+design,documents:docs,serviceId:'saved',services:[{id:'saved',label:'기존 주보'},{id:'new',label:'새 주보'}],loadSource:async id=>allSource(id),loadDraft:async id=>structuredClone(rows[id]||null),saveDraft:async(id,value,revision)=>{if(revision!==(rows[id]?.revision||0))throw Error('CAS');sent.push(value);return rows[id]={revision:revision+1,...structuredClone(value)}},loadTemplate:async()=>structuredClone(template),saveTemplate:async(key,value,revision)=>{if(revision!==(template?.revision||0))throw Error('CAS');templateSent.push(value);return template={template_key:key,revision:revision+1,...structuredClone(value)}}});
    }''',design)
    page.wait_for_function("docs.get('saved')?.dbLoaded&&document.querySelector('[data-bulletin-template-edit]')?.disabled===false")
    page.locator('[data-bulletin-template-edit]').click()
    page.wait_for_function("document.querySelector('[data-bulletin-design-color=ink]')?.disabled===false")
    assert page.locator('[data-bulletin-setting=design]').input_value()==design,'Seeding keeps the selected existing design'
    if design=='simple':assert page.locator('[data-frame-id=motto] text').first.get_attribute('font-weight')=='500','Default template must preserve existing simple font weight'
    page.locator('[data-bulletin-frame]').select_option('newsTitle')
    page.locator('[data-bulletin-design-label=newsTitle]').fill('서버에서 바꾼 제목')
    page.locator('[data-bulletin-dimension=size]').select_option('10')
    page.locator('[data-bulletin-family]').select_option('MindexChildrenTheme')
    page.locator('[data-bulletin-vertical-align]').select_option('middle')
    page.locator('[data-bulletin-vertical-align]').select_option('bottom')
    page.locator('[data-bulletin-undo]').click()
    page.wait_for_function("document.querySelector('[data-bulletin-vertical-align]')?.value==='middle'")
    page.get_by_text('색상',exact=True).click()
    page.locator('[data-bulletin-design-color=ink]').fill('#123456')
    page.get_by_text('로고와 그림',exact=True).click()
    page.locator('[data-bulletin-design-image=logo]').set_input_files({'name':'logo.png','mimeType':'image/png','buffer':Path('assets/bulletin/children-mark-2026-11.png').read_bytes()})
    page.wait_for_function("document.querySelector('[data-bulletin-print]')?.disabled===false")
    page.locator('[data-bulletin-save]').click();page.wait_for_function('template?.revision===1')
    assert page.evaluate("JSON.stringify(rows.saved.content)===original&&sent.length===0&&template.layout.appearance.labels.newsTitle==='서버에서 바꾼 제목'&&template.layout.appearance.palette.ink==='#123456'&&template.layout.frames.find(f=>f.id==='newsTitle').verticalAlign==='middle'")
    assert page.locator('.bulletin-canvas').inner_text().find('서버에서 바꾼 제목')>=0
    assert page.evaluate("[...document.querySelectorAll('.bulletin-canvas image')].some(n=>n.getAttribute('href').startsWith('data:image/png'))")
    assert page.evaluate("[...document.querySelectorAll('.bulletin-canvas [fill]')].some(n=>n.getAttribute('fill')==='#123456')")
    page.locator('[data-bulletin-template-exit]').click();page.wait_for_function("document.querySelector('[data-bulletin-template-edit]')?.disabled===false")
    page.locator('[data-bulletin-template-edit]').click();page.wait_for_function("document.querySelector('.bulletin-status').textContent==='공통 양식 편집 · 저장됨'")
    assert page.locator('[data-bulletin-save]').is_disabled()
    page.locator('[data-bulletin-template-exit]').click();page.wait_for_function("document.querySelector('[data-bulletin-template-edit]')?.disabled===false")
    page.evaluate("window.copyBefore=JSON.stringify({fields:docs.get('saved').fields,inherited:docs.get('saved').inherited,months:docs.get('saved').months,sourceSnapshot:docs.get('saved').sourceSnapshot})")
    page.locator('[data-bulletin-template-apply]').click();page.wait_for_function("docs.get('saved').settings.templateRevision===1&&document.querySelector('[data-bulletin-print]')?.disabled===false")
    assert page.evaluate("copyBefore===JSON.stringify({fields:docs.get('saved').fields,inherited:docs.get('saved').inherited,months:docs.get('saved').months,sourceSnapshot:docs.get('saved').sourceSnapshot})"),'Explicit apply must preserve every authored/blank/inherited/month/source value'
    page.locator('[data-bulletin-save]').click();page.wait_for_function('sent.length===1')
    page.evaluate('editor.reload()');page.wait_for_function("document.querySelector('[data-bulletin-print]')?.disabled===false")
    assert page.evaluate("docs.get('saved').settings.appearance.palette.ink==='#123456'&&docs.get('saved').fields.welcome===''&&docs.get('saved').frames.find(f=>f.id==='newsTitle').family==='MindexChildrenTheme'&&docs.get('saved').frames.find(f=>f.id==='newsTitle').verticalAlign==='middle'")
    page.locator('[data-bulletin-service]').select_option('new');page.wait_for_function("docs.get('new')?.settings.templateRevision===1&&document.querySelector('[data-bulletin-print]')?.disabled===false")
    assert page.evaluate("docs.get('new').settings.appearance.palette.ink==='#123456'&&docs.get('new').frames.find(f=>f.id==='newsTitle').verticalAlign==='middle'&&JSON.stringify(rows.saved.content)!==original")
    print('PASS all-department design: seed/save/reopen/layout-only apply/content preservation/reload/new inheritance',design,engine,flush=True)
   geometry=page.evaluate(r'''()=>{
    const B=MindexBulletin,container=document.createElement('div');document.body.append(container);let cases=0;
    try{
     for(const design of ['simple','editorial','ink','panels','children','children-forest']){
      const department=design.startsWith('children')?'children':'young-adult';
      const doc={...B.normalizeSnapshot({settings:{design,theme:'',appearance:{labels:{newsTitle:'첫째 줄\n둘째 줄'}}},fields:{news:'① 첫 번째 안내\n② 두 번째 안내',notices:'고정 배경 안의 안내'}}),source:{...getSource('saved'),department}};
      doc.frames.forEach(f=>f.hidden=f.id!=='newsTitle');const frame=doc.frames.find(f=>f.id==='newsTitle');Object.assign(frame,{x:10,y:20,w:100,h:40,size:15});
      const original=JSON.stringify(doc),plain=B.renderPages(doc,'print').pages.map(p=>p.outerHTML);
      if(JSON.stringify(doc)!==original)throw Error('default render mutated document');
      if(plain.some(s=>s.includes('data-frame-content')))throw Error('default output acquired alignment wrapper');
      for(const verticalAlign of ['top','middle','bottom']){
       frame.verticalAlign=verticalAlign;const before=JSON.stringify(doc),offsets=[];
       for(const mode of ['preview','layout','print']){
        const result=B.renderPages(doc,mode,'newsTitle');container.replaceChildren(...result.pages);
        const group=container.querySelector('[data-frame-id=newsTitle]'),content=group.querySelector('[data-frame-content]'),box=content.getBBox(),offset=content.transform.baseVal.consolidate()?.matrix.f||0;
        const expected=frame.y+(frame.h-box.height)*({top:0,middle:.5,bottom:1}[verticalAlign]);
        if(Math.abs(box.y+offset-expected)>.02)throw Error('wrong vertical position '+design+'/'+verticalAlign+'/'+mode);
        if(result.issues.has('newsTitle'))throw Error('fitting text wrongly blocked');
        const handle=group.querySelector('[data-frame-hit]');if(handle&&Number(handle.getAttribute('y'))!==frame.y)throw Error('frame handle moved');
        offsets.push(offset);cases++;
       }
       if(!offsets.every(n=>Math.abs(n-offsets[0])<.001))throw Error('preview/print alignment differs');
       if(JSON.stringify(doc)!==before)throw Error('alignment render mutated authored values');
      }
      delete frame.verticalAlign;if(JSON.stringify(B.renderPages(doc,'print').pages.map(p=>p.outerHTML))!==JSON.stringify(plain))throw Error('existing placement did not restore exactly');
      frame.verticalAlign='bottom';doc.settings.appearance.labels.newsTitle='';container.replaceChildren(...B.renderPages(doc,'print').pages);
      if(container.querySelector('[data-frame-content=newsTitle]').textContent)throw Error('blank replaced');
      doc.settings.appearance.labels.newsTitle='넘치는 글';frame.h=5;frame.size=45;
      if(!B.renderPages(doc,'print').issues.has('newsTitle'))throw Error('overflow no longer blocks printing');
      for(const id of ['news','order']){
       doc.frames.forEach(f=>f.hidden=f.id!==id);const list=doc.frames.find(f=>f.id===id);Object.assign(list,{verticalAlign:'middle',h:150,y:30});
       container.replaceChildren(...B.renderPages(doc,'layout',id).pages);
       const group=container.querySelector('[data-frame-id='+id+']'),content=group.querySelector('[data-frame-content]'),box=content.getBBox(),handle=group.querySelector('[data-frame-hit]'),offset=content.transform.baseVal.consolidate()?.matrix.f||0;
       const y=Number(handle.getAttribute('y')),h=Number(handle.getAttribute('height'));
       if(box.height<=h&&Math.abs(box.y+offset-(y+(h-box.height)/2))>.02)throw Error('multi-element block alignment '+design+'/'+id);
       if(Number(handle.getAttribute('y'))!==y)throw Error('list frame moved');
      }
      if(design==='children-forest'){
       doc.frames.forEach(f=>f.hidden=f.id!=='notices');const note=doc.frames.find(f=>f.id==='notices');note.verticalAlign='middle';note.h=40;
       container.replaceChildren(...B.renderPages(doc,'layout','notices').pages);
       const group=container.querySelector('[data-frame-id=notices]');if(Number(group.querySelector(':scope>rect:not([data-frame-hit])').getAttribute('y'))!==note.y-1.5)throw Error('background moved with text');
       doc.frames.forEach(f=>f.hidden=f.id!=='forestLogo');doc.frames.find(f=>f.id==='forestLogo').verticalAlign='bottom';container.replaceChildren(...B.renderPages(doc,'print').pages);
       if(!container.querySelector('[data-frame-id=forestLogo] image').getAttribute('preserveAspectRatio').includes('YMax'))throw Error('image alignment missing');
      }
     }
     return cases;
    }finally{container.remove();}
   }''')
   assert geometry==54
   print('PASS box alignment geometry: six layouts x three positions x preview/layout/print; handles/background fixed; blank/overflow/default preserved',engine,flush=True)
   browser.close()
finally:server.shutdown()
