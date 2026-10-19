"""Static navigation icons must hydrate without a detail view doing it for them."""
import os
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    origin = url.rsplit('/', 1)[0] + '/'
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                for module in ('scripture', 'praise', 'service'):
                    context = browser.new_context()
                    page = context.new_page()
                    page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(origin) and r.request.method == 'GET' else r.abort())
                    # Exercise current source, independent of generated release metadata.
                    page.route('**/mindex-release.json*', lambda r: r.fulfill(json={'version': 'shell-icons-smoke'}))
                    page.goto(url + '?mindexSmokeRaw=1#module=' + module)
                    for phase in ('initial', 'reload'):
                        if phase == 'reload':
                            page.reload()
                        page.wait_for_function("!document.body.classList.contains('ui-booting')")
                        assert not page.evaluate('Boolean(document.body.dataset.bootFailed)')
                        buttons = page.locator('.module-switcher [data-home-module]')
                        assert buttons.count() == 5
                        for button in buttons.all():
                            assert button.locator('svg').count() == 1
                            assert button.locator('i[data-lucide]').count() == 0
                            box = button.locator('svg').bounding_box()
                            assert box and box['width'] > 0 and box['height'] > 0
                        print('PASS', engine, module, phase, flush=True)
                    context.close()
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
