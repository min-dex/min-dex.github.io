"""Shared department print grid, source links, exact metrics and preservation. Offline only."""
import os,json
from pathlib import Path
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1500,'height':1100})
   page.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.route('**/swiss-fixture.html',lambda r:r.fulfill(content_type='text/html',body='<meta charset="utf-8"><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/styles.bulletin.css"><script src="/mindex.inline-text.js"></script><script src="/mindex.bulletin-forest.js"></script><script src="/mindex.bulletin.js"></script><div id="host"></div>'))
   page.goto(url.rsplit('/',1)[0]+'/swiss-fixture.html')
   results=page.evaluate(r'''async()=>{
    const B=MindexBulletin;await B.readyAssets();window.samples={};const results=[];
    for(const department of ['young-adult','children','youth']){
     const source=B.resolveSource({service:{id:department,service_type_id:department,service_date:'2026-11-22'},calendar:[{date:'2026-11-22',young_adult_prayer:'청년 담당',children_prayer:'어린이 담당',youth_prayer:'학생 담당'}],sections:[{id:'p',section_key:'prayer',title:'대표기도',sort_order:1},{id:'s',section_key:'sermon',title:'설교',sort_order:2},{id:'a',section_key:'announcements',title:'광고',sort_order:3}],elements:[{id:'p1',section_id:'p',title:'대표기도',person:'원래 담당',element_type:'title_person'},{id:'s1',section_id:'s',title:'말씀을 따라',person:'교역자',element_type:'title',source_ref:{slotKey:'sermon.title'}},{id:'a1',section_id:'a',body:'① **함께** 모입니다.\n - 일시: 주일 (오후)',element_type:'body',person:'광고 담당'}]});
     if(!source.order.find(r=>r.label==='대표기도').person.includes(department==='youth'?'학생':department==='children'?'어린이':'청년'))throw Error('Wrong department prayer');
     source.scripture='요한복음 1:1–5';source.events='1일 (주일) 오후 8:00 | 기도회\n6일 (금) 오후 8:00 | 월삭예배';
     const doc={...B.normalizeSnapshot({settings:{design:'swiss-'+department,theme:''},fields:{outline:'1. 첫 번째 대지\n2. 두 번째 대지\n3. 세 번째 대지',monthlyTheme:'함께 나누어요',memoryVerse:'서로 사랑하라',memoryReference:'요한복음 13:34',reflection:'',worshipPoint:'함께 예배해요',staff:'회장 학생 하나 · 서기 학생 둘'}}),source};
     window.samples[department]=doc;const before=JSON.stringify(doc),r=B.renderPages(doc,'print');
     if(r.issues.size)throw Error(department+' issues '+[...r.issues]);
     const bar=r.pages[0].querySelector('[data-swiss-bar]');if(bar.getAttribute('fill')!==({'young-adult':'#B65C24',youth:'#574579',children:'#155436'}[department]))throw Error('Department accent');if(department==='children'&&r.pages[0].querySelector('[data-frame-id=coverTitle]'))throw Error('Cover sermon title remains');
     for(const id of ['coverDate','liturgical'])for(const n of r.pages[0].querySelectorAll(`[data-frame-id=${id}] tspan`))if(Math.abs(+n.getAttribute('font-size')*72/25.4-12.5)>.01||n.getAttribute('font-weight')!=='700')throw Error('Cover meta size/weight');
     const eventRuns=[...r.pages[0].querySelectorAll('[data-frame-id=events] tspan')];if(!eventRuns.some(n=>n.textContent.includes('오후')&&Math.abs(+n.getAttribute('font-size')*72/25.4-10)<.01)||!eventRuns.some(n=>n.textContent.includes('월삭예배')&&Math.abs(+n.getAttribute('font-size')*72/25.4-12.5)<.01))throw Error('Calendar hierarchy');
     for(const rule of r.pages.flatMap(p=>[...p.querySelectorAll('[data-swiss-rule]')]))if(rule.getAttribute('fill')!=='#808080'||+rule.getAttribute('height')!==.2)throw Error('Shared rule style');
     for(const row of r.pages[1].querySelectorAll('[data-order-row]')){const top=+row.getAttribute('data-row-top'),height=+row.getAttribute('data-row-height');if(Math.abs((height-2.5)/6.25-Math.round((height-2.5)/6.25))>.001)throw Error('Order row slots');for(const t of row.querySelectorAll('text'))if(+t.getAttribute('y')<top+1.25||+t.getAttribute('y')>top+height-1.25)throw Error('Order baseline padding');}
     const orderRuns=[...r.pages[1].querySelectorAll('[data-frame-id=order] tspan')];if(!orderRuns.some(n=>n.textContent==='대표기도'&&Math.abs(+n.getAttribute('font-size')*72/25.4-10)<.01))throw Error('Order label hierarchy');
     if(JSON.stringify(doc)!==before)throw Error('Renderer changed source');
     const restored={};B.applyStored(restored,{revision:1,...B.storedValue(doc)});
     if(JSON.stringify(restored.fields)!==JSON.stringify(doc.fields)||restored.settings.design!==doc.settings.design)throw Error('Persistence lost data');
     const insideBars=[...r.pages[1].querySelectorAll('[data-swiss-bar]')].map(e=>[+e.getAttribute('x'),+e.getAttribute('y')]);if(JSON.stringify(insideBars)!==JSON.stringify([[10,10],[158.5,198.75]]))throw Error('Inside bar positions');if(r.pages[1].querySelector('[data-frame-id=insideBrand]').textContent!==({'young-adult':'RIA 청년부',youth:'TOV 청소년부',children:'꿈꾸는 어린이부'}[department]))throw Error('Full department name');
     const widths=r.pages.flatMap(p=>[...p.querySelectorAll('[data-swiss-bar]')].map(e=>+e.getAttribute('width')));if(widths.length!==6||widths.some(w=>w!==128.5))throw Error('Bars');
     const fonts=r.pages.flatMap(p=>[...p.querySelectorAll('tspan')].map(e=>Math.round(+e.getAttribute('font-size')*72/25.4*10)/10));if(fonts.some(n=>![8,10,12.5,15,20,40].includes(n)))throw Error('Font token '+fonts);
     const text=r.pages.map(p=>p.textContent).join(' ');for(const part of ['말씀을 따라','함께','광고 담당'])if(!text.includes(part))throw Error('Missing linked '+part);
     if(department==='children')for(const part of ['이달의 주제','새길 말씀','잠잠성경','잠언'])if(!text.includes(part))throw Error('Child section missing '+part);
     if(department==='youth')for(const part of ['받은 은혜'])if(!text.includes(part))throw Error('Youth section missing '+part);
     if(department==='youth'&&r.pages[1].querySelector('[data-frame-id=nextPrayer],[data-frame-id=pointTitle],[data-frame-id=worshipPoint]'))throw Error('Retired youth sections');
     results.push({department,issues:[...r.issues]});
    }
    for(const n of [2,3,4]){const d=structuredClone(samples['young-adult']);d.fields.outline=Array.from({length:n},(_,i)=>`${i+1}. 설교 대지`).join('\n');const r=B.renderPages(d,'print');if(r.issues.size)throw Error('Outline overflow '+n);const counts=[...r.pages[1].querySelectorAll('[data-outline-item]')].map(g=>g.querySelectorAll('[data-swiss-rule]').length);if(new Set(counts).size!==1||counts[0]<1)throw Error('Unequal writing lines');results.push({points:n,lines:counts});}
    for(const n of [2,3,4]){const d=structuredClone(samples.youth);d.fields.outline=Array.from({length:n},(_,i)=>`${i+1}. 청소년부 대지`).join('\n');const r=B.renderPages(d,'print');if(r.issues.size)throw Error('Youth outline '+n+' '+[...r.issues]);const counts=[...r.pages[1].querySelectorAll('[data-outline-item]')].map(g=>g.querySelectorAll('[data-swiss-rule]').length);if(new Set(counts).size!==1||counts[0]<1)throw Error('Youth writing lines');const peer=structuredClone(samples['young-adult']);peer.fields.outline=d.fields.outline;const peerRules=[...B.renderPages(peer,'print').pages[1].querySelectorAll('[data-outline-item] [data-swiss-rule]')].map(e=>e.getAttribute('y'));const youthRules=[...r.pages[1].querySelectorAll('[data-outline-item] [data-swiss-rule]')].map(e=>e.getAttribute('y'));if(JSON.stringify(peerRules)!==JSON.stringify(youthRules))throw Error('Department writing grid differs '+n);}
    const fortnight=structuredClone(samples.children);fortnight.fields.monthlyTheme='이달의 주제\n함께 나누어요\n서로 사랑해요';fortnight.fields.memoryVerse='서로 사랑하며\n함께 말씀을 읽어요\n친구와 나누어요';fortnight.fields.readingPlan=Array.from({length:14},(_,i)=>`11월 ${i+1}일 · 잠언 ${i+1}장`).join('\n');if(B.renderPages(fortnight,'print').issues.size)throw Error('Two-week reading plan lost');
    const hierarchy=structuredClone(samples.children);hierarchy.fields.monthlyTheme='주제 제목\n첫 설명\n둘째 설명';const themeNodes=[...B.renderPages(hierarchy,'print').pages[1].querySelectorAll('[data-frame-id=monthlyTheme] tspan')];for(const node of themeNodes){const title=node.textContent.includes('주제 제목'),size=+node.getAttribute('font-size')*72/25.4,weight=node.getAttribute('font-weight');if(Math.abs(size-(title?15:12.5))>.01||weight!==(title?'700':'500'))throw Error('Monthly theme hierarchy');}
    for(const department of ['young-adult','youth','children']){const d=structuredClone(samples[department]);d.fields.staff='위임목사 예시 목사 · 담당 교역자 담당 목사\n가나다 회장 · 라마바 부회장\n서기 기록 청년 · 회계 재정 청년';const staff=B.renderPages(d,'print').pages[0].querySelector('[data-frame-id=staff]');const cells=[...staff.querySelectorAll('[data-staff-row]')];if(cells.length!==6||!cells[2].textContent.startsWith('회장가나다'))throw Error('Shared staff role parsing');const ys=cells.filter((_,i)=>i%2===0).map(g=>+g.querySelector('text').getAttribute('y'));if(Math.abs((ys[1]-ys[0])-7.5)>.01||Math.abs((ys[2]-ys[1])-7.5)>.01)throw Error('Staff row rhythm');}
    const coverMeta=structuredClone(samples.youth);coverMeta.fields.issue='36';coverMeta.source.liturgicalSeason='절기';coverMeta.source.commemoration='기념주일';const metaPage=B.renderPages(coverMeta,'print').pages[0];for(const id of ['issue','commemoration']){const g=metaPage.querySelector(`[data-frame-id=${id}]`);if(!g)throw Error('Missing secondary cover metadata');for(const t of g.querySelectorAll('tspan'))if(Math.abs(+t.getAttribute('font-size')*72/25.4-10)>.01||t.getAttribute('font-weight')!=='500')throw Error('Secondary cover typography');}delete coverMeta.source.commemoration;if(B.renderPages(coverMeta,'print').pages[0].querySelector('[data-frame-id=commemoration]'))throw Error('Empty commemoration placeholder');
    for(const [dept,defaultName] of Object.entries({children:'박소영 전도사님',youth:'허호범 선생님','young-adult':'이재희 청년'})){const d=structuredClone(samples[dept]);d.source=B.resolveSource({service:{id:dept,service_type_id:dept,service_date:'2026-11-22',praise_leader:defaultName}});const header=()=>B.renderPages(d,'print').pages[1].querySelector('[data-frame-id=leader]')?.textContent||'';if(header()!=='인도: '+defaultName)throw Error('Default leader dedup');d.fields.leader='새 인도자';if(!header().includes(defaultName+' / 새 인도자'))throw Error('Leader override');d.source.praiseLeader='다른 찬양 인도자';if(!header().includes('다른 찬양 인도자 / 새 인도자')||d.fields.leader!=='새 인도자')throw Error('Live praise refresh');d.fields.leader='';if(header()!=='인도: 다른 찬양 인도자')throw Error('Explicit blank leader');}
    const named=structuredClone(samples.youth);named.fields.brand='직접 쓴 공동체';if(!B.renderPages(named,'print').pages[0].querySelector('[data-frame-id=brand]').textContent.includes('직접 쓴 공동체'))throw Error('Authored brand lost');
    for(const [dept,logo] of Object.entries({'young-adult':'assets/bulletin/ria-mark-orange.svg',youth:'assets/bulletin/tov-approved.png',children:'assets/bulletin/children-mark-2026-11.png'}))for(const count of [1,2]){const d=structuredClone(samples[dept]);d.settings.appearance={assets:{logo}};d.fields.motto=Array.from({length:count},()=> '함께 말씀을 따라가요').join('\n');const before=JSON.stringify(d),r=B.renderPages(d,'print'),p=r.pages[0],b=p.querySelector('[data-frame-id=brand]'),m=p.querySelector('[data-frame-id=motto]'),im=b.querySelector('[data-swiss-logo-height]');if(!im||+im.getAttribute('height')!==50)throw Error('Logo ink height');const box=im.getAttribute('viewBox').split(' ').map(Number);if(Math.abs(+im.getAttribute('width')/50-box[2]/box[3])>.00001)throw Error('Logo aspect ratio');const top=+b.getAttribute('transform').match(/translate\(0 ([^)]+)/)[1],total=50+5+count*7.5;if(Math.abs((top-37.5)-(150-top-total))>.00001||Math.abs(top/1.25-Math.round(top/1.25))>.00001)throw Error('Identity free-space/grid');const lines=[...m.querySelectorAll('text')];if(lines.length!==count||+m.getAttribute('data-line-count')!==count)throw Error('Motto line count');if(count===2&&Math.abs(+lines[1].getAttribute('y')-+lines[0].getAttribute('y')-7.5)>.00001)throw Error('Motto line pitch');if(JSON.stringify(d)!==before)throw Error('Identity mutated stored content');}
    const long=structuredClone(samples.children);long.fields.news='많은 내용 '.repeat(500);if(!B.renderPages(long,'print').issues.has('news'))throw Error('Overflow not blocked');
    return results;
   }''')
   page.evaluate(r'''()=>{
    const B=MindexBulletin,cache=new Map();window.MINDEX_SERVER_STORAGE={ready:true,getItem:(_,k)=>cache.get(k),keys:()=>[...cache.keys()],setItem:async(_,k,v)=>cache.set(k,v),queue:(_,k,v)=>{cache.set(k,v);return true}};
    window.documents=new Map();window.saved=[];window.templateRows={};
    const original={...B.normalizeSnapshot({settings:{design:'youth-tov',appearance:{assets:{logo:'assets/bulletin/ria-mark.webp'}}},fields:{news:'직접 쓴 광고',outline:'1. 첫 대지\n2. 둘째 대지',reflection:'',welcome:''},months:{'2026-11':'직접 쓴 월 일정'}}),source:structuredClone(samples.youth.source)};
    window.row={revision:3,...B.storedValue(original)};window.preserved=JSON.stringify(row.content);
    window.editor=B.mount(document.querySelector('#host'),{serviceId:'youth',scope:'swiss-fixture',documents,services:[{id:'youth',label:'청소년부'}],loadSource:async()=>{if(window.rejectSource)throw Error('source unavailable');if(window.holdSource)await new Promise(r=>window.releaseSource=r);return structuredClone(samples.youth.source)},loadDraft:async()=>structuredClone(row),saveDraft:async(id,value,revision)=>{if(id!=='youth'||revision!==row.revision)throw Error('CAS mismatch');saved.push(value);return row={revision:revision+1,...structuredClone(value)};}});
   }''')
   page.wait_for_function("documents.get('youth')?.dbLoaded&&document.querySelector('[data-bulletin-use-swiss]')")
   page.locator('[data-bulletin-use-swiss]').click()
   page.wait_for_function("document.querySelectorAll('[data-bulletin-design=swiss-youth]').length===2&&document.querySelector('[data-bulletin-print]').disabled===false")
   assert page.evaluate("JSON.stringify(MindexBulletin.storedValue(documents.get('youth')).content)===preserved")
   assert page.evaluate("documents.get('youth').settings.appearance.assets.logo==='assets/bulletin/ria-mark.webp'")
   page.locator('[data-bulletin-field=scriptureNote]').fill('연결 본문에 대한 노트')
   page.locator('[data-bulletin-save]').click()
   page.wait_for_function('saved.length===1')
   page.evaluate('editor.reload()')
   page.wait_for_function("documents.get('youth').revision===4&&document.querySelector('[data-bulletin-field=scriptureNote]')?.value==='연결 본문에 대한 노트'")
   assert page.evaluate("documents.get('youth').fields.welcome===''&&documents.get('youth').fields.reflection===''&&documents.get('youth').months['2026-11']==='직접 쓴 월 일정'")
   # Live linked projections refresh independently of authored fields/revisions.
   page.evaluate("document.activeElement.blur()")
   page.evaluate("samples.youth.source.sermon='갱신된 설교';samples.youth.source.scripture='요한복음 3:16';documents.get('youth').dirty=false")
   assert page.evaluate("editor.refreshSourceRemote()") is True
   assert page.evaluate("documents.get('youth').source.sermon==='갱신된 설교'&&documents.get('youth').fields.news==='직접 쓴 광고'&&documents.get('youth').revision===4&&saved.length===1")
   page.evaluate("samples.youth.source.sermon='편집 중 원본 변경';documents.get('youth').dirty=true")
   assert page.evaluate("editor.refreshSourceRemote()") is False
   assert page.evaluate("documents.get('youth').source.sermon==='갱신된 설교'")
   page.evaluate("documents.get('youth').dirty=false")
   assert page.evaluate("editor.refreshSourceRemote()") is True
   page.evaluate("window.holdSource=true;window.pendingSource=editor.refreshSourceRemote();void 0")
   page.wait_for_function("typeof releaseSource==='function'")
   page.locator('[data-bulletin-field=scriptureNote]').fill('조회 중 새 입력')
   page.evaluate("window.holdSource=false;releaseSource()")
   assert page.evaluate("pendingSource") is False
   assert page.evaluate("documents.get('youth').fields.scriptureNote==='조회 중 새 입력'")
   page.evaluate("documents.get('youth').dirty=false;document.activeElement.blur();window.rejectSource=true")
   assert page.evaluate("editor.refreshSourceRemote()") is False
   assert '연동 자료 갱신 실패' in page.locator('.bulletin-status').inner_text()
   page.evaluate("window.rejectSource=false")
   assert page.evaluate("editor.refreshSourceRemote()") is True
   # Old evidence remains stored but cannot mask current linked source values.
   assert page.evaluate("""()=>{const d=documents.get('youth'),stored=MindexBulletin.storedValue(d);const fresh={...d.source,sermon:'최신 원본'};return MindexBulletin.applySourceSnapshot(fresh,stored.content.sourceSnapshot).sermon==='최신 원본'}""")
   page.evaluate("""()=>{window.printCalls=0;const descriptor=Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype,'contentWindow');Object.defineProperty(HTMLIFrameElement.prototype,'contentWindow',{get(){const w=descriptor.get.call(this);if(w)w.print=()=>{printCalls++;w.dispatchEvent(new w.Event('afterprint'))};return w}})}""")
   page.locator('[data-bulletin-print]').click()
   page.wait_for_function('printCalls===1')
   assert page.evaluate("document.querySelector('iframe').contentDocument.querySelectorAll('[data-bulletin-design=swiss-youth]').length===2")
   page.evaluate(r'''()=>{
    const B=MindexBulletin;
    for(const department of ['young-adult','children','youth']){
     const d=structuredClone(samples[department]);const content=d=>{const v=B.storedValue(d).content;return JSON.stringify([v.fields,v.months,v.sourceSnapshot,v.inherited])};const before=content(d);
     const row={template_key:B.TEMPLATE_KEYS[department],revision:1,...B.templateValue(d)};
     B.applyTemplate(d,row,{common:false});if(content(d)!==before)throw Error('Template changed weekly content');
     for(const other of ['young-adult','children','youth'].filter(x=>x!==department)){let rejected=false;try{B.normalizeTemplate({...row,layout:{...row.layout,design:'swiss-'+other}})}catch{rejected=true}if(!rejected)throw Error('Cross-department layout accepted');}
    }
   }''')
   page.evaluate('editor.destroy()')
   out=Path('output/bulletin-swiss');out.mkdir(parents=True,exist_ok=True)
   (out/(engine+'-results.json')).write_text(json.dumps(results,ensure_ascii=False,indent=2))
   for department in ('young-adult','children','youth'):
    page.evaluate('''d=>{const host=document.getElementById('host');host.replaceChildren(...MindexBulletin.renderPages(samples[d],'print').pages);host.style.cssText='background:white;width:1123px';host.querySelectorAll('svg').forEach(e=>e.style.cssText='display:block;width:1123px;height:794px')}''',department)
    page.locator('#host').screenshot(path=str(out/(engine+'-'+department+'.png')))
   print(engine,results)
   browser.close()
finally:server.shutdown()
