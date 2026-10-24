"""Explicit live read-only verification; run ONLY via run_live_readonly_smoke.py.

No writes, UI saves, output windows, native fullscreen or private configuration.
This complements the maintained offline gate; it does not replace broad suites.
"""
import json
from smoke_app import (sync_playwright, launch_chromium, start_local_app_server,
                       build_raw_connection_link, wait_for_service_data)


def main():
    # Refuse accidental unguarded execution, including import-and-main callers.
    from playwright.sync_api import Browser
    if Browser.new_context.__module__ != '__main__' or Browser.new_context.__name__ != 'new_context':
        raise RuntimeError('Use tests/run_live_readonly_smoke.py smoke_live_readonly_core')
    server, app_url = start_local_app_server()
    try:
        with sync_playwright() as playwright:
            browser = launch_chromium(playwright)
            context = browser.new_context(viewport={'width': 1440, 'height': 980})
            errors = []
            try:
                page = context.new_page()
                page.on('pageerror', lambda error: errors.append(str(error)))
                page.goto(build_raw_connection_link(app_url, 'presenter'), wait_until='domcontentloaded')
                page.wait_for_function("typeof state !== 'undefined' && typeof buildServicePresenterSlides === 'function' && !document.body.classList.contains('ui-booting')", timeout=45000)
                wait_for_service_data(page)
                page.wait_for_function("document.body.dataset.serverStateReady === 'true'", timeout=45000)
                page.evaluate('loadServiceData()')
                page.wait_for_function('state.services.length > 0', timeout=45000)
                counts = page.evaluate("""async () => {
                  if (state.connectionError || state.serviceError) throw Error('Live service load failed');
                  const selected = state.services.slice(0, 8);
                  let items = 0, slides = 0, rendered = 0;
                  for (const service of selected) {
                    await ensureWorshipServiceRowsLoadedForPersistence(service.id);
                    const sectionIds = new Set(state.worshipSections.filter(s => s.service_id === service.id).map(s => s.id));
                    const source = () => JSON.stringify({
                      service,
                      sections: state.worshipSections.filter(s => sectionIds.has(s.id)),
                      elements: state.worshipElements.filter(e => sectionIds.has(e.section_id)),
                      songs: state.songs
                    });
                    const before = source();
                    const deck = buildServicePresenterSlides(service.id);
                    for (const slide of deck) {
                      const html = renderPresenterSlideFrame(slide);
                      if (typeof html !== 'string' || !html.includes('presenter-slide')) throw Error('Saved service slide did not render');
                      rendered++;
                    }
                    if (source() !== before) {
                      const a=JSON.parse(before),b=JSON.parse(source());
                      const diff=(x,y,p='')=>{
                        if(JSON.stringify(x)===JSON.stringify(y))return [];
                        if(!x||!y||typeof x!=='object'||typeof y!=='object')return [p];
                        return [...new Set([...Object.keys(x),...Object.keys(y)])].flatMap(k=>diff(x[k],y[k],p+'.'+k));
                      };
                      throw Error('Rendering changed source paths: '+diff(a,b).slice(0,20).join(','));
                    }
                    if (!state.loadedWorshipServiceIds.has(service.id)) throw Error('Saved rows not hydrated');
                    items += (state.serviceItems[service.id] || []).length;
                    slides += deck.length;
                  }
                  return {services: selected.length, items, slides, rendered};
                }""")
                assert counts['services'] > 0 and counts['items'] > 0 and counts['slides'] == counts['rendered'] > 0, counts
                assert not errors, f'{len(errors)} browser errors'
                print('PASS live-startup-state-isolated')
                print('PASS live-service-read-render-preserves-source :: ' + json.dumps(counts))
                print('PASS live-browser-no-page-errors')
                return 0
            finally:
                context.close()
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    raise SystemExit('Use tests/run_live_readonly_smoke.py smoke_live_readonly_core')
