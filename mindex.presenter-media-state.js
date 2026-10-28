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
