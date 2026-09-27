"""Keep first-service sermon content independent from second/third services."""

from smoke_app import launch_chromium, start_local_app_server, sync_playwright


server, url = start_local_app_server()
try:
    with sync_playwright() as playwright:
        for engine in ("chrome", "webkit"):
            browser = launch_chromium(playwright) if engine == "chrome" else playwright.webkit.launch()
            page = browser.new_page()
            page.route("**/*supabase*/**", lambda route: route.abort())
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_function("typeof sundaySharedContentTypesForItem === 'function'")
            print(engine, page.evaluate("""() => {
              const check = (value, label) => { if (!value) throw Error(label); };
              const first = { id: '__first__', type_id: 'sunday-first', date: '2099-07-05' };
              const second = { id: '__second__', type_id: 'sunday-second', date: '2099-07-05' };
              const third = { id: '__third__', type_id: 'sunday-main', date: '2099-07-05' };
              const sermon = normalizeServiceItem({
                service_id: first.id, label: '설교', raw_title: '독립 설교',
                _worshipSectionKey: 'sermon', _worshipSlotKey: 'sermon.title',
                memo: serializeServiceItemMemo({ elementType: 'title_person', inputMode: 'text' }),
              });
              const reading = normalizeServiceItem({
                service_id: first.id, label: '성경봉독', raw_title: '요 3:16',
                _worshipSectionKey: 'scripture_reading', _worshipSlotKey: 'word.reading',
                memo: serializeServiceItemMemo({ elementType: 'scripture_body', inputMode: 'scripture' }),
              });
              check(sundaySharedContentTypesForItem(sermon, first).length === 0, 'first sermon must be independent');
              check(JSON.stringify(sundaySharedContentTypesForItem(sermon, second)) === JSON.stringify(['sunday-second', 'sunday-main']), 'second sermon must link only to third');
              check(JSON.stringify(sundaySharedContentTypesForItem(sermon, third)) === JSON.stringify(['sunday-second', 'sunday-main']), 'third sermon must link only to second');
              check(JSON.stringify(sundaySharedContentTypesForItem(reading, first)) === JSON.stringify(['sunday-first', 'sunday-second', 'sunday-main']), 'reading scope changed unexpectedly');
              return 'PASS first sermon stays independent; second and third stay linked';
            }"""), flush=True)
            browser.close()
finally:
    server.shutdown()
