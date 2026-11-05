"""Offline long-MP3 transport regression. Never opens or saves a worship record."""
import os
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from smoke_app import start_local_app_server, sync_playwright, launch_chromium

SOURCE = './assets/presenter/dawn-free-prayer-bac443d20c02.mp3'

def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                page = browser.new_page()
                origin = url.rsplit('/', 1)[0]
                page.route('**/*', lambda r: r.continue_() if r.request.url.startswith((origin + '/', 'blob:')) else r.abort())
                page.goto(url + '?mindexSmokeRaw=1')
                page.wait_for_function("typeof runServiceMusicAction === 'function' && !document.body.classList.contains('ui-booting')")
                result = page.evaluate('''async source => {
                    const assert = (ok, message) => { if (!ok) throw Error(message); };
                    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
                    prepareServiceAudio([source]);
                    const a = getServiceMusicAudio(source);
                    if (!Number.isFinite(a.duration)) await new Promise((resolve, reject) => {
                        a.addEventListener('loadedmetadata', resolve, {once:true});
                        a.addEventListener('error', reject, {once:true});
                    });
                    await a.mindexPreciseAudio.prepare();
                    const t = a.mindexPreciseAudio.transport;
                    assert(t && t.decoder.calibration.score > .995, 'verified frame alignment');
                    const binding = {serviceMusicSource:source, serviceMusicServiceId:'isolated-precise-mp3', serviceMusicLabel:'QA', serviceMusicRepeatAllowed:'false'};
                    await runServiceMusicAction('toggle', binding);
                    assert(!a.paused, 'initial play');
                    const root = document.createElement('div');
                    root.innerHTML = renderServiceMusicPlayer({source,label:'QA',serviceId:binding.serviceMusicServiceId,repeatAllowed:false});
                    document.body.append(root);
                    const seek = root.querySelector('[data-song-timing-seek]');
                    assert(seek, 'actual transport exists');
                    for (const position of [1434.9715, 1200, 1885, 1420]) {
                        seek.value = String(position); seek.dispatchEvent(new Event('input', {bubbles:true}));
                    }
                    await wait(500);
                    assert(!a.seeking && !a.paused && a.currentTime >= 1420 && a.currentTime < 1421, 'last seek wins');
                    assert(t.nodes.length <= 2 && t.decoder.cache.size <= 3, 'bounded decoder');
                    // Cross a decoded window boundary without restarting the clock.
                    a.currentTime = 1439.8;
                    await wait(750);
                    assert(a.currentTime > 1440 && a.currentTime < 1441 && !a.error, 'continuous window handoff');
                    stopServiceMusicPlayback({render:false});
                    const stopped = a.currentTime;
                    await wait(250);
                    assert(a.paused && a.currentTime === stopped && !t.nodes.length, 'stop cancels sources');
                    a.currentTime = 1550;
                    await wait(100);
                    assert(a.paused && a.currentTime === 1550, 'paused seek stays paused');
                    await runServiceMusicAction('toggle', binding);
                    await wait(100);
                    assert(!a.paused && a.currentTime >= 1550 && a.currentTime < 1551, 'resume selected position');
                    const promise = a.play().catch(error => error.name);
                    a.pause(); await promise; await wait(100);
                    assert(a.paused && !t.nodes.length, 'stop cannot resurrect playback');
                    const end = a.duration;
                    a.loop = false; a.currentTime = end - .1; await a.play(); await wait(350);
                    assert(a.ended && a.paused && a.currentTime === end, 'natural end');
                    a.removeAttribute('src'); a.load(); await wait(100);
                    assert(!a.mindexPreciseAudio.transport && !t.nodes.length, 'release cached source');
                    root.remove();
                    // A single click while preparation is pending must start once;
                    // pausing during preparation must invalidate that request.
                    a.src = source;
                    await new Promise(resolve => a.addEventListener('loadedmetadata', resolve, {once:true}));
                    const pending = a.play().then(() => 'started', e => e.name);
                    a.pause();
                    assert(await pending === 'AbortError', 'cold play cancelled');
                    assert(a.paused, 'cancelled preparation stays paused');
                    await a.play(); await wait(100);
                    assert(!a.paused && a.currentTime < 1, 'one click starts after preparation');
                    a.pause(); a.removeAttribute('src'); a.load(); await wait(100);
                    return {duration:end, calibration:t.decoder.calibration, sourceReleased:true};
                }''', SOURCE)
                print(engine, 'PASS', result, flush=True)
                browser.close()
    finally:
        server.shutdown()

if __name__ == '__main__':
    main()
