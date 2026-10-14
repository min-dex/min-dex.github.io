// PPTX is an existing imported_deck asset, not a second worship document model.
let presenterPptxRuntimePromise = null;
const presenterPptxDeckCache = new Map();
const presenterPptxImports = new Set();
const PRESENTER_PPTX_MAX_BYTES = 500 * 1024 * 1024;
const PRESENTER_PPTX_SINGLE_BYTES = 50 * 1024 * 1024;
const PRESENTER_PPTX_PART_BYTES = 16 * 1024 * 1024;

function presenterPptxRuntime() {
  if (!presenterPptxRuntimePromise) {
    presenterPptxRuntimePromise = Promise.all([
      import("./vendor/web-ppt-0.4.5/core.js?mindex=media2"),
      import("./vendor/web-ppt-0.4.5/viewer-core.js?mindex=media2"),
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
  if (!bytes.byteLength || bytes.byteLength > PRESENTER_PPTX_MAX_BYTES) throw new Error("PPTX는 500MB 이하로 선택해 주세요.");
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

// Chunking is storage transport only: the original ZIP bytes and existing asset
// model stay intact. Small/previously saved PPTX URLs keep their direct path.
async function presenterPptxDigest(bytes) {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), byte => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchPresenterPptxBytes(url, limit) {
  const response = await fetch(url, { signal: AbortSignal.timeout(120000), credentials: "omit" });
  if (!response.ok) throw new Error("PPT 파일을 불러오지 못했습니다.");
  if (Number(response.headers.get("content-length")) > limit) {
    await response.body?.cancel();
    throw new Error("PPT 파일 크기를 확인해 주세요.");
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("PPT 파일 크기를 확인해 주세요.");
      chunks.push(value);
    }
  } catch (error) { await reader.cancel().catch(() => {}); throw error; }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

async function readPresenterPptxSource(source) {
  if (!source.pathname.endsWith(".pptx.parts.json")) return fetchPresenterPptxBytes(source.href, PRESENTER_PPTX_MAX_BYTES);
  const manifest = JSON.parse(new TextDecoder().decode(await fetchPresenterPptxBytes(source.href, 32768)));
  if (manifest.format !== "mindex-pptx-parts-v1" || !Number.isSafeInteger(manifest.size)
      || manifest.size <= 0 || manifest.size > PRESENTER_PPTX_MAX_BYTES || !Array.isArray(manifest.parts)
      || manifest.parts.length !== Math.ceil(manifest.size / PRESENTER_PPTX_PART_BYTES)) {
    throw new Error("PPT 저장 정보를 확인해 주세요.");
  }
  let total = 0;
  const urls = new Set();
  for (const [index, part] of manifest.parts.entries()) {
    const url = new URL(part.url, source);
    const expected = Math.min(PRESENTER_PPTX_PART_BYTES, manifest.size - index * PRESENTER_PPTX_PART_BYTES);
    if (url.origin !== source.origin || !["http:", "https:"].includes(url.protocol) || url.username || url.password
        || urls.has(url.href) || part.size !== expected || !/^[a-f0-9]{64}$/.test(part.sha256)) {
      throw new Error("PPT 저장 정보를 확인해 주세요.");
    }
    urls.add(url.href);
    total += part.size;
  }
  if (total !== manifest.size) throw new Error("PPT 파일 크기가 일치하지 않습니다.");
  const bytes = new Uint8Array(total);
  let offset = 0;
  // One part at a time bounds download/hash memory even for large originals.
  for (const part of manifest.parts) {
    const chunk = await fetchPresenterPptxBytes(new URL(part.url, source).href, part.size);
    if (chunk.byteLength !== part.size || await presenterPptxDigest(chunk) !== part.sha256) {
      throw new Error("PPT 파일 일부가 손상됐습니다. 다시 불러오거나 PPT를 교체해 주세요.");
    }
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function uploadPresenterPptxSource(file, upload) {
  if (file.size <= PRESENTER_PPTX_SINGLE_BYTES) return upload(file, "source.pptx");
  const parts = [];
  for (let offset = 0; offset < file.size; offset += PRESENTER_PPTX_PART_BYTES) {
    const blob = file.slice(offset, offset + PRESENTER_PPTX_PART_BYTES, "application/octet-stream");
    const sha256 = await presenterPptxDigest(await blob.arrayBuffer());
    const url = await upload(blob, `source-part-${parts.length + 1}.bin`);
    parts.push({ url, size: blob.size, sha256 });
    showToast(`PPT 올리는 중 · ${Math.min(100, Math.round((offset + blob.size) / file.size * 100))}%`, "info");
  }
  return upload(new Blob([JSON.stringify({ format: "mindex-pptx-parts-v1", size: file.size, parts })], { type: "application/json" }), "source.pptx.parts.json");
}

async function loadPresenterPptx(url) {
  const source = new URL(url, location.href);
  if (!["https:", "http:", "blob:"].includes(source.protocol)) throw new Error("PPT 파일 주소를 확인해 주세요.");
  let entry = presenterPptxDeckCache.get(source.href);
  if (!entry) {
    entry = { refs: 0, used: Date.now(), value: null };
    entry.promise = (async () => {
      entry.value = await parsePresenterPptx(await readPresenterPptxSource(source));
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

function presenterPptxMediaElements(slide) {
  const result = [];
  const visit = elements => { for (const element of elements || []) {
    if (element.media) result.push(element);
    if (element.children) visit(element.children);
  } };
  visit(slide.elements);
  return result;
}

function presenterPptxPageMetadata(entry, page) {
  const slide = entry.value.deck.slides[page];
  return { clicks: Math.max(0, entry.value.runtime.groupSteps(slide.animations).length - (slide.animations?.[0]?.autoStart ? 1 : 0)),
    mediaCount: presenterPptxMediaElements(slide).length };
}

function requestPresenterPptxMedia(owner, action) {
  const slide = owner.slides?.[owner.index];
  if (!slide?.pptx || owner.safetyBlank || owner.liveScripture?.active) return false;
  owner.pptxProgress = { key: presenterPptxKey(slide), step: presenterPptxStep(owner, slide),
    mediaRequest: { id: crypto.randomUUID(), action } };
  return true;
}

function adoptPresenterPptxMetadata(metadata) {
  if (!metadata || metadata.serviceId !== state.presenter.serviceId) return;
  let changed = false;
  for (const slide of state.presenter.slides || []) {
    if (presenterPptxKey(slide) !== metadata.key) continue;
    if (slide.pptx.clicks !== metadata.clicks || slide.pptx.mediaCount !== metadata.mediaCount) {
      Object.assign(slide.pptx, { clicks: metadata.clicks, mediaCount: metadata.mediaCount });
      changed = true;
    }
  }
  if (changed) { publishPresenterState(); renderPresenterControlState(state.presenter.serviceId); }
}

// Playback belongs to the output, not the outgoing visual layer. A carried
// track pins its parsed deck until it stops, so blob URLs cannot be evicted.
function presenterPptxScope(payload, slide) {
  const item = slide.elementId || (String(slide.id || "").includes(":imported-deck:") ? String(slide.id).split(":imported-deck:")[0] : slide.sectionId || "");
  return `${payload.serviceId}|${item}|${slide.pptx.url}`;
}
function presenterPptxBackground(root) {
  return root._pptxBackground || (root._pptxBackground = new Set());
}
function stopPresenterPptxBackground(root) {
  for (const track of presenterPptxBackground(root)) track.destroy();
  root._pptxBackground.clear();
}
function createPresenterPptxTrack(node, settings, report) {
  let disposed = false, completed = false, cycles = 0, timer = null;
  const listeners = new Set();
  const start = () => settings.trimStart || 0;
  const length = () => Math.max(0, node.duration - start() - (settings.trimEnd || 0));
  const total = () => Math.min(settings.loop ? Infinity : length() * (settings.repeatCount ?? 1), settings.repeatSeconds || Infinity);
  const end = () => start() + Math.min(length(), Math.max(0, total() - cycles * length()));
  const cancel = () => { clearTimeout(timer); timer = null; };
  const finished = () => {
    completed = true; node.pause(); cancel();
    for (const callback of listeners) callback();
    listeners.clear();
  };
  const play = async (from) => {
    if (disposed) return;
    if (Number.isFinite(from) || completed || node.ended) {
      cycles = 0; completed = false; node.currentTime = Math.max(start(), Number.isFinite(from) ? from : start());
    } else if (node.currentTime < start()) node.currentTime = start();
    if (total() <= 0 || length() <= 0) { finished(); return; }
    track.started = true;
    try { await node.play(); if (!disposed) { delete node.dataset.autoplayBlocked; report(""); } }
    catch (error) {
      if (disposed || error?.name === "AbortError") return;
      if (error?.name === "NotAllowedError") {
        node.dataset.autoplayBlocked = "true";
        report("PPT 소리 재생이 차단됐습니다. 송출 창에서 스페이스 키를 눌러 재생해 주세요.");
      } else report("PPT 영상·음원을 재생하지 못했습니다. 파일 형식을 확인해 주세요.");
    }
  };
  const boundary = () => {
    cancel();
    if (disposed || completed || (node.paused && !node.ended)) return;
    if (node.currentTime >= end() - .015 || node.ended) {
      const consumed = cycles * length() + Math.min(length(), node.currentTime - start());
      if (consumed >= total() - .02) { finished(); return; }
      cycles += 1; node.currentTime = start(); void play();
    }
    if (!node.paused && !node.loop && Number.isFinite(end())) timer = setTimeout(boundary, Math.max(15, (end() - node.currentTime) * 1000 / (node.playbackRate || 1)));
  };
  node.loop = Boolean(settings.loop && !settings.trimStart && !settings.trimEnd && !settings.repeatSeconds);
  for (const event of ["playing", "seeked", "timeupdate", "ratechange", "ended"]) node.addEventListener(event, boundary);
  node.addEventListener("pause", cancel);
  const track = { node, settings, started: false, carried: false,
    play,
    pause() { cancel(); node.pause(); delete node.dataset.autoplayBlocked; },
    stop() { track.pause(); cycles = 0; completed = false; node.currentTime = start(); },
    wait(done) { if (completed) done(); else listeners.add(done); return () => listeners.delete(done); },
    destroy() {
      if (disposed) return;
      disposed = true; track.pause(); listeners.clear();
      for (const event of ["playing", "seeked", "timeupdate", "ratechange", "ended"]) node.removeEventListener(event, boundary);
      node.removeEventListener("pause", cancel); node.removeAttribute("src"); node.load();
      if (track.carried) { node.remove(); track.entry.refs -= 1; }
    },
  };
  return track;
}

async function createPresenterPptxSession(host, entry, pageIndex, context = {}) {
  const { deck, runtime } = entry.value;
  const slide = deck.slides[pageIndex];
  if (!slide) throw new Error("PPT 페이지를 찾지 못했습니다.");
  entry.refs += 1;
  let viewer, currentStep = -1, lastRequest = null, destroyed = false, restoring = false;
  const media = new Map(), tracks = new Map(), timers = new Set(), waits = new Set();
  const background = () => context.root ? [...presenterPptxBackground(context.root)] : [];
  const automatic = slide.animations?.[0]?.autoStart ? 1 : 0;
  const report = message => {
    if (!destroyed) {
      const root = context.root || host.closest("#presenterOutputRoot");
      if (root) { if (message) root.dataset.pptxError = message; else delete root.dataset.pptxError; }
    }
  };
  const cancelTimers = () => { timers.forEach(clearTimeout); timers.clear(); waits.forEach(cancel => cancel()); waits.clear(); };
  const pause = () => { cancelTimers(); tracks.forEach(track => track.pause()); background().forEach(track => track.pause()); };
  const command = effect => {
    const track = tracks.get(Number(effect.target));
    if (!track || destroyed) return;
    if (effect.action === "stop") track.stop();
    else if (effect.action === "pause" || (effect.action === "togglePause" && !track.node.paused)) track.pause();
    else void track.play(effect.startSeconds);
  };
  const later = (callback, delay) => {
    if (delay <= 0) { callback(); return; }
    const timer = setTimeout(() => { timers.delete(timer); if (!destroyed) callback(); }, delay);
    timers.add(timer);
  };
  const schedule = (effect, delay) => later(() => command(effect), delay);
  const waitMedia = target => new Promise(resolve => {
    const track = tracks.get(Number(target));
    if (!track) { resolve(); return; }
    let cancel;
    cancel = track.wait(() => { waits.delete(cancel); resolve(); }); waits.add(cancel);
  });
  class OutputViewer extends runtime.Viewer {
    startAutoAdvance() {}
    play(group) {
      if (restoring) { super.play(group.filter(effect => effect.kind !== "media")); return; }
      let previous = null;
      for (const effect of group) {
        const dependency = effect.waitForMedia !== undefined ? waitMedia(effect.waitForMedia)
          : effect.trigger === "afterPrev" ? previous : null;
        const completion = new Promise(resolve => {
          const run = () => later(() => {
            if (effect.kind === "media") {
              command(effect);
              if (effect.action === "play") waitMedia(effect.target).then(resolve); else resolve();
            } else {
              super.play([{ ...effect, delayMs: 0, trigger: "withPrev" }]);
              later(resolve, effect.durationMs || 0);
            }
          }, effect.delayMs || 0);
          if (dependency) {
            let active = true; const cancel = () => { active = false; }; waits.add(cancel);
            dependency.then(() => { waits.delete(cancel); if (active && !destroyed) run(); });
          } else run();
        });
        previous = previous ? Promise.all([previous, completion]) : completion;
      }
    }
  }
  const releaseMedia = () => {
    cancelTimers(); tracks.forEach(track => track.destroy()); tracks.clear(); media.clear();
  };
  const build = () => {
    releaseMedia(); viewer?.destroy();
    viewer = new OutputViewer(host, deck, { index: pageIndex, animate: true, autoAdvance: false, media: "player", textMode: "svg" });
    host.querySelectorAll("a").forEach(node => { node.removeAttribute("href"); node.removeAttribute("xlink:href"); node.removeAttribute("data-slide"); });
    for (const element of presenterPptxMediaElements(slide)) {
      const node = host.querySelector(`[data-el="${element.id}"] video, [data-el="${element.id}"] audio`);
      if (!node) throw new Error("PPT 영상·음원 원본을 찾지 못했습니다.");
      const settings = slide.mediaSettings?.find(value => value.target === element.id) || {};
      node.controls = false; node.autoplay = false; node.preload = "auto";
      node.playsInline = true; node.setAttribute("playsinline", "");
      node.volume = settings.volume ?? 1; node.muted = Boolean(settings.muted); node.loop = Boolean(settings.loop);
      node.classList.add("presenter-pptx-media");
      if (element.media.kind === "audio") node.style.visibility = "hidden";
      node.addEventListener("error", () => report("PPT 영상·음원을 읽지 못했습니다. MP4(H.264/AAC) 또는 MP3/WAV 형식인지 확인해 주세요."));
      media.set(Number(element.id), node);
      tracks.set(Number(element.id), createPresenterPptxTrack(node, settings, message => {
        const root = context.root;
        if (root) { if (message) root.dataset.pptxError = message; else delete root.dataset.pptxError; }
        else report(message);
      }));
    }
    const targets = new Set((slide.interactiveAnimations || []).map(effect => effect.clickTarget));
    for (const target of targets) {
      const shape = host.querySelector(`[data-el="${target}"]`);
      if (!shape) continue;
      shape.style.pointerEvents = "auto"; shape.style.cursor = "pointer";
      shape.setAttribute("role", "button"); shape.setAttribute("tabindex", "0");
      shape.setAttribute("aria-label", "PPT 객체 효과 재생");
      const trigger = event => {
        if (event.type === "keydown" && !["Enter", " "].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        viewer.play(slide.interactiveAnimations.filter(effect => effect.clickTarget === target));
      };
      shape.addEventListener("click", trigger); shape.addEventListener("keydown", trigger);
    }
  };
  const finish = () => host.getAnimations({ subtree: true }).forEach(animation => { try { animation.finish(); } catch {} });
  try {
    build();
    const sources = [...new Set([...host.querySelectorAll("image")].map(node => node.getAttribute("href") || node.getAttribute("xlink:href")).filter(Boolean))];
    await Promise.all([
      ...sources.map(source => new Promise((resolve, reject) => {
        const image = new Image();
        const timer = setTimeout(() => { image.onload = image.onerror = null; reject(new Error("PPT 이미지 준비 시간이 초과됐습니다.")); }, 15000);
        image.onload = () => { clearTimeout(timer); resolve(); };
        image.onerror = () => { clearTimeout(timer); reject(new Error("PPT 이미지를 읽지 못했습니다.")); };
        image.src = source;
      })),
      ...[...media.values()].map(node => new Promise((resolve, reject) => {
        const done = error => {
          clearTimeout(timer); node.removeEventListener("loadeddata", ready); node.removeEventListener("seeked", ready); node.removeEventListener("error", failed);
          error ? reject(error) : resolve();
        };
        const ready = () => {
          const settings = [...tracks.values()].find(track => track.node === node)?.settings || {};
          const start = settings.trimStart || 0;
          if (start + (settings.trimEnd || 0) >= node.duration) { done(new Error("PPT 영상·음원의 자르기 범위가 재생 길이를 벗어났습니다.")); return; }
          if (node.currentTime < start) { node.currentTime = start; return; }
          if (!node.seeking) done();
        };
        const failed = () => done(new Error("PPT 영상·음원을 읽지 못했습니다. 지원되는 형식으로 저장해 주세요."));
        const timer = setTimeout(() => done(new Error("PPT 영상·음원 준비 시간이 초과됐습니다.")), 20000);
        node.addEventListener("loadeddata", ready); node.addEventListener("seeked", ready); node.addEventListener("error", failed);
        if (node.error) failed(); else if (node.readyState >= 2) ready();
      })),
    ]);
  } catch (error) { releaseMedia(); viewer?.destroy(); entry.refs -= 1; throw error; }
  return {
    get metadata() { return { ...presenterPptxPageMetadata(entry, pageIndex), mediaCount: media.size + background().length }; },
    leave(next) {
      cancelTimers();
      for (const [id, track] of tracks) {
        if (context.root && next.scope === context.scope && next.page > pageIndex && next.page < pageIndex + track.settings.slideCount
          && track.node.tagName === "AUDIO" && track.started) {
          track.carried = true; track.entry = entry; track.scope = context.scope; track.page = pageIndex;
          track.lastPage = next.page; entry.refs += 1;
          // Keep the very same native player alive outside the SVG viewer.
          let bank = context.root.querySelector(".presenter-pptx-audio-bank");
          if (!bank) { bank = document.createElement("div"); bank.className = "presenter-pptx-audio-bank"; bank.hidden = true; context.root.append(bank); }
          bank.append(track.node); presenterPptxBackground(context.root).add(track);
          tracks.delete(id); media.delete(id);
        } else track.pause();
      }
    },
    pause() { cancelTimers(); tracks.forEach(track => track.pause()); },
    recover() { [...tracks.values(), ...background()].forEach(track => { if (track.node.dataset.autoplayBlocked === "true") void track.play(); }); },
    sync(step, request) {
      if (destroyed) return;
      if (step !== currentStep) {
        const target = Math.min(viewer.animationTotal, automatic + step);
        restoring = step > 0 && currentStep < 0 || currentStep >= 0 && step < currentStep;
        if (currentStep >= 0 && step < currentStep) build();
        while (viewer.animationDone < target) { viewer.playNextAnimation(); if (restoring) finish(); }
        if (currentStep < 0 && step === 0) {
          for (const settings of slide.mediaSettings || []) {
            if (settings.autoStart && !slide.animations?.some(effect => effect.kind === "media" && effect.target === settings.target)) {
              schedule({ target: settings.target, action: "play" }, settings.delayMs);
            }
          }
        }
        restoring = false; currentStep = step; host.dataset.pptxStep = String(step);
      }
      if (request?.id && request.id !== lastRequest) {
        lastRequest = request.id;
        if (request.action === "pause") pause();
        else if (request.action === "play") [...tracks.values(), ...background()].forEach(track => { void track.play(); });
      }
    },
    destroy() {
      if (destroyed) return;
      destroyed = true; releaseMedia(); viewer.destroy(); entry.refs -= 1; trimPresenterPptxCache();
    },
  };
}

function releasePresenterPptxOutput(root) {
  stopPresenterPptxBackground(root);
  root._pptxRequest = null;
  root._pptxMetadata = null;
  presenterOutputLayers(root).active?._pptxSession?.pause();
  delete root.dataset.pptxError;
}

async function renderPresenterPptxOutput(root, payload, slide, frameState) {
  const key = `${payload.serviceId}|${presenterPptxKey(slide)}`;
  const layers = presenterOutputLayers(root);
  if (layers.active?._pptxSession && layers.active.dataset.presenterFrameKey === key) {
    root._pptxRequest = null;
    ++presenterOutputRenderState.token;
    root.removeAttribute("aria-busy");
    Object.assign(slide.pptx, layers.active._pptxSession.metadata);
    root._pptxMetadata = { serviceId: payload.serviceId, key: presenterPptxKey(slide), ...layers.active._pptxSession.metadata };
    layers.active._pptxSession.sync(presenterPptxStep(payload, slide), payload.pptxProgress?.key === presenterPptxKey(slide) ? payload.pptxProgress.mediaRequest : null);
    return;
  }
  if (root._pptxRequest?.key === key) { root._pptxRequest.payload = payload; return; }
  const scope = presenterPptxScope(payload, slide);
  for (const track of presenterPptxBackground(root)) {
    if (track.scope !== scope || slide.pptx.page < track.lastPage || slide.pptx.page >= track.page + track.settings.slideCount) {
      track.destroy(); root._pptxBackground.delete(track);
    } else track.lastPage = slide.pptx.page;
  }
  layers.active?._pptxSession?.leave({ scope, page: slide.pptx.page });
  root._pptxMetadata = null;
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
    session = await createPresenterPptxSession(host, entry, slide.pptx.page, { root, scope });
    if (!current()) { session.destroy(); return; }
    const freshLayers = presenterOutputLayers(root);
    freshLayers.next._pptxSession?.destroy();
    freshLayers.next.replaceChildren(host);
    freshLayers.next._pptxSession = session;
    freshLayers.next.dataset.presenterFrameKey = key;
    activatePresenterOutputLayer(root, freshLayers.active, freshLayers.next, frameState, request.token, () => {
      Object.assign(slide.pptx, session.metadata);
      const activeSlide = request.payload.slides?.[request.payload.index];
      if (presenterPptxKey(activeSlide) === presenterPptxKey(slide)) Object.assign(activeSlide.pptx, session.metadata);
      root._pptxMetadata = { serviceId: payload.serviceId, key: presenterPptxKey(slide), ...session.metadata };
      session.sync(presenterPptxStep(request.payload, slide), request.payload.pptxProgress?.key === presenterPptxKey(slide) ? request.payload.pptxProgress.mediaRequest : null);
      presenterOutputImageWarmupState.onProgress?.();
    });
    root.removeAttribute("aria-busy");
    root._pptxRequest = null;
  } catch (error) {
    session?.destroy();
    if (!current()) return;
    root._pptxRequest = null;
    root.removeAttribute("aria-busy");
    stopPresenterPptxBackground(root);
    root.dataset.pptxError = error?.message || "PPT를 불러오지 못했습니다.";
    // Retain the old live frame; never silently substitute a static thumbnail.
  }
}

async function importPresenterPptx(input, existingItem = null) {
  const file = input?.files?.[0];
  const serviceId = input?.dataset?.serviceId || state.selectedServiceId;
  if (!file || !serviceId) return false;
  if (presenterPptxImports.has(serviceId)) { showToast("PPT 삽입을 마친 뒤 다시 선택해 주세요.", "info"); return false; }
  if (!/\.pptx$/i.test(file.name) || file.size > PRESENTER_PPTX_MAX_BYTES) { showToast("PPTX 파일을 500MB 이하로 선택해 주세요.", "error"); input.value = ""; return false; }
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
    if (!window.confirm(`${file.name} · ${deck.slides.length}장\n\n기본 나타내기·사라지기·이동 효과와 클릭 순서를 재생합니다. 포함된 영상·음원을 함께 재생합니다. 복잡한 효과·글꼴은 PowerPoint와 다를 수 있어 송출 전 확인이 필요합니다.\n\n원본 PPTX(메모·숨긴 장 포함)와 미리보기를 기존 공개 자료 저장소에 올려 이 예배에 연결할까요?`)) return false;
    const sourceUrl = await uploadPresenterPptxSource(file, upload);
    const slides = [];
    for (let page = 0; page < deck.slides.length; page += 1) {
      const slide = deck.slides[page];
      const thumbnail = await runtime.slideToPng(deck, slide, Math.min(1, 480 / deck.width));
      const url = await upload(thumbnail, `slide-${page + 1}.png`);
      const groups = runtime.groupSteps(slide.animations);
      slides.push({ url, name: `${page + 1}번 슬라이드`, order: page + 1, pptx: {
        page, mediaCount: presenterPptxMediaElements(slide).length, clicks: Math.max(0, groups.length - (slide.animations?.[0]?.autoStart ? 1 : 0)), hidden: Boolean(slide.hidden),
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
