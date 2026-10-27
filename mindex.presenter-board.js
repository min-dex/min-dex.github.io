function renderPresenterSlideBoard(slides, index, serviceId) {
  if (!slides.length) {
    return `<div class="svc-slide-board svc-slide-board--empty">슬라이드 없음</div>`;
  }
  const groups = groupPresenterSlidesBySection(slides, serviceId);
  const service = state.services.find((svc) => svc.id === serviceId);
  const nextTarget = nextPreparationTarget(service);
  const theme = presenterOutputTheme(service?.type_id);
  const chromakey = presenterServiceUsesChromakey(service);
  const deferredGroups = presenterDeferredBoardGroupIndexes(groups, index, slides.length);
  return `
    <div class="svc-slide-board svc-slide-board--${escapeAttr(theme)}${chromakey ? "" : " svc-slide-board--clean"}" role="list" aria-label="Presenter slide board">
      ${groups.map((group, groupIndex) => {
        return deferredGroups.has(groupIndex)
          ? renderDeferredPresenterBoardSection(group, serviceId, groupIndex)
          : renderPresenterBoardSection(group, index, serviceId);
      }).join("")}
      ${renderPresenterNextPreparationButton(serviceId, nextTarget)}
    </div>`;
}

function presenterDeferredBoardGroupIndexes(groups = [], activeIndex = -1, slideCount = 0) {
  // Chrome stalls when image-heavy services render every miniature slide at once.
  // Keep the first groups interactive, then hydrate off-screen groups on demand.
  if (slideCount < 80 || groups.length < 4) return new Set();
  const immediate = new Set([0, 1]);
  const activeGroupIndex = groups.findIndex((group) =>
    group.slides.some(({ slideIndex }) => slideIndex === activeIndex));
  if (activeGroupIndex >= 0) immediate.add(activeGroupIndex);
  return new Set(groups.map((_, index) => index).filter((index) => !immediate.has(index)));
}

function renderDeferredPresenterBoardSection(group, serviceId, groupIndex) {
  if (group.slides.some(({ slide }) => slide.controllerEditorOnly)) {
    return renderPresenterBoardSection(group, -1, serviceId);
  }
  const firstIndex = group.slides.find(({ slideIndex }) => slideIndex >= 0)?.slideIndex ?? -1;
  const visibleTitle = group.title || group.label || group.name;
  const interactionLabel = presenterSlideInteractionHint(serviceId, group.name || visibleTitle);
  const referenceMediaSectionKey = presenterBoardReferenceMediaSectionKey(group, serviceId);
  const referenceMediaQuickAdd = referenceMediaSectionKey
    ? renderPresenterReferenceMediaQuickAdd(referenceMediaSectionKey, serviceId)
    : "";
  const estimatedRows = Math.max(1, Math.ceil(group.slides.length / 5));
  const estimatedHeight = 52 + estimatedRows * 146;
  return `
    <section class="svc-board-section svc-board-section--deferred" role="listitem" data-presenter-section-key="${escapeAttr(group.id)}"
      data-presenter-deferred-board-section
      data-service-id="${escapeAttr(serviceId)}"
      data-presenter-board-group-index="${groupIndex}"
      aria-label="${escapeAttr(group.name)}"
      style="--svc-deferred-board-height:${estimatedHeight}px;--svc-deferred-slide-count:${group.slides.length}">
      <div class="svc-board-section-head-row">
        <button class="svc-board-section-head" type="button"
          data-presenter-action="jump"
          data-presenter-index="${firstIndex}"
          data-service-id="${escapeAttr(serviceId)}"
          aria-label="${escapeAttr(interactionLabel)}"
          title="${escapeAttr(interactionLabel)}">
          <span class="svc-board-section-title${visibleTitle ? "" : " is-empty"}">
            ${visibleTitle ? `<strong>${escapeHtml(visibleTitle)}</strong>` : ""}
          </span>
        </button>
        ${referenceMediaQuickAdd}
      </div>
      <div class="svc-board-section-deferred-body" aria-hidden="true"></div>
    </section>`;
}

function mountDeferredPresenterBoardSections(root, serviceId, slides) {
  root?._presenterBoardObserver?.disconnect?.();
  if (!root?.isConnected || !serviceId || typeof IntersectionObserver === "undefined") return;
  const deferredSections = [...root.querySelectorAll("[data-presenter-deferred-board-section]")];
  if (!deferredSections.length) return;
  const viewport = root.dataset.focusView === "true" ? root.querySelector(".svc-slide-board")
    : refs.detailPane?.isConnected ? refs.detailPane : null;
  const hydrateVisible = () => hydrateVisibleDeferredPresenterBoardSections(root, serviceId, slides, viewport);
  if (root._presenterBoardDeferredScrollHandler && root._presenterBoardDeferredScrollViewport) {
    root._presenterBoardDeferredScrollViewport.removeEventListener("scroll", root._presenterBoardDeferredScrollHandler);
  }
  if (viewport) {
    root._presenterBoardDeferredScrollViewport = viewport;
    root._presenterBoardDeferredScrollHandler = () => {
      if (!root.isConnected) {
        viewport.removeEventListener("scroll", root._presenterBoardDeferredScrollHandler);
        return;
      }
      // A fast wheel/touch scroll can cross the observer margin before its callback.
      // Fill visible placeholders in the scroll event so the controller never rests blank.
      hydrateVisible();
    };
    viewport.addEventListener("scroll", root._presenterBoardDeferredScrollHandler, { passive: true });
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      hydrateDeferredPresenterBoardSection(root, serviceId, slides, Number(entry.target.dataset.presenterBoardGroupIndex));
    });
  }, { root: viewport, rootMargin: root.dataset.focusView === "true" ? "0px 720px" : "720px 0px" });
  root._presenterBoardObserver = observer;
  deferredSections.forEach((section) => observer.observe(section));
  // Initial groups are already mounted. Let the observer measure the new board
  // after layout; synchronous rectangle reads here block first paint. Explicit
  // scrolling still hydrates visible placeholders immediately via the handler.
}

function hydrateVisibleDeferredPresenterBoardSections(root, serviceId, slides, viewport = refs.detailPane) {
  if (!root?.isConnected || !viewport?.isConnected) return 0;
  const viewportRect = viewport.getBoundingClientRect();
  const padding = 180;
  const candidates = [...root.querySelectorAll("[data-presenter-deferred-board-section]")]
    .filter((section) => {
      const rect = section.getBoundingClientRect();
      return rect.bottom > viewportRect.top - padding && rect.top < viewportRect.bottom + padding
        && (root.dataset.focusView !== "true" || (rect.right > viewportRect.left - padding && rect.left < viewportRect.right + padding));
    })
    .slice(0, 3);
  candidates.forEach((section) => {
    hydrateDeferredPresenterBoardSection(root, serviceId, slides, Number(section.dataset.presenterBoardGroupIndex));
  });
  return candidates.length;
}

function hydrateDeferredPresenterBoardSection(root, serviceId, slides, groupIndex) {
  return withServiceItemsScope(() => hydrateDeferredPresenterBoardSectionUnscoped(root, serviceId, slides, groupIndex));
}

function hydrateDeferredPresenterBoardSectionUnscoped(root, serviceId, slides, groupIndex) {
  if (!root?.isConnected || !Number.isInteger(groupIndex)) return false;
  const placeholder = root.querySelector(`[data-presenter-deferred-board-section][data-presenter-board-group-index="${groupIndex}"]`);
  if (!placeholder) return false;
  const groups = groupPresenterSlidesBySection(slides, serviceId);
  const group = groups[groupIndex];
  if (!group) return false;
  const activeIndex = presenterBoardActiveIndex(slides, state.presenter.serviceId === serviceId, state.presenter.index);
  const template = document.createElement("template");
  template.innerHTML = renderPresenterBoardSection(group, activeIndex, serviceId).trim();
  placeholder.replaceWith(template.content.firstElementChild);
  syncPresenterBoardSelectionClasses(root);
  refreshIcons();
  observePresenterPreviewScaleFrames(root);
  schedulePresenterPreviewLayoutUpdate(root);
  return true;
}

function hydrateDeferredPresenterBoardSectionForSlide(root, serviceId, slideIndex) {
  const slides = presenterSlidesForService(serviceId);
  const groupIndex = groupPresenterSlidesBySection(slides, serviceId)
    .findIndex((group) => group.slides.some((entry) => entry.slideIndex === slideIndex));
  if (groupIndex < 0) return false;
  return hydrateDeferredPresenterBoardSection(root, serviceId, slides, groupIndex);
}

function serviceOutlineItemForIndex(serviceId, itemIndex) {
  const index = Number(itemIndex);
  const service = state.services.find((svc) => svc.id === serviceId);
  if (!service || !Number.isInteger(index) || index < 0) return null;
  return getServiceOutlineItems(service).find((item, candidateIndex) => (
    (Number.isInteger(item._serviceItemIndex) ? item._serviceItemIndex : candidateIndex) === index
  )) || null;
}

function hydrateDeferredPresenterBoardSectionForServiceItem(root, serviceId, itemIndex) {
  const item = serviceOutlineItemForIndex(serviceId, itemIndex);
  if (!item) return false;
  const slides = presenterSlidesForService(serviceId);
  const itemId = String(item.id || "").trim();
  const groupIndex = groupPresenterSlidesBySection(slides, serviceId).findIndex((group) =>
    (group.subgroups || []).some((subgroup) => String(subgroup.id || "") === itemId)
    || group.slides.some(({ slide }) => presenterSlideBelongsToItem(slide, item)));
  if (groupIndex < 0) return false;
  return hydrateDeferredPresenterBoardSection(root, serviceId, slides, groupIndex);
}

function presenterSlideElementKey(serviceId, slideIndex) {
  const slides = presenterSlidesForService(serviceId);
  const slide = slides[slideIndex];
  return presenterSlideElementGroupKey(slide) || `slide:${slideIndex}`;
}

function selectedPresenterBoardIndexes(serviceId = state.selectedServiceId) {
  const selection = state.presenterBoardSelection || {};
  if (selection.serviceId !== serviceId) return new Set();
  return new Set((selection.indexes || []).map(Number).filter(Number.isFinite));
}

function presenterSelectedLaunchIndex(serviceId = state.selectedServiceId) {
  const slides = presenterSlidesForService(serviceId);
  const selection = state.presenterBoardSelection || {};
  if (selection.serviceId !== serviceId) return null;
  return (selection.indexes || [])
    .map(Number)
    .find((index) => isValidPresenterIndex(index, slides.length)) ?? null;
}

function selectPresenterBoardSlide(serviceId, slideIndex, options = {}) {
  if (state.presenter.outputWindow?.closed) stopPresenterOutput(state.presenter.serviceId);
  const index = Number(slideIndex);
  if (!serviceId || !Number.isFinite(index) || index < 0) return;
  const slides = presenterSlidesForService(serviceId);
  const elementKey = options.elementKey || presenterSlideElementKey(serviceId, index);
  const current = state.presenterBoardSelection || {};
  const sameElement = current.serviceId === serviceId && current.elementKey === elementKey;
  const anchorIndex = Number.isFinite(Number(options.anchorIndex))
    ? Number(options.anchorIndex)
    : sameElement && Number.isFinite(Number(current.anchorIndex))
      ? Number(current.anchorIndex)
      : index;
  let indexes = [];
  if (options.range && sameElement) {
    const [from, to] = [anchorIndex, index].sort((a, b) => a - b);
    const rangeIndexes = slides
      .map((slide, candidateIndex) => ({ slide, candidateIndex }))
      .filter(({ slide, candidateIndex }) => {
        const candidateKey = presenterSlideElementGroupKey(slide) || `slide:${candidateIndex}`;
        return candidateIndex >= from && candidateIndex <= to && candidateKey === elementKey;
      })
      .map(({ candidateIndex }) => candidateIndex);
    indexes = options.additive
      ? [...new Set([...(current.indexes || []), ...rangeIndexes])]
      : rangeIndexes;
  } else if (options.additive && sameElement) {
    const selected = new Set((current.indexes || []).map(Number).filter(Number.isFinite));
    if (selected.has(index)) selected.delete(index);
    else selected.add(index);
    indexes = [...selected];
  } else {
    indexes = [index];
  }
  state.presenterBoardSelection = {
    ...current,
    serviceId,
    elementKey,
    indexes: indexes.sort((a, b) => a - b),
    anchorIndex: options.range && sameElement ? anchorIndex : index,
    drag: current.drag || null,
    clipboard: current.clipboard || null,
  };
  const root = document.getElementById("servicePresenterControls");
  if (root?.isConnected) root.dataset.presenterInteractionAt = String(Date.now());
  if (options.render === false) return;
  syncPresenterBoardSelectionClasses();
}

function clearPresenterBoardSelection(options = {}) {
  state.presenterBoardSelection = {
    ...state.presenterBoardSelection,
    serviceId: null,
    elementKey: "",
    indexes: [],
    anchorIndex: null,
    drag: null,
  };
  if (options.render !== false) syncPresenterBoardSelectionClasses();
}

function syncPresenterBoardSelectionClasses(root = document.getElementById("servicePresenterControls")) {
  if (!root) return;
  syncPresenterFocusView();syncPresenterPreparedPreview();
  const selected = selectedPresenterBoardIndexes(state.selectedServiceId);
  root.querySelectorAll(".svc-slide-thumb[data-presenter-index][data-service-id]").forEach((thumb) => {
    const serviceId = thumb.dataset.serviceId;
    const index = Number(thumb.dataset.presenterIndex);
    const isSelected = state.presenterBoardSelection.serviceId === serviceId
      && selected.has(index);
    thumb.classList.toggle("selected", isSelected);
    thumb.setAttribute("aria-pressed", String(isSelected));
    thumb.closest(".svc-slide-thumb-wrap")?.classList.toggle("selected", isSelected);
  });
}

function handlePresenterSorterKeydown(event) {
  if (state.module !== "presenter") return false;
  if (presenterControllerIsLive(state.selectedServiceId)) return false;
  const key = event.key.toLowerCase();
  const command = event.metaKey || event.ctrlKey;
  if (!command || !["a", "c", "x", "v"].includes(key)) return false;
  if (shouldKeepHorizontalNavigationInFocusedControl(event.target)) return false;
  const serviceId = state.selectedServiceId;
  const selection = state.presenterBoardSelection || {};
  if (key === "a") {
    const focusedThumb = document.activeElement?.closest?.(".svc-slide-thumb[data-presenter-index][data-service-id]");
    const elementKey = focusedThumb?.dataset.presenterElementKey || selection.elementKey || "";
    if (!serviceId || !elementKey) return false;
    event.preventDefault();
    selectAllPresenterSlidesInElement(serviceId, elementKey);
    return true;
  }
  if (!selection.indexes?.length || selection.serviceId !== serviceId || !selection.elementKey) return false;
  event.preventDefault();
  if (key === "c") {
    copyPresenterSelectedCustomSlides();
    return true;
  }
  if (key === "x") {
    cutPresenterSelectedCustomSlides();
    return true;
  }
  if (key === "v") {
    pastePresenterCustomSlides();
    return true;
  }
  return false;
}

function selectAllPresenterSlidesInElement(serviceId, elementKey) {
  const slides = presenterSlidesForService(serviceId);
  const indexes = slides
    .map((slide, index) => ({ slide, index }))
    .filter(({ slide, index }) => (presenterSlideElementGroupKey(slide) || `slide:${index}`) === elementKey)
    .map(({ index }) => index);
  state.presenterBoardSelection = {
    ...state.presenterBoardSelection,
    serviceId,
    elementKey,
    indexes,
    anchorIndex: indexes[0] ?? null,
    drag: null,
  };
  syncPresenterBoardSelectionClasses();
}

function presenterSelectedCustomSlideContext() {
  const selection = state.presenterBoardSelection || {};
  const serviceId = selection.serviceId || state.selectedServiceId;
  const items = getServiceItems(serviceId);
  const itemIndex = items.findIndex((item) => String(item.id || "") === String(selection.elementKey || ""));
  const item = items[itemIndex];
  if (!item) return null;
  const slides = presenterSlidesForService(serviceId);
  const customIndexes = (selection.indexes || [])
    .map((slideIndex) => {
      const slide = slides[slideIndex];
      const customIndex = String(slide?.formKey || "").match(/^custom:(\d+)$/)?.[1];
      return customIndex === undefined ? null : Number(customIndex);
    });
  if (!customIndexes.length || customIndexes.some((index) => !Number.isInteger(index))) return null;
  const parsed = parseServiceItemMemo(item.memo);
  if (!parsed.slides.length || customIndexes.some((index) => index < 0 || index >= parsed.slides.length)) return null;
  return {
    serviceId,
    items,
    item,
    itemIndex,
    parsed,
    customIndexes: [...new Set(customIndexes)].sort((a, b) => a - b),
  };
}

function commitPresenterCustomSlideContext(context, options = {}) {
  if (!context?.item) return;
  context.item.memo = serializeServiceItemMemo(context.parsed);
  state.serviceItems[context.serviceId] = normalizeServiceItemsInCurrentOrder(context.items);
  state.dirty.service = true;
  refreshPresenterForService(context.serviceId);
  if (options.render !== false) renderPresenterDetail();
  updateSaveState();
}

function copyPresenterSelectedCustomSlides() {
  const context = presenterSelectedCustomSlideContext();
  if (!context) {
    showToast("가사/악보/성경에서 생성된 슬라이드는 element 편집기에서 원본을 수정해 주세요.", "info");
    return false;
  }
  state.presenterBoardSelection.clipboard = {
    elementKey: state.presenterBoardSelection.elementKey,
    slides: context.customIndexes.map((index) => context.parsed.slides[index]),
  };
  showToast(`${context.customIndexes.length}개 슬라이드를 복사했습니다.`);
  return true;
}

function cutPresenterSelectedCustomSlides() {
  const context = presenterSelectedCustomSlideContext();
  if (!context) {
    showToast("자동 생성된 슬라이드는 직접 자를 수 없습니다. 엘리멘트 원본을 수정해 주세요.", "info");
    return false;
  }
  copyPresenterSelectedCustomSlides();
  for (const index of [...context.customIndexes].reverse()) {
    context.parsed.slides.splice(index, 1);
  }
  commitPresenterCustomSlideContext(context, { render: false });
  clearPresenterBoardSelection({ render: false });
  renderPresenterDetail();
  return true;
}

function pastePresenterCustomSlides() {
  const clipboard = state.presenterBoardSelection.clipboard;
  const context = presenterSelectedCustomSlideContext();
  if (!clipboard?.slides?.length || !context) {
    showToast("붙여넣기는 같은 element의 직접 지정 슬라이드에서만 가능합니다.", "info");
    return false;
  }
  const insertAt = Math.min(Math.max(...context.customIndexes) + 1, context.parsed.slides.length);
  context.parsed.slides.splice(insertAt, 0, ...clipboard.slides);
  commitPresenterCustomSlideContext(context, { render: false });
  renderPresenterDetail();
  return true;
}

const NEXT_PREPARATION_SERVICE_TYPES = {
  "sunday-first": "youth",
  youth: "young-adult",
  "sunday-second": "sunday-main",
  "sunday-main": "sunday-afternoon",
};

function nextPreparationService(service = null) {
  return nextPreparationTarget(service)?.service || null;
}

function nextPreparationTarget(service = null) {
  if (!service) return null;
  const nextType = NEXT_PREPARATION_SERVICE_TYPES[worshipAppServiceTypeId(service.type_id)];
  if (!nextType) return null;
  const sameDate = state.services.find((candidate) =>
    candidate.id !== service.id
    && worshipAppServiceTypeId(candidate.type_id) === nextType
    && candidate.date === service.date
  );
  const serviceDate = String(service.date || "").trim();
  if (sameDate) return { service: sameDate, typeId: nextType, date: serviceDate, exists: true };
  const nextService = sortServicesByDate(state.services.filter((candidate) =>
    candidate.id !== service.id
    && worshipAppServiceTypeId(candidate.type_id) === nextType
    && String(candidate.date || "") >= serviceDate
  ))[0] || null;
  if (nextService) return { service: nextService, typeId: nextType, date: nextService.date || serviceDate, exists: true };
  return null;
}

function presenterBoardEntries(slides, service) {
  const entries = slides.map((slide, slideIndex) => ({ slide, slideIndex }));
  if (!service) return entries;
  const items = getServiceOutlineItems(service);
  const belongsToItem = (slide, item) => {
    const connected = normalizeServiceConnectedPraise(slide.connectedPraise || slide.connected_praise);
    return presenterSlideBelongsToItem(slide, item)
      || Boolean(connected && [connected.primaryItemId, ...(connected.itemIds || []), ...(connected.secondaryItemIds || [])]
        .includes(String(item.id || "")));
  };
  const ownershipFor = (slide) => {
    const indexes = new Set();
    let lastIndex = -1;
    items.forEach((item, index) => {
      if (!belongsToItem(slide, item)) return;
      indexes.add(index);
      lastIndex = index;
    });
    return { indexes, lastIndex };
  };
  // Cache membership once; insertion only consults indexes, not nested slide scans.
  const ownership = entries.map(({ slide }) => ownershipFor(slide));
  items.forEach((item, index) => {
    if (ownership.some((entry) => entry.indexes.has(index))) return;
    // Controller-only entries keep editors reachable without adding output slides.
    const slide = {
      ...presenterSectionForServiceItem(item, index, serviceItemDisplayText(item)),
      id: `${item.id}:editor-only`,
      controllerEditorOnly: true,
      label: item.label || "",
      title: serviceItemDisplayText(item),
      text: "",
    };
    const nextIndex = ownership.findIndex((entry) => entry.lastIndex > index);
    const insertionIndex = nextIndex < 0 ? entries.length : nextIndex;
    entries.splice(insertionIndex, 0, { slide, slideIndex: -1 });
    ownership.splice(insertionIndex, 0, ownershipFor(slide));
  });
  return entries;
}

function groupPresenterSlidesBySection(slides, serviceId = state.selectedServiceId) {
  const service = state.services.find((svc) => svc.id === serviceId);
  const groups = [];
  const owners = new Map();
  slides.forEach((slide) => {
    const key = presenterSlideElementGroupKey(slide);
    if (key && !slide.autoTrailingBlank && !owners.has(key)) owners.set(key, slide);
  });
  presenterBoardEntries(slides, service).forEach(({ slide, slideIndex }) => {
    // Blank payload is empty by design; use its owner for controller grouping.
    const groupSource = slide.autoTrailingBlank
      ? owners.get(presenterSlideElementGroupKey(slide)) || slide : slide;
    const mainPraise = isPresenterMainPraiseSlide(groupSource);
    const mainPraiseMarker = mainPraise && isPresenterPraiseSectionMarkerSlide(slide);
    const mainPraiseAssignee = mainPraiseMarker
      ? cleanPresenterAssignee(slide.bodyText || slide.subtitle || slide.assignee || slide.sectionAssignee)
      : slide.sectionAssignee;
    const praiseMeta = mainPraise
      ? servicePraiseBoardMetaCandidate(service, [{ assignee: mainPraiseAssignee, praiseIntro: mainPraiseMarker }])
      : { text: "", priority: 0 };
    const id = mainPraise ? presenterMainPraiseGroupId(groupSource) : presenterBoardSectionGroupId(groupSource, slideIndex);
    const previous = groups[groups.length - 1];
    let group = mainPraise
      ? groups.find((candidate) => candidate.kind === "main-praise" && candidate.id === id)
      : !mainPraise && previous?.id === id
        ? previous
        : null;

    if (!group) {
      group = createPresenterSlideGroup(groupSource, slideIndex, {
        id,
        kind: mainPraise ? "main-praise" : "item",
        praiseMeta: praiseMeta.text,
        praiseMetaPriority: praiseMeta.priority,
      });
      groups.push(group);
    }

    if (mainPraise && praiseMeta.priority > (group.metaPriority || 0)) {
      group.meta = praiseMeta.text;
      group.metaPriority = praiseMeta.priority;
    }

    const entry = { slide, slideIndex };
    group.slides.push(entry);
    addPresenterSlideToSubgroup(group, entry);
  });
  // UI-only offsets stay stable when sections are rendered lazily or refreshed.
  let scriptureColorStart = 0;
  for (const group of groups) {
    for (const subgroup of group.subgroups) {
      subgroup.scriptureColorStart = scriptureColorStart;
      scriptureColorStart += presenterBoardSlideBlocks(subgroup.slides).filter(block =>
        presenterSlideElementType(block.entries[0]?.slide) === PRESENTER_ELEMENT_TYPES.SCRIPTURE_TEXT).length;
    }
  }

  return groups;
}

function isPresenterMainPraiseSlide(slide = {}) {
  const sectionKey = String(slide.sectionKey || "").trim();
  if (sectionKey) return sectionKey === "praise";
  if (isPresenterEntrancePraiseSlide(slide)) return false;
  if (slide.sectionRole === "main-praise") return true;
  const context = compactSearchValue([
    slide.sectionTitle,
    slide.sectionName,
    slide.sectionHeading,
    slide.elementLabel,
    slide.label,
  ].filter(Boolean).join(" "));
  if (/(특송|송영|결단|봉헌|파송|폐회)/.test(context)) return false;
  return isMainPraiseLabel(slide.sectionLabel);
}

function presenterMainPraiseGroupId(slide = {}) {
  const sectionId = String(slide.sectionId || "").trim();
  return `main-praise:${sectionId || "praise"}`;
}

function isPresenterEntrancePraiseSlide(slide = {}) {
  const context = compactSearchValue([
    slide.sectionKey,
    slide.sectionTitle,
    slide.sectionName,
    slide.sectionHeading,
    slide.elementLabel,
    slide.label,
  ].filter(Boolean).join(" "));
  return /입례찬양|성경봉독전찬양/.test(context);
}

function presenterBoardSectionGroupId(slide = {}, slideIndex = 0) {
  const sectionKey = String(slide.sectionKey || "").trim();
  if (sectionKey === "closing_visual" || sectionKey === "closing_hymn") return "section-key:closing_visual";
  return slide.sectionId || `section:${slideIndex}`;
}

function createPresenterSlideGroup(slide, slideIndex, options = {}) {
  const mainPraise = options.kind === "main-praise";
  const explicitSectionTitle = slide.sectionHeading || slide.sectionTitle || slide.sectionLabel || "";
  const sourceSectionTitle = serviceSectionDisplayTitle(slide.sectionKey, explicitSectionTitle)
    || presenterBoardSectionTitleForSlide(slide)
    || explicitSectionTitle;
  const label = mainPraise ? "찬양" : sourceSectionTitle;
  const title = mainPraise ? "찬양" : sourceSectionTitle;
  const meta = mainPraise && options.praiseMeta ? options.praiseMeta : "";
  return {
    id: options.id || slide.sectionId || `section:${slideIndex}`,
    kind: options.kind || "item",
    sectionKey: String(slide.sectionKey || "").trim(),
    index: slide.sectionIndex || slideIndex + 1,
    label,
    title,
    meta,
    metaPriority: Number(options.praiseMetaPriority) || 0,
    name: presenterNameParts(label, title, meta).join(" / ") || presenterSlideTitle(slide),
    slides: [],
    subgroups: [],
  };
}

function presenterBoardSectionTitleForSlide(slide = {}) {
  const sectionKey = String(slide.sectionKey || "").trim();
  return serviceCanonicalSectionTitle(sectionKey);
}

function serviceCanonicalSectionTitle(sectionKey = "") {
  const canonicalByKey = {
    ready: "준비",
    creed: "신앙고백",
    praise: "찬양",
    confession: "참회기도",
    hymn_praise: "찬송",
    prayer: "대표기도",
    scripture_reading: "성경봉독",
    special_song: "특송",
    sermon: "설교",
    response_song: "결단",
    pre_scripture_praise: "찬양",
    entrance_praise: "입례찬양",
    prayer_meeting_praise: "기도회",
    offering: "봉헌",
    announcements: "광고",
    community_confession: "공동체고백",
    sending: "파송",
    doxology: "송영",
    benediction: "축도",
    closing_hymn: "폐회",
    closing_visual: "폐회",
  };
  return canonicalByKey[String(sectionKey || "").trim()] || "";
}

function serviceSectionDisplayTitle(sectionKey = "", title = "") {
  const rawTitle = String(title || "").trim();
  const canonical = serviceCanonicalSectionTitle(sectionKey);
  return canonical || rawTitle;
}

function addPresenterSlideToSubgroup(group, entry) {
  const { slide } = entry;
  const connected = normalizeServiceConnectedPraise(slide.connectedPraise || slide.connected_praise);
  const id = connected?.groupId
    ? `connected-praise:${connected.groupId}`
    : slide.elementId || slide.sectionId || `${group.id}:slide:${entry.slideIndex}`;
  // Interleaved media must retain actual playback order on the thumbnail board.
  const sequential = slide.progressionSequence || group.subgroups.at(-1)?.slides.at(-1)?.slide.progressionSequence;
  let subgroup = sequential
    ? (group.subgroups.at(-1)?.id === id ? group.subgroups.at(-1) : null)
    : group.subgroups.find((item) => item.id === id);
  if (!subgroup) {
    const mainPraiseMarker = group.kind === "main-praise" && isPresenterPraiseSectionMarkerSlide(slide);
    const entrancePraise = group.kind === "main-praise" && isPresenterEntrancePraiseSlide(slide);
    const number = group.kind === "main-praise" ? presenterMainPraiseSongSubgroupCount(group) + 1 : group.subgroups.length;
    const earlierSegment = group.subgroups.find(subgroup => subgroup.id === id);
    const referenceMedia = compactSearchValue(slide.elementLabel || slide.label || "") === "참고화면";
    const label = earlierSegment ? earlierSegment.label : referenceMedia ? "참고 화면" : group.kind === "main-praise"
      ? mainPraiseMarker
        ? slide.elementLabel || "환영"
        : entrancePraise
          ? slide.elementLabel || "입례찬양"
          : presenterPraiseSubgroupLabel(slide.sectionLabel, number)
      : slide.elementLabel || slide.sectionLabel || "";
    const title = presenterBoardSubgroupContentTitle(slide, label);
    subgroup = {
      id,
      label,
      title,
      name: presenterNameParts(label, title).join(" / ") || presenterSlideTitle(slide),
      slides: [],
    };
    group.subgroups.push(subgroup);
  }
  subgroup.slides.push(entry);
  if (connected?.groupId) updateConnectedPraiseSubgroupLabel(group, subgroup);
}

function updateConnectedPraiseSubgroupLabel(group = {}, subgroup = {}) {
  if (group.kind !== "main-praise") return;
  const entries = (subgroup.slides || []).filter(({ slide }) => !isPresenterPraiseSectionMarkerSlide(slide));
  if (!entries.length) return;
  const itemIds = [...new Set(entries.map(({ slide }) => String(slide.elementId || "").trim()).filter(Boolean))];
  const itemCount = Math.max(1, itemIds.length);
  const connected = normalizeServiceConnectedPraise(entries[0].slide.connectedPraise || entries[0].slide.connected_praise);
  const fallbackItem = {
    label: entries[0].slide.elementLabel || entries[0].slide.label || "",
  };
  const connectedLabel = connectedPraiseSubgroupRangeLabel(connected, fallbackItem);
  const start = presenterMainPraiseSongSubgroupCount(group);
  const end = start + itemCount - 1;
  const label = connectedLabel || (itemCount > 1 ? `${start}–${end}` : presenterPraiseSubgroupLabel("", start));
  subgroup.label = label;
  const title = presenterBoardSubgroupContentTitle(entries[0].slide, label);
  subgroup.title = title;
  subgroup.name = presenterNameParts(label, title).join(" / ") || subgroup.name || label;
}

function connectedPraiseSubgroupRangeLabel(connected = null, fallbackItem = {}) {
  const title = serviceItemConnectedPraiseOrderTitle(fallbackItem, connected);
  const match = title.match(/(?:찬양\s*)?(\d+)\s*[-–~]\s*(\d+)/);
  if (match) return `찬양 ${match[1]}–${match[2]}`;
  const single = title.match(/^찬양\s*(\d+)$/);
  return single ? `찬양 ${single[1]}` : "";
}

function presenterTitleAssigneeTitleIsGeneric(title = "", label = "") {
  const titleKey = compactSearchValue(title);
  if (!titleKey) return true;
  const labelKey = compactSearchValue(label);
  return titleKey === labelKey || [
    "기도",
    "대표기도",
    "봉헌기도",
    "성경봉독",
    "특송",
    "축도",
    "교회소식",
    "광고",
    "예배",
  ].includes(titleKey);
}

function presenterBoardSubgroupContentTitle(slide = {}, label = "") {
  if (slide?._praiseIntroSlide) return "";
  const connectedTitle = serviceItemConnectedPraiseTitle({
    label: slide.elementLabel || slide.label || "",
    connectedPraise: slide.connectedPraise || slide.connected_praise,
  }, "title");
  if (connectedTitle) return connectedTitle;
  const linkedTitle = presenterBoardLinkedSongTitle(slide);
  if (linkedTitle) return linkedTitle;
  const sectionKey = String(slide.sectionKey || "").trim();
  if (sectionKey === "sermon" || ["설교", "설교제목"].includes(compactSearchValue(label))) {
    return slide.contentTitle || "";
  }
  const title = slide.elementTitle || slide.title || presenterSlideMainText(slide);
  return title;
}

function presenterSermonContentTitle(value = "") {
  const title = String(value || "").trim();
  if (!title) return "";
  const quotePairs = [
    ["'", "'"],
    ['"', '"'],
    ["‘", "’"],
    ["“", "”"],
    ["｢", "｣"],
    ["〈", "〉"],
    ["‹", "›"],
  ];
  const unwrapped = quotePairs.reduce((current, [open, close]) => (
    current.startsWith(open) && current.endsWith(close)
      ? current.slice(open.length, current.length - close.length).trim()
      : current
  ), title);
  return `｢${unwrapped}｣`;
}

function presenterBoardLinkedSongTitle(slide = {}) {
  if (!isSongServiceLabel(slide.elementLabel || slide.label || slide.sectionLabel || "")) return "";
  const song = serviceItemLinkedSong(slide);
  if (!song?.hymn_no) return "";
  const version = serviceItemLinkedVersion(slide, song);
  const fallback = slide.elementTitle || slide.title || presenterSlideMainText(slide);
  return presenterSongTitleDisplayTitle(song, version, fallback, presenterSongTitleSectionHeading(slide, slide));
}

function presenterMainPraiseSongSubgroupCount(group = {}) {
  return new Set((group.subgroups || []).filter((subgroup) =>
    !subgroup.slides?.every(({ slide }) => isPresenterPraiseSectionMarkerSlide(slide)
      || compactSearchValue(slide.elementLabel || slide.label || "") === "참고화면")
  ).map(subgroup => subgroup.id)).size;
}

function isPresenterPraiseSectionMarkerSlide(slide = {}) {
  if (slide?.type === "praise-section-title" || slide?._praiseIntroSlide) return true;
  if (!isPresenterMainPraiseSlide(slide)) return false;
  const titleKey = compactSearchValue(slide.title || slide.elementTitle || slide.sectionTitle || "");
  return slide?.type === "title-content"
    && slide.elementType === PRESENTER_ELEMENT_TYPES.TITLE_CONTENT
    && (titleKey === "찬양" || titleKey === "환영" || compactSearchValue(slide.elementLabel || "") === "환영");
}

function presenterNameParts(...parts) {
  const seen = new Set();
  return cleanList(parts).filter((part) => {
    const key = compactSearchValue(part);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function presenterPraiseSubgroupLabel(label, number) {
  const raw = String(label || "").trim();
  if (raw && !/^찬양\s*\d*$/i.test(raw)) return raw.replace(/\s+/g, " ");
  return `찬양 ${number}`;
}

function renderPresenterBoardSection(group, activeIndex, serviceId) {
  const active = group.slides.some(({ slideIndex }) => slideIndex >= 0 && slideIndex === activeIndex);
  const firstIndex = group.slides.find(({ slideIndex }) => slideIndex >= 0)?.slideIndex ?? -1;
  const visibleTitle = group.title || group.label || group.name;
  const interactionLabel = presenterSlideInteractionHint(serviceId, group.name || visibleTitle);
  const referenceMediaSectionKey = presenterBoardReferenceMediaSectionKey(group, serviceId);
  const referenceMediaQuickAdd = referenceMediaSectionKey
    ? renderPresenterReferenceMediaQuickAdd(referenceMediaSectionKey, serviceId)
    : "";
  let previousFormKey = "";
  const subgroupsHtml = group.subgroups.map((subgroup) => {
    const annotated = annotatePresenterFormStarts(subgroup.slides, previousFormKey);
    previousFormKey = annotated.lastKey;
    return renderPresenterBoardSubgroup(subgroup, activeIndex, serviceId, {
      showHead: true,
      slides: annotated.entries,
    });
  }).join("");
  const contentKey = compactTextSignature(JSON.stringify([group.name, visibleTitle, interactionLabel, firstIndex, referenceMediaQuickAdd, subgroupsHtml]));
  return `
    <section class="svc-board-section${active ? " active" : ""}" role="listitem" aria-label="${escapeAttr(group.name)}" data-presenter-section-key="${escapeAttr(group.id)}" data-presenter-section-content="${escapeAttr(contentKey)}">
      <div class="svc-board-section-head-row">
        <button class="svc-board-section-head" type="button"
          ${firstIndex < 0 ? "disabled" : ""}
          data-presenter-action="jump"
          data-presenter-index="${firstIndex}"
          data-service-id="${escapeAttr(serviceId)}"
          aria-label="${escapeAttr(interactionLabel)}"
          title="${escapeAttr(interactionLabel)}">
          <span class="svc-board-section-title${visibleTitle ? "" : " is-empty"}">
            ${visibleTitle ? `<strong>${escapeHtml(visibleTitle)}</strong>` : ""}
          </span>
        </button>
        ${referenceMediaQuickAdd}
      </div>
      <div class="svc-board-subgroups">
        ${subgroupsHtml}
      </div>
    </section>`;
}

function renderPresenterReferenceMediaQuickAdd(sectionKey, serviceId) {
  const sectionLabel = presenterReferenceMediaSectionLabel(sectionKey);
  return `
    <details class="svc-reference-media-quick-add">
      <summary class="svc-reference-media-add" aria-label="${escapeAttr(sectionLabel)} 자료 추가" title="자료 추가">
        <span>추가</span>
      </summary>
      <div class="svc-reference-media-quick-add-actions">
        <label class="svc-reference-media-upload">
          <input type="file" accept=".key,.pptx" data-presenter-pptx-file
            data-presenter-reference-media-section="${escapeAttr(sectionKey)}" data-service-id="${escapeAttr(serviceId)}" aria-label="설교·발표 자료 삽입" />
          <span>Keynote / PPT</span>
        </label>
        <label class="svc-reference-media-upload">
          <input type="file" multiple accept="${PRESENTER_REFERENCE_MEDIA_ACCEPT}" data-presenter-reference-media-direct-file
            data-presenter-reference-media-section="${escapeAttr(sectionKey)}" data-service-id="${escapeAttr(serviceId)}" aria-label="파일 선택" />
          <span>파일 선택</span>
        </label>
        <button class="svc-reference-media-add" type="button" data-presenter-reference-media-add
          data-presenter-reference-media-section="${escapeAttr(sectionKey)}" data-service-id="${escapeAttr(serviceId)}">
          <span>URL 입력</span>
        </button>
      </div>
    </details>`;
}

function presenterBoardReferenceMediaSectionKey(group = {}, serviceId = state.selectedServiceId) {
  const directSectionKey = String(group?.sectionKey || "").trim();
  if (PRESENTER_REFERENCE_MEDIA_SECTION_KEYS.has(directSectionKey)) return directSectionKey;
  const slideSectionKey = (group?.slides || [])
    .map(({ slide }) => String(slide?.sectionKey || "").trim())
    .find((key) => PRESENTER_REFERENCE_MEDIA_SECTION_KEYS.has(key));
  if (slideSectionKey) return slideSectionKey;
  const groupTitle = compactSearchValue(group?.title || group?.label || "");
  const candidates = getServiceItems(serviceId);
  return candidates
    .map((item) => presenterReferenceMediaItemSectionKey(item))
    .find((sectionKey) => PRESENTER_REFERENCE_MEDIA_SECTION_KEYS.has(sectionKey)
      && compactSearchValue(presenterReferenceMediaSectionLabel(sectionKey)) === groupTitle) || "";
}

function renderPresenterNextPreparationButton(serviceId, nextTarget = null) {
  if (!nextTarget?.service?.id) return "";
  const nextService = nextTarget.service || null;
  const typeId = nextTarget.typeId || nextService?.type_id || "";
  const date = nextTarget.date || nextService?.date || "";
  const displayName = nextService ? serviceNavigationName(nextService) : serviceNavigationTypeName(typeId);
  if (!displayName || !typeId || !date) return "";
  const label = `다음 예배 준비: ${displayName}`;
  return `
    <div class="svc-board-next-prep">
      <button class="svc-board-next-prep-btn" type="button"
        data-presenter-action="prepare-next-service"
        data-service-id="${escapeAttr(serviceId)}"
        data-next-service-id="${escapeAttr(nextService?.id || "")}"
        data-next-service-type="${escapeAttr(typeId)}"
        data-next-service-date="${escapeAttr(date)}"
        aria-label="${escapeAttr(label)}">
        <span>다음 예배 준비</span>
        <strong>${escapeHtml(displayName)}</strong>
        <i data-lucide="arrow-right"></i>
      </button>
    </div>`;
}

function renderPresenterBoardSubgroup(subgroup, activeIndex, serviceId, options = {}) {
  const active = subgroup.slides.some(({ slideIndex }) => slideIndex >= 0 && slideIndex === activeIndex);
  const firstIndex = subgroup.slides.find(({ slideIndex, slide }) =>
    slideIndex >= 0 && presenterSlideIsNavigable(slide))?.slideIndex ?? -1;
  const slides = options.slides || annotatePresenterFormStarts(subgroup.slides).entries;
  const display = presenterBoardSubgroupDisplay(serviceId, subgroup);
  const rawLabel = Object.prototype.hasOwnProperty.call(display, "label")
    ? display.label
    : subgroup.label || "항목";
  const rawTitle = Object.prototype.hasOwnProperty.call(display, "title")
    ? display.title
    : subgroup.title || subgroup.name;
  const firstSlide = subgroup.slides[0]?.slide || slides[0]?.slide;
  const visibleTitle = firstSlide && isPresenterPreparationSlide(firstSlide)
    ? ""
    : presenterVisibleTitle(rawLabel, rawTitle);
  const visibleLabel = rawLabel;
  const interactionLabel = presenterSlideInteractionHint(serviceId, subgroup.name || visibleLabel);
  const warnings = presenterWarningsForEntries(subgroup.slides);
  const inputContexts = presenterBoardSubgroupInputContexts(serviceId, subgroup);
  const formWarnings = uniqueList(inputContexts.flatMap(({ item }) => serviceFormInputWarnings(item)));
  const staticWarnings = warnings.filter(warning => !formWarnings.includes(warning));
  // Single-song rows use the same compact controls as medley rows.
  const inlineSong = inputContexts.length === 1
    && ["praise_db", "lyrics_db", "score_db"].includes(presenterServiceInputItem(inputContexts[0].item, inputContexts[0].service)?.mode);
  const headerContext = options.showHead && inputContexts.length === 1 && !inlineSong ? { ...inputContexts[0], timingEntries: subgroup.slides } : null;
  const headerDbContext = options.showHead && inputContexts.length === 1 ? inputContexts[0] : null;
  const inputControls = renderPresenterBoardSubgroupInputControls(serviceId, subgroup, { headerActions: Boolean(headerContext), headerDbLink: Boolean(headerDbContext) });
  const headerActions = headerContext && inputControls && !serviceItemCanToggleOfferingSpecial(headerContext.item) ? renderPresenterBoardItemActions(serviceId, headerContext) : "";
  const context = presenterBoardSubgroupItemContext(serviceId, subgroup);
  const itemIndexAttr = context ? ` data-service-item-index="${escapeAttr(String(context.index))}"` : "";
  const elementIdAttr = context?.item?.id ? ` data-service-element-id="${escapeAttr(context.item.id)}"` : "";
  const hidden = context?.item
    ? serviceItemPresentationHidden(context.item)
    : subgroup.slides.length > 0 && subgroup.slides.every(({ slide }) => presenterSlideIsHidden(slide));
  const showHead = hidden || Boolean(options.showHead && (visibleLabel || visibleTitle || warnings.length || headerActions));
  return `
    <div class="svc-board-subgroup${active ? " active" : ""}${showHead ? "" : " collapsed-head"}"${itemIndexAttr}${elementIdAttr}>
      ${showHead ? `
        <header class="svc-board-subgroup-head-row">
          <button class="svc-board-subgroup-head" type="button"
            ${firstIndex < 0 ? "disabled" : ""}
            data-presenter-action="jump"
            data-presenter-index="${firstIndex}"
            data-service-id="${escapeAttr(serviceId)}"
            aria-label="${escapeAttr(interactionLabel)}"
            title="${escapeAttr(interactionLabel)}">
            ${visibleLabel ? `<span>${escapeHtml(visibleLabel)}</span>` : ""}
            ${visibleTitle ? `<strong>${escapeHtml(visibleTitle)}</strong>` : ""}
            ${hidden ? `<span class="svc-element-hidden-badge">숨김</span>` : ""}
            <span data-live-form-warnings data-static-warnings="${escapeAttr(JSON.stringify(staticWarnings))}">${renderPresenterWarnings(warnings)}</span>
          </button>
          ${headerDbContext ? renderServiceItemLinkControl(headerDbContext.item, headerDbContext.index) : ""}
          ${headerActions}
        </header>` : ""}
      ${inputControls}
      ${renderServiceSlotMusic(context)}
      <div class="svc-board-grid">
        ${renderPresenterBoardSlideBlocks(slides, activeIndex, serviceId, subgroup.scriptureColorStart)}
      </div>
      ${subgroup.slides.some(({ slide }) => slide?.liveScriptureControl) ? `
        <button class="svc-output-action" type="button" data-presenter-citation-focus="${escapeAttr(subgroup.slides.find(({ slide }) => slide?.liveScriptureControl).slide.elementId)}" data-service-id="${escapeAttr(serviceId)}">
          <i data-lucide="radio"></i><span>실시간 말씀 입력</span>
        </button>` : ""}
    </div>`;
}

function renderPresenterCitationComposer(subgroup, serviceId) {
  const slide = subgroup.slides.find(({ slide }) => slide?.liveScriptureControl)?.slide;
  if (!slide?.elementId) return "";
  return `
    <div class="svc-citation-composer" role="group" aria-label="실시간 말씀 입력">
      <div class="svc-citation-composer-heading">
        <span><i data-lucide="radio"></i>실시간 말씀</span>
        <label class="svc-slide-citation-auto-output">
          <input type="checkbox" data-presenter-citation-auto-output ${presenterCitationAutoOutput ? "checked" : ""} />
          <span>즉시 송출</span>
        </label>
      </div>
      <div class="svc-citation-composer-entry">
        <input class="svc-slide-citation-reference-input" type="text"
          data-presenter-citation-reference-input data-service-id="${escapeAttr(serviceId)}"
          data-presenter-citation-element-id="${escapeAttr(slide.elementId)}"
          data-presenter-citation-slot-key="${escapeAttr(slide.slotKey || "")}"
          placeholder="예: 롬 5:7–8; 요 15:9" aria-label="실시간 인용 구절" autocomplete="off" />
      </div>
    </div>`;
}

function renderPresenterBoardItemActions(serviceId, context, options = {}) {
  const photoTiming = servicePraiseInputMode(context.item) === "audio_praise"
    && (context.timingEntries || []).some(({slide}) => slide.serviceTimingPage && slide.songTimingEligible);
  const audioControls = serviceItemSupportsHeaderAudio(context.item)
    ? renderPresenterBoardItemAudioControls(serviceId, context) : "";
  const inputContext = presenterServiceInputItem(context.item, context.service);
  const fileControls = inputContext?.mode === "asset"
    ? renderPresenterAssetUpload(context.item, context.index, inputContext.memo, serviceId) : "";
  return `
    <div class="svc-board-subgroup-flow" data-service-item-actions data-service-id="${escapeAttr(serviceId)}" data-service-item-index="${escapeAttr(String(context.index))}">
      ${options.omitCommit ? "" : `<span class="svc-input-status sr-only" data-service-input-status role="status" aria-live="polite"></span>`}
      ${!options.commitOnly && serviceItemConnectedPraise(context.item)?.groupId ? `<button class="reference-new-btn secondary svc-medley-unlink" type="button" data-service-medley-unlink="${escapeAttr(context.item.id)}" data-service-id="${escapeAttr(serviceId)}" title="곡과 순서를 유지하고 메들리 묶음 해제">메들리 해제</button>` : ""}
      ${options.commitOnly ? "" : fileControls}
      ${!options.commitOnly && photoTiming ? `<button class="btn secondary" type="button" data-song-timing-open data-song-timing-focus="photos"
        data-service-id="${escapeAttr(serviceId)}" data-element-id="${escapeAttr(context.item.id)}">사진·타이밍 편집</button>` : ""}
      ${options.commitOnly ? "" : renderPresenterProgressionAdd(context.item, context.index, serviceId)}
      ${options.commitOnly ? "" : audioControls}
      ${options.omitCommit ? "" : `<button class="reference-new-btn svc-board-subgroup-commit" type="button" data-service-item-commit
        data-service-id="${escapeAttr(serviceId)}" data-service-item-index="${escapeAttr(String(context.index))}">
        <span>저장</span>
      </button>`}
    </div>`;
}

function renderPresenterBoardSubgroupInputControls(serviceId, subgroup = {}, options = {}) {
  const contexts = presenterBoardSubgroupInputContexts(serviceId, subgroup);
  if (!contexts.length) return "";
  // Every row of a medley is a song picker whose value already names the song, so a
  // per-row "찬양 n" label only repeats the header range. Other multi-item groups
  // (e.g. 설교/인용 구절) hold different fields and keep their labels.
  const medleyRows = contexts.length > 1 && contexts.every((context) => serviceItemConnectedPraise(context.item));
  const blocks = contexts.map((originalContext) => {
    const context = { ...originalContext, timingEntries: subgroup.slides };
    const offering = serviceItemCanToggleOfferingSpecial(context.item);
    let controls = presenterServiceInputControls(context.item, context.index, context.service, { headerActions: true, offeringToolbar: offering });
    if (!controls) return "";
    const label = contexts.length > 1 && !medleyRows ? serviceElementDisplayLabel(serviceItemOrdinalDisplayLabel(context.item, context.service)) || "항목" : "";
    const audioLed = servicePraiseInputMode(context.item) === "audio_praise";
    const audioManager = renderPresenterBoardItemAudioControls(serviceId, context, {manager:true});
    const dbLink = renderServiceItemLinkControl(context.item, context.index);
    if (dbLink && (options.headerActions || options.headerDbLink || label)) controls = controls.replace(dbLink, "");
    if (offering) return `
      <div class="svc-board-subgroup-control-item service-offering-editor" data-service-id="${escapeAttr(serviceId)}" data-service-item-id="${escapeAttr(context.item.id || "")}" data-service-item-index="${escapeAttr(String(context.index))}">
        ${label ? `<div class="svc-board-subgroup-control-label">${escapeHtml(label)}</div>` : ""}
        <div class="service-offering-toolbar">
          ${renderServiceOfferingSpecialToggle(context.item, context.service)}
          ${renderPresenterBoardItemActions(serviceId, context, { commitOnly: true })}
        </div>
        ${controls}
        <div class="service-offering-tools">${renderPresenterBoardItemActions(serviceId, context, { omitCommit: true })}</div>
        ${audioManager}
      </div>`;
    return `
      <div class="svc-board-subgroup-control-item${!options.headerActions && !label && ["lyrics_db", "score_db"].includes(servicePraiseInputMode(context.item)) ? " svc-inline-song" : ""}" data-service-id="${escapeAttr(serviceId)}" data-service-item-id="${escapeAttr(context.item.id || "")}" data-service-item-index="${escapeAttr(String(context.index))}">
        ${label ? `<div class="svc-board-subgroup-control-head"><span class="svc-board-subgroup-control-label">${escapeHtml(label)}</span>${dbLink}${renderPresenterBoardItemActions(serviceId, context)}</div>` : ""}
        ${audioLed ? audioManager : ""}
        ${controls}
        ${options.headerActions || label ? "" : renderPresenterBoardItemActions(serviceId, context)}
        ${audioLed ? "" : audioManager}
      </div>`;
  }).filter(Boolean);
  if (!blocks.length) return "";
  const first = contexts[0];
  return `
    <div class="svc-board-subgroup-controls${blocks.length > 1 ? " svc-board-subgroup-controls--stacked" : ""}" aria-label="${escapeAttr(`${first?.item?.label || "항목"} 입력`)}">
      ${blocks.join("")}
    </div>`;
}

function presenterBoardSubgroupDisplay(serviceId, subgroup = {}) {
  const fallback = {
    label: String(subgroup.label || "").trim(),
    title: String(subgroup.title || "").trim(),
  };
  const contexts = presenterBoardSubgroupInputContexts(serviceId, subgroup);
  const item = contexts.length === 1 ? contexts[0]?.item : null;
  if (item && !serviceItemConnectedPraise(item)
      && !isMonthlyCorporatePrayerGroupItem(item, parseServiceItemMemo(item.memo))) {
    const parts = serviceItemSummaryDisplayParts(item, contexts[0].service);
    return { label: parts.meta, title: parts.title };
  }
  if (item && isAnnouncementTextInputItem(item)) fallback.title = "";
  if (serviceElementDisplayLabel(fallback.label) !== fallback.label) {
    return { ...fallback, label: serviceElementDisplayLabel(fallback.label) };
  }
  const sectionFallbackLabel = presenterBoardSectionFallbackLabelForContext(contexts[0], fallback.label);
  if (contexts.length === 1 && sectionFallbackLabel) {
    return {
      ...fallback,
      label: sectionFallbackLabel,
    };
  }
  const connectedContexts = contexts.filter((context) =>
    context?.item && serviceItemConnectedPraise(context.item));
  if (connectedContexts.length < 2) return fallback;
  const connected = serviceItemConnectedPraise(connectedContexts[0].item);
  const label = serviceItemConnectedPraiseOrderTitle(connectedContexts[0].item, connected)
    || fallback.label;
  const connectedTitle = String(connected?.title || "").trim();
  const title = connectedTitle || presenterBoardConnectedPraiseItemTitles(connectedContexts).join(" + ");
  return {
    label: label || fallback.label,
    title: title || fallback.title,
  };
}

function presenterBoardSectionFallbackLabelForContext(context = null, label = "") {
  const itemLabel = String(context?.item?.label || "").trim();
  const labelKey = compactSearchValue(label);
  const itemLabelKey = compactSearchValue(itemLabel);
  if (!itemLabel || !labelKey || !itemLabelKey || labelKey === itemLabelKey) return "";
  const item = context.item || {};
  const sectionTitleKey = compactSearchValue(item._worshipSectionTitle || item.sectionTitle || item.section_label || "");
  const canonicalSectionKey = compactSearchValue(serviceCanonicalSectionTitle(item._worshipSectionKey || item.section_key || ""));
  if (labelKey !== sectionTitleKey && labelKey !== canonicalSectionKey) return "";
  return itemLabel;
}

function presenterBoardConnectedPraiseItemTitles(contexts = []) {
  const seen = new Set();
  return contexts
    .map((context) => {
      const item = context?.item || {};
      const linkedTitle = String(serviceItemLinkedSong(item)?.title || "").trim();
      const rawTitle = String(item.raw_title || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find(Boolean) || "";
      return linkedTitle || rawTitle;
    })
    .map((title) => String(title || "").trim())
    .filter((title) => {
      const key = compactSearchValue(title);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function renderPresenterBoardItemAudioControls(serviceId, context = {}, options = {}) {
  if (!context || !serviceItemSupportsHeaderAudio(context.item)) return "";
  const memo = parseServiceItemMemo(context.item.memo);
  const childrenAudio = servicePraiseInputMode(context.item, memo) === "children_audio";
  const audioAsset = normalizeServiceAudioAsset(childrenAudio ? null : memo.audioAsset);
  const entries = (context.timingEntries || []).filter(({ slide }) =>
    (slide.songTimingElementId || slide.progressionParentId || slide.elementId) === context.item.id);
  const timingAudio = globalThis.MindexSongTiming?.audioFor(entries, context.item.id);
  const source = String(audioAsset.url || timingAudio?.url || "").trim();
  if (Boolean(source) !== Boolean(options.manager)) return "";
  const label = audioAsset.url ? audioAsset.name || "연결된 음원" : timingAudio?.name || "연결된 음원";
  return `
    <div class="svc-board-subgroup-audio${source ? " has-audio svc-audio-manager" : ""}${childrenAudio ? " svc-children-audio" : ""}" aria-label="${escapeAttr(`${context.item.label || "찬양"} 음원 관리`)}">
      ${source ? `
        <strong title="${escapeAttr(label)}">${escapeHtml(label)}</strong>
        ${renderPresenterInputAudioControls(source, label, serviceId, context.item.id, entries.some(({slide}) => slide.syncTimeline?.localTiming))}` : ""}
      ${childrenAudio ? globalThis.MindexSongTiming?.statusMarkup(context, entries) || (source ? '<span class="svc-children-audio-hint">송출 중 제목에서 <kbd>P</kbd> 재생</span>' : "") : ""}
      <div class="svc-board-subgroup-audio-actions">
        ${!source && servicePraiseInputMode(context.item) === "children_audio" ? `<button class="btn secondary" type="button" data-song-timing-open data-service-id="${escapeAttr(serviceId)}" data-element-id="${escapeAttr(context.item.id)}">버전 음원·타이밍</button>` : ""}
        ${source ? globalThis.MindexSongTiming?.controls(serviceId, entries, { audioSource: source }) || "" : ""}
        ${audioAsset.url ? `<button class="icon-btn" type="button" data-service-item-audio-clear
            data-service-id="${escapeAttr(serviceId)}" data-service-item-index="${context.index}"
          aria-label="음원 연결 해제" title="음원 연결 해제"><i data-lucide="x"></i></button>` : ""}
        ${childrenAudio ? "" : `<label class="svc-board-subgroup-audio-upload" title="${source ? "음원 교체" : "음원 추가"}">
          <input type="file" accept="${SERVICE_ITEM_AUDIO_ACCEPT}" data-service-item-audio-file
            data-service-id="${escapeAttr(serviceId)}" data-service-item-index="${context.index}" />
          <span>${source ? "교체" : "음원"}</span>
        </label>`}
      </div>
    </div>`;
}

function presenterBoardSubgroupItemContext(serviceId, subgroup = {}) {
  const service = state.services.find((svc) => svc.id === serviceId);
  if (!service) return null;
  const subgroupId = String(subgroup.id || "").trim();
  const elementId = subgroupId.startsWith("connected-praise:")
    ? String(subgroup.slides?.[0]?.slide?.elementId || "").trim()
    : String(subgroupId || subgroup.slides?.[0]?.slide?.elementId || "").trim();
  if (!elementId) return null;
  const items = getServiceItems(serviceId);
  const itemIndex = items.findIndex((item) => String(item.id || "") === elementId);
  if (itemIndex < 0) return null;
  const item = items[itemIndex];
  return {
    service,
    item,
    index: Number.isInteger(item._origIndex) ? item._origIndex : itemIndex,
  };
}

function presenterBoardSubgroupInputContext(serviceId, subgroup = {}) {
  const context = presenterBoardSubgroupItemContext(serviceId, subgroup);
  if (!context || !presenterServiceInputHasEditableField(context.item, context.service)) return null;
  return context;
}

function presenterBoardSubgroupInputContexts(serviceId, subgroup = {}) {
  const service = state.services.find((svc) => svc.id === serviceId);
  if (!service) return [];
  const items = getServiceItems(serviceId);
  const ids = [...new Set((subgroup.slides || [])
    .flatMap(({ slide }) => {
      const connected = normalizeServiceConnectedPraise(slide?.connectedPraise || slide?.connected_praise);
      return [
        slide?.elementId,
        connected?.primaryItemId,
        ...(connected?.itemIds || []),
        ...(connected?.secondaryItemIds || []),
      ];
    })
    .map((id) => String(id || "").trim())
    .filter(Boolean))];
  if (!ids.length) {
    const context = presenterBoardSubgroupInputContext(serviceId, subgroup);
    return context ? [context] : [];
  }
  return ids
    .map((id) => {
      const itemIndex = items.findIndex((item) => String(item.id || "") === id);
      if (itemIndex < 0) return null;
      const item = items[itemIndex];
      const context = {
        service,
        item,
        index: Number.isInteger(item._origIndex) ? item._origIndex : itemIndex,
      };
      return presenterServiceInputHasEditableField(item, service) ? context : null;
    })
    .filter(Boolean);
}

function presenterWarningsForEntries(entries = []) {
  const seen = new Set();
  return entries
    .flatMap((entry) => Array.isArray(entry?.slide?.warnings) ? entry.slide.warnings : [])
    .map((warning) => String(warning || "").trim())
    .filter((warning) => {
      const key = compactSearchValue(warning);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function renderPresenterWarnings(warnings = []) {
  if (!warnings.length) return "";
  return `<span class="svc-presenter-warnings">${
    warnings.map((warning) => `<span class="svc-presenter-warning">${escapeHtml(warning)}</span>`).join("")
  }</span>`;
}

function presenterVisibleTitle(label, title) {
  const cleanTitle = String(title || "").trim();
  // Titles stay in the model; the header just does not print the label twice.
  return compactSearchValue(cleanTitle) === compactSearchValue(label) ? "" : cleanTitle;
}

// Controller-only grouping: preserve slide objects, indexes and output order.
function presenterBoardSlideBlocks(entries = []) {
  const scoreSlide = slide => String(slide?.sourceType || slide?.componentType || "").toLowerCase() === "score";
  const namedScoreOwners = new Set(entries.filter(entry => scoreSlide(entry.slide)
    && (entry.controllerFormLabel || presenterFormGroupLabel(entry.slide)))
    .map(entry => presenterSlideElementGroupKey(entry.slide) || ""));
  const blocks = [];
  for (const entry of entries) {
    const slide = entry.slide;
    if (slide?.controllerEditorOnly) continue;
    const owner = presenterSlideElementGroupKey(slide) || "";
    let key = "";
    let label = "";
    if (presenterSlideElementType(slide) === PRESENTER_ELEMENT_TYPES.SCRIPTURE_TEXT) {
      label = [slide.referenceBook, slide.referenceRange].filter(Boolean).join(" ") || slide.title || "본문";
      key = JSON.stringify([owner, "scripture", label, slide.translationLabel || ""]);
    } else if (scoreSlide(slide) && owner && !namedScoreOwners.has(owner)) {
      label = "악보";
      key = JSON.stringify([owner, "score-whole"]);
    } else if (presenterSlideSupportsFormGrouping(slide, entry.controllerFormLabel || presenterFormGroupLabel(slide)) && (entry.controllerFormKey || slide.formKey)
        && (entry.controllerFormLabel || presenterFormGroupLabel(slide))) {
      label = entry.controllerFormLabel || presenterFormGroupLabel(slide) || "송폼";
      key = JSON.stringify([owner, "form", entry.controllerFormKey || slide.formKey]);
    }
    const previous = blocks[blocks.length - 1];
    if (key && previous?.key === key) previous.entries.push(entry);
    else blocks.push({ key, label, entries: [entry] });
  }
  return blocks;
}

function renderPresenterBoardSlideBlocks(entries, activeIndex, serviceId, scriptureColorStart = 0) {
  let scriptureIndex = scriptureColorStart;
  return presenterBoardSlideBlocks(entries).map((block) => {
    const scripture = presenterSlideElementType(block.entries[0]?.slide) === PRESENTER_ELEMENT_TYPES.SCRIPTURE_TEXT;
    const formType = normalizePresenterFormPresetLabel(block.label).type;
    const plain = !scripture && ["title", "instrumental", "lyrics"].includes(formType);
    const color = scripture
      ? (scriptureIndex++ % 2 === 0 ? "default" : "accent")
      : ["verse", "pre-chorus", "chorus", "bridge", "coda", "tag"].includes(formType) ? formType : "neutral";
    const colorAttribute = block.key && !plain ? ` data-${scripture ? "scripture-tone" : "form-color"}="${color}"` : "";
    const thumbs = block.entries.map(({ slide, slideIndex, formLabel }) =>
      renderPresenterSlideThumb(slide, slideIndex, activeIndex, serviceId, formLabel)).join("");
    return block.key
      ? `<div class="svc-board-slide-block"${plain ? ' data-form-plain="true"' : colorAttribute} role="group" aria-label="${escapeAttr(block.label)}">${thumbs}</div>`
      : thumbs;
  }).join("");
}

function updatePresenterBoardBlockBackgrounds(host = refs.detailPane) {
  if (!host?.querySelectorAll) return;
  for (const grid of host.querySelectorAll(".svc-board-grid")) {
    const origin = grid.getBoundingClientRect();
    if (!origin.width) continue;
    for (const block of grid.querySelectorAll(":scope > .svc-board-slide-block")) {
      if (block.dataset.formPlain === "true" || block.dataset.scriptureTone) {
        block.querySelectorAll(":scope > .svc-board-block-background").forEach(background => background.remove());
        continue;
      }
      const rows = [];
      for (const thumb of block.querySelectorAll(":scope > .svc-slide-thumb-wrap")) {
        const rect = thumb.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        let row = rows.find((candidate) => Math.abs(candidate.top - rect.top) < 1);
        if (!row) rows.push(row = { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom });
        else { row.right = Math.max(row.right, rect.right); row.bottom = Math.max(row.bottom, rect.bottom); }
      }
      const backgrounds = [...block.querySelectorAll(":scope > .svc-board-block-background")];
      rows.forEach((row, index) => {
        const background = backgrounds[index] || document.createElement("span");
        background.className = "svc-board-block-background";
        background.setAttribute("aria-hidden", "true");
        const css = `left:${row.left - origin.left}px;top:${row.top - origin.top}px;width:${row.right - row.left}px;height:${row.bottom - row.top}px`;
        if (background.dataset.geometry !== css) {
          background.style.cssText = css;
          background.dataset.geometry = css;
        }
        if (!background.parentNode) block.append(background);
      });
      backgrounds.slice(rows.length).forEach((background) => background.remove());
    }
  }
}

function annotatePresenterFormStarts(entries = [], initialPreviousKey = "") {
  const lyricsLabelOwners = new Set();
  let previousKey = initialPreviousKey;
  let previousSourceKey = initialPreviousKey;
  let currentFormLabel = "";
  let scoreKey = "";
  let scoreLabel = "";
  let previousOwner = "";
  const annotatedEntries = entries.map((entry) => {
    const { slide, slideIndex } = entry;
    const owner = presenterSlideElementGroupKey(slide) || "";
    const score = String(slide.sourceType || slide.componentType || "").toLowerCase() === "score";
    if (!score || owner !== previousOwner) { scoreKey = ""; scoreLabel = ""; }
    if (score && slide.formKey) { scoreKey = slide.formKey; scoreLabel = presenterFormGroupLabel(slide); }
    previousOwner = owner;
    let controllerFormKey = score ? scoreKey : slide.formKey;
    const controllerFormLabel = score ? scoreLabel : presenterFormGroupLabel(slide)
      || (controllerFormKey && previousSourceKey === `${owner}:form:${controllerFormKey}` ? currentFormLabel : "");
    previousSourceKey = controllerFormKey ? `${owner}:form:${controllerFormKey}` : "";
    const lyrics = !score && normalizePresenterFormPresetLabel(controllerFormLabel).type === "lyrics";
    if (lyrics) controllerFormKey = "lyrics";
    const formSlide = presenterSlideSupportsFormGrouping(slide, controllerFormLabel) && (!score || (controllerFormKey && controllerFormLabel));
    const key = formSlide ? `${owner}:form:${controllerFormKey || slideIndex}` : "";
    const startsForm = Boolean(formSlide && key !== previousKey);
    currentFormLabel = startsForm ? controllerFormLabel : formSlide ? currentFormLabel : "";
    previousKey = key;
    const showLabel = startsForm && (!lyrics || !lyricsLabelOwners.has(owner));
    if (lyrics) lyricsLabelOwners.add(owner);
    return {
      ...entry, formLabel: showLabel ? currentFormLabel : "",
      controllerFormKey, controllerFormLabel,
    };
  });
  return { entries: annotatedEntries, lastKey: previousKey };
}

function presenterSlideSupportsFormGrouping(slide, formLabel = presenterFormGroupLabel(slide)) {
  if (!slide) return false;
  if (normalizePresenterFormPresetLabel(formLabel).type === "instrumental") return true;
  if (normalizePresenterFormPresetLabel(slide.formLabel).type === "title" && String(slide.formKey || "").startsWith("title:")) return true;
  const praiseLowerBar = presenterSlideElementType(slide) === PRESENTER_ELEMENT_TYPES.PRAISE
    && presenterSlideLayout(slide) === PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT;
  if (praiseLowerBar && formLabel) return true;
  const sourceType = String(slide.sourceType || slide.componentType || "").trim().toLowerCase();
  return sourceType === "score";
}

function presenterFormGroupLabel(slide) {
  if (slide?.autoTrailingBlank) return "";
  const label = String(slide?.formLabel || slide?.marker || "").trim();
  if (isGenericPresenterFormLabel(label)) return "";
  const form = normalizePresenterFormPresetLabel(label);
  if (form.type === "title") return "Title";
  if (form.type === "instrumental") return "Interlude";
  const singleType = Array.isArray(slide?.controllerSingleFormTypes)
    && slide.controllerSingleFormTypes.includes(form.type);
  if ((singleType || (slide?.controllerSingleVerse && form.type === "verse"))
    && form.number === 1 && !form.group && !form.variant) {
    return { verse: "Verse", chorus: "Chorus", "pre-chorus": "Pre-Chorus", bridge: "Bridge" }[form.type]
      || songFormPresetDisplayLabel(label)
      || label;
  }
  return songFormPresetDisplayLabel(label) || label;
}

function presenterLabelDuplicatesSlideText(label, slide) {
  const normalizedLabel = normalizeTitle(label);
  if (!normalizedLabel) return true;
  const candidates = [
    slide?.title,
    slide?.text,
    ...String(slide?.text || "")
      .split(/\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  ];
  return candidates.some((candidate) => normalizeTitle(candidate) === normalizedLabel);
}

function renderPresenterSlideThumb(slide, slideIndex, activeIndex, serviceId, formLabel = "") {
  if (slide.controllerEditorOnly) return "";
  const active = slideIndex === activeIndex;
  const hidden = Boolean(slide?.hiddenInPresentation || slide?.hidden_in_presentation || slide?.hidden);
  const elementKey = presenterSlideElementGroupKey(slide) || `slide:${slideIndex}`;
  const slideId = String(slide?.id || "").trim();
  const selected = state.presenterBoardSelection.serviceId === serviceId
    && state.presenterBoardSelection.elementKey === elementKey
    && (state.presenterBoardSelection.indexes || []).map(Number).includes(slideIndex);
  const formType = normalizePresenterFormPresetLabel(formLabel).type;
  const normalizedFormLabel = ({ lyrics: "Lyrics", title: "Title", instrumental: "Interlude" })[formType]
    || songFormPresetDisplayLabel(formLabel) || String(formLabel || "").trim();
  const visibleFormLabel = formType !== "instrumental" && presenterLabelDuplicatesSlideText(normalizedFormLabel, slide) ? "" : normalizedFormLabel;
  const ariaPrefix = presenterSlideInteractionHint(serviceId, `${slideIndex + 1}번 슬라이드${hidden ? " · 숨김" : ""}`);
  const slideNumber = slideIndex + 1;
  const formBadge = visibleFormLabel ? `
      <button class="svc-slide-form-badge" type="button"
        data-form-type="${escapeAttr(normalizeSongFormPresetLabel(visibleFormLabel).type)}"
        data-presenter-action="jump"
        data-presenter-index="${slideIndex}"
        data-service-id="${escapeAttr(serviceId)}"
        aria-label="${escapeAttr(visibleFormLabel)}">
        ${escapeHtml(visibleFormLabel)}
      </button>` : "";
  const scriptureReference = presenterSlideScriptureReferenceBadge(slide);
  const scriptureReferenceBadge = !visibleFormLabel && scriptureReference ? `
      <button class="svc-slide-form-badge svc-slide-scripture-reference" type="button"
        data-presenter-action="jump"
        data-presenter-index="${slideIndex}"
        data-service-id="${escapeAttr(serviceId)}"
        aria-label="${escapeAttr(scriptureReference)}">
        ${escapeHtml(scriptureReference)}
      </button>` : "";
  return `
    <span class="svc-slide-thumb-wrap${active ? " active" : ""}${selected ? " selected" : ""}${hidden ? " hidden" : ""}${visibleFormLabel ? " has-form-label" : ""}">
      <span class="svc-slide-thumb-meta">
        ${formBadge || scriptureReferenceBadge}
        <span class="svc-slide-thumb-no" aria-hidden="true">${slideNumber}</span>
      </span>
      <button class="svc-slide-thumb${active ? " active" : ""}${selected ? " selected" : ""}" type="button"
        data-presenter-action="jump"
        data-presenter-index="${slideIndex}"
        data-presenter-element-key="${escapeAttr(elementKey)}"
        data-presenter-slide-id="${escapeAttr(slideId)}"
        data-service-id="${escapeAttr(serviceId)}"
        aria-pressed="${selected ? "true" : "false"}"
        ${active ? 'aria-current="step"' : ""}
        aria-label="${escapeAttr(`${ariaPrefix}: ${presenterSlideTitle(slide)}`)}"
        title="${escapeAttr(ariaPrefix)}">
        <span class="svc-slide-thumb-frame svc-slide-thumb-frame--${escapeAttr(presenterSlideRenderClass(slide))}" data-element-type="${escapeAttr(presenterSlideElementType(slide))}" data-slide-layout="${escapeAttr(presenterSlideLayout(slide))}">
          ${renderPresenterSlideMiniPreview(slide, serviceId)}
        </span>
      </button>
    </span>`;
}

function presenterSlideScriptureReferenceBadge(slide = {}) {
  if (presenterSlideElementType(slide) !== PRESENTER_ELEMENT_TYPES.SCRIPTURE_TEXT) return "";
  if (presenterSlideLayout(slide) === PRESENTER_SLIDE_LAYOUTS.BLANK || slide.scripturePending) return "";
  const parts = typeof presenterScriptureVerseParts === "function"
    ? presenterScriptureVerseParts(slide.text || "")
    : { number: "" };
  const number = String(parts.number || "").trim();
  const chapter = String(slide.referenceRange || "").match(/^(\d+)/)?.[1] || "";
  const rawBook = String(slide.referenceBook || "").trim();
  const book = presenterScriptureReferenceBadgeBookName(rawBook, slide);
  if (book && chapter && number) return [book, `${chapter}:${number}`].filter(Boolean).join(" ").trim();
  const inlineReference = String(slide.text || "").trim().match(/^([^\s\d:;,.]+)\s+(\d+):(\d+(?:[–~-]\d+)?)/);
  if (inlineReference) {
    const inlineBook = presenterScriptureReferenceBadgeBookName(inlineReference[1]);
    return `${inlineBook || inlineReference[1]} ${inlineReference[2]}:${inlineReference[3]}`.trim();
  }
  const referenceRange = String(slide.referenceRange || "").trim();
  if (book && referenceRange) return [book, referenceRange].filter(Boolean).join(" ").trim();
  const parsed = typeof parseBibleReference === "function"
    ? parseBibleReference(slide.title || slide.marker || slide.elementTitle || "")
    : null;
  if (parsed?.book && parsed?.chapter) {
    const parsedBook = presenterScriptureReferenceBadgeBookName(parsed.book.koreanName || parsed.book.shortName || parsed.book.code);
    const parsedVerse = parsed.verse
      ? `${parsed.chapter}:${parsed.verse}${parsed.verseEnd ? `–${parsed.verseEnd}` : ""}`
      : `${parsed.chapter}장`;
    return [parsedBook, parsedVerse].filter(Boolean).join(" ").trim();
  }
  return "";
}

function presenterScriptureReferenceBadgeBookName(rawBook = "", slide = null) {
  const explicitFullName = String(slide?.referenceBookFull || "").trim();
  if (explicitFullName) return explicitFullName;
  const raw = String(rawBook || "").trim();
  if (!raw) return "";
  const book = typeof findBibleBookByReferenceName === "function"
    ? findBibleBookByReferenceName(raw)
    : null;
  const knownFullName = typeof KOREAN_BIBLE_BOOK_NAMES === "object" && book?.code
    ? KOREAN_BIBLE_BOOK_NAMES[book.code]
    : "";
  return String(book?.koreanName || knownFullName || raw).trim();
}

// Built-in print-resolution PNGs are expensive to decode during WebKit paint.
// Only miniature backgrounds use derived assets; output and custom sources retain
// their originals. Exact origin/path matching must not rewrite an uploaded URL.
function presenterPreviewBackgroundSource(source) {
  try {
    const url = new URL(source, document.baseURI);
    const directory = new URL("assets/worship-backgrounds/", document.baseURI);
    const name = url.pathname.slice(directory.pathname.length);
    if (url.origin !== directory.origin || !url.pathname.startsWith(directory.pathname)
      || !WORSHIP_BACKGROUND_STATIC_FILES.has(name)) return source;
    url.pathname = `${directory.pathname}previews/${name.replace(/\.png$/i, ".webp")}`;
    return url.href;
  } catch { return source; }
}

function renderPresenterSlideMiniPreview(slide, serviceId = state.presenter.serviceId) {
  const service = state.services.find((svc) => svc.id === serviceId);
  const serviceChromakey = presenterServiceUsesChromakey(service);
  const previewSlide = normalizePresenterMiniPreviewSlide(slide, serviceChromakey);
  const backgroundImages = presenterBackgroundSourcesForService(service, {
    includeChromakeyCleanSlides: presenterSlideOutputContext(previewSlide, serviceChromakey) === "clean",
  });
  const theme = presenterOutputTheme(service?.type_id);
  const frameState = presenterOutputFrameStateForSlide(previewSlide, {
    chromakey: serviceChromakey,
    backgroundImages,
    serviceType: service?.type_id || "",
    outputTheme: theme,
  });
  const frameClasses = presenterOutputFrameClassNames(frameState);
  const backgroundStyle = presenterOutputFrameBackgroundStyle({
    ...frameState,
    backgroundImages: frameState.backgroundImages.map(presenterPreviewBackgroundSource),
  });
  const outputClasses = [
    "svc-slide-mini-output",
    frameClasses,
  ].filter(Boolean).join(" ");
  const canvasClasses = [
    "svc-slide-mini-canvas",
    "presenter-output-root",
    frameClasses,
  ].filter(Boolean).join(" ");
  if (!slide) {
    return `<span class="${escapeAttr(outputClasses)}"><span class="${escapeAttr(canvasClasses)}" data-output-theme="${escapeAttr(theme)}" ${presenterBackgroundInkAttributes(frameState)}${backgroundStyle}></span></span>`;
  }
  return `
    <span class="${escapeAttr(outputClasses)}">
      <span class="${escapeAttr(canvasClasses)}" data-output-theme="${escapeAttr(theme)}" ${presenterBackgroundInkAttributes(frameState)}${backgroundStyle}>
        ${renderPresenterSlideFrame(previewSlide, { noChromakey: frameState.noChromakey, previewStage: true, transitionLogo: serviceRawSourceRef(service).transitionLogo, presentationDesign: serviceRawSourceRef(service).presentationDesign })}
      </span>
    </span>`;
}

function normalizePresenterMiniPreviewSlide(slide = null, serviceChromakey = true) {
  if (!(slide = presenterKeynoteHtmlPreviewSlide(slide))) return slide;
  const outputContext = presenterSlideOutputContext(slide, serviceChromakey);
  const normalizedSlide = outputContext === "clean"
    ? normalizeCleanPresenterSlideLayout(slide)
    : normalizeChromakeyPresenterSlideLayout(slide);

  return normalizedSlide;
}

function presenterMediaFileName(source) {
  const text = String(source || "").split(/[?#]/)[0];
  const parts = text.split("/");
  return parts[parts.length - 1] || source;
}

function presenterFileDisplayTitle(slide, fallback = "파일") {
  const title = String(slide?.title || "").trim();
  if (title && !isLegacyImportArtifactName(title) && !isLegacyPresentationLabel(title)) return title;
  const assetName = String(slide?.asset?.name || "").trim();
  if (assetName && !isLegacyImportArtifactName(assetName) && !isLegacyPresentationLabel(assetName)) return assetName;
  const fileName = presenterMediaFileName(slide?.asset?.url);
  if (fileName && !isLegacyImportArtifactName(fileName) && !isLegacyPresentationLabel(fileName)) return fileName;
  return fallback;
}

function presenterFileTypeLabel(type = "") {
  const normalized = String(type || "").trim().toLowerCase();
  if (normalized === "score") return "악보";
  if (normalized === "audio") return "오디오";
  if (normalized === "youtube") return "YouTube";
  if (normalized === "video") return "동영상";
  return normalized === "pdf" ? "PDF 파일" : "파일";
}

function isLegacyPresentationLabel(value) {
  return /^(?:pptx?|powerpoint|keynote|key)$/i.test(String(value || "").trim());
}

function presenterSlideTitle(slide) {
  if (!slide) return "프레젠터 준비";
  const marker = presenterSlideMarker(slide);
  const renderClass = presenterSlideRenderClass(slide);
  if (renderClass === "lyrics") return marker || slide.title || "Lyrics";
  if (presenterSlideLayout(slide) === PRESENTER_SLIDE_LAYOUTS.FILE) {
    const typeLabel = presenterFileTypeLabel(slide.sourceType || slide.componentType || slide.asset?.kind || "file");
    return cleanList([marker, presenterFileDisplayTitle(slide, typeLabel)]).join(" — ") || typeLabel;
  }
  const text = renderClass === "lyrics" ? slide.title : presenterSlideMainText(slide);
  return cleanList([marker, text]).join(" — ") || "제목 없는 슬라이드";
}

function presenterSlideMarker(slide) {
  if (presenterSlideRenderClass(slide) === "lyrics") return slide?.marker || "";
  return [slide?.marker, slide?.label].filter(Boolean).join(" · ");
}

function presenterSlideMainText(slide) {
  return slide?.text || slide?.title || "";
}

function findPresenterJumpInput(serviceId = state.presenter.serviceId) {
  const scopes = [refs.rightSidebar, refs.detailPane, document].filter(Boolean);
  for (const scope of scopes) {
    const input = [...scope.querySelectorAll("[data-presenter-jump-input]")]
      .find((candidate) => candidate.dataset.serviceId === serviceId);
    if (input) return input;
  }
  return null;
}

function setPresenterJumpDraft(value, serviceId = state.presenter.serviceId) {
  if (!serviceId) return;
  const draft = String(value || "").replace(/\D/g, "").slice(0, PRESENTER_JUMP_MAX_DIGITS);
  state.presenter.jumpDraft = draft;
  const input = findPresenterJumpInput(serviceId);
  if (input) input.value = draft;
}

function clearPresenterJumpDraft(serviceId = state.presenter.serviceId) {
  state.presenter.jumpDraft = "";
  const input = findPresenterJumpInput(serviceId);
  if (input) {
    const count = state.presenter.serviceId === serviceId
      ? state.presenter.slides.length
      : buildServicePresenterSlides(serviceId).length;
    input.value = state.presenter.serviceId === serviceId && state.presenter.safetyBlank
      ? "0"
      : count ? String(clampPresenterIndex(state.presenter.index, count) + 1) : "";
  }
}

function commitPresenterJumpDraft(serviceId = state.presenter.serviceId, options = {}) {
  if (!serviceId || !state.presenter.jumpDraft) return;
  const requested = Number(state.presenter.jumpDraft);
  if (!Number.isFinite(requested)) return;
  state.presenter.jumpDraft = "";
  const index = requested - 1;
  runPresenterAction("jump", serviceId, { index, scroll: false, focusActiveSlide: options.focusActiveSlide === true });
  if (isValidPresenterIndex(index, state.presenter.slides.length)) {
    scrollPresenterBoardToIndex(serviceId, index, { force: true });
  } else {
    clearPresenterJumpDraft(serviceId);
  }
}

function presenterBoardFocusShouldFollowLiveSlide(serviceId = state.presenter.serviceId) {
  const thumb = document.activeElement?.closest?.(".svc-slide-thumb[data-presenter-index][data-service-id]");
  return Boolean(thumb && thumb.dataset.serviceId === serviceId);
}

function focusPresenterBoardLiveSlide(serviceId, index) {
  if (!serviceId || !Number.isInteger(index) || index < 0) return;
  window.requestAnimationFrame(() => {
    // A newer navigation or a move to another control owns focus now.
    if (state.module !== "presenter" || state.selectedServiceId !== serviceId
      || state.presenter.serviceId !== serviceId || state.presenter.index !== index
      || state.presenter.safetyBlank
      || (document.activeElement !== document.body && !presenterBoardFocusShouldFollowLiveSlide(serviceId))) return;
    const root = document.getElementById("servicePresenterControls");
    const thumb = root?.querySelector(
      `.svc-slide-thumb[data-service-id="${CSS.escape(serviceId)}"][data-presenter-index="${CSS.escape(String(index))}"]`,
    );
    thumb?.focus({ preventScroll: true });
  });
}


// Remaining authored text uses the same stage grid in output and thumbnails.
function fitPresenterSupplementalText(host) {
  const headers = [...host.querySelectorAll(".presenter-scripture-reading-ref, .presenter-scripture-reading-version")];
  headers.forEach(box => box.style.removeProperty("font-size"));
  headers.forEach(box => fitPresenterTextBox(box, {role:"title"}));
  host.querySelectorAll(".presenter-assignee-tab, .presenter-fullscreen-song-detail, .presenter-title-content-body:not(.presenter-slide--liturgical-body .presenter-title-content-body), .presenter-ready-screen-message, .presenter-waiting-loop-title, .presenter-slide[data-element-type='freeform'] > .presenter-slide-text")
    .forEach(box => {
      // Tight existing body line-height can put font ink below its line box.
      // Measure the authored lines, as titles already do, not that ink fringe.
      let measure = null;
      if (box.matches(".presenter-ready-screen-message, .presenter-waiting-loop-title, .presenter-slide[data-element-type='freeform'] > .presenter-slide-text")) {
        measure = box.cloneNode(true);
        measure.style.cssText = `position:absolute;visibility:hidden;pointer-events:none;width:${box.clientWidth}px;height:auto;max-height:none;min-height:0`;
        box.parentNode.appendChild(measure);
      }
      const fits = box.matches(".presenter-title-content-body") ? () => {
        const bounds = box.getBoundingClientRect();
        const tolerance = (box.closest(".presenter-output-root")?.getBoundingClientRect().width || 1920) / 1920;
        return box.scrollWidth <= box.clientWidth + presenterTextFitScale(box)
          && [...box.children].every(line => {
            const rect = line.getBoundingClientRect();
            return rect.top >= bounds.top - tolerance && rect.bottom <= bounds.bottom + tolerance;
          });
      } : measure ? () => {
        measure.style.width = `${box.clientWidth}px`;
        measure.style.fontSize = getComputedStyle(box).fontSize;
        return measure.scrollWidth <= box.clientWidth + presenterTextFitScale(box)
          && measure.clientHeight <= box.clientHeight + presenterTextFitScale(box);
      } : () => presenterTextFits(box);
      try { fitPresenterTextBox(box, {fits}); }
      finally { measure?.remove(); }
    });
}

