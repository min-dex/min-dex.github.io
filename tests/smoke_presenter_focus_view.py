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
      const sid='focus-fixture';state.client={};state.serviceError='';state.connectionError='';
      state.services=[{id:sid,type_id:'fixture',date:'2026-10-25',title:'주일예배'}];
      state.serviceTypes=[{id:'fixture',name:'주일예배'}];
      state.serviceItems={[sid]:['첫 번째','두 번째','마지막'].map((title,i)=>({id:'focus-'+i,service_id:sid,label:'설교',raw_title:title,sort_order:i+1,_worshipSectionKey:'sermon',_worshipElementTemplateModified:true,memo:serializeServiceItemMemo({elementType:'title',inputMode:'manual',outputMode:'title'})}))};
      state.loadedWorshipServiceIds=new Set([sid]);state.selectedServiceId=sid;state.module='presenter';document.body.dataset.module='presenter';state.loading=false;
      renderServiceList();renderPresenterDetail();
      window.focusDraft=document.querySelector('[data-service-item-field=raw_title]');focusDraft.value='아직 저장하지 않은 제목';
      window.focusBoard=document.querySelector('.svc-slide-board');
      window.focusAudio={currentTime:42,paused:false};state.serviceMusic.audio=focusAudio;
      state.serviceMusic.playing=true;state.serviceMusic.sourceKey='fixture.wav';state.serviceMusic.ownerServiceId=sid;
      state.serviceMusic.mode='presenter-audio';state.serviceMusic.timingGroupId='group';state.serviceMusic.autoSyncSuspended=true;
      window.focusItems=JSON.stringify(state.serviceItems);
    }''')
    assert page.get_by_role('button',name='슬라이드 보기',exact=True).count()==1
    assert page.get_by_role('button',name='발표자 보기',exact=True).count()==1
    page.evaluate("""()=>{
      const original=window.MINDEX_SERVER_STORAGE;
      const writes=[];window.MINDEX_SERVER_STORAGE={queue:(...args)=>{writes.push(args);return true;}};
      try {
        const toggle=document.querySelector('[data-presenter-order-toggle]');
        const body=document.getElementById('presenterOrderInputBody');
        const field=body.querySelector('input,textarea');
        const before=field.value;field.value='접어도 유지되는 입력';
        toggle.click();
        if(!body.hidden || toggle.getAttribute('aria-expanded')!=='false')throw Error('collapse failed');
        if(!renderPresenterServiceInputRail(state.services[0]).includes('aria-expanded="false"'))throw Error('rerender lost collapse state');
        toggle.click();
        if(body.hidden || body.querySelector('input,textarea')!==field || field.value!=='접어도 유지되는 입력')throw Error('disclosure lost draft');
        if(writes.length!==2 || writes[0][1]!=='mindex.ui.presenterOrderInputOpen' || writes[0][2]!=='false' || writes[1][2]!=='true')throw Error('server UI preference missing');
        field.value=before;
      } finally {window.MINDEX_SERVER_STORAGE=original;}
    }""")
    page.evaluate('renderGlobalPlaybackControls()')
    page.wait_for_selector('#remotePanelBtn',state='attached')
    for width in (1440,390):
      page.set_viewport_size({'width':width,'height':1000})
      remote=page.locator('#remotePanelBtn')
      music=page.locator('[data-presenter-music-manager]')
      assert remote.is_visible() and music.is_visible()
      assert page.locator('[data-presenter-remote]').is_hidden()
      assert not page.locator('.global-playback-trigger').is_visible()
      assert music.evaluate('e=>e.getBoundingClientRect().height')==35
      remote.click();assert page.locator('.remote-panel').is_visible()
      assert '예배 송출을 시작하면 코드가 표시됩니다.' in page.locator('[data-remote-status]').text_content()
      page.keyboard.press('Escape')
      page.locator('.remote-panel').wait_for(state='hidden',timeout=2000)
      music.click();assert page.locator('#globalPlaybackPanel').is_visible()
      page.keyboard.press('Escape')
      assert music.evaluate('e=>e===document.activeElement')
    page.set_viewport_size({'width':1440,'height':1000})
    toggle=page.locator('[data-presenter-focus-toggle=focus]')
    toggle.click()
    assert page.locator('[data-presenter-focus-panel]').is_visible()
    assert page.locator('#remotePanelBtn').is_visible()
    assert page.locator('.global-playback-trigger').is_visible()
    assert not page.locator('.svc-source-panel').is_visible()
    assert page.evaluate("focusDraft===document.querySelector('[data-service-item-field=raw_title]') && focusDraft.value==='아직 저장하지 않은 제목' && focusAudio===state.serviceMusic.audio && focusAudio.currentTime===42 && focusItems===JSON.stringify(state.serviceItems)")
    assert '자동 넘김 해제' in page.locator('[data-focus-music-status]').inner_text()
    assert page.locator('[data-focus-music-label]').inner_text() == '일시정지 · P'
    assert page.evaluate('''()=>{const b=document.querySelector('[data-focus-music="toggle"]');const text=b.firstChild;syncPresenterFocusMusic();return text===b.firstChild}''')
    for playing,pending,icon in ((False,False,'play'),(True,False,'pause'),(False,True,'loader-circle')):
      page.evaluate('([playing,pending])=>{state.serviceMusic.playing=playing;state.serviceMusic.pending=pending;syncPresenterFocusMusic()}',[playing,pending])
      assert page.locator(f'[data-focus-music="toggle"] svg.lucide-{icon}').count()==1
      assert page.evaluate("""()=>{const b=document.querySelector('[data-focus-music="toggle"]'),i=b.firstChild,l=b.lastChild;syncPresenterFocusMusic();return i===b.firstChild&&l===b.lastChild}""")
    page.evaluate('state.serviceMusic.playing=true;state.serviceMusic.pending=false;syncPresenterFocusMusic()')
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
    for width in (1440,1100,800,390):
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
    assert page.locator('.svc-source-panel').count()==0
    assert page.evaluate("focusBoard===document.querySelector('.svc-slide-board') && focusDraft.value==='아직 저장하지 않은 제목' && focusAudio.currentTime===42 && state.serviceMusic.playing && state.serviceMusic.autoSyncSuspended && focusItems===JSON.stringify(state.serviceItems)")
    page.evaluate("window.originalManagedVideo=presenterManagedVideoState;presenterManagedVideoState=()=>({status:'paused',ready:true});renderGlobalPlaybackControls()")
    for theme in ('light','dark'):
     page.evaluate('(theme)=>{document.body.dataset.theme=theme}',theme)
     for view in ('basic','focus'):
      page.locator(f'[data-presenter-focus-toggle={view}]').click()
      assert page.locator(f'[data-presenter-focus-toggle={view}]').get_attribute('aria-pressed')=='true'
      if view=='focus': assert page.locator('[data-presenter-focus-panel]').get_attribute('aria-label')=='발표자 보기'
      page.locator('.svc-presenter-side-panel .svc-presenter-top').wait_for(state='visible' if view=='basic' else 'hidden')
      page.locator(f'[data-presenter-focus-toggle={view}]').click()
      assert page.locator(f'[data-presenter-focus-toggle={view}]').get_attribute('aria-pressed')=='true'
      page.locator('.svc-presenter-side-panel .svc-presenter-top').wait_for(state='visible' if view=='basic' else 'hidden')
      assert page.evaluate("focusBoard===document.querySelector('.svc-slide-board') && focusDraft.value==='아직 저장하지 않은 제목' && focusAudio.currentTime===42")
      for width in (1440,1100,800,390):
       page.set_viewport_size({'width':width,'height':1000})
       page.wait_for_timeout(100)
       media=page.locator('[data-presenter-music-manager]') if view=='basic' else page.locator('.global-playback-trigger')
       assert media.get_attribute('aria-label')=='미디어 관리'
       assert media.locator('svg.lucide-video').count()==1
       media.click()
       panel=page.locator('#globalPlaybackPanel');assert panel.is_visible()
       assert panel.locator('h3').all_text_contents()==['음원','영상']
       assert panel.locator('[data-global-playback-action^="video-"]').evaluate_all("es=>es.every(e=>{const s=getComputedStyle(e),i=e.querySelector('svg');return s.height==='30px'&&s.paddingLeft==='10px'&&getComputedStyle(i).width==='16px'&&e.scrollWidth<=e.clientWidth+1})")
       assert panel.evaluate('e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1}')
       panel.locator('[popovertargetaction="hide"]').click()

       assert page.locator('.svc-presenter-toolbar').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
       assert page.evaluate("""()=>{
        const left=document.querySelector('.module-switcher-tab').getBoundingClientRect();
        const right=document.querySelector('#themeBtn').getBoundingClientRect();
        return Math.abs(left.height-right.height)<1 && (innerWidth<=980 || Math.abs((left.top+left.height/2)-(right.top+right.height/2))<1);
       }""")
       assert page.evaluate("""()=>{const help=document.querySelector('[data-presenter-help]');if(!help||!help.getBoundingClientRect().width)return true;help.open=true;const p=help.querySelector('.svc-presenter-help-panel').getBoundingClientRect(),t=document.querySelector('.svc-presenter-toolbar').getBoundingClientRect();help.open=false;return p.left>=t.left-1&&p.right<=t.right+1;}""")
       if width<=980:
        assert page.evaluate("document.querySelector('.app-shell').scrollWidth<=innerWidth+1")
        if view=='focus':
         assert page.locator('.svc-focus-output').is_visible()
        selector='.svc-presenter-side-panel [data-presenter-action]' if view=='basic' else '.svc-focus-navigation button,.svc-presenter-toolbar > .svc-output-action'
        assert page.locator(selector).evaluate_all("es=>es.filter(e=>e.getBoundingClientRect().width>0).every(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth+1})")
       if view=='focus':
        assert page.locator('.svc-focus-transport button').evaluate_all("""es=>es.every(e=>{
          const s=getComputedStyle(e),i=e.querySelector('svg.lucide'),is=i&&getComputedStyle(i);
          return s.height==='35px'&&s.padding==='0px 8px'&&s.gap==='6px'&&is?.width==='16px'&&is.height==='16px'&&is.strokeWidth==='1.5px'
            &&(!e.getClientRects().length||e.scrollWidth<=e.clientWidth+1);
        })""")
       if view=='basic':
        assert page.evaluate("""()=>{
         const music=document.querySelector('.svc-presenter-toolbar .svc-music-name');
         const apply=document.querySelector('.svc-presenter-preparation-apply');
         const nav=[...document.querySelectorAll('.svc-presenter-side-panel .svc-presenter-action-group--nav .icon-btn')];
         return music.getBoundingClientRect().height===35 && getComputedStyle(music).padding==='0px 10px'
          && getComputedStyle(apply).padding==='0px 10px' && getComputedStyle(apply).fontWeight==='600'
          && nav.length===2 && nav.every(e=>e.getBoundingClientRect().width===35 && e.getBoundingClientRect().height===35);
        }""")
        assert page.evaluate('''()=>{
         const selectors=['.module-switcher button svg.lucide','.topbar-actions button svg.lucide','.svc-presenter-toolbar button svg.lucide','.svc-presenter-toolbar summary svg.lucide','.svc-presenter-output-group svg.lucide','#servicePresenterControls .svc-board-subgroup-flow button svg.lucide','#servicePresenterControls .svc-board-subgroup-flow summary svg.lucide'];
         const icons=[...document.querySelectorAll(selectors.join(','))].filter(icon=>icon.getBoundingClientRect().width>0);
         return icons.length>=10 && icons.every(icon=>{const box=icon.getBoundingClientRect();return Math.abs(box.width-16)<.1 && Math.abs(box.height-16)<.1 && getComputedStyle(icon).strokeWidth==='1.5px';});
        }''')
        assert page.evaluate("""()=>{
         const add=document.querySelector('.svc-reference-media-quick-add > summary');
         const save=document.querySelector('.svc-board-subgroup-commit');
         // Add retains its icon; text-only save uses the compact edit-action width.
         return Math.abs(add.getBoundingClientRect().width-70)<1 && Math.abs(save.getBoundingClientRect().width-60)<1
          && !save.querySelector('svg,[data-lucide]') && getComputedStyle(save).padding==='0px 10px'
          && Math.abs(add.getBoundingClientRect().height-save.getBoundingClientRect().height)<1;
        }""")
        assert page.locator('.svc-source-panel,.svc-source-text').count()==0
       if width==1440:
        page.screenshot(path=f'output/presenter-focus/{engine}-{view}-{theme}.png')
    print(engine,'PASS view switch, DOM/draft/audio retention, live/blank/end states, responsive geometry',flush=True)
   finally: browser.close()
finally:server.shutdown()
