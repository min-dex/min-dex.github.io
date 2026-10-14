// PPTX is an existing imported_deck asset, not a second worship document model.
let presenterPptxRuntimePromise = null;
const presenterPptxDeckCache = new Map();
const presenterPptxImports = new Set();
const PRESENTER_PPTX_MAX_BYTES = 50 * 1024 * 1024;

function presenterPptxRuntime() {
  if (!presenterPptxRuntimePromise) {
    presenterPptxRuntimePromise = Promise.all([
      import("./vendor/web-ppt-0.4.5/core.js"),
      import("./vendor/web-ppt-0.4.5/viewer-core.js"),
    ]).then(([core, viewer]) => ({ ...core, Viewer: viewer.Viewer }))
      .catch(error => { presenterPptxRuntimePromise = null; throw error; });
  }
  return presenterPptxRuntimePromise;
}

function presenterPptxKey(slide) {
  return slide?.pptx?.url ? `${slide.id}|${slide.pptx.url}|${slide.pptx.page}` : "";
}

function presenterPptxStep(owner, slide = owner.slides?.[owner.index]) {
  if (!slide?.pptx || owner.pptxProgress?.key !== presenterPptxKey(slide)) return 0;
  return Math.min(slide.pptx.clicks, Math.max(0, Math.floor(Number(owner.pptxProgress.step) || 0)));
}

function advancePresenterPptx(owner, delta) {
  const slide = owner.slides?.[owner.index];
  const step = presenterPptxStep(owner, slide);
  if (slide?.pptx && ((delta > 0 && step < slide.pptx.clicks) || (delta < 0 && step > 0))) {
    owner.pptxProgress = { key: presenterPptxKey(slide), step: step + (delta > 0 ? 1 : -1) };
    return true;
  }
  owner.pptxProgress = null;
  return false;
}

async function parsePresenterPptx(bytes) {
  if (!bytes.byteLength || bytes.byteLength > PRESENTER_PPTX_MAX_BYTES) throw new Error("PPTX는 50MB 이하로 선택해 주세요.");
  if (bytes[0] !== 80 || bytes[1] !== 75) throw new Error("암호가 없는 PPTX 파일로 다시 저장해 주세요.");
  const runtime = await presenterPptxRuntime();
  const deck = await runtime.parse(bytes, { lazy: false });
  try {
    if (!deck.slides.length || deck.slides.length > 300) throw new Error("PPT는 1~300장 범위로 나누어 넣어 주세요.");
    // Never fetch externally linked images/media while inspecting a local deck.
    const inspect = value => {
      if (!value || typeof value !== "object") return;
      if (typeof value.src === "string" && /^(https?:|\/\/|file:)/i.test(value.src)) {
        throw new Error("외부 연결 이미지·영상은 PPT 안에 포함한 뒤 다시 선택해 주세요.");
      }
      for (const child of Object.values(value)) if (child && typeof child === "object") inspect(child);
    };
    deck.slides.forEach(inspect);
    return { deck, runtime };
  } catch (error) { deck.dispose?.(); throw error; }
}

async function loadPresenterPptx(url) {
  const source = new URL(url, location.href);
  if (!["https:", "http:", "blob:"].includes(source.protocol)) throw new Error("PPT 파일 주소를 확인해 주세요.");
  let entry = presenterPptxDeckCache.get(source.href);
  if (!entry) {
    entry = { refs: 0, used: Date.now(), value: null };
    entry.promise = (async () => {
      const response = await fetch(source.href, { signal: AbortSignal.timeout(60000), credentials: "omit" });
      if (!response.ok) throw new Error("PPT 파일을 불러오지 못했습니다.");
      if (Number(response.headers.get("content-length")) > PRESENTER_PPTX_MAX_BYTES) throw new Error("PPT 파일이 50MB를 초과합니다.");
      entry.value = await parsePresenterPptx(new Uint8Array(await response.arrayBuffer()));
      return entry;
    })().catch(error => { presenterPptxDeckCache.delete(source.href); throw error; });
    presenterPptxDeckCache.set(source.href, entry);
  }
  entry.used = Date.now();
  return entry.promise;
}

function warmPresenterPptx(payload) {
  if (navigator.connection?.saveData || /(^|-)2g$/.test(navigator.connection?.effectiveType || "")) return;
  const upcoming = payload.slides?.slice(Math.max(0, payload.index), payload.index + 13).find(slide => slide.pptx?.url);
  if (upcoming) void loadPresenterPptx(upcoming.pptx.url).then(trimPresenterPptxCache).catch(() => {});
}

function trimPresenterPptxCache() {
  const idle = [...presenterPptxDeckCache.entries()].filter(([, e]) => e.value && !e.refs).sort((a,b) => b[1].used - a[1].used);
  for (const [key, entry] of idle.slice(2)) {
    entry.value.deck.dispose?.();
    presenterPptxDeckCache.delete(key);
  }
}

async function createPresenterPptxSession(host, entry, pageIndex) {
  const { deck, runtime } = entry.value;
  if (!deck.slides[pageIndex]) throw new Error("PPT 페이지를 찾지 못했습니다.");
  entry.refs += 1;
  // Output navigation is owned by Mindex, including offline/output-only control.
  class OutputViewer extends runtime.Viewer { startAutoAdvance() {} }
  let viewer;
  let currentStep = -1;
  let destroyed = false;
  const automatic = deck.slides[pageIndex].animations?.[0]?.autoStart ? 1 : 0;
  const build = () => {
    viewer?.destroy();
    viewer = new OutputViewer(host, deck, { index: pageIndex, animate: true, autoAdvance: false, media: "badge", textMode: "svg" });
    // PPT hyperlinks cannot navigate the output or bypass controller state.
    host.querySelectorAll("a").forEach(node => { node.removeAttribute("href"); node.removeAttribute("xlink:href"); node.removeAttribute("data-slide"); });
  };
  const finish = () => host.getAnimations({ subtree: true }).forEach(animation => { try { animation.finish(); } catch {} });
  try {
    build();
    const sources = [...new Set([...host.querySelectorAll("image")].map(node => node.getAttribute("href") || node.getAttribute("xlink:href")).filter(Boolean))];
    await Promise.all(sources.map(source => new Promise((resolve, reject) => {
      const image = new Image();
      const timer = window.setTimeout(() => { image.onload = image.onerror = null; reject(new Error("PPT 이미지 준비 시간이 초과됐습니다. 다시 선택해 주세요.")); }, 15000);
      image.onload = () => { clearTimeout(timer); resolve(); };
      image.onerror = () => { clearTimeout(timer); reject(new Error("PPT 이미지를 읽지 못했습니다.")); };
      image.src = source;
    })));
  } catch (error) { viewer?.destroy(); entry.refs -= 1; throw error; }
  return {
    sync(step) {
      if (destroyed || step === currentStep) return;
      const target = Math.min(viewer.animationTotal, automatic + step);
      if (currentStep >= 0 && step > currentStep) {
        while (viewer.animationDone < target) viewer.playNextAnimation();
      } else {
        if (currentStep >= 0) build();
        for (let i = 0; i < target; i += 1) {
          viewer.playNextAnimation();
          // Re-entry/rewind restores consumed clicks without replaying them.
          if (step > 0 || currentStep >= 0) finish();
        }
      }
      currentStep = step;
      host.dataset.pptxStep = String(step);
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      viewer.destroy();
      entry.refs -= 1;
      trimPresenterPptxCache();
    },
  };
}

function releasePresenterPptxOutput(root) {
  root._pptxRequest = null;
  delete root.dataset.pptxError;
}

async function renderPresenterPptxOutput(root, payload, slide, frameState) {
  const key = `${payload.serviceId}|${presenterPptxKey(slide)}`;
  const layers = presenterOutputLayers(root);
  if (layers.active?._pptxSession && layers.active.dataset.presenterFrameKey === key) {
    root._pptxRequest = null;
    ++presenterOutputRenderState.token;
    root.removeAttribute("aria-busy");
    layers.active._pptxSession.sync(presenterPptxStep(payload, slide));
    return;
  }
  if (root._pptxRequest?.key === key) { root._pptxRequest.payload = payload; return; }
  const request = { key, payload, token: ++presenterOutputRenderState.token };
  root._pptxRequest = request;
  root.setAttribute("aria-busy", "true");
  delete root.dataset.pptxError;
  let session;
  const current = () => root._pptxRequest === request && request.token === presenterOutputRenderState.token;
  try {
    const entry = await loadPresenterPptx(slide.pptx.url);
    if (!current()) { trimPresenterPptxCache(); return; }
    const host = document.createElement("div");
    host.className = "presenter-pptx-stage";
    host.dataset.slideLayout = "media";
    host.style.cssText = "position:absolute;inset:0;background:#000;pointer-events:none";
    // Construct off-screen; hold the actual old frame until all images decode.
    session = await createPresenterPptxSession(host, entry, slide.pptx.page);
    if (!current()) { session.destroy(); return; }
    const freshLayers = presenterOutputLayers(root);
    freshLayers.next._pptxSession?.destroy();
    freshLayers.next.replaceChildren(host);
    freshLayers.next._pptxSession = session;
    freshLayers.next.dataset.presenterFrameKey = key;
    activatePresenterOutputLayer(root, freshLayers.active, freshLayers.next, frameState, request.token, () => {
      session.sync(presenterPptxStep(request.payload, slide));
    });
    root.removeAttribute("aria-busy");
    root._pptxRequest = null;
  } catch (error) {
    session?.destroy();
    if (!current()) return;
    root._pptxRequest = null;
    root.removeAttribute("aria-busy");
    root.dataset.pptxError = error?.message || "PPT를 불러오지 못했습니다.";
    // Retain the old live frame; never silently substitute a static thumbnail.
  }
}

async function importPresenterPptx(input, existingItem = null) {
  const file = input?.files?.[0];
  const serviceId = input?.dataset?.serviceId || state.selectedServiceId;
  if (!file || !serviceId) return false;
  if (presenterPptxImports.has(serviceId)) { showToast("PPT 삽입을 마친 뒤 다시 선택해 주세요.", "info"); return false; }
  if (!/\.pptx$/i.test(file.name) || file.size > PRESENTER_PPTX_MAX_BYTES) { showToast("PPTX 파일을 50MB 이하로 선택해 주세요.", "error"); input.value = ""; return false; }
  if (!state.client?.storage) { showToast("파일 저장소 연결을 확인해 주세요.", "error"); input.value = ""; return false; }
  presenterPptxImports.add(serviceId);
  input.disabled = true;
  if (!existingItem && input.dataset.serviceItemIndex !== undefined) existingItem = getServiceItems(serviceId)[Number(input.dataset.serviceItemIndex)] || null;
  let parsed, item = existingItem, saveAttempted = false;
  const previousMemo = existingItem?.memo;
  const paths = [];
  const upload = async (blob, name) => {
    const path = `services/${String(serviceId).replace(/[^a-zA-Z0-9_-]/g, "")}/pptx/${crypto.randomUUID()}/${name}`;
    const bucket = state.client.storage.from(PRESENTER_MEDIA_STORAGE_BUCKET);
    const { error } = await bucket.upload(path, blob, { contentType: blob.type || "application/vnd.openxmlformats-officedocument.presentationml.presentation", cacheControl: PRESENTER_MEDIA_CACHE_CONTROL, upsert: false });
    if (error) throw error;
    paths.push(path);
    const url = bucket.getPublicUrl(path)?.data?.publicUrl;
    if (!url) throw new Error("파일 주소를 만들지 못했습니다.");
    return url;
  };
  try {
    showToast("PPT를 검사하고 있습니다.", "info");
    parsed = await parsePresenterPptx(new Uint8Array(await file.arrayBuffer()));
    const { deck, runtime } = parsed;
    if (!window.confirm(`${file.name} · ${deck.slides.length}장\n\n기본 나타내기·사라지기·이동 효과와 클릭 순서를 재생합니다. 복잡한 효과·영상·음원·글꼴은 PowerPoint와 다를 수 있어 송출 전 확인이 필요합니다.\n\n원본 PPTX(메모·숨긴 장 포함)와 미리보기를 기존 공개 자료 저장소에 올려 이 예배에 연결할까요?`)) return false;
    const sourceUrl = await upload(file, "source.pptx");
    const slides = [];
    for (let page = 0; page < deck.slides.length; page += 1) {
      const slide = deck.slides[page];
      const thumbnail = await runtime.slideToPng(deck, slide, Math.min(1, 480 / deck.width));
      const url = await upload(thumbnail, `slide-${page + 1}.png`);
      const groups = runtime.groupSteps(slide.animations);
      slides.push({ url, name: `${page + 1}번 슬라이드`, order: page + 1, pptx: {
        page, clicks: Math.max(0, groups.length - (slide.animations?.[0]?.autoStart ? 1 : 0)), hidden: Boolean(slide.hidden),
      } });
      if (page === 0 || (page + 1) % 10 === 0) showToast(`PPT 준비 중 · ${page + 1}/${deck.slides.length}장`, "info");
    }
    if (item) {
      item = getServiceItems(serviceId).find(candidate => candidate.id === item.id);
      if (!item || item.memo !== previousMemo) throw new Error("파일을 준비하는 동안 항목이 변경됐습니다. 현재 내용을 확인하고 다시 선택해 주세요.");
    } else {
      item = addPresenterReferenceMedia(serviceId, input.dataset.presenterReferenceMediaSection || "sermon", { focus: false, render: false });
    }
    if (!item) throw new Error("PPT를 연결할 항목을 찾지 못했습니다.");
    const memo = parseServiceItemMemo(item.memo);
    memo.elementType = "image";
    memo.componentType = "image";
    memo.inputMode = "asset";
    memo.asset = normalizeServiceAsset({ kind: "imported_deck", name: file.name, url: slides[0].url, pptx: { url: sourceUrl }, slides });
    item.memo = serializeServiceItemMemo(memo);
    item._worshipElementTemplateModified = true;
    state.dirty.service = true;
    markServiceElementDirty(serviceId, item);
    const index = getServiceItems(serviceId).findIndex(candidate => candidate.id === item.id);
    if (index < 0) throw new Error("PPT를 연결할 항목을 찾지 못했습니다.");
    saveAttempted = true;
    const saved = await saveServiceItemMutation(serviceId, index, { silent: true, renderAfterSave: false, throwOnError: true });
    if (!saved) throw new Error("예배 저장을 완료하지 못했습니다. 저장 상태를 확인하고 다시 저장해 주세요.");
    showToast(`PPT ${slides.length}장을 연결했습니다. 다음 버튼으로 클릭 효과를 진행할 수 있습니다.`);
    return true;
  } catch (error) {
    // An RPC timeout may already have committed. Keep its immutable media and
    // pending draft for the existing atomic retry/reconciliation workflow.
    if (!saveAttempted && paths.length) {
      try { await state.client.storage.from(PRESENTER_MEDIA_STORAGE_BUCKET).remove(paths); } catch {}
    }
    showToast(error?.message || "PPT를 삽입하지 못했습니다.", "error");
    return false;
  } finally {
    parsed?.deck.dispose?.();
    presenterPptxImports.delete(serviceId);
    input.disabled = false;
    input.value = "";
    renderCurrentServiceModuleDetail();
    renderServiceList();
    updateSaveState();
  }
}
