"""Current bulletin iframe must not inherit the desktop working canvas."""
from urllib.parse import urljoin
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                page = browser.new_page(viewport={'width': 390, 'height': 800})
                # Suppress only the OS dialog; exercise the real iframe builder.
                page.add_init_script("window.print = () => {}")
                page.goto(urljoin(url, '/tests/fixtures/shell-print.html'))
                assert page.locator('.app-shell').evaluate('(e)=>e.getBoundingClientRect().width') == 700
                page.locator('[data-bulletin-print]:not([disabled])').click()
                frame = page.frame_locator('.bulletin-print-frame')
                frame.locator('svg').first.wait_for()
                assert frame.locator('svg').count() == 2
                result = frame.locator('body').evaluate("""e => ({
                  min:getComputedStyle(e).minWidth,
                  shell:!!e.querySelector('.app-shell'),
                  pages:[...e.querySelectorAll('svg')].map(p=>({
                    width:p.getBoundingClientRect().width,height:p.getBoundingClientRect().height}))
                })""")
                assert result['min'] == '0px' and not result['shell'], result
                assert all(abs(p['width']-1122.52)<1 and abs(p['height']-793.7)<1 for p in result['pages']), result
                assert page.locator('.app-shell').evaluate('(e)=>e.getBoundingClientRect().width') == 700
                print('PASS current bulletin print iframe isolation and two A4 landscape pages', engine)
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
