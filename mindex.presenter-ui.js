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
  return forms.flatMap((form, formIndex) => {
    if (form._presenterBlank) {
      return [{
        id: `${item.id || index}:blank:${form._presenterToken || formIndex}:${formIndex}`,
        ...section,
        elementType: PRESENTER_ELEMENT_TYPES.BLANK,
        layout: PRESENTER_SLIDE_LAYOUTS.BLANK,
        type: "blank",
        label,
        title: form.label || "빈 화면",
        marker: "",
        formKey: `blank:${form._presenterToken || formIndex}:${formIndex}`,
        segment: "",
        text: "",
        warnings: formWarnings,
        sort: index + formIndex / 100,
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
      sort: index + formIndex / 100 + chunkIndex / 10000,
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

function renderPresenterAlwaysOnTopControl() {
  const supported = Boolean(window.mindexElectron?.setPresenterAlwaysOnTop);
  return `
    <label class="svc-presenter-pin-toggle${supported ? "" : " is-unavailable"}" title="${supported ? "출력 창을 항상 위에 표시" : "웹 버전에서는 항상 위 표시를 지원하지 않습니다"}">
      <input type="checkbox" data-presenter-always-on-top ${supported && state.presenter.alwaysOnTop ? "checked" : ""} ${supported ? "" : "disabled"} />
      <span class="svc-presenter-pin-track" aria-hidden="true"></span>
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
    <details class="svc-presenter-help" data-presenter-help>
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

function renderPresenterServiceInputRail(service) {
  const draft = presenterPreparationDisplayTextForService(service);
  const applying = state.presenterPreparationApplyingServiceIds.has(service.id);
  const hasValues = presenterPreparationDraftHasValues(service, draft);
  return `
    <aside class="svc-presenter-input-rail" aria-label="예배 입력">
      <header class="svc-presenter-input-rail-head">
        <span>예배 순서 입력</span>
      </header>
      <section class="svc-presenter-preparation-input">
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
  return `<button type="button" class="btn secondary" data-presenter-focus-toggle aria-pressed="${presenterFocusView}">${presenterFocusView ? '기본 보기' : '집중 보기'}</button>`;
}

function syncPresenterFocusView() {
  const root = document.getElementById('servicePresenterControls');
  if (!root) return;
  root.dataset.focusView = String(presenterFocusView);
  const toggle = root.querySelector('[data-presenter-focus-toggle]');
  if (toggle) {
    toggle.textContent = presenterFocusView ? '기본 보기' : '집중 보기';
    toggle.setAttribute('aria-pressed', String(presenterFocusView));
  }
  let panel = root.querySelector('[data-presenter-focus-panel]');
  if (!presenterFocusView) { if (panel) panel.hidden = true; return; }
  if (!panel) {
    panel = document.createElement('section');
    panel.className = 'svc-focus-panel';
    panel.dataset.presenterFocusPanel = '';
    panel.setAttribute('aria-label', '발표자 집중 보기');
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
  const markup = `<div class="svc-focus-screens">${frame(current, label)}${frame(next, '다음 화면')}</div>
    <div class="svc-focus-transport"><span>${slides.length ? index + 1 : 0} / ${slides.length}</span>
      <button type="button" class="btn secondary" data-presenter-action="prev" data-service-id="${escapeAttr(serviceId)}" ${slides.length ? '' : 'disabled'}>이전</button>
      <button type="button" class="btn secondary" data-presenter-action="next" data-service-id="${escapeAttr(serviceId)}" ${slides.length ? '' : 'disabled'}>다음</button>
      <span data-focus-music-status role="status"></span>
      <button type="button" class="btn secondary" data-focus-music="toggle">재생 / 일시정지 · P</button>
      <button type="button" class="btn secondary" data-focus-music="stop">음악 정지</button>
      <button type="button" class="btn secondary" data-song-timing-resume>자동 넘김 복귀 · R</button>
    </div>`;
  if (panel._markup !== markup) { panel.innerHTML = markup; panel._markup = markup; }
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
  const label = `${music.pending ? '음원 준비 중' : music.playing ? '음원 재생 중' : '음원 정지 / 일시정지'}${sync ? music.autoSyncSuspended ? ' · 자동 넘김 해제' : ' · 자동 넘김' : ''}${music.sourceKey && !own ? ' · 다른 예배 음원' : ''}`;
  panel.querySelector('[data-focus-music-status]').textContent = label;
  panel.querySelectorAll('[data-focus-music]').forEach(button => { button.disabled = !own || !music.sourceKey; });
  const resume = panel.querySelector('[data-song-timing-resume]');
  resume.hidden = !(canResume && music.playing && !music.pending && music.autoSyncSuspended);
}

document.addEventListener('click', event => {
  const toggle = event.target.closest('[data-presenter-focus-toggle]');
  if (toggle) {
    presenterFocusView = !presenterFocusView;
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
