"""Offline actual inline clicks, atomic failure/late receipt and independent drafts."""
import os
import tempfile
from pathlib import Path
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from urllib.parse import urlsplit
from smoke_app import (start_local_app_server, sync_playwright, launch_chromium,
                       prepare_server_state_fixture)

FIXTURE = r"""async()=>{
// This fixture supplies the legacy atomic protocol; native activation has its own smoke.
                      globalThis.MINDEX_SINGLE_SONG_BOOTSTRAP_READY=false;
                      const check=(ok,msg)=>{if(!ok)throw Error(msg)};
                      const sid=crypto.randomUUID();
                      const service={id:sid,type_id:'fixture',date:'2026-10-12',title:'Fixture',_worshipSourceRef:{}};
                      state.services=[service]; state.selectedServiceId=sid;state.songs=[];
                      state.dirty.service=false;state.dirtyServiceElementIds.clear();state.dirtyServiceStructureIds.clear();
                      state.loadedWorshipServiceIds=new Set([sid]);state.templateElementSuppressions.clear();
                      state.serviceAliasSupported=true;
                      const items=['First','Second','Third'].map((title,i)=>normalizeServiceItem({
                        id:crypto.randomUUID(),service_id:sid,label:i===2?'설교':i?'대표기도':'광고',raw_title:title,
                        _worshipSectionKey:i===2?'sermon':i?'prayer':'announcements',_worshipSectionTitle:i===2?'설교':i?'대표기도':'광고',
                        _worshipSlotKey:'test.'+i,_worshipElementTemplateModified:true,
                        memo:serializeServiceItemMemo({elementType:i?'title_person':'body',inputMode:'text'})},i));
                      const typed={inputMode:true,contentState:true};
                      worshipElementTypedStateColumns=async()=>typed;

                      const rows=buildWorshipPersistenceRows(service,items,{}, {},{elementTypedStateColumns:typed});
                      sanitizeWorshipPersistenceRows(rows,{elementTypedStateColumns:typed});compactWorshipPersistenceRows(rows);
                      state.worshipSections=structuredClone(rows.sections);state.worshipElements=structuredClone(rows.elements);
                      state.serviceItems={[sid]:groupWorshipElements(rows.sections,rows.elements)[sid]};
                      const initial={serviceId:sid,serviceTypeId:'fixture',serviceDate:service.date,
                        metadataPatch:{title:'Fixture'},
                        sections:rows.sections.map(({id,service_id,created_at,updated_at,...patch})=>({id,patch})),
                        elements:rows.elements.map(({id,section_id,created_at,updated_at,...patch})=>({id,sectionId:section_id,patch})),
                        document:buildServiceDocumentSnapshot(service,state.serviceItems[sid])};
                      let db={revision:'1',service:{id:sid,service_type_id:'fixture',service_date:service.date,title:'Fixture',source_ref:{mindexServiceDocument:initial.document}},
                        ...structuredClone(rows),slides:[]};
                      service._worshipSourceRef=structuredClone(db.service.source_ref);
                      const writes=[];window.inlineFixture={sid,writes,failure:false,delay:false,release:null,attempts:0};
                      state.client={from(){throw Error('Legacy table write attempted')},rpc:async(name,{sid:readId,req})=>{
                        if(name==='get_worship_service_v1')return {data:structuredClone(db)};
                        check(name==='save_worship_service_v1','wrong RPC');
                        inlineFixture.attempts++;
                        if(inlineFixture.delay)await new Promise(resolve=>inlineFixture.release=resolve);
                        if(inlineFixture.failure)return {error:{code:'P0001',message:'INJECTED_FAILURE'}};
                        check(req.expectedRevision===db.revision,'stale token');writes.push(structuredClone(req));
                        for(const [key,patches] of [['sections',req.sectionPatches],['elements',req.elementPatches]]) {
                          for(const change of patches){const row=db[key].find(x=>x.id===change.id);Object.assign(row,change.patch);
                            for(const [field,keys] of Object.entries(change.removeKeys||{}))for(const key of keys)delete row[field][key];}
                        }
                        db.sections.push(...req.newSections.map(x=>({id:x.id,service_id:sid,...x.patch})));
                        db.elements.push(...req.newElements.map(x=>({id:x.id,section_id:x.sectionId,...x.patch})));
                        for(const move of req.elementMoves)db.elements.find(x=>x.id===move.id).section_id=move.sectionId;
                        db.elements=db.elements.filter(x=>!req.deleteElementIds.includes(x.id));
                        db.sections=db.sections.filter(x=>!req.deleteSectionIds.includes(x.id));
                        Object.assign(db.service,req.metadataPatch);
                        db.service.source_ref={...db.service.source_ref,mindexServiceDocument:req.document};
                        db.revision=String(Number(db.revision)+1);

                        return {data:{aggregate:structuredClone(db),committedRevision:db.revision,replayed:false}};
                      }};
                      const client=await worshipAtomicClient();await client.read(sid);

                      state.module='presenter';state.serviceTypes=[{id:'fixture',name:'검증 예배'}];state.serviceError='';state.connectionError='';state.search='';
                      document.body.dataset.module='presenter';document.body.classList.remove('ui-booting');
                      renderServiceList();renderPresenterDetail();

                      inlineFixture.ids=state.serviceItems[sid].map(item=>item.id);
                      inlineFixture.db=()=>structuredClone(db);
                      inlineFixture.output=JSON.stringify(state.presenter);
                      inlineFixture.selection=JSON.stringify(state.presenterBoardSelection);
                      inlineFixture.audio={currentTime:42,paused:false};
                      state.serviceMusic.audio=inlineFixture.audio;state.serviceMusic.playing=true;
                      state.serviceMusic.sourceKey='fixture.wav';state.serviceMusic.ownerServiceId=sid;
                      state.serviceMusic.mode='presenter-audio';state.serviceMusic.timingGroupId='group';
                      state.serviceMusic.autoSyncSuspended=true;
                      inlineFixture.music=JSON.stringify({...state.serviceMusic,audio:null});
                      inlineFixture.checkQuiet=()=>{
                        check(JSON.stringify(state.presenter)===inlineFixture.output,'editor changed output');
                        check(JSON.stringify(state.presenterBoardSelection)===inlineFixture.selection,'editor changed board selection');
                        check(state.serviceMusic.audio===inlineFixture.audio&&inlineFixture.audio.currentTime===42,'editor replaced/moved audio');
                        check(JSON.stringify({...state.serviceMusic,audio:null})===inlineFixture.music,'editor changed music ownership');
                        check(!window.forbiddenActions.length,'output/audio/print action attempted');
                      };
                      inlineFixture.assert=(ok,msg)=>check(ok,msg);
                      return {sid,ids:inlineFixture.ids};

}"""


def exercise(page, url, engine):
    # Every external GET and every network write is blocked, including production.
    page.route('**/*', lambda route: route.continue_() if
               urlsplit(route.request.url).netloc == urlsplit(url).netloc and
               route.request.method in ('GET', 'HEAD') else route.abort())
    page.route('**/mindex-release.json*', lambda route: route.fulfill(json={'version': 'inline-source-test'}))
    page.add_init_script("""window.forbiddenActions=[];
      window.open=()=>{forbiddenActions.push('open');return null};
      window.print=()=>forbiddenActions.push('print');
      HTMLMediaElement.prototype.play=function(){forbiddenActions.push('play');return Promise.resolve()};
      HTMLMediaElement.prototype.pause=function(){forbiddenActions.push('pause')};""")
    page.goto(url + '?mindexSmokeRaw=1')
    page.wait_for_function("typeof renderPresenterInlineEditor==='function' && !document.body.classList.contains('ui-booting')")
    prepare_server_state_fixture(page)
    data = page.evaluate(FIXTURE)
    sid, ids = data['sid'], data['ids']
    def panel(i):
        return page.locator(f'.svc-outline-editor[data-inline-item-id="{ids[i]}"][data-service-id="{sid}"]')
    def toggle(i):
        return page.locator(f'[data-presenter-inline-toggle="{ids[i]}"]')
    def field(i, label):
        return panel(i).locator(f'[data-presenter-preparation-field-label="{label}"]')
    def check(script):
        page.evaluate('()=>{const check=inlineFixture.assert;' + script + ';inlineFixture.checkQuiet()}')
    def settled():
        page.wait_for_function('!presenterInlineInputSaves.size && !state.saving')

    assert page.locator('[data-presenter-order-toggle]').count() == 0, 'old disclosure remains'
    assert page.locator('[data-presenter-inline-toggle]').count() == 3
    assert all(not panel(i).is_visible() for i in range(3)), 'editors start expanded'
    toggle(0).click()
    check("""const panel=document.querySelector('.svc-outline-editor:not([hidden])');
      const row=panel.parentElement.querySelector('.service-outline-row');
      check(row&&panel.getBoundingClientRect().top>=row.getBoundingClientRect().bottom-1,'editor not BELOW row');""")
    field(0, '광고').fill('첫 번째 초안')
    toggle(2).focus()
    page.keyboard.press('Enter')
    assert panel(0).is_visible() and panel(2).is_visible(), 'opening another row lost first editor'
    field(2, '설교 제목').fill('사랑 / 믿음')
    field(2, '설교자').fill('김민수 목사')
    field(2, '설교 제목').focus()
    check("""window.retainedInline=document.activeElement;retainedInline.setSelectionRange(2,4);
      retainedInline.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'믿'}));
      renderServiceList();renderPresenterDetail();renderPresenterControlState(state.selectedServiceId);
      check(document.activeElement===retainedInline&&retainedInline.value==='사랑 / 믿음'&&retainedInline.selectionStart===2&&retainedInline.selectionEnd===4,'refresh lost IME/caret');
      retainedInline.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'믿음'}));""")
    toggle(0).click()
    toggle(0).focus()
    page.keyboard.press('Space')
    assert field(0, '광고').input_value() == '첫 번째 초안', 'close/reopen lost row draft'
    check("""const other={id:crypto.randomUUID(),type_id:'fixture',date:'2026-10-13',title:'Other'};
      state.services.push(other);state.serviceItems[other.id]=[];state.loadedWorshipServiceIds.add(other.id);
      state.selectedServiceId=other.id;renderServiceList();renderPresenterDetail();
      state.selectedServiceId=inlineFixture.sid;renderServiceList();renderPresenterDetail();""")
    assert field(0, '광고').input_value() == '첫 번째 초안'
    assert field(2, '설교 제목').input_value() == '사랑 / 믿음'
    assert field(2, '설교자').input_value() == '김민수 목사'

    for sidebar_width in (250, 320):
        page.evaluate('''width=>{
          const sidebar=document.querySelector('.service-sidebar--presenter');
          document.querySelector('.app-shell').style.setProperty('--shell-left-w',(width+30)+'px');
          sidebar.style.width=width+'px';sidebar.style.minWidth=width+'px';sidebar.style.maxWidth=width+'px';
          inlineFixture.assert(Math.abs(sidebar.getBoundingClientRect().width-width)<1,'sidebar width fixture not applied');
          for(const panel of sidebar.querySelectorAll('.svc-outline-editor:not([hidden])')) {
            inlineFixture.assert(panel.scrollWidth<=panel.clientWidth+1,'narrow inline editor overflow');
            for(const field of panel.querySelectorAll('[data-presenter-preparation-field]')) {
              const f=field.getBoundingClientRect(),p=panel.getBoundingClientRect();
              inlineFixture.assert(f.width>0&&f.left>=p.left&&f.right<=p.right+1,'narrow field clipped');
            }
          }
          inlineFixture.checkQuiet();
        }''', sidebar_width)
        if sidebar_width == 320:
            panel(2).scroll_into_view_if_needed()
            page.screenshot(path=str(Path(tempfile.gettempdir()) / f'inline-editor-final-{engine}.png'))
    page.evaluate("document.querySelector('.service-sidebar--presenter').removeAttribute('style');document.querySelector('.app-shell').style.removeProperty('--shell-left-w')")
    page.evaluate('inlineFixture.failure=true')
    panel(2).locator('[data-presenter-inline-apply]').click()
    settled()
    assert panel(2).is_visible(), 'failure collapsed editor'
    assert field(2, '설교 제목').input_value() == '사랑 / 믿음', 'failed save lost draft'
    check("check(inlineFixture.attempts===1&&inlineFixture.writes.length===0,'failure did not reach atomic RPC')")
    page.evaluate('inlineFixture.failure=false;inlineFixture.delay=true')
    panel(2).locator('[data-presenter-inline-apply]').click()
    page.wait_for_function('typeof inlineFixture.release==="function"')
    assert panel(2).is_visible(), 'unconfirmed save collapsed editor'
    assert panel(2).locator('[data-presenter-inline-apply]').is_disabled()
    field(2, '설교 제목').fill('저장 중 새 제목')
    page.evaluate('inlineFixture.delay=false;inlineFixture.release()')
    settled()
    assert panel(2).is_visible(), 'late receipt collapsed newer input'
    assert field(2, '설교 제목').input_value() == '저장 중 새 제목', 'late receipt replaced newer input'
    assert field(0, '광고').input_value() == '첫 번째 초안', 'another row save lost local draft'
    check("""const db=inlineFixture.db();check(inlineFixture.writes.length===1,'retry count');
      const items=groupWorshipElements(db.sections,db.elements)[inlineFixture.sid];
      const sermon=items.find(item=>item.label==='설교');
      check(sermon.raw_title==='사랑 / 믿음'&&sermon.assignee==='김민수 목사','atomic normalization mixed title/person');
      check(!JSON.stringify(db).includes('첫 번째 초안'),'saved another row pending draft');""")
    panel(2).locator('[data-presenter-inline-apply]').click()
    settled()
    assert not panel(2).is_visible(), 'confirmed unchanged input did not collapse'
    assert panel(0).is_visible() and field(0, '광고').input_value() == '첫 번째 초안'
    toggle(2).click()
    assert field(2, '설교 제목').input_value() == '저장 중 새 제목'
    check("""const db=inlineFixture.db();
      check(JSON.stringify(db).includes('저장 중 새 제목'),'confirmed save missing final input');
      check(inlineFixture.writes.length===2,'unexpected duplicate writes');""")
    page.unroute_all(behavior='wait')


server, url = start_local_app_server()
try:
    with sync_playwright() as playwright:
        for engine in ('chromium', 'webkit'):
            browser = launch_chromium(playwright) if engine == 'chromium' else playwright.webkit.launch()
            try:
                exercise(browser.new_page(viewport={'width': 1440, 'height': 900}), url, engine)
                print(engine, 'PASS inline pointer/keyboard, drafts/IME/caret, atomic failure/retry/late receipt, quiet output/audio', flush=True)
            finally:
                browser.close()
finally:
    server.shutdown()
