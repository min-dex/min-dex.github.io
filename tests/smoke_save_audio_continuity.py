"""Save completion must preserve a playing inline audio element; no live DB."""
import os,io,wave
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
b=io.BytesIO()
with wave.open(b,'wb') as w:w.setnchannels(1);w.setsampwidth(2);w.setframerate(8000);w.writeframes(b'\0\0'*8000*20)
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page();page.route('**/save-fixture.wav',lambda r:r.fulfill(body=b.getvalue(),content_type='audio/wav'))
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof saveService==='function'");page.wait_for_function("!document.body.classList.contains('ui-booting')")
   print(engine,page.evaluate('''async()=>{
    requireClient=()=>true;commitActiveDeferredServiceTextInput=()=>{};applyPendingServiceSourceTextBeforeSave=()=>false;serviceSourceTextHasPendingChanges=()=>false;
    serviceInputSaveProblem=()=>null;saveDirtyServiceTypes=async()=>{};saveWorshipServiceInstance=async()=>({unchanged:true});serviceHasPendingTextEdits=()=>false;captureCleanFingerprint=()=>{};renderServiceList=()=>{};
    state.services=[{id:'audio-save',title:'fixture'}];state.selectedServiceId='audio-save';state.saving=false;
    let renders=0;render=()=>{renders++;refs.detailPane.innerHTML='replaced'};
    refs.detailPane.innerHTML='<audio controls src="/save-fixture.wav"></audio>';
    const audio=refs.detailPane.querySelector('audio');await audio.play();audio.currentTime=3;
    const before=audio.currentTime;let pauses=0;audio.addEventListener('pause',()=>pauses++);
    if(!await saveService('audio-save'))throw Error('save failed');
    await new Promise(r=>setTimeout(r,250));
    if(renders||!audio.isConnected||audio.paused||audio.currentTime<=before||pauses)throw Error('save interrupted audio');
    audio.pause();await saveService('audio-save');if(renders!==1)throw Error('paused save did not refresh');
    return 'PASS actual native playback continues through save; paused save refreshes';
   }'''),flush=True);browser.close()
finally:server.shutdown()
