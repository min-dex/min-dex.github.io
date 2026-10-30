"""Bulletin real DOM + app DB adapters: late saves, service return and template typing."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium,prepare_server_state_fixture

def click_save(page, expected):
 # A real server-state status update between mouse down/up must not consume a save click.
 page.evaluate("async()=>{await document.fonts.ready;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}")
 button=page.locator('[data-bulletin-save]');button.scroll_into_view_if_needed()
 button.evaluate("async e=>{window.saveButtonUnderTest=e;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))}")
 page.evaluate("window.saveClicks=[];for(const name of ['pointerdown','pointerup','click'])host.addEventListener(name,e=>saveClicks.push({type:name,save:!!e.target.closest('[data-bulletin-save]'),same:e.target.closest('[data-bulletin-save]')===saveButtonUnderTest}),{capture:true,once:true})")
 try:
  box=button.bounding_box();page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.evaluate("window.dispatchEvent(new Event('mindex-server-state-settled'))");page.mouse.up();page.wait_for_function('(n)=>sent.length===n',arg=expected,timeout=30000)
 except Exception:
  print('SAVE_CLICK_DIAGNOSTIC',page.evaluate("({sent:sent.length,events:saveClicks,dirty:docs.get(a)?.dirty,saving:docs.get(a)?.saving,loaded:docs.get(a)?.dbLoaded,disabled:host.querySelector('[data-bulletin-save]')?.disabled,retained:saveButtonUnderTest.isConnected,focus:document.activeElement?.tagName})"),flush=True)
  raise

server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   context=browser.new_context(viewport={'width':1400,'height':950});context.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page=context.new_page();page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("!!window.MindexBulletin&&!document.body.classList.contains('ui-booting')");prepare_server_state_fixture(page)
   page.evaluate('''()=>{
    const B=MindexBulletin;window.a='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';window.b='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';window.sent=[];window.respond=[];window.docs=new Map();window.store={};window.sources={};
    for(const [id,date]of [[a,'2026-11-01'],[b,'2026-11-08']]){
     sources[id]=B.resolveSource({service:{id,service_type_id:'young_adult',service_date:date},sections:[],elements:[]});
     store[id]={service_id:id,revision:1,...B.storedValue({...B.normalizeSnapshot({fields:{news:'① 주간 소식',outline:'요점 '+date,leader:'인도자 '+date},settings:{design:'simple',theme:''}}),source:sources[id]})};
    }
    window.template={template_key:B.TEMPLATE_KEY,revision:1,...B.templateValue({...B.normalizeSnapshot({fields:{welcome:'공통 환영 원본'},settings:{design:'simple',theme:''}}),source:sources[a]})};
    state.config.url='bulletin-e2e-fixture';state.module='bulletin';state.client={from(table){let patch=null,filters={};const q={select(){return q},eq(k,v){filters[k]=v;return q},update(v){patch=v;return q},insert(v){patch=v;return q},maybeSingle(){
      const id=filters.service_id||patch?.service_id,key=filters.template_key||patch?.template_key;const current=table==='mindex_bulletin_templates'?template:store[id];
      if(!patch)return window.readFailure ? Promise.reject(readFailure) : Promise.resolve({data:structuredClone(current),error:null});
      return new Promise(resolve=>{sent.push({table,id,key,value:structuredClone(patch),expected:filters.revision});respond.push(ok=>{
       if(typeof ok==='object')return resolve({data:null,error:ok});
       if(!ok)return resolve({data:null,error:{code:'42501',message:'fixture save rejected'}});
       if(filters.revision!==current.revision)return resolve({data:null,error:null});
       const saved={...current,...structuredClone(patch),revision:current.revision+1};if(table==='mindex_bulletin_templates')template=saved;else store[id]=saved;
       resolve({data:structuredClone(saved),error:null});
      })});
    }};return q}};
    refs.detailPane.replaceChildren();window.host=document.createElement('div');host.style.height='850px';refs.detailPane.append(host);
    window.editor=B.mount(host,{documents:docs,scope:'bulletin-e2e',serviceId:a,services:[{id:a,label:'11/1 청년부'},{id:b,label:'11/8 청년부'}],loadSource:async id=>structuredClone(sources[id]),loadDraft:loadBulletinDraft,saveDraft:saveBulletinDraft,loadTemplate:loadBulletinTemplate,saveTemplate:saveBulletinTemplate});
   }''')
   page.wait_for_function("docs.get(a)?.dbLoaded&&document.querySelector('[data-bulletin-field=outline]')?.disabled===false")
   outline=page.locator('[data-bulletin-field=outline]');outline.fill('저장 요청 요점');outline.press('Control+s');page.wait_for_function('sent.length===1')
   assert page.evaluate('sent[0].table')=='mindex_bulletins'
   outline.fill('저장 중 새 요점\n두 번째 줄');outline.evaluate('e=>{window.retainedInput=e;e.setSelectionRange(4,4)}')
   page.evaluate('respond[0](true)');page.wait_for_function('!docs.get(a).saving')
   assert outline.input_value()=='저장 중 새 요점\n두 번째 줄'
   assert outline.evaluate('e=>e===retainedInput&&document.activeElement===e&&e.selectionStart===4')
   assert page.evaluate('docs.get(a).dirty')
   # Switch the actual service/date dropdown away and back, then save the retained draft.
   service=page.locator('[data-bulletin-service]');service.select_option(page.evaluate('b'));page.wait_for_function('docs.get(b)?.dbLoaded')
   service.select_option(page.evaluate('a'));page.wait_for_function("document.querySelector('[data-bulletin-field=outline]')?.disabled===false")
   assert outline.input_value()=='저장 중 새 요점\n두 번째 줄'
   outline.press('Control+s');page.wait_for_function('sent.length===2');page.evaluate('respond[1](false)');page.wait_for_function('!docs.get(a).saving')
   assert outline.input_value()=='저장 중 새 요점\n두 번째 줄' and page.evaluate('docs.get(a).dirty')
   outline.press('Control+s');page.wait_for_function('sent.length===3');page.evaluate('respond[2](true)');page.wait_for_function('!docs.get(a).dirty')
   assert page.evaluate('store[a].content.fields.outline')=='저장 중 새 요점\n두 번째 줄'
   # Exercise an actual assigned-person input, not just textarea editing.
   page.locator('details[data-bulletin-section=weekly] summary').click();leader=page.locator('[data-bulletin-field=leader]');leader.fill('새 인도자');leader.press('Tab')
   assert page.evaluate('docs.get(a).fields.leader')=='새 인도자'
   click_save(page,4);page.evaluate('respond[3](true)');page.wait_for_function('!docs.get(a).dirty')
   assert page.evaluate('store[a].content.fields.leader')=='새 인도자'
   # The shared-template editor remains editable while its own request is pending.
   page.locator('[data-bulletin-template-edit]').click();page.wait_for_function("!document.querySelector('[data-bulletin-template-exit]').hidden")
   page.locator('[data-bulletin-mode=content]').click();welcome=page.locator('[data-bulletin-field=welcome]');welcome.fill('저장할 공통 환영');welcome.press('Control+s');page.wait_for_function('sent.length===5')
   assert page.evaluate('sent[4].table')=='mindex_bulletin_templates'
   welcome.fill('저장 중 새 공통 환영');welcome.evaluate('e=>{window.templateInput=e;e.setSelectionRange(5,5)}');page.evaluate('respond[4](true)')
   page.wait_for_function("!document.querySelector('[data-bulletin-save]').getAttribute('aria-busy')||document.querySelector('[data-bulletin-save]').getAttribute('aria-busy')==='false'")
   assert welcome.input_value()=='저장 중 새 공통 환영'
   assert welcome.evaluate('e=>e===templateInput&&document.activeElement===e&&e.selectionStart===5'),(engine,'template reply replaced active input/caret')
   # Exercise the real error adapter and DOM status, without exposing server details.
   for error,phrase in [({'code':'42501','message':'permission denied secret-token https://private.invalid'},'권한'),({'code':'23505','message':'duplicate secret-token'},'다른 곳'),({'message':'Failed to fetch https://private.invalid?token=secret-token'},'서버 응답'),({'code':'XX000','message':'internal secret-token sql relation private'},'실패')]:
    n=page.evaluate('sent.length');welcome.focus();welcome.fill('실패 뒤 유지할 공통 문구');welcome.evaluate('e=>e.setSelectionRange(4,4)');welcome.press('Control+s')
    page.wait_for_function('(n)=>sent.length===n+1',arg=n);page.evaluate('([n,e])=>respond[n](e)',[n,error])
    page.wait_for_function("document.querySelector('[data-bulletin-save]').getAttribute('aria-busy')==='false'")
    status=page.locator('.bulletin-status');assert phrase in status.inner_text(),status.inner_text()
    assert status.get_attribute('data-state')=='error' and 'secret-token' not in page.locator('body').inner_text()
    assert welcome.input_value()=='실패 뒤 유지할 공통 문구' and welcome.evaluate('e=>document.activeElement===e&&e.selectionStart===4')
    welcome.press('Control+s');page.wait_for_function('(n)=>sent.length===n+2',arg=n);page.evaluate('(n)=>respond[n+1](true)',n)
    page.wait_for_function("document.querySelector('[data-bulletin-save]').getAttribute('aria-busy')==='false'")
    assert page.evaluate('template.common.welcome')=='실패 뒤 유지할 공통 문구'
   assert page.evaluate('store[a].content.fields.outline')=='저장 중 새 요점\n두 번째 줄'
   # Rejected transport promises must also reach the actual load UI in safe language.
   page.evaluate("editor.destroy();docs.clear();window.readFailure={message:'Failed to fetch https://private.invalid?token=secret-token'};window.editor=MindexBulletin.mount(host,{documents:docs,scope:'bulletin-read-error',serviceId:a,services:[{id:a,label:'11/1 청년부'}],loadSource:async id=>structuredClone(sources[id]),loadDraft:loadBulletinDraft,saveDraft:saveBulletinDraft})")
   page.wait_for_function("document.querySelector('.bulletin-status')?.dataset.state==='error'")
   assert '서버 응답' in page.locator('.bulletin-status').inner_text()
   assert 'secret-token' not in page.locator('body').inner_text()
   page.evaluate('window.readFailure=null;editor.reload()');page.wait_for_function('docs.get(a)?.dbLoaded')
   assert page.locator('[data-bulletin-field=outline]').input_value()=='저장 중 새 요점\n두 번째 줄'
   assert page.locator('iframe.bulletin-print-frame').count()==0
   print('PASS',engine,'actual app adapters: weekly late edit/caret, service/date return, failed CAS save/retry, assignee input, template late typing; production writes/print 0',flush=True)
   context.close();browser.close()
finally:server.shutdown()
