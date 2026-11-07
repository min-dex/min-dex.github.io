// Detached startup reads and entered-service refresh. Never persist or touch transport.
(() => {
  let initialReads = null;
  function readWorshipEntryLists() {
    return Promise.all([
      fetchCachedSupabasePaged("mindex_worship_service_types", WORSHIP_SERVICE_TYPE_SELECT,
        query => query.order("sort_order", { ascending: true })).catch(error => {
          console.warn("Could not load worship service types; using defaults.", error);
          return [];
        }),
      fetchWorshipServiceListRows(),
    ]);
  }
  function prepareInitialReads() {
    const receipt = {client:state.client};
    // Settle immediately: a list failure must not reject unhandled while the
    // catalog is loading. No worship rows or UI state are adopted here.
    receipt.promise = readWorshipEntryLists().then(value => ({value}), error => ({error}));
    initialReads = receipt;
    return {discard() { if (initialReads === receipt) initialReads = null; }};
  }
  async function readInitialLists() {
    const receipt = initialReads, client = state.client;
    initialReads = null;
    const result = receipt?.client === client ? await receipt.promise
      : await readWorshipEntryLists().then(value => ({value}), error => ({error}));
    if (state.client !== client) throw Error("연결이 변경되었습니다. 입력을 보존한 뒤 다시 열어 주세요.");
    if (result.error) throw result.error;
    return result.value;
  }
  function readHomeOverviewTotals(client) {
    const read = async (query) => {
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), 15000);
      try { return await query().abortSignal(abort.signal); }
      finally { clearTimeout(timer); }
    };
    const songs = async () => {
      await ensureSingleSongActivation();
      if (state.client !== client) throw Error("HOME_OVERVIEW_CLIENT_CHANGED");
      if (state.singleSongCatalog) return {count:state.singleSongCatalog.displayCount()};
      return read(() => client.from("mindex_songs").select("id", { count:"exact", head:true }));
    };
    return {
      songs: songs(),
      editions: read(() => client.from("mindex_bible_translations")
        .select("id,name,language,canonical_source:metadata->canonical_source").eq("is_active", true)),
    };
  }
  function initialElementIds(services = []) {
    const pinned = new Set([state.selectedServiceId, state.presenter.serviceId].filter(Boolean));
    const loadHomeWeek = ["home", "service"].includes(state.module) && state.selectedServiceTypeId === SERVICE_WEEK_PANEL_ID;
    const from = loadHomeWeek ? localDateStringWithOffset(new Date(), 0) : "";
    const to = loadHomeWeek ? localDateStringWithOffset(new Date(), WORSHIP_INITIAL_ELEMENT_HOME_DAYS) : "";
    return services
      .filter((service) => {
        if (!service?.id) return false;
        if (pinned.has(service.id)) return !shouldDeferPastWorshipServiceLoad(service.id);
        if (!loadHomeWeek) return false;
        const date = String(service.date || service.service_date || "").trim();
        return date && (!from || date >= from) && (!to || date <= to);
      })
      .map((service) => service.id);
  }
  let dashboardReads = null;
  function dashboardLoadState() {
    if (!canUseClientData()) return "";
    const missing = initialElementIds(state.services).filter(id => !state.loadedWorshipServiceIds.has(id)
      && !serviceViewHasProtectedSurface(id));
    if (!missing.length) return "";
    const failed = missing.find(id => serviceViewLoadErrors.has(id));
    if (failed) return renderServiceViewLoadState(state.services.find(service => service.id === failed));
    if (!serviceDataLoadPromise && !dashboardReads) {
      const receipt = {client:state.client};
      dashboardReads = receipt;
      let next = 0, failedRead = false;
      const worker = async () => {
        while (!failedRead && receipt.client === state.client && next < missing.length) {
          const id = missing[next++];
          try { await loadServiceItems(id); }
          catch { failedRead = true; }
        }
      };
      receipt.promise = Promise.all(Array.from({length:Math.min(3,missing.length)},worker)).finally(() => {
        if (dashboardReads !== receipt) return;
        dashboardReads = null;
        if (receipt.client === state.client && ["home","service"].includes(state.module)
          && state.selectedServiceTypeId === SERVICE_WEEK_PANEL_ID && !state.selectedServiceId
          && !isGlobalSearchActive()) renderCurrentServiceModuleDetail();
      });
    }
    return renderLoadingDetail();
  }
  let busy = false;
  const deletedNotices = new Set();
  let entryToken = 0;
  const invalidate = () => { entryToken += 1; };
  let editRevision = 0;
  document.addEventListener("input", () => { editRevision += 1; }, true);
  document.addEventListener("change", () => { editRevision += 1; }, true);
  function blockedReason() {
    if (isPresenterOutputWindowOpen() || state.presenter.outputPendingAt) return "송출 중에는 DB 갱신을 보류합니다. 현재 화면은 유지됩니다.";
    if (document.querySelector('[data-input-status="error"]')) return "저장에 실패한 입력이 있어요. 해당 입력을 다시 저장한 뒤 새로고침해 주세요.";
    if (pendingSundayEditSync.size) return "연결된 예배에 반영하지 못한 변경이 남아 있어요. 해당 예배를 저장해 동기화를 완료해 주세요.";
    const pendingText = [...document.querySelectorAll('[data-service-item-field]')].some(field =>
      isDeferredServiceTextInput(field) && field.dataset.initialValue !== undefined
      && field.value !== field.dataset.initialValue);
    if (pendingText) return "미저장 입력이 있어요. 현재 입력을 유지합니다.";
    const pendingFeedback = [...document.querySelectorAll('[data-input-status="modified"]')].some(node => {
      const editor = node.closest('.svc-board-subgroup-control-item');
      if (!editor) return true;
      const fields = [...editor.querySelectorAll('[data-service-item-field]')];
      // Only dismiss feedback when every field has a known, unchanged text baseline.
      return !fields.length || fields.some(field => !isDeferredServiceTextInput(field)
        || field.dataset.initialValue === undefined || field.value !== field.dataset.initialValue);
    });
    if (hasDirtyChanges({ reconcile: true })
      || state.dirtyServiceElementIds.size || state.dirtyServiceStructureIds.size || state.dirtyServiceTypeIds.size
      || Object.values(state.presenterPreparationDrafts).some(value => String(value || "").trim())
      || [...worshipSetlistLeaderDrafts.values()].some(draft => draft.saving || cleanServiceAssignee(draft.value) !== draft.original)
      || pendingFeedback) {
      return "미저장 입력이 있어요. 현재 입력을 유지합니다.";
    }
    if (state.saving || state.loading || activeServiceSavePromise || songLoadPromise || serviceDataLoadPromise
      || calendarLoadPromise || linkedSongLoadPromises.size || serviceItemLoadPromises.size
      || presenterServiceHydrationPromises.size || worshipPresenterSlideLoadPromises.size
      || state.presenterPreparationApplyingServiceIds.size
      || document.querySelector('[data-input-status="saving"]')) {
      return "저장 또는 불러오기가 진행 중이에요. 현재 화면은 유지됩니다.";
    }
    return "";
  }

  async function fetchSnapshot(serviceId) {
      const ids = [serviceId];
      const fullServices = await fetchSupabaseBatches(ids, batch => fetchSupabasePaged("mindex_worship_services", "*", q => q.in("id", batch).order("id")));
      const sections = await fetchSupabaseBatches(ids, batch => fetchSupabasePaged("mindex_worship_sections", WORSHIP_SECTION_LIST_SELECT, q => q.in("service_id", batch).order("sort_order").order("id")));
      const elementSelect = await worshipElementListSelect();
      const elements = await fetchSupabaseBatches(sections.map(row => row.id), batch => fetchSupabasePaged("mindex_worship_elements", elementSelect, q => q.in("section_id", batch).order("sort_order").order("id")));
      const slides = await fetchSupabaseBatches(ids, batch => fetchSupabasePaged("mindex_worship_presenter_slides", "*", q => q.in("service_id", batch).order("section_order").order("element_order").order("slide_order")));
      return { ids, fullServices, sections, elements, slides };
  }
  function applySnapshot(snapshot) {
    const full = new Map(snapshot.fullServices.map(row => [row.id, normalizeWorshipService(row)]));
    state.services = state.services.map(row => full.get(row.id) || row);
      const ids = new Set(snapshot.ids);
      const sectionIds = new Set([...state.worshipSections.filter(row => ids.has(row.service_id)), ...snapshot.sections].map(row => row.id));
      state.worshipSections = [...state.worshipSections.filter(row => !ids.has(row.service_id)), ...snapshot.sections];
      state.worshipElements = [...state.worshipElements.filter(row => !sectionIds.has(row.section_id)), ...snapshot.elements];
      const grouped = groupWorshipElements(snapshot.sections, snapshot.elements);
      const hidden = new Set(snapshot.elements.filter(row => row.config?.hiddenInPresentation || row.config?.hidden_in_presentation || row.config?.hidden).map(row => row.id));
      const slides = groupWorshipPresenterSlides(snapshot.slides, hidden);
      for (const id of ids) {
        const service = state.services.find(row => row.id === id);
        state.serviceItems[id] = service ? projectWorshipServiceItemsFromTemplate(service, grouped[id] || []) : [];
        state.loadedWorshipServiceIds.add(id);
        state.worshipPresenterSlides[id] = slides[id] || [];
        state.loadedWorshipPresenterServiceIds.add(id);
        presenterSlideBuildCache.delete(id);
      }

    captureCleanFingerprint("service");
  }
  async function check(serviceId, token = entryToken, { background = false } = {}) {
    const focusedInput = () => background && departmentRefreshBlocked();
    if (token !== entryToken || !serviceId || busy || !state.client || !["service", "presenter"].includes(state.module)
      || state.selectedServiceId !== serviceId || blockedReason() || focusedInput()) return false;
    const context = () => JSON.stringify([state.module, state.selectedServiceId, presenterViewServiceId()]);
    const before = context(), revision = editRevision, model = dirtyModuleFingerprint("service"), client = state.client;
    busy = true;
    try {
      let snapshot;
      const safe = () => state.client === client && token === entryToken && before === context() && revision === editRevision
        && model === dirtyModuleFingerprint("service") && !blockedReason() && !focusedInput();
      if (!safe()) return false;
      if (background) {
        const atomic = await worshipAtomicClient();
        if (!safe() || atomic.pending(serviceId)) return false;
        const previousRevision = atomic.baseline(serviceId)?.revision;
        // A null aggregate means remote deletion. Retain the open view; never navigate away automatically.
        const aggregate = await atomic.read(serviceId, { adopt: () => false });
        if (!safe()) return false;
        if (!aggregate?.service) {
          const key = `${state.config.url}:${serviceId}`;
          if (!deletedNotices.has(key)) showToast("다른 곳에서 삭제된 예배예요. 현재 화면은 유지됩니다. 예배 목록에서 다시 확인해 주세요.", "error");
          deletedNotices.add(key);
          return true;
        }
        if (aggregate.revision === previousRevision) return true;
        // Adopt this exact snapshot only after every interaction guard is rechecked.
        atomic.adoptRemote(serviceId, aggregate);
        snapshot = { ids: [serviceId], fullServices: [aggregate.service], sections: aggregate.sections,
          elements: aggregate.elements, slides: [] };
      } else {
        snapshot = await fetchSnapshot(serviceId);
        if (!safe()) return false;
      }
      if (!snapshot.fullServices.length) return false;
      const viewport = captureDetailViewportSnapshot();
      const selectedId = Number.isInteger(state.selectedServiceItemIndex)
        ? getServiceItems(serviceId)[state.selectedServiceItemIndex]?.id : null;
      applySnapshot(snapshot);
      if (selectedId) {
        const nextIndex = getServiceItems(serviceId).findIndex(item => item.id === selectedId);
        state.selectedServiceItemIndex = nextIndex >= 0 ? nextIndex : null;
      }
      render();
      restoreDetailViewportSnapshot(viewport);
      return true;
    } catch (error) {
      console.error("[Service entry]", error);
      if (!background && token === entryToken && before === context()) showToast("최신 예배를 확인하지 못했어요. 현재 내용은 유지됩니다.", "error");
      return false;
    } finally { busy = false; }
  }
  async function enter(serviceId, { background = false } = {}) {
    const token = ++entryToken, revision = editRevision;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (token !== entryToken || revision !== editRevision || state.selectedServiceId !== serviceId
        || !["service", "presenter"].includes(state.module)) return false;
      const reason = blockedReason();
      if (reason && !reason.startsWith("저장 또는 불러오기")) return false;
      if (!busy && !reason) return check(serviceId, token, { background });
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  }
  window.MINDEX_SERVICE_ENTRY = { check, enter, invalidate, prepareInitialReads, readInitialLists, initialElementIds, dashboardLoadState, readHomeOverviewTotals };
})();
