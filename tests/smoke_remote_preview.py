"""Static preview isolation, stable heartbeat render and phone sizing."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   host=browser.new_page();host.goto(url);host.wait_for_function("typeof MindexRemote==='object' && !document.body.classList.contains('ui-booting')")
   packet=host.evaluate('''()=>{
    const sid='remote-preview';state.services=[{id:sid,type_id:'children',title:'어린이 예배',source_ref:{}}];
    state.selectedServiceId=sid;presenterControllerIsLive=()=>true;isPresenterOutputWindowOpen=()=>true;
    const output={closed:false};Object.assign(state.presenter,{serviceId:sid,outputSessionId:'preview',outputWindow:output,sourceSignature:'test',index:0,safetyBlank:false,slides:[{type:'lyrics',elementType:'praise',layout:'full-text',outputContext:'clean',title:'찬양',text:'기쁨으로 찬양해요\\n함께 노래해요'},{type:'image',elementType:'image',layout:'media',imageSrc:new URL('assets/presenter/cadaros-thumbnail.png',location.href).href}]});
    const adapter=MindexRemote.adapter(sid,'preview',output),value=adapter.read();
    if(!value.previewCurrent.includes('기쁨으로')||JSON.stringify(value).length>18000)throw Error('preview payload');
    if(value.previewCurrent!==adapter.read().previewCurrent)throw Error('unstable preview');
    state.presenter.safetyBlank=true;if(!adapter.read().previewCurrent.includes('background:#000'))throw Error('blackout');
    const render=renderPresenterSlideMiniPreview;
    const base=Object.getOwnPropertyDescriptor(document,'baseURI');
    try{
     Object.defineProperty(document,'baseURI',{configurable:true,value:'file:///fixture/renderer/index.html'});
     renderPresenterSlideMiniPreview=()=>`<span class="svc-slide-mini-output"><span class="svc-slide-mini-canvas presenter-output-root no-chromakey has-background" style="--presenter-bg-image:url('file:///fixture/renderer/assets/presenter/cadaros-thumbnail.png');--keep-token:80px;background-image:url('data:image/png,bad')">배경 보존</span><img src="file:///private/secret.png"></span>`;
     state.presenter.safetyBlank=false;state.presenter.sourceSignature='file-fixture';
     value.filePreview=adapter.read().previewCurrent;
     if(!value.filePreview.includes('https://min-dex.github.io/assets/presenter/cadaros-thumbnail.png')||value.filePreview.includes('file:')||value.filePreview.includes('data:')||!value.filePreview.includes('--keep-token: 80px'))throw Error('packaged image sanitization');
    }finally{renderPresenterSlideMiniPreview=render;if(base)Object.defineProperty(document,'baseURI',base);else delete document.baseURI;}
    return value;
   }''')
   phone=browser.new_page(viewport={'width':390,'height':844});phone.route('**/remote.mjs*',lambda r:r.fulfill(body='',content_type='text/javascript'))
   phone.goto(url.replace('index.html','remote.html'))
   phone.evaluate('''async packet=>{
    document.getElementById('controller').hidden=false;document.getElementById('pairForm').hidden=true;window.lucide.createIcons();
    const {createPreview}=await import('./remote.preview.mjs');window.draw=createPreview(document.getElementById('current'),'현재');
    window.packet=packet;draw(packet.previewCurrent,packet.current);
    createPreview(document.getElementById('next'),'다음')(packet.previewNext,packet.next);
   }''',packet)
   frame=phone.frame_locator('#current iframe');frame.locator('body').get_by_text('기쁨으로 찬양해요',exact=False).wait_for()
   phone.locator('#nextPreview summary').click()
   phone.frame_locator('#next iframe').locator('img').wait_for()
   phone.wait_for_timeout(300)
   assert phone.frame_locator('#next iframe').locator('img').evaluate('(el)=>el.complete && el.naturalWidth>0')
   phone.evaluate("window.loads=0;document.querySelector('#current iframe').addEventListener('load',()=>loads++);draw(packet.previewCurrent,packet.current)")
   phone.wait_for_timeout(100);assert phone.evaluate('loads')==0
   for theme in ('light','dark'):
    phone.emulate_media(color_scheme=theme)
    for width in (320,390,768):
     phone.set_viewport_size({'width':width,'height':844})
     assert phone.evaluate('document.documentElement.scrollWidth<=innerWidth')
     box=phone.locator('#current').bounding_box();assert abs(box['width']/box['height']-16/9)<.02
    phone.set_viewport_size({'width':390,'height':844})
    phone.screenshot(path='/tmp/mindex-remote-preview-'+engine+'-'+theme+'.png',full_page=True)
   from pathlib import Path
   phone.route('https://min-dex.github.io/assets/presenter/cadaros-thumbnail.png',lambda r:r.fulfill(path=str(Path(__file__).resolve().parents[1]/'assets/presenter/cadaros-thumbnail.png')))
   phone.evaluate("draw(packet.filePreview,'')")
   stage=phone.frame_locator('#current iframe').locator('.presenter-output-root')
   stage.get_by_text('배경 보존').wait_for()
   assert 'https://min-dex.github.io/assets/presenter/cadaros-thumbnail.png' in stage.evaluate("el=>getComputedStyle(el).getPropertyValue('--presenter-bg-image')")
   assert not phone.frame_locator('#current iframe').locator('img').get_attribute('src')
   phone.evaluate('''()=>{window.executed=false;draw('<script>parent.executed=true</script><img src="bad" onerror="parent.executed=true"><form action="/bad"></form>','');}''')
   phone.wait_for_timeout(200);assert not phone.evaluate('executed')
   assert phone.locator('#current iframe').get_attribute('sandbox')==''
   phone.evaluate("draw('x'.repeat(5501),'<script>unsafe</script>')")
   assert frame.locator('.remote-fallback').inner_text()=='<script>unsafe</script>'
   browser.close();print('PASS',engine,'real renderer payload, blackout, isolated scriptless preview, heartbeat stability, fallback and layouts',flush=True)
finally:server.shutdown()
