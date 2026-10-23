"""Saving feedback does not move inputs; medley unlink uses the visible action."""
from urllib.parse import urlsplit
from smoke_app import launch_chromium, start_local_app_server, sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1200,'height':650})
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof unlinkServiceMedley==='function' && !document.body.classList.contains('ui-booting')")
   for theme in ['light','dark']:
    page.evaluate('''theme=>{
      document.body.dataset.theme=theme;document.body.classList.remove('ui-booting');
      const service={id:'fixture',type_id:'special',date:'2026-10-23'};
      const group={groupId:'fixture-group',itemIds:['one','two'],primaryItemId:'one',title:'First + Second'};
      const items=['one','two'].map((id,i)=>normalizeServiceItem({id,service_id:service.id,label:'찬양 '+(i+1),raw_title:'Song '+i,sort_order:i+1,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',connectedPraise:{...group,role:i?'secondary':'primary'}})},i));
      state.services=[service];state.selectedServiceId=service.id;state.serviceItems[service.id]=items;
      state.saving=false;state.module='service';
      document.body.innerHTML='<main id="servicePresenterControls" style="padding:20px"><div class="svc-board-subgroup-control-item" data-service-id="fixture" data-service-item-index="0" data-service-item-id="one" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><input style="flex:1;min-width:100px" value="미저장 담당" data-service-item-field="assignee" data-service-id="fixture" data-service-item-index="0" data-initial-value="">'+renderPresenterBoardItemActions(service.id,{item:items[0],index:0,service})+'</div></main>';
      refs.detailPane=document.querySelector('main');bindDetailInteractionRoot(refs.detailPane);refreshIcons(refs.detailPane);
      renderCurrentServiceModuleDetail=()=>{};showToast=()=>{};updateSaveState=()=>{};
      publishPresenterState=()=>{throw Error('unexpected output')};
    }''',theme)
    for width in [1200,520]:
     page.set_viewport_size({'width':width,'height':650})
     baseline=None
     for status in ['modified','saving','saved','error','modified']:
      result=page.evaluate('''status=>{const e=document.querySelector('.svc-board-subgroup-control-item');setServiceInputFeedback(e,status);const rect=n=>{const r=n.getBoundingClientRect();return [r.x,r.y,r.width,r.height]};return {input:rect(e.querySelector('input')),button:rect(e.querySelector('[data-service-item-commit]')),busy:e.querySelector('[data-service-item-commit]').disabled}}''',status)
      geometry=[result['input'],result['button']]
      if baseline is None:baseline=geometry
      assert all(abs(a-b)<0.5 for now,old in zip(geometry,baseline) for a,b in zip(now,old)),(engine,theme,width,status,geometry,baseline)
      assert result['busy']==(status=='saving')
     page.screenshot(path=f'/tmp/mindex-save-status-{engine}-{theme}-{width}.png')
    page.locator('[data-service-medley-unlink]').click()
    assert page.evaluate("getServiceItems('fixture').every(i=>!serviceItemConnectedPraise(i))")
    assert page.evaluate("getServiceItems('fixture')[0].assignee==='미저장 담당'")
   browser.close();print('PASS',engine,'stable input/action geometry, status semantics, visible unlink click and pending input')
finally:server.shutdown()
