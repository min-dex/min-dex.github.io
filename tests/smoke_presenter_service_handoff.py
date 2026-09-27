"""Ensure an older presenter hydration cannot reclaim a newer live output."""

from smoke_app import launch_chromium, start_local_app_server, sync_playwright


server, url = start_local_app_server()
try:
    with sync_playwright() as playwright:
        for engine in ("chrome", "webkit"):
            browser = launch_chromium(playwright) if engine == "chrome" else playwright.webkit.launch()
            page = browser.new_page()
            page.route("**/*supabase*/**", lambda route: route.abort())
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_function("typeof openPresenterOutput === 'function'")
            print(engine, page.evaluate("""async () => {
              const check = (value, label) => { if (!value) throw Error(label); };
              const previous = {
                services: state.services,
                serviceItems: state.serviceItems,
                selectedServiceId: state.selectedServiceId,
                selectedServiceTypeId: state.selectedServiceTypeId,
                presenter: { ...state.presenter },
                module: state.module,
              };
              const first = { id: '__handoff-first__', type_id: 'sunday-first', date: '2099-07-05', title: '' };
              const youth = { id: '__handoff-youth__', type_id: 'youth', date: '2099-07-05', title: '' };
              const sent = [];
              try {
                state.services = [...previous.services, first, youth];
                state.serviceItems = { ...previous.serviceItems, [first.id]: [], [youth.id]: [] };
                state.loadedWorshipServiceIds.add(first.id);
                state.loadedWorshipServiceIds.add(youth.id);
                state.module = 'presenter';
                state.selectedServiceId = first.id;
                state.selectedServiceTypeId = first.type_id;
                state.presenter = {
                  ...state.presenter,
                  serviceId: first.id,
                  viewServiceId: first.id,
                  outputWindow: { closed: false, focus() {} },
                  outputConnectedAt: 0,
                  outputStopAt: 0,
                  outputGeneration: 0,
                  channel: { postMessage(message) { sent.push(message); } },
                };
                preparePresenterService(first.id);
                await openPresenterOutput(first.id);
                state.selectedServiceId = youth.id;
                state.selectedServiceTypeId = youth.type_id;
                await openPresenterOutput(youth.id);
                const sentAfterYouth = sent.length;
                await new Promise((resolve) => setTimeout(resolve, 350));
                check(state.presenter.serviceId === youth.id, 'older service reclaimed presenter state');
                const replayedStates = sent.slice(sentAfterYouth).filter((message) => message.type === 'presenter-state');
                check(replayedStates.every((message) => message.payload.serviceId === youth.id), 'older service published after handoff');
                return 'PASS handoff keeps newest service after delayed output refresh';
              } finally {
                stopPresenterOutputWindowMonitor();
                state.services = previous.services;
                state.serviceItems = previous.serviceItems;
                state.selectedServiceId = previous.selectedServiceId;
                state.selectedServiceTypeId = previous.selectedServiceTypeId;
                state.presenter = previous.presenter;
                state.module = previous.module;
              }
            }"""), flush=True)
            browser.close()
finally:
    server.shutdown()
