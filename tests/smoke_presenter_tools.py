"""Isolated operator and projector pages, no production connections."""
import os
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server, sync_playwright, launch_chromium

server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ('chromium', 'webkit'):
            browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
            ctx = browser.new_context(viewport={'width': 1100, 'height': 850})
            ctx.route('**/*', lambda r: r.continue_() if urlsplit(r.request.url).netloc == urlsplit(url).netloc and r.request.method == 'GET' else r.abort())
            operator = ctx.new_page()
            operator.goto(url)
            operator.wait_for_function("typeof presenterTools !== 'undefined' && !document.body.classList.contains('ui-booting')")
            output = ctx.new_page()
            output.goto(url+'?output=presenter&outputSession=test-tools')
            output.locator('#presenterOutputRoot').wait_for()
            operator.evaluate("""() => {
              const service={id:'tools',type_id:'fixture'}, slide={id:'one',elementId:'one',type:'title',title:'첫 말씀',liveScriptureControl:true};
              const slides=[slide,{...slide,id:'two',title:'다음 말씀'}];
              state.module='presenter'; state.services=[service]; state.selectedServiceId=service.id;
              presenterSlidesForService=()=>slides;
              Object.assign(state.presenter,{slides,index:0,serviceId:'tools',outputWindow:{closed:false},outputSessionId:'test-tools'});
              state.presenter.channel=new BroadcastChannel('mindex.presenter');
              window.updateFixture=()=>state.presenter.channel.postMessage({type:'presenter-state',payload:{...Object.fromEntries(['slides','index','serviceId','outputSessionId','safetyBlank'].map(k=>[k,state.presenter[k]])),chromakey:false}});
              document.getElementById('detailPane').innerHTML='<section id="servicePresenterControls" data-service-id="tools"><div class="svc-presenter-toolbar">'+renderPresenterToolbarScripture(service,slides)+renderPresenterFocusView()+'</div><div class="svc-presenter-workspace"></div></section>';
              presenterFocusView=true;syncPresenterFocusView();updateFixture();
            }""")
            field = operator.locator('[data-presenter-citation-reference-input]')
            assert field.is_visible()
            field.fill('요 3:16')
            for width in (1440, 390):
                operator.set_viewport_size({'width':width, 'height':850})
                layout = operator.locator('.svc-focus-control-row').evaluate('''row => {
                    const [screens, tools] = [...row.children].map(e => e.getBoundingClientRect());
                    const buttons = [...row.querySelectorAll('[data-slide-tool]')];
                    return {beside: tools.left >= screens.right && tools.top === screens.top,
                            stacked: tools.top >= screens.bottom, fits: row.scrollWidth <= row.clientWidth + 1,
                            icons: buttons.length === 8 && buttons.every(b => b.querySelector('svg') && b.getAttribute('aria-label') && b.offsetHeight === 35)};
                }''')
                assert layout['fits'] and layout['icons'] and layout['beside' if width==1440 else 'stacked'], layout
            operator.set_viewport_size({'width':1100, 'height':850})
            tool = lambda name: operator.locator(f'[data-slide-tool="{name}"]')
            stage = operator.locator('.svc-focus-preview .svc-slide-thumb-frame').first
            def drag():
                stage.scroll_into_view_if_needed()
                rect = stage.bounding_box()
                x, y = rect['x']+rect['width']*.3, rect['y']+rect['height']*.45
                operator.mouse.move(x, y); operator.mouse.down()
                operator.mouse.move(x+rect['width']*.2, y+rect['height']*.1); operator.mouse.up()
            for name in ('highlight','underline'):
                tool(name).click(); drag()
            output.wait_for_function("document.querySelectorAll('.presenter-tool-overlay line').length===2")
            line=output.locator('.presenter-tool-overlay line').last
            assert line.get_attribute('y1')==line.get_attribute('y2')
            tool('plus').click(); drag()
            output.wait_for_function("document.querySelector('#presenterOutputRoot').style.scale==='1.5' && document.querySelector('#presenterOutputRoot').style.translate!==''")
            tool('minus').click()
            output.wait_for_function("!document.querySelector('#presenterOutputRoot').style.scale && !document.querySelector('#presenterOutputRoot').style.translate")
            tool('undo').click()
            output.wait_for_function("document.querySelectorAll('.presenter-tool-overlay line').length===1")
            tool('spot').click();stage.hover()
            output.locator('.presenter-tool-overlay path').wait_for()
            def wheel(target, delta, modifier=None):
                return target.evaluate("""(node, [dy, key]) => {
                  const box=node.getBoundingClientRect();
                  const event=new WheelEvent('wheel', {deltaY:dy, [key]:true, bubbles:true, cancelable:true,
                    clientX:box.left+box.width*.75, clientY:box.top+box.height*.25});
                  node.dispatchEvent(event); return event.defaultPrevented;
                }""", [delta,modifier or 'unused'])
            assert not wheel(stage,-100)
            assert not wheel(operator.locator('.svc-focus-preview .svc-slide-thumb-frame').nth(1),-100,'ctrlKey')
            assert wheel(stage,-100,'ctrlKey')
            output.wait_for_function("document.querySelector('#presenterOutputRoot').style.scale==='1.25'")
            root=output.locator('#presenterOutputRoot')
            def spot_bounds():
                return output.locator('.presenter-tool-overlay path').evaluate("""path=>{
                    const circle=path.cloneNode();circle.setAttribute('d',circle.getAttribute('d').split('z ')[1]);
                    path.after(circle);const {x,y,width,height}=circle.getBBox();circle.remove();
                    return [x,y,width,height];
                }""")
            def check_spot():
                x, y, width, height = spot_bounds()
                assert abs(x-1080)<4 and abs(y-105)<4 and abs(width-240)<.01 and abs(height-240)<.01, (engine,x,y,width,height)
            check_spot()
            translation=root.evaluate("e=>e.style.translate.split(' ').map(parseFloat)")
            assert all(abs(a-b)<.5 for a,b in zip(translation,[-6.25,6.25])), translation
            assert wheel(stage,-10000,'metaKey')
            output.wait_for_function("document.querySelector('#presenterOutputRoot').style.scale==='3'")
            check_spot()
            assert wheel(stage,10000,'metaKey')
            output.wait_for_function("!document.querySelector('#presenterOutputRoot').style.scale")
            check_spot()
            assert tool('spot').get_attribute('aria-pressed')=='true'
            tool('reset').click()
            output.locator('.presenter-tool-overlay').wait_for(state='detached')
            tool('highlight').click();drag()
            output.locator('.presenter-tool-overlay line').wait_for()
            operator.evaluate("state.presenter.safetyBlank=true;updateFixture();syncPresenterFocusView()")
            output.locator('.presenter-tool-overlay').wait_for(state='detached')
            assert tool('highlight').count()==0
            operator.evaluate("state.presenter.safetyBlank=false;state.presenter.index=1;updateFixture();syncPresenterFocusView()")
            assert stage.locator('.presenter-tool-overlay').count()==0
            operator.locator('[data-presenter-focus-toggle=basic]').click()
            assert field.is_visible() and field.input_value()=='요 3:16'
            browser.close()
            print(engine, 'PASS: two-window annotations, zoom/pan, spotlight, blank, scripture draft')
finally:
    server.shutdown()
