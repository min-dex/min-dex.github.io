"""Synthetic split-media playback in opaque frames; no Keynote/user files or writes."""
import os,json,hashlib,unicodedata
from pathlib import Path
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
raw=(Path(__file__).parent/'fixtures/media-fit-landscape.mp4').read_bytes()
step=(len(raw)+2)//3
parts=[raw[i:i+step] for i in range(0,len(raw),step)]
name=unicodedata.normalize('NFD','assets/섬김.mp4')
media={'path':name,'size':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'parts':[{'path':f'assets/mindex-parts/0/part-{i+1}.bin','size':len(b),'sha256':hashlib.sha256(b).hexdigest()} for i,b in enumerate(parts)]}
server,entry=start_local_app_server()
base=entry.rsplit("/index.html",1)[0]
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   for mode in ('success','corrupt','truncated','whole-hash','path'):
    context=browser.new_context();network=[]
    def offline(route):
     value=route.request.url;network.append(value)
     if value.startswith(('blob:','data:')) or (route.request.method=='GET' and urlsplit(value).netloc==urlsplit(base).netloc):route.continue_()
     else:route.abort()
    context.route('**/*',offline);page=context.new_page();requests=[]
    def serve(route):
     assert urlsplit(route.request.url).netloc==urlsplit(base).netloc
     path=route.request.url.split('/deck/')[-1];index=int(path.split('part-')[-1].split('.')[0])-1
     requests.append(path);body=parts[index]
     if index==0 and mode=='corrupt':body=bytes([body[0]^1])+body[1:]
     if index==0 and mode=='truncated':body=body[:-1]
     route.fulfill(status=200,body=body,headers={'Access-Control-Allow-Origin':'*','Content-Type':'application/octet-stream'})
    page.route('**/deck/assets/mindex-parts/**',serve)
    page.route('**/media-parts-host',lambda r:r.fulfill(status=200,content_type='text/html',body='<title>isolated Keynote media host</title>'))
    page.goto(base+'/media-parts-host',wait_until='domcontentloaded')
    value=json.loads(json.dumps(media))
    if mode=='whole-hash':value['sha256']='0'*64
    if mode=='path':value['parts'][0]['path']='../private.bin'
    page.evaluate('''async ({media,base})=>{
     const module=await import('./mindex.keynote-html-engine.mjs');window.partMessages=[];
     addEventListener('message',e=>{const frame=document.querySelector('#parts');if(e.source!==frame?.contentWindow)return;partMessages.push(e.data);if(e.data.kind==='ready')frame.contentWindow.postMessage({type:'mindex-keynote-html-command',token:'00000000-0000-4000-8000-000000000000',request:{id:'media-start',action:'play'}},'*')});
     const path=JSON.stringify(media.path);
     const source=`let UC;window.playerStarted=0;window.fixtureRevoked=[];const originalRevoke=URL.revokeObjectURL;URL.revokeObjectURL=value=>{window.fixtureRevoked.push(value);originalRevoke.call(URL,value)};class Eg{constructor(){this.delegate={setPlaybackReadyHandler:f=>f()}}startShow(){window.playerStarted++;this.state='IdleAtInitialState';this.currentSceneIndex=0;this.currentSlideIndex=0;this.nextSceneIndex=-1;this.script={numScenes:1,slideList:['one'],events:[{effects:[]}]};this.scriptManager={slideIndexFromSceneIndex:()=>0};const v=document.createElement('video');v.id='split-media';v.muted=true;v.preload='auto';v.onloadeddata=()=>parent.postMessage({type:'part-fixture',width:v.videoWidth,src:v.src,canonical:window.__mindexKeynoteOriginalMediaSource(v.src)},'*');v.onerror=()=>parent.postMessage({type:'part-fixture-error',code:v.error.code,src:v.src,attribute:v.getAttribute('src'),canonical:window.__mindexKeynoteOriginalMediaSource?.(v.src),revoked:window.fixtureRevoked||[]},'*');v.setAttribute('src',${path});document.body.append(v);void v.play();}}window.addEventListener('load',()=>{UC=new Eg;UC.delegate.setPlaybackReadyHandler((function(){UC.startShow()}));});function unused(){UC.isFullscreen||A>this.showWidth&&(A=this.showWidth);return {url:Q,cMapUrl:_C}}const worker={};worker.workerSrc="./assets/player/pdfjs/pdf.worker.min.js";`;
     const frame=document.createElement('iframe');frame.id=frame.name='parts';frame.setAttribute('sandbox','allow-scripts');frame.setAttribute('allow','autoplay *');
     frame.srcdoc=module.keynoteFrameDocument({baseUrl:base+'/deck/manifest.json',player:module.patchKeynoteHtmlPlayer(source),token:'00000000-0000-4000-8000-000000000000',bridge:module.keynoteHtmlFrameBridge,mediaFiles:[media]});document.body.append(frame);
    }''',{'media':value,'base':base})
    if mode=='success':
     page.wait_for_function("partMessages.some(m=>m.type==='part-fixture'||m.type==='part-fixture-error'||m.phase==='media-preparation')",timeout=20000)
     observed=page.evaluate('partMessages');assert any(m.get('type')=='part-fixture' for m in observed),(engine,mode,requests,observed)
     result=page.evaluate("partMessages.find(m=>m.type==='part-fixture')")
     assert result['width']>0 and result['src'].startswith('blob:'),(engine,result)
     expected=page.evaluate('(value)=>new URL(value,location.origin+"/deck/").href',name)
     assert result['canonical']==expected,(engine,result)
     page.wait_for_function("partMessages.some(m=>m.kind==='ready'&&m.checkpoint?.media.length)")
     checkpoint=page.evaluate("partMessages.find(m=>m.kind==='ready').checkpoint")
     assert checkpoint['media'][0]['src']==expected,(engine,checkpoint)
     frame=page.frame(name='parts')
     assert frame.evaluate('''value=>{const v=document.querySelector('video'),s=document.createElement('source');v.src=value;s.src=value;return v.src.startsWith('blob:')&&s.src.startsWith('blob:')}''',expected)
     assert frame.evaluate("()=>{let n=0;const revoke=URL.revokeObjectURL;URL.revokeObjectURL=value=>{n++;revoke.call(URL,value)};dispatchEvent(new Event('pagehide'));return n}")==1
     assert len(requests)==len(parts)
    else:
     page.wait_for_function("partMessages.some(m=>m.kind==='error'&&m.phase==='media-preparation')",timeout=20000)
     assert page.frame(name='parts').evaluate('window.playerStarted')==0,(engine,mode)
     assert not page.evaluate("partMessages.some(m=>m.type==='part-fixture')")
     if mode=='path':assert not requests
    assert not [u for u in network if not u.startswith(('blob:','data:')) and urlsplit(u).netloc!=urlsplit(base).netloc],(engine,network)
    context.close()
   browser.close();print('PASS',engine,'opaque split-media decode, canonical checkpoints, cleanup and corrupt/truncated/full-hash/path rejection; user files/uploads/writes 0',flush=True)

finally:server.shutdown();server.server_close()
