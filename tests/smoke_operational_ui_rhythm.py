"""Offline geometry and draft retention for operational utility surfaces."""
import os
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server, sync_playwright, launch_chromium

server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ('chromium', 'webkit'):
            browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
            page = browser.new_page()
            page.route('**/*', lambda r: r.continue_() if urlsplit(r.request.url).hostname == '127.0.0.1' and r.request.method == 'GET' else r.abort())
            page.goto(url)
            page.wait_for_function("typeof renderPresenterSectionEditorLayer==='function'&&!document.body.classList.contains('ui-booting')")
            for theme in ('light', 'dark'):
                for name in ('background', 'toolbar', 'section', 'prep', 'unsaved'):
                    page.evaluate('''({name,theme}) => {
                      document.body.dataset.theme=theme;
                      document.querySelector('[data-presenter-section-editor]')?.remove();
                      const service={id:'ui-fixture',type_id:'young-adult',date:'2026-10-18'};
                      state.services=[service];state.serviceItems={'ui-fixture':Array.from({length:12},(_,i)=>({id:'item-'+i,service_id:service.id,label:'특송',raw_title:'검증 제목 '+i,sort_order:i,memo:JSON.stringify({elementType:'title_person'}),_worshipSectionId:'fixture-section',_worshipSectionTitle:'특송'}))};
                      if(name==='prep')refs.detailPane.innerHTML=renderServicePrepEditorDialog(service);
                      if(name==='background')renderWorshipBackgroundsDetail();
                      if(name==='toolbar')refs.detailPane.innerHTML=renderServicePresenterControls(service,[],false,0);
                      if(name==='section'){
                        state.presenterSectionEditor={serviceId:service.id,itemId:'item-0'};
                        refs.detailPane.innerHTML=renderPresenterSectionEditorLayer(service);
                      }
                      if(name==='unsaved')void confirmUnsavedChangesAction();
                      refreshIcons();
                    }''', {'name':name,'theme':theme})
                    for width,height in ((1440,900),(900,600),(760,600),(390,600),(320,450)):
                        page.set_viewport_size({'width':width,'height':height})
                        page.wait_for_timeout(100)
                        if name=='unsaved':
                            box=page.locator('.unsaved-dialog').bounding_box()
                            assert box['x']>=0 and box['x']+box['width']<=width and box['y']+box['height']<=height,box
                            for button in page.locator('.unsaved-dialog button').all():
                                button.scroll_into_view_if_needed();b=button.bounding_box()
                                assert b['x']>=0 and b['x']+b['width']<=width,b
                        if name=='background':
                            sizes=page.locator('.background-toolbar input,.background-toolbar select,.background-toolbar > button').evaluate_all('es=>es.map(e=>e.getBoundingClientRect().height)')
                            assert all(h==35 for h in sizes),sizes
                        if name=='prep':
                            heights=page.locator('.svc-prep-editor .svc-form-hint-slot').evaluate_all('es=>es.map(e=>[e,e.querySelector("input"),e.querySelector("button")].map(n=>n.getBoundingClientRect().height))')
                            assert heights and all(all(abs(h-30)<1 for h in row) for row in heights),(engine,width,heights)
                        if name=='toolbar':
                            assert page.locator('.svc-presenter-toolbar-utilities .svc-presenter-help > summary').evaluate('e=>e.getBoundingClientRect().height')==35
                            page.locator('.svc-presenter-toolbar-utilities').scroll_into_view_if_needed()
                        if name=='section':
                            panel=page.locator('[data-presenter-section-editor]');box=panel.bounding_box()
                            assert box and box['x']>=0 and box['x']+box['width']<=width and box['y']>=50 and box['y']+box['height']<=height,box
                            page.wait_for_function("!document.querySelector('[data-presenter-section-editor]').getAnimations().some(a=>a.playState==='running')")
                            heights=panel.locator('.svc-form-hint-slot').evaluate_all('es=>es.map(e=>[e,e.querySelector("input"),e.querySelector("button")].map(n=>n.getBoundingClientRect().height))')
                            assert heights and all(all(abs(h-30)<1 for h in row) for row in heights),(engine,width,heights)
                            field=page.locator('[data-presenter-section-new-name]');field.fill('입력 유지 검증');field.scroll_into_view_if_needed()
                            assert field.input_value()=='입력 유지 검증'
                            assert page.locator('.presenter-section-editor-body').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
                            b=field.bounding_box();assert b['y']>=50 and b['y']+b['height']<=height,b
                            add=page.locator('[data-presenter-section-add]');add.scroll_into_view_if_needed()
                            assert add.bounding_box()['y']+add.bounding_box()['height']<=height
                            assert page.locator('.presenter-section-editor-head').evaluate('e=>e.scrollHeight<=e.clientHeight+1')
                        if width in (1440,320):page.screenshot(path=f'/private/tmp/operational-{engine}-{theme}-{name}-{width}.png')
                    if name=='unsaved':page.locator('[data-unsaved-action="cancel"]').click()
                    print('PASS',engine,theme,name,'1440/900/760/390/320',flush=True)
            browser.close()
finally:
    server.shutdown()
