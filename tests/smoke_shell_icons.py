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
                        remote = page.locator('#remotePanelBtn')
                        assert remote.get_attribute('aria-label') == '원격 조작'
                        assert remote.get_attribute('title') == '원격 조작'
                        assert remote.locator('svg.lucide-smartphone').count() == 1
                        assert remote.inner_text() == ''
                        metrics = page.evaluate("""() => ['remotePanelBtn', 'monitorPanelBtn'].map(id => {
                            const button = document.getElementById(id), icon = button.querySelector('svg');
                            const b = getComputedStyle(button), i = getComputedStyle(icon);
                            return [b.width, b.height, b.padding, i.width, i.height, i.strokeWidth];
                        })""")
                        assert metrics[0] == metrics[1], metrics
                        remote.click()
                        assert page.locator('.remote-panel').evaluate('(el) => el.open')
                        assert 'PC에서 예배 화면을 열면 코드가 표시됩니다.' in page.locator('[data-remote-status]').text_content()
                        page.locator('[data-remote-close]').click()
                        assert not page.locator('.remote-panel').evaluate('(el) => el.open')
                        print('PASS', engine, module, phase, flush=True)
                    context.close()
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
