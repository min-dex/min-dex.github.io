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

function presenterMediaClockText(position, duration, loop = false) {
  const known = Number.isFinite(duration) && duration > 0;
  const current = Number.isFinite(position) ? Math.max(0, known ? Math.min(position, duration) : position) : 0;
  return `${presenterMediaClock(current)} / ${presenterMediaClock(known ? duration : NaN)} · ${loop ? "이번 반복 남은" : "남은"} ${presenterMediaClock(known ? Math.max(0, duration - current) : NaN)}`;
}

function renderPresenterInputVideoPreview(source, name) {
  return `<div class="svc-input-video-preview"><video controls playsinline preload="metadata" onplay="trackPresenterInputVideoPreview(this)" onpause="untrackPresenterInputVideoPreview(this)" onended="untrackPresenterInputVideoPreview(this)" aria-label="${escapeAttr(name)} 미리보기" src="${escapeAttr(source)}" onloadedmetadata="syncPresenterInputVideoClock(this)" ondurationchange="syncPresenterInputVideoClock(this)" ontimeupdate="syncPresenterInputVideoClock(this)" onemptied="syncPresenterInputVideoClock(this)"></video><span data-input-video-clock>${presenterMediaClockText(0, NaN)}</span><small>미리보기 · 송출 영상과 별도로 재생됩니다.</small></div>`;
}

function syncPresenterInputVideoClock(video) {
  const clock = video.parentElement?.querySelector("[data-input-video-clock]");
  if (clock) clock.textContent = presenterMediaClockText(video.currentTime, video.duration);
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

function renderPresenterVideoTransport(video, enabled) {
  if (!video) return "";
  return `<label class="song-timing-seek presenter-video-seek"><span class="song-timing-seek-label">영상 위치</span><input type="range" min="0" max="${Number.isFinite(video.durationSeconds) && video.durationSeconds > 0 ? video.durationSeconds : 0}" step="0.1" value="0" disabled data-presenter-video-seek data-video-owner="${escapeAttr(presenterVideoSeekIdentity())}" data-video-enabled="${Boolean(enabled)}" aria-label="송출 영상 재생 위치" onpointerdown="beginPresenterVideoSeek(this)" oninput="previewPresenterVideoSeek(this)" onchange="void commitPresenterVideoSeek(this)" onpointercancel="cancelPresenterVideoSeek(this)" onpointerup="finishPresenterVideoSeekGesture(this)" onblur="finishPresenterVideoSeekGesture(this)"><span data-presenter-video-clock></span></label>`;
}

function syncPresenterVideoTransport(video = presenterManagedVideoState()) {
  const input = document.querySelector("[data-presenter-video-seek]");
  if (!input) return;
  const known = Number.isFinite(video?.durationSeconds) && video.durationSeconds > 0;
  input.disabled = !video?.ready || input.dataset.videoEnabled !== "true" || !known || !video.seekable?.length;
  if (input._videoSeekOwner) return;
  input.max = known ? video.durationSeconds : 0;
  input.value = Math.max(0, Math.min(Number(video?.positionSeconds) || 0, Number(input.max)));
  input.dataset.videoOwner = presenterVideoSeekIdentity();
  input.parentElement.querySelector("[data-presenter-video-clock]").textContent = presenterMediaClockText(video?.positionSeconds, video?.durationSeconds, video?.loop);
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
    if (!input.isConnected || owner !== presenterVideoSeekIdentity()) throw Error("송출 영상이 바뀌었습니다. 현재 화면을 확인해 주세요.");
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
  const status = busy ? "처리 중…" : video ? labels[video.status] || "상태 확인 중" : "송출 중인 영상이 없습니다.";
  const title = state.presenter.slides[state.presenter.index]?.title || "현재 영상";
  return `<section class="global-media-section" aria-label="영상"><h3>영상</h3>
    ${video ? `<div class="global-playback-group"><span class="global-playback-name">${escapeHtml(title)}</span></div>` : ""}
    <p class="global-playback-state" role="status">${escapeHtml(status)}</p>
    ${renderPresenterVideoTransport(video, enabled)}
    <div class="global-playback-actions" role="group" aria-label="영상 재생 제어" ${video ? "" : "hidden"}>
      ${[["play","play","재생"],["pause","pause","일시정지"],["restart","rotate-ccw","처음부터"]].map(([action,icon,label]) => `<button type="button" class="btn secondary" data-global-playback-action="video-${action}" aria-label="영상 ${label}" ${!enabled || (action === "pause" ? video?.status !== "playing" : action === "play" && video?.status === "playing") ? "disabled" : ""}><i data-lucide="${icon}"></i><span>${label}</span></button>`).join("")}
    </div></section>`;
}


// Track only playing input previews; never observe or pause output/music elements.
const presenterInputVideoPreviews = new Set();
let presenterInputVideoObserver = null;
function trackPresenterInputVideoPreview(video) {
  for (const other of presenterInputVideoPreviews) if (other !== video) other.pause();
  presenterInputVideoPreviews.add(video);
  if (presenterInputVideoObserver) return;
  presenterInputVideoObserver = new MutationObserver(() => {
    for (const preview of presenterInputVideoPreviews) if (!preview.isConnected) { preview.pause(); untrackPresenterInputVideoPreview(preview); }
  });
  presenterInputVideoObserver.observe(document.body, {childList: true, subtree: true});
}
function untrackPresenterInputVideoPreview(video) {
  presenterInputVideoPreviews.delete(video);
  if (!presenterInputVideoPreviews.size) { presenterInputVideoObserver?.disconnect(); presenterInputVideoObserver = null; }
}
function pauseClosedPresenterInputVideo(details) {
  if (!details.open) details.querySelector('video')?.pause();
}
