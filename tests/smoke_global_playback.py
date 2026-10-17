"""Global transport uses the active owner across views; no real audio or DB writes."""
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
                    page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc and r.request.method in ('GET','HEAD') else r.abort())
                    page.goto(url)
                    page.wait_for_function("typeof renderGlobalPlaybackControls==='function' && !document.body.classList.contains('ui-booting')")
                    print(engine,page.evaluate('''async()=>{
                      const check=(v,m)=>{if(!v)throw Error(m)};
                      const host=document.getElementById('globalPlaybackControls');
                      renderGlobalPlaybackControls();check(host.hidden,'idle transport shown');
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
                    for width in (1440,1000,800):
                        page.set_viewport_size({'width':width,'height':900})
                        assert page.evaluate('''()=>{const r=document.getElementById('globalPlaybackControls');return r.scrollWidth<=r.clientWidth+1}'''),f'overflow {width}'
                    page.set_viewport_size({'width':1440,'height':900})
                    page.screenshot(path='/tmp/mindex-global-playback-'+engine+'.png')
                finally:browser.close()
    finally:server.shutdown();server.server_close()

if __name__=='__main__':main()
