import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as pw:
  for engine in ['chromium','webkit']:
   b=launch_chromium(pw) if engine=='chromium' else pw.webkit.launch();page=b.new_page()
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.goto(url);page.wait_for_function("typeof presenterBackgroundSourcesForService==='function' && !document.body.classList.contains('ui-booting')")
   print(engine,page.evaluate("""async()=>{
    const check=(v,m)=>{if(!v)throw Error(m)};state.calendarData=[];state.serviceTypes=[];state.worshipBackgroundRegistry={};
    const groups={'sunday-first':'A','sunday-second':'A','sunday-main':'A','young-adult':'A',friday:'B',youth:'B',children:'C',nursery:'C'};
    for(const [type_id,g] of Object.entries(groups))for(const date of ['2026-11-01','2026-11-30','2026-12-01','2026-12-31']){
     const svc={type_id,date},original=JSON.stringify(svc),options={includeChromakeyCleanSlides:true};
     check(presenterBackgroundSourcesForService(svc,options)[0]===`assets/worship-backgrounds/26-${g}6.png`,'mapping '+type_id+date);
     check(presenterBackgroundSourcesForService({...svc,presenter_background:'https://example.org/custom.png'},options)[0]==='https://example.org/custom.png','custom changed');check(JSON.stringify(svc)===original,'mutated');
    }
    check(presenterBackgroundSourcesForService({type_id:'children',date:'2026-10-31'})[0].endsWith('26-C5.png'),'October boundary');
    check(presenterBackgroundSourcesForService({type_id:'children',date:'2027-01-01'}).length===0,'invented next year fallback');
    check(presenterBackgroundSourcesForService({type_id:'children',date:'2026-12-25',alias:'성탄예배'}).at(0).endsWith('26-C6.png'),'missing seasonal fallback');
    state.worshipBackgroundRegistry={'27-S2.png':{dataUrl:'data:image/png;base64,season'},'26-A6.png':{dataUrl:'data:image/png;base64,custom'}};
    check(presenterBackgroundSourcesForService({type_id:'young-adult',date:'2026-12-25',alias:'성탄예배'})[0]==='data:image/png;base64,season','season precedence');
    check(presenterBackgroundSourcesForService({type_id:'young-adult',date:'2026-11-01'})[0]==='data:image/png;base64,custom','registry precedence');
    for(const g of ['A','B','C']){const im=new Image();im.src=`assets/worship-backgrounds/26-${g}6.png`;await im.decode();check(im.naturalWidth===3508&&im.naturalHeight===2480,'image dimensions')}
    return 'PASS 32 date/group mappings, explicit and registry preservation, season priority, year boundary, three image decode';
   }"""),flush=True);b.close()
finally:server.shutdown()
