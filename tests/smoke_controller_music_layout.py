"""Slot seek ownership and children/controller layout, offline without output."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from pathlib import Path
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1280,'height':800})
   def route(r):
    if r.request.url.startswith(url.rsplit('/',1)[0]+'/'):r.continue_()
    else:r.abort()
   page.route('**/*',route)
   page.goto(url+'?mindexSmokeRaw=1')
   page.wait_for_function("typeof renderServiceMusicPlayer==='function'&&!document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{
    state.serviceMusic.audio={currentTime:45,duration:180};state.serviceMusic.sourceKey='fixture';state.serviceMusic.ownerServiceId='owner';
    const item={id:'child',label:'찬양 1',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'children_audio'})};
    const entries=[{slide:{songTimingKey:'child-key',songTimingElementId:'child',elementId:'child',songTimingEligible:true,songTimingAudio:{url:'./fixture.wav',name:'어린이부 찬양 음원'}}}];
    refs.detailPane.innerHTML=`<div id="servicePresenterControls"><div id="music-layout" style="padding:20px;width:600px;max-width:100%;box-sizing:border-box"><h2>자율기도</h2>${renderServiceMusicPlayer({source:'fixture',serviceId:'owner',label:'자율기도 음악',repeatAllowed:false})}<h2>어린이부 찬양</h2><div class="svc-board-subgroup-controls">${renderPresenterBoardItemAudioControls('owner',{item,timingEntries:entries},{manager:true})}</div></div></div>`;
    refreshIcons();
    const input=document.querySelector('[data-seek-owner="owner"]');input.value=70;input.dispatchEvent(new Event('input',{bubbles:true}));
    if(state.serviceMusic.audio.currentTime!==70)throw Error('owner seek');
    state.serviceMusic.ownerServiceId='other';MindexSongTiming.updateTransport(state.serviceMusic.audio);
    if(!input.disabled||Number(input.value)!==0)throw Error('other owner leaks position');
    input.disabled=false;input.value=90;input.dispatchEvent(new Event('input',{bubbles:true}));
    if(state.serviceMusic.audio.currentTime!==70)throw Error('other owner changed position');
    MindexSongTiming.updateTransport(state.serviceMusic.audio);
   }''')
   assert page.locator('.svc-children-audio audio').count()==0, 'input must not create a separate audio clock'
   assert page.locator('.svc-children-audio [data-input-audio-controls]').count()==1
   assert page.locator('.svc-children-audio [data-song-timing-seek]').is_disabled()
   assert page.locator('.svc-children-audio [data-song-timing-clock]').inner_text()=='재생 대기'
   for theme in ('light','dark'):
    page.evaluate('(t)=>applyTheme(t)',theme)
    page.evaluate("""()=>{
      const button=document.querySelector('.svc-music-toggle'),style=()=>getComputedStyle(button);
      button.style.transition='none';
      button.disabled=false;button.setAttribute('aria-pressed','false');const normal=style().color;
      button.setAttribute('aria-pressed','true');if(style().color===normal)throw Error('pressed state missing');
      button.disabled=true;const background=style().backgroundColor;
      if(background!=='rgba(0, 0, 0, 0)'&&background!=='transparent')throw Error('disabled surface overridden');
      if(style().color===normal)throw Error('disabled ink overridden');
      button.disabled=false;button.setAttribute('aria-pressed','false');
    }""")
    page.locator('.svc-music-toggle').evaluate("e=>e.setAttribute('aria-pressed','true')")
    page.locator('.svc-music-toggle').hover()
    assert page.locator('.svc-music-toggle').evaluate("e=>getComputedStyle(e).borderColor===getComputedStyle(e).color")
    page.locator('.svc-music-toggle').evaluate("e=>e.setAttribute('aria-pressed','false')")
    page.keyboard.press('Tab')
    page.locator('.svc-music-toggle').focus()
    assert page.locator('.svc-music-toggle').evaluate('(e)=>getComputedStyle(e).outlineOffset')=='-2px'

    for width in (1000,600,390,254):
     page.locator('#music-layout').evaluate('(e,w)=>e.style.width=w+"px"',width)
     assert page.locator('#music-layout').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
     assert page.locator('.svc-children-audio').evaluate('(e)=>getComputedStyle(e).display')=='flex'
     assert page.locator('.svc-music-player--inline').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
     assert page.locator('.svc-children-audio').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
     assert page.locator('.svc-children-audio').evaluate("(e)=>e.querySelector('[data-input-audio-controls]').getBoundingClientRect().top>=e.querySelector('strong').getBoundingClientRect().bottom")
     page.locator('.svc-music-label').evaluate("e=>e.textContent='A very long music filename with additional details and a long unbroken name '+ 'x'.repeat(80)")
     assert page.locator('#music-layout').evaluate('(e)=>e.scrollWidth<=e.clientWidth+1')
     page.locator('.svc-music-label').evaluate("e=>e.textContent='자율기도 음악'")
   page.locator('#music-layout').evaluate('(e)=>e.style.width="600px"')
   if os.environ.get('MINDEX_CAPTURE_MUSIC_LAYOUT'):
    Path(os.environ['MINDEX_CAPTURE_MUSIC_LAYOUT']).mkdir(parents=True,exist_ok=True)
    page.locator('#music-layout').screenshot(path=os.environ['MINDEX_CAPTURE_MUSIC_LAYOUT']+'/'+engine+'.png')
   print('PASS',engine,'owner-bound slot seek, content-driven wrapping, both themes and 4 host widths',flush=True)
   browser.close()
finally:server.shutdown()
