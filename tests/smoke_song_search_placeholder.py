"""Empty search hint must not float; typing/clearing retains the preview target."""
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch();page=b.new_page();page.goto(url);page.wait_for_function("!document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{const service={id:'qa',type_id:'qa'},item={id:'qa-item',service_id:'qa',label:'찬양 1',raw_title:'',memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db'})};state.services=[service];state.selectedServiceId='qa';state.serviceItems={qa:[item]};state.songs=[];canUseClientData=()=>false;window.qaItem=item;window.qaBefore=JSON.stringify(item);const host=document.createElement('main');host.id='qa';host.style='padding:30px;width:400px';host.innerHTML=renderServiceEditorTitleControl(item,0,{},serviceItemEditorModel(item,{service}));document.body.replaceChildren(host)}''')
   field=page.locator('#qa input[data-service-item-field="raw_title"]')
   assert field.get_attribute('placeholder')=='찬양 DB에서 검색'
   assert not page.locator('.svc-song-picker').is_visible()
   field.fill('없는 곡');field.evaluate('e=>scheduleServiceSongPickerPreview(e)')
   page.wait_for_function("document.querySelector('.svc-song-picker')?.textContent.includes('검색 결과 없음')")
   field.fill('');field.evaluate('e=>scheduleServiceSongPickerPreview(e)')
   page.wait_for_function("document.querySelector('.svc-song-picker')?.hidden===true")
   assert page.evaluate('JSON.stringify(qaItem)===qaBefore')
   assert page.locator('.svc-song-picker--hint').count()==0
   page.screenshot(path=f'/tmp/song-search-placeholder-{engine}.png')
   print(engine,'placeholder, typing preview, clearing and unchanged data passed');b.close()
finally:server.shutdown()
