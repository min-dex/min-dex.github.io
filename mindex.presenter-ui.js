function bindPresenterViewportLifecycleEvents() {
  const refreshPreviewLayout = () => {
    if (state.module !== "presenter") return;
    schedulePresenterPreviewLayoutUpdate(refs.detailPane);
  };

  window.addEventListener("resize", refreshPreviewLayout);
  window.visualViewport?.addEventListener?.("resize", refreshPreviewLayout);

  if (typeof MutationObserver !== "undefined") {
    const presenterViewportObserver = new MutationObserver(refreshPreviewLayout);
    presenterViewportObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
  }

  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") {
      persistListScrollState();
      return;
    }
    refreshPreviewLayout();
    scheduleServiceMusicResume("visibility");
  });
  window.addEventListener("pagehide", persistListScrollState);
}

function bindPresenterInputGuardEvents() {
  window.addEventListener("keydown", (event) => {
    if (event.target.closest?.(".worship-conflict-dialog")) return;
    scheduleServiceMusicResume("keydown");
    const presenterJumpInput = event.target.closest?.("[data-presenter-jump-input]");
    if (presenterJumpInput && event.key === "Escape") {
      event.preventDefault();
      event.target.blur?.();
      clearPresenterJumpDraft(presenterJumpInput.dataset.serviceId || state.presenter.serviceId);
      event.stopImmediatePropagation?.();
      event.stopPropagation();
      return;
    }
    if (shouldBlockPresenterMusicControlNavigationKeydown(event)) {
      event.preventDefault();
      event.target.blur?.();
      event.stopImmediatePropagation?.();
      event.stopPropagation();
    }
  }, { capture: true });

  window.addEventListener("pointerup", (event) => {
    if (event.target.closest?.(".worship-conflict-dialog")) return;
    scheduleServiceMusicResume("pointerup");
  }, { capture: true });
}

function presenterLyricsSlidesForServiceItem({
  item, section, index, song, version, displayText, label, forms, formWarnings,
}) {
  let contentIndex = 0;
  return forms.flatMap((form, sequenceIndex) => {
    if (form._presenterTitle) return [presenterSequenceTitleSlide(item, section, song, version, displayText, index, sequenceIndex)];
    const formIndex = contentIndex++;
    if (form._presenterBlank) {
      return [{
        id: `${item.id || index}:blank:${form._presenterToken || formIndex}:${formIndex}`,
        ...section,
        elementType: PRESENTER_ELEMENT_TYPES.BLANK,
        layout: PRESENTER_SLIDE_LAYOUTS.BLANK,
        type: "blank",
        label,
        title: form.label || "빈 화면",
        formLabel: form.label || "",
        marker: "",
        formKey: `blank:${form._presenterToken || formIndex}:${formIndex}`,
        segment: "",
        text: "",
        warnings: formWarnings,
        sort: index + sequenceIndex / 100,
      }];
    }

    // Authored blank lines delimit slides; a paragraph is never padded to two lines.
    const chunks = splitFreeShowParagraphs(form.lyrics);
    const formId = form._localId || form.id || formIndex;
    const formKey = `${formId}:${formIndex}`;
    return chunks.map((chunk, chunkIndex) => ({
      id: `${item.id || index}:form:${formId}:seq:${formIndex}:chunk:${chunkIndex}`,
      ...section,
      elementType: PRESENTER_ELEMENT_TYPES.PRAISE,
      layout: PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,
      type: "lyrics",
      label,
      title: presenterPraiseTitle(song, displayText),
      subtitle: versionDisplayName(song, version),
      marker: chunkIndex === 0 ? presenterFormMarker(form) : "",
      formKey,
      segment: "",
      text: chunk,
      warnings: formWarnings,
      sort: index + sequenceIndex / 100 + chunkIndex / 10000,
    }));
  });
}

function renderPresenterScreenControl() {
  if (state.presenter.screens.length) {
    return `
      <label class="svc-presenter-screen-select" title="송출 화면 선택">
        <i data-lucide="monitor" aria-hidden="true"></i>
        <select data-presenter-screen-select aria-label="송출 화면 선택">
          <option value="">${escapeHtml(uiText("presenter.option.auto"))}</option>
          ${state.presenter.screens.map((screen) => `
            <option value="${escapeAttr(screen.key)}" ${state.presenter.selectedScreenId === screen.key ? "selected" : ""}>
              ${escapeHtml(screen.label)}
            </option>
          `).join("")}
        </select>
      </label>`;
  }
  return `
    <button class="icon-btn" type="button" data-presenter-action="detect-screens" aria-label="${escapeAttr(uiText("presenter.action.detectDisplays"))}" title="${escapeAttr(uiText("presenter.action.detectDisplays"))}">
      <i data-lucide="monitor"></i>
      <span class="svc-presenter-screen-label">화면 감지</span>
    </button>`;
}

function renderPresenterAlwaysOnTopControl({ buttonStyle = false } = {}) {
  const supported = Boolean(window.mindexElectron?.setPresenterAlwaysOnTop);
  return `
    <label class="svc-presenter-pin-toggle${buttonStyle ? " svc-presenter-pin-button svc-presenter-window-button" : ""}${supported ? "" : " is-unavailable"}" title="${supported ? "출력 창을 항상 위에 표시" : "웹 버전에서는 항상 위 표시를 지원하지 않습니다"}">
      <input type="checkbox" data-presenter-always-on-top ${supported && state.presenter.alwaysOnTop ? "checked" : ""} ${supported ? "" : "disabled"} />
      ${buttonStyle ? `<i data-lucide="pin" aria-hidden="true"></i>` : `<span class="svc-presenter-pin-track" aria-hidden="true"></span>`}
      <span>항상 위</span>
    </label>`;
}

function setPresenterAlwaysOnTopPreference(enabled) {
  const updater = window.mindexElectron?.setPresenterAlwaysOnTop;
  if (!updater) {
    state.presenter.alwaysOnTop = false;
    safeStorageRemove("local", PRESENTER_ALWAYS_ON_TOP_STORAGE_KEY);
    showToast("웹 버전에서는 항상 위 표시를 지원하지 않습니다.", "info");
    renderPresenterControlState(presenterViewServiceId());
    return;
  }
  state.presenter.alwaysOnTop = Boolean(enabled);
  safeStorageSet("local", PRESENTER_ALWAYS_ON_TOP_STORAGE_KEY, state.presenter.alwaysOnTop ? "true" : "false");
  updater({ enabled: state.presenter.alwaysOnTop }).catch((error) => {
    console.warn("Could not update presenter always-on-top state.", error);
  });
  renderPresenterControlState(presenterViewServiceId());
}

function renderPresenterHelpControl() {
  const rows = [
    ["클릭", "슬라이드 선택"],
    ["더블클릭", "선택한 슬라이드 송출"],
    ["→ / ↓ / Space", "다음 슬라이드"],
    ["← / ↑", "이전 슬라이드"],
    ["번호 + Enter", "해당 슬라이드로 이동"],
    ["0 + Enter", "암전"],
    ["Home / End", "첫 / 마지막 슬라이드"],
    ["Esc 2번", "송출 종료 (빠르게 연속)"],
  ];
  const inputRows = [
    ["인용 구절", "성경 주소 입력 후 Enter로 해당 절 이동. 범위는 첫 절로 이동"],
    ["예배 입력", "반영 버튼 또는 Cmd/Ctrl+Enter"],
  ];
  return `
    <details class="svc-presenter-help" data-presenter-help ${window.MindexDisclosure?.attrs(["presenter-help"])||""}>
      <summary class="icon-btn" aria-label="${escapeAttr(uiText("presenter.action.help"))}" title="${escapeAttr(uiText("presenter.action.help"))}">
        <i data-lucide="circle-help"></i>
      </summary>
      <div class="svc-presenter-help-panel" role="dialog" aria-label="${escapeAttr(uiText("presenter.help.title"))}">
        <div class="svc-presenter-help-head">
          <strong>${escapeHtml(uiText("presenter.help.title"))}</strong>
          <small>송출 중인 예배의 조작 기준입니다. 글을 입력할 때는 슬라이드 이동 단축키가 작동하지 않습니다.</small>
        </div>
        <dl>
          ${rows.map(([key, value]) => `
            <div>
              <dt>${escapeHtml(key)}</dt>
              <dd>${escapeHtml(value)}</dd>
            </div>`).join("")}
        </dl>
        <div class="svc-presenter-help-head">
          <strong>입력</strong>
          <small>준비 중에는 구절만 선택합니다. 송출 중에는 선택한 구절로 바로 전환합니다.</small>
        </div>
        <dl>
          ${inputRows.map(([key, value]) => `
            <div>
              <dt>${escapeHtml(key)}</dt>
              <dd>${escapeHtml(value)}</dd>
            </div>`).join("")}
        </dl>
      </div>
    </details>`;
}

function renderServicePresenterControls(service, slides, active, index) {
  const boardKey = presenterControlBoardKey(service, slides, active, presenterServiceUsesChromakey(service));
  return `
    <section id="servicePresenterControls" class="${escapeAttr(presenterControlsClassName(active, presenterServiceUsesChromakey(service)))}" aria-label="${escapeAttr(uiText("presenter.controls"))}" data-board-key="${escapeAttr(boardKey)}" data-service-id="${escapeAttr(service.id)}">
      <div class="svc-presenter-workspace">
        <div class="svc-presenter-board-column">
          ${renderPresenterSlideBoard(slides, presenterBoardActiveIndex(slides, active, index), service.id)}
        </div>
      </div>
    </section>`;
}

function presenterControlPreviewIndex(serviceId, slides, index) {
  const live = presenterControllerIsLive(serviceId);
  const selection = state.presenterBoardSelection;
  const selected = selection.serviceId === serviceId ? selection.indexes?.at(-1) : null;
  return clampPresenterIndex(live ? index : selected ?? index, slides.length);
}

function renderWorshipDefaultOrderFillControl(service) {
  if (!state.loadedWorshipServiceIds.has(service.id) || worshipServiceIsPast(service) || getServiceItems(service.id).length !== 2) return '';
  const sections = state.worshipSections.filter(row => row.service_id === service.id);
  const sectionIds = new Set(sections.map(row => row.id));
  const aggregate = { service: { service_type_id: service.type_id, source_ref: serviceRawSourceRef(service) }, sections,
    elements: state.worshipElements.filter(row => sectionIds.has(row.section_id)) };
  if (!worshipDefaultOrderSeedEligible(aggregate)) return '';
  return `<button class="btn secondary" type="button" data-service-default-order-fill="${escapeAttr(service.id)}" ${state.saving || state.dirty.service || worshipDefaultOrderFills.has(service.id) ? 'disabled' : ''}>기본 순서 채우기</button>`;
}

function syncPresenterPreparedPreview() {
  const serviceId = state.selectedServiceId;
  if (presenterControllerIsLive(serviceId)) return;
  const host = document.querySelector('[data-presenter-right-sidebar] .svc-presenter-top');
  const service = state.services.find(row => row.id === serviceId);
  if (!host || !service || host.closest('[data-service-id]')?.dataset.serviceId !== serviceId) return;
  const active = state.presenter.serviceId === serviceId;
  host.outerHTML = renderPresenterControlsTop(service, presenterSlidesForService(serviceId), active, active ? state.presenter.index : 0);
  refreshIcons(document.querySelector('[data-presenter-right-sidebar]'));
  schedulePresenterPreviewLayoutUpdate(document.querySelector('[data-presenter-right-sidebar]'));
}

function renderPresenterRightSidebar(service, slides, active, index) {
  if (!service?.id) return "";
  return `
    <div class="svc-presenter-side-panel" data-presenter-right-sidebar data-service-id="${escapeAttr(service.id)}">
      ${renderPresenterControlsTop(service, slides, active, index)}
      <div class="svc-presenter-input-stack">
        ${slides.filter((slide, index) => slide.liveScriptureControl && slide.elementId
          && slides.findIndex((candidate) => candidate.liveScriptureControl && candidate.elementId === slide.elementId) === index)
          .map((slide) => renderPresenterCitationComposer({ slides: [{ slide }] }, service.id)).join("")}
        ${renderPresenterServiceInputRail(service)}
      </div>
    </div>`;
}

const PRESENTER_ORDER_INPUT_OPEN_KEY = 'mindex.ui.presenterOrderInputOpen';
let presenterOrderInputOpen = null;

function renderPresenterServiceInputRail(service) {
  const expanded = presenterOrderInputOpen ?? safeStorageGet('local', PRESENTER_ORDER_INPUT_OPEN_KEY, 'true') !== 'false';
  const draft = presenterPreparationDisplayTextForService(service);
  const applying = state.presenterPreparationApplyingServiceIds.has(service.id);
  const hasValues = presenterPreparationDraftHasValues(service, draft);
  return `
    <aside class="svc-presenter-input-rail" aria-label="예배 입력">
      <button type="button" class="svc-presenter-input-rail-head svc-presenter-input-disclosure" data-presenter-order-toggle aria-expanded="${expanded}" aria-controls="presenterOrderInputBody">
        <span>예배 순서 입력</span><i data-lucide="chevron-down" aria-hidden="true"></i>
      </button>
      <section id="presenterOrderInputBody" class="svc-presenter-preparation-input" ${expanded ? '' : 'hidden'}>
        ${renderPresenterPreparationFieldRows(service, draft)}
        <div class="svc-presenter-preparation-actions">
          <button class="svc-presenter-preparation-apply" type="button" data-presenter-preparation-apply data-service-id="${escapeAttr(service.id)}"
            aria-label="${applying ? "예배 입력 반영 중" : "예배 입력 반영"}" title="${applying ? "반영 중" : hasValues ? "입력 반영" : "반영할 입력이 없습니다"}" ${applying || !hasValues ? "disabled" : ""}>
            <i data-lucide="wand-sparkles"></i>
            <span>${applying ? "반영 중" : "반영"}</span>
          </button>
        </div>
      </section>
    </aside>`;
}

// View-only state: switching layouts never saves or rebuilds the worship document.
let presenterFocusView = false;
function renderPresenterFocusView() {
  return `<div class="svc-presenter-view-switch" role="group" aria-label="예배 보기">
    <button type="button" class="btn secondary" data-presenter-focus-toggle="basic" aria-pressed="${!presenterFocusView}">슬라이드 보기</button>
    <button type="button" class="btn secondary" data-presenter-focus-toggle="focus" aria-pressed="${presenterFocusView}">발표자 보기</button>
  </div>`;
}

function syncPresenterFocusView() {
  const root = document.getElementById('servicePresenterControls');
  if (!root) return;
  const layoutChanged = root.dataset.focusView !== String(presenterFocusView);
  root.dataset.focusView = String(presenterFocusView);
  if (layoutChanged) {
    mountDeferredPresenterBoardSections(root, root.dataset.serviceId, presenterSlidesForService(root.dataset.serviceId));
  }
  root.querySelectorAll('[data-presenter-focus-toggle]').forEach(button => {
    button.setAttribute('aria-pressed', String((button.dataset.presenterFocusToggle === 'focus') === presenterFocusView));
  });
  let panel = root.querySelector('[data-presenter-focus-panel]');
  if (!presenterFocusView) { if (panel) panel.hidden = true; return; }
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'svc-focus-panel';
    panel.dataset.presenterFocusPanel = '';
    panel.setAttribute('aria-label', '발표자 보기');
    root.querySelector('.svc-presenter-workspace').before(panel);
  }
  panel.hidden = false;
  const serviceId = root.dataset.serviceId;
  const slides = presenterSlidesForService(serviceId);
  const active = state.presenter.serviceId === serviceId;
  const outputOpen = active && isPresenterOutputWindowOpen();
  const selected = state.presenterBoardSelection.serviceId === serviceId
    ? state.presenterBoardSelection.indexes?.at(-1) : null;
  const index = clampPresenterIndex(outputOpen ? state.presenter.index : selected ?? (active ? state.presenter.index : 0), slides.length);
  const current = outputOpen
    ? presenterLiveStatusPreviewSlide(slides, index, {active, outputOpen}) : slides[index];
  const nextIndex = presenterNextNavigableIndex(slides, index);
  const next = nextIndex !== index ? slides[nextIndex] : null;
  const label = outputOpen ? (state.presenter.safetyBlank ? '암전' : '현재 송출')
    : isPresenterOutputWindowOpen() ? '선택 화면 · 다른 예배 송출 중' : '선택 화면 · 송출 대기';
  const frame = (slide, title) => `<div class="svc-focus-preview"><strong>${escapeHtml(title)}</strong><div class="svc-slide-thumb-frame">${slide ? renderPresenterSlideMiniPreview(slide, serviceId) : '<span>다음 슬라이드 없음</span>'}</div></div>`;
  const outputControl = document.querySelector('[data-presenter-right-sidebar] .svc-presenter-launch');
  const narrowOutput = outputControl ? `<button type="button" class="btn secondary svc-focus-output" data-presenter-action="${escapeAttr(outputControl.dataset.presenterAction)}" data-service-id="${escapeAttr(serviceId)}" ${outputControl.disabled ? 'disabled' : ''}><i data-lucide="${outputControl.dataset.presenterAction === 'stop' ? 'screen-share-off' : 'screen-share'}"></i><span>${escapeHtml(outputControl.getAttribute('aria-label') || outputControl.textContent.trim())}</span></button>` : '';
  const markup = `<div class="svc-focus-screens">${frame(current, label)}${frame(next, '다음 화면')}</div>
    <div class="svc-focus-transport"><div class="svc-focus-navigation" role="group" aria-label="슬라이드 이동"><span class="svc-focus-count">${slides.length ? index + 1 : 0} <span>/ ${slides.length}</span></span>
      <button type="button" class="btn secondary" data-presenter-action="prev" data-service-id="${escapeAttr(serviceId)}" ${slides.length ? '' : 'disabled'}><i data-lucide="chevron-left"></i><span>이전</span></button>
      <button type="button" class="btn secondary" data-presenter-action="next" data-service-id="${escapeAttr(serviceId)}" ${slides.length ? '' : 'disabled'}><i data-lucide="chevron-right"></i><span>다음</span></button>${narrowOutput}</div>
      <div class="svc-focus-audio" role="group" aria-label="음원 조작"><span data-focus-music-status role="status"></span>
      <button type="button" class="btn secondary" data-focus-music="toggle"><i data-lucide="play"></i><span data-focus-music-label>재생 · P</span></button>
      <button type="button" class="btn secondary" data-focus-music="stop" aria-label="음악 정지"><i data-lucide="square"></i><span>정지</span></button>
      <button type="button" class="btn secondary" data-song-timing-resume><i data-lucide="rotate-ccw"></i><span>자동 넘김 복귀 · R</span></button></div>
    </div><div class="svc-focus-filmstrip-heading">전체 슬라이드</div>`;
  if (panel._markup !== markup) { panel.innerHTML = markup; panel._markup = markup; refreshIcons(panel); }
  syncPresenterFocusMusic();
  schedulePresenterPreviewLayoutUpdate(panel);
}

function syncPresenterFocusMusic() {
  const panel = document.querySelector('[data-presenter-focus-panel]:not([hidden])');
  if (!panel) return;
  const music = state.serviceMusic;
  const own = music.ownerServiceId === state.selectedServiceId;
  const slide = state.presenter.slides[state.presenter.index];
  const sync = own && music.mode === 'presenter-audio' && Boolean(music.timingGroupId);
  const canResume = sync && presenterControllerIsLive(state.selectedServiceId)
    && !state.presenter.safetyBlank && !state.presenter.liveScripture?.active
    && slide?.songTimingEligible && slide.syncTimeline?.groupId === music.timingGroupId;
  const label = !music.sourceKey ? '연결된 음원 없음' : `${music.pending ? '음원 준비 중' : music.playing ? '음원 재생 중' : '음원 정지 / 일시정지'}${sync ? music.autoSyncSuspended ? ' · 자동 넘김 해제' : ' · 자동 넘김' : ''}${music.sourceKey && !own ? ' · 다른 예배 음원' : ''}`;
  panel.querySelector('[data-focus-music-status]').textContent = label;
  panel.querySelectorAll('[data-focus-music]').forEach(button => { button.disabled = !own || !music.sourceKey; });
  const toggle = panel.querySelector('[data-focus-music="toggle"]');
  if (toggle) {
    const text = `${music.pending ? '준비 취소' : music.playing ? '일시정지' : '재생'} · P`;
    const label = toggle.querySelector('[data-focus-music-label]');
    if (label.textContent !== text) label.textContent = text;
    const icon = music.pending ? 'loader-circle' : music.playing ? 'pause' : 'play';
    const currentIcon = toggle.querySelector('[data-lucide]');
    if (currentIcon?.getAttribute('data-lucide') !== icon) {
      const replacement = document.createElement('i');
      replacement.dataset.lucide = icon;
      currentIcon?.replaceWith(replacement);
      refreshIcons(toggle);
    }
    toggle.setAttribute('aria-label', music.pending ? '음악 준비 취소' : music.playing ? '음악 일시정지' : '음악 재생');
    toggle.setAttribute('aria-pressed', String(Boolean(own && music.playing)));
  }
  const resume = panel.querySelector('[data-song-timing-resume]');
  resume.hidden = !(canResume && music.playing && !music.pending && music.autoSyncSuspended);
}

document.addEventListener('click', event => {
  const orderToggle = event.target.closest('[data-presenter-order-toggle]');
  if (orderToggle) {
    const body = orderToggle.closest('.svc-presenter-input-rail')?.querySelector('.svc-presenter-preparation-input');
    if (!body) return;
    presenterOrderInputOpen = orderToggle.getAttribute('aria-expanded') !== 'true';
    orderToggle.setAttribute('aria-expanded', String(presenterOrderInputOpen));
    body.hidden = !presenterOrderInputOpen;
    if (!safeStorageSet('local', PRESENTER_ORDER_INPUT_OPEN_KEY, String(presenterOrderInputOpen))) {
      showToast('펼침 상태를 서버에 보관하지 못했습니다. 연결 후 다시 변경해 주세요.', 'error');
    }
    return;
  }
  const toggle = event.target.closest('[data-presenter-focus-toggle]');
  if (toggle) {
    const nextView = toggle.dataset.presenterFocusToggle === 'focus';
    if (nextView === presenterFocusView) return;
    presenterFocusView = nextView;
    syncPresenterFocusView();
    schedulePresenterPreviewLayoutUpdate(document);
  }
  const music = event.target.closest('[data-focus-music]');
  if (music && !music.disabled) {
    const binding = {serviceMusicSource: state.serviceMusic.sourceKey,
      serviceMusicServiceId: state.serviceMusic.ownerServiceId,
      serviceMusicLabel: state.serviceMusic.sourceLabel,
      serviceMusicRepeatAllowed: String(state.serviceMusic.repeatAllowed !== false)};
    void runServiceMusicAction(music.dataset.focusMusic, binding);
  }
});

function renderPresenterSidebarRemoteCode(serviceId) {
  const code = window.MindexRemote?.codeFor?.(serviceId) || "";
  return `<button type="button" class="service-sidebar-remote-code" data-presenter-remote data-remote-service-id="${escapeAttr(serviceId)}" aria-label="원격 조작 예배 코드${code ? ` ${escapeAttr(code)}` : ""}" ${code ? "" : "hidden"}><i data-lucide="smartphone" aria-hidden="true"></i><span data-remote-button-label>${escapeHtml(code)}</span></button>`;
}

function serviceOutlineMissingState(item = {}, slides = [], service = null) {
  const existing = slides.find((slide) => slide?.missingContent && presenterSlideBelongsToItem(slide, item));
  if (existing) return existing;
  const song = presenterSongForServiceItem(item, serviceItemDisplayText(item), item.label || "", service);
  const content = resolvePresenterServiceItemContentState(item, parseServiceItemMemo(item.memo), song, service);
  return content.required ? { ...content, missingContent: true } : null;
}
