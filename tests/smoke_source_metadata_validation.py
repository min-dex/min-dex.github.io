"""Offline source-edit validation, before any mutation; no output or backend."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page()
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url.rsplit('/',1)[0]+'/') else r.abort())
   page.goto(url+'?mindexSmokeRaw=1',wait_until='load')
   page.wait_for_function("typeof validateServiceSourceRecordMetadata==='function' && !document.body.classList.contains('ui-booting')")
   print(engine,page.evaluate('''async () => {
    const check=(v,m)=>{if(!v)throw Error(m)};
    const service={id:'metadata-fixture',type_id:'fixture',date:'2030-01-01'};
    const item={id:'original',service_id:service.id,label:'원래 곡',song_id:'song',version_id:'version',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'V2-C-V1'})};
    state.services=[service];state.serviceItems[service.id]=[item];state.selectedServiceId=service.id;
    const textarea=document.createElement('textarea');textarea.dataset.serviceSourceText=service.id;refs.detailPane.replaceChildren(textarea);
    state.client={};
    const before=JSON.stringify(state.serviceItems),session=JSON.stringify(state.presenter);
    for (const field of ['유형','입력','출력']) {
      textarea.value='[[찬양]]\\n[정상 새 곡]\\n- 유형: 찬양\\n- 입력: 직접 입력\\n[잘못된 항목]\\n- '+field+': unknown-value';
      const source=textarea.value;
      check(applyServiceSourceText(service.id)===false,'invalid edit accepted');
      check(JSON.stringify(state.serviceItems)===before,'partial item mutation');
      check(textarea.value===source,'source draft lost');
      check(await saveService(service.id)===false,'invalid source saved');
      check(textarea.dataset.serviceSourceValidationError.includes('unknown-value'),'save hid specific error');
      check(document.querySelector('#toastRegion').textContent.includes('unknown-value'),'error not visible');
      try {ensurePortableSourceItems(service,parseServiceSourceText(source));throw Error('guard missing')}catch(e){check(e.message.includes('unknown-value'),'creation guard')}
      try {applyServiceSourceRecord(service.id,0,{elementType:'unknown-value'});throw Error('guard missing')}catch(e){check(e.message.includes('unknown-value'),'record guard')}
    }
    for (const label of ['constructor','__proto__']) check(normalizePresenterPreparationInputLabel(label)===label,'unknown label became inherited property');
    const fixture=structuredClone(item);
    for(const [key,value] of [['element_type','성경 봉독'],['input_mode','bible']])applyServiceItemMetadataField(fixture,{dataset:{serviceItemField:key},value},service);
    const memo=parseServiceItemMemo(fixture.memo);
    check(memo.elementType==='scripture_reading' && memo.inputMode==='scripture','valid alias not applied');
    check(fixture.song_id==='song' && fixture.version_id==='version' && memo.formHint==='V2-C-V1','explicit selection changed');
    check(JSON.stringify(state.serviceItems)===before && JSON.stringify(state.presenter)===session,'existing content/session changed');
    return 'PASS visible errors, unchanged source/items/order/selection/output, all-record preflight and direct helper guards, valid aliases';
   }'''),flush=True)
   browser.close()
finally:server.shutdown()
