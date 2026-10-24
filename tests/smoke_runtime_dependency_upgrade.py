"""Retained HTML upgrades to new runtime dependencies without partial startup/writes."""
import os
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
import re
from pathlib import Path
from urllib.parse import urlsplit, parse_qs
from smoke_app import start_local_app_server, launch_chromium, sync_playwright

MODULES = ['mindex.presenter-praise.js', 'mindex.presenter-live.js',
           'mindex.presenter-board.js', 'mindex.presenter-controller.js']
ASSETS = MODULES + ['styles.workspace.css']
html = Path('index.html').read_text()
html = re.sub(r'window\.MINDEX_SUPABASE\s*=\s*\{[^}]*\};', 'window.MINDEX_SUPABASE = {};', html)
legacy = html
for name in ASSETS:
    legacy = legacy.replace('"' + name + '",', '')
legacy = re.sub(r'const compiledAppVersion = "[^"]+";', 'const compiledAppVersion = "cached-shell";', legacy)
server, url = start_local_app_server()
try:
    with sync_playwright() as pw:
        for engine in ('chromium', 'webkit'):
            browser = launch_chromium(pw) if engine == 'chromium' else pw.webkit.launch(headless=True)
            for case in ['current', 'legacy', *ASSETS, 'timeout']:
                page = browser.new_page()
                errors, mutations, requests, documents = [], [], [], []
                page.on('pageerror', lambda error: errors.append(str(error)))
                target = case
                def route(request_route):
                    request = request_route.request
                    parsed = urlsplit(request.url)
                    name = parsed.path.lstrip('/')
                    if parsed.netloc != urlsplit(url).netloc:
                        mutations.append(request.method + ' ' + parsed.path)
                        request_route.abort()
                        return
                    if parsed.path in ('/', '/index.html'):
                        documents.append(request.url)
                        refreshed = bool(parse_qs(parsed.query).get('mindex-runtime-upgrade'))
                        markup = html if case == 'current' or (refreshed and case != 'timeout') else legacy
                        request_route.fulfill(body=markup, content_type='text/html')
                        return
                    if name == target:
                        requests.append(parse_qs(parsed.query))
                        if len(requests) == 1:
                            request_route.abort()
                            return
                    request_route.continue_()
                page.route('**/*', route)
                page.goto(url, wait_until='domcontentloaded')
                if case == 'timeout':
                    page.locator('#bootError').wait_for(state='visible', timeout=10000)
                    assert page.evaluate('document.body.dataset.bootFailed === "true" && !window.__mindexRuntimeStarted')
                    assert page.evaluate('state.client === null && state.dirty.service === false')
                    assert len(documents) == 2, 'failed refresh must not loop'
                else:
                    page.wait_for_function("typeof runPresenterAction==='function' && !document.body.classList.contains('ui-booting')", timeout=15000)
                    result = page.evaluate('''() => ({
                      scripts: [...document.querySelectorAll('script[src]')].map(n=>new URL(n.src).pathname.split('/').pop()),
                      styles: [...document.querySelectorAll('link[rel=stylesheet]')].map(n=>new URL(n.href).pathname.split('/').pop()),
                      valid: presenterSlideModelIssues({elementType:PRESENTER_ELEMENT_TYPES.BLANK,layout:PRESENTER_SLIDE_LAYOUTS.BLANK}).length===0,
                      source: typeof presenterFormPlanForServiceItem==='function' && typeof renderPresenterSlideBoard==='function' && typeof currentPresenterAudioContext==='function'
                    })''')
                    assert result['valid'] and result['source'], result
                    for asset in MODULES:
                        assert result['scripts'].count(asset) == 1, result
                    styles = result['styles']
                    assert styles[styles.index('styles.css') + 1] == 'styles.workspace.css', styles
                    assert styles.index('styles.workspace.css') < styles.index('styles.presenter-output.css')
                    if case in ASSETS:
                        assert len(requests) == 2 and requests[1].get('boot-retry') == ['1'], requests
                assert len(documents) == (1 if case == 'current' else 2), documents
                assert not errors, errors
                assert not mutations, mutations
                print('PASS', engine, case, 'ordered dependencies/cascade, bounded refresh, no duplicate execution or production requests', flush=True)
                page.close()
            browser.close()
finally:
    server.shutdown()
    server.server_close()
