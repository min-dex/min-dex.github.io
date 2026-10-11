"""Measure rendered chromakey panel pixels, without connecting to production data."""
from io import BytesIO
from PIL import Image
import smoke_app
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    smoke_app.extract_supa_config = lambda: ('', '')
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ['chromium', 'webkit']:
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                try:
                    for width, dpr in [(1280, 1), (1920, 1), (3840, 1), (1920, 2)]:
                        page = browser.new_page(viewport={'width': width, 'height': width * 9 // 16}, device_scale_factor=dpr)
                        page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url.rsplit("/", 1)[0] + "/") else r.abort())
                        page.goto(url + '?output=presenter', wait_until='domcontentloaded')
                        page.wait_for_function("typeof renderPresenterCitationTabSlide === 'function' && typeof state !== 'undefined'")
                        rects = page.evaluate('''async () => {
                            const scripture = {type:'scripture', scriptureContext:'citation-chromakey', referenceBook:'요한복음', referenceRange:'3:16', scriptureVerse:16, text:'요 3:16   하나님이 세상을 이처럼 사랑하사'};
                            document.body.innerHTML = '<div class="presenter-output-root"><div class="presenter-slide presenter-slide--scripture">' + renderPresenterCitationTabSlide(scripture) + '<div class="presenter-citation-tab presenter-assignee-tab">'+presenterTabBackground(true)+'담당자</div></div></div>';
                            await document.fonts.ready;
                            const tabs=[...document.querySelectorAll('.presenter-citation-tab')];
                            const ids=[...document.querySelectorAll('filter')].map(f=>f.id);
                            if(new Set(ids).size!==ids.length)throw Error('duplicate filter ids');
                            return tabs.map(tab=>{const r=tab.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,radius:parseFloat(getComputedStyle(tab.querySelector('.presenter-tab-curve')).rx)}});
                        }''')
                        image = Image.open(BytesIO(page.screenshot())).convert('RGB')
                        for index, rect in enumerate(rects):
                            x = rect['x'] + (rect['width'] - rect['radius'] if index == 0 else 0)
                            x, y, radius = round(x*dpr), round(rect['y']*dpr), round(rect['radius']*dpr)
                            colors = set(image.crop((x, y, x+radius, y+radius)).getdata())
                            assert colors == {(255, 255, 255), (0, 255, 0)}, (engine, width, dpr, index, colors)
                        fullscreen_hidden = page.evaluate('''() => {
                            document.querySelector('.presenter-output-root').classList.add('no-chromakey');
                            return [...document.querySelectorAll('.presenter-tab-background')].every(el=>getComputedStyle(el).display==='none');
                        }''')
                        assert fullscreen_hidden
                        page.close()
                    print('PASS', engine, '720p/1080p/4K/Retina: both rounded corners contain only white and chromakey green; fullscreen unchanged')
                finally:
                    browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
