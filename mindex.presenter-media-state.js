// Output video lifecycle subscription; controller/remote transport remains external.
function bindPresenterOutputMediaState(isActive, notify) {
  let timer = null;
  const events = ['play', 'pause', 'ended', 'waiting', 'canplay', 'error', 'emptied', 'seeked', 'loadedmetadata', 'durationchange'];
  const onState = event => {
    if (!isActive() || !event.target?.matches?.('#presenterOutputRoot video.presenter-video') || timer !== null) return;
    timer = window.setTimeout(() => { timer = null; notify(); }, 40);
  };
  events.forEach(type => document.addEventListener(type, onState, true));
  return () => {
    window.clearTimeout(timer);
    events.forEach(type => document.removeEventListener(type, onState, true));
  };
}

// Controller clocks use media observations; unknown/live duration is never a countdown.
function presenterMediaClock(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "–:––";
  return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
}

function presenterVideoSourceFeedback(video) {
  return {unverified:"송출 창을 다시 열어 주세요.",mismatch:"새 영상 반영 대기"}[video?.sourceProblem] || "";
}

function presenterMediaClockText(position, duration, loop = false) {
  const known = Number.isFinite(duration) && duration > 0;
  const current = Number.isFinite(position) ? Math.max(0, known ? Math.min(position, duration) : position) : 0;
  return `${presenterMediaClock(current)} / ${presenterMediaClock(known ? duration : NaN)} · ${loop ? "이번 반복 남은" : "남은"} ${presenterMediaClock(known ? Math.max(0, duration - current) : NaN)}`;
}

function presenterVideoSeekIdentity() {
  const p = state.presenter, h = p.videoHealth;
  return JSON.stringify([p.outputSessionId, h?.clientId, h?.messageId, h?.frameKey, h?.revision]);
}

function presenterVideoCanSeek(health, position) {
  return Number.isFinite(position) && position >= 0 && Number.isFinite(health?.durationSeconds)
    && health.durationSeconds > 0 && position <= health.durationSeconds
    && Array.isArray(health.seekable) && health.seekable.some(([start, end]) => Number.isFinite(start) && Number.isFinite(end) && position >= start && position <= end);
}

function renderPresenterVideoTransport(video, enabled, fallback = "") {
  if (!video) return "";
  return `<label class="song-timing-seek presenter-video-seek"><span class="song-timing-seek-label">영상 위치</span><input type="range" min="0" max="${Number.isFinite(video.durationSeconds) && video.durationSeconds > 0 ? video.durationSeconds : 0}" step="0.1" value="0" disabled data-presenter-video-seek data-video-owner="${escapeAttr(presenterVideoSeekIdentity())}" data-video-enabled="${Boolean(enabled)}" aria-label="송출 영상 재생 위치" onpointerdown="beginPresenterVideoSeek(this)" oninput="previewPresenterVideoSeek(this)" onchange="void commitPresenterVideoSeek(this)" onpointercancel="cancelPresenterVideoSeek(this)" onpointerup="finishPresenterVideoSeekGesture(this)" onblur="finishPresenterVideoSeekGesture(this)"><span data-presenter-video-clock>${escapeHtml(fallback)}</span></label>`;
}

function syncPresenterVideoTransport(video = presenterManagedVideoState()) {
  for (const input of document.querySelectorAll("[data-presenter-video-seek]")) {
    const row = input.closest("[data-input-video-controls]");
    const current = row ? presenterInputVideoState(row, video) : video;
    const enabled = row ? Boolean(current?.ready && !presenterVideoRequests.size && state.selectedServiceId === row.dataset.serviceId) : input.dataset.videoEnabled === "true";
    const known = !current?.sourceProblem && Number.isFinite(current?.durationSeconds) && current.durationSeconds > 0;
    input.disabled = !current?.ready || !enabled || !known || !current.seekable?.length;
    if (!input._videoSeekOwner) {
      input.max = known ? current.durationSeconds : 0;
      input.value = Math.max(0, Math.min(Number(current?.positionSeconds) || 0, Number(input.max)));
      input.dataset.videoOwner = presenterVideoSeekIdentity();
      const feedback = presenterVideoSourceFeedback(current);
      input.parentElement.querySelector("[data-presenter-video-clock]").textContent = row && !current ? "송출 대기" : feedback ? (row ? feedback : "–:––") : presenterMediaClockText(current?.positionSeconds, current?.durationSeconds, current?.loop);
    }
    if (row) syncPresenterInputMediaButton(row.querySelector('button'), current?.status === 'playing', !enabled, '영상');
  }
}

function beginPresenterVideoSeek(input) {
  if (!input.disabled) input._videoSeekOwner ||= input.dataset.videoOwner;
}

function previewPresenterVideoSeek(input) {
  beginPresenterVideoSeek(input);
  input.parentElement.querySelector("[data-presenter-video-clock]").textContent = presenterMediaClockText(Number(input.value), Number(input.max), presenterManagedVideoState()?.loop);
}

function finishPresenterVideoSeekGesture(input) {
  window.setTimeout(() => { if (!input._videoSeekPending) cancelPresenterVideoSeek(input); }, 0);
}

function cancelPresenterVideoSeek(input) {
  delete input._videoSeekOwner;
  syncPresenterVideoTransport();
}

async function commitPresenterVideoSeek(input) {
  const owner = input._videoSeekOwner || input.dataset.videoOwner;
  const serviceId = state.presenter.serviceId, position = Number(input.value);
  input._videoSeekPending = true;
  try {
    if (!input.isConnected || input.disabled || (input.closest("[data-input-video-controls]") && !presenterInputVideoState(input.closest("[data-input-video-controls]"))?.ready) || owner !== presenterVideoSeekIdentity()) throw Error("송출 영상이 바뀌었습니다. 현재 화면을 확인해 주세요.");
    await requestPresenterVideoCommand(serviceId, "seek", position);
  } catch (error) { showToast(error.message, "error"); }
  finally { delete input._videoSeekPending; delete input._videoSeekOwner; renderGlobalPlaybackControls(); }
}

function presenterManagedVideoState() {
  const serviceId = state.presenter.serviceId;
  if (!serviceId || !presenterControllerIsLive(serviceId) || !isPresenterOutputWindowOpen()) return null;
  const video = presenterRemoteVideoState(serviceId);
  return video ? { ...video, positionSeconds: state.presenter.videoHealth.positionSeconds, durationSeconds: state.presenter.videoHealth.durationSeconds, seekable: state.presenter.videoHealth.seekable, loop: state.presenter.videoHealth.loop } : null;
}

function renderPresenterVideoManagement(video) {
  const busy = presenterVideoRequests.size > 0;
  const enabled = video?.ready && !busy && state.selectedServiceId === state.presenter.serviceId;
  const labels = { playing: "재생 중", paused: "일시정지", ended: "재생 완료", blocked: "PC에서 재생 허용 필요", loading: "영상 준비 중", error: "영상 재생 실패" };
  const status = busy ? "처리 중…" : video ? presenterVideoSourceFeedback(video) || labels[video.status] || "상태 확인 중" : "송출 중인 영상이 없습니다.";
  const title = state.presenter.slides[state.presenter.index]?.title || "현재 영상";
  return `<section class="global-media-section" aria-label="영상"><h3>영상</h3>
    ${video ? `<div class="global-playback-group"><span class="global-playback-name">${escapeHtml(title)}</span></div>` : ""}
    <p class="global-playback-state" role="status">${escapeHtml(status)}</p>
    ${renderPresenterVideoTransport(video, enabled)}
    <div class="global-playback-actions" role="group" aria-label="영상 재생 제어" ${video ? "" : "hidden"}>
      ${[["play","play","재생"],["pause","pause","일시정지"],["restart","rotate-ccw","처음부터"]].map(([action,icon,label]) => `<button type="button" class="btn secondary" data-global-playback-action="video-${action}" aria-label="영상 ${label}" ${!enabled || (action === "pause" ? video?.status !== "playing" : action === "play" && video?.status === "playing") ? "disabled" : ""}><i data-lucide="${icon}"></i><span>${label}</span></button>`).join("")}
    </div></section>`;
}



// Input controls share the live transport, never a second preview player.
function presenterInputVideoState(row, video = presenterManagedVideoState()) {
  const slide = state.presenter.slides[state.presenter.index];
  if (!row || !video || row.dataset.serviceId !== state.presenter.serviceId
    || row.dataset.elementId !== String(slide?.songTimingElementId || slide?.progressionParentId || slide?.elementId || "")
    || normalizePresenterMediaSource(row.dataset.source) !== normalizePresenterMediaSource(slide?.videoSrc || slide?.text)) return null;
  return video;
}

function renderPresenterInputVideoControls(asset, scope = []) {
  if (!asset?.url) return "";
  return `<div class="svc-input-media-controls" data-input-video-controls data-service-id="${escapeAttr(scope[0] || "")}" data-element-id="${escapeAttr(String(scope[1] || ""))}" data-source="${escapeAttr(asset.url)}" aria-label="${escapeAttr(`${asset.name || "영상"} 송출 제어`)}"><button type="button" class="icon-btn" onclick="void runPresenterInputVideoAction(this)" aria-label="영상 재생" disabled><i data-lucide="play"></i></button>${renderPresenterVideoTransport({durationSeconds:null}, false, "송출 대기")}</div>`;
}

async function runPresenterInputVideoAction(button) {
  const row = button.closest('[data-input-video-controls]'), video = presenterInputVideoState(row);
  if (!row?.isConnected || !video?.ready || state.selectedServiceId !== row.dataset.serviceId) return;
  await runPresenterManagedVideoAction(video.status === 'playing' ? 'pause' : 'play');
}

function syncPresenterInputMediaButton(button, playing, disabled, label, pending = false) {
  if (!button) return;
  button.disabled = disabled;
  button.setAttribute('aria-pressed', String(playing));
  button.setAttribute('aria-label', `${label} ${pending ? '준비 취소' : playing ? '일시정지' : '재생'}`);
  const icon = playing ? 'pause' : 'play';
  if (button.dataset.mediaIcon !== icon) { button.dataset.mediaIcon = icon; button.innerHTML = `<i data-lucide="${icon}"></i>`; refreshIcons(button); }
}

function renderPresenterInputAudioControls(source, label, serviceId, elementId, timed = false) {
  return `<div class="svc-input-media-controls" data-input-audio-controls data-source="${escapeAttr(source)}" data-label="${escapeAttr(label)}" data-service-id="${escapeAttr(serviceId)}" data-element-id="${escapeAttr(elementId)}" data-timed="${Boolean(timed)}" aria-label="${escapeAttr(`${label} 재생 제어`)}"><button type="button" class="icon-btn" onclick="void runPresenterInputAudioAction(this)" aria-label="음원 재생"><i data-lucide="play"></i></button>${globalThis.MindexSongTiming?.transport({source,serviceId,elementId,remaining:true}) || ""}</div>`;
}

function syncPresenterInputAudioControls() {
  const music = state.serviceMusic;
  for (const row of document.querySelectorAll('[data-input-audio-controls]')) {
    const active = globalThis.MindexSongTiming?.ownsTransport(row.dataset.source, row.dataset.serviceId, row.dataset.elementId);
    syncPresenterInputMediaButton(row.querySelector('button'), Boolean(active && music.playing), !active && Boolean(music.playing || music.pending), '음원', active && music.pending);
  }
}

async function runPresenterInputAudioAction(button) {
  const row = button.closest('[data-input-audio-controls]');
  if (!row?.isConnected) return;
  const {source,serviceId,elementId,label,timed} = row.dataset;
  const binding = {serviceMusicSource:source,serviceMusicServiceId:serviceId,serviceMusicLabel:label,serviceMusicRepeatAllowed:'false'};
  if (globalThis.MindexSongTiming?.ownsTransport(source,serviceId,elementId)) return runServiceMusicAction('toggle', state.serviceMusic.mode === 'presenter-audio' ? null : binding);
  if (timed === 'true') {
    const sameSource = presenterSlidesForService(serviceId).some(s => (s.songTimingElementId || s.progressionParentId || s.elementId) === elementId && s.syncTimeline?.localTiming && s.syncTimeline.audioSrc === source);
    if (sameSource) return globalThis.MindexSongTiming?.play(serviceId,elementId);
    showToast('음원과 자동 넘김 순서를 다시 확인해 주세요.','info'); return;
  }
  return runServiceMusicAction('toggle',binding);
}

// Natural media completion owns automatic advance and its visual transition marker.
function bindPresenterOutputAutoAdvanceOnEnd(root, payload, slide, options = {}) {
  if (!presenterSlideShouldAutoAdvanceOnEnd(slide)) return;
  const video = root?.querySelector(".presenter-output-layer.is-active video.presenter-video");
  const onAutoAdvance = typeof options.onAutoAdvance === "function" ? options.onAutoAdvance : null;
  if (!video || !onAutoAdvance) return;
  const serviceId = payload?.serviceId || "";
  const slideId = slide?.id || "";
  const slideIndex = clampPresenterIndex(payload?.index, Array.isArray(payload?.slides) ? payload.slides.length : 0);
  video.onended = () => {
    if (root.querySelector(".presenter-output-layer.is-active video.presenter-video") !== video) return;
    root._presenterVideoEndFade = { serviceId, frameKey: video.closest('.presenter-output-layer')?.dataset.presenterFrameKey,
      nextIndex: (payload.slides || []).findIndex((candidate, index) => index > slideIndex && !presenterSlideIsHidden(candidate)) };
    onAutoAdvance({ serviceId, slideId, slideIndex });
  };
}

function presenterSlideShouldAutoAdvanceOnEnd(slide) {
  if (!slide || presenterSlideElementType(slide) !== PRESENTER_ELEMENT_TYPES.VIDEO) return false;
  if (presenterSlideLayout(slide) !== PRESENTER_SLIDE_LAYOUTS.MEDIA) return false;
  if (slide.live) return false;
  const presenterRole = normalizeServicePresenterRole(slide.presenterRole);
  if (["ready", "waiting_loop"].includes(presenterRole)) return false;
  const playback = presenterPlaybackConfig(slide.playback, presenterRole === "intro" ? "intro-video" : "video");
  return playback.autoAdvanceOnEnd !== false && playback.loop !== true;
}

// Shared audio volume UI and guarded changes follow the current output state.
function renderServiceMusicVolumeControl() {
  const music = state.serviceMusic;
  const percent = Math.round(music.volumeLevel * 20);
  const enabled = isPresenterOutputWindowOpen();
  return `<span class="svc-volume-control" title="${enabled ? "음악 볼륨" : "송출 중에만 볼륨을 조절할 수 있습니다"}">
    <i data-lucide="volume-2" aria-hidden="true"></i>
    <input class="svc-music-volume" type="range" min="0" max="5" step="0.25" value="${music.volumeLevel}" data-service-music-volume aria-label="${escapeAttr(uiText("presenter.music.volume"))}" aria-valuetext="${percent}%" ${enabled ? "" : "disabled"}>
    <output data-service-music-volume-value aria-hidden="true">${percent}%</output>
  </span>`;
}

function syncServiceMusicVolumeControls() {
  const enabled = isPresenterOutputWindowOpen();
  const level = state.serviceMusic.volumeLevel;
  document.querySelectorAll("[data-service-music-volume]").forEach(input => {
    input.disabled = !enabled;
    input.value = String(level);
    input.setAttribute("aria-valuetext", `${Math.round(level * 20)}%`);
    input.closest(".svc-volume-control").title = enabled ? "음악 볼륨" : "송출 중에만 볼륨을 조절할 수 있습니다";
  });
  document.querySelectorAll("[data-service-music-volume-value]").forEach(output => {
    output.textContent = `${Math.round(level * 20)}%`;
  });
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

function serviceItemIsFreePrayer(item = {}, service = null) {
  if (serviceMemoElementType(parseServiceItemMemo(item.memo)) === "title_person") return false;
  const slot = item._worshipSlotKey || item.slotKey || "";
  const section = item._worshipSectionKey || item.sectionKey || item.section_key || "";
  return slot === "prayer.meeting.free" || section === "free_prayer"
    || compactSearchValue(item.label || "") === "자율기도"
    || (worshipAppServiceTypeId(service?.type_id || "") === "holy-week-dawn" && slot === "response.prayer");
}

function serviceFreePrayerAudioLabel(service) {
  const serviceName = serviceNavigationName(service) || serviceDisplayTypeName(service) || "예배";
  return `${serviceName} 자율기도 음원`;
}

function presenterSlotMusicConfig(context) {
  if (!context?.item || !serviceItemIsFreePrayer(context.item, context.service)) return "";
  if (hasServiceAsset(parseServiceItemMemo(context.item.memo).audioAsset)) return "";
  return SERVICE_SLOT_MUSIC[worshipFreePrayerAudioKey(context.service?.type_id || "")];
}

function renderServiceSlotMusic(context) {
  const config = presenterSlotMusicConfig(context);
  if (!config) return "";
  return renderServiceMusicPlayer({ ...config, label: serviceFreePrayerAudioLabel(context.service), serviceId: context.service?.id || "" });
}

// One transport location for item media, regardless of its source or service.
// Move existing nodes once: listeners, focus, media ownership and clocks survive.
function arrangePresenterBoardMediaControls(host = document) {
  const groups = new Set(host.querySelectorAll('.svc-board-subgroup'));
  const owner = host.closest?.('.svc-board-subgroup');
  if (owner) groups.add(owner);
  for (const group of groups) {
    const grid = group.querySelector(':scope > .svc-board-grid, :scope > .svc-board-media-layout > .svc-board-grid');
    if (!grid) continue;
    let layout = group.querySelector(':scope > .svc-board-media-layout');
    let rail = layout?.querySelector(':scope > .svc-board-media-rail');
    const controls = [...group.querySelectorAll('.svc-music-player--inline, .svc-input-media-controls, .svc-deck-playback')]
      .filter(node => node.closest('.svc-board-subgroup') === group && !rail?.contains(node));
    if (!controls.length) continue;
    if (!layout) {
      layout = document.createElement('div');
      layout.className = 'svc-board-media-layout';
      rail = document.createElement('div');
      rail.className = 'svc-board-media-rail';
      rail.setAttribute('role', 'group');
      rail.setAttribute('aria-label', '미디어 재생 제어');
      grid.before(layout);
      layout.append(rail, grid);
    }
    for (const control of controls) {
      const label = control.parentElement?.matches('.svc-audio-manager')
        ? control.parentElement.querySelector(':scope > strong') : null;
      if (label) rail.append(label);
      const editor = control.closest('.svc-reference-media-input');
      if (editor) {
        rail.append(editor);
        editor.append(control);
      } else rail.append(control);
    }
  }
}

function presenterFreePrayerDisplayItem(original, service) {
  if (!serviceItemIsFreePrayer(original, service)) return original;
  return {
    ...original, label: "자율기도", _worshipSectionKey: "free_prayer", _worshipSectionTitle: "자율기도",
    ...(["", "기도", "기도회", "통성기도", "자율기도"].includes(compactSearchValue(original.raw_title || "")) ? { raw_title: "" } : {}),
  };
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
  const label = serviceItemIsFreePrayer(context.item, context.service)
    ? serviceFreePrayerAudioLabel(context.service)
    : audioAsset.url ? audioAsset.name || "연결된 음원" : timingAudio?.name || "연결된 음원";
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

// Detached elements buffer only the open service and never own playback until selected.
const presenterPreparedAudio = new Map();
function prepareServiceAudio(sources) {
  const connection = navigator.connection;
  const wanted = new Set((connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || "") ? [] :
    [...new Set(sources.map(normalizePresenterMediaSource).filter(s =>
      s && !presenterMediaSourceIsYoutube(s) && s !== state.serviceMusic.sourceKey))]).slice(0, 8));
  for (const [source, audio] of presenterPreparedAudio) {
    if (wanted.has(source) && !audio.error) continue;
    presenterPreparedAudio.delete(source);
    audio.removeAttribute("src");
    audio.load();
  }
  for (const source of wanted) {
    if (presenterPreparedAudio.has(source)) continue;
    const audio = new Audio();
    audio.preload = "auto";
    presenterPreparedAudio.set(source, audio);
    audio.src = source;
  }
}

function warmSelectedServiceAudio(serviceId, service, slides) {
  if (serviceId === state.selectedServiceId) {
    const sources = [];
    for (const slide of slides) {
      if (presenterSlideIsHidden(slide)) continue;
      sources.push(presenterSlideAudioSource(slide), slide.songTimingEligible && slide.songTimingAudio?.url);
    }
    for (const item of getServiceOutputItems(serviceId)) {
      const memo = parseServiceItemMemo(item.memo);
      if (servicePraiseInputMode(item, memo) !== "children_audio") sources.push(memo.audioAsset?.url);
      sources.push(presenterSlotMusicConfig({ service, item })?.source);
    }
    prepareServiceAudio(sources.filter(Boolean));
  }
}

function takePreparedServiceAudio(source) {
  const prepared = presenterPreparedAudio.get(source);
  const previous = state.serviceMusic.audio;
  if (!prepared || prepared.error || state.serviceMusic.pending || (previous && !previous.paused)) return null;
  presenterPreparedAudio.delete(source);
  previous?.removeAttribute?.("src");
  previous?.load?.();
  return prepared;
}
