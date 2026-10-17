"""First paint must preserve the chosen theme while app scripts are delayed."""
from io import BytesIO
from time import monotonic
from PIL import Image
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def boot_background_pixels(page):
    """Return pixels spanning the viewport while the application remains hidden."""
    image = Image.open(BytesIO(page.screenshot())).convert('RGB')
    width, height = image.size
    points = {
        'top-left': (0, 0),
        'top-right': (width - 1, 0),
        'bottom-left': (0, height - 1),
        'bottom-right': (width - 1, height - 1),
    }
    return {name: image.getpixel(point) for name, point in points.items()}
def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                for saved, system, output in [('dark','light',False),('light','dark',False),
                    (None,'dark',False),(None,'light',False),('blocked','dark',False),
                    ('light','light',True),('dark','dark',True)]:
                    context = browser.new_context(color_scheme=system, reduced_motion='reduce' if saved == 'blocked' else 'no-preference', viewport={'width':800,'height':600})
                    if saved == 'blocked':
                        context.add_init_script("Object.defineProperty(window,'localStorage',{get(){throw new Error('blocked')}})")
                    elif saved:
                        context.add_init_script(f"localStorage.setItem('mindex.theme','{saved}')")
                    page = context.new_page()
                    releases = []
                    modules = []
                    fail_modules = False
                    page.route('**/mindex-release.json*', lambda r: releases.append(r))
                    page.route('**/mindex.constants.js*', lambda r: r.abort() if fail_modules else modules.append(r))
                    page.goto(url+'?mindexSmokeRaw=1'+('&output=presenter' if output else ''), wait_until='domcontentloaded')
                    expected_theme = saved if saved in ('dark','light') else system
                    expected = (0,0,0) if output else (24,24,22) if expected_theme == 'dark' else (255,255,255)
                    deadline = monotonic() + 5
                    while not releases and monotonic() < deadline:
                        page.wait_for_timeout(25)
                    assert releases, 'release request missing'
                    for phase in ('before-css','after-css'):
                        if phase == 'after-css':
                            for r in releases:
                                r.fulfill(json={'version':'theme-bootstrap-test'})
                            page.wait_for_function("[...document.querySelectorAll('link[rel=stylesheet]')].some(l=>l.href.includes('styles.css')&&l.sheet)")
                        assert page.evaluate("document.body.classList.contains('ui-booting')")
                        assert page.evaluate('document.body.dataset.theme') == expected_theme
                        brand = page.locator('.mindex-boot')
                        assert brand.is_visible() != output
                        if not output:
                            assert brand.get_attribute('aria-label') == 'MINDEX 시작 중'
                            assert page.locator('.mindex-boot-wordmark').text_content() == 'MINDEX'
                            box = page.locator('.mindex-boot-cross').bounding_box()
                            assert abs(box['x'] + box['width']/2 - 400) < 1
                            assert 200 < box['y'] < 300
                            if saved == 'blocked':
                                assert page.locator('.mindex-boot-cross').evaluate("e=>getComputedStyle(e).animationName") == 'none'
                        pixels = boot_background_pixels(page)
                        assert set(pixels.values()) == {expected}, (engine, saved, system, output, phase, pixels)
                    fail_modules = True
                    for r in modules:
                        r.abort()
                    page.wait_for_function("document.body.dataset.bootFailed==='true'")
                    page.wait_for_function("getComputedStyle(document.querySelector('.mindex-boot')).visibility==='hidden'")
                    print('PASS', engine, saved, system, 'output' if output else 'app', flush=True)
                    context.close()
                context = browser.new_context()
                page = context.new_page()
                page.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url.rsplit("/",1)[0]+"/") and r.request.method=='GET' else r.abort())
                page.goto(url)
                page.wait_for_function("!document.body.classList.contains('ui-booting') && !document.body.dataset.bootFailed")
                page.wait_for_function("getComputedStyle(document.querySelector('.mindex-boot')).visibility==='hidden'")
                context.close()
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
