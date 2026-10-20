"""Offline focused layout: state and draft preservation, no native output windows."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from pathlib import Path
from urllib.parse import urlsplit
from smoke_app import start_local_app_server, sync_playwright, launch_chromium

server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   try:
    page=browser.new_page(viewport={'width':1440,'height':1000})
    page.add_init_script('window.open=()=>null')
    page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc and r.request.method in ('GET','HEAD') else r.abort())
    page.goto(url)
    page.wait_for_function("typeof syncPresenterFocusView==='function' && !document.body.classList.contains('ui-booting')")
    page.evaluate('''()=>{
      const sid='focus-fixture';state.client={};state.serviceError='';
      state.services=[{id:sid,type_id:'fixture',date:'2026-10-25',title:'주일예배'}];
      state.serviceTypes=[{id:'fixture',name:'주일예배'}];
      state.serviceItems={[sid]:['첫 번째','두 번째','마지막'].map((title,i)=>({id:'focus-'+i,service_id:sid,label:'설교',raw_title:title,sort_order:i+1,_worshipSectionKey:'sermon',_worshipElementTemplateModified:true,memo:serializeServiceItemMemo({elementType:'title',inputMode:'manual',outputMode:'title'})}))};
      state.loadedWorshipServiceIds=new Set([sid]);state.selectedServiceId=sid;state.module='presenter';state.loading=false;
      renderPresenterDetail();
      window.focusDraft=document.querySelector('.svc-source-text');focusDraft.value='아직 저장하지 않은 원문';
      window.focusBoard=document.querySelector('.svc-slide-board');
      window.focusAudio={currentTime:42,paused:false};state.serviceMusic.audio=focusAudio;
      state.serviceMusic.playing=true;state.serviceMusic.sourceKey='fixture.wav';state.serviceMusic.ownerServiceId=sid;
      state.serviceMusic.mode='presenter-audio';state.serviceMusic.timingGroupId='group';state.serviceMusic.autoSyncSuspended=true;
      window.focusItems=JSON.stringify(state.serviceItems);
    }''')
    toggle=page.locator('[data-presenter-focus-toggle=focus]')
    toggle.click()
    assert page.locator('[data-presenter-focus-panel]').is_visible()
    assert not page.locator('.svc-source-panel').is_visible()
    assert page.evaluate("focusDraft===document.querySelector('.svc-source-text') && focusDraft.value==='아직 저장하지 않은 원문' && focusAudio===state.serviceMusic.audio && focusAudio.currentTime===42 && focusItems===JSON.stringify(state.serviceItems)")
    assert '자동 넘김 해제' in page.locator('[data-focus-music-status]').inner_text()
    assert page.locator('[data-focus-music="toggle"]').inner_text() == '일시정지 · P'
    assert page.evaluate('''()=>{const b=document.querySelector('[data-focus-music="toggle"]');const text=b.firstChild;syncPresenterFocusMusic();return text===b.firstChild}''')
    page.evaluate('window.focusOriginalMusicAction=runServiceMusicAction;runServiceMusicAction=(action,binding)=>{window.focusMusicCall={action,binding}}')
    page.locator('[data-focus-music="toggle"]').click()
    assert page.evaluate("focusMusicCall.action==='toggle' && focusMusicCall.binding.serviceMusicServiceId==='focus-fixture'"), page.evaluate("JSON.stringify(focusMusicCall)")
    page.locator('[data-focus-music="stop"]').click()
    assert page.evaluate("focusMusicCall.action==='stop'")
    page.evaluate('runServiceMusicAction=focusOriginalMusicAction')
    page.evaluate('''()=>{
      const sid=state.selectedServiceId;state.presenter.serviceId=sid;state.presenter.slides=presenterSlidesForService(sid);state.presenter.index=0;
      state.presenter.outputWindow={closed:false};syncPresenterFocusView();
    }''')
    page.evaluate('renderPresenterControlState()')
    assert '현재 송출' in page.locator('.svc-focus-screens').inner_text()
    page.evaluate('state.presenter.safetyBlank=true;syncPresenterFocusView()')
    assert '암전' in page.locator('.svc-focus-screens').inner_text()
    page.evaluate('state.presenter.safetyBlank=false;state.presenter.index=state.presenter.slides.length-1;syncPresenterFocusView()')
    assert '다음 슬라이드 없음' in page.locator('.svc-focus-screens').inner_text()
    page.evaluate('state.presenter.outputWindow.closed=true;state.presenterBoardSelection={serviceId:state.selectedServiceId,indexes:[2]};syncPresenterFocusView()')
    assert '첫 번째' in page.locator('.svc-focus-preview').first.inner_text()
    assert '송출 대기' in page.locator('.svc-focus-preview').first.inner_text()
    page.evaluate('state.presenter.outputWindow.closed=false;syncPresenterFocusView()')
    for width in (1440,1100,800):
     page.set_viewport_size({'width':width,'height':1000})
     page.wait_for_timeout(100)
     assert page.locator('.svc-focus-panel').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
    page.set_viewport_size({'width':1440,'height':1000})
    page.evaluate('''()=>{
      const before=refs.detailPane.scrollTop;
      const thumbs=[...document.querySelectorAll('.svc-slide-thumb-wrap')];
      const top=thumbs[0].getBoundingClientRect().top;
      if(!thumbs.every(t=>Math.abs(t.getBoundingClientRect().top-top)<1))throw Error('slides wrap instead of one row');
      if(focusBoard.scrollHeight>focusBoard.clientHeight+1)throw Error('vertical filmstrip overflow');
      scrollPresenterBoardToIndex(state.selectedServiceId,state.presenter.slides.length-1,{force:true});
      if(refs.detailPane.scrollTop!==before)throw Error('focus screen scrolled away');
      if(document.querySelector('.svc-slide-board').scrollLeft<=0)throw Error('filmstrip did not follow target');
      state.presenter.index=0;syncPresenterFocusView();
      scrollPresenterBoardToIndex(state.selectedServiceId,0,{force:true});
    }''')
    Path('output/presenter-focus').mkdir(parents=True,exist_ok=True)
    page.screenshot(path=f'output/presenter-focus/{engine}.png')
    page.locator('[data-presenter-focus-toggle=basic]').click()
    assert page.locator('.svc-source-panel').is_visible()
    assert page.evaluate("focusBoard===document.querySelector('.svc-slide-board') && focusDraft.value==='아직 저장하지 않은 원문' && focusAudio.currentTime===42 && state.serviceMusic.playing && state.serviceMusic.autoSyncSuspended && focusItems===JSON.stringify(state.serviceItems)")
    for theme in ('light','dark'):
     page.evaluate('(theme)=>{document.body.dataset.theme=theme}',theme)
     for view in ('basic','focus'):
      page.locator(f'[data-presenter-focus-toggle={view}]').click()
      assert page.locator(f'[data-presenter-focus-toggle={view}]').get_attribute('aria-pressed')=='true'
      page.locator(f'[data-presenter-focus-toggle={view}]').click()
      assert page.locator(f'[data-presenter-focus-toggle={view}]').get_attribute('aria-pressed')=='true'
      assert page.evaluate("focusBoard===document.querySelector('.svc-slide-board') && focusDraft.value==='아직 저장하지 않은 원문' && focusAudio.currentTime===42")
      for width in (1440,1100,800):
       page.set_viewport_size({'width':width,'height':1000})
       page.wait_for_timeout(100)
       assert page.locator('.svc-presenter-toolbar').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
       page.locator('[data-presenter-help] > summary').click()
       assert page.locator('.svc-presenter-help-panel').is_visible()
       assert page.locator('.svc-presenter-help-panel').evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth}')
       page.locator('[data-presenter-help] > summary').click()
       assert page.evaluate("""()=>{
        const help=document.querySelector('[data-presenter-help]').getBoundingClientRect();
        const views=document.querySelector('.svc-presenter-view-switch').getBoundingClientRect();
        const output=document.querySelector('.svc-presenter-output-group');
        const detect=output.querySelector('[data-presenter-action=detect-screens]').getBoundingClientRect();
        const pin=output.querySelector('.svc-presenter-pin-toggle').getBoundingClientRect();
        return Math.abs(help.top-views.top)<2 && help.left-views.right<=10 && Math.abs(detect.top-pin.top)<2;
       }""")
       if view=='basic':
        for menu in page.locator('.svc-reference-media-quick-add').all():
         assert menu.evaluate('(e)=>e.getBoundingClientRect().left-e.previousElementSibling.getBoundingClientRect().right<=15')
        for flow in page.locator('.svc-board-subgroup-head-row > .svc-board-subgroup-flow').all():
         assert flow.evaluate('(e)=>e.getBoundingClientRect().left-e.previousElementSibling.getBoundingClientRect().right<=15')
        add=page.locator('.svc-reference-media-quick-add > summary').first
        add.click()
        assert page.locator('.svc-reference-media-quick-add-actions').first.is_visible()
        assert page.locator('.svc-reference-media-quick-add-actions').first.evaluate('(e)=>{const r=e.getBoundingClientRect();return r.left>=0 && r.right<=innerWidth}')
        add.click()
        page.locator('.svc-source-panel-head').click()
        assert page.locator('.svc-source-text').is_visible()
        assert page.locator('.svc-source-panel-body').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
        page.locator('.svc-source-panel-head').click()
       if width==1440:
        page.screenshot(path=f'output/presenter-focus/{engine}-{view}-{theme}.png')
    print(engine,'PASS view switch, DOM/draft/audio retention, live/blank/end states, responsive geometry',flush=True)
   finally: browser.close()
finally:server.shutdown()
