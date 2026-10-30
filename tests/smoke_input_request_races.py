import os,sys,json
from pathlib import Path
from urllib.parse import urlsplit
os.environ['MINDEX_SMOKE_OFFLINE']='1';
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch();page=b.new_page()
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc and r.request.method in ('GET','HEAD') else r.abort())
   page.goto(url);page.wait_for_function("typeof runLiveScriptureAction==='function'&&!document.body.classList.contains('ui-booting')")
   result=page.evaluate('''async()=>{
    state.module='home';let resolve;window.navigations=0;
    getScriptureSearchShortcut=()=>new Promise(r=>resolve=r);runScriptureSearchShortcut=async()=>{navigations++};
    const input=refs.searchInput,edit=value=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));};
    edit('요3:16');input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    edit('요3:17');edit('요3:16');resolve({type:'reference'});await new Promise(r=>setTimeout(r,0));
    const check=(v,m)=>{if(!v)throw Error(m)};check(navigations===0,'ABA query navigated');
    // Leaving and returning to the same module must not revive a pending Enter.
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    confirmSaveBeforeLeaving=async()=>true;runModuleEntryLoads=()=>{};
    await switchModule('praise',{clearSearch:false});await switchModule('home',{clearSearch:false});
    resolve({type:'reference'});await new Promise(r=>setTimeout(r,0));check(navigations===0,'roundtrip revived old search');
    // Only the latest intentional Enter may navigate, even with an unchanged query.
    const lookups=[];getScriptureSearchShortcut=()=>new Promise(r=>lookups.push(r));
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    lookups[1]({type:'reference'});lookups[0]({type:'reference'});await new Promise(r=>setTimeout(r,0));check(navigations===1,'duplicate Enter results');
    const globalStale=0;
    const sid='isolated-service';state.presenter.serviceId=sid;state.presenter.liveScripture={active:false,draft:'',reference:'',slide:null};
    const field=document.createElement('input');field.dataset.liveScriptureInput='';field.dataset.serviceId=sid;refs.detailPane.append(field);
    preparePresenterService=()=>{};isPresenterOutputWindowOpen=()=>false;let finish;buildLiveScriptureSlide=()=>new Promise(r=>finish=r);window.published=0;publishPresenterState=()=>{published++};renderPresenterControlState=()=>{};
    field.value='요3:16';field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
    field.value='요3:17';field.dispatchEvent(new Event('input',{bubbles:true}));finish({title:'요3:16',text:'fixture'});await new Promise(r=>setTimeout(r,0));
    check(published===0&&field.value==='요3:17','stale live verse or lost draft');
    for(const key of ['Enter','Escape'])field.dispatchEvent(new KeyboardEvent('keydown',{key,isComposing:true,bubbles:true,cancelable:true}));
    check(published===0,'IME caused output');
    field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));finish({title:'요3:17',text:'fixture'});await new Promise(r=>setTimeout(r,0));check(published===1&&state.presenter.liveScripture.reference==='요3:17','new verse not applied');
    let failure;window.messages=[];showToast=(message)=>messages.push(message);buildLiveScriptureSlide=()=>new Promise((_r,reject)=>failure=reject);
    field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));failure(Error('fixture offline'));await new Promise(r=>setTimeout(r,0));check(messages.includes('fixture offline')&&field.value==='요3:17'&&published===1,'failure lost input or emitted output');
    buildLiveScriptureSlide=async()=>({title:'요3:17',text:'retry'});field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,0));check(published===2,'retry failed');
    return {globalStaleNavigations:globalStale,liveStalePublications:0,successPublications:published,draft:field.value};
   }''');print(engine,json.dumps(result),flush=True);b.close()
finally:server.shutdown()
