"""Offline long-MP3 transport regression. Never opens or saves a worship record."""
import os
import json
import hashlib
from pathlib import Path
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from smoke_app import start_local_app_server, sync_playwright, launch_chromium

SOURCE = './assets/presenter/dawn-free-prayer-f9ebf1aeed23.mp3'

def main():
    fingerprints = json.loads((Path(__file__).parent / 'fixtures/prayer-audio-timing-fingerprints.json').read_text())
    assert hashlib.sha256(Path(SOURCE).read_bytes()).hexdigest() == fingerprints['assetSha256']
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
                result = page.evaluate('''async ({source, fingerprints, engine}) => {
                    const assert = (ok, message) => { if (!ok) throw Error(message); };
                    const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
                    const until = async (predicate, message) => {
                        const deadline = performance.now() + 15000;
                        while (!predicate() && performance.now() < deadline) await wait(25);
                        assert(predicate(), message);
                    };
                    prepareServiceAudio([source]);
                    const a = getServiceMusicAudio(source);
                    if (!Number.isFinite(a.duration)) await new Promise((resolve, reject) => {
                        a.addEventListener('loadedmetadata', resolve, {once:true});
                        a.addEventListener('error', reject, {once:true});
                    });
                    await a.mindexPreciseAudio.prepare();
                    const t = a.mindexPreciseAudio.transport;
                    assert(t && t.decoder.calibration.score > .995, 'verified frame alignment');
                    const verifyPositions = async decoder => {
                        for (const anchor of fingerprints.anchors) {
                        const part = await decoder.chunk(Math.floor(anchor.time / decoder.chunkSeconds));
                        const start = Math.round((anchor.time - part.start) * fingerprints.sampleRate);
                        const left = part.buffer.getChannelData(0), right = part.buffer.getChannelData(1);
                        let dot = 0, actualPower = 0, referencePower = 0;
                        for (let k = 0; k < anchor.samples.length; k++) {
                            const at = start + k * anchor.stride;
                            const actual = (left[at] + right[at]) / 2, expected = anchor.samples[k];
                            dot += actual * expected; actualPower += actual * actual; referencePower += expected * expected;
                        }
                        const correlation = dot / Math.sqrt(actualPower * referencePower);
                        assert(correlation > .995, `absolute PCM location ${anchor.time}: correlation=${correlation}; calibration=${JSON.stringify(decoder.calibration)}`);
                    }
                    };
                    await verifyPositions(t.decoder);
                    if (engine === 'chromium') {
                        // Reproduce the observed Linux reference length (+1105)
                        // without changing raw-frame decoding or golden samples.
                        const context = t.context;
                        const untrimmedContext = {
                            sampleRate:context.sampleRate,
                            createBuffer:context.createBuffer.bind(context),
                            async decodeAudioData(bytes) {
                                const header = String.fromCharCode(...new Uint8Array(bytes).subarray(0,200));
                                const buffer = await context.decodeAudioData(bytes);
                                if (!header.includes('Xing')) return buffer;
                                const untrimmed = context.createBuffer(buffer.numberOfChannels,buffer.length+1105,buffer.sampleRate);
                                for (let c=0;c<buffer.numberOfChannels;c++) untrimmed.copyToChannel(buffer.getChannelData(c),c,1105);
                                return untrimmed;
                            }
                        };
                        const untrimmed = await new MindexMp3Index.IndexedMp3(t.decoder.index,untrimmedContext).prepare();
                        assert(untrimmed.calibration.decoderLag === -576 && untrimmed.referenceOrigin === 1105,'untrimmed reference reproduced');
                        await verifyPositions(untrimmed);
                    }
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
                    await until(() => !a.seeking, 'latest seek settles');
                    await wait(100);
                    assert(!a.seeking && !a.paused && a.currentTime >= 1420 && a.currentTime < 1421, 'last seek wins');
                    assert(t.nodes.length <= 2 && t.decoder.cache.size <= 3, 'bounded decoder');
                    // Cross a decoded window boundary without restarting the clock.
                    a.currentTime = 1439.8;
                    await until(() => !a.seeking, 'boundary seek settles');
                    await wait(350);
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
                    a.loop = false; a.currentTime = end - .1; await a.play();
                    await until(() => a.ended, 'end event arrives');
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
                    const parse = MindexMp3Index.parse;
                    let notices = 0;
                    a.addEventListener('mindexprecisionunavailable', () => notices++);
                    MindexMp3Index.parse = () => { throw Error('Unsupported test metadata'); };
                    a.src = source;
                    await a.play();
                    assert(!a.paused && !a.mindexPreciseAudio.transport && notices === 1, 'unsupported timing retains native playback with notice');
                    a.pause(); a.removeAttribute('src'); a.load();
                    MindexMp3Index.parse = parse;
                    return {duration:end, calibration:t.decoder.calibration, sourceReleased:true};
                }''', {'source':SOURCE, 'fingerprints':fingerprints, 'engine':engine})
                print(engine, 'PASS', result, flush=True)
                browser.close()
    finally:
        server.shutdown()

if __name__ == '__main__':
    main()
