"""Exact regular third-service choir default; synthetic data, no operational writes."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=b.new_page();page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url.rsplit('/',1)[0]+'/') and r.request.method=='GET' else r.abort())
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof buildWorshipServiceScaffold==='function'&&!document.body.classList.contains('ui-booting')")
   print(engine,page.evaluate('''()=>{
    const check=(v,m)=>{if(!v)throw Error(m)},id=crypto.randomUUID();
    const service={id,type_id:'sunday-main',date:'2026-11-08',title:'주일예배 [3부]'};state.services=[service];state.selectedServiceId=id;
    const scaffold=buildWorshipServiceScaffold(id,service.type_id,{service});
    const rows=groupWorshipElements(scaffold.sections,scaffold.elements)[id];
    const item=rows.find(x=>x._worshipSectionKey==='special_song');check(item,'slot');
    check(item.assignee==='할렐루야 찬양대','assignee');
    check(servicePraiseInputMode(item)==='manual_praise','manual default');
    let stateOf=x=>resolvePresenterServiceItemContentState(x,parseServiceItemMemo(x.memo),null,service);
    check(!stateOf(item).hasOutputContent,'person alone counted as content');
    const title={...item,raw_title:'사용자 제목',_worshipTemplatePlaceholder:false};check(stateOf(title).hasOutputContent,'title-only invalid');
    for(const mode of ['lyrics_db','score_db','manual_praise']){
     const saved={...item,raw_title:'보존 제목',song_id:'saved-song',version_id:'saved-version',memo:serializeServiceItemMemo({...parseServiceItemMemo(item.memo),inputMode:mode,slides:['보존 가사'],formHint:'V1-C',asset:{kind:'audio',url:'https://example.invalid/keep.mp3'}})};
     const before=JSON.stringify(saved),merged=mergeTemplateProjectionItem(item,saved);
     check(servicePraiseInputMode(merged)===mode,'explicit mode overwritten '+mode);
     check(merged.raw_title===saved.raw_title&&merged.song_id===saved.song_id&&merged.version_id===saved.version_id,'link/title overwritten');
     check(JSON.stringify(parseServiceItemMemo(merged.memo).slides)===JSON.stringify(parseServiceItemMemo(saved.memo).slides),'lyrics overwritten');
     check(parseServiceItemMemo(merged.memo).formHint==='V1-C','form changed');
     check(JSON.stringify(parseServiceItemMemo(merged.memo).asset)===JSON.stringify(parseServiceItemMemo(saved.memo).asset),'asset changed');
     check(JSON.stringify(saved)===before,'source mutated');
    }
    for(const type of ['sunday-first','sunday-second','sunday-afternoon','wednesday','friday']){
     const s={...service,type_id:type};const sc=buildWorshipServiceScaffold(id,type,{service:s});
     check(!sc.elements.some(e=>e.person==='할렐루야 찬양대'&&e.config.inputMode==='manual_praise'),'other template changed '+type);
    }
    const union={...service,alias:'온세대 찬양예배'};check(isAllGenerationsWorshipService(union),'union fixture');
    check(!serviceOrderTemplate(union.type_id,{service:union}).find(s=>s.sectionKey==='special_song')?.inputMode,'union special changed');
    check(!publicWorshipSpecialSongStep({}).inputMode,'generic special changed');
    check(sundayThirdSpecialSongTemplateForDate('2026-07-19')===null,'historical scope changed');
    return {newRegularChoir:'manual_praise',assigneeOnly:'missing',titleOnly:'filled',explicitModesPreserved:3,otherTemplatesPreserved:5,operationalWrites:0};
   }'''),flush=True);b.close()
finally:server.shutdown()
