"""Children praise defaults reach the actual scaffold/select; existing records remain intact."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server,sync_playwright,launch_chromium

server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page();page.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof buildWorshipServiceScaffold==='function'&&!document.body.classList.contains('ui-booting')")
   page.evaluate("""()=>{
    const check=(v,m)=>{if(!v)throw Error(m)};
    const service={id:'children-audio-default',type_id:'children',date:'2026-11-01'};
    state.services=[service];state.selectedServiceId=service.id;state.client={};
    const scaffold=buildWorshipServiceScaffold(service.id,service.type_id,{service});
    const items=groupWorshipElements(scaffold.sections,scaffold.elements)[service.id];
    const praise=items.filter(i=>i._worshipSectionKey==='praise');
    check(praise.length===4,'children four praise slots');
    check(praise.every(i=>servicePraiseInputMode(i,parseServiceItemMemo(i.memo),service)==='children_audio'),'children default must be DB audio');
    check(projectWorshipServiceItemsFromTemplate(service,[]).length===0,'children legacy projection unexpectedly manufactured records');
    const controls=()=>praise.map((item,index)=>renderServicePraiseInputModeControl(item,index,serviceItemEditorModel(item,{service}))).join('');
    refs.detailPane.innerHTML=controls();check([...refs.detailPane.querySelectorAll('select')].every(e=>e.value==='children_audio'&&e.selectedOptions[0].textContent.trim()==='DB: 음원'),'actual selected label');
    for(const mode of ['lyrics_db','score_db','manual_praise','audio_praise','children_audio']){
     const item={...praise[0],raw_title:'사용자 곡',song_id:mode.includes('_db')?'song-fixture':null,version_id:'version-fixture',assignee:'기존 담당',memo:serializeServiceItemMemo({...parseServiceItemMemo(praise[0].memo),inputMode:mode,slides:['직접 작성 가사'],note:'기존 메모'})};
     const before=JSON.stringify(item),result=projectWorshipServiceItemsFromTemplate(service,[item]).find(i=>i.id===item.id);
     check(servicePraiseInputMode(result,parseServiceItemMemo(result.memo),service)===mode,'explicit mode replaced '+mode);
     check(result.raw_title===item.raw_title&&result.song_id===item.song_id&&result.version_id===item.version_id&&result.assignee===item.assignee,'authored fields replaced');
     check(parseServiceItemMemo(result.memo).slides[0]==='직접 작성 가사'&&JSON.stringify(item)===before,'lyrics/source replaced');
    }
    const other={id:'other-youth',type_id:'youth',date:'2026-11-01'};
    const otherScaffold=buildWorshipServiceScaffold(other.id,other.type_id,{service:other});
    const otherPraise=(groupWorshipElements(otherScaffold.sections,otherScaffold.elements)[other.id]||[]).filter(i=>i._worshipSectionKey==='praise');
    check(otherPraise.length>0&&otherPraise.every(i=>servicePraiseInputMode(i,parseServiceItemMemo(i.memo),other)==='lyrics_db'),'other service default changed');
   }""")
   print('PASS',engine,'children four-slot scaffold and actual DB audio select, explicit modes/lyrics/links/assignee preserved, other-service default unchanged; existing empty services not fabricated; operational writes/output 0',flush=True)
   browser.close()
finally:server.shutdown()
