export const KEYNOTE_HTML_RUNTIME_SHA256 = '17c0c938caa49d5c70bd83bd5b84f57381faa51602932ca733aa965055026d91';
// Private exported deck code runs only in an opaque sandbox, never in the app realm.
const HASH = /^[a-f0-9]{64}$/;
export function normalizeKeynoteHtml(value, original) {
  if (!value || value.format !== 'apple-keynote-html-v1' || !HASH.test(value.sha256 || '')
    || !HASH.test(value.sourceSha256 || '') || value.sourceSha256 !== original?.sha256
    || !Number.isSafeInteger(value.pages) || value.pages < 1 || value.pages > 300) return null;
  let url;
  try { url = new URL(value.url); } catch { return null; }
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.pathname.endsWith('/manifest.json')) return null;
  let poster = '';
  if (value.poster) {
    try { const image = new URL(value.poster);const base = new URL('.', url);if (image.origin !== base.origin || !image.pathname.startsWith(base.pathname) || image.username || image.password || !/\.(jpeg|jpg|png)$/.test(image.pathname)) return null;poster = image.href; } catch { return null; }
  }
  return { format: value.format, url: url.href, sha256: value.sha256, sourceSha256: value.sourceSha256, pages: value.pages, ...(poster ? { poster } : {}) };
}
export function validateKeynoteHtmlManifest(manifest, descriptor) {
  if (!manifest || manifest.format !== descriptor.format || manifest.sourceSha256 !== descriptor.sourceSha256
    || manifest.pages !== descriptor.pages || !Array.isArray(manifest.slides) || manifest.slides.length !== manifest.pages
    || !manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) throw Error('Keynote 재생 자료가 원본과 일치하지 않습니다.');
  const files = Object.entries(manifest.files);
  if (!files.length || files.length > 5000) throw Error('Keynote 재생 파일 수를 확인해 주세요.');
  let bytes = 0;
  for (const [name, entry] of files) {
    if ((name !== 'index.html' && !name.startsWith('assets/')) || !/^[a-zA-Z0-9_./@-]+$/.test(name) || name.startsWith('/') || name.split('/').some(x => !x || x.startsWith('.'))
      || !HASH.test(entry.sha256 || '') || !Number.isSafeInteger(entry.size) || entry.size < 0 || entry.size > 500 * 1024 * 1024) throw Error('Keynote 재생 파일 정보를 확인해 주세요.');
    bytes += entry.size;
  }
  if (bytes > 500 * 1024 * 1024 || !manifest.files['assets/player/main.js'] || !manifest.files['assets/header.json']) throw Error('Keynote 재생 자료 크기를 확인해 주세요.');
  let lastScene = 0;
  for (const slide of manifest.slides) {
    if (!manifest.files[slide.thumbnail] || !Number.isSafeInteger(slide.sceneStart) || slide.sceneStart !== lastScene
      || !Number.isSafeInteger(slide.scenes) || slide.scenes < 1 || slide.scenes > 1000) throw Error('Keynote 효과 순서를 확인해 주세요.');
    lastScene += slide.scenes;
  }
  if (!Number.isSafeInteger(manifest.scenes) || manifest.scenes !== lastScene) throw Error("Keynote 전체 효과 수를 확인해 주세요.");
  return manifest;
}
export function patchKeynoteHtmlPlayer(source) {
  // A narrowly recognized Apple export receives a bridge; unknown exports fail closed.
  for (const marker of ['UC=new Eg', 'url:Q,cMapUrl:_C', 'workerSrc="./assets/player/pdfjs/pdf.worker.min.js"']) {
    if (source.split(marker).length !== 2) throw Error('이 Keynote 내보내기 버전은 아직 지원하지 않습니다.');
  }
  return source.replace('UC=new Eg', 'UC=window.__mindexKeynoteController=new Eg')
    .replace('url:Q,cMapUrl:_C', 'url:new URL(Q,document.baseURI).href,cMapUrl:new URL(_C,document.baseURI).href')
    .replace('workerSrc="./assets/player/pdfjs/pdf.worker.min.js"', 'workerSrc=new URL("./assets/player/pdfjs/pdf.worker.min.js",document.baseURI).href');
}
export function keynoteCheckpoint(value, scenes) {
  if (!value || !Number.isSafeInteger(value.scene) || value.scene < 0 || value.scene >= scenes
    || !['initial', 'final'].includes(value.phase)) return null;
  if (!Number.isSafeInteger(value.nextScene) || value.nextScene < -1 || value.nextScene >= scenes || !Number.isSafeInteger(value.slide) || value.slide < 0 || value.slide >= 300) return null;
  return { scene: value.scene, phase: value.phase, playing: Boolean(value.playing), nextScene: value.nextScene, slide: value.slide, atEnd: Boolean(value.atEnd && value.scene === scenes - 1 && value.nextScene === -1), terminalTransition: Boolean(value.terminalTransition && value.scene === scenes - 1 && value.nextScene === -1), media: Array.isArray(value.media) ? value.media.slice(0, 100).filter(x => x && typeof x.src === 'string' && x.src.length < 4096 && Number.isFinite(x.time) && x.time >= 0 && x.time < 7 * 86400).map(x => ({ src: x.src, time: x.time, paused: Boolean(x.paused), resume: Boolean(x.resume ?? !x.paused) })) : [] };
}
export function keynoteFrameDocument({ baseUrl, player, token, bridge }) {
  const base = new URL('.', baseUrl);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || !/^[a-f0-9-]{36}$/.test(token)) throw Error('Keynote 재생 주소를 확인해 주세요.');
  const escape = x => x.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  const safeScript = x => x.replace(/<\/script/gi, '<\\/script');
  const policy = `default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' blob: ${base.href}; style-src 'unsafe-inline' ${base.href}; img-src data: blob: ${base.href}; media-src blob: ${base.href}; connect-src ${base.href}; worker-src blob: ${base.href}; font-src data: ${base.href}; base-uri ${base.href}; form-action 'none'`;
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${escape(policy)}"><base href="${escape(base.href)}"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;width:100%;height:100%;background:black;overflow:hidden}</style></head><body id="body" bgcolor="black"><div id="stageArea"><div id="stage" class="stage"></div><div id="hyperlinkPlane" class="stage"></div></div><div id="slideshowNavigator"></div><div id="slideNumberControl"></div><div id="slideNumberDisplay"></div><div id="helpPlacard"></div><div id="waitingIndicator"><div id="waitingSpinner"></div></div><script>${safeScript(`(${bridge.toString()})(${JSON.stringify(token)});`)}</script><script>${safeScript(player)}</script></body></html>`;
}

// Serialized into the opaque frame; deliberately contains no app globals.
export function keynoteHtmlFrameBridge(token) {
  let ready = false, held = true, disposed = false, uncertain = false, serial = Promise.resolve();
  let recoveryEpoch = 0;
  let currentRequest = '', restored = null, lastMessage = '', version = 0;
  const receipts = new Map(), media = new Set(), resumeIntent = new Set();
  let activationButton = null, activationPending = false;
  function requireActivation() {
    if (activationButton || disposed) return;
    activationButton = document.createElement('button');activationButton.dataset.keynoteActivate = '';activationButton.textContent = '영상·음원 재생 허용';
    activationButton.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483647;padding:14px 24px;border:0;border-radius:12px;background:#fff;color:#111;font:18px system-ui;cursor:pointer';
    activationButton.onclick = () => {
      if (activationPending) return;activationPending = true;held = false;
      // Calls are made synchronously inside the real user gesture, including Safari.
      const pending = [...resumeIntent].filter(track => !track.ended).map(track => play.call(track));
      void Promise.all(pending).then(() => { activationButton?.remove();activationButton = null;restored = null;report('activated', { checkpoint: checkpoint() }); })
        .catch(() => { activationPending = false;report('media-blocked', { message: '송출 화면에서 영상·음원 재생을 허용해 주세요.' }); });
    };
    document.body.append(activationButton);
  }
  const play = HTMLMediaElement.prototype.play, pause = HTMLMediaElement.prototype.pause;
  HTMLMediaElement.prototype.pause = function () { resumeIntent.delete(this);return pause.call(this); };
  HTMLMediaElement.prototype.play = function () {
    if (!media.has(this)) { media.add(this);this.addEventListener('ended', () => resumeIntent.delete(this)); }
    if (!restored || !held || restored.media?.some(saved => saved.src === (this.currentSrc || this.src) && (saved.resume ?? !saved.paused))) resumeIntent.add(this);
    if (held || disposed) { pause.call(this);return Promise.resolve(); }
    return play.call(this).catch(error => { if (error.name === 'NotAllowedError') requireActivation();
      report('media-blocked', { message: error.name === 'NotAllowedError' ? '송출 화면에서 영상·음원 재생을 허용해 주세요.' : '포함된 미디어 재생을 확인해 주세요.' }); });
  };
  const engine = () => window.__mindexKeynoteController;
  const stable = () => ['IdleAtInitialState', 'IdleAtFinalState'].includes(engine()?.state);
  const report = (kind, data = {}) => parent.postMessage({ type: 'mindex-keynote-html', token, kind, ...data }, '*');
  const tracks = () => [...new Set([...media, ...document.querySelectorAll('video,audio')])];
  function checkpoint() {
    const e = engine();
    if (!e?.script) return null;
    const effects = e.script.events[e.currentSceneIndex]?.effects || [];
    const mediaPlaying = e.state === 'Playing' && effects.length > 0 && effects.every(effect => ['renderMovie','renderAudio','playAudio'].includes(effect.name));
    if (!stable() && !mediaPlaying) return null;
    const final = e.state === 'IdleAtFinalState';
    return { scene: e.currentSceneIndex, phase: final ? 'final' : 'initial', playing: mediaPlaying, slide: e.currentSlideIndex >= 0 ? e.currentSlideIndex : e.scriptManager.slideIndexFromSceneIndex(e.currentSceneIndex),
      nextScene: e.nextSceneIndex, atEnd: Boolean(restored?.atEnd) || (final && e.nextSceneIndex === -1),
      terminalTransition: Boolean(restored?.terminalTransition) || (final && e.nextSceneIndex === -1 && effects.length > 0 && effects.every(effect => effect.type === 'transition')),
      media: tracks().filter(m => m.currentSrc || m.src).map(m => ({ src: m.currentSrc || m.src, time: Number(m.currentTime) || 0, paused: m.paused, resume: resumeIntent.has(m) && !m.ended })) };
  }
  async function settled(epoch = recoveryEpoch) {
    let elapsed = 0, last = Date.now();
    while (!disposed && elapsed < 30000) {
      if (epoch !== recoveryEpoch) throw Error('이전 Keynote 요청입니다. 현재 위치를 확인해 주세요.');
      const now = Date.now();if (!held || engine()?.state !== 'Playing') elapsed += now - last;last = now;
      if (stable()) return;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw Error('Keynote 효과 응답을 확인해 주세요. 재연결하면 현재 위치를 확인합니다.');
  }
  async function restore(value, epoch) {
    held = true;tracks().forEach(m => pause.call(m));resumeIntent.clear();
    const e = engine();
    // A final event displays its successor's initial frame. Jump there without
    // playing the transition again; last-event completion retains its end flag.
    const target = value.phase === 'final' && value.nextScene >= 0 ? value.nextScene : value.scene;
    if (!Number.isInteger(target) || target < 0 || target >= e.script.numScenes) throw Error('복구할 Keynote 위치를 확인해 주세요.');
    if (!stable()) e.changeState('ReadyToJump');
    e.jumpToScene(target, false);await settled(epoch);resumeIntent.clear();
    if (value.playing) {
      const effects = e.script.events[target]?.effects || [];
      if (!effects.length || !effects.every(effect => ['renderMovie','renderAudio','playAudio'].includes(effect.name))) throw Error('미디어 효과 복구 위치를 확인해 주세요.');
      e.playCurrentScene();
    }
    const deadline = Date.now() + 3000;
    for (const saved of value.media || []) {
      let track;
      do {
        const matching = tracks().filter(m => (m.currentSrc || m.src) === saved.src);
        track = matching.find(m => m.isConnected) || matching[matching.length - 1];

        if (track || (saved.paused && !saved.resume)) break;
        await new Promise(resolve => setTimeout(resolve, 30));
      } while (!disposed && Date.now() < deadline);
      if (!track) continue;
      pause.call(track);if (saved.resume ?? !saved.paused) resumeIntent.add(track);else resumeIntent.delete(track);
      if (!track.readyState) await new Promise((resolve, reject) => {
        const finish = () => { clearTimeout(timeout);track.removeEventListener('loadedmetadata', finish);resolve(); };
        const timeout = setTimeout(() => { track.removeEventListener('loadedmetadata', finish);reject(Error('미디어 위치 복구가 지연됩니다. 연결을 확인해 주세요.')); }, 10000);
        track.addEventListener('loadedmetadata', finish, { once: true });
      });
      if (disposed || epoch !== recoveryEpoch) return;
      track.currentTime = Math.min(saved.time, Number.isFinite(track.duration) ? track.duration : saved.time);

      if (track.seeking) await new Promise(resolve => {
        const finish = () => { clearTimeout(timeout);track.removeEventListener('seeked', finish);resolve(); };
        const timeout = setTimeout(finish, 1500);track.addEventListener('seeked', finish, { once: true });
      });
      if (Math.abs(track.currentTime - Math.min(saved.time, Number.isFinite(track.duration) ? track.duration : saved.time)) > 0.15 || !track.paused) throw Error('미디어 위치 복원을 확인하지 못했습니다. 재연결해 주세요.');
    }

    restored = value;report('restored', { checkpoint: checkpoint(), pausedForRecovery: true });
  }
  async function command(request) {
    if (!ready || disposed || !request || !/^[a-zA-Z0-9-]{8,80}$/.test(request.id || '')
      || !['next', 'previous', 'play', 'pause', 'restore', 'status', 'dispose'].includes(request.action)) return;
    const digest = JSON.stringify([request.action, request.checkpoint || null]);
    const old = receipts.get(request.id);
    if (old) { if (old.digest !== digest) report('error', { id: request.id, message: '같은 요청 번호를 다른 조작에 사용할 수 없습니다.' });else if (old.response) report('ack', old.response);return; }
    if (receipts.size >= 10000) { report('error', { message: '송출 요청 한도에 도달했습니다.' });return; }
    if (request.action === 'status') recoveryEpoch++;
    const epoch = recoveryEpoch;
    const receipt = { digest, response: null };receipts.set(request.id, receipt);
    const execute = async () => {
      if (epoch !== recoveryEpoch) return;
      currentRequest = request.id;
      if (uncertain && !['status', 'dispose', 'pause', 'restore'].includes(request.action)) throw Error('재연결로 현재 효과 위치를 먼저 확인해 주세요.');
      const e = engine();
      if (request.action === 'dispose') { disposed = true;held = true;tracks().forEach(m => { m.pause();m.removeAttribute('src');m.load(); });clearInterval(timer);return; }
      if (!['play', 'pause', 'status', 'restore'].includes(request.action)) await settled(epoch);
      if (epoch !== recoveryEpoch) return;
      if (request.action === 'restore') await restore(request.checkpoint, epoch);
      else if (request.action === 'pause') { for (const track of tracks()) if (!track.paused) resumeIntent.add(track);held = true;tracks().forEach(m => pause.call(m)); }
      else if (request.action === 'play') {
        held = false;
        for (const track of [...resumeIntent]) if (!track.ended) await track.play();
        restored = null;
      } else if (request.action === 'status') { uncertain = false; }
      else {
        held = false;
        if (restored?.atEnd && request.action === 'next') {
          receipt.response = { id: request.id, checkpoint: { ...checkpoint(), atEnd: true }, accepted: false };report('ack', receipt.response);return;
        }
        restored = null;
        const atEnd = e.state === 'IdleAtFinalState' && e.nextSceneIndex === -1;
        let accepted;
        if (request.action === 'next') accepted = !atEnd && e.advanceToNextBuild('mindex');
        else { accepted = !(e.currentSceneIndex === 0 && e.state === 'IdleAtInitialState');if (accepted) e.goBackToPreviousBuild('mindex'); }
        if (accepted) await settled(epoch);
        receipt.response = { id: request.id, checkpoint: checkpoint(), accepted: Boolean(accepted) };report('ack', receipt.response);return;
      }
      receipt.response = { id: request.id, checkpoint: checkpoint(), accepted: true };report('ack', receipt.response);
    };
    const operation = ['play', 'pause', 'status'].includes(request.action) ? execute() : serial.then(execute);
    const handled = operation.catch(error => { if (epoch !== recoveryEpoch) return;uncertain = true;held = true;tracks().forEach(m => pause.call(m));report('error', { id: request.id, message: error.message }); });
    if (!['play', 'pause', 'status'].includes(request.action)) serial = handled;
  }
  addEventListener('message', event => {
    if (event.source !== parent || event.data?.type !== 'mindex-keynote-html-command' || event.data.token !== token) return;
    void command(event.data.request);
  });
  // Parent owns navigation. Hyperlinks, keys and pointer events never bypass its
  // command receipts or navigate out of the sandbox.
  for (const name of ['keydown', 'keypress', 'click', 'contextmenu', 'mousedown', 'mouseup', 'pointerdown', 'pointerup', 'touchstart', 'touchend']) addEventListener(name, event => {
    const activation = event.target?.closest?.('[data-keynote-activate]');
    if (activation && (event.type === 'click' || (event.type === 'keydown' && ['Enter', ' '].includes(event.key)))) activationButton?.onclick?.(event);
    event.preventDefault();event.stopImmediatePropagation();
  }, { capture: true, passive: false });
  const timer = setInterval(() => {
    if (disposed) return;
    const e = engine();
    if (!ready && e?.script?.numScenes && e.currentSceneIndex >= 0) {
      ready = true;
      const first = checkpoint() || { scene: e.currentSceneIndex, phase: 'initial', nextScene: e.nextSceneIndex, slide: e.scriptManager.slideIndexFromSceneIndex(e.currentSceneIndex), atEnd: false, media: tracks().map(m => ({ src: m.currentSrc || m.src, time: Number(m.currentTime) || 0, paused: m.paused, resume: resumeIntent.has(m) && !m.ended })) };
      report('ready', { scenes: e.script.numScenes, pages: e.script.slideList.length, checkpoint: first });
    }
    if (!ready) return;
    const value = checkpoint();if (!value) return;const signature = JSON.stringify(value);
    if (signature !== lastMessage) { lastMessage = signature;report('checkpoint', { checkpoint: value, version: ++version, requestId: currentRequest, held }); }
  }, 200);
  addEventListener('pagehide', () => { disposed = true;held = true;tracks().forEach(m => m.pause());clearInterval(timer); });
}

export function attachKeynoteHtmlToMemo(value, descriptor) {
  const memo = JSON.parse(String(value));
  if (!memo || typeof memo !== 'object' || Array.isArray(memo)) throw Error('원본 자료 정보를 확인해 주세요.');
  const field = ['asset', 'file', 'media'].find(key => memo[key] && typeof memo[key] === 'object' && !Array.isArray(memo[key]));
  if (!field || !normalizeKeynoteHtml(descriptor, memo[field].original)) throw Error('재생 자료가 원본과 일치하지 않습니다.');
  memo[field] = { ...memo[field], keynoteHtml: descriptor };
  return JSON.stringify(memo);
}

export function assertKnownKeynoteHtmlRuntime(manifest) {
  if (manifest.runtimeSha256 !== KEYNOTE_HTML_RUNTIME_SHA256 || manifest.files?.['assets/player/main.js']?.sha256 !== KEYNOTE_HTML_RUNTIME_SHA256) throw Error('이 Keynote 내보내기 버전은 아직 지원하지 않습니다.');
}
