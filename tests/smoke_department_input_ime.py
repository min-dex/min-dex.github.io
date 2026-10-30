"""Calendar/bulletin keyboard contracts against isolated in-memory data only."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium,prepare_server_state_fixture
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   context=browser.new_context(viewport={'width':1500,'height':1000})
   context.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page=context.new_page();page.goto(url+'?mindexSmokeRaw=1',wait_until='load')
   page.wait_for_function("!!window.MindexBulletin&&!document.body.classList.contains('ui-booting')")
   prepare_server_state_fixture(page)
   page.evaluate('''()=>{
    window.updates=[];state.client={from(){return {update(value){return {eq:async()=>{updates.push(value);return {error:null}}}}}}};
    state.module='calendar';state.calendarLoaded=true;state.calendarError='';state.calendarDetailTab='departments';state.calendarData=[{id:'ime-calendar',date:'2026-11-01',note:'기존 일정'}];
    publishDepartmentTabChange=()=>{};renderCalendarView();
   }''')
   cell=page.locator('.cal-cell[data-cal-id="ime-calendar"][data-cal-field="note"]');cell.focus();cell.fill('한국어 일정')
   for key,extra in [('Enter',{'isComposing':True}),('Escape',{'isComposing':True}),('Enter',{'keyCode':229}),('Escape',{'keyCode':229})]:
    result=cell.evaluate('''(el,args)=>{const e=new KeyboardEvent('keydown',{key:args[0],bubbles:true,cancelable:true,...args[1]});el.dispatchEvent(e);return {prevented:e.defaultPrevented,focused:document.activeElement===el,text:el.textContent,writes:updates.length}}''',[key,extra])
    assert result=={'prevented':False,'focused':True,'text':'한국어 일정','writes':0},(engine,key,extra,result)
   cell.press('Enter');page.wait_for_function('updates.length===1');assert page.evaluate("state.calendarData[0].note")=='한국어 일정'
   cell.focus();cell.fill('취소할 일정');cell.press('Escape');assert cell.inner_text()=='한국어 일정';assert page.evaluate('updates.length')==1
   cell.focus();cell.fill('탭 저장');cell.press('Tab');page.wait_for_function('updates.length===2')
   page.evaluate('''()=>{
    state.module='bulletin';window.removeEventListener('keydown',handleSaveShortcut,true);window.docs=new Map();window.saves=0;window.failSave=false;
    const B=MindexBulletin;window.source=B.resolveSource({service:{id:'bulletin-ime',service_type_id:'children',service_date:'2026-11-01'},sections:[],elements:[]});
    window.row={revision:1,...B.storedValue({...B.normalizeSnapshot({fields:{news:'1. 기존 소식',memoryVerse:'기존 요점'},settings:{design:'children',theme:''}}),source})};
    refs.detailPane.replaceChildren();window.host=document.createElement('div');document.body.append(host);
    window.editor=B.mount(host,{documents:docs,serviceId:'bulletin-ime',scope:'ime-fixture',services:[{id:'bulletin-ime',label:'Fixture'}],loadDraft:async()=>structuredClone(row),loadSource:async()=>structuredClone(source),saveDraft:async(id,payload)=>{saves++;if(failSave)throw Error('fixture save rejected');row={...payload,revision:row.revision+1};return structuredClone(row)}});
   }''')
   try: page.wait_for_function("docs.get('bulletin-ime')?.dbLoaded&&document.querySelector('[data-bulletin-field=memoryVerse]')?.disabled===false",timeout=5000)
   except Exception:
    print(page.evaluate("({loaded:docs.get('bulletin-ime')?.dbLoaded,status:host.innerText.slice(0,500),connected:host.isConnected})"));raise
   memoryVerse=page.locator('[data-bulletin-field="memoryVerse"]');memoryVerse.fill('한글 요점\n둘째 줄')
   memoryVerse.evaluate('(el)=>el.setSelectionRange(3,3)')
   for extra in ({'isComposing':True},{'keyCode':229}):
    for key in ('s','p','z'):
     memoryVerse.evaluate('''(el,args)=>el.dispatchEvent(new KeyboardEvent('keydown',{key:args[0],ctrlKey:true,bubbles:true,cancelable:true,...args[1]}))''',[key,extra])
    assert page.evaluate('saves')==0,(engine,'composition triggered save')
    assert page.locator('iframe.bulletin-print-frame').count()==0
    assert memoryVerse.input_value()=='한글 요점\n둘째 줄'
   assert memoryVerse.evaluate('el=>[el.selectionStart,el.selectionEnd]')==[3,3]
   memoryVerse.press('Enter');assert '\n' in memoryVerse.input_value()
   memoryVerse.press('Escape');assert page.evaluate("docs.get('bulletin-ime').fields.memoryVerse")==memoryVerse.input_value()
   page.evaluate('failSave=true');page.locator('[data-bulletin-save]').click();page.wait_for_function("document.querySelector('.bulletin-status').textContent.includes('fixture save rejected')")
   assert page.evaluate("docs.get('bulletin-ime').dirty")
   assert page.evaluate("docs.get('bulletin-ime').fields.memoryVerse")==memoryVerse.input_value()
   page.evaluate('failSave=false');page.locator('[data-bulletin-save]').click();page.wait_for_function("saves===2&&!docs.get('bulletin-ime').dirty")
   news=page.locator('[data-bulletin-field="news"]');news.fill('1. 첫 소식');news.press('End');news.press('Enter');news.type('둘째 소식');assert news.input_value()=='① 첫 소식\n② 둘째 소식',repr(news.input_value())
   news.press('Shift+Enter');news.type('이어쓰기');assert '② 둘째 소식\n' in news.input_value() and news.input_value().endswith('이어쓰기')
   for width in (1000,390):
    page.set_viewport_size({'width':width,'height':900})
    assert page.locator('.bulletin-inspector').evaluate('e=>Array.from(e.querySelectorAll("input,textarea,select")).filter(x=>x.getClientRects().length).every(x=>x.getBoundingClientRect().right<=e.getBoundingClientRect().right+2)')
   print('PASS',engine,'calendar composing Enter/Esc +229, normal commit/cancel/Tab; bulletin IME shortcuts, multiline/caret, failed-save retry, numbered Enter/ShiftEnter, narrow inspector; production writes/output/print 0',flush=True)
   editor_errors=page.evaluate('document.querySelectorAll("iframe.bulletin-print-frame").length');assert editor_errors==0
   context.close();browser.close()
finally:server.shutdown()
