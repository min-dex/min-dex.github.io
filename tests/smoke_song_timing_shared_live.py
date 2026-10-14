"""Production-origin sharing check with disposable Storage objects only; no DB access."""
import ast,hashlib,io,json,os,uuid,wave
from pathlib import Path
from urllib.parse import urlsplit
from smoke_app import sync_playwright,launch_chromium
source=ast.parse(Path(__file__).with_name('smoke_song_timing.py').read_text())
base_fixture=next(ast.literal_eval(n.value) for n in source.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='fixture' for t in n.targets))
url=os.environ.get('MINDEX_TIMING_URL','https://min-dex.github.io').rstrip('/')
buf=io.BytesIO()
with wave.open(buf,'wb') as w:
 w.setnchannels(1);w.setsampwidth(2);w.setframerate(8000);w.writeframes(b'\0\0'*8000*5)
with sync_playwright() as p:
 for engine in ('chromium','webkit'):
  browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
  song='timing-fixture-'+str(uuid.uuid4());fixture=base_fixture.replace("'timing-song'",repr(song))
  key=json.dumps([song,'timing-version'],separators=(',',':'))
  prefix='song-timing/v1/'+hashlib.sha256(key.encode()).hexdigest()
  owned=set();blocked=[];pages=[]
  def route(r):
   req=r.request;parts=urlsplit(req.url);path=parts.path
   if req.method=='GET' and (parts.netloc==urlsplit(url).netloc or req.url.startswith('blob:')):r.continue_();return
   if '/storage/v1/object/' in path:
    if req.method=='POST' and path.endswith('/list/mindex-worship-media') and req.post_data_json.get('prefix')==prefix:r.continue_();return
    marker='/mindex-worship-media/'+prefix+'/'
    if marker in path and req.method in ('GET','POST'):
     object_path=prefix+'/'+path.split(marker,1)[1]
     if '/' not in object_path[len(prefix)+1:] and object_path.endswith('.mindex-timing'):
      if req.method=='POST':owned.add(object_path)
      r.continue_();return
    if req.method=='DELETE' and path.endswith('/object/mindex-worship-media'):
     targets=req.post_data_json.get('prefixes',[])
     if targets and all(t in owned for t in targets):r.continue_();return
   blocked.append((req.method,path));r.abort()
  def setup():
   page=browser.new_context().new_page();pages.append(page);page.set_default_timeout(20000);page.route('**/*',route)
   page.goto(url+'/?output=presenter&mindexSmokeRaw=1');page.wait_for_function('!!globalThis.MindexSongTiming?.share && typeof buildPresenterSlidesForServiceItem === "function"')
   page.evaluate('''() => {
     const config=window.MINDEX_SUPABASE;
     window.fixtureBucket=(state.client || window.supabase.createClient(config.url,config.anonKey,{auth:{persistSession:false,autoRefreshToken:false}})).storage.from('mindex-worship-media');
   }''')
   page.evaluate(fixture)
   page.evaluate("state.client.storage={from(name){if(name!=='mindex-worship-media')throw Error('Wrong bucket');return window.fixtureBucket;}}")
   return page
  try:
   a=setup();b=setup()
   a.evaluate("MindexSongTiming.open('timing-fixture','timing-item')")
   a.locator('[data-timing-file]').set_input_files({'name':'disposable-silent-fixture.wav','mimeType':'audio/wav','buffer':buf.getvalue()})
   a.wait_for_function("Math.abs(document.querySelector('dialog audio').duration-5)<0.1")
   a.locator('[data-timing-start="0"]').fill('1');a.locator('[data-timing-start="1"]').fill('3')
   a.locator('[data-timing-share]').click()
   a.wait_for_function("!document.querySelector('[data-timing-share]').disabled")
   status=a.locator('[data-timing-status]').text_content();assert status.startswith('공유 저장했어요'),status
   assert len(owned)==1
   b.evaluate("MindexSongTiming.open('timing-fixture','timing-item')")
   b.locator('[data-timing-load-shared]').click()
   b.wait_for_function("!document.querySelector('[data-timing-load-shared]').disabled")
   status=b.locator('[data-timing-status]').text_content();assert status.startswith('공유 음원·타이밍을 이 컴퓨터에 저장'),status
   assert b.locator('[data-timing-start="1"]').input_value()=='3'
   b.locator('[data-timing-close]').click()
   b.evaluate("state.presenter.safetyBlank=false;state.presenter.liveScripture={active:false};state.presenter.index=presenterSlidesForService('timing-fixture').findIndex(s=>s.type==='lyrics');runServiceMusicAction('toggle');")
   b.wait_for_function('state.serviceMusic.playing && state.serviceMusic.audio.currentTime>0')
   b.evaluate('state.serviceMusic.audio.currentTime=2.1')
   b.wait_for_function('state.presenter.slides[state.presenter.index]?.syncTimeline?.page===2')
   b.evaluate('stopServiceMusicPlayback({render:false})')
   for page in (a,b):assert page.evaluate('JSON.stringify({songs:state.songs,items:state.serviceItems})===window.timingFixtureBefore')
   b.reload();b.wait_for_function('!!globalThis.MindexSongTiming && typeof buildPresenterSlidesForServiceItem === "function"');b.evaluate(fixture)
   assert b.evaluate("presenterSlidesForService('timing-fixture').some(s=>s.syncTimeline?.localTiming)")
   assert not [r for r in blocked if '/rest/v1/' in r[1]],blocked
   print(engine,'PASS actual Storage share -> independent browser load -> playback automatic advance -> reload; no song/service writes',flush=True)
  finally:
   if owned and pages:
    result=pages[0].evaluate('async paths=>{const r=await window.fixtureBucket.remove(paths);if(r.error)throw Error(r.error.message);return true;}',list(owned))
    assert result
    remaining=pages[0].evaluate('async prefix=>{const r=await window.fixtureBucket.list(prefix);if(r.error)throw Error(r.error.message);return r.data.length;}',prefix)
    assert remaining==0
    print(engine,'PASS disposable shared objects removed',flush=True)
   browser.close()
