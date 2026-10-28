"""Left preparation editor and sticky tools preserve editing and output ownership."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from pathlib import Path
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
out=Path('/tmp/mindex-left-input');out.mkdir(exist_ok=True)
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   try:
    page=browser.new_page(viewport={'width':1440,'height':900})
    page.add_init_script('window.open=()=>null')
    page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc and r.request.method in ('GET','HEAD') else r.abort())
    page.goto(url);page.wait_for_function("typeof setPresenterSidebarContent==='function' && !document.body.classList.contains('ui-booting')")
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
    field=page.locator('.service-sidebar--presenter [data-presenter-preparation-field]').first
    field.fill('추가 입력 보존')
    field.focus()
    page.evaluate("""()=>{
      window.orderField=document.activeElement;orderField.setSelectionRange(2,4);
      orderField.dispatchEvent(new CompositionEvent('compositionstart',{bubbles:true,data:'보'}));
      window.outputBefore=JSON.stringify(state.presenter);
      window.musicBefore={audio:state.serviceMusic.audio,time:state.serviceMusic.audio.currentTime};
      renderServiceList();renderPresenterDetail();renderPresenterControlState(state.selectedServiceId);
      if(document.activeElement!==orderField||orderField.value!=='추가 입력 보존'||orderField.selectionStart!==2||orderField.selectionEnd!==4)throw Error('refresh lost focused IME input');
      if(document.querySelectorAll('.svc-presenter-input-rail').length!==1||refs.rightSidebar.querySelector('[data-presenter-preparation-field]'))throw Error('duplicated editor');
      if(!presenterPreparationDraftForService(state.selectedServiceId).includes('추가 입력 보존'))throw Error('draft root omitted left sidebar');
      if(JSON.stringify(state.presenter)!==outputBefore||state.serviceMusic.audio!==musicBefore.audio||state.serviceMusic.audio.currentTime!==musicBefore.time)throw Error('output changed');
      orderField.dispatchEvent(new CompositionEvent('compositionend',{bubbles:true,data:'보존'}));
    }""")
    for theme in ('dark','light'):
     page.evaluate('(theme)=>applyTheme(theme)',theme)
     for width in (1440,1000,700):
      page.set_viewport_size({'width':width,'height':900})
      page.evaluate("""()=>{
        const rail=document.querySelector('.svc-presenter-input-rail');
        if(rail.scrollWidth>rail.clientWidth+1)throw Error('left editor overflow');
        if(document.activeElement!==orderField||orderField.value!=='추가 입력 보존'||orderField.selectionStart!==2)throw Error('resize lost focus');
        const pane=refs.detailPane;
        if(getComputedStyle(pane).overflowY==='visible')window.scrollTo(0,document.querySelector('.svc-presenter-toolbar').getBoundingClientRect().top+window.scrollY+100);
        else pane.scrollTop=300;
      }""")
      page.wait_for_timeout(50)
      if width==1440 and theme=='dark': page.screenshot(path=str(out/f'{engine}-sticky-scrolled.png'))
      page.evaluate("""()=>{
        const pane=refs.detailPane,bar=document.querySelector('.svc-presenter-toolbar');
        const r=bar.getBoundingClientRect(),p=pane.getBoundingClientRect();
        const expected=getComputedStyle(pane).overflowY==='visible'?0:p.top+parseFloat(getComputedStyle(pane).paddingTop);
        if(getComputedStyle(bar).position!=='sticky'||Math.abs(r.top-expected)>1)throw Error('toolbar not pinned '+JSON.stringify({top:r.top,pane:p.top,scroll:pane.scrollTop}));
        if(r.right>p.right+1)throw Error('toolbar overflow');
        const mask=getComputedStyle(bar,'::before');
        if(mask.content==='none'||parseFloat(mask.height)<(getComputedStyle(pane).overflowY==='visible'?0:r.top-p.top)||mask.backgroundColor!==getComputedStyle(pane).backgroundColor)throw Error('slides visible above sticky tools '+JSON.stringify({content:mask.content,height:mask.height,gap:r.top-p.top,background:mask.backgroundColor,paneBackground:getComputedStyle(pane).backgroundColor,width:innerWidth}));
        pane.scrollTop=0;window.scrollTo(0,0);
      }""")
      page.screenshot(path=str(out/f'{engine}-{theme}-{width}.png'))
    page.evaluate("""()=>{
      const input=orderField;input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',isComposing:true,bubbles:true}));
      if(JSON.stringify(state.presenter)!==outputBefore)throw Error('IME Enter changed output');
      state.presenter.viewServiceId=state.selectedServiceId;state.presenter.serviceId='separate-live-service';state.presenter.index=7;
      state.presenter.slides=[{id:'live-pptx',type:'pptx',pageIndex:7}];
      state.presenter.outputWindow={closed:false};
      const before=JSON.stringify(state.presenter);
      refs.songList.querySelector('[data-service-outline-item-index]')?.click();
      if(JSON.stringify(state.presenter)!==before)throw Error('outline click changed output');
      orderField.focus();renderPresenterControlState(state.selectedServiceId);
      if(JSON.stringify(state.presenter)!==before||state.serviceMusic.audio!==musicBefore.audio||musicBefore.audio.currentTime!==musicBefore.time)throw Error('browse refresh changed other service output/media');
    }""")
    print(engine,'PASS left single editor, IME/selection/draft, themes/widths, sticky tools and output/audio preservation',flush=True)
   finally:browser.close()
finally:server.shutdown()
