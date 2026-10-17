"""Core controls remain visible; optional editing preserves draft and output isolation."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   for width in (1440,390):
    page=b.new_page(viewport={'width':width,'height':900})
    page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url.rsplit('/',1)[0]+'/') else r.abort())
    page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof renderPresenterRightSidebar==='function'&&typeof renderPresenterControlsTop==='function'")
    page.evaluate('''()=>{
      document.body.classList.remove('ui-booting');document.querySelector('.mindex-boot')?.remove();
      const service={id:'essentials',type_id:'sunday-second',date:'2099-01-04'};
      state.services=[service];state.serviceItems[service.id]=[];
      state.presenter.serviceId=service.id;state.presenter.index=0;state.presenter.safetyBlank=false;
      const slides=[{id:'fixture',type:'title',text:'검증 화면'}];state.presenter.slides=slides;
      isPresenterOutputWindowOpen=()=>true;isPresenterOutputHeartbeatOpen=()=>true;
      const host=document.createElement('div');host.id='essentials';host.style.cssText='position:fixed;z-index:9999;inset:0 0 0 auto;overflow:auto;width:min(320px,100vw);background:var(--panel);padding:15px;box-sizing:border-box';
      document.body.append(host);host.innerHTML=renderPresenterRightSidebar(service,slides,true,0);bindDetailInteractionRoot(host);refreshIcons(host);
      window.__controllerCalls=[];runPresenterAction=(action,id,options)=>window.__controllerCalls.push({action,id,index:options?.index});
    }''')
    host=page.locator('#essentials')
    assert host.locator('[data-presenter-action="stop"]').is_visible()
    assert host.locator('[data-presenter-action="next"]').is_visible()
    assert host.locator('[aria-label="암전"]').is_visible()
    assert not host.locator('[data-presenter-preparation-apply]').is_visible()
    assert not host.locator('[data-presenter-action="detect-screens"]').is_visible()
    host.locator('[aria-label="암전"]').click()
    assert page.evaluate('window.__controllerCalls')==[{'action':'jump','id':'essentials','index':'-1'}] or page.evaluate('window.__controllerCalls')==[{'action':'jump','id':'essentials','index':-1}]
    boxes=[host.locator(selector).bounding_box() for selector in ('.svc-slide-counter','[aria-label="암전"]','[data-presenter-action="next"]')]
    assert max(box['y'] for box in boxes)-min(box['y'] for box in boxes)<5,boxes
    page.screenshot(path=f'/tmp/mindex-core-{engine}-{width}.png')
    assert host.locator('[data-presenter-secondary-controls]').count()==0
    page.evaluate("window.__openedEditor=null;openServicePrepEditor=id=>window.__openedEditor=id")
    host.locator('[data-service-prep-editor-open]').click()
    assert page.evaluate('window.__openedEditor')=='essentials'
    page.evaluate("document.querySelector('#essentials').remove();state.selectedServiceId=state.services[0].id;refs.detailPane.innerHTML=renderServicePrepEditorDialog(state.services[0])")
    host=page.locator('#detailPane')
    assert host.locator('[data-presenter-preparation-apply]').is_visible()
    assert host.locator('[data-presenter-action="detect-screens"]').count()==0
    field=host.locator('[data-presenter-preparation-field]').first
    field.fill('입력 초안 보존')
    page.evaluate('refs.detailPane.innerHTML=renderServicePrepEditorDialog(state.services[0])')
    assert host.locator('[data-presenter-preparation-field]').first.input_value()=='입력 초안 보존'
    page.evaluate("applyTheme('dark')")
    page.screenshot(path=f'/tmp/mindex-editor-{engine}-{width}.png')
    assert page.evaluate('window.__controllerCalls.length')==1
    page.close();print('PASS',engine,width,'core visible, editor shortcut, preparation in existing editor, blackout routed',flush=True)
   b.close()
finally:server.shutdown()
