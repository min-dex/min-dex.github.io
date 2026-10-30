import os
os.environ["MINDEX_SMOKE_OFFLINE"]="1"
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ('chrome', 'webkit'):
            browser = launch_chromium(p) if engine == 'chrome' else p.webkit.launch()
            page = browser.new_page()
            page.route('**/*supabase*/**', lambda route: route.abort())
            page.goto(url, wait_until='domcontentloaded')
            page.wait_for_function("typeof renderServiceSlotMusic === 'function'")
            print(engine, page.evaluate('''async () => {
 const check=(v,m)=>{if(!v)throw Error(m)};
 const service={id:'fixture',type_id:'friday'},item={_worshipSlotKey:'prayer.meeting.free'};
 const a={paused:true,currentTime:0,src:'',load(){this.loads=(this.loads||0)+1},pause(){this.paused=true},play(){this.paused=false;return Promise.resolve()}};
 state.serviceMusic.audio=a;
 state.serviceMusic.fadeStopEnabled=false; // Immediate-stop cases; fade envelope is verified separately.
 const m=document.createElement('div');m.id='music-test';m.style.width='254px';m.innerHTML=renderServiceSlotMusic({service,item});document.body.append(m);refreshIcons(m);
 check(!('prayerMusic' in state),'dedicated state left');
 check(!a.loads&&a.paused&&!state.serviceMusic.sourceKey,'render mutated player');
 renderServiceSlotMusic({service,item});check(!a.loads,'render loaded audio');
 check(!m.querySelector('[data-service-music-action="repeat"]'),'repeat shown');
 const root=m.querySelector('[data-service-music-player]'),binding=root.dataset;
 const source=binding.serviceMusicSource;
 const toggle=m.querySelector('[data-service-music-action="toggle"]');
 const pos=()=>JSON.stringify([...m.querySelectorAll('button,select')].map(e=>{const r=e.getBoundingClientRect();return [r.x,r.y,r.width]}));
 const positions=pos();let finish;
 a.play=()=>new Promise(r=>{finish=()=>{a.paused=false;r()}});
 const first=runServiceMusicAction('toggle',binding);
 check(toggle.textContent.includes('준비 중'),'pending label');check(toggle.getAttribute('aria-pressed')==='false','pending playing');check(pos()===positions,'pending shift');
 finish();await first;check(toggle.textContent.includes('일시정지'),'playing label');check(pos()===positions,'playing shift');check(!a.loop,'loop');
 state.presenter.outputWindow={closed:false};
 setServiceMusicVolume(2);check(a.volume===0.4&&m.querySelector('[data-service-music-volume]').value==='2','shared volume');
 await runServiceMusicAction('toggle',binding);check(a.paused&&!state.serviceMusic.playing,'pause');
 a.currentTime=12;runServiceMusicAction('stop',binding);check(a.currentTime===0,'stop reset');
 const pending=runServiceMusicAction('toggle',binding);runServiceMusicAction('toggle',binding);check(!state.serviceMusic.pending,'cancel pending');finish();a.paused=true;await pending;check(!state.serviceMusic.playing,'stale play revived');
 setServiceMusicSource(a,'other.mp3','manual',{loop:true},'Other');state.serviceMusic.playing=true;a.paused=false;
 renderServiceSlotMusic({service,item});check(a.src==='other.mp3'&&!a.paused,'render interrupted music');
 check(state.serviceMusic.repeatAllowed,'other repeat disabled');
 a.play=function(){this.paused=false;return Promise.resolve()};await runServiceMusicAction('toggle',binding);check(a.src==='other.mp3'&&!a.paused,'interrupted another track');state.serviceMusic.playing=false;a.paused=true;await runServiceMusicAction('toggle',binding);check(a.src===source&&!a.loop&&!state.serviceMusic.repeatAllowed,'source switch');
 check(!renderServiceMusicPlayer().includes('자율기도 음악'),'slot label leaked to toolbar');
 check(!renderServiceMusicPlayer().includes('data-service-music-action="toggle"'),'slot transport leaked');
 check(state.serviceMusic.playing&&!a.paused,'toolbar render stopped playback');
 runServiceMusicAction('toggle');check(state.serviceMusic.playing&&!a.paused,'generic control changed slot playback');
 const other=document.createElement('div');other.innerHTML=renderServiceSlotMusic({service:{id:'other-friday'},item});document.body.append(other);
 const otherRoot=other.querySelector('[data-service-music-player]');const otherBinding=otherRoot.dataset;
 check(other.querySelector('[data-service-music-action="toggle"]').getAttribute('aria-pressed')==='false','another Friday claims playing');
 const serial=state.serviceMusic.playSerial;const volume=a.volume;
 for(const action of ['toggle','stop','repeat'])await runServiceMusicAction(action,otherBinding);
 setServiceMusicVolume(5,otherBinding);
 check(state.serviceMusic.playSerial===serial&&state.serviceMusic.playing&&!a.paused&&a.volume===volume,'other service changed active music');
 updateServiceMusicTransportControls();check(other.querySelector('[data-service-music-action="toggle"]').getAttribute('aria-pressed')==='false','update leaked music state');
 runServiceMusicAction('stop',binding);
 await runServiceMusicAction('toggle',otherBinding);check(state.serviceMusic.ownerServiceId==='other-friday'&&state.serviceMusic.playing,'idle ownership transfer failed');
 runServiceMusicAction('stop',otherBinding);
 for(const theme of ['light','dark']){document.body.dataset.theme=theme;for(const width of [254,390,1000]){m.style.width=width+'px';check(m.scrollWidth<=width,'overflow '+width);}}
 const NativeAudio=window.Audio;let warmer;
 window.Audio=class {constructor(){warmer=this;this.events={}}addEventListener(name,fn){this.events[name]=fn}removeAttribute(){this.src=''}load(){this.released=true}play(){throw Error('warmup autoplay')}};
 const oldSource=state.serviceMusic.sourceKey;state.serviceMusic.sourceKey='fixture-other.mp3';
 const originalAudio=state.serviceMusic.audio,owner=state.serviceMusic.ownerServiceId,clock=originalAudio.currentTime;
 warmServiceSlotMusic(toggle);check(warmer.preload==='metadata'&&warmer.muted,'warmup settings');
 const firstWarmer=warmer;warmServiceSlotMusic(toggle);check(warmer===firstWarmer,'duplicate warmup');
 warmer.events.loadedmetadata();check(warmer.released,'warmup not bounded');
 check(state.serviceMusic.audio===originalAudio&&state.serviceMusic.sourceKey==='fixture-other.mp3'&&state.serviceMusic.ownerServiceId===owner&&originalAudio.currentTime===clock,'warmup touched active player');
 state.serviceMusic.sourceKey=oldSource;window.Audio=NativeAudio;
 clearServiceMusicSyncTimer();return 'PASS shared engine, side-effect-free rendering, state, cancellation, source isolation, repeat disabled, volume, widths';
}'''), flush=True)
            page.evaluate("""()=>{
 const m=document.getElementById('music-test');m.innerHTML=renderServiceSlotMusic({service:{id:'other-friday'},item:{_worshipSlotKey:'prayer.meeting.free'}});m.style.cssText='position:fixed;top:20px;left:20px;width:320px;padding:15px;background:var(--ui-surface-panel);z-index:999999';
 document.body.classList.remove('ui-booting');refreshIcons(m);m.addEventListener('input',handleDetailInput);
 window.auditRange=m.querySelector('[data-service-music-volume]');
}""")
            slider=page.locator('#music-test [data-service-music-volume]')
            slider.focus();slider.press('Home');slider.press('ArrowRight')
            assert slider.evaluate("e=>e===document.activeElement && e===window.auditRange && e.value==='0.25' && e.getAttribute('aria-valuetext')==='5%'")
            assert page.evaluate("Math.abs(state.serviceMusic.audio.volume-0.05)<0.00001")
            page.locator('#music-test').screenshot(path='/tmp/mindex-prayer-controls-'+engine+'.png')
            browser.close()
finally:
    server.shutdown()
