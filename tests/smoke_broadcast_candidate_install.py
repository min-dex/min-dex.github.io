"""Native unsigned test installer acceptance. Synthetic signals in a disposable profile."""
import json, os, pathlib, re, subprocess, sys, tempfile, time
from playwright.sync_api import sync_playwright
root=pathlib.Path(__file__).resolve().parents[1]
dmg=pathlib.Path(sys.argv[1]).resolve(strict=True)
sha=subprocess.check_output(['git','-C',str(root),'rev-parse','HEAD'],text=True).strip()
with tempfile.TemporaryDirectory() as temp:
 if sys.platform=='win32':
  assert os.environ.get('GITHUB_ACTIONS')=='true' and dmg.suffix=='.exe'
  subprocess.run([str(dmg),'/S','/currentuser'],check=True,timeout=240)
  exe,=(pathlib.Path(os.environ['LOCALAPPDATA'])/'Programs').glob('*/Mindex Test.exe')
  for file in ('mindex-receiver.exe','ffmpeg.exe'):
   assert (exe.parent/'resources'/'broadcast-engine'/file).is_file()
 else:
  mount=pathlib.Path(temp)/'disk';mount.mkdir()
  subprocess.run(['hdiutil','verify',str(dmg)],stdout=subprocess.DEVNULL,check=True)
  subprocess.run(['hdiutil','attach','-readonly','-nobrowse','-mountpoint',str(mount),str(dmg)],check=True,stdout=subprocess.DEVNULL)
  try:
   app=next(mount.glob('*.app')); copy=pathlib.Path(temp)/app.name
   subprocess.run(['ditto',str(app),str(copy)],check=True)
  finally: subprocess.run(['hdiutil','detach',str(mount)],check=True,stdout=subprocess.DEVNULL)
  exe=copy/'Contents/MacOS/Mindex Test'
 with tempfile.TemporaryFile(mode='w+') as log:
  proc=subprocess.Popen([str(exe),'--remote-debugging-port=0'],env={**os.environ,'MINDEX_ISOLATED_TEST':'1'},stdout=log,stderr=log)
  try:
   for _ in range(300):
    log.seek(0);s=log.read();match=re.search(r'DevTools listening on (ws://[^\s]+)',s)
    if match:break
    if proc.poll() is not None:raise RuntimeError(s[-1300:])
    time.sleep(.2)
   assert match
   with sync_playwright() as p:
    browser=p.chromium.connect_over_cdp(match[1]);ctx=browser.contexts[0];ctx.set_default_timeout(12000)
    page=next((t for t in ctx.pages if 'index.html' in t.url),None) or ctx.pages[0]
    page.wait_for_function("location.protocol==='file:' && typeof render==='function' && !document.body.classList.contains('ui-booting')",timeout=45000)
    record=page.evaluate("""async()=>await (await fetch('mindex-build.json')).json()""")
    assert record['sourceCommit']==sha and record['channel']=='test',record
    def until(target, expr, **opts):
     end=time.monotonic()+opts.get('timeout',12000)/1000
     while time.monotonic()<end:
      if target.evaluate(expr):return
      target.wait_for_timeout(70)
     raise AssertionError((expr,target.url,target.locator('body').inner_text()[:250],errors))
    before=page.evaluate('JSON.stringify([state.presenter,state.serviceMusic])')
    with ctx.expect_page() as opened: page.locator('[data-broadcast-lab]:visible').click(timeout=12000)
    lab=opened.value
    errors=[];lab.on('pageerror',lambda error:errors.append(str(error)))
    until(lab,'window.broadcastPrototype && document.fonts.status==="loaded"')
    assert 'app.asar/tools/broadcast-prototype/index.html' in lab.url and lab.evaluate('typeof window.mindexElectron')=='undefined'
    lab.locator('#pause').click();lab.locator('#follow').click()
    page.evaluate("""()=>{window.fixtureChannel=new BroadcastChannel('mindex.presenter');
     window.fixtureState={serviceId:'offline-rehearsal',outputSessionId:'lab',snapshotId:'both',index:0,
     slides:[{type:'lyrics',elementType:'praise',text:'첫 번째 노래'},{type:'lyrics',elementType:'praise',text:'다른 가사를 함께 불러요'}]};
     fixtureChannel.postMessage({type:'presenter-state',payload:{...fixtureState,updatedAt:Date.now(),messageId:'fixture:1'}})}""")
    until(lab,'document.querySelector("#followStatus").textContent.includes("1장")',timeout=8000)
    lab.wait_for_timeout(850)
    def pixels():
     return lab.evaluate("""()=>['program','broadcast'].map(id=>{const d=document.getElementById(id).getContext('2d').getImageData(0,0,1280,720).data;let lo=720,hi=0,hash=0;
       for(let y=120;y<720;y++)for(let x=60;x<1220;x++){let i=(y*1280+x)*4;if(Math.min(d[i],d[i+1],d[i+2])>235){lo=Math.min(lo,y);hi=y;hash=(hash*31+x+y)|0;}}return [lo,hi,hash]})""")
    first=pixels()
    page.evaluate("fixtureChannel.postMessage({type:'presenter-navigation',payload:{snapshotId:'both',index:1,updatedAt:Date.now(),messageId:'fixture:2'}})")
    until(lab,'document.querySelector("#followStatus").textContent.includes("2장")');lab.wait_for_timeout(120)
    second=pixels()
    for hall,yt in (first,second): assert 200<hall[0]<hall[1]<520 and 510<yt[0]<yt[1]<710 and hall[1]-hall[0]>1.4*(yt[1]-yt[0])
    assert all(a[2]!=b[2] for a,b in zip(first,second))
    ctx.set_default_timeout(10000)
    with ctx.expect_page(timeout=10000) as popup:lab.locator('#hallOutputOpen').click()
    hall=popup.value;until(hall,'typeof window.attachHallOutput==="function"')
    until(hall,"document.querySelector('canvas').toDataURL()===opener.document.querySelector('#program').toDataURL()")
    lab.locator('#excludeBroadcast').click()
    assert not lab.evaluate('broadcastPrototype.routing().broadcast')
    lab.wait_for_timeout(80)
    assert pixels()[0]==second[0] and pixels()[1]!=second[1]
    if lab.locator('#engineTest').is_visible():
     import io, math, struct, wave
     signal=io.BytesIO()
     with wave.open(signal,'wb') as wav:
      wav.setparams((1,2,16000,0,'NONE',''))
      wav.writeframes(b''.join(struct.pack('<h',round(4500*math.sin(i*2*math.pi*440/16000))) for i in range(16000)))
     lab.bring_to_front()
     lab.locator('#file').set_input_files({'name':'test-tone.wav','mimeType':'audio/wav','buffer':signal.getvalue()})
     until(lab,"broadcastPrototype.stats().source==='file'")
     for excluded in (True,False):
      if not excluded:lab.locator('#excludeBroadcast').click()
      expected=lab.evaluate("Array.from(document.getElementById('broadcast').getContext('2d').getImageData(10,10,1,1).data).slice(0,3)")
      lab.locator('#engineRun').click()
      until(lab,"!document.getElementById('engineRun').disabled",timeout=45000)
      receipt=lab.locator('#engineStatus').inner_text()
      assert '1280×720 · H.264 / AAC · TLS 인증서 확인' in receipt,receipt
      assert ('무음' if excluded else '음성 신호 있음') in receipt,receipt
      received=json.loads(lab.locator('#engineStatus').get_attribute('data-receipt'))
      assert received['externalPublishing'] is False and received['certificateVerified'] and received['receivedBytes']>0
      assert max(abs(a-b) for a,b in zip(received['pixel'],expected))<=10,(expected,received)
      assert received['audioPeak']==0 if excluded else received['audioPeak']>.01
      print(json.dumps(dict(excluded=excluded,expectedPixel=expected,receipt=received)),flush=True)
     assert lab.evaluate('broadcastPrototype.stats().source')=='file'
    elif os.environ.get('MINDEX_EXPECT_LOCAL_ENCODER')=='1':
     raise AssertionError('packaged encoder is missing')
    lab.close();hall.wait_for_event('close') if not hall.is_closed() else None
    with ctx.expect_page() as again:page.locator('[data-broadcast-lab]:visible').click()
    lab=again.value;until(lab,'window.broadcastPrototype');assert lab.evaluate('broadcastPrototype.routing().broadcast')
    lab.close()
    assert before==page.evaluate('JSON.stringify([state.presenter,state.serviceMusic])')
    assert not errors,errors
    print('PASS packaged candidate dual lyrics; one navigation, independent exclusion, CH8 popup, close/reopen, isolated host unchanged',flush=True)
    print(json.dumps(dict(sha=sha,title=page.title(),version=record['productVersion'],channel=record['channel'],module=page.evaluate('state.module'),dmg=str(dmg)),ensure_ascii=False))
  finally:
   if proc.poll() is None:proc.terminate();proc.wait(timeout=15)
