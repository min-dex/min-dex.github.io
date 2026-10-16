"""Other-service scripture edits cannot alter live output or cancel its request."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1000,'height':800})
   page.route('**/*supabase*/**',lambda r:r.abort());page.goto(url,wait_until='load')
   page.wait_for_function("typeof runLiveScriptureAction==='function'")
   page.locator('#bootStatus').wait_for(state='hidden')
   print(engine,page.evaluate('''async()=>{
    const check=(v,m)=>{if(!v)throw Error(m)};
    const a={id:'live-a',type_id:'friday'},b={id:'edit-b',type_id:'sunday-main'};
    state.services=[a,b];state.presenter.serviceId=a.id;state.selectedServiceId=b.id;
    const live={active:true,draft:'요한복음 3:16',reference:'요한복음 3:16',slide:{title:'요한복음 3:16'}};state.presenter.liveScripture=live;
    isPresenterOutputWindowOpen=()=>true;let published=0;publishPresenterState=()=>published++;renderPresenterControlState=()=>{};
    const host=document.createElement('div');host.id='scope-fixture';host.style.cssText='display:flex;gap:20px;padding:20px';
    host.innerHTML=`<section style="width:320px"><h3>송출 중 예배</h3>${renderLiveScriptureControl(a.id)}</section><section style="width:320px"><h3>다른 예배 편집</h3>${renderLiveScriptureControl(b.id)}</section>`;document.body.replaceChildren(host);refreshIcons(host);
    const aInput=host.querySelector('[data-service-id="live-a"]'),bInput=host.querySelector('[data-service-id="edit-b"]');
    check(aInput.value==='요한복음 3:16'&&bInput.value==='','draft leaked');
    check(host.querySelector('[data-live-scripture-action="clear"][data-service-id="edit-b"]').disabled,'other clear enabled');
    updateLiveScriptureDraft('시편 23:1',b.id);bInput.value='시편 23:1';
    await runLiveScriptureAction('clear',b.id);await runLiveScriptureAction('show',b.id);
    check(state.presenter.serviceId===a.id&&state.presenter.liveScripture===live&&published===0,'other service interrupted output');
    check(state.presenterScriptureDrafts[b.id]==='시편 23:1'&&live.draft==='요한복음 3:16','draft ownership');
    let resolve;buildLiveScriptureSlide=()=>new Promise(r=>resolve=r);preparePresenterService=()=>{};
    const request=runLiveScriptureAction('show',a.id);await runLiveScriptureAction('clear',b.id);
    resolve({title:'요한복음 3:16',text:'검증 본문'});await request;
    check(state.presenter.liveScripture.active&&published===1,'foreign action cancelled owner request');
    await runLiveScriptureAction('clear',a.id);check(!state.presenter.liveScripture.active&&published===2,'owner clear failed');
    return 'PASS independent drafts, foreign show/clear no-op, uninterrupted owner request and output';
   }'''),flush=True)
   page.locator('#scope-fixture').screenshot(path=f'/tmp/mindex-live-scope-{engine}.png');browser.close()
finally:server.shutdown()
