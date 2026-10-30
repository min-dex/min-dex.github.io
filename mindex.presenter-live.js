// ─── Presenter runtime, live controls, and output synchronization ────────────
function currentPresenterAudioContext(serviceId = state.presenter.serviceId) {
  if (!serviceId || state.presenter.serviceId !== serviceId) return { source: "", label: "", slideId: "", playback: null };
  if (state.presenter.safetyBlank || state.presenter.liveScripture?.active) return { source: "", label: "", slideId: "", playback: null };
  const slide = state.presenter.slides[clampPresenterIndex(state.presenter.index, state.presenter.slides.length)];
  const source = presenterSlideAudioSource(slide);
  if (!source) {
    return { source: "", label: "", slideId: "", playback: null };
  }
  return {
    source,
    label: presenterFileDisplayTitle(slide, presenterFileTypeLabel(slide.sourceType || slide.asset?.kind || "audio")),
    slideId: slide.id || "",
    playback: presenterPlaybackConfig(slide.playback, "audio"),
  };
}

function getServiceMusicAudio() {
  if (!state.serviceMusic.audio) {
    const audio = new Audio();
    audio.preload = "auto";
    audio.addEventListener("pause", () => {
      scheduleServiceMusicResume("pause");
    });
    audio.addEventListener("ended", () => {
      cancelServiceMusicFadeStop();
      state.serviceMusic.playSerial += 1;
      state.serviceMusic.pending = false;
      clearServiceMusicResumeTimer();
      clearServiceMusicSyncTimer();
      state.serviceMusic.playing = false;
      if (state.serviceMusic.mode === "presenter-audio") {
        state.serviceMusic.sourceKey = "";
        state.serviceMusic.sourceLabel = "";
        state.serviceMusic.mode = "manual";
      }
      renderPresenterControlState();
    });
    for (const event of ["loadedmetadata", "durationchange", "emptied"]) {
      audio.addEventListener(event, () => globalThis.MindexSongTiming?.updateTransport(audio));
    }
    audio.addEventListener("seeked", () => {
      if (state.serviceMusic.pending) state.serviceMusic.pendingStartTime = audio.currentTime;
      globalThis.MindexSongTiming?.updateTransport(audio);
    });
    audio.addEventListener("timeupdate", () => {
      // Some native decoders advance after resume without settling play().
      // A seek alone is not playback: require forward progress while unpaused.
      if (state.serviceMusic.pending && !audio.seeking
        && audio.currentTime > state.serviceMusic.pendingStartTime + 0.01) {
        confirmServiceMusicPlayback(audio, state.serviceMusic.playSerial);
      }
      globalThis.MindexSongTiming?.updateTransport(audio);
      syncServiceMusicSyncedLyricsWithCurrentTime();
    });
    state.serviceMusic.audio = audio;
  }
  if (!state.serviceMusic.fadeStop) state.serviceMusic.audio.volume = state.serviceMusic.volumeLevel / 5;
  return state.serviceMusic.audio;
}

function serviceMusicPauseIsIntentional() {
  return Date.now() < (Number(state.serviceMusic.intentionalPauseUntil) || 0);
}

function allowIntentionalServiceMusicPause(durationMs = 800) {
  state.serviceMusic.intentionalPauseUntil = Date.now() + durationMs;
}

function clearServiceMusicResumeTimer() {
  if (!state.serviceMusic.resumeTimer) return;
  clearTimeout(state.serviceMusic.resumeTimer);
  state.serviceMusic.resumeTimer = null;
}

function clearServiceMusicSyncTimer() {
  if (!state.serviceMusic.syncTimer) return;
  clearInterval(state.serviceMusic.syncTimer);
  state.serviceMusic.syncTimer = null;
}

function startServiceMusicSyncTimer() {
  clearServiceMusicSyncTimer();
  state.serviceMusic.syncTimer = setInterval(() => {
    syncServiceMusicSyncedLyricsWithCurrentTime();
  }, 120);
}

function shouldResumeInterruptedServiceMusic(audio) {
  if (!audio || audio.ended || state.serviceMusic.fadeStop) return false;
  if (serviceMusicPauseIsIntentional()) return false;
  if (!state.serviceMusic.playing) return false;
  return Boolean(state.serviceMusic.sourceKey || state.serviceMusic.objectUrl || audio.currentSrc || audio.src);
}

function scheduleServiceMusicResume(reason = "", delayMs = 0) {
  const audio = state.serviceMusic.audio;
  if (!audio || !shouldResumeInterruptedServiceMusic(audio)) return;
  if (!audio.paused && !audio.ended) return;
  clearServiceMusicResumeTimer();
  state.serviceMusic.resumeTimer = setTimeout(() => {
    state.serviceMusic.resumeTimer = null;
    resumeServiceMusicAfterInterruption(reason);
  }, Math.max(0, Number(delayMs) || 0));
}

function resumeServiceMusicAfterInterruption(reason = "") {
  const audio = state.serviceMusic.audio;
  if (!audio || !shouldResumeInterruptedServiceMusic(audio)) {
    state.serviceMusic.resumeAttempts = 0;
    return;
  }
  const serial = state.serviceMusic.playSerial;
  audio.play()
    .then(() => {
      if (serial !== state.serviceMusic.playSerial || audio.paused || audio.ended || state.serviceMusic.fadeStop) return;
      state.serviceMusic.resumeAttempts = 0;
      state.serviceMusic.playing = true;
      renderPresenterControlState();
    })
    .catch(() => {
      if (serial !== state.serviceMusic.playSerial) return;
      if (!shouldResumeInterruptedServiceMusic(audio)) {
        state.serviceMusic.resumeAttempts = 0;
        return;
      }
      state.serviceMusic.resumeAttempts += 1;
      if (state.serviceMusic.resumeAttempts > 8) return;
      scheduleServiceMusicResume(reason, 200 + (state.serviceMusic.resumeAttempts * 150));
    });
}

function setServiceMusicSource(audio, source, mode, playback = null, label = "") {
  cancelServiceMusicFadeStop();
  if (state.serviceMusic.sourceKey === source && state.serviceMusic.mode === mode) {
    audio.loop = Boolean(playback?.loop);
    if (source && !audio.currentSrc && !audio.src) audio.src = source;
    state.serviceMusic.sourceLabel = label || state.serviceMusic.sourceLabel || "";
    return;
  }
  clearServiceMusicResumeTimer();
  state.serviceMusic.playSerial += 1;
  state.serviceMusic.pending = false;
  state.serviceMusic.repeatAllowed = playback?.repeatAllowed !== false;
  state.serviceMusic.repeat = Boolean(playback?.loop);
  allowIntentionalServiceMusicPause();
  audio.pause();
  audio.src = source;
  audio.loop = Boolean(playback?.loop);
  state.serviceMusic.autoSyncSuspended = false;
  state.serviceMusic.sourceKey = source;
  state.serviceMusic.ownerServiceId = "";
  state.serviceMusic.sourceLabel = label || "";
  state.serviceMusic.mode = mode;
  state.serviceMusic.playing = false;
}

function serviceMusicHasActivePlayback() {
  const audio = state.serviceMusic.audio;
  return Boolean(
    state.serviceMusic.playing
    || (audio && !audio.paused && !audio.ended)
  );
}

function cancelServiceMusicFadeStop() {
  const music = state.serviceMusic;
  if (!music.fadeStop) return;
  clearInterval(music.fadeStop.timer);
  music.fadeStop = null;
  if (music.audio) music.audio.volume = music.volumeLevel / 5;
}

function finishServiceMusicUserStop() {
  stopServiceMusicPlayback({ render: false });
  if (state.serviceMusic.audio) state.serviceMusic.audio.currentTime = 0;
  renderPresenterControlState();
}

function requestServiceMusicUserStop() {
  const music = state.serviceMusic, audio = music.audio;
  // A second stop is an immediate stop; paused/pending audio never fades.
  if (!music.fadeStopEnabled || music.fadeStop || music.pending || !audio || audio.paused || audio.ended || !music.playing) {
    finishServiceMusicUserStop();
    return;
  }
  clearServiceMusicResumeTimer();
  const fade = { audio, started: Date.now(), timer: null };
  music.fadeStop = fade;
  fade.timer = setInterval(() => {
    if (music.fadeStop !== fade || music.audio !== audio) return;
    const remaining = Math.max(0, 1 - (Date.now() - fade.started) / 1200);
    audio.volume = (music.volumeLevel / 5) * remaining;
    if (!remaining) finishServiceMusicUserStop();
  }, 30);
  renderPresenterControlState();
}

function stopServiceMusicPlayback(options = {}) {
  cancelServiceMusicFadeStop();
  state.serviceMusic.playSerial += 1;
  state.serviceMusic.pending = false;
  const audio = state.serviceMusic.audio;
  clearServiceMusicResumeTimer();
  clearServiceMusicSyncTimer();
  if (audio) {
    allowIntentionalServiceMusicPause();
    audio.pause();
    if (options.clearSource) audio.removeAttribute("src");
  }
  state.serviceMusic.playing = false;
  if (options.clearSource) {
    state.serviceMusic.sourceKey = "";
    state.serviceMusic.sourceLabel = "";
  }
  if (options.mode) state.serviceMusic.mode = options.mode;
  if (options.render !== false) renderPresenterControlState();
}

function syncServiceMusicWithPresenterContext(serviceId = state.presenter.serviceId, options = {}) {
  if (serviceMusicHasActivePlayback()) {
    state.serviceMusic.playing = true;
    return;
  }
  const context = currentPresenterAudioContext(serviceId);
  if (context.source && state.serviceMusic.mode === "presenter-audio" && state.serviceMusic.sourceKey === context.source) return;
  if (state.serviceMusic.mode !== "presenter-audio") return;
  stopServiceMusicPlayback({ clearSource: true, mode: "manual", render: options.render });
}

function confirmServiceMusicPlayback(audio, serial) {
  if (serial !== state.serviceMusic.playSerial || audio.paused || audio.ended) return;
  if (state.serviceMusic.playing && !state.serviceMusic.pending) return;
  state.serviceMusic.pending = false;
  state.serviceMusic.playing = true;
  startServiceMusicSyncTimer();
  syncServiceMusicSyncedLyricsWithCurrentTime();
  renderPresenterControlState();
}

function runServiceMusicAction(action, binding = null) {
  const boundSource = binding?.serviceMusicSource || "";
  if (!boundSource && action !== "choose" && serviceMusicSourceIsSlotOwned()) return;
  const owner = binding?.serviceMusicServiceId || "";
  const boundActive = !boundSource || (boundSource === state.serviceMusic.sourceKey && owner === state.serviceMusic.ownerServiceId);
  if (boundSource && !boundActive && (state.serviceMusic.playing || state.serviceMusic.pending || serviceMusicHasActivePlayback())) {
    showToast("다른 예배의 음악이 재생 중입니다. 해당 예배에서 정지한 뒤 재생해 주세요.", "info");
    return;
  }
  if (action === "stop") {
    if (!boundActive) return;
    requestServiceMusicUserStop();
    return;
  }
  if (action === "choose") {
    document.querySelector("[data-service-music-file]")?.click();
    return;
  }
  if (action === "repeat") {
    if (state.serviceMusic.repeatAllowed === false) return;
    const context = currentPresenterAudioContext();
    state.serviceMusic.repeat = !(state.serviceMusic.repeat ?? context.playback?.loop);
    if (state.serviceMusic.audio) state.serviceMusic.audio.loop = state.serviceMusic.repeat;
    renderPresenterControlState();
    return;
  }
  if (action !== "toggle") return;
  const audio = getServiceMusicAudio();
  const context = currentPresenterAudioContext();
  if (boundActive && (state.serviceMusic.playing || state.serviceMusic.pending)) {
    stopServiceMusicPlayback({ render: true });
    return;
  }
  const manualSource = state.serviceMusic.mode === "manual"
    ? state.serviceMusic.sourceKey || state.serviceMusic.objectUrl
    : "";
  const presenterSource = state.serviceMusic.mode === "presenter-audio" ? state.serviceMusic.sourceKey : "";
  const source = boundSource || manualSource || presenterSource || context.source;
  const mode = boundSource || manualSource ? "manual" : "presenter-audio";
  const repeatAllowed = boundSource ? binding.serviceMusicRepeatAllowed !== "false" : state.serviceMusic.repeatAllowed;
  const playback = { ...(manualSource ? {} : context.playback), repeatAllowed, loop: repeatAllowed !== false && (state.serviceMusic.repeat ?? (!manualSource && Boolean(context.playback?.loop))) };
  const label = boundSource ? binding.serviceMusicLabel || "" : manualSource
    ? state.serviceMusic.sourceLabel || state.serviceMusic.fileName || ""
    : state.serviceMusic.sourceLabel || context.label || "";
  if (!source) {
    showToast("음악 파일을 먼저 선택해 주세요.", "error");
    return;
  }
  if (!boundSource && !manualSource && !presenterSource && context.source && presenterMediaSourceIsYoutube(context.source)) {
    showToast("YouTube 링크는 아직 컨트롤러 내 재생 대신 별도 영상/오디오 파일로 등록해 주세요.", "error");
    return;
  }
  setServiceMusicSource(audio, source, mode, playback, label);
  state.serviceMusic.ownerServiceId = boundSource ? owner : "";
  const serial = ++state.serviceMusic.playSerial;
  state.serviceMusic.pendingStartTime = Number(audio.currentTime) || 0;
  state.serviceMusic.pending = true;
  updateServiceMusicTransportControls();
  return audio.play()
    .then(() => {
      confirmServiceMusicPlayback(audio, serial);
    })
    .catch((error) => {
      if (serial === state.serviceMusic.playSerial && error?.name !== "AbortError") showToast("브라우저가 음악 재생을 막았습니다. 다시 눌러 주세요.", "error");
    })
    .finally(() => {
      if (serial !== state.serviceMusic.playSerial) return;
      state.serviceMusic.pending = false;
      renderPresenterControlState();
    });
}

function loadServiceMusicFile(file) {
  if (!file) return;
  const audio = getServiceMusicAudio();
  if (state.serviceMusic.objectUrl) URL.revokeObjectURL(state.serviceMusic.objectUrl);
  state.serviceMusic.objectUrl = URL.createObjectURL(file);
  state.serviceMusic.fileName = file.name || "음악";
  setServiceMusicSource(audio, state.serviceMusic.objectUrl, "manual", { loop: false }, state.serviceMusic.fileName);
  audio.volume = state.serviceMusic.volumeLevel / 5;
  renderPresenterControlState();
}

function setServiceMusicVolume(value, binding = null) {
  if (!isPresenterOutputWindowOpen()) {
    updateServiceMusicTransportControls();
    return;
  }
  if (binding?.serviceMusicSource && binding.serviceMusicServiceId !== state.serviceMusic.ownerServiceId) return;
  const level = Math.round(Math.min(Math.max(Number(value) || 0, 0), 5) * 4) / 4;
  state.serviceMusic.volumeLevel = level;
  const audio = getServiceMusicAudio();
  const fade = state.serviceMusic.fadeStop;
  audio.volume = (level / 5) * (fade ? Math.max(0, 1 - (Date.now() - fade.started) / 1200) : 1);
  updateServiceMusicTransportControls();
}

function presenterSyncTimelineForSlide(slide = null) {
  const sync = slide?.syncTimeline && typeof slide.syncTimeline === "object" ? slide.syncTimeline : null;
  if (!sync) return null;
  const groupId = String(sync.groupId || "").trim();
  const audioSrc = normalizePresenterMediaSource(sync.audioSrc || "");
  if (!groupId || !audioSrc) return null;
  const start = sync.start == null ? NaN : Number(sync.start);
  return {
    groupId,
    audioSrc,
    start: Number.isFinite(start) && start >= 0 ? start : null,
    lead: Math.max(0, Math.min(Number(sync.lead ?? sync.advanceLead ?? 0.25) || 0, 2)),
  };
}

function presenterSyncedLyricsTargetForTime(slides = [], activeIndex = 0, currentTime = 0) {
  const activeSync = presenterSyncTimelineForSlide(slides[activeIndex]);
  if (!activeSync) return null;
  const time = Number(currentTime);
  if (!Number.isFinite(time) || time < 0) return null;
  // Inserted service media is an operator-controlled boundary. A song's audio
  // clock must not jump over it to a later lyric (or seek across it backwards).
  const parentId = slides[activeIndex]?.progressionParentId || slides[activeIndex]?.elementId;
  let segmentStart = -1, segmentEnd = slides.length;
  slides.forEach((slide, index) => {
    if (!slide.progressionParentId || slide.progressionParentId !== parentId || presenterSlideIsHidden(slide)) return;
    const photoSync = presenterSyncTimelineForSlide(slide);
    if (photoSync?.groupId === activeSync.groupId && photoSync.audioSrc === activeSync.audioSrc) return;
    if (index < activeIndex) segmentStart = index;
    else if (index > activeIndex && segmentEnd === slides.length) segmentEnd = index;
  });
  const groupSlides = slides
    .map((slide, index) => ({ slide, index, sync: presenterSyncTimelineForSlide(slide) }))
    .filter(({ slide, index, sync }) =>
      index > segmentStart && index < segmentEnd && sync
      && !presenterSlideIsHidden(slide)
      && sync.groupId === activeSync.groupId
      && sync.audioSrc === activeSync.audioSrc
      && sync.start !== null
    )
    .sort((a, b) => a.sync.start - b.sync.start || a.index - b.index);
  let target = null;
  groupSlides.forEach((candidate) => {
    if (Math.max(0, candidate.sync.start - candidate.sync.lead) <= time) target = candidate;
  });
  return target;
}

// Manual navigation owns the screen until an explicit synchronized restart.
// Keep the media pipeline (including a pending play promise) untouched.
function suspendServiceMusicAutoSync() {
  if (state.serviceMusic.mode === "presenter-audio") state.serviceMusic.autoSyncSuspended = true;
}

function syncServiceMusicSyncedLyricsWithCurrentTime(options = {}) {
  if (state.serviceMusic.mode !== "presenter-audio" || !state.serviceMusic.playing
    || state.serviceMusic.pending || state.serviceMusic.autoSyncSuspended
    || (state.serviceMusic.ownerServiceId && state.serviceMusic.ownerServiceId !== state.presenter.serviceId)) return false;
  if (state.presenter.safetyBlank || state.presenter.liveScripture?.active) return false;
  const audio = state.serviceMusic.audio;
  if (!audio || audio.paused || audio.ended) return false;
  const slides = state.presenter.slides || [];
  const activeIndex = clampPresenterIndex(state.presenter.index, slides.length);
  const activeSync = presenterSyncTimelineForSlide(slides[activeIndex]);
  if (!activeSync) return false;
  // A reused URL is not occurrence identity; local timing keeps its explicit owner.
  if (slides[activeIndex]?.syncTimeline?.localTiming
    && state.serviceMusic.timingGroupId !== activeSync.groupId) return false;
  const source = normalizePresenterMediaSource(state.serviceMusic.sourceKey || audio.currentSrc || audio.src || "");
  if (!source || source !== activeSync.audioSrc) return false;
  const target = presenterSyncedLyricsTargetForTime(slides, activeIndex, Number(audio.currentTime) || 0);
  if (!target || target.index === state.presenter.index) return false;
  state.presenter.index = target.index;
  state.presenter.safetyBlank = false;
  syncSelectedServiceItemToPresenterSlide(state.presenter.serviceId);
  if (options.publish !== false) publishPresenterState();
  if (options.render !== false && state.module === "presenter" && state.selectedServiceId === state.presenter.serviceId) {
    renderPresenterControlState(state.presenter.serviceId);
  }
  if (options.scroll !== false) scrollPresenterBoardToIndexStable(state.presenter.serviceId, state.presenter.index, { force: false });
  return true;
}

function updateLiveScriptureDraft(value, serviceId = state.selectedServiceId || state.presenter.serviceId) {
  if (!serviceId) return;
  state.presenterScriptureDrafts ||= {};
  const previous = state.presenterScriptureDrafts[serviceId] ?? (state.presenter.serviceId === serviceId ? state.presenter.liveScripture.draft : "");
  if (String(previous || "") !== String(value || "") && state.presenter.serviceId === serviceId) liveScriptureRequestSerial += 1;
  state.presenterScriptureDrafts[serviceId] = String(value || "");
  if (state.presenter.serviceId === serviceId) state.presenter.liveScripture.draft = String(value || "");
}

const pendingPresenterCitationRequests = new Set();
let presenterCitationAutoOutput = true;

function resolvePresenterCitationTarget(serviceId, elementId, slotKey = "") {
  const service = state.services.find((candidate) => candidate.id === serviceId) || null;
  const items = getServiceItems(serviceId);
  let index = items.findIndex((item) => String(item?.id || "").trim() === elementId);

  if (index < 0 && service) {
    const outlineItem = getServiceOutlineItems(service)
      .find((item) => String(item?.id || "").trim() === elementId);
    const sourceIndex = Number(outlineItem?._serviceItemIndex);
    if (Number.isInteger(sourceIndex) && items[sourceIndex]) index = sourceIndex;
  }

  if (index < 0 && slotKey) {
    const matches = items
      .map((item, candidateIndex) => ({ item, candidateIndex }))
      .filter(({ item }) => serviceItemSlotKey(item) === slotKey && isOptionalCitationScriptureServiceItem(item));
    if (matches.length === 1) index = matches[0].candidateIndex;
  }

  return { service, items, index, item: items[index] || null };
}

async function appendPresenterCitationReference(input) {
  const serviceId = String(input?.dataset?.serviceId || state.selectedServiceId || "").trim();
  const elementId = String(input?.dataset?.presenterCitationElementId || "").trim();
  const slotKey = String(input?.dataset?.presenterCitationSlotKey || "").trim();
  const rawValue = String(input?.value || "").trim();
  if (!serviceId || !elementId || !rawValue) return;
  const requestKey = `${serviceId}:${elementId}:${slotKey}`;
  if (pendingPresenterCitationRequests.has(requestKey)) return;

  const { service, items, index, item } = resolvePresenterCitationTarget(serviceId, elementId, slotKey);
  if (!service || !item || !isOptionalCitationScriptureServiceItem(item)) {
    showToast("인용 구절 항목을 찾지 못했습니다.", "error");
    return;
  }

  const previousItem = { ...item };
  const previousServiceDirty = state.dirty.service;
  const previousElementDirtyIds = new Set(state.dirtyServiceElementIds.get(serviceId) || []);
  const restoreCitationDraft = () => {
    const currentItems = state.serviceItems[serviceId] || [];
    const currentIndex = currentItems.findIndex((candidate) => String(candidate.id || "") === String(item.id || ""));
    if (currentIndex >= 0) {
      currentItems[currentIndex] = { ...previousItem };
      state.serviceItems[serviceId] = normalizeServiceItemsInCurrentOrder(currentItems);
    }
    state.dirty.service = previousServiceDirty;
    if (previousElementDirtyIds.size) state.dirtyServiceElementIds.set(serviceId, previousElementDirtyIds);
    else state.dirtyServiceElementIds.delete(serviceId);
    renderPresenterControlState(serviceId);
    updateSaveState();
  };

  const addedReferences = normalizeServiceScriptureReferenceList(rawValue);
  if (!addedReferences.length || addedReferences.some((reference) => !parseBibleReference(reference))) {
    showToast("성경 주소를 확인해 주세요.", "error");
    return;
  }

  const autoOutput = presenterCitationAutoOutput;
  // Reserve within the Enter gesture; navigate only after the verse resolves.
  let reservedWindow = null;
  if (autoOutput && !isPresenterOutputWindowOpen() && !window.mindexElectron?.openPresenterOutput) {
    reservedWindow = window.open("about:blank", "mindexPresenterOutput", presenterOutputWindowFeatures(resolvePresenterTargetScreenRect()));
  }

  const memo = clearGeneratedServiceScriptureSlides(item);
  const existingReferences = serviceItemScriptureReferences(item, memo, service);
  const references = uniqueList([...existingReferences, ...addedReferences]);
  memo.scriptureReferences = references;
  memo.scriptureReference = references[0] || "";
  memo.scriptureReferencePayloads = normalizeServiceScriptureReferencePayloads(memo.scriptureReferencePayloads, references);
  memo.slides = [];
  item.raw_title = formatServiceScriptureReferenceList(references);
  item.memo = serializeServiceItemMemo(memo);
  item._worshipElementTemplateModified = true;
  item._worshipTemplatePlaceholder = false;
  state.serviceItems[serviceId] = normalizeServiceItemsInCurrentOrder(items);
  state.dirty.service = true;
  markServiceElementDirty(serviceId, item);

  pendingPresenterCitationRequests.add(requestKey);
  try {
    await validateScriptureReferences(rawValue);
    await resolveServiceScriptureBeforeSave(serviceId, index);
    const targetReference = parseBibleReference(addedReferences[0]);
    const targetElementId = String(item.id || elementId).trim();
    const targetIndex = presenterSlidesForService(serviceId).findIndex((slide) => (
      String(slide?.elementId || "") === targetElementId
      && slide?.type === "scripture"
      && presenterSlideMatchesScriptureReference(slide, targetReference)
    ));
    if (targetIndex < 0) {
      restoreCitationDraft();
      showToast("해당 성구를 찾지 못했습니다.", "error");
      return;
    }
    if (input.value.trim() === rawValue) input.value = "";
    if (autoOutput && state.selectedServiceId === serviceId) {
      const shouldOpenOutput = !presenterControllerIsLive(serviceId);
      runPresenterAction("jump", serviceId, { index: targetIndex, scroll: false });
      if (reservedWindow && !reservedWindow.closed) {
        const url = new URL(presenterOutputUrl());
        url.searchParams.set("fullscreen", "start");
        reservedWindow.location.replace(url.toString());
        state.presenter.outputWindow = reservedWindow;
        reservedWindow = null;
      }
      if (shouldOpenOutput) await openPresenterOutput(serviceId);
    } else {
      renderPresenterControlState(serviceId);
    }
    const saved = await saveServiceItemPatch(serviceId, index, {
      _itemId: targetElementId, renderAfterSave: false, silent: true,
    });
    if (!saved && !input.value.trim()) input.value = rawValue;
  } catch (error) {
    restoreCitationDraft();
    showToast(error.message || "성구를 불러오지 못했습니다.", "error");
  } finally {
    if (reservedWindow && !reservedWindow.closed) reservedWindow.close();
    pendingPresenterCitationRequests.delete(requestKey);
  }
}

function presenterSlideMatchesScriptureReference(slide = {}, targetReference = null) {
  if (!targetReference?.book?.code) return false;
  const slideReference = parseBibleReference(slide?.title || slide?.marker || "");
  if (slideReference?.book?.code !== targetReference.book.code) return false;
  if (slideReference.chapter !== targetReference.chapter) return false;
  const verse = Number(slide.scriptureVerse) || slideReference.verse;
  const verseEnd = Number(slide.scriptureVerseEnd)
    || (Number(slide.scriptureVerse) ? verse : slideReference.verseEnd || verse);
  if (targetReference.verse === null || targetReference.verse === undefined) {
    return Boolean(verse);
  }
  return verse <= targetReference.verse && verseEnd >= targetReference.verse;
}

function emptyLivePraiseState(draft = "") {
  return {
    query: "",
    draft: String(draft || ""),
    active: false,
    slides: [],
    index: 0,
    songId: "",
    versionId: "",
  };
}

let liveScriptureRequestSerial = 0;

async function runLiveScriptureAction(action, serviceId = state.selectedServiceId) {
  if (action !== "clear" && action !== "show") return;
  if (action === "clear" && serviceId !== state.presenter.serviceId) return;
  if (action === "show" && state.presenter.serviceId !== serviceId && isPresenterOutputWindowOpen()) {
    showToast("다른 예배가 송출 중입니다. 해당 예배에서 실시간 말씀을 조작해 주세요.", "info");
    return;
  }
  if (action === "clear") {
    liveScriptureRequestSerial += 1;
    state.presenter.liveScripture = { reference: "", draft: state.presenter.liveScripture.draft || "", active: false, slide: null };
    publishPresenterState({ force: true });
    renderPresenterControlState(serviceId);
    return;
  }
  const input = serviceId
    ? document.querySelector(`[data-live-scripture-input][data-service-id="${CSS.escape(String(serviceId))}"]`)
    : document.querySelector("[data-live-scripture-input]");
  const query = String(input?.value ?? state.presenterScriptureDrafts?.[serviceId] ?? (state.presenter.serviceId === serviceId ? state.presenter.liveScripture.draft : "") ?? "").trim();
  updateLiveScriptureDraft(query, serviceId);
  const requestSerial = ++liveScriptureRequestSerial;
  if (!query) {
    showToast("성구를 입력해 주세요.", "error");
    return;
  }

  try {
    if (serviceId) preparePresenterService(serviceId);
    state.presenter.liveScripture.draft = query;
    const slide = await buildLiveScriptureSlide(query);
    if (requestSerial !== liveScriptureRequestSerial || (serviceId && state.presenter.serviceId !== serviceId)) return;
    if (!slide) return;
    state.presenter.liveScripture = {
      reference: slide.title,
      draft: state.presenter.liveScripture.draft,
      active: true,
      slide,
    };
    state.presenter.livePraise = emptyLivePraiseState(state.presenter.livePraise?.draft || state.presenter.livePraise?.query || "");
    state.presenter.safetyBlank = false;
    publishPresenterState({ force: true });
    renderPresenterControlState(serviceId);
  } catch (error) {
    if (requestSerial !== liveScriptureRequestSerial || (serviceId && state.presenter.serviceId !== serviceId)) return;
    showToast(error.message || "성구를 불러오지 못했습니다.", "error");
  }
}

async function buildLiveScriptureSlide(query) {
  if (!requireClient()) return null;
  await ensureBibleBookLookups();
  if (!state.bibleTranslations.length && !state.bibleReaderError) await loadBibleTranslations({ silent: true });

  const parsedQuery = parseLiveScriptureQuery(query);
  const validation = await validateScriptureReferences(parsedQuery.referenceText, parsedQuery.translation);
  if (!validation.entries.length) { showToast("성구를 입력해 주세요.", "error"); return null; }
  const translation = validation.translation;
  const title = validation.references.join("; ");
  const text = validation.resolved.map(entry => formatLiveScriptureSlideText(entry.normalized, entry.verses)).join("\n");
  return {
    id: `live-scripture:${Date.now()}`,
    elementType: PRESENTER_ELEMENT_TYPES.SCRIPTURE_TEXT,
    layout: PRESENTER_SLIDE_LAYOUTS.LOWER_BAR_TEXT,
    outputContext: "chromakey",
    type: "scripture",
    label: "성구",
    title,
    marker: title,
    text,
    translationLabel: serviceBibleTranslationDisplayLabel(translation),
    live: true,
  };
}

function parseLiveScriptureQuery(query) {
  const text = String(query || "").normalize("NFKC").trim().replace(/\s+/g, " ");
  const wholeReference = parseBibleReference(text);
  const tokens = text.split(" ").filter(Boolean);
  const maxTranslationTokens = Math.max(tokens.length - 2, 0);
  for (let count = maxTranslationTokens; count >= 1; count -= 1) {
    const translationText = tokens.slice(-count).join(" ");
    const translation = findBibleTranslation(translationText);
    if (!translation) continue;
    const referenceText = tokens.slice(0, -count).join(" ");
    const reference = parseBibleReference(referenceText, translation);
    return { reference, referenceText, translation };
  }
  return { reference: wholeReference, referenceText: text, translation: null };
}

function formatLiveScriptureSlideText(reference, verses = []) {
  const title = String(reference || "").trim();
  const multipleVerses = verses.length > 1;
  return verses.map((verse, index) => {
    const verseText = String(verse?.text || "").trim();
    const versePrefix = multipleVerses ? bibleVerseNumberLabel(verse) : "";
    const line = [versePrefix, verseText].filter(Boolean).join("   ");
    return [index === 0 ? title : "", line].filter(Boolean).join("   ");
  }).join("\n");
}

function selectedPresenterBibleTranslation() {
  return state.bibleTranslations.find((translation) => {
    const label = `${translation.name || ""} ${translation.translationKey || ""} ${translation.abbreviation || ""}`;
    return /개역개정|\bRKB\b|\bKRV\b/i.test(label);
  })
    || state.bibleTranslations.find((translation) => isKoreanBibleTranslation(translation))
    || state.bibleTranslations[0]
    || null;
}

function formatLiveScriptureReference(reference, translation = selectedPresenterBibleTranslation()) {
  const bookName = scriptureBookCopyName(reference.book, translation);
  if (reference.verse === null) return isKoreanBibleTranslation(translation) ? `${bookName} ${bibleChapterDisplayLabel(reference.book,reference.chapter)}장` : `${bookName} ${bibleChapterDisplayLabel(reference.book,reference.chapter)}`;
  const verseRange = reference.verseEnd && reference.verseEnd !== reference.verse
    ? `${reference.verse}-${reference.verseEnd}`
    : `${reference.verse}`;
  return `${bookName} ${bibleChapterDisplayLabel(reference.book,reference.chapter)}:${verseRange}`;
}
