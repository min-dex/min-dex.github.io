from smoke_app import launch_chromium,start_local_app_server,sync_playwright
from urllib.parse import urlsplit
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1280,'height':900})
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.goto(url+'?mindexSmokeRaw=1')
   page.wait_for_function("typeof renderServiceList==='function'")
   print(engine,page.evaluate("""()=>{
    const check=(v,m)=>{if(!v)throw Error(m)};
    state.client={};state.connectionError='';state.serviceError='';state.module='service';state.search='';
    const types=['sunday-first','children','special','custom-kind'];
    state.serviceTypes=types.map(id=>({id,name:id}));
    state.services=types.map((type_id,i)=>({id:'fixture-'+i,type_id,date:'2026-10-23',title:'Fixture '+i}));
    state.selectedServiceId=null;state.selectedServiceTypeId=SERVICE_LIST_PANEL_ID;
    confirmDiscardServiceChanges=()=>true;syncBrowserHistory=()=>{};
    for(const category of SERVICE_BROWSE_CATEGORIES){
      openServiceListPanel(category.key);
      check(state.serviceFilter===category.key,'navigation filter');
      renderServiceList();renderServiceListDetail();
      const buttons=[...refs.songList.querySelectorAll('[data-service-list]')];
      check(buttons.length===3,'three sidebar categories');
      check(buttons.map(b=>b.querySelector('span').textContent).join('|')==='공예배|부서 예배|기타 예배','labels');
      check(buttons.filter(b=>b.classList.contains('active')).length===1,'active category');
      const shown=[...refs.detailPane.querySelectorAll('[data-select-service-type]')].map(b=>b.dataset.selectServiceType);
      const expected=types.filter(id=>serviceBrowseGroup(id)===category.key);
      check(JSON.stringify(shown.sort())===JSON.stringify(expected.sort()),'category membership '+category.key+JSON.stringify(shown));
      check(refs.detailPane.querySelector('h3').textContent===category.label,'heading');
    }
    const previous=state.serviceFilter;confirmDiscardServiceChanges=()=>false;openServiceListPanel('public');
    check(state.serviceFilter===previous,'draft guard');
    return 'PASS three category navigation, counts/active labels, unknown types and draft guard';
   }"""))
   browser.close()
finally:server.shutdown()
