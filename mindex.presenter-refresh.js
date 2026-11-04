// Session-local output hold and bounded, read-only service refresh.
(() => {
  let hold = null, job = null;
  const moves = new Set(['next', 'prev', 'first', 'last', 'jump', 'return', 'prepare-next-service']);
  const live = id => presenterControllerIsLive(id);
  const identity = () => [state.client, state.config.url, state.presenter.outputSessionId, state.presenter.outputGeneration];
  const sameIdentity = expected => expected.every((value, i) => value === identity()[i]);
  const dirty = id => Boolean(state.dirtyServiceElementIds.get(id)?.size || state.dirtyServiceStructureIds.has(id)
    || serviceHasPendingTextEdits(id) || (state.selectedServiceId === id && state.dirty.service) || state.dirty.song || state.dirty.forms);
  function current(id) {
    if (hold && (hold.serviceId !== state.presenter.serviceId || hold.session !== state.presenter.outputSessionId || !live(hold.serviceId))) hold = null;
    return hold?.serviceId === id ? hold : null;
  }
  function capture(id, manual) {
    const existing = current(id);
    if (existing) { if (manual) existing.manual = true; return existing; }
    if (!live(id)) return null;
    hold = { serviceId: id, session: state.presenter.outputSessionId, manual, payload: structuredClone(presenterStatePayload()) };
    return hold;
  }
  function payload(value) {
    const frozen = current(value.serviceId);
    if (!frozen) return value;
    return { ...frozen.payload, outputFrozen: true, safetyBlank: value.safetyBlank, safetyBlankMode: value.safetyBlankMode,
      emergencyMode: value.emergencyMode, updatedAt: value.updatedAt };
  }
  function output(root, value) {
    const key = JSON.stringify([value.outputSessionId, value.safetyBlank, value.safetyBlankMode, value.emergencyMode]);
    const unchanged = root._presenterFreezeSafetyKey === key;
    root._presenterFreezeSafetyKey = key;
    if (value.outputFrozen && unchanged && root.querySelector('.presenter-output-layer.is-active')) {
      clearPresenterOutputAutoAdvanceTimer();
      return true;
    }
    return false;
  }
  function controls(id, slides) {
    const frozen = Boolean(current(id)), busy = job?.serviceId === id;
    return `<button type="button" class="icon-btn svc-presenter-window-button" data-presenter-action="freeze" data-service-id="${escapeAttr(id)}" aria-label="${frozen ? '프리즈 해제' : '프리즈'}" title="화면 전환 잠금 · 영상과 음원은 계속 재생" aria-pressed="${frozen}" ${!live(id) || !slides.length || busy ? 'disabled' : ''}><i data-lucide="pause"></i><span>${frozen ? '프리즈 해제' : '프리즈'}</span></button><button type="button" class="icon-btn svc-presenter-window-button" data-presenter-action="refresh-screen" data-service-id="${escapeAttr(id)}" aria-label="${busy ? '화면 갱신 중' : '화면 갱신'}" aria-busy="${Boolean(busy)}" title="현재 예배 자료 갱신" ${!state.client || busy ? 'disabled' : ''}><i data-lucide="refresh-cw"></i><span>${busy ? '화면 갱신 중' : '화면 갱신'}</span></button>`;
  }
  function action(name, id, options = {}) {
    if (name === 'stop' && id === state.presenter.serviceId) { hold = null; job = null; return false; }
    if (name === 'freeze') {
      if (!live(id) || job?.serviceId === id) return true;
      if (current(id)) hold = null; else capture(id, true);
      publishPresenterState();renderPresenterControlState(id);
      return true;
    }
    if (name === 'refresh-screen') { void refresh(id); return true; }
    return Boolean(current(id) && moves.has(name) && !(name === 'jump' && (Number(options.index) === -1 || (state.presenter.safetyBlank && Number(options.index) === state.presenter.index))));
  }
  async function refresh(id) {
    if (!id || job) return false;
    if (dirty(id)) { showToast('편집 중인 내용을 먼저 저장해 주세요. 입력과 송출은 유지했어요.', 'info'); return false; }
    const token = { serviceId: id }, expected = identity();
    const signature = presenterSlideBuildSourceSignature(id);
    const held = capture(id, false);
    job = token;if (held) publishPresenterState();renderPresenterControlState(id);
    const valid = () => job === token && sameIdentity(expected) && state.selectedServiceId === id && !dirty(id)
      && signature === presenterSlideBuildSourceSignature(id);
    let timer, applied = false;
    try {
      const staged = await Promise.race([stage(id), new Promise((_, reject) => {
        timer = setTimeout(() => reject(Error('자료 갱신이 지연됐어요. 기존 화면을 유지했어요.')), 15000);
      })]);
      if (!valid()) throw Error('갱신 중 입력이나 송출 상태가 바뀌었어요. 기존 내용을 유지했어요.');
      commit(id, staged);applied = true;
      showToast('화면 갱신을 완료했어요.', 'info');
      return true;
    } catch (error) {
      if (job === token) showToast(/^(자료 갱신이 지연됐어요|갱신 중|저장 결과를 먼저|예배 자료를 확인하지)/.test(error.message || '') ? error.message : '갱신하지 못했어요. 기존 화면과 입력을 유지했어요.', 'error');
      return false;
    } finally {
      clearTimeout(timer);
      if (job === token) {
        job = null;
        if (hold === held && !held?.manual) hold = null;
        if (held && sameIdentity(expected) && live(id)) {
          if (!applied && !held.manual) publishPresenterPayload({ ...held.payload, outputFrozen: false,
            safetyBlank: state.presenter.safetyBlank, safetyBlankMode: state.presenter.safetyBlankMode, emergencyMode: state.presenter.emergencyMode, updatedAt: Date.now() });
          else publishPresenterState();
        }
        if (state.selectedServiceId === id) renderPresenterControlState(id);
      }
    }
  }
  async function stage(id) {
    const atomic = await worshipAtomicClient();
    if (atomic.pending(id)) throw Error('저장 결과를 먼저 확인해 주세요. 기존 화면은 유지했어요.');
    const aggregate = await atomic.read(id, { adopt: false });
    if (aggregate?.service?.id !== id || !Array.isArray(aggregate.sections) || !Array.isArray(aggregate.elements)) throw Error('예배 자료를 확인하지 못했어요.');
    const ids = [...new Set(aggregate.elements.map(row => row.song_id).filter(Boolean))];
    const songs = await MindexPresenterFreshness.freshSongs(ids);
    return { atomic, aggregate, songs };
  }
  function commit(id, { atomic, aggregate, songs }) {
    if (atomic.pending(id)) throw Error('갱신 중 저장이 시작됐어요. 기존 화면을 유지했어요.');
    const service = normalizeWorshipService(aggregate.service);
    const items = projectWorshipServiceItemsFromTemplate(service, groupWorshipElements(aggregate.sections, aggregate.elements)[id] || []);
    const before = { services: state.services, sections: state.worshipSections, elements: state.worshipElements,
      items: state.serviceItems[id], songs: state.songs, clean: state.cleanFingerprints.service, presenter: { ...state.presenter }, loaded: state.loadedWorshipServiceIds.has(id) };
    const ids = new Set(state.worshipSections.filter(row => row.service_id === id).map(row => row.id));
    let restoreSession;
    try {
      state.services = state.services.map(row => row.id === id ? service : row);
      state.worshipSections = [...state.worshipSections.filter(row => row.service_id !== id), ...aggregate.sections];
      state.worshipElements = [...state.worshipElements.filter(row => !ids.has(row.section_id)), ...aggregate.elements];
      state.serviceItems[id] = items;
      const map = new Map(state.songs.map(song => [song.id, song]));songs.forEach(song => map.set(song.id, song));state.songs = [...map.values()];
      state.loadedWorshipServiceIds.add(id);
      restoreSession = MindexPresenterFreshness.adoptRefresh(id, aggregate.revision, songs);
      clearSearchCaches();presenterSlideBuildCache.delete(id);
      refreshPresenterForService(id, { publish: false, renderControls: false });
      if (state.selectedServiceId === id) captureCleanFingerprint('service');
      atomic.adoptRemote(id, aggregate);
    } catch (error) {
      state.services = before.services;state.worshipSections = before.sections;state.worshipElements = before.elements;
      state.serviceItems[id] = before.items;state.songs = before.songs;Object.assign(state.presenter, before.presenter);
      if (!before.loaded) state.loadedWorshipServiceIds.delete(id);
      state.cleanFingerprints.service = before.clean;restoreSession?.();presenterSlideBuildCache.delete(id);throw error;
    }
  }
  globalThis.MindexPresenterRefresh = { action, payload, output, controls, refresh, frozen: id => Boolean(current(id)) };
})();
