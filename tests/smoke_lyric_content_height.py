"""Offline direct-lyrics sizing: wrapped growth, shrink, cap and draft retention."""
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1100,'height':800});page.goto(url)
   page.wait_for_function("!document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{const root=document.createElement('main');root.id='qa';root.style='width:600px;padding:20px';root.innerHTML=renderServiceManualPraiseLyricsEditor({memo:''},0)+'<div class="svc-board-subgroup-controls"><div class="svc-board-subgroup-control-item">'+renderPresenterManualLyricsField({id:'qa',memo:''},0,'qa')+'</div></div>';document.body.replaceChildren(root);root.addEventListener('click',handlePresenterDetailClick)}''')
   page.locator('[data-presenter-lyrics-toggle]').click()
   for field in page.locator('#qa textarea').all():
    field.fill('짧은 가사');small=field.bounding_box()['height'];assert small<90,small
    field.fill('단어가 이어지는 긴 가사입니다 ' * 80);large=field.bounding_box()['height'];assert large>small and large<=441,(small,large)
    field.fill('짧은 가사');assert field.bounding_box()['height']==small
   page.locator('[data-presenter-lyrics-toggle]').click();field=page.locator('.svc-presenter-input-field--lyrics textarea');assert not field.is_visible();assert field.input_value()=='짧은 가사'
   page.locator('[data-presenter-lyrics-toggle]').click();assert field.is_visible();assert field.input_value()=='짧은 가사'
   page.evaluate("applyTheme('dark')");page.screenshot(path=f'/tmp/lyrics-content-height-{engine}.png')
   print(engine,'growth, shrink, cap and draft retention passed');browser.close()
finally:server.shutdown()
