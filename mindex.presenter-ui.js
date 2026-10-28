function focusPresenterPreparationTarget(serviceId, target = {}) {
  if (!serviceId || !target) return;
  requestAnimationFrame(() => {
    const roots = [refs.songList, refs.rightSidebar, refs.detailPane];
    const root = roots.find((candidate) => candidate?.querySelector?.(`[data-presenter-preparation-field][data-service-id="${cssEscape(serviceId)}"]`));
    if (!root) return;
    const inputRoot = root.querySelector(".svc-presenter-input-rail .svc-presenter-preparation-input");
    const selector = target.apply
      ? `[data-presenter-preparation-apply][data-service-id="${cssEscape(serviceId)}"]`
      : `[data-presenter-preparation-field][data-service-id="${cssEscape(serviceId)}"][data-presenter-preparation-field-label="${cssEscape(target.label || "")}"]`;
    const field = inputRoot?.querySelector(selector) || root.querySelector(selector);
    field?.focus?.();
    if (!target.apply && typeof field?.select === "function") field.select();
  });
}

function presenterPreparationDraftForService(serviceId, options = {}) {
  if (options.draft != null) return options.draft?.kind === "fields" ? options.draft : String(options.draft || "").trim();
  const service = state.services.find((candidate) => candidate.id === serviceId);
  const selector = `[data-presenter-preparation-field][data-service-id="${cssEscape(serviceId)}"]`;
  const input = refs.songList?.querySelector(selector)
    || refs.rightSidebar?.querySelector(selector)
    || refs.detailPane?.querySelector(selector)
    || null;
  const draft = input && service
    ? presenterPreparationDraftFromRoot(input.closest(".svc-presenter-preparation-input"), service)
    : state.presenterPreparationDrafts[serviceId];
  return draft?.kind === "fields" ? draft : String(draft || "").trim();
}

// Keep the mounted left editor during same-service list/remote refreshes.
function setPresenterSidebarContent(html, service) {
  const current = refs.songList.querySelector('.service-sidebar--presenter');
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  const next = template.content.firstElementChild;
  if (service?.id && current?.dataset.serviceId === service.id) {
    refreshIcons(next);
    patchPresenterControlTree(current, next);
  } else refs.songList.replaceChildren(template.content);
  refs.songList.querySelectorAll('[data-presenter-preparation-field]').forEach(syncPresenterPreparationControls);
}

function syncPresenterSidebarInputRail(service) {
  const current = refs.songList?.querySelector('.svc-presenter-input-rail');
  if (!service?.id) return;
  const sidebar = refs.songList?.querySelector('.service-sidebar--presenter');
  if (sidebar?.dataset.serviceId !== service.id) return;
  const template = document.createElement('template');
  template.innerHTML = renderPresenterServiceInputRail(service).trim();
  refreshIcons(template.content);
  if (current) patchPresenterControlTree(current, template.content.firstElementChild);
  else sidebar.insertBefore(template.content.firstElementChild, sidebar.querySelector('.service-sidebar-section--current'));
}

function patchPresenterControlTree(current, next) {
  // An active order editor owns its DOM, including an unfinished IME composition.
  // Input events already retain its draft; remote/preview refreshes must not rewrite it.
  if (current.matches?.('.svc-presenter-input-rail')
    && current.dataset.serviceId === next.dataset?.serviceId
    && current.contains(document.activeElement)) {
    if (!Object.prototype.hasOwnProperty.call(state.presenterPreparationDrafts, current.dataset.serviceId)
      && next.querySelector('.svc-presenter-preparation-input')?.hidden) {
      current.querySelector('.svc-presenter-preparation-input').hidden = true;
      current.querySelector('[data-presenter-order-toggle]').setAttribute('aria-expanded', 'false');
      current.querySelector('[data-presenter-order-toggle]').focus({preventScroll:true});
    }
    return;
  }
  if (current.isEqualNode(next)) return;
  if (current.nodeType !== next.nodeType || current.nodeName !== next.nodeName) {
    current.replaceWith(next.cloneNode(true));
    return;
  }
  if (current.nodeType !== Node.ELEMENT_NODE) {
    current.textContent = next.textContent;
    return;
  }
  // Preview geometry belongs to the mounted frame, not the slide markup.
  const preserveCitationDraft = current.matches?.("[data-presenter-citation-reference-input]")
    && next.matches?.("[data-presenter-citation-reference-input]")
    && current.dataset.serviceId === next.dataset.serviceId
    && current.dataset.presenterCitationElementId === next.dataset.presenterCitationElementId;
  const scale = current.style?.getPropertyValue("--presenter-preview-scale");
  if (scale) next.style.setProperty("--presenter-preview-scale", scale);
  if (current.tagName === "DETAILS" && current.open) next.open = true;
  for (const attr of [...current.attributes]) {
    if (!next.hasAttribute(attr.name)) current.removeAttribute(attr.name);
  }
  for (const attr of [...next.attributes]) {
    if (current.getAttribute(attr.name) !== attr.value) current.setAttribute(attr.name, attr.value);
  }
  const editingLiveScripture = current === document.activeElement && current.matches?.("[data-live-scripture-input]");
  if (current instanceof HTMLInputElement && !editingLiveScripture && !preserveCitationDraft && !current._videoSeekOwner && current.value !== next.value) current.value = next.value;
  const previousChildren = [...current.childNodes];
  const nextChildren = [...next.childNodes];
  nextChildren.forEach((child, index) => {
    if (previousChildren[index]) patchPresenterControlTree(previousChildren[index], child);
    else current.appendChild(child.cloneNode(true));
  });
  previousChildren.slice(nextChildren.length).forEach((child) => child.remove());
}

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

function renderPresenterScreenManagement(serviceId, slides = []) {
  const live = isPresenterOutputWindowOpen();
  const own = live && state.presenter.serviceId === serviceId;
  const mode = own && state.presenter.safetyBlank ? state.presenter.safetyBlankMode || 'black' : '';
  const toggle = (value, label, icon) => `<button type="button" class="icon-btn svc-presenter-window-button" data-presenter-action="${value === 'black' ? 'blackout' : 'transparent'}" data-service-id="${escapeAttr(serviceId)}" aria-pressed="${mode === value}" aria-label="${label}${mode === value ? ' 해제' : ''}" ${own && slides.length ? '' : 'disabled'}><i data-lucide="${icon}"></i><span>${label}</span></button>`;
  return `<section class="svc-screen-management" aria-label="송출 화면 관리">
    <h3>송출 화면 관리</h3>
    <div class="svc-screen-management-grid">
      <button type="button" class="icon-btn svc-presenter-launch" data-presenter-action="${live ? 'stop' : 'open'}" data-service-id="${escapeAttr(serviceId)}" aria-label="${live ? '송출 종료' : '송출 시작'}"><i data-lucide="${live ? 'screen-share-off' : 'screen-share'}"></i><span>${live ? '송출 종료' : '송출 시작'}</span></button>
      <button type="button" class="icon-btn svc-presenter-fullscreen svc-presenter-window-button" data-presenter-action="fullscreen" data-service-id="${escapeAttr(serviceId)}" aria-label="송출 화면 전체 화면" ${live ? '' : 'disabled'}><i data-lucide="maximize"></i><span>전체 화면</span></button>
      ${renderPresenterAlwaysOnTopControl({ buttonStyle: true })}
      ${toggle('black', '암전', 'eye-off')}
      ${toggle('transparent', '투명', 'layers')}
    </div>
  </section>`;
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
      </div>
    </div>`;
}

const presenterOrderInputViews = new Map();

function presenterOrderInputView(service) {
  const saved = presenterPreparationStructuredDraft(service);
  const fields = presenterPreparationFieldValues(service, saved);
  const pending = Object.prototype.hasOwnProperty.call(state.presenterPreparationDrafts, service.id);
  const complete = fields.length > 0 && fields.every(field => field.value.trim()) && !pending;
  let view = presenterOrderInputViews.get(service.id);
  if (!view) view = { expanded: !complete, complete };
  else if (complete && !view.complete) view.expanded = false;
  else if (pending && view.complete) view.expanded = true;
  view.complete = complete;
  presenterOrderInputViews.set(service.id, view);
  return view;
}

function renderPresenterServiceInputRail(service) {
  const expanded = presenterOrderInputView(service).expanded;
  const draft = presenterPreparationDisplayTextForService(service);
  const applying = state.presenterPreparationApplyingServiceIds.has(service.id);
  const hasValues = presenterPreparationDraftHasValues(service, draft);
  return `
    <aside class="svc-presenter-input-rail" data-service-id="${escapeAttr(service.id)}" aria-label="예배 입력">
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
  const label = outputOpen ? (state.presenter.safetyBlank ? (state.presenter.safetyBlankMode === 'transparent' ? '투명' : '암전') : '현재 송출')
    : isPresenterOutputWindowOpen() ? '선택 화면 · 다른 예배 송출 중' : '선택 화면 · 송출 대기';
  const frame = (slide, title) => `<div class="svc-focus-preview"><strong>${escapeHtml(title)}</strong><div class="svc-slide-thumb-frame">${slide ? renderPresenterSlideMiniPreview(slide, serviceId) : '<span>다음 슬라이드 없음</span>'}</div></div>`;
  const markup = `<div class="svc-focus-screens">${frame(current, label)}${frame(next, '다음 화면')}</div>${renderPresenterScreenManagement(serviceId, slides)}
    <div class="svc-focus-transport"><div class="svc-focus-navigation" role="group" aria-label="슬라이드 이동"><span class="svc-focus-count">${slides.length ? index + 1 : 0} <span>/ ${slides.length}</span></span>
      <button type="button" class="btn secondary" data-presenter-action="prev" data-service-id="${escapeAttr(serviceId)}" ${slides.length ? '' : 'disabled'}><i data-lucide="chevron-left"></i><span>이전</span></button>
      <button type="button" class="btn secondary" data-presenter-action="next" data-service-id="${escapeAttr(serviceId)}" ${slides.length ? '' : 'disabled'}><i data-lucide="chevron-right"></i><span>다음</span></button></div>
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
    const service = state.services.find(row => row.id === orderToggle.closest('.svc-presenter-input-rail').dataset.serviceId);
    if (!service) return;
    const view = presenterOrderInputView(service);
    view.expanded = orderToggle.getAttribute('aria-expanded') !== 'true';
    orderToggle.setAttribute('aria-expanded', String(view.expanded));
    body.hidden = !view.expanded;
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


function serviceItemsAreHydrating(serviceId = "") {
  const id = String(serviceId || "").trim();
  if (!id || state.loadedWorshipServiceIds.has(id)) return false;
  return state.loading || serviceItemLoadPromises.has(id) || isServiceDataModule();
}

// Each visible input owns one value; labels and separators are never storage.
function presenterPreparationStructuredFields(service) {
  const items = servicePrepEditorItems(service.id);
  return presenterPreparationFieldsForService(service).flatMap(definition => {
    const number = Number(compactSearchValue(definition.label).match(/^공동기도(\d+)$/)?.[1]);
    const group = number && items.find(item => isMonthlyCorporatePrayerGroupItem(item) && monthlyCorporatePrayerOrdinalsForItem(item).includes(number));
    const item = group || findPresenterPreparationProjectedItem(service, definition.label);
    const context = item && presenterServiceInputItem(item, service);
    if (!context) return [{ ...definition, value: '', role: 'content', targetLabel: definition.label }];
    const { mode, model, memo } = context;
    const prayerIndex = group ? monthlyCorporatePrayerOrdinalsForItem(group).indexOf(number) : undefined;
    const prayer = group ? monthlyCorporatePrayerEntries(item, memo)[prayerIndex] : null;
    const songMode = isSongServiceLabel(item.label) || isSpecialSongServiceItem(item);
    const scripture = mode === 'scripture' || isScriptureBodyServiceItem(item);
    const spec = prayer ? { needsTitle: true, needsAssignee: true }
      : songMode ? { needsTitle: true, needsAssignee: isSpecialSongServiceItem(item) }
      : scripture ? { needsTitle: true, needsAssignee: false } : presenterServiceTextInputSpec(item, model, memo);
    const current = presenterServiceRequiredTextInputState(item, model, memo, service);
    const title = prayer ? prayer.title : songMode ? serviceItemLinkedSong(item)?.title || item.raw_title || ''
      : scripture ? formatServiceScriptureReferenceList(serviceItemScriptureReferences(item, memo, service)) : current.titleText;
    const assignee = prayer ? prayer.assignee : current.assignee;
    const base = { targetLabel: definition.label, itemId: item.id, prayerIndex, multiline: isAnnouncementTextInputItem(item) };
    const paired = spec.needsTitle && spec.needsAssignee;
    const fields = [];
    if (spec.needsTitle) fields.push({ ...base, role: 'content', label: paired ? `${definition.label} 제목` : definition.label,
      example: paired ? '제목' : definition.example, value: String(title || '') });
    if (spec.needsAssignee) fields.push({ ...base, role: 'assignee', label: paired ? `${definition.label}${compactSearchValue(item.label) === '설교' ? '자' : ' 담당자'}` : definition.label,
      example: paired ? '담당자' : definition.example, value: String(assignee || '') });
    return fields;
  });
}
function presenterPreparationStructuredDraft(service) {
  return { kind: 'fields', fields: presenterPreparationStructuredFields(service) };
}
function presenterPreparationStructuredEntries(service, draft) {
  const groups = new Map();
  const definitions = presenterPreparationStructuredFields(service);
  for (const field of draft.fields) {
    const definition = definitions.find(row => row.label === field.label);
    if (!definition) continue;
    const key = `${definition.itemId || definition.targetLabel}:${definition.prayerIndex ?? ''}`;
    if (!groups.has(key)) groups.set(key, { line: groups.size + 1, label: definition.targetLabel, rawLabel: definition.targetLabel,
      key: compactSearchValue(definition.targetLabel), rawKey: compactSearchValue(definition.targetLabel),
      itemId: definition.itemId, structured: true, content: '', assignee: '' });
    const entry = groups.get(key);
    entry.changed ||= String(field.value || '') !== definition.value;
    entry[definition.role + 'Changed'] ||= String(field.value || '') !== definition.value;
    entry[definition.role] = String(field.value || '').trim();
    entry[definition.role === 'content' ? 'hasContent' : 'hasAssignee'] = true;
  }
  return [...groups.values()].filter(entry => entry.changed).map(entry => ({ ...entry,
    content: normalizePresenterPreparationEntryContent(entry.label, entry.content) }));
}

function renderPresenterPreparationField(service, field) {
  const attributes = `class="svc-presenter-preparation-field-value" data-presenter-preparation-field data-service-id="${escapeAttr(service.id)}" data-presenter-preparation-field-label="${escapeAttr(field.label)}" ${field.role ? `data-preparation-role="${field.role}"` : ''} placeholder="${escapeAttr(field.example)}" aria-label="${escapeAttr(`${field.label} 값`)}"`;
  const control = /[\r\n]/.test(field.value) || field.multiline
    ? `<textarea ${attributes} rows="3">${escapeHtml(field.value)}</textarea>`
    : `<input ${attributes} type="text" value="${escapeAttr(field.value)}" />`;
  return `<label class="svc-presenter-preparation-field-row"><span class="svc-presenter-preparation-field-label">${escapeHtml(field.label)}</span>${control}</label>`;
}
