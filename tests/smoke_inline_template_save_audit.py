"""Actual inline save handlers over real templates; only atomic transport is simulated."""
import ast,json,os
from pathlib import Path
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium,prepare_server_state_fixture
source=ast.parse(Path(__file__).with_name('smoke_presenter_inline_editor.py').read_text())
FIXTURE=next(n.value.value for n in source.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='FIXTURE' for t in n.targets))
FIXTURE=FIXTURE.replace('async()=>{','async config=>{',1).replace("const service={id:sid,type_id:'fixture',date:'2026-10-12',title:'Fixture',_worshipSourceRef:{}};", "const target=config.type==='friday'?autoFridayServiceTarget(config.date):{};const service={id:sid,type_id:target.typeId||config.type,date:config.date,title:'Fixture',_worshipSourceRef:target.sourceRef||{}};")
a=FIXTURE.index("const items=['First'");z=FIXTURE.index('const typed=',a)
FIXTURE=FIXTURE[:a]+"const scaffold=buildWorshipServiceScaffold(sid,service.type_id,{service});if(config.legacySlots){const prayers=scaffold.elements.filter(e=>e.source_ref.label==='기도');prayers.forEach((e,i)=>{e.source_ref.slotKey=config.legacySlots[i];e.person='Existing person '+i;e.body='Existing note '+i;e.source_ref.auditExtension='retained-'+i})}const items=groupWorshipElements(scaffold.sections,scaffold.elements)[sid]||[];\nfor(const item of items){\n if(!serviceItemRequiresSongSelection(item,service)||!String(item.raw_title||'').trim())continue;\n const id=crypto.randomUUID(),vid=crypto.randomUUID();\n state.songs.push({id,title:item.raw_title,_relationalVersionsLoaded:true,versions:[{id:vid,name:'Synthetic audit version',_worshipVersionPersisted:true,praise_types:['ccm'],forms:[{id:crypto.randomUUID(),label:'Lyrics',lyrics:'Synthetic audit lyrics',sort_order:1}]}]});\n item.song_id=id;item.version_id=vid;item.song_version_id=vid;\n}\nclearSearchCaches();\n"+FIXTURE[z:]
FIXTURE=FIXTURE.replace("serviceTypeId:'fixture'","serviceTypeId:service.type_id").replace("service_type_id:'fixture'","service_type_id:service.type_id").replace("[{id:'fixture',name:'검증 예배'}]","[{id:service.type_id,name:'검증 예배'}]")
FIXTURE=FIXTURE.replace('source_ref:{mindexServiceDocument:initial.document}', 'source_ref:{...service._worshipSourceRef,mindexServiceDocument:initial.document}')
FIXTURE=FIXTURE.replace("if(name==='get_worship_service_v1')return {data:structuredClone(db)};", "if(name==='get_worship_service_v1'){check(readId===sid,'aggregate read used another service');return {data:structuredClone(db)}}")

def holy_week_prayer_roundtrip(page, config):
    """Distinct repeated labels must retain separate identities through actual saves."""
    initial=page.evaluate("""()=>({sid:inlineFixture.sid,rows:inlineFixture.db().elements.filter(e=>e.source_ref.label==='기도'),targets:[...refs.songList.querySelectorAll('[data-preparation-role=assignee]')].filter(e=>/^기도[12]$/.test(e.dataset.presenterPreparationFieldLabel)).map(e=>({id:e.closest('.svc-outline-editor').dataset.inlineItemId,label:e.dataset.presenterPreparationFieldLabel}))})""")
    assert len(initial['targets'])==2 and len(initial['rows'])==2,initial
    assert [row['source_ref']['slotKey'] for row in initial['rows']]==config.get('legacySlots',['prayer.representative','response.prayer']),initial
    values=['검증 첫 기도 담당자','검증 둘째 기도 담당자']
    for target,value in zip(initial['targets'],values):
        page.locator('[data-presenter-inline-toggle="'+target['id']+'"]').click()
        page.locator('[data-inline-item-id="'+target['id']+'"] [data-presenter-preparation-field-label="'+target['label']+'"]').fill(value)
    for index,target in enumerate(initial['targets']):
        panel=page.locator('[data-inline-item-id="'+target['id']+'"]')
        panel.locator('[data-presenter-inline-apply]').click()
        page.wait_for_function('!presenterInlineInputSaves.size&&!state.saving')
        report=page.evaluate('({writes:inlineFixture.writes.length,db:inlineFixture.db(),quiet:forbiddenActions})')
        assert report['writes']==index+1,(config,page.evaluate("({toasts:[...document.querySelectorAll('.toast')].map(e=>e.textContent),prayers:getServiceItems(inlineFixture.sid).filter(i=>i.label==='기도').map(i=>({id:i.id,title:i.raw_title,person:i.assignee,slot:i._worshipSlotKey}))})"))
        assert not report['quiet'],report['quiet']
        assert not panel.is_visible(),(config,'confirmed row did not close',page.evaluate("({fields:[...refs.songList.querySelectorAll('[data-presenter-preparation-field]')].map(e=>({label:e.dataset.presenterPreparationFieldLabel,value:e.value,id:e.closest('.svc-outline-editor').dataset.inlineItemId})),items:getServiceItems(inlineFixture.sid).map(i=>({id:i.id,label:i.label,person:i.assignee,slot:i._worshipSlotKey})),draft:state.presenterPreparationDrafts[inlineFixture.sid]})"))
        by_id={row['id']:row for row in report['db']['elements']}
        for before in initial['rows']:
            after=by_id[before['id']]
            assert after['source_ref']['slotKey']==before['source_ref']['slotKey'],(config,before,after)
            if 'auditExtension' in before['source_ref']:
                assert after['source_ref']['auditExtension']==before['source_ref']['auditExtension'],(config,'source extension lost')
                assert after['body']==before['body'],(config,'legacy body lost')
        assert by_id[target['id']]['person']==values[index],(config,'wrong prayer saved')
        if index==0:
            second=initial['targets'][1]
            assert by_id[second['id']]['person']==initial['rows'][1]['person'],(config,'saved unrelated pending prayer')
            assert page.locator('[data-inline-item-id="'+second['id']+'"] [data-presenter-preparation-field]').input_value()==values[1],(config,'lost second draft')
    page.evaluate("async()=>{const id=inlineFixture.sid;state.loadedWorshipServiceIds.delete(id);await loadServiceItems(id);renderServiceList();renderPresenterDetail()}")
    for target,value in zip(initial['targets'],values):
        page.locator('[data-presenter-inline-toggle="'+target['id']+'"]').click()
        assert page.locator('[data-inline-item-id="'+target['id']+'"] [data-presenter-preparation-field-label="'+target['label']+'"]').input_value()==value,(config,'reload lost independent prayer')
    page.evaluate('inlineFixture.checkQuiet()')

failures=[]
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch();page=b.new_page(viewport={'width':1440,'height':900})
   page.route('**/*',lambda r:r.continue_() if r.request.method in ['GET','HEAD'] and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.route('**/mindex-release.json*',lambda r:r.fulfill(json={'version':'audit-source'}))
   page.add_init_script("window.forbiddenActions=[];window.open=()=>{forbiddenActions.push('open');return null};window.print=()=>forbiddenActions.push('print');HTMLMediaElement.prototype.play=function(){forbiddenActions.push('play');return Promise.resolve()};HTMLMediaElement.prototype.pause=function(){forbiddenActions.push('pause')}")
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof renderPresenterInlineEditor==='function'&&!document.body.classList.contains('ui-booting')")
   prepare_server_state_fixture(page)
   cases=page.evaluate("Object.keys(SERVICE_TYPE_DISPLAY_NAMES).filter(t=>!/[가-힣]/.test(t)).map(type=>({type,date:'2026-09-13'}))")
   cases += [{'type':'friday','date':d} for d in ['2026-08-07','2026-08-14','2026-08-21','2026-08-28','2026-09-04','2026-09-11','2026-09-18','2026-09-25']]
   cases += [dict(type='holy-week-dawn',date='2026-09-13',legacySlots=slots) for slots in [['prayer.representative','prayer.meeting.free'],['prayer.representative','prayer.representative']]]
   if os.environ.get('MINDEX_AUDIT_TYPE'):cases=[case for case in cases if case['type'] in os.environ['MINDEX_AUDIT_TYPE'].split(',')]
   for config in cases:
    page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof renderPresenterInlineEditor==='function'&&!document.body.classList.contains('ui-booting')")
    prepare_server_state_fixture(page)
    page.evaluate(FIXTURE,config)
    page.evaluate("inlineFixture.beforeItems=structuredClone(getServiceItems(inlineFixture.sid));inlineFixture.beforeDB=inlineFixture.db();document.querySelectorAll('.toast').forEach(e=>e.remove())")
    if config['type']=='holy-week-dawn' and config.get('legacySlots')!=['prayer.representative','prayer.representative']:
     holy_week_prayer_roundtrip(page,config)
     print(engine,config,'PASS both prayers atomic save/reload; IDs/slots/legacy data retained',flush=True);continue
    target=page.evaluate("""()=>{const fields=[...refs.songList.querySelectorAll('[data-presenter-preparation-field]')].filter(field=>field.dataset.serviceId===inlineFixture.sid);const field=fields.find(e=>e.dataset.preparationRole==='assignee')||fields.find(e=>!/찬양|찬송|특송|송영|성경|본문|인용/.test(e.dataset.presenterPreparationFieldLabel));return field?{label:field.dataset.presenterPreparationFieldLabel,role:field.dataset.preparationRole,id:field.closest('.svc-outline-editor').dataset.inlineItemId,serviceId:field.dataset.serviceId}:null}""")
    if not target:
     empty=page.evaluate('({noGathering:serviceIsNoGathering(state.services[0]),itemCount:getServiceItems(inlineFixture.sid).length,fields:[...document.querySelectorAll("[data-presenter-preparation-field]")].map(e=>({label:e.dataset.presenterPreparationFieldLabel,serviceId:e.dataset.serviceId})),attempts:inlineFixture.attempts,quiet:forbiddenActions})')
     assert config['type']=='special' or empty['noGathering'],(config,'unexpected missing editor',empty)
     assert not empty['fields'] and empty['attempts']==0 and not empty['quiet'],empty
     print(engine,config,'NO editable field (expected); no save claimed',empty,flush=True);continue
    panel=page.locator('[data-inline-item-id="'+target['id']+'"]');page.locator('[data-presenter-inline-toggle="'+target['id']+'"]').click()
    field=panel.locator('[data-presenter-preparation-field-label="'+target['label']+'"]');value='검증 담당자' if target['role']=='assignee' else '검증 본문 / 그대로'
    field.fill(value);panel.locator('[data-presenter-inline-apply]').click();page.wait_for_function('!presenterInlineInputSaves.size&&!state.saving')
    report=page.evaluate("""()=>({attempts:inlineFixture.attempts,writes:inlineFixture.writes.length,toasts:[...document.querySelectorAll('.toast')].map(e=>e.textContent),db:inlineFixture.db(),beforeDB:inlineFixture.beforeDB,quiet:forbiddenActions})""")
    if report['writes']!=1:
     assert panel.is_visible() and field.input_value()==value,(config,'blocked save lost pending draft')
     assert not report['quiet'],report['quiet']
     print(engine,config,'BLOCKED',target,report['toasts'],page.evaluate('getServiceItems(inlineFixture.sid).filter(i=>serviceItemSongSelectionInvalid(i,state.services[0])).map(i=>({label:i.label,title:i.raw_title,song:i.song_id,placeholder:i._worshipTemplatePlaceholder,modified:i._worshipElementTemplateModified}))'),flush=True)
     if config.get('legacySlots')==['prayer.representative','prayer.representative']:
      assert report['attempts']==0 and report['db']==report['beforeDB'],(config,'legacy duplicate reached RPC or changed DB')
      assert any('prayer.representative' in toast for toast in report['toasts']),report
      print(engine,config,'PASS legacy duplicate blocked without rewriting; draft retained',flush=True);continue
     failures.append({'engine':engine,'config':config,'target':target,'reason':'blocked','slotsBefore':[(e['id'],e.get('source_ref',{}).get('label'),e.get('source_ref',{}).get('slotKey')) for e in report['beforeDB']['elements']]})
     continue
    matches=[e for e in report['db']['elements'] if e['id']==target['id']]
    if not matches:
     detail={'engine':engine,'config':config,'target':target,'reason':'saved target missing','elements':report['db']['elements'],'before':report['beforeDB']['elements'],'items':page.evaluate('getServiceItems(inlineFixture.sid)')}
     failures.append(detail);print('MISSING TARGET',json.dumps(detail,ensure_ascii=False),flush=True);continue
    row=matches[0];key='person' if target['role']=='assignee' else ('body' if row.get('body')==value else 'title')
    assert row.get(key)==value,(config,target,row)
    assert not report['quiet'],report['quiet']
    assert not panel.is_visible(),(config,'confirmed save did not collapse')
    print(engine,config,'atomic persisted; reloading',flush=True)
    page.evaluate("async()=>{const id=inlineFixture.sid;state.loadedWorshipServiceIds.delete(id);await Promise.race([loadServiceItems(id),new Promise((_,reject)=>setTimeout(()=>reject(Error('audit reload timed out '+JSON.stringify({songs:state.songs.map(s=>({id:s.id,loaded:s._relationalVersionsLoaded})),linked:[...linkedSongLoadPromises.keys()]}))),10000))]);renderServiceList();renderPresenterDetail()}")
    page.locator('[data-presenter-inline-toggle="'+target['id']+'"]').click()
    assert field.input_value()==value,(config,'reload lost input')
    print(engine,config,'PASS actual save/reload',target['label'],flush=True)
   page.unroute_all(behavior='wait');b.close()
 if failures:
  print('AUDIT FAILURES',json.dumps(failures,ensure_ascii=False),flush=True)
  raise AssertionError(f'{len(failures)} template save failures')
finally:server.shutdown()
