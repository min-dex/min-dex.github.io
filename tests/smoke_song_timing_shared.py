"""Two independent browser profiles share timing through an isolated Storage double."""
import ast,io,os,wave
from pathlib import Path
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
source=ast.parse(Path(__file__).with_name('smoke_song_timing.py').read_text())
fixture=next(ast.literal_eval(n.value) for n in source.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='fixture' for t in n.targets))
server,url=start_local_app_server()
buf=io.BytesIO()
with wave.open(buf,'wb') as w:
 w.setnchannels(1);w.setsampwidth(2);w.setframerate(8000);w.writeframes(b'\0\0'*8000*5)
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   store={};corrupt=[False];fail_upload=[False]
   def upload(path,data):
    if fail_upload[0]: return {'error':{'message':'injected upload failure'}}
    assert path.startswith('song-timing/v1/') and path not in store
    store[path]=data
    return {'error':None}
   def download(path):
    data=list(store[path])
    if corrupt[0]: data[-1]^=1
    return data
   def setup(context):
    page=context.new_page();page.set_default_timeout(10000)
    page.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and (urlsplit(r.request.url).netloc==urlsplit(url).netloc or r.request.url.startswith('blob:')) else r.abort())
    page.expose_function('fixtureUpload',upload)
    page.expose_function('fixtureDownload',download)
    page.expose_function('fixtureList',lambda prefix:[{'name':path.split('/')[-1]} for path in reversed(store) if path.startswith(prefix+'/')][:1])
    page.on('dialog',lambda dialog:dialog.accept())
    return page
   def initialize(page):
    page.goto(url+'?output=presenter&mindexSmokeRaw=1');page.wait_for_function('!!globalThis.MindexSongTiming && typeof buildPresenterSlidesForServiceItem === "function"')
    page.evaluate(fixture)
    page.evaluate('''() => {state.client.storage={from(bucket){if(bucket!=='mindex-worship-media')throw Error('wrong bucket');return {
      async upload(path,blob,options){if(options.upsert!==false)throw Error('overwrite');return fixtureUpload(path,Array.from(new Uint8Array(await blob.arrayBuffer())));},
      async list(prefix){return {data:await fixtureList(prefix)};},
      async download(path){return {data:new Blob([new Uint8Array(await fixtureDownload(path))])};}
    }}};}''')
   try:
    a=setup(browser.new_context());b=setup(browser.new_context());initialize(a);initialize(b)
    a.evaluate("MindexSongTiming.open('timing-fixture','timing-item')")
    a.locator('[data-timing-file]').set_input_files({'name':'shared.wav','mimeType':'audio/wav','buffer':buf.getvalue()})
    a.wait_for_function("Math.abs(document.querySelector('dialog audio').duration-5)<0.1")
    a.locator('[data-timing-start="0"]').fill('1');a.locator('[data-timing-start="1"]').fill('3')
    a.locator('[data-timing-share]').click();a.wait_for_function("document.querySelector('[data-timing-status]').textContent.startsWith('공유 저장했어요')")
    assert len(store)==1
    assert not b.evaluate("presenterSlidesForService('timing-fixture').some(s=>s.syncTimeline?.localTiming)")
    b.evaluate("MindexSongTiming.open('timing-fixture','timing-item')")
    b.locator('[data-timing-load-shared]').click();b.wait_for_function("document.querySelector('[data-timing-status]').textContent.startsWith('공유 음원·타이밍을 이 컴퓨터에 저장')")
    assert b.locator('[data-timing-start="1"]').input_value()=='3'
    b.locator('[data-timing-close]').click()
    b.evaluate("state.presenter.safetyBlank=false;state.presenter.liveScripture={active:false};state.presenter.index=presenterSlidesForService('timing-fixture').findIndex(s=>s.type==='lyrics');runServiceMusicAction('toggle');")
    b.wait_for_function('state.serviceMusic.playing && state.serviceMusic.audio.currentTime>0')
    b.evaluate('state.serviceMusic.audio.currentTime=2.1')
    b.wait_for_function('state.presenter.slides[state.presenter.index]?.syncTimeline?.page===2')
    b.evaluate('stopServiceMusicPlayback({render:false})')
    initialize(b)
    assert b.evaluate("presenterSlidesForService('timing-fixture').some(s=>s.syncTimeline?.localTiming)")
    b.evaluate("MindexSongTiming.open('timing-fixture','timing-item')")
    corrupt[0]=True;b.locator('[data-timing-load-shared]').click()
    b.wait_for_function("document.querySelector('[data-timing-status]').textContent.includes('검증에 실패')")
    assert b.locator('[data-timing-start="1"]').input_value()=='3'
    corrupt[0]=False;fail_upload[0]=True;b.locator('[data-timing-share]').click()
    b.wait_for_function("document.querySelector('[data-timing-status]').textContent.includes('injected upload failure')")
    assert len(store)==1
    for page in (a,b):
     assert page.evaluate('JSON.stringify({songs:state.songs,items:state.serviceItems})===window.timingFixtureBefore')
    print(engine,'PASS independent-profile share/load/reload, exact audio, real auto-advance, corruption/upload-failure preservation and immutable worship/song data',flush=True)
   finally:browser.close()
finally:server.shutdown()
