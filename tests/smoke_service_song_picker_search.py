import os
os.environ["MINDEX_SMOKE_OFFLINE"] = "1"
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ('chromium', 'webkit'):
            browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
            try:
                page = browser.new_page(viewport={'width':1440,'height':1100})
                page.set_default_timeout(5000)
                page.route('**/*supabase*/**', lambda r:r.abort())
                page.goto(url, wait_until='domcontentloaded')
                page.wait_for_function("typeof scheduleServiceSongPickerPreview==='function' && !document.body.classList.contains('ui-booting')")
                page.evaluate('''() => {
                  state.config={...state.config,authRequired:false};state.client={};state.connectionError="";state.loading=false;
                  state.serviceTypes=[{id:'wednesday',name:'수요예배',fixed_items:[]}];
                  state.services=[{id:'picker-test',type_id:'wednesday',date:'2026-10-14'}];
                  state.serviceItems={'picker-test':[]};
                  state.songs=[
                    {id:'eph18',title:'성도들아 찬양하자',hymn_no:18,scripture:['에베소서 5:19'],versions:[]},
                    {id:'eph23',title:'만 입이 내게 있으면',hymn_no:23,scripture:['에베소서 5:19'],versions:[]},
                    {id:'range',title:'네 맘과 정성을 다하여서',hymn_no:218,scripture:['마태복음 22:37-39'],versions:[]}
                  ];
                  songCatalogLoaded=true;clearSearchCaches();state.module='service';
                  state.selectedServiceId='picker-test';state.selectedServiceTypeId='wednesday';
                  state.servicePrepEditorOpenId='picker-test';state.loadedWorshipServiceIds.add('picker-test');render();
                  window.beforeItems=JSON.stringify(getServiceItems('picker-test'));
                  window.beforePresenter=JSON.stringify(state.presenter);
                  window.savedSelections=[];
                  saveCommittedServiceItem=(index,id)=>savedSelections.push(getServiceItems(id)[index].song_id);
                }''')
                field = page.locator('.svc-prep-editor [data-service-item-field="raw_title"][data-service-item-index="1"]')
                buttons = page.locator('.svc-prep-editor [data-service-song-index="1"]')
                field.fill('엡 5:19')
                page.wait_for_function("document.querySelectorAll('.svc-prep-editor [data-service-song-index=\"1\"]').length===2")
                assert field.evaluate('(e)=>e===document.activeElement')
                assert page.evaluate("beforeItems===JSON.stringify(getServiceItems('picker-test')) && beforePresenter===JSON.stringify(state.presenter)")
                field.fill('마 22:38')
                page.wait_for_function("document.querySelector('[data-service-song-select=range]')!==null")
                assert buttons.count()==1
                field.fill('엡 5:19')
                page.wait_for_function("document.querySelectorAll('.svc-prep-editor [data-service-song-index=\"1\"]').length===2")
                page.locator('[data-service-song-select="eph18"]').click()
                assert page.evaluate("getServiceItems('picker-test')[1].song_id==='eph18' && savedSelections.includes('eph18')")
                # Replacing a linked song must search the new draft, not show its old linkage.
                field.fill('존재하지않는곡')
                page.wait_for_function("document.querySelector('.svc-edit-title-wrap .svc-song-picker-warning')?.textContent==='검색 결과 없음'")
                assert buttons.count()==0
                field.fill('')
                page.wait_for_function("!document.querySelector('.svc-edit-title-wrap .svc-song-picker-warning')")
                assert buttons.count()==0
                page.evaluate("""() => {
                  songCatalogLoaded=false;window.catalogCalls=0;
                  loadSongs=()=>{catalogCalls++;return new Promise(resolve=>{
                    window.finishCatalog=()=>{songCatalogLoaded=true;resolve();};
                  });};
                }""")
                field.fill('엡 5:19')
                page.wait_for_function("typeof window.finishCatalog==='function'")
                field.fill('마 22:38')
                page.evaluate('finishCatalog()')
                page.wait_for_function("document.querySelector('[data-service-song-select=range]')!==null")
                assert buttons.count()==1 and page.evaluate('catalogCalls===1')
                print(engine, 'PASS multiple results, range, focus, draft/output isolation, click selection, linked replacement, empty search and cold-load latest query')
            finally:
                browser.close()
finally:
    server.shutdown()
