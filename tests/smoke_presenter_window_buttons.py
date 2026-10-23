"""Isolated visual state coverage; never opens or controls a native output window."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright
from urllib.parse import urlsplit

server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ['chromium', 'webkit']:
            browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
            page = browser.new_page()
            page.route('**/*', lambda r: r.continue_() if urlsplit(r.request.url).netloc == urlsplit(url).netloc else r.abort())
            page.goto(url + '?mindexSmokeRaw=1')
            page.wait_for_function("typeof renderPresenterControlsTop==='function'")
            for theme in ['light', 'dark']:
                for width in [320, 520]:
                    page.set_viewport_size({'width': width + 40, 'height': 700})
                    page.evaluate("""({theme,width})=>{
                      document.body.dataset.theme=theme;
                      document.head.insertAdjacentHTML('beforeend','<style>*{transition:none!important}</style>');
                      window.mindexElectron={setPresenterAlwaysOnTop:()=>Promise.resolve()};
                      isPresenterOutputWindowOpen=()=>true;
                      const service={id:'window-buttons-fixture',type_id:'sunday-second',date:'2026-10-23'};
                      state.services=[service];state.serviceItems[service.id]=[];state.presenter.alwaysOnTop=false;
                      document.body.innerHTML='<div class="svc-presenter-side-panel" style="width:'+width+'px;margin:20px">'+renderPresenterControlsTop(service,[],false,0)+'</div>';
                      document.body.classList.remove('ui-booting');refreshIcons(document.body);
                    }""", {'theme': theme, 'width': width})
                    full=page.locator('.svc-presenter-fullscreen')
                    pin=page.locator('.svc-presenter-pin-button')
                    checkbox=pin.locator('input')
                    def style(locator):
                        return locator.evaluate("e=>{const s=getComputedStyle(e),r=e.getBoundingClientRect();return [r.height,r.width,s.backgroundColor,s.color,s.borderColor,s.borderRadius,s.fontSize,s.fontWeight,s.opacity]}")
                    assert style(full)==style(pin), (engine,theme,width,style(full),style(pin))
                    full.hover(); hover=style(full)
                    pin.hover(); assert style(pin)==hover, (style(pin),hover)
                    page.mouse.move(0,0)
                    page.keyboard.press('Tab');full.focus()
                    focus=full.evaluate('e=>getComputedStyle(e).outline')
                    checkbox.focus()
                    assert pin.evaluate('e=>getComputedStyle(e).outline')==focus
                    assert '2px' in focus
                    checkbox.evaluate('e=>e.checked=true')
                    selected=style(pin);pin.hover();assert style(pin)==selected
                    assert selected!=style(full)
                    page.screenshot(path=f'/tmp/mindex-window-buttons-{engine}-{theme}-{width}.png')
                    checkbox.evaluate('e=>{e.checked=false;e.disabled=true;e.parentElement.classList.add("is-unavailable")}')
                    full.evaluate('e=>e.disabled=true');page.mouse.move(0,0)
                    assert style(full)==style(pin), 'Disabled rules differ'
            browser.close()
            print('PASS',engine,'window controls geometry, default/hover/focus/checked/disabled; light/dark narrow/wide')
finally:
    server.shutdown()
