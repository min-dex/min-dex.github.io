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
   assert page.evaluate('()=>editor.restoreHandoff({...incoming,revision:2})') is True
   assert page.evaluate("docs.get('bulletin-fixture').revision")==1
   assert page.evaluate("()=>MINDEX_SERVER_STORAGE.keys('local').some(k=>k.includes(':handoff-recovery:'))")
   assert page.evaluate("docs.get('bulletin-fixture').fields.news")=='From paired device'
   assert page.evaluate("docs.get('bulletin-fixture').dirty") is True
   page.evaluate("""async()=>{
    const d=docs.get('bulletin-fixture');window.keptCurrent=d.fields.news;
    await originalSet('local',d.key+':recovery',JSON.stringify({version:3,...MindexBulletin.normalizeSnapshot({...d,fields:{...d.fields,news:'Earlier draft'}}),savedAt:1}));
    window.dispatchEvent(new Event('mindex-server-state-settled'));
   }""")
   page.locator('[data-bulletin-local]').click()
   select=page.get_by_label('복구할 주보 초안',exact=True)
   for option in select.locator('option').all():
    select.select_option(option.get_attribute('value'))
    if 'Earlier draft' in page.get_by_label('복구할 내용',exact=True).input_value():break
   assert 'Earlier draft' in page.get_by_label('복구할 내용',exact=True).input_value()
   for width in (1000,390):
    page.set_viewport_size({'width':width,'height':900})
    assert page.locator('.editor-draft-review').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
    page.screenshot(path=f'/tmp/bulletin-recovery-{engine}-{width}.png')
   page.evaluate('window.failRecovery=true')
   page.get_by_role('button',name='편집창에 복구',exact=True).click()
   page.wait_for_function("document.querySelector('.editor-draft-review [role=status]').textContent.includes('Recovery unavailable')")
   assert page.evaluate("docs.get('bulletin-fixture').fields.news===keptCurrent")
   page.evaluate('window.failRecovery=false')
   page.get_by_role('button',name='편집창에 복구',exact=True).click()
   page.wait_for_function("docs.get('bulletin-fixture').fields.news==='Earlier draft'")
   page.locator('.editor-draft-review').wait_for(state='detached')
   assert page.evaluate("()=>MINDEX_SERVER_STORAGE.keys('local').some(k=>k.includes(':recovery:')&&JSON.parse(MINDEX_SERVER_STORAGE.getItem('local',k)).fields?.news===keptCurrent)")
   await_flush=page.evaluate('()=>MINDEX_SERVER_STORAGE.flush()')
   assert page.evaluate("()=>JSON.parse(MINDEX_SERVER_STORAGE.getItem('local',docs.get('bulletin-fixture').sessionDraftKey)).fields.news==='Earlier draft'")
   page.locator('[data-bulletin-local]').click()
   select=page.get_by_label('복구할 주보 초안',exact=True)
   for option in select.locator('option').all():
    select.select_option(option.get_attribute('value'))
    assert 'Earlier draft' not in page.get_by_label('복구할 내용',exact=True).input_value()
   page.get_by_role('button',name='닫기',exact=True).click()
   assert page.evaluate("""async()=>{
    const area=document.createElement('textarea');area.dataset.serviceSourceText='source-fixture';area.value='same source';refs.detailPane.append(area);
    const service={id:'source-fixture',_worshipSourceTextDraft:'same source'};state.services=[service];
    await originalSet('local',worshipRecoveryLatestSnapshotKey(service.id),JSON.stringify({serviceId:service.id,serviceDocument:{sourceText:'same source'}}));
    if(renderServiceSourceRecovery(service).includes('data-service-source-recovery='))throw Error('identical source offered');
    if(await restoreServiceSourceText(service.id,'same source'))throw Error('identical source restored');
    if(!await restoreServiceSourceText(service.id,'other source'))throw Error('source restore failed');
    return area.value==='other source'&&MINDEX_SERVER_STORAGE.keys('local').some(k=>k.startsWith('mindex.source.recovery.v1:')&&JSON.parse(MINDEX_SERVER_STORAGE.getItem('local',k)).current==='same source');
   }""")
   print('PASS',engine,'failed recovery blocks replacement; late edit retained; paired draft revision guard and explicit resume',flush=True)
   context.close();browser.close()
finally:server.shutdown()
