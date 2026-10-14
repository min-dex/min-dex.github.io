"""Warm the next video's first frame without playing; consume the same decoder."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                try:
                    page = browser.new_page()
                    page.route('**/*supabase*/**', lambda r: r.abort())
                    page.goto(url + '?output=presenter', wait_until='domcontentloaded')
                    page.wait_for_selector('#presenterOutputRoot', state='attached')
                    page.evaluate('''() => {
                      window.source='assets/presenter/chromakey-ready-loop-pingpong.mp4';
                      window.payload={serviceId:'warm-test',chromakey:true,index:0,slides:[
                        {id:'text',type:'scripture',elementType:'scripture_text',layout:'lower_bar_text',text:'이전 화면'},
                        {id:'video',type:'video',elementType:'video',layout:'media',videoSrc:source,
                          playback:{autoplay:false,muted:false,controls:true}}]};
                      window.playCalls=0;
                      const originalPlay=HTMLMediaElement.prototype.play;
                      HTMLMediaElement.prototype.play=function(){playCalls++;return originalPlay.call(this)};
                      renderPresenterOutput(payload);
                      window.warmed=presenterOutputVideoWarmupCache.get(source).video;
                    }''')
                    page.wait_for_function('warmed.readyState >= 2', timeout=15000)
                    result = page.evaluate('''() => {
                      if(playCalls || !warmed.paused || warmed.currentTime!==0 || !warmed.muted) throw Error('Warmup played media');
                      let loads=0;const originalLoad=warmed.load.bind(warmed);
                      warmed.load=()=>{loads++;originalLoad()};
                      const started=performance.now();
                      renderPresenterOutput({...payload,index:1});
                      const active=document.querySelector('.is-active video');
                      if(active!==warmed || active.readyState<2 || loads) throw Error('Decoded video was discarded');
                      if(!active.paused || active.currentTime!==0 || active.muted || !active.controls || playCalls) throw Error('Manual playback changed');
                      if(presenterOutputVideoWarmupCache.has(source)) throw Error('Active video still owned by warmup cache');
                      clearPresenterOutputVideoWarmup();
                      if(!active.getAttribute('src') || active.readyState<2) throw Error('Cache cleanup unloaded active output');
                      return {readyState:active.readyState,selectionMs:performance.now()-started,playCalls,loads};
                    }''')
                    print('PASS', engine, result, flush=True)
                    # The same warmed path must honor normal autoplay on selection.
                    page.evaluate('''() => {
                      window.autoSource=source+'?auto=1';
                      payload={...payload,index:0,slides:[payload.slides[0],{...payload.slides[1],id:'auto',videoSrc:autoSource,
                        playback:{autoplay:true,muted:true,controls:false}}]};
                      renderPresenterOutput(payload);
                      window.autoWarm=presenterOutputVideoWarmupCache.get(autoSource).video;
                    }''')
                    page.wait_for_function('autoWarm.readyState>=2')
                    assert page.evaluate('autoWarm.paused && autoWarm.currentTime===0 && playCalls===0')
                    page.evaluate('renderPresenterOutput({...payload,index:1})')
                    page.wait_for_function('!autoWarm.paused && autoWarm.currentTime>.1')
                    assert page.evaluate("document.querySelector('.is-active video')===autoWarm && autoWarm.muted && !autoWarm.controls")
                    print('PASS', engine, 'autoplay starts only after selection', flush=True)
                finally:
                    browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
