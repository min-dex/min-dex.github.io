"""Bulletin real DOM + app DB adapters: late saves, service return and template typing."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium,prepare_server_state_fixture
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
      if(!patch)return Promise.resolve({data:structuredClone(current),error:null});
      return new Promise(resolve=>{sent.push({table,id,key,value:structuredClone(patch),expected:filters.revision});respond.push(ok=>{
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
   page.locator('[data-bulletin-save]').click();page.wait_for_function('sent.length===4');page.evaluate('respond[3](true)');page.wait_for_function('!docs.get(a).dirty')
   assert page.evaluate('store[a].content.fields.leader')=='새 인도자'
   # The shared-template editor remains editable while its own request is pending.
   page.locator('[data-bulletin-template-edit]').click();page.wait_for_function("!document.querySelector('[data-bulletin-template-exit]').hidden")
   page.locator('[data-bulletin-mode=content]').click();welcome=page.locator('[data-bulletin-field=welcome]');welcome.fill('저장할 공통 환영');welcome.press('Control+s');page.wait_for_function('sent.length===5')
   assert page.evaluate('sent[4].table')=='mindex_bulletin_templates'
   welcome.fill('저장 중 새 공통 환영');welcome.evaluate('e=>{window.templateInput=e;e.setSelectionRange(5,5)}');page.evaluate('respond[4](true)')
   page.wait_for_function("!document.querySelector('[data-bulletin-save]').getAttribute('aria-busy')||document.querySelector('[data-bulletin-save]').getAttribute('aria-busy')==='false'")
   assert welcome.input_value()=='저장 중 새 공통 환영'
   assert welcome.evaluate('e=>e===templateInput&&document.activeElement===e&&e.selectionStart===5'),(engine,'template reply replaced active input/caret')
   assert page.evaluate('store[a].content.fields.outline')=='저장 중 새 요점\n두 번째 줄'
   assert page.locator('iframe.bulletin-print-frame').count()==0
   print('PASS',engine,'actual app adapters: weekly late edit/caret, service/date return, failed CAS save/retry, assignee input, template late typing; production writes/print 0',flush=True)
   context.close();browser.close()
finally:server.shutdown()
