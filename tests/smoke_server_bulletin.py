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
    if(typeof renderServiceSourceRecovery!=='undefined')throw Error('retired source recovery UI remains');
    if(await restoreServiceSourceText(service.id,'same source'))throw Error('identical source restored');
    if(!await restoreServiceSourceText(service.id,'other source'))throw Error('source restore failed');
    return area.value==='other source'&&MINDEX_SERVER_STORAGE.keys('local').some(k=>k.startsWith('mindex.source.recovery.v1:')&&JSON.parse(MINDEX_SERVER_STORAGE.getItem('local',k)).current==='same source');
   }""")
   # Read-only canonical adoption must not create recovery/server-draft writes.
   page.evaluate("""()=>{
    editor.destroy();const B=MindexBulletin;window.readCache=new Map();window.readWrites=[];window.readQueues=[];window.readPublications=[];
    window.MINDEX_SERVER_STORAGE={ready:true,getItem:(_,k)=>window.holdReadConfirmation&&readQueues.includes(k)?null:readCache.get(k),keys:()=>[...readCache.keys()],setItem:async(_,k,v)=>{readWrites.push(k);if(window.rejectReadWrites)throw Error('Unnecessary recovery write');readCache.set(k,v)},queue:(_,k,v)=>{readQueues.push(k);readCache.set(k,v);return true}};
    window.MINDEX_DRAFT_HANDOFF={publish:(...args)=>readPublications.push(args)};
    window.readSource=B.resolveSource({service:{id:'read-only',service_type_id:'young_adult',service_date:'2026-11-29'},sections:[],elements:[]});
    window.readRow={revision:7,...B.storedValue({...B.normalizeSnapshot({fields:{news:'Saved weekly',leader:''},settings:{design:'simple',theme:''}}),source:readSource})};
    const saved={};B.applyStored(saved,readRow);window.savedRead=structuredClone(B.normalizeSnapshot(saved));
    window.readTemplate={template_key:B.TEMPLATE_KEY,revision:1,...B.templateValue({...savedRead,source:readSource})};
    window.readKey='mindex.bulletin.v1:read-only:read-only';
    readCache.set(readKey+':draft:old',JSON.stringify({version:3,...savedRead,savedAt:1}));
    window.rejectReadWrites=true;window.readHost=document.createElement('div');readHost.style.height='800px';document.body.replaceChildren(readHost);
    window.mountRead=()=>{window.readDocs=new Map();window.readEditor=B.mount(readHost,{documents:readDocs,serviceId:'read-only',scope:'read-only',services:[{id:'read-only',label:'저장된 주보'}],loadDraft:async()=>structuredClone(readRow),loadSource:async()=>structuredClone(readSource),loadTemplate:async()=>structuredClone(readTemplate),saveTemplate:async()=>{throw Error('Unexpected template commit')},saveDraft:async()=>{throw Error('Unexpected commit')}})};mountRead();
   }""")
   page.wait_for_function("readDocs.get('read-only')?.dbLoaded&&document.querySelector('[data-bulletin-reload]')?.disabled===false")
   assert page.evaluate("!readDocs.get('read-only').dirty&&readDocs.get('read-only').revision===7&&readWrites.length===0&&readQueues.length===0&&readPublications.length===0")
   assert page.locator('[data-bulletin-save]').is_disabled()
   # A newer remote save is a read too, while an actual input still queues/publishes.
   page.evaluate("readRow.revision=8;readRow.content.fields.news='Remote saved weekly'")
   assert page.evaluate("()=>readEditor.refreshRemote('bulletin','read-only')") is True
   assert page.evaluate("readDocs.get('read-only').fields.news==='Remote saved weekly'&&!readDocs.get('read-only').dirty&&readWrites.length===0&&readQueues.length===0&&readPublications.length===0")
   page.evaluate('window.holdReadConfirmation=true')
   page.locator('[data-bulletin-field=news]').fill('Actual unsaved input')
   assert page.evaluate("readDocs.get('read-only').dirty&&readQueues.length===1&&readPublications.length===1")
   page.locator('[data-bulletin-field=news]').blur()
   assert page.evaluate("()=>readEditor.refreshRemote('bulletin','read-only')") is False
   assert page.locator('[data-bulletin-field=news]').input_value()=='Actual unsaved input'
   # Simulate a canonical save settling before its private queue acknowledgement.
   # A newer remote row must not strand the earlier backup's pending status.
   page.evaluate("readDocs.get('read-only').dirty=false;readRow.revision=9;readRow.content.fields.news='Remote saved weekly'")
   assert page.evaluate("()=>readEditor.refreshRemote('bulletin','read-only')") is True
   assert page.evaluate("readDocs.get('read-only').backupPending&&readQueues.length===1&&readPublications.length===1")
   page.evaluate("window.holdReadConfirmation=false;window.dispatchEvent(new Event('mindex-server-state-settled'))")
   assert page.evaluate("!readDocs.get('read-only').backupPending&&readDocs.get('read-only').fields.news==='Remote saved weekly'")
   # Different old drafts still need confirmed recovery and remain available after load.
   page.evaluate("""()=>{readEditor.destroy();readCache.clear();readWrites.length=0;readQueues.length=0;readPublications.length=0;rejectReadWrites=false;readCache.set(readKey+':draft:different',JSON.stringify({version:3,...savedRead,fields:{...savedRead.fields,news:'Different preserved draft'},savedAt:2}));mountRead()}""")
   page.wait_for_function("readDocs.get('read-only')?.dbLoaded&&document.querySelector('[data-bulletin-reload]')?.disabled===false")
   assert page.evaluate("readWrites.length===2&&readQueues.length===0&&readPublications.length===0&&!readDocs.get('read-only').dirty&&JSON.parse(readCache.get(readKey+':recovery')).fields.news==='Different preserved draft'")
   assert page.locator('[data-bulletin-field=news]').input_value()=='Remote saved weekly'
   page.locator('[data-bulletin-local]').click()
   assert 'Different preserved draft' in page.get_by_label('복구할 내용',exact=True).input_value()
   page.get_by_role('button',name='닫기',exact=True).click()
   # The same no-write guarantee applies to a remote common-template revision.
   page.locator('[data-bulletin-template-edit]').click()
   page.wait_for_function("readEditor.remoteIdentity()?.kind==='bulletin-template'&&document.querySelector('[data-bulletin-save]')?.disabled")
   page.evaluate("readTemplate.revision=2;readTemplate.common.welcome='Remote common welcome'")
   assert page.evaluate("()=>readEditor.refreshRemote('bulletin-template',MindexBulletin.TEMPLATE_KEY)") is True
   assert page.evaluate("readWrites.length===2&&readQueues.length===0&&readPublications.length===0")
   assert page.locator('[data-bulletin-save]').is_disabled()
   page.locator('[data-bulletin-mode=content]').click()
   page.locator('[data-bulletin-field=welcome]').fill('Actual common edit')
   assert page.evaluate("readQueues.length===1&&readPublications.length===1&&readPublications[0][0]==='bulletin-template'")
   print('PASS',engine,'failed recovery blocks replacement; late edit retained; paired draft revision guard and explicit resume; identical entry + remote weekly/template writes 0, real edits preserved',flush=True)
   context.close();browser.close()
finally:server.shutdown()
