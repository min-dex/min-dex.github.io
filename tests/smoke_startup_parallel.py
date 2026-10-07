"""Bootstrap downloads overlap without changing dependency execution order."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                try:
                    for mode in ('home', 'controller', 'output'):
                        page = browser.new_page()
                        page.route('**/*supabase.co/**', lambda r: r.abort())
                        if mode == 'controller':
                            page.add_init_script("sessionStorage.setItem('mindex.ui.module','presenter')")
                        held = []
                        requested = []
                        errors = []
                        page.route('**/vendor/lucide.min.js', lambda r: held.append(r))
                        page.on('request', lambda r: requested.append(r.url))
                        page.on('pageerror', lambda e: errors.append(str(e)))
                        page.goto(url + ('?output=presenter' if mode == 'output' else ''), wait_until='domcontentloaded')
                        page.wait_for_function("!!document.querySelector('link[as=script][href*=\"app.js\"]')")
                        page.wait_for_timeout(200)
                        assert held and any('/app.js?' in u for u in requested)
                        assert page.evaluate("typeof window.lucide==='undefined'")
                        fonts = page.locator('link[rel=preload][as=font][href*=freesentation]').count()
                        assert fonts == (0 if mode == 'home' else 3), (mode, fonts)
                        for route in held:
                            route.continue_()
                        page.wait_for_function("typeof state!=='undefined' && typeof window.supabase?.createClient==='function' && !!window.lucide")
                        if mode != 'output':
                            page.wait_for_function("!!document.querySelector('.monitor-panel')")
                        assert not errors, errors
                        print(engine, mode, 'PASS concurrent requests, ordered dependencies, scoped font preload', flush=True)
                        page.close()
                finally:
                    browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
