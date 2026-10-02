from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            browser = launch_chromium(p)
            page = browser.new_page()
            page.route('**/*supabase*/**', lambda route: route.abort())
            page.goto(url + '?output=presenter', wait_until='domcontentloaded')
            page.wait_for_function("typeof renderServicePresenterControlsUnscoped === 'function'")
            result = page.evaluate('''() => {
              const check = (ok, message) => { if (!ok) throw new Error(message); };
              const service = {id:'11111111-1111-4111-8111-111111111111', type_id:'monthly', date:'2026-10-02'};
              state.services = [service]; state.selectedServiceId = service.id;
              state.serviceItems[service.id] = [];
              const slides = buildServicePresenterSlides(service.id);
              const original = projectWorshipServiceItemsFromTemplate;
              let count = 0;
              projectWorshipServiceItemsFromTemplate = (...args) => { count++; return original(...args); };
              try {
                const before = performance.now();
                const expected = renderServicePresenterControlsUnscoped(service, slides);
                const baseline = {ms:performance.now()-before, projections:count};
                count = 0;
                const start = performance.now();
                const actual = renderServicePresenterControls(service, slides);
                const optimized = {ms:performance.now()-start, projections:count};
                check(actual === expected, 'render output changed');
                check(count === 1, 'board rebuild repeats template projection: '+count);
                const item = state.serviceItems[service.id].find((entry) => isMonthlyCorporatePrayerGroupItem(entry));
                const memo = parseServiceItemMemo(item.memo);
                memo.corporatePrayers = monthlyCorporatePrayerEntries(item, memo);
                memo.corporatePrayers[0].title = 'Updated prayer';
                memo.corporatePrayers[0].assignee = 'Updated leader';
                item.memo = serializeServiceItemMemo(memo);
                count = 0;
                const updated = renderServicePresenterControls(service, slides);
                check(count === 1, 'new render must use a fresh projection');
                check(updated.includes('Updated prayer') && updated.includes('Updated leader'), 'stale prayer inputs');
                let threw = false;
                try { withServiceItemsScope(() => { getServiceItems(service.id); throw new Error('test'); }); }
                catch { threw = true; }
                check(threw && serviceItemsScopeDepth === 0 && serviceItemsScopeCache.size === 0, 'scope leaked');
                return {baseline, optimized, unchangedMarkup:true, freshEdits:true};
              } finally { projectWorshipServiceItemsFromTemplate = original; }
            }''')
            print('PASS', result)
            browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
