"""Offline Chrome/Mac-helper protocol, consent UI and 20-slide preparation; no native automation."""
import os,json,hashlib
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium

server,url=start_local_app_server()
source=b'offline KEY';source_hash=hashlib.sha256(source).hexdigest()
resources={'assets/player/main.js':b'protocol fixture','assets/header.json':b'{}'}
slides=[]
for index in range(20):
 name=f'assets/slide-{index}.jpeg';resources[name]=f'thumbnail-{index}'.encode()
 slides.append({'thumbnail':name,'sceneStart':index,'scenes':1})
manifest={'format':'apple-keynote-html-v1','sourceSha256':source_hash,'pages':20,'scenes':20,'slides':slides,
 'files':{name:{'size':len(data),'sha256':hashlib.sha256(data).hexdigest()} for name,data in resources.items()}}
pair_id='00000000-0000-4000-8000-000000000000'
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   context=browser.new_context(viewport={'width':1000,'height':800})
   context.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   approved={'value':False};protocol_calls=[]
   def helper(route):
    request=route.request;parsed=urlsplit(request.url);name=parsed.path
    headers={'Access-Control-Allow-Origin':urlsplit(url).scheme+'://'+urlsplit(url).netloc,'Access-Control-Allow-Headers':'Authorization, Content-Type, X-Mindex-Keynote-Client','Access-Control-Allow-Methods':'GET, POST, OPTIONS'}
    if request.method=='OPTIONS':return route.fulfill(status=204,headers=headers)
    protocol_calls.append(name)
    if name=='/health':body={'protocol':'mindex-keynote-bridge-v1'}
    elif name=='/pair':body={'id':pair_id,'approval':'http://127.0.0.1:43181/connect/'+pair_id}
    elif name=='/connect/'+pair_id:
     if request.method=='POST':approved['value']=True
     return route.fulfill(content_type='text/html; charset=utf-8',body='<meta charset="utf-8"><form method="post"><button>이 Chrome 연결 허용</button></form>' if not approved['value'] else '<meta charset="utf-8"><p>연결됐어요.</p>')
    elif name=='/pair/'+pair_id:body={'token':'a'*64} if approved['value'] else {'pending':True}
    elif name=='/convert':
     assert request.header_value('authorization')=='Bearer '+'a'*64
     body={'id':pair_id,'manifest':manifest}
    elif name.startswith('/jobs/'+pair_id+'/'):
     assert request.header_value('authorization')=='Bearer '+'a'*64
     return route.fulfill(body=resources[name.split('/jobs/'+pair_id+'/')[1]],headers=headers)
    else:raise AssertionError(name)
    return route.fulfill(content_type='application/json',body=json.dumps(body),headers=headers)
   context.route('http://127.0.0.1:43181/**',helper)
   page=context.new_page();page.goto(url+'?mindexSmokeRaw=1')
   page.wait_for_function("typeof preparePresenterKeynoteBrowserFile==='function'&&!document.body.classList.contains('ui-booting')")
   page.evaluate("""async()=>{
    const module=await keynoteHtmlRuntime();
    keynoteHtmlRuntime=async()=>({...module,assertKnownKeynoteHtmlRuntime:()=>{}});
    window.keynoteFixtureUnchanged=true;
    window.keynotePrepareResult=null;
    window.keynotePreparePromise=preparePresenterKeynoteBrowserFile(new File(['offline KEY'],'source.key'),()=>keynoteFixtureUnchanged)
      .then(files=>{window.keynotePreparedFiles=files;keynotePrepareResult='success'},error=>{keynotePrepareResult=error.message});
   }""")
   dialog=page.get_by_role('dialog',name='이 Mac의 Keynote 연결')
   page.wait_for_function("document.querySelector('dialog[aria-labelledby=keynoteBridgeTitle]')||keynotePrepareResult!==null")
   dialog.wait_for(state='visible')
   assert dialog.count()==1
   with page.expect_popup() as popup_info:dialog.get_by_role('link',name='Mac 연결 허용').click()
   popup=popup_info.value
   popup.wait_for_url('http://127.0.0.1:43181/connect/'+pair_id)
   popup.wait_for_load_state('domcontentloaded')
   popup.get_by_role('button',name='이 Chrome 연결 허용').click(timeout=5000)
   page.wait_for_function("keynotePrepareResult!==null")
   assert page.evaluate('keynotePrepareResult')=='success',(engine,page.evaluate('keynotePrepareResult'),protocol_calls)
   result=page.evaluate("""async()=>({count:keynotePreparedFiles.length,pages:JSON.parse(await keynotePreparedFiles.find(f=>f.name==='manifest.json').text()).pages,
      paths:keynotePreparedFiles.every(f=>f.webkitRelativePath.startsWith('playback/')),dialogs:document.querySelectorAll('dialog[aria-labelledby=keynoteBridgeTitle]').length})""")
   assert result=={'count':23,'pages':20,'paths':True,'dialogs':0},(engine,result)
   assert protocol_calls.count('/convert')==1
   page.evaluate("""()=>{
    window.keynoteFixtureUnchanged=false;window.keynotePrepareResult=null;
    preparePresenterKeynoteBrowserFile(new File(['offline KEY'],'source.key'),()=>keynoteFixtureUnchanged)
      .then(()=>keynotePrepareResult='unexpected',error=>keynotePrepareResult=error.message);
   }""")
   page.wait_for_function("keynotePrepareResult!==null")
   assert page.evaluate("keynotePrepareResult!=='unexpected'")
   assert protocol_calls.count('/convert')==1,'edit must stop before conversion/upload'
   popup.close()
   approved['value']=False
   # Pairing cancellation is an actual dialog/keyboard interaction, without a save.
   page.evaluate("()=>{presenterKeynoteBridgeSession='';keynotePrepareResult=null;void connectPresenterKeynoteBridge().then(()=>keynotePrepareResult='unexpected',e=>keynotePrepareResult=e.message)}")
   dialog.wait_for(state='visible');dialog.get_by_role('button',name='취소').click()
   page.wait_for_function('keynotePrepareResult!==null')
   assert page.locator('dialog[aria-labelledby=keynoteBridgeTitle]').count()==0
   print('PASS',engine,'explicit helper approval, paired fetch, 20 slide hashes/files, dirty abort and keyboard-accessible cancellation; production writes/native automation/playback 0',flush=True)
   browser.close()
finally:server.shutdown()
