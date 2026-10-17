"""Theme changes settle all surfaces together without replacing editor DOM."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,launch_chromium,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page()
   page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url.rsplit('/',1)[0]+'/') else r.abort())
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function("typeof toggleTheme==='function' && !document.body.classList.contains('ui-booting')")
   page.locator('.mindex-boot').wait_for(state='hidden')
   page.evaluate('''()=>{
    refs.detailPane.innerHTML='<div class="panel"><button class="btn secondary"><i data-lucide="plus"></i>추가</button><textarea class="form-textarea">보존할 가사</textarea></div>';
    refreshIcons(refs.detailPane);
    window.themeNodes={icon:refs.detailPane.querySelector('svg'),field:refs.detailPane.querySelector('textarea')};
    themeNodes.field.focus();themeNodes.field.setSelectionRange(2,4);
   }''')
   for theme in ('dark','light','dark','light'):
    values=page.evaluate('''async theme=>{
     applyTheme(theme);
     const immediate=[...refs.detailPane.querySelectorAll('*'),document.body].map(e=>[getComputedStyle(e).color,getComputedStyle(e).backgroundColor]);
     await new Promise(requestAnimationFrame);
     const transitions=document.getAnimations().filter(a=>a instanceof CSSTransition);
     if(transitions.length)throw Error('palette still transitioning: '+transitions.map(a=>a.transitionProperty));
     if(themeNodes.icon!==refs.detailPane.querySelector('svg')||themeNodes.field!==document.activeElement||themeNodes.field.selectionStart!==2||themeNodes.field.selectionEnd!==4)throw Error('editor was replaced or focus/selection lost');
     const settled=[...refs.detailPane.querySelectorAll('*'),document.body].map(e=>[getComputedStyle(e).color,getComputedStyle(e).backgroundColor]);
     if(JSON.stringify(immediate)!==JSON.stringify(settled))throw Error('palette changes across frames');
     if(document.documentElement.classList.contains('ui-theme-switching'))throw Error('temporary suppression leaked');
     return getComputedStyle(refs.detailPane.querySelector('button')).transitionDuration;
    }''',theme)
    assert values!='0s',values
   print('PASS',engine,'synchronous palette, editor identity/focus/selection and hover transitions preserved',flush=True)
   browser.close()
finally:server.shutdown()
