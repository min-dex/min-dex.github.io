"""Offline saved scripture realtime; no production writes or native windows."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   context=browser.new_context()
   context.add_init_script('window.open=()=>null;Element.prototype.requestFullscreen=async()=>{}')
   context.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page=context.new_page();page.goto(url+'?mindexSmokeRaw=1',wait_until='load');page.wait_for_function('!!window.MINDEX_CONTENT_LIVE')
   page.evaluate("""()=>{
    state.config.url='scripture-fixture';state.module='scripture';state.loading=false;state.saving=false;state.presenter.outputPendingAt=0;
    window.live=false;window.reads=0;window.writes=0;window.renders=0;window.sent=[];window.notices=[];
    showToast=(...args)=>notices.push(args);isPresenterOutputWindowOpen=()=>live;sundayEditSyncHasLocalDraft=()=>false;canUseClientData=()=>true;
    state.dirty={song:false,forms:false,scripture:false,service:false,references:false};state.selectedServiceId=null;
    window.db=[{id:'s1',title:'Old',text:'First',is_active:true},{id:'s2',title:'Other',text:'Other text',is_active:true}];
    state.scriptures=db.map(normalizeServerScripture).sort(sortScriptures);state.uiVerses=extractUiVerses([]);state.selectedScriptureId='s1';state.scripturesLoaded=true;
    state.selectedBookCode='GEN';state.selectedBibleChapter=3;state.selectedBibleTranslationId='retained';state.selectedBibleVerses=[4,5];captureCleanFingerprint('scripture');
    state.client={channel:()=>({on(event,filter,fn){if(filter.event==='content-committed')window.receive=fn;return this},subscribe(fn){window.remoteStatus=fn;return this},send(m){sent.push(m);return Promise.resolve()}}),removeChannel:async()=>{},from(table){
      if(table!=='mindex_scriptures')throw Error('Unexpected table '+table);
      let patch=false,start=0,end=999;
      const q={select(){return q},order(){return q},eq(){return q},single(){return q},range(a,b){start=a;end=b;return q},update(){patch=true;return q},
      async then(resolve,reject){try{if(patch){writes++;return resolve(window.failWrite?{error:{message:'Rejected'}}:{data:structuredClone(db[0])})}
        reads++;const data=structuredClone(db.filter(r=>r.is_active).slice(start,end+1));if(window.onRead){const fn=onRead;onRead=null;fn()};return resolve(window.failRead?{error:{message:'Offline'}}:window.nullRead?{data:null}:{data})}catch(e){reject(e)}}};return q;}};
    document.body.innerHTML='<div id="pane" style="height:200px;overflow:auto"><div style="height:2000px">original</div></div><input id="draft">';refs.detailPane=document.getElementById('pane');refs.detailPane.scrollTop=320;
    renderScriptureDetail=()=>{renders++;refs.detailPane.innerHTML='<div style="height:2000px">updated</div>';refs.detailPane.scrollTop=0};render=()=>{};
    connectDepartmentRealtime();window.signal=()=>receive({payload:{id:createUuid(),project:state.config.url,kind:'scripture',recordId:'all'}});
   }""")
   page.evaluate("db[0].title='New';db[0].text='New body';signal()")
   page.wait_for_function("getSelectedScripture().text==='New body'")
   assert page.evaluate("refs.detailPane.scrollTop===320&&writes===0&&state.selectedBibleChapter===3&&state.selectedBibleTranslationId==='retained'&&state.selectedBibleVerses.join(',')==='4,5'")
   n=page.evaluate('renders');reads=page.evaluate('reads');page.evaluate('for(let i=0;i<100;i++)signal()');page.wait_for_timeout(500)
   assert page.evaluate('renders')==n and page.evaluate('reads')==reads+1
   page.evaluate("db[0].text='Deferred';document.getElementById('draft').focus();signal()")
   page.wait_for_timeout(300);assert page.evaluate("getSelectedScripture().text==='New body'")
   page.evaluate("document.activeElement.blur();state.dirty.scripture=true");page.wait_for_timeout(2100)
   assert page.evaluate("getSelectedScripture().text==='New body'")
   page.evaluate('state.dirty.scripture=false');page.wait_for_function("getSelectedScripture().text==='Deferred'")
   page.evaluate("db[0].text='Race';void(window.onRead=()=>{live=true});signal()")
   page.wait_for_function('live');assert page.evaluate("getSelectedScripture().text==='Deferred'")
   page.evaluate('live=false');page.wait_for_function("getSelectedScripture().text==='Race'")
   page.evaluate("db[0].text='After draft';void(window.onRead=()=>{getSelectedScripture().text='Local draft'});signal()")
   page.wait_for_function("getSelectedScripture().text==='Local draft'");page.wait_for_timeout(2200)
   assert page.evaluate("getSelectedScripture().text==='Local draft'")
   page.evaluate("captureCleanFingerprint('scripture')");page.wait_for_function("getSelectedScripture().text==='After draft'")
   page.evaluate("db.push({id:'new',title:'Created',text:'new',is_active:true});db[1].is_active=false;signal()")
   page.wait_for_function("state.scriptures.some(r=>r.id==='new')&&!state.scriptures.some(r=>r.id==='s2')")
   page.evaluate("db=[];signal()");page.wait_for_function("state.scriptures.length===1")
   assert page.evaluate("getSelectedScripture().id==='s1'&&notices.some(n=>n[0].includes('삭제'))")
   # Deleted selected item is removed once the user leaves it; reader DOM stays.
   page.evaluate("state.selectedScriptureId=null;captureCleanFingerprint('scripture');window.node=refs.detailPane.firstElementChild;signal()")
   page.wait_for_function('state.scriptures.length===0');assert page.evaluate('refs.detailPane.firstElementChild===node')
   page.evaluate("db=Array.from({length:1002},(_,i)=>({id:'row'+i,title:'row'+i,text:'body',is_active:true}));remoteStatus('SUBSCRIBED')")
   page.wait_for_function('state.scriptures.length===1002');assert page.evaluate('refs.detailPane.firstElementChild===node')
   page.evaluate("nullRead=true;db=[];signal()");page.wait_for_timeout(400);assert page.evaluate('state.scriptures.length')==1002
   page.evaluate("nullRead=false;state.module='home';signal()");reads=page.evaluate('reads');page.wait_for_timeout(2100);assert page.evaluate('reads')==reads
   page.evaluate("state.module='scripture';db=[{id:'s1',title:'Recovered',text:'Recovered',is_active:true}];remoteStatus('SUBSCRIBED')")
   page.wait_for_function('state.scriptures.length===1',timeout=20000)
   assert page.evaluate('writes')==0
   page.evaluate("async()=>{state.selectedScriptureId='s1';captureCleanFingerprint('scripture');await saveScripture();window.failWrite=true;await saveScripture()}")
   assert page.evaluate("sent.filter(x=>x.payload?.kind==='scripture').length")==1
   print('PASS',engine,'scripture save/body/create/soft-delete/delete, focus/draft/playback/after-read guards, reader DOM/scroll, no-op/coalescing, pagination, null response, recovery, confirmed writes only',flush=True)
   context.close();browser.close()
finally:server.shutdown()
