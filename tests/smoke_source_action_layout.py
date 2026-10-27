"""Retired source UI stays absent; creation-only offering preserves old services."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import launch_chromium, start_local_app_server, sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1200,'height':800})
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.goto(url);page.wait_for_function("typeof calendarAssigneeRowsForNewService==='function'&&!document.body.classList.contains('ui-booting')")
   print(engine,page.evaluate('''async()=>{
    const check=(v,m)=>{if(!v)throw Error(m)};
    const service={id:'creation-fixture',type_id:'children',date:'2026-11-01'};
    state.services=[service];state.serviceItems={};state.calendarData=[];
    const oldRows=buildWorshipServiceScaffold(service.id,service.type_id,{service});
    const oldItems=groupWorshipElements(oldRows.sections,oldRows.elements)[service.id];
    const oldOffering=oldItems.find(i=>i.label==='봉헌찬양');oldOffering.raw_title='기존 직접 입력';
    const oldBefore=JSON.stringify(oldItems);
    const rows=await calendarAssigneeRowsForNewService(service);
    const offering=rows.sections.find(s=>s.section_key==='offering');
    const elements=rows.elements.filter(e=>e.section_id===offering.id);
    check(elements.length===2,'One video and prayer only');
    const video=elements.find(e=>e.element_type==='video');
    check(video&&video.song_id===null&&video.asset.url.endsWith('/1792893957703-.mp4'),'Exact original video');
    check(elements.filter(e=>e.element_type==='praise').length===0,'No duplicate praise');
    const reopened=JSON.parse(JSON.stringify(rows));
    state.worshipSections=reopened.sections;state.worshipElements=reopened.elements;
    state.serviceItems[service.id]=groupWorshipElements(reopened.sections,reopened.elements)[service.id];
    const projected=getServiceItems(service.id);
    const videos=projected.filter(i=>parseServiceItemMemo(i.memo).asset?.url===video.asset.url);
    check(videos.length===1,'Single video after reopen/projection');
    const legacy=projectWorshipServiceItemsFromTemplate(service,oldItems);
    check(JSON.stringify(oldItems)===oldBefore&&legacy.some(i=>i.raw_title==='기존 직접 입력'),'Old input preserved');
    check(!legacy.some(i=>parseServiceItemMemo(i.memo).asset?.url===video.asset.url),'No retroactive default');
    const other=buildWorshipServiceScaffold('other','youth',{service:{id:'other',type_id:'youth'}});
    const before=JSON.stringify(other);applyChildrenOfferingCreationDefault({type_id:'youth'},other);
    check(JSON.stringify(other)===before,'Other ministries untouched');
    check(typeof renderServiceSourcePanel==='undefined'&&typeof renderServiceSourceRecovery==='undefined','Retired renderers absent');
    state.selectedServiceId=service.id;
    const slides=buildServicePresenterSlides(service.id);
    const html=renderServicePresenterControls(service,slides,false,0);
    check(!html.includes('svc-source-panel')&&!html.includes('data-service-source-'),'No old editor entry');
    refs.detailPane.innerHTML=html;refreshIcons(refs.detailPane);
    check(refs.detailPane.textContent.includes('문들아 머리 들어라'),'Original video shown in editor');
    return 'PASS new-service original video, one element, reopen, existing input/projection preservation and retired UI absence';
   }'''),flush=True)
   for theme in ['light','dark']:
    page.evaluate('(t)=>{document.documentElement.dataset.theme=t;document.body.dataset.theme=t}',theme)
    for width in [1200,760,390]:
     page.set_viewport_size({'width':width,'height':800})
     assert page.locator('[data-service-source-text],[data-service-source-copy],[data-service-source-apply]').count()==0
   page.set_viewport_size({'width':1200,'height':800})
   page.locator('.svc-board-section').filter(has_text='문들아 머리 들어라').first.screenshot(path='/private/tmp/source-offering-'+engine+'.png')
   browser.close()
finally:server.shutdown()
