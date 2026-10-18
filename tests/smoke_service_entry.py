import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1280,'height':900})
   page.add_init_script('Element.prototype.requestFullscreen=async()=>{};window.open=()=>null')
   page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url+'?mindexSmokeRaw=1',wait_until='load')
   page.wait_for_function("!!window.MINDEX_SERVICE_ENTRY")
   print(engine,page.evaluate('''async()=>{
    const check=(v,m)=>{if(!v)throw Error(m)};
    const realDirty=hasDirtyChanges, realCapture=captureCleanFingerprint;
    const sid='dddddddd-dddd-4ddd-8ddd-dddddddddddd',sec='eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    let dirty=false,live=false,gate=null,entered=null,fail=false,renders=0,reads=0;
    state.client={};state.module='service';state.selectedServiceId=sid;state.loading=false;state.saving=false;state.presenter.outputPendingAt=0;
    state.presenterPreparationDrafts={};state.presenterPreparationApplyingServiceIds.clear();
    pendingSundayEditSync.clear();state.dirtyServiceElementIds.clear();state.dirtyServiceStructureIds.clear();state.dirtyServiceTypeIds.clear();
    hasDirtyChanges=()=>dirty;isPresenterOutputWindowOpen=()=>live;render=()=>{renders++};showToast=()=>{};captureCleanFingerprint=()=>{};
    state.services=[{id:sid,title:'old',type_id:'test'},{id:'other',title:'retain'}];state.serviceItems={[sid]:[]};state.serviceTypes=[];state.worshipSections=[];state.worshipElements=[];
    worshipElementListSelect=async()=>'*';
    const rows={mindex_worship_services:[{id:sid,title:'fresh',service_date:'2026-10-18',service_type_id:'test'}],mindex_worship_sections:[{id:sec,service_id:sid,title:'찬양',section_key:'praise',sort_order:1}],mindex_worship_elements:[{id:'ffffffff-ffff-4fff-8fff-ffffffffffff',section_id:sec,element_type:'praise',sort_order:1,config:{manualLyrics:'사용자 가사',formHint:'V2-C-V1-C'},source_ref:{label:'찬양'}}],mindex_worship_presenter_slides:[]};
    fetchSupabasePaged=async(table,sel,build)=>{reads++;let result=structuredClone(rows[table]||[]);const q={in:(key,ids)=>{result=result.filter(r=>ids.includes(r[key]));return q},order:()=>q};build(q);if(entered){entered();entered=null}if(gate)await gate;if(fail)throw Error('fixture');return result};
    const run=()=>MINDEX_SERVICE_ENTRY.check(sid);
    const hold=()=>{let release;gate=new Promise(r=>release=r);return {started:new Promise(r=>entered=r),release:()=>{gate=null;release()}}};
    const presenter=JSON.stringify(state.presenter),songs=JSON.stringify(state.songs),music=state.serviceMusic;
    dirty=true;check(await run()===false&&reads===0,'dirty read');dirty=false;
    live=true;check(await run()===false&&reads===0,'live read');live=false;
    let h=hold(),pending=run();await h.started;check(await run()===false,'duplicate');document.dispatchEvent(new Event('input'));h.release();check(await pending===false&&renders===0,'edit race');
    h=hold();pending=run();await h.started;state.selectedServiceId='other';h.release();check(await pending===false,'navigation race');state.selectedServiceId=sid;
    h=hold();pending=run();await h.started;live=true;h.release();check(await pending===false,'output race');live=false;
    fail=true;check(await run()===false&&state.services[0].title==='old','partial failure');fail=false;
    check(await run()===true,'refresh failed');check(state.services[0].title==='fresh'&&state.services[1].title==='retain','scope');
    check(state.worshipElements[0].config.formHint==='V2-C-V1-C','manual form');
    check(JSON.stringify(state.presenter)===presenter&&JSON.stringify(state.songs)===songs&&state.serviceMusic===music,'transport or song modified');
    check(!document.getElementById('refreshDbBtn'),'button remains');
    // Background tab refresh adopts the same atomic revision as the visible model.
    let duringAtomic=null;
    const aggregate={revision:'2',service:{...rows.mindex_worship_services[0],title:'atomic fresh'},sections:rows.mindex_worship_sections,elements:rows.mindex_worship_elements,slides:[]};
    state.client={rpc:async()=>{if(duringAtomic)duringAtomic();return {data:structuredClone(aggregate)}}};
    check(await MINDEX_SERVICE_ENTRY.check(sid,undefined,{background:true}),'background refresh');
    const atomic=await worshipAtomicClient();
    check(atomic.baseline(sid).revision==='2'&&state.services[0].title==='atomic fresh','model/revision mismatch');
    duringAtomic=()=>document.dispatchEvent(new Event('input'));aggregate.revision='3';aggregate.service.title='must defer';
    check(await MINDEX_SERVICE_ENTRY.check(sid,undefined,{background:true})===false,'late input accepted');
    check(atomic.baseline(sid).revision==='2'&&state.services[0].title==='atomic fresh','late input changed baseline');
    duringAtomic=()=>{state.serviceMusic.playing=true};
    check(await MINDEX_SERVICE_ENTRY.check(sid,undefined,{background:true})===false,'late playback accepted');
    check(atomic.baseline(sid).revision==='2'&&state.services[0].title==='atomic fresh','late playback changed baseline');
    state.serviceMusic.playing=false;duringAtomic=null;

    // Exercise actual tab activation with an isolated route renderer, no save or network writes.
    confirmSaveBeforeLeaving=async()=>true;syncActivePageTabState=()=>{};
    state.pageTabs=[{id:'tab-a',snapshot:{selectedServiceId:sid}},{id:'tab-b',snapshot:{selectedServiceId:'other'}}];state.pageTabIndex=0;
    applyPageTabSnapshot=async i=>{state.selectedServiceId=state.pageTabs[i].snapshot.selectedServiceId;};
    const tabs=document.createElement('div');tabs.innerHTML='<button>A</button><button>B</button>';document.body.append(tabs);
    let tabTurn;tabs.children[0].onclick=()=>{tabTurn=activatePageTab(0)};tabs.children[1].onclick=()=>{tabTurn=activatePageTab(1)};
    h=hold();pending=MINDEX_SERVICE_ENTRY.enter(sid);await h.started;
    tabs.children[1].click();await tabTurn;tabs.children[0].click();await tabTurn;
    const renderCount=renders;h.release();check(await pending===false&&renders===renderCount,'obsolete A response applied after tab return');
    // Same-service click must preserve draft baseline, explicit selections and live DOM/caret.
    hasDirtyChanges=realDirty;captureCleanFingerprint=realCapture;
    serviceNavigationBlocked=()=>false;rememberSetlistArchiveHistory=()=>{};markWorshipServiceExplicitlyRequested=()=>{};renderCurrentServiceModuleDetail=()=>{throw Error('reselection rerendered')};renderServiceList=()=>{};syncBrowserHistory=()=>{};
    Object.keys(state.dirty).forEach(k=>state.dirty[k]=false);state.module='service';state.selectedServiceId=sid;state.loadedWorshipServiceIds.add(sid);
    state.serviceItems[sid]=[{id:'manual',song_id:'chosen-song',song_version_id:'chosen-version',memo:serializeServiceItemMemo({formHint:'V2-C-V1-C',inputMode:'lyrics_db'})}];
    captureCleanFingerprint('service');const baseline=state.cleanFingerprints.service;state.services[0].title='unsaved edit';state.dirty.service=true;
    const editor=document.createElement('textarea');editor.dataset.serviceItemField='raw_title';editor.dataset.initialValue='saved';editor.value='typed but not committed';document.body.append(editor);editor.focus();editor.setSelectionRange(3,7);
    const items=JSON.stringify(state.serviceItems[sid]),button=document.createElement('button');button.onclick=()=>selectService(sid);document.body.append(button);button.click();
    check(hasDirtyChanges({reconcile:true})&&state.cleanFingerprints.service===baseline,'draft re-baselined');
    check(editor.isConnected&&editor.value==='typed but not committed'&&editor.selectionStart===3,'DOM draft lost');
    check(JSON.stringify(state.serviceItems[sid])===items,'manual song/version/form lost');
    state.module='presenter';state.presenter.viewServiceId=sid;await openServiceInPresenter(sid);
    check(state.cleanFingerprints.service===baseline&&JSON.stringify(state.serviceItems[sid])===items&&editor.isConnected,'presenter reselection lost draft');
    return 'PASS entry races, real reselection/tab handlers, draft DOM/baseline and chosen song/version/form preservation';
   }'''),flush=True)
   page.evaluate('''()=>{state.module='presenter';document.body.classList.remove('ui-booting');document.documentElement.classList.remove('ui-booting');document.querySelectorAll('.boot-screen,#bootScreen,#bootStatus').forEach(e=>e.remove());document.body.dataset.module='presenter';renderGlobalPlaybackControls();const host=document.createElement('main');host.style.cssText='position:fixed;top:100px;left:300px;width:300px';host.innerHTML=renderWorshipSetlistLeaderEditor({id:'fixture',leader:'김광한 전도사'});document.body.append(host);window.testLeader=host.querySelector('input');}''')
   for width in (1280,800):
    page.set_viewport_size({'width':width,'height':900})
    page.evaluate('''()=>{const c=getComputedStyle(testLeader);if(c.paddingLeft!=='10px'||c.paddingRight!=='10px'||testLeader.scrollWidth>testLeader.clientWidth+1)throw Error('leader clipping');const bar=document.querySelector('.topbar-actions').getBoundingClientRect();if(bar.width<100||bar.height<20)throw Error('toolbar hidden');const items=[...document.querySelectorAll('.topbar-actions > *')].filter(e=>e.getBoundingClientRect().width&&getComputedStyle(e).display!=='none');if(items.some(e=>e.getBoundingClientRect().right>bar.right+1))throw Error('toolbar overflow');}''')
   page.screenshot(path='/tmp/service-entry-'+engine+'.png');browser.close()
finally:server.shutdown()
