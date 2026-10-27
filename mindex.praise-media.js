// Read-only summary of the selected version's persisted audio; never borrow song memo data.
function versionAudioSummaryStatus(version, forms) {
  const audio = version?.audio_set;
  if (!audio) return "";
  const count = Array.isArray(audio.starts) ? audio.starts.filter(value => Number.isFinite(value) && value >= 0).length : 0;
  const changed = globalThis.MindexSongTiming && audio.sourceSignature !== MindexSongTiming.sourceSignature({ ...version, forms });
  const status = changed ? "가사 변경 · 타이밍 확인 필요" : `저장된 자동 넘김 ${audio.enabled ? "켜짐" : "꺼짐"}`;
  return `${count ? `저장 타이밍 ${count}개` : "저장 타이밍 없음"} · ${status}`;
}

function renderVersionAudioSummary(version, forms) {
  const audio = version?.audio_set;
  if (!audio || !String(audio.audioUrl || "").trim()) return "";
  return `<div class="version-audio-summary" data-version-audio-summary="${escapeAttr(version.id)}" aria-label="버전에 저장된 음원·타이밍">
    <span class="version-audio-summary-name">음원 · ${escapeHtml(audio.audioName || "등록된 음원")}</span>
    <span data-version-audio-status>${escapeHtml(versionAudioSummaryStatus(version, forms))}</span>
  </div>`;
}

function updateVersionAudioSummary(version, forms) {
  refs.detailPane?.querySelectorAll("[data-version-audio-summary]").forEach(node => {
    if (node.dataset.versionAudioSummary !== version.id) return;
    const status = node.querySelector("[data-version-audio-status]");
    const text = versionAudioSummaryStatus(version, forms);
    if (status && status.textContent !== text) status.textContent = text;
  });
}


// Read-only media for a catalog record; never borrows a worship item's assets.
globalThis.MindexPraiseMedia = (() => {
  const opened = new Set();
  const roots = new WeakMap();
  const players = new Set();
  let requestSerial = 0;
  const keyFor = (song, version) => JSON.stringify([song.id, version.id]);
  const audioSource = version => normalizePresenterMediaSource(version?.audio_set?.audioUrl || "");

  function render(song, version) {
    if (!song?.id || !version?.id) return "";
    const audio = globalThis.MindexSingleSong.hasAudio(version) ? audioSource(version) : "";
    const key = keyFor(song, version), label = "악보 · 음원";
    return `<details class="praise-version-media" data-praise-version-media data-praise-media-song="${escapeAttr(song.id)}" data-praise-media-version="${escapeAttr(version.id)}" data-praise-media-key="${escapeAttr(key)}"${opened.has(key) ? " open" : ""}>
      <summary>${label} 보기</summary>
      <div class="praise-version-media-content">
        <div data-praise-score-preview aria-live="polite"></div>
        ${audio ? `<audio controls preload="none" class="praise-audio-preview" data-praise-audio-key="${escapeAttr(key)}" aria-label="${escapeAttr(`${song.title || "찬양"} · ${versionDisplayName(song, version)} 미리 듣기`)}" src="${escapeAttr(audio)}"></audio><p class="praise-media-status" data-praise-audio-error role="status" hidden>음원을 불러오지 못했어요.</p>` : `<p class="praise-media-status">${escapeHtml(globalThis.MindexSongTiming?.audioStatus(version) || '등록된 음원이 없습니다.')}</p>`}
      </div>
    </details>`;
  }

  function panelContext(panel) {
    const song = songById(panel.dataset.praiseMediaSong);
    const version = song?.versions?.find(candidate => candidate.id === panel.dataset.praiseMediaVersion);
    return song && version ? { song, version } : null;
  }

  function scoreMarkup(song, version) {
    const sources = presenterHymnScoreAssetSlides(song, version).map(slide => ({ ...slide, url: normalizePresenterMediaSource(slide.url) })).filter(slide => slide.url);
    if (!sources.length) return '<p class="praise-media-status">등록된 악보가 없습니다.</p>';
    return `<div class="praise-score-previews">${sources.map((slide, index) => `<a href="${escapeAttr(slide.url)}" target="_blank" rel="noopener noreferrer" aria-label="${escapeAttr(`${song.title} 악보 ${index + 1}장 크게 보기`)}"><img src="${escapeAttr(slide.url)}" alt="${escapeAttr(`${song.title} 악보 ${index + 1}장`)}" loading="lazy" decoding="async"><span>${index + 1} / ${sources.length}</span></a>`).join("")}</div>`;
  }

  async function loadScores(panel) {
    const slot = panel.querySelector("[data-praise-score-preview]");
    if (!slot || !panel.open || !panel.isConnected) return;
    const ticket = String(++requestSerial);
    panel.dataset.praiseMediaRequest = ticket;
    slot.textContent = "악보를 불러오는 중…";
    await loadHymnScoreManifest({ silent: true });
    if (!panel.isConnected || !panel.open || panel.dataset.praiseMediaRequest !== ticket) return;
    const context = panelContext(panel);
    if (!context) { slot.textContent = "곡을 다시 선택해 주세요."; return; }
    slot.innerHTML = state.hymnScoreManifestLoaded
      ? scoreMarkup(context.song, context.version)
      : '<p class="praise-media-status">악보를 불러오지 못했어요.</p><button class="btn secondary" type="button" data-praise-score-retry>다시 불러오기</button>';
  }

  function release(audio) {
    audio.pause();
    audio.removeAttribute("src");
    audio.load();
    players.delete(audio);
  }

  function reconcile(root, binding) {
    const next = new Map();
    for (const current of root.querySelectorAll("audio[data-praise-audio-key]")) {
      const key = current.dataset.praiseAudioKey;
      const prior = binding.audio.get(key);
      let audio = current;
      if (prior && prior !== current && !prior.isConnected && prior.src === current.src) {
        prior.setAttribute("aria-label", current.getAttribute("aria-label") || "미리 듣기");
        current.replaceWith(prior);
        audio = prior;
      }
      next.set(key, audio);
      players.add(audio);
    }
    for (const [key, audio] of binding.audio) if (next.get(key) !== audio) release(audio);
    binding.audio = next;
    if (!next.size) { binding.observer.disconnect(); binding.watching = false; }
  }

  function intercept(event) {
    const panel = event.target.closest?.("[data-praise-version-media]");
    if (!panel) return;
    // A version header is selectable; media controls must keep that selection intact.
    event.stopPropagation();
    if (event.type === "click" && event.target.closest("[data-praise-score-retry]")) {
      event.preventDefault();
      void loadScores(panel);
    }
  }

  function mount(root) {
    if (!root?.querySelectorAll) return;
    let binding = roots.get(root);
    if (!binding) {
      binding = { audio: new Map(), observer: null, watching: false };
      binding.observer = new MutationObserver(() => reconcile(root, binding));
      roots.set(root, binding);
      root.addEventListener("click", intercept, true);
      root.addEventListener("keydown", intercept, true);
      root.addEventListener("toggle", event => {
        const panel = event.target;
        if (!panel.matches?.("[data-praise-version-media]")) return;
        if (panel.open) { opened.add(panel.dataset.praiseMediaKey); void loadScores(panel); }
        else {
          opened.delete(panel.dataset.praiseMediaKey);
          panel.querySelectorAll("audio[data-praise-audio-key]").forEach(audio => audio.pause());
        }
      }, true);
      root.addEventListener("play", event => {
        if (!event.target.matches?.("audio[data-praise-audio-key]")) return;
        for (const audio of players) if (audio !== event.target && !audio.paused) audio.pause();
      }, true);
      for (const eventName of ["error", "loadedmetadata"]) root.addEventListener(eventName, event => {
        if (!event.target.matches?.("audio[data-praise-audio-key]")) return;
        const message = event.target.closest("[data-praise-version-media]")?.querySelector("[data-praise-audio-error]");
        if (message) message.hidden = eventName !== "error";
      }, true);
    }
    if (!binding.watching) {
      binding.observer.observe(root, { childList: true, subtree: true });
      binding.watching = true;
    }
    reconcile(root, binding);
    root.querySelectorAll("[data-praise-version-media][open]").forEach(panel => { void loadScores(panel); });
  }

  return { render, mount };
})();
