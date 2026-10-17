"""Keyboard save flushes unfocused Enter-only drafts; isolated persistence."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page();page.goto(url+'?mindexSmokeRaw=1')
   page.wait_for_function("typeof saveService==='function'");page.wait_for_function("!document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{
    requireClient=()=>true;applyPendingServiceSourceTextBeforeSave=()=>false;serviceSourceTextHasPendingChanges=()=>false;
    serviceInputSaveProblem=()=>null;saveDirtyServiceTypes=async()=>{};serviceHasPendingTextEdits=()=>false;captureCleanFingerprint=()=>{};renderServiceList=()=>{};render=()=>{};
    state.module='presenter';state.selectedServiceId='draft-save';state.presenter.viewServiceId='draft-save';state.services=[{id:'draft-save',title:'fixture'}];state.saving=false;
    currentSaveButtonState=()=>({available:true,dirty:true});presenterViewServiceId=()=> 'draft-save';
    window.committed=[];window.saved=[];
    updateServiceItemField=field=>committed.push([field.dataset.serviceId,field.dataset.serviceItemIndex,field.dataset.serviceItemField,field.value]);
    saveWorshipServiceInstance=async()=>{saved.push(structuredClone(committed));return {unchanged:true}};
    refs.detailPane.innerHTML=`<input id="first" data-service-id="draft-save" data-service-item-index="0" data-service-item-field="person" data-initial-value="old" value="입력 중인 담당자"><textarea id="second" data-service-id="draft-save" data-service-item-index="1" data-service-item-field="body" data-initial-value="old">엔터 없이 입력한 본문</textarea><input data-service-id="other" data-service-item-index="0" data-service-item-field="person" data-initial-value="old" value="다른 예배"><button id="focus-save">저장</button>`;
    document.querySelector('#second').focus();document.querySelector('#first').focus();document.querySelector('#second').focus();
   }''')
   page.keyboard.press('Control+s');page.wait_for_function('saved.length===1 && !state.saving')
   assert page.evaluate("saved[0].length===2 && saved[0][0][3]==='입력 중인 담당자' && saved[0][1][3]==='엔터 없이 입력한 본문'")
   page.evaluate("document.querySelector('#first').value='추가 입력';document.querySelector('#focus-save').focus()")
   page.keyboard.press('Meta+s');page.wait_for_function('saved.length===2 && !state.saving')
   assert page.evaluate("saved[1].length===3 && saved[1][2][3]==='추가 입력' && committed.every(x=>x[0]==='draft-save')")
   print(engine,'PASS Ctrl+S/Meta+S flush active and blurred drafts, save-button focus, unchanged/other-service exclusion',flush=True)
   browser.close()
finally:server.shutdown()
