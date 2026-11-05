"""Initial rows are scoped; archived services retain lazy templates and saved content."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import launch_chromium, start_local_app_server, sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page()
   page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url,wait_until='load')
   page.wait_for_function("typeof state!=='undefined'&&!document.body.classList.contains('ui-booting')")
   result=page.evaluate('''async()=>{
    const check=(ok,msg)=>{if(!ok)throw Error(msg)};
    // Metadata lookup must select the same version without running any builders.
    const originalRender=render;
    const build=materializePublicWorshipTemplate;
    for(const type of Object.keys(PUBLIC_WORSHIP_TEMPLATE_VERSIONS)) {
     for(const date of ['2025-01-01','2026-10-11','2026-10-18','2027-01-01']) {
      const service={id:'version',type_id:type,date};
      const expected=build(type,{service})?.version||null;
      check(resolvePublicWorshipTemplateVersion(type,{service})===expected,'version mismatch '+type+date);
     }
    }
    materializePublicWorshipTemplate=()=>{throw Error('metadata built full template')};
    resolvePublicWorshipTemplateVersion('sunday-main',{service:{date:'2026-10-18'}});
    materializePublicWorshipTemplate=build;
    state.module='home';state.selectedServiceId=null;state.presenter.serviceId=null;
    const today=toLocalDateStr(new Date());
    const rows=Array.from({length:200},(_,i)=>({id:'archive-'+i,service_date:'2025-01-05',service_type_id:'young-adult'}));
    rows.push({id:'current',service_date:today,service_type_id:'young-adult'});
    fetchCachedSupabasePaged=async()=>[];fetchWorshipServiceListRows=async()=>rows;
    fetchWorshipRowsForServiceIds=async ids=>{check(JSON.stringify(ids)==='["current"]','wrong preload scope');return {sections:[],elements:[]}};
    hydrateSupplementalWorshipDataAfterInitialRender=async()=>{};
    loadSongsForIdsInBackground=()=>{};render=()=>{};
    const original=projectWorshipServiceItemsFromTemplate;const calls=[];
    projectWorshipServiceItemsFromTemplate=(service,items)=>{calls.push(service?.id);return original(service,items)};
    await loadWorshipData();
    check(calls.length===0&&!state.loadedWorshipServiceIds.has('current'),'home overview eagerly hydrated service bodies');
    state.selectedServiceTypeId=SERVICE_WEEK_PANEL_ID;
    await loadWorshipData();
    check(JSON.stringify(calls)==='["current"]','unopened archives projected '+calls.length);
    check(state.services.length===201,'archive list lost');
    check(state.loadedWorshipServiceIds.has('current')&&!state.loadedWorshipServiceIds.has('archive-0'),'loaded state changed');
    check(!state.serviceItems['archive-0'],'archive eagerly materialized');
    const archive=state.services.find(s=>s.id==='archive-0');
    // Stable UUIDs isolate actual template/content equivalence from generated identities.
    let counter=0;createUuid=()=>`fixture-${counter++}`;
    const expected=original(archive,[]);counter=0;
    const actual=getServiceItems(archive.id);
    check(JSON.stringify(actual)===JSON.stringify(expected),'lazy archive differs from eager template');
    check(!state.loadedWorshipServiceIds.has(archive.id),'template mistaken for loaded DB rows');
    const saved={...actual[0],raw_title:'사용자 제목',assignee:'사용자 담당',memo:serializeServiceItemMemo({elementType:'title_person',inputMode:'text'})};
    counter=0;const expectedSaved=original(archive,[saved]);counter=0;
    const grouped=projectGroupedWorshipItemsFromTemplates({[archive.id]:[saved]},[]);
    check(JSON.stringify(grouped[archive.id])===JSON.stringify(expectedSaved),'grouped saved rows dropped');
    check(Object.keys(grouped).length===1,'group scope ignored');
    check(Object.keys(projectGroupedWorshipItemsFromTemplates({[archive.id]:[saved]},['current'])).length===2,'grouped IDs omitted');
    // One list/loading render and one final current-data render, never two
    // complete home-card rebuilds for the same load completion.
    const rendered=[];let restored=false;
    requireClient=()=>true;
    restorePresenterControllerSession=()=>{restored=true};
    render=()=>rendered.push({loaded:state.loadedWorshipServiceIds.has('current'),restored,error:state.serviceError,dirty:state.dirty.service});
    state.dirty.service=true;state.serviceError='old error';
    await loadServiceData({silent:true});
    check(rendered.length===2,'duplicate completion renders '+JSON.stringify(rendered));
    check(!rendered[0].loaded,'list loading render lost');
    check(rendered[1].loaded&&rendered[1].restored&&!rendered[1].error&&!rendered[1].dirty,'final render before restored/current state');
    check(serviceDataLoadPromise===null,'load lock not released');
    // The week view uses the existing per-service loader and its locks; it
    // never reloads unrelated services, editor state or live transport.
    render=originalRender;canUseClientData=()=>true;state.client={};
    ensureSingleSongActivation=async()=>true;preloadPresenterServiceScripturesBeforeOutput=async()=>{};
    state.loadedWorshipServiceIds.clear();state.serviceError='';
    let releaseRows;fetchWorshipRowsForServiceIds=async()=>new Promise(resolve=>releaseRows=()=>resolve({sections:[],elements:[]}));
    state.forms=[{id:"draft",lyrics:"원문 그대로"}];state.dirty.forms=true;
    const formsBefore=JSON.stringify(state.forms),transportBefore=JSON.stringify([state.presenter,state.serviceMusic]);
    const serviceBefore=state.services;
    renderHomeDetail();await new Promise(resolve=>setTimeout(resolve,0));
    check(!refs.detailPane.querySelector('.service-week-board'),'unloaded weekly content shown as ready');
    check(serviceItemLoadPromises.has('current')&&releaseRows,'week view did not request real service rows');
    releaseRows();await Promise.all([...serviceItemLoadPromises.values()]);
    await new Promise(resolve=>setTimeout(resolve,0));
    check(state.loadedWorshipServiceIds.has('current')&&refs.detailPane.querySelector('.service-week-board'),'loaded week view missing');
    check(state.services===serviceBefore,'week load replaced unrelated service collection');
    check(JSON.stringify(state.forms)===formsBefore&&JSON.stringify([state.presenter,state.serviceMusic])===transportBefore,'week load changed editor/transport');
    state.loadedWorshipServiceIds.clear();let failures=0;
    fetchWorshipRowsForServiceIds=async()=>{failures++;throw Error('fixture offline')};
    renderHomeDetail();await Promise.allSettled([...serviceItemLoadPromises.values()]);
    await new Promise(resolve=>setTimeout(resolve,0));
    check(serviceViewLoadErrors.has('current')&&!refs.detailPane.querySelector('.service-week-board'),'failed week rendered false readiness');
    renderHomeDetail();check(failures===1,'failed week restarted automatically');
    serviceViewLoadErrors.delete('current');fetchWorshipRowsForServiceIds=async()=>({sections:[],elements:[]});
    renderHomeDetail();await Promise.all([...serviceItemLoadPromises.values()]);
    await new Promise(resolve=>setTimeout(resolve,0));
    check(refs.detailPane.querySelector('.service-week-board'),'week retry did not recover');
    check(JSON.stringify(state.forms)===formsBefore,'week retry changed lyric draft');
    return {archives:200,overviewProjections:0,explicitWeekProjections:1,lazyItems:actual.length};
   }''')
   print('PASS',engine,result,'version identity, lazy template equality, grouped saved-row preservation',flush=True)
   browser.close()
finally:server.shutdown()
