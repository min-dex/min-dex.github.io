function runPresenterAction(action, serviceId = state.selectedServiceId, options = {}) {
  const p = state.presenter;
  if (action === "return") { restorePresenterPreviousOutput(serviceId); return; }
  if (action === "fullscreen") { requestPresenterOutputFullscreenFromController(); return; }
  if (["pptx-play", "pptx-pause"].includes(action)) {
    if (serviceId === p.serviceId && requestPresenterPptxMedia(p, action === "pptx-play" ? "play" : "pause")) {
      publishPresenterState(); renderPresenterControlState(serviceId);
    }
    return;
  }
  if (action === "retry-video") {
    requestPresenterVideoRetry(serviceId);
    return;
  }
  if (!["open", "stop", "next", "prev", "first", "last", "jump", "prepare-next-service"].includes(action)) return;
  if (action === "stop") {
    stopPresenterOutput(serviceId || p.serviceId);
    return;
  }
  if (!serviceId) return;
  if (action === "prepare-next-service") {
    void prepareNextServiceFromPresenter(serviceId, options);
    return;
  }
  if (action !== "open" && isPresenterOutputWindowOpen() && p.serviceId && p.serviceId !== serviceId) return;

  if (action === "open") {
    if (p.outputWindow?.closed) stopPresenterOutput(p.serviceId);
    preparePresenterService(serviceId);
    p.pptxProgress = null;
    const launchIndex = presenterSelectedLaunchIndex(serviceId);
    if (launchIndex !== null && isValidPresenterIndex(launchIndex, p.slides.length)) p.index = launchIndex;
    clearPresenterBoardSelection({ render: false });
    p.safetyBlank = false;
    openPresenterOutput(serviceId);
    return;
  }

  // A board selection is for offline editing. Once the controller is live, the
  // active output slide is the only meaningful focus state.
  if (presenterControllerIsLive(serviceId)) clearPresenterBoardSelection({ render: false });
  preparePresenterNavigation(serviceId);

  p.jumpDraft = "";
  if (["next", "prev", "first", "last", "jump"].includes(action)) {
    const requestedIndex = Number(options.index);
    const appliesJump = action !== "jump"
      || requestedIndex === -1
      || isValidPresenterIndex(requestedIndex, p.slides.length);
    if (!appliesJump) {
      renderPresenterControlState(serviceId);
      return;
    }
    suspendServiceMusicAutoSync();
    if (["first", "last", "jump"].includes(action)) p.pptxProgress = null;
    liveScriptureRequestSerial += 1;
    p.liveScripture = {
      ...p.liveScripture,
      active: false,
      slide: null,
    };
    p.livePraise = emptyLivePraiseState(p.livePraise?.draft || p.livePraise?.query || "");
  }

  if (action === "next") {
    p.safetyBlank = false;
    movePresenterSlide(1);
  } else if (action === "prev") {
    p.safetyBlank = false;
    movePresenterSlide(-1);
  } else if (action === "first") {
    p.safetyBlank = false;
    p.index = firstPresenterNavigableIndex(p.slides);
  } else if (action === "last") {
    p.safetyBlank = false;
    p.index = lastPresenterNavigableIndex(p.slides);
  } else if (action === "jump") {
    const requestedIndex = Number(options.index);
    if (requestedIndex === -1) {
      p.safetyBlank = true;
    } else if (isValidPresenterIndex(requestedIndex, p.slides.length)) {
      p.index = requestedIndex;
      p.safetyBlank = false;
    }
  }

  syncSelectedServiceItemToPresenterSlide(serviceId);
  syncServiceMusicWithPresenterContext(serviceId, { render: false });
  publishPresenterState();
  renderPresenterControlState(serviceId);
  scrollPresenterOutlineToActive(serviceId);
  if (options.scroll !== false && ["next", "prev", "first", "last", "jump"].includes(action)) {
    scrollPresenterBoardToIndexStable(serviceId, p.index, { force: false });
  }
  if (options.focusActiveSlide === true) focusPresenterBoardLiveSlide(serviceId, p.index);
}

let prepareNextServiceRequestSerial = 0;

async function prepareNextServiceFromPresenter(serviceId = state.selectedServiceId, options = {}) {
  const current = state.services.find((service) => service.id === serviceId);
  if (!current) return;
  const nextServiceId = typeof options === "string" ? options : options.nextServiceId;
  const next = state.services.find((service) => service.id === nextServiceId) || nextPreparationService(current);
  if (!next) return;
  const requestSerial = ++prepareNextServiceRequestSerial;
  const outputService = state.presenter.serviceId, outputSession = state.presenter.outputSessionId;
  if (hasDirtyChanges({ reconcile: true }) && !await confirmSaveBeforeLeaving()) return;
  const shouldSwitchPresenter = outputService === serviceId;
  try {
    const currentRequest = () => requestSerial === prepareNextServiceRequestSerial && state.selectedServiceId === serviceId
      && outputService === state.presenter.serviceId && outputSession === state.presenter.outputSessionId;
    if (!await MindexPresenterFreshness.prepareNext(next.id, shouldSwitchPresenter, currentRequest)) return;
  } catch (error) {
    showToast(error.message || "다음 예배 내용을 불러오지 못했습니다.", "error");
    return;
  }
  state.selectedServiceId = next.id;
  state.selectedServiceTypeId = next.type_id;
  state.selectedServiceItemIndex = null;
  state.presenter.viewServiceId = next.id;
  state.presenter.jumpDraft = "";
  if (shouldSwitchPresenter) {
    state.presenter.index = 0;
    state.presenter.safetyBlank = false;
    state.presenter.liveScripture = {
      ...state.presenter.liveScripture,
      active: false,
      slide: null,
    };
    state.presenter.livePraise = emptyLivePraiseState(state.presenter.livePraise?.draft || state.presenter.livePraise?.query || "");
    publishPresenterState();
  }
  renderServiceList();
  renderPresenterDetail();
  renderPresenterControlState(next.id);
  scrollPresenterBoardToTop(next.id);
  scrollPresenterOutlineToActive(next.id);
  syncBrowserHistory();
}

function scrollPresenterBoardToTop(serviceId = state.selectedServiceId) {
  if (!serviceId) return;
  const run = () => {
    const root = document.getElementById("servicePresenterControls");
    if (!root?.isConnected) return;
    const firstThumb = root.querySelector(`.svc-slide-thumb[data-service-id="${CSS.escape(serviceId)}"][data-presenter-index="0"]`);
    const target = firstThumb?.closest(".svc-board-section") || root;
    scrollWithinPresenterViewport(target, { block: "start", behavior: "auto" });
  };
  window.requestAnimationFrame(run);
}

function presenterBoardThumbSelector(serviceId, index) {
  if (!serviceId || !Number.isFinite(Number(index))) return "";
  return `.svc-slide-thumb[data-service-id="${CSS.escape(String(serviceId))}"][data-presenter-index="${CSS.escape(String(Number(index)))}"]`;
}

function findPresenterBoardThumbByIndex(root, serviceId, index) {
  if (!root?.querySelector || !serviceId || !Number.isFinite(Number(index))) return null;
  return root.querySelector(presenterBoardThumbSelector(serviceId, index));
}

function scrollPresenterBoardToIndex(serviceId, index, options = {}) {
  const targetIndex = Number(index);
  if (!serviceId || !Number.isFinite(targetIndex) || targetIndex < 0) return;
  const run = () => {
    const root = document.getElementById("servicePresenterControls");
    if (!root?.isConnected) return false;
    const focusBoard = root.dataset.focusView === "true" ? root.querySelector(".svc-slide-board") : null;
    const viewport = focusBoard || (refs.detailPane?.isConnected ? refs.detailPane : root);
    const scrollTopBeforeHydration = viewport.scrollTop;
    let thumb = findPresenterBoardThumbByIndex(root, serviceId, targetIndex);
    if (!thumb) {
      const overflowAnchor = viewport.style.overflowAnchor;
      viewport.style.overflowAnchor = "none";
      if (!hydrateDeferredPresenterBoardSectionForSlide(root, serviceId, targetIndex)) {
        viewport.style.overflowAnchor = overflowAnchor;
        return false;
      }
      viewport.scrollTop = scrollTopBeforeHydration;
      window.requestAnimationFrame(() => {
        viewport.scrollTop = scrollTopBeforeHydration;
        run();
        window.requestAnimationFrame(() => {
          viewport.style.overflowAnchor = overflowAnchor;
        });
      });
      return true;
    }
    const scrollTarget = !focusBoard && options.target === "subgroup"
      ? thumb.closest(".svc-board-subgroup") || thumb.closest(".svc-slide-thumb-wrap") || thumb
      : thumb.closest(".svc-slide-thumb-wrap") || thumb;
    const viewportRect = viewport.getBoundingClientRect();
    const thumbRect = scrollTarget.getBoundingClientRect();
    const fullyVisible = thumbRect.top >= viewportRect.top
      && thumbRect.bottom <= viewportRect.bottom
      && thumbRect.left >= viewportRect.left
      && thumbRect.right <= viewportRect.right;
    if (fullyVisible && !options.force) return true;
    if (focusBoard) {
      focusBoard.scrollLeft += thumbRect.left - viewportRect.left - (viewportRect.width - thumbRect.width) / 2;
      return true;
    }
    scrollWithinPresenterViewport(scrollTarget, {
      block: options.block || "center",
      behavior: options.behavior || "auto",
    });
    return true;
  };
  if (run()) return;
  window.requestAnimationFrame(() => {
    if (run()) return;
    window.setTimeout(run, 0);
  });
}

function findPresenterBoardSubgroupByItemIndex(root, serviceId, itemIndex) {
  const targetIndex = Number(itemIndex);
  if (!root?.querySelector || !serviceId || !Number.isInteger(targetIndex) || targetIndex < 0) return null;
  const selector = `.svc-board-subgroup[data-service-item-index="${CSS.escape(String(targetIndex))}"]`;
  return root.querySelector(selector);
}

function scrollPresenterBoardToServiceItem(serviceId, itemIndex, options = {}) {
  const targetIndex = Number(itemIndex);
  if (!serviceId || !Number.isInteger(targetIndex) || targetIndex < 0) return false;
  if (!serviceOutlineItemForIndex(serviceId, targetIndex)) return false;
  const run = () => {
    const root = document.getElementById("servicePresenterControls");
    if (!root?.isConnected) return false;
    const viewport = refs.detailPane?.isConnected ? refs.detailPane : root;
    const scrollTopBeforeHydration = viewport.scrollTop;
    let subgroup = findPresenterBoardSubgroupByItemIndex(root, serviceId, targetIndex);
    if (!subgroup) {
      const overflowAnchor = viewport.style.overflowAnchor;
      viewport.style.overflowAnchor = "none";
      if (!hydrateDeferredPresenterBoardSectionForServiceItem(root, serviceId, targetIndex)) {
        viewport.style.overflowAnchor = overflowAnchor;
        return false;
      }
      viewport.scrollTop = scrollTopBeforeHydration;
      window.requestAnimationFrame(() => {
        viewport.scrollTop = scrollTopBeforeHydration;
        run();
        window.requestAnimationFrame(() => {
          viewport.style.overflowAnchor = overflowAnchor;
        });
      });
      return true;
    }
    const viewportRect = viewport.getBoundingClientRect();
    const subgroupRect = subgroup.getBoundingClientRect();
    const fullyVisible = subgroupRect.top >= viewportRect.top
      && subgroupRect.bottom <= viewportRect.bottom
      && subgroupRect.left >= viewportRect.left
      && subgroupRect.right <= viewportRect.right;
    if (fullyVisible && !options.force) return true;
    scrollWithinPresenterViewport(subgroup, {
      block: options.block || "start",
      behavior: options.behavior || "auto",
    });
    return true;
  };
  if (run()) return true;
  window.requestAnimationFrame(() => {
    if (run()) return;
    window.setTimeout(run, 0);
  });
  return true;
}

let presenterBoardStableScrollRaf = 0;
let presenterBoardStableScrollTimeout = 0;

function clearPresenterBoardStableScrollRequest() {
  if (presenterBoardStableScrollRaf) {
    window.cancelAnimationFrame(presenterBoardStableScrollRaf);
    presenterBoardStableScrollRaf = 0;
  }
  if (presenterBoardStableScrollTimeout) {
    window.clearTimeout(presenterBoardStableScrollTimeout);
    presenterBoardStableScrollTimeout = 0;
  }
}

function scrollPresenterBoardToIndexStable(serviceId, index, options = {}) {
  clearPresenterBoardStableScrollRequest();
  const scrollOptions = { ...options, behavior: options.behavior || "auto" };
  scrollPresenterBoardToIndex(serviceId, index, scrollOptions);
  presenterBoardStableScrollRaf = window.requestAnimationFrame(() => {
    presenterBoardStableScrollRaf = 0;
    scrollPresenterBoardToIndex(serviceId, index, scrollOptions);
    presenterBoardStableScrollTimeout = window.setTimeout(() => {
      presenterBoardStableScrollTimeout = 0;
      scrollPresenterBoardToIndex(serviceId, index, scrollOptions);
    }, 60);
  });
}

function scrollWithinPresenterViewport(target, options = {}) {
  if (!target?.getBoundingClientRect) return false;
  const viewport = refs.detailPane?.isConnected ? refs.detailPane : target.closest(".detail-pane");
  if (!viewport?.getBoundingClientRect || typeof viewport.scrollTo !== "function") {
    target.scrollIntoView({
      block: options.block || "nearest",
      inline: "nearest",
      behavior: options.behavior || "auto",
    });
    return true;
  }
  const block = options.block || "nearest";
  const behavior = options.behavior || "auto";
  const targetRect = target.getBoundingClientRect();
  const viewportRect = viewport.getBoundingClientRect();
  const currentTop = viewport.scrollTop;
  const targetTop = targetRect.top - viewportRect.top + currentTop;
  const targetBottom = targetRect.bottom - viewportRect.top + currentTop;
  const padding = Number(options.padding) || 18;
  const stickyTop = presenterViewportStickyTopOffset(viewport);
  let top = currentTop;
  if (block === "start") {
    top = targetTop - padding - stickyTop;
  } else if (block === "center") {
    top = targetTop - Math.max(0, (viewport.clientHeight - targetRect.height) / 2);
  } else if (targetRect.top < viewportRect.top + stickyTop + padding) {
    top = targetTop - padding - stickyTop;
  } else if (targetRect.bottom > viewportRect.bottom - padding) {
    top = targetBottom - viewport.clientHeight + padding;
  } else {
    return true;
  }
  const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  const nextTop = Math.max(0, Math.min(maxTop, top));
  if (Math.abs(nextTop - currentTop) < 2) return true;
  viewport.scrollTo({ top: nextTop, behavior });
  return true;
}

function presenterViewportStickyTopOffset(viewport) {
  const sticky = viewport?.querySelector?.(".svc-presenter-top");
  if (!sticky?.getBoundingClientRect) return 0;
  const viewportRect = viewport.getBoundingClientRect();
  const stickyRect = sticky.getBoundingClientRect();
  if (stickyRect.bottom <= viewportRect.top || stickyRect.top > viewportRect.top + viewport.clientHeight) return 0;
  return Math.max(0, Math.min(viewport.clientHeight, stickyRect.bottom - viewportRect.top));
}

function scrollPresenterOutlineToActive(serviceId = state.presenter.serviceId) {
  if (state.module !== "presenter" || state.selectedServiceId !== serviceId) return;
  window.requestAnimationFrame(() => {
    const outline = refs.songList?.querySelector(".service-outline-list");
    if (!outline?.isConnected) return;
    const activeRow = outline.querySelector(".service-outline-row--child.active")
      || outline.querySelector(".service-outline-row--ready.active")
      || outline.querySelector(".service-outline-row--section.active");
    activeRow?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
  });
}

function stopPresenterOutput(serviceId = state.presenter.serviceId) {
  liveScriptureRequestSerial += 1;
  presenterLaunchRequestSerial += 1;
  state.presenter.outputGeneration += 1;
  const activeServiceId = serviceId || state.presenter.serviceId;
  const outputWindow = state.presenter.outputWindow;
  // A disconnected/closed transport must not abort local stop and media cleanup.
  try {
    state.presenter.channel?.postMessage({ type: "presenter-output-close", outputSessionId: state.presenter.outputSessionId || "" });
  } catch {}
  const closeDesktopOutput = window.mindexElectron?.closePresenterOutput;
  if (closeDesktopOutput) closeDesktopOutput().catch?.(() => {});
  state.presenter.jumpDraft = "";
  state.presenter.restorePayload = null;
  // Explicit stop ends this run. A later launch may use only a new selection.
  state.presenter.index = Math.max(0, state.presenter.slides.findIndex(isPresenterPreparationSlide));
  state.presenter.pptxProgress = null;
  clearPresenterBoardSelection({ render: false });
  state.presenter.exitArmedAt = 0;
  state.presenter.safetyBlank = false;
  state.presenter.liveScripture = {
    ...state.presenter.liveScripture,
    active: false,
    slide: null,
  };
  state.presenter.livePraise = emptyLivePraiseState(state.presenter.livePraise?.draft || state.presenter.livePraise?.query || "");
  if (!state.serviceMusic.playing || (state.serviceMusic.mode === "presenter-audio"
    && globalThis.MindexSongTiming?.ownsSource(state.serviceMusic.sourceKey))) {
    stopServiceMusicPlayback({ clearSource: true, mode: "manual", render: false });
  }
  state.presenter.outputWindow = null;
  state.presenter.outputConnectedAt = 0;
  state.presenter.outputPendingAt = 0;
  state.presenter.outputBlockedAt = 0;
  state.presenter.outputAttemptServiceId = "";
  state.presenter.outputStopAt = Date.now();
  state.presenter.outputStoppingClientId = state.presenter.outputClientId;
  state.presenter.outputClientId = "";
  state.presenter.outputWarmup = null;
  clearPresenterOutputVideoWarmup?.();
  stopPresenterOutputWindowMonitor();
  if (!closeDesktopOutput) {
    try {
      closePresenterBrowserWindow(outputWindow);
    } catch {
      // Closing may be blocked for manually opened output tabs.
    }
  }
  publishPresenterPayload(presenterStoppedPayload());
  refreshPresenterOutputConnectionState();
  if (activeServiceId) renderPresenterControlState(activeServiceId);
}

function presenterStoppedPayload() {
  return {
    serviceId: null,
    serviceType: "",
    serviceTitle: "",
    // A stopped presenter has no keyed content. Keeping this false prevents a
    // green frame from being painted while the output window is closing.
    chromakey: false,
    outputTheme: presenterOutputTheme(""),
    backgroundImage: "",
    backgroundImages: [],
    slides: [],
    index: 0,
    safetyBlank: false,
    liveScripture: null,
    livePraise: null,
    updatedAt: Date.now(),
  };
}

function isValidPresenterIndex(index, count) {
  return Number.isInteger(Number(index)) && Number(index) >= 0 && Number(index) < count;
}

function jumpPresenterToSlideInput(input) {
  const serviceId = input?.dataset?.serviceId || state.selectedServiceId;
  const requested = Number(input?.value);
  if (!serviceId || !Number.isFinite(requested)) return;
  state.presenter.jumpDraft = "";
  const index = requested - 1;
  runPresenterAction("jump", serviceId, { index });
  const count = state.presenter.serviceId === serviceId
    ? state.presenter.slides.length
    : buildServicePresenterSlides(serviceId).length;
  if (isValidPresenterIndex(index, count)) {
    scrollPresenterBoardToIndex(serviceId, index, { force: true });
  } else {
    // An out-of-range number leaves the output untouched; show the current slide again.
    clearPresenterJumpDraft(serviceId);
  }
}

function setPresenterPendingSlide(serviceId, index, options = {}) {
  const targetIndex = Number(index);
  if (!serviceId || !Number.isFinite(targetIndex)) return false;
  preparePresenterService(serviceId);
  if (!isValidPresenterIndex(targetIndex, state.presenter.slides.length)) return false;
  state.presenter.index = targetIndex;
  state.presenter.safetyBlank = false;
  state.presenter.jumpDraft = "";
  state.presenter.liveScripture = {
    ...state.presenter.liveScripture,
    active: false,
    slide: null,
  };
  state.presenter.livePraise = emptyLivePraiseState(state.presenter.livePraise?.draft || state.presenter.livePraise?.query || "");
  selectPresenterBoardSlide(serviceId, targetIndex, {
    additive: options.additive,
    range: options.range,
    elementKey: options.elementKey,
    render: false,
  });
  syncSelectedServiceItemToPresenterSlide(serviceId, targetIndex);
  syncServiceMusicWithPresenterContext(serviceId, { render: false });
  if (options.render !== false) {
    renderPresenterControlState(serviceId);
    syncPresenterBoardSelectionClasses();
  }
  scrollPresenterOutlineToActive(serviceId);
  return true;
}

async function openPresenterOutput(serviceId = state.selectedServiceId) {
  if (!serviceId) return;
  if (serviceNavigationBlocked(serviceId)) return;
  if (!globalThis.MindexPresenterFreshness) { showToast("송출 준비 기능을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.", "info"); return; }
  if (!await globalThis.MindexPresenterFreshness.beforeOpen(serviceId)) return;
  preparePresenterService(serviceId);
  if (!isPresenterOutputWindowOpen()) {
    state.presenter.outputSessionId = crypto.randomUUID();
    state.presenter.outputClientId = "";
  }
  const outputGeneration = beginPresenterOutputGeneration(serviceId);
  publishPresenterState({ force: true });
  state.presenter.outputStopAt = 0;
  state.presenter.outputStoppingClientId = "";
  state.presenter.outputPendingAt = Date.now();
  state.presenter.outputBlockedAt = 0;
  state.presenter.outputAttemptServiceId = serviceId;
  renderPresenterControlState(serviceId);

  const existingWindow = presenterOutputWindowRef();
  if (existingWindow) {
    publishPresenterState();
    startPresenterOutputWindowMonitor(serviceId);
    existingWindow.focus?.();
    schedulePresenterOutputPublish(serviceId, outputGeneration);
    renderPresenterControlState(serviceId);
    hydratePresenterOutputInBackground(serviceId, null, outputGeneration);
    return;
  }
  if (isPresenterOutputHeartbeatOpen()) {
    publishPresenterState();
    startPresenterOutputWindowMonitor(serviceId);
    schedulePresenterOutputPublish(serviceId, outputGeneration);
    renderPresenterControlState(serviceId);
    hydratePresenterOutputInBackground(serviceId, null, outputGeneration);
    return;
  }

  // Display detection is an explicit, permission-gated action. Reuse only a
  // previously detected target here so opening the output is never delayed or
  // blocked by the Screen Details API.
  const targetRect = resolvePresenterTargetScreenRect();

  const url = presenterOutputUrl();
  if (window.mindexElectron?.openPresenterOutput) {
    try {
      await window.mindexElectron.openPresenterOutput({ url, targetRect, alwaysOnTop: state.presenter.alwaysOnTop });
      if (!isCurrentPresenterOutputGeneration(serviceId, outputGeneration)) return;
      preparePresenterService(serviceId);
      publishPresenterState();
      startPresenterOutputWindowMonitor(serviceId);
      schedulePresenterOutputPublish(serviceId, outputGeneration);
      renderPresenterControlState(serviceId);
      hydratePresenterOutputInBackground(serviceId, null, outputGeneration);
      return;
    } catch (error) {
      console.warn("Electron presenter window failed; falling back to browser popup.", error);
    }
  }

  const features = presenterOutputWindowFeatures(targetRect);
  const browserUrl = new URL(url);
  browserUrl.searchParams.set("fullscreen", "start");
  const outputWindow = window.open(browserUrl.toString(), "mindexPresenterOutput", features);
  if (!outputWindow) {
    state.presenter.outputPendingAt = 0;
    state.presenter.outputBlockedAt = Date.now();
    state.presenter.outputAttemptServiceId = serviceId;
    showToast("출력 창을 열지 못했습니다. 브라우저의 이 사이트 팝업 허용 설정을 확인해 주세요.", "error");
    renderPresenterControlState(serviceId);
    return;
  }

  state.presenter.outputWindow = outputWindow;
  startPresenterOutputWindowMonitor(serviceId);
  outputWindow.focus();
  outputWindow.addEventListener?.("load", () => {
    if (!isCurrentPresenterOutputGeneration(serviceId, outputGeneration)) return;
    publishPresenterState();
  }, { once: true });
  publishPresenterState();
  schedulePresenterOutputPublish(serviceId, outputGeneration);
  renderPresenterControlState(serviceId);
  hydratePresenterOutputInBackground(serviceId, outputWindow, outputGeneration);
}

function beginPresenterOutputGeneration(serviceId) {
  state.presenter.outputGeneration += 1;
  state.presenter.outputAttemptServiceId = serviceId;
  return state.presenter.outputGeneration;
}

function isCurrentPresenterOutputGeneration(serviceId, generation) {
  return state.presenter.outputGeneration === generation
    && state.presenter.serviceId === serviceId
    && !state.presenter.outputStopAt;
}

function schedulePresenterOutputPublish(serviceId, generation, delay = 250) {
  window.setTimeout(() => {
    if (!isCurrentPresenterOutputGeneration(serviceId, generation)) return;
    publishPresenterState();
  }, delay);
}

function hydratePresenterOutputInBackground(serviceId, outputWindow = null, generation = state.presenter.outputGeneration) {
  void hydratePresenterServiceData(serviceId).then(() => {
    if (!isCurrentPresenterOutputGeneration(serviceId, generation)) return;
    preparePresenterService(serviceId);
    publishPresenterState();
    renderPresenterControlState(serviceId);
  }).catch((error) => {
    console.warn("Could not hydrate presenter output data.", error);
    if (!isCurrentPresenterOutputGeneration(serviceId, generation)) return;
    if (!outputWindow) return;
    stopPresenterOutputWindowMonitor();
    state.presenter.outputWindow = null;
    state.presenter.outputPendingAt = 0;
    try {
      closePresenterBrowserWindow(outputWindow);
    } catch {}
  });
}

function presenterOutputWindowRef() {
  try {
    return state.presenter.outputWindow && !state.presenter.outputWindow.closed
      ? state.presenter.outputWindow
      : null;
  } catch {
    return null;
  }
}

function presenterOutputWindowFeatures(targetRect = null) {
  const features = [
    "popup=yes",
    "menubar=no",
    "toolbar=no",
    "location=no",
    "status=no",
    "scrollbars=no",
    "resizable=yes",
  ];
  if (targetRect) {
    features.push(
      `left=${Math.round(targetRect.left)}`,
      `top=${Math.round(targetRect.top)}`,
      `width=${Math.round(targetRect.width)}`,
      `height=${Math.round(targetRect.height)}`,
    );
  } else {
    features.push("width=1920", "height=1080");
  }
  return features.join(",");
}

function startPresenterOutputWindowMonitor(serviceId) {
  stopPresenterOutputWindowMonitor();
  state.presenter.outputWindowMonitor = window.setInterval(() => {
    // A closed Window is proof of user exit; missing heartbeat alone is not.
    if (state.presenter.outputWindow?.closed) {
      stopPresenterOutput(serviceId);
      return;
    }
    if (isPresenterOutputWindowOpen()) {
      if (state.presenter.outputPendingAt && !isPresenterOutputHeartbeatOpen() && serviceId) {
        renderPresenterControlState(serviceId);
      }
      return;
    }
    stopPresenterOutputWindowMonitor();
    if (state.serviceMusic.mode === "presenter-audio" && globalThis.MindexSongTiming?.ownsSource(state.serviceMusic.sourceKey)) {
      stopServiceMusicPlayback({ render: false });
    }
    state.presenter.outputConnectedAt = 0;
    state.presenter.outputPendingAt = 0;
    state.presenter.outputAttemptServiceId = "";
    state.presenter.outputWarmup = null;
    refreshPresenterOutputConnectionState();
    if (serviceId) renderPresenterControlState(serviceId);
  }, 1000);
}

function stopPresenterOutputWindowMonitor() {
  if (!state.presenter.outputWindowMonitor) return;
  window.clearInterval(state.presenter.outputWindowMonitor);
  state.presenter.outputWindowMonitor = null;
}

function renderPresenterControlState(serviceId = state.selectedServiceId) {
  window.MindexRemote?.notify();
  const result = withServiceItemsScope(() => renderPresenterControlStateUnscoped(serviceId));
  syncPresenterFocusView();
  return result;
}

function renderPresenterControlStateUnscoped(serviceId) {
  updateServiceMusicTransportControls();
  renderLiveServiceReturnControl();
  if (state.module === "presenter" && state.selectedServiceId === serviceId) {
    const root = document.getElementById("servicePresenterControls");
    const sideRoot = refs.rightSidebar?.querySelector("[data-presenter-right-sidebar]");
    const service = state.services.find((svc) => svc.id === serviceId);
    if (root?.isConnected && root.parentNode && service) {
      const active = state.presenter.serviceId === serviceId;
      const slides = presenterSlidesForService(serviceId);
      const index = active ? clampPresenterIndex(state.presenter.index, slides.length) : 0;
      const boardKey = presenterControlBoardKey(service, slides, active, presenterServiceUsesChromakey(service));
      patchPresenterSidebarServiceSummary(serviceId);
      patchPresenterSidebarOutline(service, slides);
      if (root.dataset.boardKey === boardKey) {
        delete root.dataset.presenterBoardPatchQueuedAt;
        root.className = presenterControlsClassName(active, presenterServiceUsesChromakey(service));
        if (sideRoot) patchPresenterControlsTop(sideRoot, service, slides, active, index);
        else setRightSidebarContent(renderPresenterRightSidebar(service, slides, active, index));
        patchPresenterBoardActiveState(root, serviceId, active, index);
        patchServiceOutlineActiveState(serviceId);
        clearPresenterTransientBoardActiveMarks(root, serviceId);
        refreshIcons();
        if (presenterPreviewScaleNeedsUpdate(root)) schedulePresenterPreviewScaleUpdate(root);
        updateSaveState();
        return;
      }
      // Connection controls are lightweight and must reflect start/stop
      // immediately even while a hovered thumbnail delays the board swap.
      if (sideRoot) patchPresenterControlsTop(sideRoot, service, slides, active, index);
      const sameService = root.dataset.serviceId === serviceId;
      const interactionAt = Number(root.dataset.presenterInteractionAt) || 0;
      const interactionDelay = 150 - (Date.now() - interactionAt);
      const hoveredThumbnail = sameService && root.querySelector(".svc-slide-thumb:hover");
      const patchQueuedAt = Number(root.dataset.presenterBoardPatchQueuedAt) || Date.now();
      const hoverDelay = hoveredThumbnail && Date.now() - patchQueuedAt < 600;
      if (sameService && (interactionDelay > 0 || hoverDelay)) {
        root.dataset.presenterBoardPatchQueuedAt = String(patchQueuedAt);
        if (root.dataset.presenterBoardPatchPending !== "true") {
          root.dataset.presenterBoardPatchPending = "true";
          window.setTimeout(() => {
            delete root.dataset.presenterBoardPatchPending;
            if (root.isConnected) renderPresenterControlState(serviceId);
          }, Math.max(interactionDelay, 100) + 16);
        }
        return;
      }
      delete root.dataset.presenterBoardPatchQueuedAt;
      const focusedThumb = capturePresenterFocusedThumb(root);
      const focusedInRightSidebar = refs.rightSidebar?.contains(document.activeElement);
      const focusedRoot = focusedInRightSidebar ? refs.rightSidebar : root;
      const focusedInput = capturePresenterFocusedInput(focusedRoot);
      const viewportSnapshot = capturePresenterViewportSnapshot(serviceId);
      const template = document.createElement("template");
      template.innerHTML = renderServicePresenterControls(service, slides, active, index).trim();
      let nextRoot = template.content.firstElementChild;
      setRightSidebarContent(renderPresenterRightSidebar(service, slides, active, index));
      try {
        if (sameService && patchPresenterBoardSections(root, nextRoot, serviceId, slides, active, index)) {
          nextRoot = root;
        } else {
          root._presenterBoardObserver?.disconnect?.();
          root.replaceWith(nextRoot);
        }
      } catch (error) {
        if (error?.name !== "NotFoundError") throw error;
        renderPresenterDetail();
        return;
      }
      clearPresenterTransientBoardActiveMarks(nextRoot, serviceId);
      patchPresenterBoardActiveState(nextRoot, serviceId, active, index);
      if (!restorePresenterFocusedThumb(nextRoot, focusedThumb)) {
        restorePresenterFocusedInput(focusedInRightSidebar ? refs.rightSidebar : nextRoot, focusedInput);
      }
      refreshIcons();
      mountDeferredPresenterBoardSections(nextRoot, serviceId, slides);
      restorePresenterViewportSnapshot(viewportSnapshot);
      observePresenterPreviewScaleFrames(nextRoot);
      schedulePresenterPreviewLayoutUpdate(nextRoot);
      patchServiceOutlineActiveState(serviceId);
      updateSaveState();
      return;
    }
    renderPresenterDetail();
    return;
  }
  updateSaveState();
}

function patchPresenterBoardSections(root, nextRoot, serviceId, slides, active, index) {
  const board = root.querySelector(".svc-slide-board");
  const nextBoard = nextRoot?.querySelector(".svc-slide-board");
  if (!board || !nextBoard) return false;
  const currentSections = [...board.querySelectorAll(":scope > .svc-board-section")];
  const nextSections = [...nextBoard.querySelectorAll(":scope > .svc-board-section")];
  const keys = (nodes) => nodes.map((node) => node.dataset.presenterSectionKey);
  const valid = (values) => values.every(Boolean) && new Set(values).size === values.length;
  if (!valid(keys(currentSections)) || !valid(keys(nextSections))) return false;
  const mounted = new Map(currentSections.map((node) => [node.dataset.presenterSectionKey, node]));
  const groups = groupPresenterSlidesBySection(slides, serviceId);
  const activeIndex = presenterBoardActiveIndex(slides, active, index);
  const retained = new Map();
  for (let next of nextSections) {
    const current = mounted.get(next.dataset.presenterSectionKey);
    if (!current) continue;
    // Once visible, keep a section mounted instead of reverting to its placeholder.
    if (next.hasAttribute("data-presenter-deferred-board-section") && !current.hasAttribute("data-presenter-deferred-board-section")) {
      const group = groups[Number(next.dataset.presenterBoardGroupIndex)];
      const template = document.createElement("template");
      template.innerHTML = renderPresenterBoardSection(group, activeIndex, serviceId).trim();
      const expanded = template.content.firstElementChild;
      next.replaceWith(expanded);
      next = expanded;
    }
    if (!current.dataset.presenterSectionContent || current.dataset.presenterSectionContent !== next.dataset.presenterSectionContent) {
      refreshIcons(next);
      patchPresenterControlTree(current, next);
    }
    retained.set(next, current);
  }
  const desired = [...nextBoard.children].map((node) => retained.get(node) || node);
  [...board.childNodes].forEach((node) => { if (node.nodeType !== Node.ELEMENT_NODE) node.remove(); });
  let cursor = board.firstElementChild;
  for (const node of desired) {
    if (node !== cursor) board.insertBefore(node, cursor);
    cursor = node.nextElementSibling;
  }
  const keep = new Set(desired);
  [...board.children].forEach((node) => { if (!keep.has(node)) node.remove(); });
  if (!desired.length) board.replaceChildren(...nextBoard.childNodes);
  for (const attr of [...board.attributes]) {
    if (!nextBoard.hasAttribute(attr.name)) board.removeAttribute(attr.name);
  }
  for (const attr of [...nextBoard.attributes]) board.setAttribute(attr.name, attr.value);
  const source = root.querySelector(".svc-source-panel");
  const nextSource = nextRoot.querySelector(".svc-source-panel");
  if (source && nextSource && !source.open) {
    refreshIcons(nextSource);
    patchPresenterControlTree(source, nextSource);
  }
  root.className = nextRoot.className;
  root.dataset.boardKey = nextRoot.dataset.boardKey;
  return true;
}

function capturePresenterFocusedInput(root) {
  const field = document.activeElement;
  if (!root?.contains(field)) return null;
  if (field?.matches?.("[data-presenter-citation-reference-input]")) {
    return { type: "citation", serviceId: field.dataset.serviceId, elementId: field.dataset.presenterCitationElementId,
      value: field.value, selectionStart: field.selectionStart, selectionEnd: field.selectionEnd };
  }
  if (field?.matches?.("[data-presenter-preparation-field]")) {
    return {
      type: "preparation",
      serviceId: field.dataset.serviceId || "",
      label: field.dataset.presenterPreparationFieldLabel || "",
      value: field.value,
      selectionStart: typeof field.selectionStart === "number" ? field.selectionStart : null,
      selectionEnd: typeof field.selectionEnd === "number" ? field.selectionEnd : null,
    };
  }
  if (!field?.matches?.("input[data-service-item-field], textarea[data-service-item-field], select[data-service-item-field]")) return null;
  return {
    type: "service-item",
    key: field.dataset.serviceItemField || "",
    index: field.dataset.serviceItemIndex || "",
    scriptureReferenceIndex: field.dataset.scriptureReferenceIndex || "",
    value: field.value,
    initialValue: field.dataset.initialValue,
    selectionStart: typeof field.selectionStart === "number" ? field.selectionStart : null,
    selectionEnd: typeof field.selectionEnd === "number" ? field.selectionEnd : null,
  };
}

function capturePresenterFocusedThumb(root) {
  const thumb = document.activeElement?.closest?.(".svc-slide-thumb[data-presenter-index][data-service-id]");
  if (!root?.contains(thumb)) return null;
  return {
    serviceId: thumb.dataset.serviceId || "",
    index: thumb.dataset.presenterIndex || "",
  };
}

function restorePresenterFocusedThumb(root, snapshot) {
  if (!root || !snapshot?.serviceId || snapshot.index === "") return false;
  const focusIndex = snapshot.serviceId === state.presenter.serviceId
    ? String(state.presenter.index)
    : String(snapshot.index);
  const thumb = root.querySelector(
    `.svc-slide-thumb[data-service-id="${CSS.escape(snapshot.serviceId)}"][data-presenter-index="${CSS.escape(focusIndex)}"]`,
  ) || root.querySelector(
    `.svc-slide-thumb[data-service-id="${CSS.escape(snapshot.serviceId)}"][data-presenter-index="${CSS.escape(snapshot.index)}"]`,
  );
  if (!thumb) return false;
  thumb.focus({ preventScroll: true });
  return true;
}

function restorePresenterFocusedInput(root, snapshot) {
  if (!root || !snapshot) return;
  if (snapshot.type === "citation") {
    const field = root.querySelector(`[data-presenter-citation-reference-input][data-service-id="${CSS.escape(snapshot.serviceId)}"][data-presenter-citation-element-id="${CSS.escape(snapshot.elementId)}"]`);
    if (!field) return;
    field.value = snapshot.value;
    field.focus({ preventScroll: true });
    if (snapshot.selectionStart !== null) field.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
    return;
  }
  if (snapshot.type === "preparation") {
    const field = root.querySelector(`[data-presenter-preparation-field][data-service-id="${CSS.escape(snapshot.serviceId || "")}"][data-presenter-preparation-field-label="${CSS.escape(snapshot.label || "")}"]`);
    if (!field) return;
    if (typeof snapshot.value === "string") field.value = snapshot.value;
    field.focus({ preventScroll: true });
    if (snapshot.selectionStart === null || typeof field.setSelectionRange !== "function") return;
    const end = snapshot.selectionEnd ?? snapshot.selectionStart;
    field.setSelectionRange(snapshot.selectionStart, end);
    return;
  }
  if (!snapshot.key) return;
  const selector = [
    `[data-service-item-field="${CSS.escape(snapshot.key)}"]`,
    `[data-service-item-index="${CSS.escape(snapshot.index)}"]`,
    snapshot.scriptureReferenceIndex ? `[data-scripture-reference-index="${CSS.escape(snapshot.scriptureReferenceIndex)}"]` : "",
  ].join("");
  const field = root.querySelector(selector);
  if (!field) return;
  if (typeof snapshot.value === "string") field.value = snapshot.value;
  if (snapshot.initialValue !== undefined) field.dataset.initialValue = snapshot.initialValue;
  field.focus({ preventScroll: true });
  if (snapshot.selectionStart === null || typeof field.setSelectionRange !== "function") return;
  const end = snapshot.selectionEnd ?? snapshot.selectionStart;
  field.setSelectionRange(snapshot.selectionStart, end);
}

function clearPresenterTransientBoardActiveMarks(root = document.getElementById("servicePresenterControls"), serviceId = state.selectedServiceId) {
  if (!root) return;
  const shouldClear = !presenterControllerIsLive(serviceId)
    || state.presenter.serviceId !== serviceId
    || Boolean(state.presenter.safetyBlank || state.presenter.liveScripture?.active);
  if (!shouldClear) return;
  root.querySelectorAll(".svc-slide-thumb.active, .svc-slide-thumb-wrap.active, .svc-board-section.active, .svc-board-subgroup.active")
    .forEach((node) => node.classList.remove("active"));
  syncPresenterBoardSelectionClasses(root);
}

function patchPresenterControlTree(current, next) {
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

function patchPresenterControlsTop(root, service, slides, active, index) {
  if (!root || !service) return;
  root.setAttribute("aria-label", uiText("presenter.controls"));
  const currentTop = root.querySelector(".svc-presenter-top");
  const template = document.createElement("template");
  template.innerHTML = renderPresenterControlsTop(service, slides, active, index).trim();
  const nextTop = template.content.firstElementChild;
  if (!currentTop || !nextTop) return;
  refreshIcons(nextTop);
  patchPresenterControlTree(currentTop, nextTop);
  applyPresenterPreviewScales(currentTop);
  fitPresenterPreviewText(currentTop);
}

function patchPresenterBoardActiveState(root, serviceId, active, index) {
  if (!root) return;
  const activeIndex = presenterBoardActiveIndex(state.presenter.slides, active, index);
  root.querySelectorAll(".svc-slide-thumb[data-presenter-index][data-service-id]").forEach((thumb) => {
    const active = activeIndex >= 0
      && thumb.dataset.serviceId === serviceId
      && Number(thumb.dataset.presenterIndex) === activeIndex;
    thumb.classList.toggle("active", active);
    thumb.toggleAttribute("aria-current", active);
    thumb.closest(".svc-slide-thumb-wrap")?.classList.toggle("active", active);
  });
  root.querySelectorAll(".svc-board-subgroup").forEach((subgroup) => {
    subgroup.classList.toggle("active", Boolean(subgroup.querySelector(".svc-slide-thumb.active")));
  });
  root.querySelectorAll(".svc-board-section").forEach((section) => {
    section.classList.toggle("active", Boolean(section.querySelector(".svc-slide-thumb.active")));
  });
  syncPresenterBoardSelectionClasses(root);
}

function presenterPreviewScaleNeedsUpdate(root = document.getElementById("servicePresenterControls")) {
  if (!root?.querySelectorAll || typeof presenterScaleForBox !== "function") return false;
  return [...root.querySelectorAll(".svc-slide-mini-canvas.presenter-output-root")].some((canvas) => {
    const frame = canvas.closest(".svc-slide-thumb-frame") || canvas.parentElement;
    const rect = frame?.getBoundingClientRect?.();
    if (!rect?.width || !rect?.height) return true;
    const expected = typeof presenterPreviewScaleForBox === "function"
      ? presenterPreviewScaleForBox(rect.width, rect.height)
      : presenterScaleForBox(rect.width, rect.height);
    const current = Number(canvas.style.getPropertyValue("--presenter-preview-scale"));
    return !Number.isFinite(current) || Math.abs(current - expected) >= 0.0005;
  });
}

function patchServiceOutlineActiveState(serviceId = state.selectedServiceId) {
  if (state.module !== "presenter" || state.selectedServiceId !== serviceId) return;
  const outline = refs.songList?.querySelector(".service-outline-list");
  if (!outline) return;
  outline.querySelectorAll(".service-outline-row.active, .service-outline-row.is-complete, .service-outline-group.active")
    .forEach((node) => node.classList.remove("active", "is-complete"));
  outline.querySelectorAll('.service-outline-row[aria-current="step"]')
    .forEach((node) => node.removeAttribute("aria-current"));
  if (!presenterControllerIsLive(serviceId)) return;
  const slides = state.presenter.serviceId === serviceId ? state.presenter.slides : [];
  const activeSlide = slides[clampPresenterIndex(state.presenter.index, slides.length)] || null;
  if (!activeSlide) return;
  const showProgress = !state.presenter.safetyBlank && !state.presenter.liveScripture?.active;
  const service = state.services.find((svc) => svc.id === serviceId);
  const itemByIndex = new Map();
  if (service) {
    getServiceOutlineItems(service).forEach((item, candidateIndex) => {
      const index = Number.isInteger(item._serviceItemIndex) ? item._serviceItemIndex : candidateIndex;
      if (!itemByIndex.has(index)) itemByIndex.set(index, item);
    });
  }
  const activeGroups = new Set();
  outline.querySelectorAll(".service-outline-row[data-service-outline-service]").forEach((row) => {
    if (row.dataset.serviceOutlineService !== serviceId) return;
    const index = Number(row.dataset.serviceOutlineItemIndex);
    const item = Number.isInteger(index) ? itemByIndex.get(index) : null;
    const active = item
      ? presenterSlideBelongsToItem(activeSlide, item)
      : Number(row.dataset.serviceOutlineSlide) === state.presenter.index;
    const slideIndexValue = row.dataset.serviceOutlineSlide;
    const slideIndex = Number(slideIndexValue);
    const complete = showProgress && !active && slideIndexValue !== "" && Number.isInteger(slideIndex)
      && slideIndex >= 0 && slideIndex < state.presenter.index;
    row.classList.toggle("active", active);
    row.classList.toggle("is-complete", complete);
    if (active && (row.classList.contains("service-outline-row--child") || row.classList.contains("service-outline-row--ready"))) {
      row.setAttribute("aria-current", "step");
    }
    const group = row.closest(".service-outline-group");
    if (active && group) activeGroups.add(group);
  });
  activeGroups.forEach((group) => {
    group.classList.add("active");
    // A live child still belongs to this section. Keep the section-level
    // marker visible instead of showing it only while the first item is live.
    const sectionRow = group.querySelector(".service-outline-row--section");
    sectionRow?.classList.add("active");
    sectionRow?.classList.remove("is-complete");
  });
}

let presenterLaunchRequestSerial = 0;

async function startPresenterAtSlide(serviceId, index) {
  if (!serviceId || !Number.isFinite(Number(index))) return;
  if (state.presenter.outputWindow?.closed) stopPresenterOutput(state.presenter.serviceId);
  const requestSerial = ++presenterLaunchRequestSerial;
  await hydratePresenterServiceData(serviceId);
  if (requestSerial !== presenterLaunchRequestSerial) return;
  preparePresenterService(serviceId);
  suspendServiceMusicAutoSync();
  state.presenter.index = clampPresenterIndex(index, state.presenter.slides.length);
  state.presenter.pptxProgress = null;
  clearPresenterBoardSelection({ render: false });
  state.presenter.safetyBlank = false;
  state.presenter.jumpDraft = "";
  state.presenter.liveScripture = {
    ...state.presenter.liveScripture,
    active: false,
    slide: null,
  };
  state.presenter.livePraise = emptyLivePraiseState(state.presenter.livePraise?.draft || state.presenter.livePraise?.query || "");
  syncSelectedServiceItemToPresenterSlide(serviceId);
  syncServiceMusicWithPresenterContext(serviceId, { render: false });
  publishPresenterState();
  await openPresenterOutput(serviceId);
  if (requestSerial !== presenterLaunchRequestSerial) return;
  renderPresenterControlState(serviceId);
  scrollPresenterOutlineToActive(serviceId);
}

function presenterServiceNeedsHymnScoreManifest(serviceId) {
  if (!serviceId || state.hymnScoreManifestLoaded) return false;
  return getServiceOutputItems(serviceId).some((item) => {
    const memo = parseServiceItemMemo(item?.memo);
    if (serviceItemOutputMode(item, memo) === "score") return true;
    const song = item?.song_id
      ? songById(item.song_id)
      : null;
    return Boolean(song?.hymn_no && isSongServiceLabel(item?.label || ""));
  });
}

function preparePresenterNavigation(serviceId) {
  // Projected items can be cloned on reads; content signatures are authoritative.
  if (state.presenter.serviceId === serviceId
    && state.presenter.slides?.length
    && state.presenter.sourceSignature === presenterSlideBuildSourceSignature(serviceId)) return true;
  preparePresenterService(serviceId);
  return false;
}

function preparePresenterService(serviceId = state.selectedServiceId) {
  if (!serviceId) return;
  state.presenter.viewServiceId = serviceId;
  const outputItems = getServiceOutputItems(serviceId);
  if (!songCatalogLoaded && !songLoadPromise && canUseClientData()) {
    void loadSongsForIds(outputItems.map((item) => item.song_id)).then(() => refreshPresenterForService(serviceId));
  }
  if (
    canUseClientData()
    && !hymnScoreManifestLoadPromise
    && presenterServiceNeedsHymnScoreManifest(serviceId)
  ) {
    void loadHymnScoreManifest({ silent: true }).then(() => refreshPresenterForService(serviceId));
  }
  if (
    canUseClientData()
    && !state.loadedWorshipPresenterServiceIds.has(serviceId)
    && !outputItems.length
  ) {
    void loadWorshipPresenterSlides(serviceId);
  }
  warmWorshipScriptureReferencesForService(serviceId);
  warmServiceItemScriptureReferencesForService(serviceId);
  schedulePendingServiceScriptureResolves(serviceId);
  const previousServiceId = state.presenter.serviceId;
  const previousSlides = state.presenter.slides;
  const previousIndex = state.presenter.index;
  const signature = presenterSlideBuildSourceSignature(serviceId);
  const slides = buildServicePresenterSlides(serviceId, signature);
  if (previousServiceId !== serviceId) {
    state.presenter.restorePayload = null;
    if (!state.serviceMusic.playing) {
      stopServiceMusicPlayback({ clearSource: true, mode: "manual", render: false });
    }
    state.presenter.index = 0;
    state.presenter.safetyBlank = false;
    state.presenter.jumpDraft = "";
    state.presenter.liveScripture = { reference: "", draft: "", active: false, slide: null };
    state.presenter.livePraise = emptyLivePraiseState();
  }
  state.presenter.serviceId = serviceId;
  state.presenter.slides = slides;
  // Building the output can normalize projected items into a new array.
  // Keep the post-build source reference so cached slides never outlive it.
  state.presenter.sourceItems = state.serviceItems[serviceId] || null;
  state.presenter.sourceSignature = signature;
  state.presenter.index = previousServiceId === serviceId
    ? reconcilePresenterIndexForSlides(previousSlides, previousIndex, slides)
    : clampPresenterIndex(state.presenter.index, slides.length);
  if (!slides.length) state.presenter.safetyBlank = false;
  syncServiceMusicWithPresenterContext(serviceId, { render: false });
}

function schedulePendingServiceScriptureResolves(serviceId) {
  const service = state.services.find((entry) => entry.id === serviceId) || null;
  const items = getServiceItems(serviceId);
  items.forEach((item, index) => {
    if (!serviceItemSupportsScriptureResolution(item)) return;
    const memo = parseServiceItemMemo(item.memo);
    if (!serviceItemScriptureReferences(item, memo, service).length) return;
    if (serviceScriptureTextPayload(item, memo, service).verses.length) return;
    scheduleServiceScriptureBodyResolve(serviceId, index, { markDirty: false });
  });
}

function mergePresenterRefreshOptions(current = {}, next = {}) {
  return {
    publish: current.publish !== false && next.publish !== false,
    renderControls: current.renderControls !== false && next.renderControls !== false,
  };
}

function schedulePresenterRefreshForService(serviceId, options = {}) {
  if (!serviceId) return;
  const key = String(serviceId);
  const existing = scheduledPresenterRefreshes.get(key);
  const mergedOptions = mergePresenterRefreshOptions(existing?.options || {}, options);
  if (existing?.timer) window.clearTimeout(existing.timer);
  const timer = window.setTimeout(() => {
    const pending = scheduledPresenterRefreshes.get(key);
    scheduledPresenterRefreshes.delete(key);
    refreshPresenterForService(key, pending?.options || mergedOptions);
  }, 90);
  scheduledPresenterRefreshes.set(key, { timer, options: mergedOptions });
}

function refreshPresenterForService(serviceId, options = {}) {
  if (!serviceId) return;
  const isActive = state.presenter.serviceId === serviceId;
  if (!isActive) {
    if (options.renderControls !== false && state.module === "presenter" && state.selectedServiceId === serviceId) renderPresenterControlState(serviceId);
    return;
  }
  const previousSlides = state.presenter.slides;
  const previousIndex = state.presenter.index;
  const signature = presenterSlideBuildSourceSignature(serviceId);
  state.presenter.slides = buildServicePresenterSlides(serviceId, signature);
  state.presenter.sourceItems = state.serviceItems[serviceId] || null;
  state.presenter.sourceSignature = signature;
  state.presenter.index = reconcilePresenterIndexForSlides(previousSlides, previousIndex, state.presenter.slides);
  if (!state.presenter.slides.length) state.presenter.safetyBlank = false;
  syncServiceMusicWithPresenterContext(serviceId, { render: false });
  if (options.publish !== false) publishPresenterState();
  if (options.renderControls !== false && state.module === "presenter" && state.selectedServiceId === serviceId) renderPresenterControlState(serviceId);
}

function refreshPresenterForServiceType(typeId, options = {}) {
  const service = state.services.find((svc) => svc.id === state.presenter.serviceId);
  if (service?.type_id === typeId) refreshPresenterForService(service.id, options);
  const selectedService = state.services.find((svc) => svc.id === state.selectedServiceId);
  if (state.module === "presenter" && selectedService?.type_id === typeId && selectedService.id !== service?.id) {
    refreshPresenterForService(selectedService.id, { publish: false });
  }
}

function movePresenterSlide(delta) {
  if (advancePresenterPptx(state.presenter, delta)) return;
  const count = state.presenter.slides.length;
  if (!count) return;
  const step = delta < 0 ? -1 : 1;
  let index = state.presenter.index + step;
  while (index >= 0 && index < count && !presenterSlideIsNavigable(state.presenter.slides[index])) index += step;
  if (index >= 0 && index < count) state.presenter.index = index;
}

function presenterSlideIsHidden(slide = {}) {
  return Boolean(slide.hiddenInPresentation || slide.hidden_in_presentation || slide.hidden);
}

function presenterSlideIsNavigable(slide = {}) {
  return !presenterSlideIsHidden(slide);
}

function firstPresenterNavigableIndex(slides = []) {
  const index = slides.findIndex((slide) => presenterSlideIsNavigable(slide));
  return index >= 0 ? index : 0;
}

function lastPresenterNavigableIndex(slides = []) {
  for (let index = slides.length - 1; index >= 0; index -= 1) {
    if (presenterSlideIsNavigable(slides[index])) return index;
  }
  return Math.max(slides.length - 1, 0);
}

function clampPresenterIndex(index, count) {
  if (!count) return 0;
  return Math.min(Math.max(Number(index) || 0, 0), count - 1);
}

function presenterSlideAnchor(slide = null) {
  if (!slide) return null;
  const groupKey = presenterSlideElementGroupKey(slide);
  return {
    id: String(slide.id || "").trim(),
    groupKey,
    type: String(slide.type || "").trim(),
    layout: presenterSlideLayout(slide),
    elementType: presenterSlideElementType(slide),
    scriptureContext: String(slide.scriptureContext || "").trim(),
    scripturePending: Boolean(slide.scripturePending),
    title: String(slide.title || slide.elementTitle || slide.marker || "").trim(),
    hidden: presenterSlideIsHidden(slide),
  };
}

function presenterSlideTypeMatchesAnchor(slide, anchor) {
  const slideType = String(slide?.type || "").trim();
  const anchorType = String(anchor?.type || "").trim();
  if (slideType === anchorType) return true;
  return (
    (anchorType === "scripture-pending" && slideType === "scripture")
    || (anchorType === "scripture" && slideType === "scripture-pending")
  );
}

function presenterSlideContextMatchesAnchor(slide, anchor) {
  const anchorContext = String(anchor?.scriptureContext || "").trim();
  if (!anchorContext) return true;
  return String(slide?.scriptureContext || "").trim() === anchorContext;
}

function presenterSlideIndexForAnchor(slides = [], anchor = null, fallbackIndex = 0) {
  if (!Array.isArray(slides) || !slides.length) return 0;
  if (!anchor) return clampPresenterIndex(fallbackIndex, slides.length);
  if (anchor.id) {
    const exactIndex = slides.findIndex((slide) => String(slide?.id || "").trim() === anchor.id);
    if (exactIndex >= 0) return exactIndex;
  }
  if (anchor.groupKey) {
    const sameTypeIndex = slides.findIndex((slide) =>
      presenterSlideElementGroupKey(slide) === anchor.groupKey
      && presenterSlideTypeMatchesAnchor(slide, anchor)
      && presenterSlideContextMatchesAnchor(slide, anchor)
      && !slide?.hiddenInPresentation);
    if (sameTypeIndex >= 0) return sameTypeIndex;
    const visibleGroupIndex = slides.findIndex((slide) =>
      presenterSlideElementGroupKey(slide) === anchor.groupKey
      && !slide?.hiddenInPresentation);
    if (visibleGroupIndex >= 0) return visibleGroupIndex;
    const groupIndex = slides.findIndex((slide) => presenterSlideElementGroupKey(slide) === anchor.groupKey);
    if (groupIndex >= 0) return groupIndex;
  }
  return clampPresenterIndex(fallbackIndex, slides.length);
}

function reconcilePresenterIndexForSlides(previousSlides = [], previousIndex = 0, nextSlides = [], fallbackIndex = previousIndex) {
  const previousSlide = Array.isArray(previousSlides)
    ? previousSlides[clampPresenterIndex(previousIndex, previousSlides.length)]
    : null;
  return presenterSlideIndexForAnchor(nextSlides, presenterSlideAnchor(previousSlide), fallbackIndex);
}

function presenterSlidesForService(serviceId) {
  const sourceItems = state.serviceItems[serviceId] || null;
  const signature = presenterSlideBuildSourceSignature(serviceId);
  if (state.presenter.serviceId === serviceId
    && state.presenter.sourceItems === sourceItems
    && state.presenter.sourceSignature === signature
    && Array.isArray(state.presenter.slides)
    && state.presenter.slides.length) {
    state.presenter.index = clampPresenterIndex(state.presenter.index, state.presenter.slides.length);
    return state.presenter.slides;
  }
  const slides = buildServicePresenterSlides(serviceId, signature);
  if (state.presenter.serviceId === serviceId) {
    const previousSlides = state.presenter.slides;
    const previousIndex = state.presenter.index;
    state.presenter.slides = slides;
    state.presenter.sourceItems = state.serviceItems[serviceId] || null;
    state.presenter.sourceSignature = signature;
    state.presenter.index = reconcilePresenterIndexForSlides(previousSlides, previousIndex, slides);
  }
  return slides;
}

function presenterServiceScriptureCacheSignature(service, items) {
  // Legacy slide-only services do not expose their dependencies as service items.
  if (!items.length) return state.bibleVerseCacheVersion || 0;
  const keys = new Set();
  items.forEach((item) => {
    if (!serviceItemSupportsScriptureResolution(item)) return;
    const memo = parseServiceItemMemo(item.memo);
    if (memo.manualScripture) return;
    serviceItemScriptureReferences(item, memo, service).forEach((text) => {
      const reference = parseBibleReference(text);
      const translation = serviceItemBibleTranslationForReference(item, memo, text);
      if (reference && translation?.id) {
        keys.add(bibleVerseCacheKey(translation.id, reference.book.code, reference.chapter));
      }
    });
  });
  return [...keys].sort().map((key) => [key, compactTextSignature(JSON.stringify(
    (state.bibleVerseCache.get(key) || []).map((row) => [row.verse, row.verse_end, row.text]),
  ))]);
}

function presenterSlideBuildSourceSignature(serviceId) {
  const service = state.services.find((svc) => svc.id === serviceId) || {};
  const items = state.serviceItems[serviceId] || [];
  const presenterRows = state.worshipPresenterSlides[serviceId] || [];
  return JSON.stringify({
    songTimingRevision: globalThis.MindexSongTiming?.revision || 0,
    service: [
      service.id || "",
      service.type_id || "",
      service.date || service.service_date || "",
      service.updated_at || "",
      presenterServiceScriptureCacheSignature(service, items),
      state.hymnScoreManifestLoaded ? Object.keys(state.hymnScoreManifest || {}).length : 0,
    ],
    items: items.map((item) => {
      const song = item.song_id ? songById(item.song_id) : null;
      const selectedVersionId = item.version_id || item.song_version_id || "";
      const version = song?.versions?.find((entry) => String(entry.id || "") === String(selectedVersionId))
        || song?.versions?.[0]
        || null;
      return [
        item.id || "",
        item.section_id || item._worshipSectionId || "",
        item.sort_order ?? "",
        item.label || "",
        item.name || "",
        item.raw_title || "",
        item.assignee || "",
        item.song_id || "",
        selectedVersionId,
        item.output_mode || item.outputMode || "",
        item.updated_at || "",
        item.memo || "",
        song?.updated_at || "",
        song?._relationalVersionsLoaded === true,
        song?.versions?.length || 0,
        version?.updated_at || "",
        servicePraiseInputMode(item) === "children_audio" ? compactTextSignature(JSON.stringify(version?.audio_set || null)) : "",
        (version?.forms || []).map((form) => [
          form.id || "",
          form.label || form.name || form.type || "",
          compactTextSignature(form.lyrics || form.text || ""),
        ]),
      ];
    }),
    presenterRows: presenterRows.map((slide) => [
      slide.id || "",
      slide.sort ?? "",
      slide.title || "",
      compactTextSignature(slide.text || ""),
      slide.updated_at || "",
    ]),
  });
}

function buildServicePresenterSlides(serviceId, signatureOverride = "") {
  const key = String(serviceId || "");
  if (!key) return [];
  const signature = signatureOverride || presenterSlideBuildSourceSignature(key);
  const cached = presenterSlideBuildCache.get(key);
  if (cached?.signature === signature) return cached.slides;
  const slides = buildServicePresenterSlidesUncached(key);
  presenterSlideBuildCache.set(key, { signature, slides });
  if (presenterSlideBuildCache.size > 8) {
    const oldestKey = presenterSlideBuildCache.keys().next().value;
    presenterSlideBuildCache.delete(oldestKey);
  }
  return slides;
}

function buildServicePresenterSlidesUncached(serviceId, options = {}) {
  const service = options.service || state.services.find((svc) => svc.id === serviceId);
  if (!service) return [];

  const outputItems = getServiceOutputItems(serviceId, options);
  const documentFallbackSlides = Array.isArray(options.items) ? [] : serviceDocumentPresenterSlides(service);
  if (documentFallbackSlides.length && serviceItemsShouldUseDocumentSlideFallback(outputItems)) {
    return documentFallbackSlides;
  }
  if (outputItems.length) {
    const scriptureReading = outputItems.find(isSharedScriptureReadingServiceItem);
    let slides = outputItems
      .sort((a, b) => a.sort_order - b.sort_order)
      .flatMap((item, index) => {
        const slides = buildPresenterSlidesForServiceItem(item, service, index, options);
        if (scriptureReading && isPresenterPreparationSermonTitleItem(item)) {
          // Reuse the reading payload, but keep every derived slide in the sermon element.
          const section = presenterSectionForServiceItem(item, index, serviceItemDisplayText(item));
          const bodySlides = buildPresenterScriptureTextSlides(scriptureReading, section, index, service);
          const pending = bodySlides.length ? null : presenterPendingScriptureSlide(scriptureReading, section, index, service);
          slides.push(...(bodySlides.length ? bodySlides : pending ? [pending] : []).map((slide) => ({
            ...slide,
            id: `${item.id || index}:sermon:${slide.id}`,
            label: item.label,
          })));
        }
        const hidden = serviceItemPresentationHidden(item);
        return hidden ? slides.map((slide) => ({ ...slide, hiddenInPresentation: true })) : slides;
      })
      .filter(Boolean);
    slides = insertPresenterProgressionMedia(slides, outputItems);
    slides = normalizePresenterSlidesForServiceOutput(slides, service);
    slides = globalThis.MindexSongTiming?.decorateService(slides, outputItems, serviceId) || slides;
    if (!slides[0] || !isPresenterPreparationSlide(slides[0])) slides = [presenterReadySlide(service), ...slides];
    return withPresenterElementTrailingBlanks(slides, service);
  }

  const worshipSlides = Array.isArray(options.items) ? [] : state.worshipPresenterSlides[serviceId] || [];
  if (worshipSlides.length) {
    const slides = worshipSlides
      .slice()
      .sort((a, b) => a.sort - b.sort)
      .map((slide) => presenterSlideWithServiceAssigneeFallback(slide, service));
    const normalizedSlides = normalizePresenterSlidesForServiceOutput(slides, service);
    const serviceSlides = slides[0] && isPresenterPreparationSlide(slides[0])
      ? normalizedSlides
      : [presenterReadySlide(service), ...normalizedSlides];
    return withPresenterElementTrailingBlanks(serviceSlides, service);
  }

  return withPresenterElementTrailingBlanks([presenterReadySlide(service)], service);
}

function serviceItemsShouldUseDocumentSlideFallback(items = []) {
  if (!Array.isArray(items) || !items.length) return true;
  return items.every((item) => isUnmodifiedTemplatePlaceholder(item));
}

function serviceDocumentPresenterSlides(service = null) {
  const document = serviceDocumentSnapshotFromRef(service);
  const slides = normalizeServiceDocumentSlides(document?.slides);
  if (!slides.length) return [];
  const restored = slides
    .map((slide, index) => serviceDocumentSlideToPresenterSlide(slide, index, service))
    .filter(Boolean);
  if (!restored.length) return [];
  const withReady = restored[0] && isPresenterPreparationSlide(restored[0])
    ? restored
    : [presenterReadySlide(service), ...restored];
  return withPresenterElementTrailingBlanks(normalizePresenterSlidesForServiceOutput(withReady, service), service);
}

function serviceDocumentSlideToPresenterSlide(slide = {}, index = 0, service = null) {
  if (!slide || typeof slide !== "object") return null;
  const layout = slide.layout || presenterSlideLayout(slide);
  const elementType = slide.elementType || presenterSlideElementType(slide);
  const asset = normalizeServiceAsset(slide.asset);
  const restored = {
    id: slide.id || `${service?.id || "service"}:document-slide:${index + 1}`,
    sectionId: slide.sectionId || `${service?.id || "service"}:document-section:${slide.sectionKey || index + 1}`,
    elementId: slide.elementId || "",
    sectionIndex: Number(slide.index) || index + 1,
    sectionKey: slide.sectionKey || "",
    slotKey: normalizeWorshipSlotKey(slide.slotKey || slide.linkedSource?.slotKey),
    sectionLabel: slide.elementLabel || slide.title || "예배 문서",
    sectionHeading: slide.elementLabel || slide.title || "예배 문서",
    sectionTitle: slide.elementLabel || slide.title || "예배 문서",
    elementLabel: slide.elementLabel || "",
    elementTitle: slide.title || slide.elementLabel || "",
    elementType,
    layout,
    type: slide.type || presenterSlideTypeFromModel({ ...slide, layout, elementType }),
    label: slide.elementLabel || slide.title || "",
    title: slide.title || slide.elementLabel || "",
    marker: slide.title || slide.elementLabel || "",
    text: slide.text || "",
    outputContext: normalizePresenterOutputContext(slide.outputContext) || "",
    backgroundVideo: normalizeServicePresentation({ backgroundVideo: slide.backgroundVideo })?.backgroundVideo || "",
    hiddenInPresentation: Boolean(slide.hidden),
    autoTrailingBlank: Boolean(slide.autoTrailingBlank),
    serviceDocumentFallback: true,
    sort: index,
  };
  if (asset.name || asset.url || asset.kind) restored.asset = asset;
  if (slide.imageSrc) restored.imageSrc = slide.imageSrc;
  if (slide.videoSrc) restored.videoSrc = slide.videoSrc;
  if (slide.audioSrc) restored.audioSrc = slide.audioSrc;
  const issues = presenterSlideModelIssues(restored);
  if (issues.length) {
    console.warn("Skipped invalid service document slide fallback.", { slide, issues });
    return null;
  }
  return restored;
}

function normalizePresenterSlidesForServiceOutput(slides = [], service = null) {
  const chromakey = presenterServiceUsesChromakey(service);
  return slides.map((slide) => {
    const outputContext = presenterSlideOutputContext(slide, chromakey);
    if (outputContext === "clean") return normalizeCleanPresenterSlideLayout(slide);
    if (outputContext === "chromakey") return normalizeChromakeyPresenterSlideLayout(slide);
    return chromakey
      ? normalizeChromakeyPresenterSlideLayout(slide)
      : normalizeCleanPresenterSlideLayout(slide);
  });
}

function normalizeCleanPresenterSlideLayout(slide = {}) {
  if (!slide || presenterSlideOutputContext(slide, false) !== "clean") return slide;
  if (presenterSlideLayout(slide) !== PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT) return slide;
  if (presenterSlideElementType(slide) !== PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE) return slide;
  if (!presenterTitleAssigneeIsSermon(slide) && String(slide.orderTitle || "").trim() && String(slide.contentTitle || "").trim()) {
    return { ...slide, outputContext: "clean" };
  }
  const title = String(slide.contentTitle || slide.title || slide.sectionTitle || slide.label || "").trim();
  const rawBodyText = String(slide.assignee || presenterTitleContentBodyText(slide)).trim();
  const bodyText = compactSearchValue(rawBodyText) === compactSearchValue(title) ? "" : rawBodyText;
  return {
    ...slide,
    elementType: PRESENTER_ELEMENT_TYPES.TITLE_CONTENT,
    layout: PRESENTER_SLIDE_LAYOUTS.CENTER_TEXT,
    type: "title-content",
    title,
    assignee: "",
    bodyText,
    text: cleanList([title, bodyText]).join("\n"),
    outputContext: "clean",
  };
}

function normalizeChromakeyPresenterSlideLayout(slide = {}) {
  if (!slide || presenterSlideOutputContext(slide, true) !== "chromakey") return slide;
  if (presenterSlideLayout(slide) !== PRESENTER_SLIDE_LAYOUTS.CENTER_TEXT) return slide;
  const elementType = presenterSlideElementType(slide);
  if ([
    PRESENTER_ELEMENT_TYPES.IMAGE,
    PRESENTER_ELEMENT_TYPES.VIDEO,
    PRESENTER_ELEMENT_TYPES.FILE,
    PRESENTER_ELEMENT_TYPES.AUDIO,
  ].includes(elementType)) return slide;
  const title = String(slide.title || slide.sectionTitle || slide.label || "").trim();
  const rawBodyText = presenterTitleContentBodyText(slide);
  const bodyText = compactSearchValue(rawBodyText) === compactSearchValue(title) ? "" : rawBodyText;
  if (presenterSlideIsTitleContent(slide)) {
    return {
      ...slide,
      elementType: PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE,
      layout: PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,
      type: "title-assignee",
      title,
      assignee: bodyText,
      text: cleanList([title, bodyText]).join("\n"),
      outputContext: "chromakey",
    };
  }
  return {
    ...slide,
    layout: PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,
    type: slide.type === "liturgical-body" ? "lyrics" : slide.type,
    text: String(slide.text || bodyText || title || "").trim(),
    outputContext: "chromakey",
  };
}

function presenterSlideWithServiceAssigneeFallback(slide = {}, service = null) {
  if (isPresenterScriptureReadingSource(slide)) {
    if (presenterSlideLayout(slide) === PRESENTER_SLIDE_LAYOUTS.BLANK || slide.type === "blank") {
      return {
        ...slide,
        assignee: "",
        sectionAssignee: "",
        text: "",
      };
    }
    const reference = cleanPresenterAssignee(slide.assignee || slide.text);
    const title = slide.title || "성경봉독";
    return {
      ...slide,
      title,
      assignee: reference && compactSearchValue(reference) !== compactSearchValue(title) ? reference : "",
      sectionAssignee: "",
      text: slide.elementType === PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE
        ? cleanList([title, reference && compactSearchValue(reference) !== compactSearchValue(title) ? reference : ""]).join("\n")
        : slide.text,
    };
  }
  const assignee = cleanPresenterAssignee(slide.assignee || slide.sectionAssignee);
  const resolvedAssignee = assignee;
  if (resolvedAssignee === (slide.assignee || "") && resolvedAssignee === (slide.sectionAssignee || "")) return slide;
  return {
    ...slide,
    assignee: resolvedAssignee,
    sectionAssignee: resolvedAssignee || "",
    text: slide.elementType === PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE
      ? cleanList([slide.title, resolvedAssignee]).join("\n")
      : slide.text,
  };
}

function withPresenterElementTrailingBlanks(slides = [], service = null) {
  const prepared = [];
  slides.filter(Boolean).forEach((slide, index, list) => {
    prepared.push(slide);
    if (!shouldAppendPresenterElementTrailingBlank(slide, list[index + 1], { service, slides: list })) return;
    prepared.push(presenterElementTrailingBlankSlide(slide, prepared.length, service));
  });
  return prepared;
}

function shouldAppendPresenterElementTrailingBlank(slide, nextSlide, context = {}) {
  if (!slide || slide.autoTrailingBlank) return false;
  if (slide.skipTrailingBlank || slide.hiddenInPresentation) return false;
  const progressionParent = slide.progressionParentId || slide.elementId;
  if (progressionParent && nextSlide && (slide.progressionParentId || nextSlide.progressionParentId)
    && progressionParent === (nextSlide.progressionParentId || nextSlide.elementId)) return false;
  if (presenterSlideLayout(slide) === PRESENTER_SLIDE_LAYOUTS.BLANK) return false;
  const currentKey = presenterSlideElementGroupKey(slide);
  const nextKey = presenterSlideElementGroupKey(nextSlide);
  if (isPresenterMainPraiseSlide(slide) && isPresenterMainPraiseSlide(nextSlide)) {
    if (currentKey && currentKey === nextKey) return false;
    return shouldAppendMainPraiseElementBlank(slide, nextSlide, context);
  }
  return Boolean(currentKey && currentKey !== nextKey);
}

function shouldAppendMainPraiseElementBlank(slide, nextSlide, context = {}) {
  const serviceType = worshipAppServiceTypeId(context.service?.type_id || "");
  if ((serviceType === "sunday-first" || serviceType === "sunday-second")
    && presenterMainPraiseElementOrdinal(slide, context.slides) === 1
    && presenterMainPraiseElementOrdinal(nextSlide, context.slides) === 2) {
    return false;
  }
  return Boolean(presenterSlideElementGroupKey(slide) && presenterSlideElementGroupKey(nextSlide));
}

function presenterMainPraiseElementOrdinal(targetSlide, slides = []) {
  const targetKey = presenterSlideElementGroupKey(targetSlide);
  if (!targetKey || !Array.isArray(slides)) return 0;
  const keys = [];
  slides.forEach((slide) => {
    if (!isPresenterMainPraiseSlide(slide) || isPresenterPraiseSectionMarkerSlide(slide)) return;
    const key = presenterSlideElementGroupKey(slide);
    if (key && !keys.includes(key)) keys.push(key);
  });
  return keys.indexOf(targetKey) + 1;
}

function presenterSlideElementGroupKey(slide) {
  if (!slide) return "";
  return String(slide.elementId || slide.sectionId || slide.id || "").trim();
}

function presenterElementTrailingBlankSlide(slide, index, service = null) {
  const idBase = slide.id || slide.elementId || slide.sectionId || `slide:${index}`;
  const serviceChromakey = presenterServiceUsesChromakey(service);
  return {
    ...slide,
    id: `${idBase}:after-blank`,
    elementType: PRESENTER_ELEMENT_TYPES.BLANK,
    layout: PRESENTER_SLIDE_LAYOUTS.BLANK,
    type: "blank",
    title: "빈 화면",
    marker: "",
    formKey: "",
    segment: "",
    text: "",
    body: "",
    bodyText: "",
    assignee: "",
    sectionAssignee: "",
    sectionKey: "",
    sectionLabel: "",
    sectionTitle: "",
    sectionName: "",
    elementLabel: "",
    elementTitle: "",
    label: "",
    warnings: [],
    imageSrc: "",
    videoSrc: "",
    media: {},
    keynote: null,
    asset: {},
    sourceType: "",
    componentType: "",
    scoreBackground: false,
    // Do not carry scripture-reading metadata into a transition blank.
    scriptureContext: "",
    scriptureReadingFinal: false,
    referenceBook: "",
    referenceRange: "",
    translationLabel: "",
    suppressBackgroundImage: false,
    noBackgroundImage: false,
    // A transition blank belongs to the service output, never to the preceding element.
    // This keeps fullscreen services clean even when the preceding item has an explicit
    // chromakey context (for example a special-song element).
    outputContext: serviceChromakey ? "chromakey" : "clean",
    backgroundVideo: "",
    // Hiding an element hides its content, not its required transition blank.
    hiddenInPresentation: false,
    hidden_in_presentation: false,
    hidden: false,
    autoTrailingBlank: true,
    // A transition must never inherit the fullscreen song-title adapter.
    songTitle: "",
    songTitleContent: null,
    fullscreenSongTitle: false,
    fullscreenSongName: "",
    sectionHeading: "",
    subtitle: "",
    syncTimeline: null,
    songTimingKey: "",
    readyServiceName: "",
    sort: (Number(slide.sort) || index) + 0.009,
  };
}

function isPresenterPreparationSlide(slide) {
  if (presenterSlideLayout(slide) === PRESENTER_SLIDE_LAYOUTS.BLANK) return false;
  if (slide?.type === "ready" || slide?.sectionRole === "ready") return true;
  return /(?:예배\s*)?준비|대기/i.test(`${slide.sectionLabel || ""} ${slide.title || ""}`);
}

function presenterReadySlide(service) {
  const title = "준비";
  const serviceName = serviceDisplayTypeName(service) || "예배";
  const chromakey = presenterServiceUsesChromakey(service);
  return {
    id: `${service?.id || "service"}:ready`,
    sectionId: `${service?.id || "service"}:ready`,
    sectionIndex: 0,
    sectionLabel: "준비",
    sectionRole: "ready",
    sectionTitle: title,
    elementLabel: "준비",
    elementTitle: title,
    sectionName: title,
    elementType: chromakey ? PRESENTER_ELEMENT_TYPES.VIDEO : PRESENTER_ELEMENT_TYPES.IMAGE,
    layout: PRESENTER_SLIDE_LAYOUTS.MEDIA,
    type: "ready",
    label: "준비",
    title,
    marker: "",
    text: `잠시 후\n${serviceName}\n${presenterReadySubjectParticle(serviceName)} 시작됩니다`,
    videoSrc: chromakey ? PRESENTER_CHROMAKEY_READY_LOOP_VIDEO : "",
    readyServiceName: serviceName,
    outputContext: presenterServiceUsesChromakey(service) ? "chromakey" : "clean",
    sort: -1,
  };
}

function presenterSlideElementType(slide) {
  if (slide?.elementType) return slide.elementType;
  if (slide?.type === "title") return PRESENTER_ELEMENT_TYPES.TITLE;
  if (slide?.type === "title-content") return PRESENTER_ELEMENT_TYPES.TITLE_CONTENT;
  if (slide?.type === "lyrics" || slide?.type === "song-title") return PRESENTER_ELEMENT_TYPES.PRAISE;
  if (slide?.type === "video") return PRESENTER_ELEMENT_TYPES.VIDEO;
  if (slide?.type === "audio") return PRESENTER_ELEMENT_TYPES.AUDIO;
  if (slide?.type === "image") return PRESENTER_ELEMENT_TYPES.IMAGE;
  if (slide?.type === "file") return PRESENTER_ELEMENT_TYPES.FILE;
  if (slide?.type === "blank") return PRESENTER_ELEMENT_TYPES.BLANK;
  return PRESENTER_ELEMENT_TYPES.PLAIN_TEXT;
}

function presenterSlideLayout(slide) {
  if (slide?.layout) return slide.layout;
  if (slide?.type === "lyrics" || slide?.type === "song-title") return PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT;
  if (slide?.type === "video") return PRESENTER_SLIDE_LAYOUTS.MEDIA;
  if (slide?.type === "audio") return PRESENTER_SLIDE_LAYOUTS.FILE;
  if (slide?.type === "title") return PRESENTER_SLIDE_LAYOUTS.CENTER_TEXT;
  if (slide?.type === "image") return PRESENTER_SLIDE_LAYOUTS.MEDIA;
  if (slide?.type === "file") return PRESENTER_SLIDE_LAYOUTS.FILE;
  if (slide?.type === "blank") return PRESENTER_SLIDE_LAYOUTS.BLANK;
  return PRESENTER_SLIDE_LAYOUTS.CENTER_TEXT;
}

function presenterSlideOutputContext(slide, fallbackChromakey = true) {
  const explicit = normalizePresenterOutputContext(
    slide?.outputContext
    || slide?.output_context
    || slide?.presenterOutputContext
    || slide?.presenter_output_context
    || "",
  );
  if (explicit) return explicit;
  const layout = presenterSlideLayout(slide);
  const elementType = presenterSlideElementType(slide);
  if (slide?.live && elementType === PRESENTER_ELEMENT_TYPES.SCRIPTURE_TEXT) return "chromakey";
  if (layout === PRESENTER_SLIDE_LAYOUTS.BLANK) return fallbackChromakey ? "chromakey" : "clean";
  const scoreLike = slide?.sourceType === "score" || slide?.componentType === "score" || slide?.scoreBackground;
  if (scoreLike) return "clean";
  if (
    layout === PRESENTER_SLIDE_LAYOUTS.MEDIA
    || layout === PRESENTER_SLIDE_LAYOUTS.FILE
    || elementType === PRESENTER_ELEMENT_TYPES.IMAGE
    || elementType === PRESENTER_ELEMENT_TYPES.VIDEO
    || elementType === PRESENTER_ELEMENT_TYPES.FILE
    || elementType === PRESENTER_ELEMENT_TYPES.AUDIO
  ) {
    return "clean";
  }
  return fallbackChromakey ? "chromakey" : "clean";
}

function normalizePresenterOutputContext(value = "") {
  const key = compactSearchValue(value);
  if (!key) return "";
  if (["chromakey", "chroma", "key", "green", "greenkey", "크로마키"].includes(key)) return "chromakey";
  if (["clean", "fullscreen", "full", "media", "image", "video", "score", "nochromakey", "no-chromakey", "풀스크린", "전체화면"].includes(key)) return "clean";
  return "";
}

function presenterSlideRenderClass(slide) {
  const layout = presenterSlideLayout(slide);
  const elementType = presenterSlideElementType(slide);
  if (slide?.sourceType === "score" || slide?.componentType === "score" || slide?.scoreBackground) return "score";
  if (slide?.type === "ready" && presenterSlideOutputContext(slide, true) === "clean") return "ready";
  if (layout === PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT) {
    if (elementType === PRESENTER_ELEMENT_TYPES.SCRIPTURE_TEXT) return "scripture";
    if (elementType === PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE) return "title-assignee";
    return slide?.type === "song-title" ? "song-title" : "lyrics";
  }
  if (layout === PRESENTER_SLIDE_LAYOUTS.MEDIA) return elementType === PRESENTER_ELEMENT_TYPES.IMAGE ? "image" : "video";
  if (elementType === PRESENTER_ELEMENT_TYPES.AUDIO) return "file";
  if (layout === PRESENTER_SLIDE_LAYOUTS.FILE) return "file";
  if (layout === PRESENTER_SLIDE_LAYOUTS.BLANK) return "blank";
  if (slide?.type === "ready") return "ready";
  if (slide?.type === "title" || elementType === PRESENTER_ELEMENT_TYPES.TITLE) return "title";
  if (slide?.type === "liturgical-body") return "liturgical-body";
  if (presenterSlideIsTitleContent(slide)) return "title-content";
  if (elementType === PRESENTER_ELEMENT_TYPES.SCRIPTURE_TEXT || elementType === PRESENTER_ELEMENT_TYPES.BODY_TEXT) return "component";
  return "component";
}

const PRESENTER_SLIDE_MODEL_LAYOUT_COMPATIBILITY = Object.freeze({
  [PRESENTER_SLIDE_LAYOUTS.BLANK]: [PRESENTER_ELEMENT_TYPES.BLANK],
  [PRESENTER_SLIDE_LAYOUTS.CENTER_TEXT]: [
    PRESENTER_ELEMENT_TYPES.TITLE,
    PRESENTER_ELEMENT_TYPES.PLAIN_TEXT,
    PRESENTER_ELEMENT_TYPES.TITLE_CONTENT,
    PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE,
    PRESENTER_ELEMENT_TYPES.BODY_TEXT,
    PRESENTER_ELEMENT_TYPES.SCRIPTURE_READING,
    PRESENTER_ELEMENT_TYPES.SCRIPTURE_TEXT,
    PRESENTER_ELEMENT_TYPES.PRAISE,
    PRESENTER_ELEMENT_TYPES.FREEFORM,
  ],
  [PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT]: [
    PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE,
    PRESENTER_ELEMENT_TYPES.PRAISE,
    PRESENTER_ELEMENT_TYPES.SCRIPTURE_TEXT,
    PRESENTER_ELEMENT_TYPES.SCRIPTURE_READING,
    PRESENTER_ELEMENT_TYPES.PLAIN_TEXT,
    PRESENTER_ELEMENT_TYPES.BODY_TEXT,
    PRESENTER_ELEMENT_TYPES.FREEFORM,
  ],
  [PRESENTER_SLIDE_LAYOUTS.MEDIA]: [
    PRESENTER_ELEMENT_TYPES.IMAGE,
    PRESENTER_ELEMENT_TYPES.VIDEO,
  ],
  [PRESENTER_SLIDE_LAYOUTS.FILE]: [
    PRESENTER_ELEMENT_TYPES.AUDIO,
    PRESENTER_ELEMENT_TYPES.FILE,
    PRESENTER_ELEMENT_TYPES.FREEFORM,
  ],
});

function presenterSlideModelIssues(slide = {}) {
  const issues = [];
  const elementType = presenterSlideElementType(slide);
  const layout = presenterSlideLayout(slide);
  if (!Object.values(PRESENTER_ELEMENT_TYPES).includes(elementType)) {
    issues.push(`unknown elementType: ${elementType || "(empty)"}`);
  }
  if (!Object.values(PRESENTER_SLIDE_LAYOUTS).includes(layout)) {
    issues.push(`unknown layout: ${layout || "(empty)"}`);
  }
  const allowedElementTypes = PRESENTER_SLIDE_MODEL_LAYOUT_COMPATIBILITY[layout] || [];
  if (allowedElementTypes.length && !allowedElementTypes.includes(elementType)) {
    issues.push(`layout ${layout} cannot render elementType ${elementType}`);
  }
  if (layout === PRESENTER_SLIDE_LAYOUTS.BLANK) {
    const hasVisiblePayload = Boolean(
      String(slide.text || slide.body || slide.bodyText || "").trim()
      || slide.imageSrc
      || slide.videoSrc
      || slide.audioSrc
      || slide.asset?.url
    );
    if (hasVisiblePayload) issues.push("blank slide must not carry visible payload");
  }
  if (slide.missingContent && !String(slide.inputMode || "").trim()) {
    issues.push("missingContent slide must keep inputMode");
  }
  return issues;
}

function presenterSlideHasMeta(slide) {
  if (presenterSlideIsTitleContent(slide)) return false;
  if (slide?.type === "liturgical-body") return false;
  return presenterSlideLayout(slide) === PRESENTER_SLIDE_LAYOUTS.CENTER_TEXT && slide?.type !== "ready";
}

function presenterElementTypeSupportsTitleContent(elementType) {
  return [
    PRESENTER_ELEMENT_TYPES.PLAIN_TEXT,
    PRESENTER_ELEMENT_TYPES.TITLE_CONTENT,
    PRESENTER_ELEMENT_TYPES.BODY_TEXT,
    PRESENTER_ELEMENT_TYPES.FREEFORM,
  ].includes(elementType);
}

function presenterSlideIsTitleContent(slide) {
  if (!slide || presenterSlideLayout(slide) !== PRESENTER_SLIDE_LAYOUTS.CENTER_TEXT) return false;
  if (slide.type === "title-content") return true;
  const elementType = presenterSlideElementType(slide);
  if (!presenterElementTypeSupportsTitleContent(elementType)) return false;
  const title = String(slide.title || "").trim();
  const body = presenterTitleContentBodyText(slide);
  if (!title || !body) return false;
  return normalizeTitle(title) !== normalizeTitle(body);
}

function presenterFixedTitleText(item = {}) {
  if (isAnnouncementTextInputItem(item)) return "";
  const memo = parseServiceItemMemo(item.memo);
  if (serviceMemoElementType(memo) === "title" && String(item.label || "").trim()) {
    return independentServiceContentTitle(item.label, item.raw_title || item.title, "title") || String(item.label).trim();
  }
  const label = compactSearchValue(item?.label || item?.raw_title || "");
  const sectionKey = String(item?._worshipSectionKey || item?.sectionKey || item?.section_key || "").trim();
  if (sectionKey === "confession" && label === "사죄의선언") return "사죄의 선언";
  if (sectionKey === "announcements" && ["교회소식", "광고"].includes(label)) return "교회소식";
  if (sectionKey === "announcements" && label === "새가족환영") return "새가족환영";
  if (sectionKey === "response_song" && label === "결단기도") return "결단기도";
  if (sectionKey === "prayer_meeting" || label === "기도회" || label === "통성기도") return "통성기도";
  if (sectionKey === "free_prayer" || label === "자율기도") return "자율기도";
  if (sectionKey === "fellowship" && label === "반별모임") return "반별 모임";
  return "";
}

function serviceItemsAreHydrating(serviceId = "") {
  const id = String(serviceId || "").trim();
  if (!id || state.loadedWorshipServiceIds.has(id)) return false;
  return state.loading || serviceItemLoadPromises.has(id) || isServiceDataModule();
}

function resolvePresenterServiceItemContentState(item = {}, memo = emptyServiceItemMemo(), song = null, service = null) {
  const effectiveItem = serviceItemWithSharedSundayContent(item, service);
  if (effectiveItem !== item) {
    item = effectiveItem;
    memo = parseServiceItemMemo(item.memo);
    song = serviceItemLinkedSong(item);
  }
  const elementType = serviceMemoElementType(memo);
  const inputMode = serviceMemoInputMode(memo, item);
  const praiseInputMode = isSongServiceLabel(item?.label) || isSpecialSongServiceItem(item)
    ? servicePraiseInputMode(item, memo, service)
    : "";
  const requiresSongSelection = serviceItemRequiresSongSelection(item, service);
  const effectiveInputMode = praiseInputMode || (requiresSongSelection ? "praise_db" : inputMode);
  const rawText = String(item?.raw_title || item?.title || "").trim();
  const labelKey = compactSearchValue(item?.label || "");
  const titlePersonParts = serviceMemoElementType(memo) === "title_person"
    ? serviceTitlePersonEffectiveParts(item, memo, service)
    : null;
  const assignee = titlePersonParts?.assignee || cleanServiceAssignee(item?.assignee);
  const asset = normalizeServiceAsset(memo?.asset);
  const hasCustomSlideText = (memo.slides || []).some((slide) => String(slide || "").trim());
  const hasScriptureInput = isScriptureBodyServiceItem(item)
    && Boolean(serviceItemScriptureReferences(item, memo, service).length || serviceScriptureTextPayload(item, memo, service).verses.length);
  const result = (stateName, hasOutputContent, reason) => ({
    state: stateName,
    hasOutputContent,
    reason,
    elementType,
    inputMode: effectiveInputMode,
    required: stateName === "missing",
  });
  const filled = (reason) => result("filled", true, reason);
  const missing = (reason) => result("missing", false, reason);
  const loading = (reason) => result("loading", false, reason);
  if (serviceItemPresentationHidden(item, memo)) return filled("hidden_in_presentation");
  if (presenterFixedTitleText(item)) return filled("fixed_title");
  if (isConfessionPrayerServiceItem(item)) return filled("confession_title");
  if (elementType === "title_content" && labelKey === "환영") return filled("title_content");
  if (isLiturgicalBodyServiceItem(item)) {
    return liturgicalBodyText(item, memo, rawText, service) ? filled("liturgical_body") : missing("liturgical_body_empty");
  }
  if (isPublicClosingImageServiceItem(item, memo)) return filled("closing_visual_asset");
  if (isPublicFixedDoxologyServiceItem(item, memo, service)) return filled("fixed_doxology");
  if (isOptionalCitationScriptureServiceItem(item) && !serviceItemScriptureReferences(item, memo, service).length) {
    return filled("optional_citation_empty");
  }
  if (elementType === "title_person") {
    const textInputState = presenterServiceRequiredTextInputState(
      item,
      serviceItemEditorModel(item, { service }),
      memo,
      service,
    );
    if (textInputState.complete) return filled("title_person");
    if (item?._worshipTemplatePlaceholder && serviceItemsAreHydrating(service?.id)) {
      return loading("service_items_hydrating");
    }
    return missing(textInputState.missingReason);
  }
  if (item?._worshipTemplatePlaceholder
    && !rawText
    && !hasServiceAsset(asset)
    && !hasCustomSlideText
    && !hasScriptureInput) {
    return serviceItemsAreHydrating(service?.id)
      ? loading("service_items_hydrating")
      : missing("template_placeholder");
  }
  if (isScriptureBodyServiceItem(item)) {
    return hasScriptureInput ? filled("scripture_body") : missing(rawText ? "scripture_reference_invalid" : "scripture_body_empty");
  }
  if (elementType === "blank") return filled("blank");
  if (elementType === "live_scripture" && compactSearchValue(item?.label || "").includes("실시간성구송출")) return filled("live_scripture");
  if (inputMode === "asset") {
    return hasServiceAssetContent(asset) ? filled("asset") : missing("asset_empty");
  }
  if (["praise_db", "score_db", "lyrics_db", "children_audio"].includes(effectiveInputMode) || requiresSongSelection) {
    if (item?.song_id && !song && songNeedsRelationalHydration(item.song_id)) return loading("song_hydrating");
    if (serviceItemNeedsVersionChoice(item)) return missing("song_version_required");
    if (song && !serviceItemSongSelectionInvalid(item, service, song)) return filled("song");
    if (item?.song_id && !serviceItemSongSelectionInvalid(item, service, song)) return filled("song");
    if (!requiresSongSelection && (rawText || hasCustomSlideText)) return filled("manual_praise");
    return missing(rawText ? "song_selection_required" : "song_empty");
  }
  if (servicePraiseUsesDirectLyrics(effectiveInputMode)) {
    return rawText || hasCustomSlideText ? filled("manual_praise") : missing("manual_praise_empty");
  }
  if (inputMode === "scripture") {
    return serviceItemScriptureReferences(item, memo, service).length || serviceScriptureTextPayload(item, memo, service).verses.length
      ? filled("scripture_reference")
      : missing(rawText ? "scripture_reference_invalid" : "scripture_empty");
  }
  if (song || item?.song_id) return filled("song");
  if (rawText) return filled("raw_title");
  if (assignee) return filled("assignee");
  if (hasServiceAsset(asset)) return filled("asset");
  if (hasCustomSlideText) return filled("custom_slides");
  if (presenterMemoElementIsTitleSlide(elementType)) {
    const title = presenterTitleAssigneeTitle(item, item?.label || "", "", elementType);
    const person = presenterTitleAssigneePerson(item, item?.label || "", "", title, service);
    return (title || person) ? filled("title_slide") : missing("title_slide_empty");
  }
  return missing("empty");
}

function presenterMissingContentSlide(item = {}, section = {}, index = 0, contentState = null, service = null) {
  const label = serviceElementDisplayLabel(item.label || section.elementLabel || section.sectionLabel || "항목");
  // A missing item must identify the actionable element, never its grouping section.
  const title = label || "항목";
  const loading = contentState?.state === "loading";
  const warning = loading ? "불러오는 중" : "입력 필요";
  const cleanSongLike = service
    && !presenterServiceUsesChromakey(service)
    && (isSongServiceLabel(label) || isSpecialSongServiceItem(item));
  if (cleanSongLike) {
    const sectionHeading = presenterSongTitleSectionHeading(item, section);
    return {
      id: `${item.id || index}:${loading ? "loading-content" : "missing-content"}`,
      ...section,
      elementLabel: label,
      elementTitle: title,
      elementType: PRESENTER_ELEMENT_TYPES.PRAISE,
      layout: PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,
      type: "song-title",
      label,
      title: warning,
      marker: "",
      sectionHeading,
      text: warning,
      warnings: [warning],
      missingContent: !loading,
      loadingContent: loading,
      missingReason: contentState?.reason || "",
      inputMode: contentState?.inputMode || "",
      contentState: contentState?.state || "missing",
      outputContext: "clean",
      skipTrailingBlank: true,
      sort: index,
    };
  }
  return {
    id: `${item.id || index}:${loading ? "loading-content" : "missing-content"}`,
    ...section,
    elementLabel: label,
    elementTitle: title,
    elementType: PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE,
    layout: PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,
    type: "title-assignee",
    label,
    title,
    assignee: loading ? warning : String(item.assignee || item.person || "").trim(),
    marker: "",
    text: cleanList([title, loading ? warning : String(item.assignee || item.person || "").trim()]).join("\n"),
    warnings: [warning],
    missingContent: !loading,
    loadingContent: loading,
    missingReason: contentState?.reason || "",
    inputMode: contentState?.inputMode || "",
    contentState: contentState?.state || "missing",
    skipTrailingBlank: true,
    sort: index,
  };
}

function presenterOptionalCitationLiveControlSlide(item = {}, section = {}, index = 0) {
  const label = String(item.label || "인용 구절").trim() || "인용 구절";
  return {
    id: `${item.id || index}:live-scripture-control`,
    ...section,
    slotKey: serviceItemSlotKey(item),
    elementLabel: label,
    elementTitle: label,
    elementType: PRESENTER_ELEMENT_TYPES.BLANK,
    layout: PRESENTER_SLIDE_LAYOUTS.BLANK,
    type: "blank",
    label,
    title: "빈 화면",
    marker: "",
    text: "",
    liveScriptureControl: true,
    citationQuickInsert: true,
    skipTrailingBlank: true,
    sort: index,
  };
}

function presenterReferenceMediaPendingSlide(item = {}, section = {}, index = 0) {
  // Keep a newly added reference screen reachable in the controller before its
  // first file is attached. It remains hidden from the live output until then.
  const label = String(item.label || "참고 화면").trim() || "참고 화면";
  return {
    id: `${item.id || index}:reference-media-pending`,
    ...section,
    elementId: item.id || section.elementId || "",
    elementLabel: label,
    elementTitle: label,
    elementType: PRESENTER_ELEMENT_TYPES.BLANK,
    layout: PRESENTER_SLIDE_LAYOUTS.BLANK,
    type: "blank",
    label,
    title: label,
    marker: "",
    text: "",
    referenceMediaPending: true,
    hiddenInPresentation: true,
    skipTrailingBlank: true,
    sort: index,
  };
}

function buildPresenterSlidesForServiceItem(item, service, index, options = {}) {
  item = serviceItemWithSharedSundayContent(item, service);
  const initialMemo = parseServiceItemMemo(item?.memo);
  if (isPublicFixedDoxologyServiceItem(item, initialMemo, service) && !item?._worshipElementTemplateModified) {
    item = { ...item, raw_title: publicFixedDoxologyDisplayText(service) };
  }
  const label = item.label || "";
  const displayText = serviceItemDisplayText(item);
  const song = presenterSongForServiceItem(item, displayText, label, service);
  const version = song ? getPresenterServiceItemVersion(song, item, service) : null;
  const formPlan = version ? presenterFormPlanForServiceItem(version, item, song) : { forms: [], warnings: [] };
  const explicitTitleSequence = serviceItemFormPreset(item)?.titleSequence;
  const titleForms = formPlan.forms.filter(form => form._presenterTitle);
  const contentForms = formPlan.forms.filter(form => !form._presenterTitle);
  const forms = explicitTitleSequence ? formPlan.forms
    : [...titleForms, ...(globalThis.MindexSongTiming?.formsFor(item, song, version, contentForms) || contentForms)];
  const formWarnings = formPlan.warnings;
  const memo = initialMemo;
  const linkedSongId = String(item.song_id || item.songId || "").trim();
  const templateOwnedScoreSong = isPublicFixedDoxologyServiceItem(item, memo, service);
  if (isPublicClosingImageServiceItem(item, memo) && !hasServiceAsset(memo.asset)) {
    memo.asset = { ...PUBLIC_WORSHIP_CLOSING_IMAGE_ASSET };
  }
  const memoElementType = serviceMemoElementType(memo);
  const outputMode = serviceItemOutputMode(item, memo);
  const configuredAsset = presenterKeynoteHtmlDeckAsset(normalizeServiceAsset(memo.asset || item.asset), service.id);
  if (isServicePreparationItemForEditor(item, memo)) {
    return [presenterPreparationSlide(service, item, index)];
  }
  const confessionPrayer = isConfessionPrayerServiceItem(item);
  const section = presenterSectionForServiceItem(item, index, displayText, song, version);
  const presentation = normalizeServicePresentation(memo.presentation);

  if (memoElementType === "praise" && presentation?.backgroundVideo) section.backgroundVideo = presentation.backgroundVideo;
  const withIntro = (slides) => presenterSlidesWithIntroSlide(item, section, index, memo,
    memoElementType === "praise"
      ? presenterSlidesWithSongContentHeading(item, section, song, version, displayText, index, slides)
      : slides);
  const withSpecialTitle = (slides) => presenterSlidesWithSpecialSongTitle(item, section, slides, index, service);
  const withIntroAndSpecialTitle = (slides) => withIntro(withSpecialTitle(slides));
  const specialSongItem = isSpecialSongServiceItem(item);
  const songLikeItem = isSongServiceLabel(label) || specialSongItem;
  const explicitSpecialSongAsset = specialSongItem ? normalizeServiceAsset(memo.asset || item.asset) : null;
  if (specialSongItem && hasServiceAsset(explicitSpecialSongAsset)) {
    const assetSlides = presenterScoreSlidesForServiceItem(item, section, index, song, version, displayText, memo, forms, formWarnings);
    if (assetSlides.length) {
      // Fully designed special-song image decks already include their title/text.
      return withIntro(assetSlides);
    }
  }
  const contentState = resolvePresenterServiceItemContentState(item, memo, song, service);
  const fixedTitle = presenterFixedTitleText(item);
  if (fixedTitle) return [presenterTitleOnlySlide(item, section, index, fixedTitle)];
  const monthlyCorporatePrayerSlides = presenterMonthlyCorporatePrayerSlides(item, section, index, memo);
  if (monthlyCorporatePrayerSlides.length) return monthlyCorporatePrayerSlides;
  if (contentState.state === "loading") return withIntroAndSpecialTitle([presenterMissingContentSlide(item, section, index, contentState, service)]);
  if (isOptionalCitationScriptureServiceItem(item)) {
    const scriptureTextSlides = buildPresenterScriptureTextSlides(item, section, index, service);
    if (scriptureTextSlides.length) {
      return [...scriptureTextSlides, presenterOptionalCitationLiveControlSlide(item, section, index)];
    }
    // Keep one reachable blank slide while a referenced citation is loading.
    // It is also the permanent entry point for live citations.
    if (service?.id && options.allowHydration !== false) {
      const sourceIndex = getServiceItems(service.id).findIndex((candidate) => String(candidate?.id || "") === String(item?.id || ""));
      scheduleServiceScriptureBodyResolveWithOptions(service.id, sourceIndex >= 0 ? sourceIndex : index, {
        markDirty: false,
        renderControls: false,
      });
    }
    return [presenterOptionalCitationLiveControlSlide(item, section, index)];
  }
  if (!confessionPrayer && !contentState.hasOutputContent) {
    if (isPresenterReferenceMediaItem(item, memo)) {
      return [presenterReferenceMediaPendingSlide(item, section, index)];
    }
    return withIntroAndSpecialTitle([presenterMissingContentSlide(item, section, index, contentState, service)]);
  }
  if (confessionPrayer) return [presenterConfessionPrayerSlide(item, section, index)];
  if (memoElementType === "title") return withIntroAndSpecialTitle([presenterTitleOnlySlide(item, section, index, displayText || label || "제목")]);
  if (memoElementType === "title_content") {
    const titleContentSlide = presenterElementSlideFromMemo(item, section, index, memo, displayText, service);
    if (Array.isArray(titleContentSlide)) return withIntroAndSpecialTitle(titleContentSlide);
    if (titleContentSlide) return withIntroAndSpecialTitle([titleContentSlide]);
  }
  if (isScriptureBodyServiceItem(item)) {
    const scriptureTextSlides = buildPresenterScriptureTextSlides(item, section, index, service);
    if (scriptureTextSlides.length) {
      return withIntroAndSpecialTitle(presenterSlidesWithScriptureReadingTitle(item, section, scriptureTextSlides, index, service));
    }
    // Keep the element present while the async Bible lookup hydrates its verses.
    // The same item is rebuilt in place as soon as the lookup completes.
    if (service?.id && options.allowHydration !== false) {
      const sourceIndex = getServiceItems(service.id).findIndex((candidate) => String(candidate?.id || "") === String(item?.id || ""));
      scheduleServiceScriptureBodyResolveWithOptions(service.id, sourceIndex >= 0 ? sourceIndex : index, {
        markDirty: false,
        renderControls: false,
      });
    }
    const pendingSlide = presenterPendingScriptureSlide(item, section, index, service);
    return pendingSlide
      ? withIntroAndSpecialTitle(presenterSlidesWithScriptureReadingTitle(item, section, [pendingSlide], index, service))
      : [];
  }
  const liturgicalSlides = buildPresenterLiturgicalBodySlides(item, section, index, service, memo, displayText);
  if (liturgicalSlides.length) return withIntroAndSpecialTitle(liturgicalSlides);
  const importedDeckSlides = presenterImportedDeckSlidesFromAsset(
    configuredAsset,
    item,
    section,
    index,
    configuredAsset.name || displayText || label || "자료",
    label || section.sectionLabel || "자료",
  );
  if (importedDeckSlides.length) return withIntroAndSpecialTitle(importedDeckSlides);
  const elementSlide = presenterElementSlideFromMemo(item, section, index, memo, displayText, service);
  if (Array.isArray(elementSlide)) return withIntroAndSpecialTitle(elementSlide);
  if (elementSlide) return withIntroAndSpecialTitle([elementSlide]);
  const videoSrc = presenterVideoSourceFromServiceItem(item, displayText);

  if (videoSrc) {
    const videoTitle = label || "Video";
    return withIntroAndSpecialTitle([{
      id: `${item.id || index}:video`,
      ...section,
      sectionLabel: label || "Video",
      sectionTitle: videoTitle,
      sectionName: videoTitle,
      elementType: PRESENTER_ELEMENT_TYPES.VIDEO,
      layout: PRESENTER_SLIDE_LAYOUTS.MEDIA,
      type: "video",
      label,
      title: videoTitle,
      marker: label || "Video",
      text: videoTitle,
      videoSrc,
      playback: presenterPlaybackConfig(memo.playback, "video"),
      sourceType: "video",
      componentType: "video",
      sort: index,
    }]);
  }

  if (serviceItemNeedsVersionChoice(item)) return [];
  if (serviceItemRequiresSongSelection(item, service) && (!song || serviceItemSongSelectionInvalid(item, service, song))) return [];

  const customSlides = buildPresenterCustomSlides(item, section, index);
  if (customSlides.length) return withIntroAndSpecialTitle(customSlides);

  const scoreOutput = !specialSongItem && outputMode === "score";
  if (scoreOutput && !linkedSongId && !song && !templateOwnedScoreSong) {
    return [];
  }
  if (scoreOutput) {
    if (!song) return [];
    if (presenterServiceItemScoreManifestPending(item, song, memo)) {
      return withIntro([presenterMissingContentSlide(item, section, index, {
        ...contentState, state: "loading", hasOutputContent: false, reason: "hymn_score_loading",
      }, service)]);
    }
    const scoreSlides = presenterScoreSlidesForServiceItem(item, section, index, song, version, displayText, memo, forms, formWarnings);
    const slides = scoreSlides;
    return withIntro(presenterSlidesWithSpecialSongTitle(item, section, slides, index, service));
  }

  if (song && forms.length) {
    const lyricsSlides = presenterLyricsSlidesForServiceItem({
      item, section, index, song, version, displayText, label, forms, formWarnings,
    });
    const syncConfig = presenterSyncedLyricsConfigFromAsset(configuredAsset);
    const slides = presenterSlidesWithSpecialSongTitle(item, section, lyricsSlides, index, service);
    const syncedSlides = presenterApplySyncedLyricsConfig(slides, syncConfig, item, index);
    return withIntro(globalThis.MindexSongTiming?.decorate(syncedSlides, item, song, version) || syncedSlides);
  }

  if (!specialSongItem && song && presenterHymnScoreAssetSlides(song, version, displayText).length) {
    const scoreSlides = presenterScoreSlidesForServiceItem(item, section, index, song, version, displayText, memo, forms, formWarnings);
    const slides = scoreSlides;
    return withIntro(presenterSlidesWithSpecialSongTitle(item, section, slides, index, service));
  }

  const { no, title } = splitHymnNo(displayText);
  if (scoreOutput && !song && !templateOwnedScoreSong) return [];
  if (!songLikeItem) return [];
  if (serviceItemNeedsVersionChoice(item)) return [];
  if (serviceItemRequiresSongSelection(item, service) && (!song || serviceItemSongSelectionInvalid(item, service, song))) return [];
  const sectionHeading = presenterSongTitleSectionHeading(item, section);
  return withIntro(presenterSlidesWithSpecialSongTitle(item, section, [{
    id: `${item.id || index}:title`,
    ...section,
    elementType: songLikeItem ? PRESENTER_ELEMENT_TYPES.PRAISE : PRESENTER_ELEMENT_TYPES.PLAIN_TEXT,
    layout: songLikeItem ? PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT : PRESENTER_SLIDE_LAYOUTS.CENTER_TEXT,
    type: songLikeItem ? "song-title" : "component",
    label,
    title,
    marker: no || "",
    sectionHeading,
    text: formatPresenterSongTitleText(presenterSongTitleDisplayTitle(null, null, displayText, sectionHeading)),
    sort: index,
  }], index, service));
}

function presenterMonthlyCorporatePrayerSlides(item = {}, section = {}, index = 0, memo = emptyServiceItemMemo()) {
  if (section.sectionKey !== "corporate_prayer") return [];
  if (!isMonthlyCorporatePrayerGroupItem(item, memo)) return [];
  const label = String(item.label || section.elementLabel || "").trim();
  const ordinals = label.match(/\d+/g)?.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0) || [];
  if (!ordinals.length) return [];
  const prayers = monthlyCorporatePrayerEntries(item, memo);
  const topics = prayers.map((prayer) => prayer.title);
  if (!topics.length) return [];
  const topicSlides = topics.map((topic, topicIndex) => {
    const ordinal = ordinals[topicIndex] || ordinals[0] + topicIndex;
    const title = presenterCorporatePrayerTopicTitle(topic);
    return {
      id: `${item.id || index}:corporate-prayer-topic:${ordinal}`,
      ...section,
      elementType: PRESENTER_ELEMENT_TYPES.TITLE_ASSIGNEE,
      layout: PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,
      type: "title-assignee",
      label,
      title,
      assignee: prayers[topicIndex].assignee,
      marker: "",
      text: cleanList([title, prayers[topicIndex].assignee]).join("\n"),
      sort: index + topicIndex / 100,
    };
  });
  return topicSlides;
}

function presenterCorporatePrayerTopicTitle(value = "") {
  const topic = String(value || "").trim();
  if (!topic) return "";
  return /^['"“”‘’].*['"“”‘’]$/u.test(topic) ? topic : `'${topic}'`;
}


function presenterElementSlideFromMemo(item, section, index, memo, displayText, service = null) {
  return presenterElementSlideFromMemoCore(item, section, index, memo, displayText, service);
}

function initPresenterOutput() {
  return initPresenterOutputCore();
}

async function createService() {
  if (!state.newServiceForm || !requireClient() || state.saving) return;
  const form = state.newServiceForm;
  const typeId = form.type_id || state.selectedServiceTypeId;
  const date = String(form.date || "").trim();
  if (!typeId || !date) {
    showToast("예배 날짜를 입력해 주세요.", "error");
    return;
  }

  const serviceId = createUuid();
  const persistedAt = new Date().toISOString();
  const servicePayload = {
    id: serviceId,
    service_type_id: canonicalWorshipServiceTypeId(typeId),
    service_date: date,
    created_at: persistedAt,
    updated_at: persistedAt,
    title: "",
    status: "draft",
    worship_leader: "",
    praise_leader: serviceUsesPraiseLeader(typeId) ? String(form.leader || "").trim() : "",
    source_kind: "mindex",
    source_ref: { created_from: "mindex_template", app_service_type_id: typeId },
    notes: "",
  };
  if (state.serviceAliasSupported) servicePayload.service_alias = String(form.alias || "").trim();
  state.saving = true;
  updateSaveState();
  try {
    const [serviceRow] = await insertWorshipServicesWithCalendarAssignees([servicePayload]);

    const service = normalizeWorshipService(serviceRow || servicePayload);
    state.services = sortServicesByDate([service, ...state.services]);
    state.serviceItems[service.id] = projectWorshipServiceItemsFromTemplate(service, state.serviceItems[service.id] || []);
    state.selectedServiceTypeId = service.type_id;
    state.selectedServiceId = service.id;
    state.selectedServiceItemIndex = 0;
    state.newServiceForm = null;
    state.dirty.service = false;
    captureCleanFingerprint("service");
    renderServiceList();
    renderCurrentServiceModuleDetail();
    syncBrowserHistory();
    showToast("예배를 추가했습니다.");
  } catch (error) {
    showToast(error.message || "예배 추가 실패.", "error");
  } finally {
    state.saving = false;
    updateSaveState();
  }
}

async function deleteService(serviceId) {
  if (!serviceId || !requireClient() || state.saving) return;
  const service = state.services.find((svc) => svc.id === serviceId);
  if (!service) return;
  const title = [formatServiceDate(service), serviceDisplayTypeName(service)]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" · ") || "이 예배";
  if (!window.confirm(`${title}을(를) 삭제할까요?`)) return;

  state.saving = true;
  updateSaveState();
  try {
    await ensureWorshipServiceRowsLoadedForPersistence(serviceId);
    await captureWorshipRecoverySnapshot(service, "before-service-delete");
    const cachedSections = state.worshipSections.filter((section) => section.service_id === serviceId);
    const sectionIds = cachedSections.map(section => section.id);
    const atomic = await worshipAtomicClient();
    await atomic.remove(serviceId);

    const removedSectionIds = new Set(sectionIds);
    state.services = state.services.filter((svc) => svc.id !== serviceId);
    state.worshipSections = state.worshipSections.filter((section) => section.service_id !== serviceId);
    state.worshipElements = state.worshipElements.filter((element) => !removedSectionIds.has(element.section_id));
    delete state.serviceItems[serviceId];
    state.loadedWorshipServiceIds.delete(serviceId);
    delete state.presenterPreparationDrafts[serviceId];
    state.presenterPreparationApplyingServiceIds.delete(serviceId);
    [...state.templateElementSuppressions.keys()].forEach((key) => {
      if (state.templateElementSuppressions.get(key)?.service_id === serviceId) state.templateElementSuppressions.delete(key);
    });

    if (state.selectedServiceId === serviceId) {
      state.selectedServiceId = null;
      state.selectedServiceItemIndex = null;
      state.newServiceForm = null;
      state.dirty.service = false;
      captureCleanFingerprint("service");
    }
    if (state.presenter.serviceId === serviceId) {
      state.presenter.viewServiceId = "";
      state.presenter.serviceId = null;
      state.presenter.slides = [];
      state.presenter.sourceItems = null;
      state.presenter.sourceSignature = "";
      state.presenter.index = 0;
      state.presenter.safetyBlank = false;
      state.presenter.jumpDraft = "";
      state.presenter.liveScripture = { reference: "", draft: "", active: false, slide: null };
      state.presenter.livePraise = emptyLivePraiseState();
      publishPresenterPayload(presenterStoppedPayload());
      stopServiceMusicPlayback({ clearSource: true, mode: "manual", render: false });
    }
    if (state.presenterBulletinServiceId === serviceId) state.presenterBulletinServiceId = null;
    if (state.servicePrepEditorOpenId === serviceId) state.servicePrepEditorOpenId = null;

    renderServiceList();
    renderCurrentServiceModuleDetail();
    syncBrowserHistory();
    showToast("예배를 삭제했습니다.");
  } catch (error) {
    showToast(error.message || "예배 삭제 실패.", "error");
  } finally {
    state.saving = false;
    updateSaveState();
  }
}

function selectService(id) {
  if (serviceNavigationBlocked(id)) return;
  if (state.module === "home") {
    void openServiceInPresenter(id);
    return;
  }
  window.MINDEX_SERVICE_ENTRY?.invalidate();
  // Reselecting is not navigation: retain the live editor, selection and clean baseline.
  if (id && id === state.selectedServiceId && ["service", "presenter"].includes(state.module)) {
    void window.MINDEX_SERVICE_ENTRY?.enter(id);
    return;
  }
  if (id !== state.selectedServiceId && !confirmDiscardServiceChanges()) return;
  rememberSetlistArchiveHistory();
  if (state.module === "setlists") {
    void openServiceInPresenter(id);
    return;
  }
  markWorshipServiceExplicitlyRequested(id);
  if (state.module === "presenter") state.presenter.viewServiceId = id;
  state.selectedServiceId = id;
  state.selectedServiceItemIndex = 0;
  const service = state.services.find((svc) => svc.id === id);
  if (service) state.selectedServiceTypeId = service.type_id;
  if (state.loadedWorshipServiceIds.has(id)) captureCleanFingerprint("service");
  renderCurrentServiceModuleDetail();
  renderServiceList();
  syncBrowserHistory();
  if (id) void loadServiceItems(id).then(() => window.MINDEX_SERVICE_ENTRY?.enter(id)).catch(() => {});
}

async function openHomeNextService(action = "presenter", serviceId = "") {
  const id = serviceId || getHomeNextService()?.id;
  if (!id) {
    showToast("준비된 다음 예배가 없습니다.", "info");
    return;
  }
  if (serviceNavigationBlocked(id)) return;
  markWorshipServiceExplicitlyRequested(id);
  if (action === "presenter") {
    await openServiceInPresenter(id);
    return;
  }
  await openServiceInPresenter(id);
  if (state.selectedServiceId !== id || !["service", "presenter"].includes(state.module)) return;
  const sourcePanel = refs.detailPane.querySelector(".svc-source-panel");
  const sourceInput = sourcePanel?.querySelector("[data-service-source-text]");
  if (sourceInput?.dataset.serviceSourceText !== id) return;
  sourcePanel.open = true;
  sourcePanel.scrollIntoView({ block: "start" });
  sourceInput.focus({ preventScroll: true });
}

async function openServiceInPresenter(id) {
  if (!id) return;
  if (serviceNavigationBlocked(id)) return;
  window.MINDEX_SERVICE_ENTRY?.invalidate();
  if (state.module === "presenter" && id === state.selectedServiceId && id === presenterViewServiceId()) {
    await window.MINDEX_SERVICE_ENTRY?.enter(id);
    return;
  }
  if (id !== state.selectedServiceId && !confirmDiscardServiceChanges()) return;
  window.MINDEX_PRELOAD_PRESENTER_FONTS?.();
  markWorshipServiceExplicitlyRequested(id);
  state.presenter.viewServiceId = id;
  state.selectedServiceId = id;
  state.selectedServiceItemIndex = 0;
  const service = state.services.find((svc) => svc.id === id);
  if (service) state.selectedServiceTypeId = service.type_id;
  if (state.module === "presenter") {
    // switchModule() returns early for the current module, which would leave the old screen and URL.
    persistUiState();
    render();
    syncBrowserHistory();
    await loadServiceItems(id);
    await window.MINDEX_SERVICE_ENTRY?.enter(id);
    return;
  }
  await switchModule("presenter", { clearSearch: false });
  await loadServiceItems(id);
  await window.MINDEX_SERVICE_ENTRY?.enter(id);
}

