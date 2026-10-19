"""Private bulletin recovery must confirm before replacing an edited document."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium,prepare_server_state_fixture
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   context=browser.new_context();context.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page=context.new_page();page.goto(url+'?mindexSmokeRaw=1')
   page.wait_for_function("!!window.MindexBulletin&&!document.body.classList.contains('ui-booting')")
   prepare_server_state_fixture(page)
   page.evaluate('''()=>{
    const B=MindexBulletin;window.docs=new Map();window.draftReads=0;
    window.source=B.resolveSource({service:{id:'bulletin-fixture',service_type_id:'children',service_date:'2026-10-04'},sections:[],elements:[]});
    window.row={revision:1,...B.storedValue({...B.normalizeSnapshot({fields:{news:'Committed'},settings:{design:'simple'}}),source})};
    const host=document.createElement('div');document.body.append(host);
    window.editor=B.mount(host,{documents:docs,serviceId:'bulletin-fixture',scope:'fixture',services:[{id:'bulletin-fixture',label:'Fixture'}],
     loadDraft:async()=>{draftReads++;return structuredClone(row)},loadSource:async()=>structuredClone(source),saveDraft:async()=>{throw Error('Unexpected commit')}});
    window.originalSet=MINDEX_SERVER_STORAGE.setItem;
    MINDEX_SERVER_STORAGE.setItem=async(scope,key,value)=>{
     if(key.endsWith(':recovery')){
      if(window.failRecovery)throw Error('Recovery unavailable');
      if(window.delayRecovery)await new Promise(resolve=>window.releaseRecovery=resolve);
     }
     return originalSet(scope,key,value);
    };
   }''')
   page.wait_for_function("docs.get('bulletin-fixture')?.dbLoaded && !document.querySelector('[data-bulletin-reload]').disabled")
   page.evaluate("()=>{const d=docs.get('bulletin-fixture');d.fields.news='Unsaved';d.dirty=true;window.failRecovery=true}")
   reads=page.evaluate('draftReads');page.locator('[data-bulletin-reload]').click()
   page.wait_for_function("document.querySelector('.bulletin-status').textContent.includes('Recovery unavailable')")
   assert page.evaluate('draftReads')==reads
   assert page.evaluate("docs.get('bulletin-fixture').fields.news")=='Unsaved'
   page.evaluate('window.failRecovery=false;window.delayRecovery=true')
   page.locator('[data-bulletin-reload]').click()
   page.wait_for_function('typeof releaseRecovery==="function"')
   page.evaluate("docs.get('bulletin-fixture').fields.news='Typed while preserving';window.delayRecovery=false;releaseRecovery()")
   page.wait_for_function("document.querySelector('.bulletin-status').textContent.includes('입력이 바뀌어')")
   assert page.evaluate("docs.get('bulletin-fixture').fields.news")=='Typed while preserving'
   assert page.evaluate("()=>{const key=docs.get('bulletin-fixture').key+':recovery';return JSON.parse(MINDEX_SERVER_STORAGE.getItem('local',key)).fields.news}")=='Unsaved'
   page.locator('[data-bulletin-reload]').click()
   page.wait_for_function("docs.get('bulletin-fixture').fields.news==='Committed'")
   assert page.evaluate("()=>{const key=docs.get('bulletin-fixture').key+':recovery';return JSON.parse(MINDEX_SERVER_STORAGE.getItem('local',key)).fields.news}")=='Typed while preserving'
   page.on('dialog',lambda d:d.accept())
   page.evaluate("window.delayRecovery=true;window.incoming={schema:1,revision:1,value:{fields:{news:'From paired device'},settings:{design:'simple'}}};window.resumeResult=editor.restoreHandoff(incoming);void 0")
   page.wait_for_function('typeof releaseRecovery==="function"')
   page.evaluate("docs.get('bulletin-fixture').fields.news='Late current edit';docs.get('bulletin-fixture').dirty=true;window.delayRecovery=false;releaseRecovery()")
   assert page.evaluate('resumeResult') is False
   assert page.evaluate("docs.get('bulletin-fixture').fields.news")=='Late current edit'
   page.evaluate("docs.get('bulletin-fixture').fields.news='Committed';docs.get('bulletin-fixture').dirty=false")
   assert page.evaluate('()=>editor.restoreHandoff({...incoming,revision:2})') is False
   assert page.evaluate('()=>editor.restoreHandoff(incoming)') is True
   assert page.evaluate("docs.get('bulletin-fixture').fields.news")=='From paired device'
   assert page.evaluate("docs.get('bulletin-fixture').dirty") is True
   print('PASS',engine,'failed recovery blocks replacement; late edit retained; paired draft revision guard and explicit resume',flush=True)
   context.close();browser.close()
finally:server.shutdown()
