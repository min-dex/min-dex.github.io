from smoke_app import launch_chromium, start_local_app_server, sync_playwright


server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ("chrome", "webkit"):
            browser = launch_chromium(p) if engine == "chrome" else p.webkit.launch()
            page = browser.new_page()
            page.route("**/*supabase*/**", lambda route: route.abort())
            page.goto(url, wait_until="domcontentloaded")
            page.wait_for_function("typeof state !== \"undefined\" && typeof compactSearchValue === \"function\" && !document.body.classList.contains('ui-booting') && (typeof prepareNextServiceFromPresenter === 'function')")
            print(engine, page.evaluate("""async () => {
              const check = (value, label) => { if (!value) throw Error(label); };
              const previous = {
                services: state.services,
                serviceItems: state.serviceItems,
                selectedServiceId: state.selectedServiceId,
                selectedServiceTypeId: state.selectedServiceTypeId,
                presenter: { ...state.presenter },
                module: state.module,
                pageTabs: state.pageTabs.map(tab => ({ ...tab })),
                pageTabIndex: state.pageTabIndex,
              };
              const first = { id: '__next-prep-first__', type_id: 'sunday-first', date: '2099-07-05', title: '' };
              const youth = { id: '__next-prep-youth__', type_id: 'youth', date: '2099-07-05', title: '' };
              try {
                state.services = [...previous.services, first, youth];
                state.serviceItems = { ...previous.serviceItems, [first.id]: [], [youth.id]: [] };
                state.loadedWorshipServiceIds.add(youth.id);
                state.module = 'presenter';
                state.selectedServiceId = first.id;
                state.selectedServiceTypeId = first.type_id;
                state.presenter = { ...state.presenter, serviceId: first.id, viewServiceId: first.id, outputWindow: null, outputConnectedAt: 0 };
                preparePresenterService(first.id);
                const button = renderPresenterNextPreparationButton(first.id, nextPreparationTarget(first));
                check(button.includes(`data-next-service-id=\"${youth.id}\"`), 'button payload missing target');
                refs.detailPane.innerHTML = button;
                await prepareNextServiceFromPresenter(first.id, { nextServiceId: youth.id });
                check(state.selectedServiceId === youth.id, 'idle selection did not move');
                check(state.presenter.viewServiceId === youth.id, 'idle view did not move');
                check(state.presenter.serviceId === youth.id, 'idle presenter did not prepare target');
                check(state.pageTabs[state.pageTabIndex]?.label === serviceDisplayTypeName(youth), 'page tab label did not update');

                state.selectedServiceId = first.id;
                state.selectedServiceTypeId = first.type_id;
                preparePresenterService(first.id);
                state.presenter.outputWindow = { closed: false };
                await prepareNextServiceFromPresenter(first.id, { nextServiceId: youth.id });
                check(state.selectedServiceId === youth.id, 'live selection did not move');
                check(state.presenter.viewServiceId === youth.id, 'live view did not move');
                check(state.presenter.serviceId === youth.id, 'live output did not switch service');
                check(isPresenterOutputWindowOpen(), 'live output closed');
                const oldCan=canUseClientData,oldHydrate=hydratePresenterServiceData,oldDirty=hasDirtyChanges,oldConfirm=confirmSaveBeforeLeaving;
                state.selectedServiceId=first.id;preparePresenterService(first.id);
                const oldWindow=state.presenter.outputWindow,oldSlides=state.presenter.slides;
                canUseClientData=()=>true;state.loadedWorshipServiceIds.delete(youth.id);
                hydratePresenterServiceData=async()=>{throw Error('fixture offline')};
                await prepareNextServiceFromPresenter(first.id,{nextServiceId:youth.id});
                check(state.selectedServiceId===first.id&&state.presenter.serviceId===first.id&&state.presenter.slides===oldSlides&&state.presenter.outputWindow===oldWindow,'failed hydration changed output');
                hasDirtyChanges=()=>true;confirmSaveBeforeLeaving=async()=>false;
                await prepareNextServiceFromPresenter(first.id,{nextServiceId:youth.id});
                check(state.presenter.serviceId===first.id,'cancelled unsaved confirmation changed output');
                hasDirtyChanges=()=>false;
                let release;hydratePresenterServiceData=()=>new Promise(resolve=>{release=resolve});
                const pending=prepareNextServiceFromPresenter(first.id,{nextServiceId:youth.id});
                state.selectedServiceId='other';release();await pending;
                check(state.presenter.serviceId===first.id,'stale preparation changed output');
                canUseClientData=oldCan;hydratePresenterServiceData=oldHydrate;hasDirtyChanges=oldDirty;confirmSaveBeforeLeaving=oldConfirm;
                return 'PASS next preparation moves live output to target without closing window';
              } finally {
                state.services = previous.services;
                state.serviceItems = previous.serviceItems;
                state.selectedServiceId = previous.selectedServiceId;
                state.selectedServiceTypeId = previous.selectedServiceTypeId;
                state.presenter = previous.presenter;
                state.module = previous.module;
                state.pageTabs = previous.pageTabs;
                state.pageTabIndex = previous.pageTabIndex;
              }
            }"""), flush=True)
            browser.close()
finally:
    server.shutdown()
