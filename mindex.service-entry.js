// Refresh one entered service using a detached snapshot. Never persist or touch transport.
(() => {
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
  async function enter(serviceId) {
    const token = ++entryToken, revision = editRevision;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (token !== entryToken || revision !== editRevision || state.selectedServiceId !== serviceId
        || !["service", "presenter"].includes(state.module)) return false;
      const reason = blockedReason();
      if (reason && !reason.startsWith("저장 또는 불러오기")) return false;
      if (!busy && !reason) return check(serviceId, token);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    return false;
  }
  window.MINDEX_SERVICE_ENTRY = { check, enter, invalidate };
})();
