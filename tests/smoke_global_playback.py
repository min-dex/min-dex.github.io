"""Global transport uses the active owner across views; no real audio or DB writes."""
import os
os.environ["MINDEX_SMOKE_OFFLINE"] = "1"
from urllib.parse import urlsplit
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

def main():
    server,url=start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium','webkit'):
                browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
                try:
                    page=browser.new_page(viewport={'width':1440,'height':900})
                    page.add_init_script("""window.open=()=>null;
                      Element.prototype.requestFullscreen=()=>Promise.resolve();
                      Element.prototype.webkitRequestFullscreen=()=>{};""")
                    page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc and r.request.method in ('GET','HEAD') else r.abort())
                    page.goto(url)
                    page.wait_for_function("typeof renderGlobalPlaybackControls==='function' && !document.body.classList.contains('ui-booting')")
                    print(engine,page.evaluate('''async()=>{
                      const check=(v,m)=>{if(!v)throw Error(m)};
                      const host=document.getElementById('globalPlaybackControls');
                      renderGlobalPlaybackControls();check(host.hidden,'idle transport shown');
                      state.module='presenter';renderGlobalPlaybackControls();check(!host.hidden,'display setup unavailable before output');
                      state.module='service';state.selectedServiceId='other';
                      state.services=[{id:'owner',type_id:'friday',title:'금요기도회 자율기도'},{id:'other',title:'다른 예배'}];
                      const audio={paused:true,currentTime:0,src:'',pause(){this.paused=true},play(){this.paused=false;return Promise.resolve()},removeAttribute(){this.src=''}};
                      state.serviceMusic.audio=audio;
                      const binding={serviceMusicSource:SERVICE_SLOT_MUSIC['prayer.meeting.free'].source,serviceMusicServiceId:'owner',serviceMusicLabel:'자율기도 음악',serviceMusicRepeatAllowed:'false'};
                      await runServiceMusicAction('toggle',binding);
                      check(!host.hidden&&host.textContent.includes('음악 재생 중'),'playing missing');
                      const click=async action=>{host.querySelector(`[data-global-playback-action="${action}"]`).click();await new Promise(r=>setTimeout(r,0))};
                      audio.currentTime=42;
                      for(const module of ['praise','scripture','home']){state.module=module;renderModuleSwitcher();check(!host.hidden&&!audio.paused&&audio.currentTime===42,'navigation altered playback');}
                      await click('toggle');check(audio.paused&&audio.currentTime===42&&host.textContent.includes('일시정지'),'global pause');
                      await click('toggle');check(!audio.paused&&state.serviceMusic.ownerServiceId==='owner'&&audio.currentTime===42,'global resume changed owner');
                      state.presenter.serviceId='owner';state.presenter.outputWindow={closed:false,close(){this.closed=true}};
                      renderLiveServiceReturnControl();check(host.textContent.includes('예배 송출 중'),'output indicator absent');
                      confirmSaveBeforeLeaving=async()=>false;
                      await click('return');check(state.module==='home'&&state.selectedServiceId==='other','return bypassed dirty guard');
                      await click('output-stop');check(!isPresenterOutputWindowOpen()&&!audio.paused,'output stop affected music');
                      await click('stop');check(audio.paused&&audio.currentTime===0&&host.textContent.includes('음악 정지'),'global stop');
                      await click('toggle');check(!audio.paused,'restart missing');
                      let finish;audio.play=()=>new Promise(r=>finish=r);runServiceMusicAction('stop',binding);
                      const pending=runServiceMusicAction('toggle',binding);check(host.textContent.includes('음악 준비 중'),'pending missing');
                      await click('toggle');finish();await pending;check(!state.serviceMusic.playing&&!state.serviceMusic.pending,'cancel revived playback');
                      audio.play=function(){this.paused=false;return Promise.resolve()};await runServiceMusicAction('toggle',binding);
                      state.presenter.outputWindow={closed:false,close(){this.closed=true}};renderGlobalPlaybackControls();
                      clearServiceMusicSyncTimer();return 'PASS navigation, owner controls, pause/resume/stop, pending cancellation and independent output stop';
                    }'''),flush=True)
                    launcher=page.locator('[popovertarget="globalPlaybackPanel"]').first
                    assert launcher.locator('span').first.inner_text()=='송출·음악', repr(launcher.inner_text())
                    launcher.click()
                    panel=page.locator('#globalPlaybackPanel')
                    assert panel.is_visible()
                    fade=panel.get_by_label('페이드아웃 정지', exact=True)
                    assert not fade.is_checked()
                    fade.check()
                    assert page.evaluate("state.serviceMusic.fadeStopEnabled && localStorage.getItem('mindex.music.fadeStop')==='true'")
                    page.evaluate('renderGlobalPlaybackControls()')
                    assert fade.is_checked()
                    fade.uncheck()
                    assert page.evaluate("!state.serviceMusic.fadeStopEnabled && localStorage.getItem('mindex.music.fadeStop')==='false'")
                    assert panel.get_by_role('button',name='예배 송출 종료').inner_text()=='송출 종료'
                    assert panel.locator('[data-presenter-action="detect-screens"]').is_visible()
                    before=page.locator('#globalPlaybackControls').bounding_box()
                    page.evaluate('renderGlobalPlaybackControls()')
                    assert panel.is_visible()
                    panel.locator('[data-global-playback-action="toggle"]').click()
                    assert panel.is_visible(), 'playback refresh closed panel'
                    assert page.locator('#globalPlaybackControls').bounding_box()['width']==before['width']
                    for width in (1440,1000,800,390):
                        page.set_viewport_size({'width':width,'height':900})
                        assert page.evaluate('''()=>{const r=document.getElementById('globalPlaybackControls');return r.scrollWidth<=r.clientWidth+1}'''),f'overflow {width}'
                        assert page.locator('#monitorPanelBtn').inner_text()==''
                        assert page.locator('#monitorPanelBtn').get_attribute('aria-label')=='기기 상태'
                        assert page.locator('#monitorPanelBtn').evaluate('e=>e.scrollWidth<=e.clientWidth+1')
                        # Before icon hydration and after SVG replacement, the utility
                        # control must keep the same topbar hit target and centered icon.
                        for hydrated in (False, True):
                            page.evaluate('''hydrated => {
                              const button=document.getElementById('monitorPanelBtn');
                              button.innerHTML='<i data-lucide="activity"></i>';
                              if(hydrated) {
                                refreshIcons(button);
                                if(button.firstElementChild.tagName.toLowerCase()!=='svg') throw Error('SVG not rendered');
                              }
                            }''', hydrated)
                            assert page.locator('#monitorPanelBtn').evaluate('''button => {
                              const b=button.getBoundingClientRect(), i=button.firstElementChild.getBoundingClientRect();
                              const size=parseFloat(getComputedStyle(button).getPropertyValue('--topbar-btn-size'));
                              return b.width===size && b.height===size && i.width===16 && i.height===16
                                && Math.abs(i.x+i.width/2-b.x-b.width/2)<1
                                && button.scrollWidth<=button.clientWidth+1;
                            }'''), (engine,width,hydrated)
                        box=panel.bounding_box()
                        assert box['x']>=0 and box['x']+box['width']<=width+1,box
                        page.screenshot(path=f'/tmp/mindex-global-panel-{engine}-{width}.png')
                    page.evaluate("applyTheme('dark')")
                    page.set_viewport_size({'width':1440,'height':900})
                    page.screenshot(path=f'/tmp/mindex-global-panel-{engine}-dark.png')
                    page.keyboard.press('Escape')
                    assert not panel.is_visible()
                    page.wait_for_function('document.activeElement===document.querySelector(".global-playback-trigger")')
                    page.set_viewport_size({'width':1440,'height':900})
                    page.screenshot(path='/tmp/mindex-global-playback-'+engine+'.png')
                    launcher.click()
                    fade.check()
                    page.reload()
                    page.wait_for_function("typeof state==='object' && !document.body.classList.contains('ui-booting')")
                    assert page.evaluate('state.serviceMusic.fadeStopEnabled'), 'device preference lost on reload'
                finally:browser.close()
    finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
