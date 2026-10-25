// The original remains worship-owned; this module only owns exported playback.
let presenterKeynoteHtmlModule;
const presenterKeynoteHtmlLoads = new Map();
const presenterKeynoteHtmlPreviews = new Map();
const presenterKeynoteHtmlReconnects = new Set();
function keynoteHtmlRuntime() { return presenterKeynoteHtmlModule ||= import(`./mindex.keynote-html-engine.mjs?v=${encodeURIComponent(window.MINDEX_RELEASE || 'local')}`); }
function presenterKeynoteHtmlSlide(slide) { return slide?.asset?.keynoteHtml && slide.asset.original?.format === 'key' ? slide : null; }
function presenterKeynoteHtmlKey(payload, slide) { return JSON.stringify([payload.serviceId, slide.elementId, slide.asset.original.sha256, slide.asset.keynoteHtml.sha256]); }
async function loadPresenterKeynoteHtml(descriptor, original) {
  const key = descriptor.url + '|' + descriptor.sha256;
  if (!presenterKeynoteHtmlLoads.has(key)) {
    const promise = (async () => {
      const module = await keynoteHtmlRuntime();
      if (!module.normalizeKeynoteHtml(descriptor, original)) throw Error("Keynote 재생 자료 주소나 원본 정보를 확인해 주세요.");
      const bytes = await fetchPresenterPptxBytes(descriptor.url, 2 * 1024 * 1024);
      if (await presenterPptxDigest(bytes) !== descriptor.sha256) throw Error('Keynote 재생 정보가 손상됐습니다.');
      const manifest = module.validateKeynoteHtmlManifest(JSON.parse(new TextDecoder().decode(bytes)), descriptor);
      module.assertKnownKeynoteHtmlRuntime(manifest);
      const source = new URL('assets/player/main.js', descriptor.url);
      const file = manifest.files['assets/player/main.js'];
      const player = await fetchPresenterPptxBytes(source.href, file.size);
      if (player.byteLength !== file.size || await presenterPptxDigest(player) !== file.sha256
        || file.sha256 !== '17c0c938caa49d5c70bd83bd5b84f57381faa51602932ca733aa965055026d91') throw Error('Keynote 재생 엔진을 확인해 주세요.');
      return { manifest, player: module.patchKeynoteHtmlPlayer(new TextDecoder().decode(player)), module };
    })().catch(error => { presenterKeynoteHtmlLoads.delete(key);throw error; });
    presenterKeynoteHtmlLoads.set(key, promise);
    // Retain only tiny metadata/player strings for two idle decks, never media.
    while (presenterKeynoteHtmlLoads.size > 2) presenterKeynoteHtmlLoads.delete(presenterKeynoteHtmlLoads.keys().next().value);
  }
  return presenterKeynoteHtmlLoads.get(key);
}
function advancePresenterKeynoteHtml(owner, delta) {
  const slide = presenterKeynoteHtmlSlide(owner.slides?.[owner.index]);
  if (!slide) return false;
  const key = presenterKeynoteHtmlKey(owner, slide), current = owner.pptxProgress?.key === key ? owner.pptxProgress : {};
  if (current.command || current.error) return true;
  if ((delta > 0 && current.checkpoint?.atEnd) || (delta < 0 && current.checkpoint?.scene === 0 && current.checkpoint.phase === 'initial')) { owner.pptxProgress = null;return false; }
  owner.pptxProgress = { ...current, key, command: { id: crypto.randomUUID(), action: delta > 0 ? 'next' : 'previous' } };
  return true;
}
function requestPresenterKeynoteHtmlMedia(owner, action) {
  const slide = presenterKeynoteHtmlSlide(owner.slides?.[owner.index]);
  if (!slide || !['play','pause','status'].includes(action) || (action === 'play' && (owner.safetyBlank || owner.liveScripture?.active))) return false;
  const key = presenterKeynoteHtmlKey(owner, slide), current = owner.pptxProgress?.key === key ? owner.pptxProgress : {};
  if (current.command && !['status', 'pause'].includes(action)) return true;
  owner.pptxProgress = { ...current, key, error: '', command: { id: crypto.randomUUID(), action } };return true;
}
function adoptPresenterKeynoteHtmlMetadata(metadata) {
  const owner = state.presenter, slide = presenterKeynoteHtmlSlide(owner.slides?.[owner.index]);
  if (!slide || !metadata || metadata.key !== presenterKeynoteHtmlKey(owner, slide)) return;
  const current = owner.pptxProgress?.key === metadata.key ? owner.pptxProgress : { key: metadata.key };
  if (current.run === metadata.run && Number(current.receivedVersion) >= metadata.version) return;
  const ack = metadata.id && metadata.id === current.command?.id;
  owner.pptxProgress = { ...current, run: metadata.run, receivedVersion: metadata.version,
    ...(metadata.checkpoint ? { checkpoint: metadata.checkpoint } : {}),
    ...(ack ? { command: null } : {}), error: metadata.error || '' };
  if (ack && metadata.recoveredUnknown) showToast('새로고침 전에 대기하던 효과는 다시 실행하지 않았습니다. 현재 화면을 확인해 주세요.', 'info');
  let previewChanged = false;
  if (metadata.thumbnail) {
    try {
      const base = new URL('.', slide.asset.keynoteHtml.url), image = new URL(metadata.thumbnail);
      if (image.origin === base.origin && image.pathname.startsWith(base.pathname) && /\.(jpeg|jpg|png)$/.test(image.pathname)) {
        const previewKey = `${slide.elementId}|${slide.asset.keynoteHtml.sha256}`, page = (metadata.checkpoint?.slide || 0) + 1;
        const before = presenterKeynoteHtmlPreviews.get(previewKey);previewChanged = before?.url !== image.href || before?.page !== page;
        presenterKeynoteHtmlPreviews.set(previewKey, { url: image.href, page });
      }
    } catch {}
  }
  publishPresenterState();if (previewChanged) renderPresenterControlState(owner.serviceId);
  for (const label of document.querySelectorAll('[data-keynote-page]')) if (label.dataset.keynoteItemId === slide.elementId) label.textContent = `슬라이드 ${(metadata.checkpoint?.slide || 0) + 1}/${slide.asset.keynoteHtml.pages} · 효과 재생`;
  if (ack && !metadata.recoveredUnknown && (metadata.accepted === false || metadata.checkpoint?.terminalTransition)) {
    if (metadata.checkpoint?.atEnd && current.command?.action === 'next') runPresenterAction('next', owner.serviceId);
    else if (metadata.checkpoint?.scene === 0 && metadata.checkpoint.phase === 'initial' && current.command?.action === 'previous') runPresenterAction('prev', owner.serviceId);
  }
}
function releasePresenterKeynoteHtmlOutput(root) {
  const session = root?._keynoteHtml;
  if (!session) return;
  root._keynoteHtml = null;root._keynoteHtmlMetadata = null;
  session.disposed = true;clearTimeout(session.timeout);clearInterval(session.watchdog);
  removeEventListener('message', session.onMessage);session.host.remove();root.style.visibility = '';
}
function renderPresenterKeynoteHtmlOutput(root, payload) {
  const slide = presenterKeynoteHtmlSlide(payload?.slides?.[payload.index]);
  if (!slide) { releasePresenterKeynoteHtmlOutput(root);return false; }
  const key = presenterKeynoteHtmlKey(payload, slide);
  if (root._keynoteHtml?.key !== key) {
    releasePresenterKeynoteHtmlOutput(root);
    releasePresenterPptxOutput(root);delete root.dataset.pptxError;
    root.querySelectorAll('video,audio').forEach(node => node.pause());root.innerHTML = '';
    const host = document.createElement('div');host.style.cssText = 'position:fixed;inset:0;background:black;z-index:1;pointer-events:none';
    const frame = document.createElement('iframe');frame.setAttribute('sandbox', 'allow-scripts');frame.setAttribute('allow','autoplay *');
    frame.title = 'Keynote 슬라이드';frame.style.cssText = 'width:100%;height:100%;border:0';host.append(frame);document.body.append(host);
    const session = { key, host, frame, token: crypto.randomUUID(), disposed: false, ready: false, initialized: false,
      version: 0, sent: new Set(), obsolete: new Set(), payload, initialCommand: payload.pptxProgress?.key === key ? payload.pptxProgress.command?.id || '' : '', initialUnknown: payload.pptxProgress?.command?.action !== 'status', checkpoint: null, lastCheckpoint: '', inFlight: null };
    root._keynoteHtml = session;
    if (session.initialCommand && !session.initialUnknown) presenterKeynoteHtmlReconnects.add(session.initialCommand);
    const active = () => root._keynoteHtml === session && !session.disposed;
    const metadata = value => {
      if (!active()) return;
      if (!value.checkpoint) delete value.checkpoint;
      if (value.checkpoint && session.module) { value.checkpoint = session.module.keynoteCheckpoint(value.checkpoint, session.manifest.scenes);if (!value.checkpoint) return; }
      if (value.checkpoint && session.manifest) value.thumbnail = new URL(session.manifest.slides[value.checkpoint.slide]?.thumbnail || session.manifest.slides[0].thumbnail, slide.asset.keynoteHtml.url).href;
      const first = !root._keynoteHtmlMetadata;
      root._keynoteHtmlMetadata = { ...root._keynoteHtmlMetadata, key, run: session.token, version: ++session.version, ...value };
      if (first || value.id || value.error !== undefined) root._onKeynoteAcknowledgement?.();
    };
    const send = request => {
      if (!active()) return;
      session.sent.add(request.id);session.inFlight = request.id;session.sentAt = Date.now();
      frame.contentWindow.postMessage({ type: 'mindex-keynote-html-command', token: session.token, request }, '*');
    };
    session.send = send;
    session.onMessage = event => {
      const message = event.data;
      if (!active() || event.source !== frame.contentWindow || event.origin !== 'null' || message?.type !== 'mindex-keynote-html' || message.token !== session.token) return;
      if (message.kind === 'ready') {
        if (session.ready) return;session.ready = true;clearTimeout(session.timeout);
        const progress = session.payload.pptxProgress?.key === key ? session.payload.pptxProgress : {};
        // Only a command already present when the frame was created has an unknown outcome.
        if (progress.checkpoint) {
          session.restoreId = crypto.randomUUID();send({ id: session.restoreId, action: 'restore', checkpoint: progress.checkpoint });
        } else {
          session.initialized = true;session.checkpoint = message.checkpoint || session.checkpoint;
          metadata({ checkpoint: message.checkpoint, ...(session.initialCommand ? { id: session.initialCommand, recoveredUnknown: session.initialUnknown, accepted: !session.initialUnknown } : {}) });
          if (!session.initialCommand && !progress.run) { session.startId = crypto.randomUUID();send({ id: session.startId, action: 'play' }); }
        }
      } else if (message.kind === 'ack') {
        if (!session.sent.has(message.id) || session.obsolete.has(message.id)) return;
        if (session.inFlight === message.id) session.inFlight = null;
        if (!session.mediaBlocked) delete root.dataset.pptxError;
        if (message.id === session.restoreId) {
          session.initialized = true;
          metadata({ checkpoint: message.checkpoint, ...(session.initialCommand ? { id: session.initialCommand, recoveredUnknown: session.initialUnknown, accepted: !session.initialUnknown } : {}) });
        } else metadata({ id: message.id, checkpoint: message.checkpoint, accepted: message.accepted, recoveredUnknown: false, error: session.mediaBlocked ? root.dataset.pptxError : '' });
        session.checkpoint = message.checkpoint || session.checkpoint;
      } else if (message.kind === 'checkpoint' && session.initialized && message.checkpoint) {
        session.checkpoint = message.checkpoint || session.checkpoint;
        // Heartbeats carry stable positions only; never publish mid-effect guesses.
        const signature = JSON.stringify(message.checkpoint);
        if (signature !== session.lastCheckpoint) { session.lastCheckpoint = signature;metadata({ checkpoint: message.checkpoint }); }
      } else if (message.kind === 'activated') {
        session.mediaBlocked = false;session.host.style.pointerEvents = 'none';session.frame.blur();document.body.tabIndex = -1;document.body.focus({ preventScroll: true });delete root.dataset.pptxError;metadata({ checkpoint: message.checkpoint, error: '' });
      } else if (message.kind === 'error' || message.kind === 'media-blocked') {
        if (message.id && session.obsolete.has(message.id)) return;
        if (message.id === session.inFlight) { session.inFlight = null;session.uncertain = true; }
        if (message.kind === 'media-blocked') { session.mediaBlocked = true;session.host.style.pointerEvents = 'auto'; }
        root.dataset.pptxError = message.message || 'Keynote 재생 연결을 확인해 주세요.';
        metadata({ id: message.id, checkpoint: session.checkpoint, error: root.dataset.pptxError });
      }
    };
    addEventListener('message', session.onMessage);
    session.timeout = setTimeout(() => { if (active() && !session.ready) root.dataset.pptxError = 'Keynote 재생 연결이 지연됩니다. 자료 연결을 확인해 주세요.'; }, 30000);
    session.watchdog = setInterval(() => {
      if (active() && session.inFlight && Date.now() - session.sentAt > 35000) {
        metadata({ error: '효과 응답을 확인하지 못했습니다. 재연결로 현재 위치를 확인해 주세요.', checkpoint: session.checkpoint });
        session.inFlight = null;session.uncertain = true;
      }
    }, 1000);
    void loadPresenterKeynoteHtml(slide.asset.keynoteHtml, slide.asset.original).then(({ player, module, manifest }) => {
      if (!active()) return;
      session.module = module;session.manifest = manifest;
      frame.srcdoc = module.keynoteFrameDocument({ baseUrl: slide.asset.keynoteHtml.url, player, token: session.token, bridge: module.keynoteHtmlFrameBridge });
    }).catch(error => { if (active()) { root.dataset.pptxError = error.message;metadata({ error: error.message }); } });
  }
  const session = root._keynoteHtml;session.payload = payload;
  session.host.hidden = Boolean(payload.safetyBlank || payload.liveScripture?.active);
  root.style.visibility = payload.liveScripture?.active ? '' : 'hidden';
  if (payload.liveScripture?.active) return false;
  if (payload.safetyBlank) { session.host.hidden = false;session.frame.style.visibility = 'hidden'; } else session.frame.style.visibility = '';
  const progress = payload.pptxProgress?.key === key ? payload.pptxProgress : null;
  if (progress?.command?.action === 'status' && !session.initialized) {
    const id = progress.command.id;
    if (!session.ready && root.dataset.pptxError && !presenterKeynoteHtmlReconnects.has(id)) {
      presenterKeynoteHtmlReconnects.add(id);releasePresenterKeynoteHtmlOutput(root);return renderPresenterKeynoteHtmlOutput(root, payload);
    }
    if (session.ready && progress.checkpoint && !session.sent.has(id)) {
      if (session.inFlight) session.obsolete.add(session.inFlight);
      session.initialCommand = id;session.initialUnknown = false;session.restoreId = id;session.uncertain = false;
      session.send({ id, action: 'restore', checkpoint: progress.checkpoint });
    }
  }
  if (session.initialized && progress?.command && !session.sent.has(progress.command.id) && progress.command.id !== session.initialCommand) {
    if (progress.command.action === 'status' && session.inFlight) { session.obsolete.add(session.inFlight);session.inFlight = null; }
    if (!session.inFlight && (!session.uncertain || progress.command.action === 'status')) { session.uncertain = false;session.send(progress.command); }
  }
  return true;
}

function renderPresenterKeynoteHtmlControls(asset, serviceId, itemId) {
  if (asset.original?.format !== 'key') return '';
  const identity = `data-service-id="${escapeAttr(serviceId)}" data-keynote-item-id="${escapeAttr(itemId)}" data-keynote-source-hash="${escapeAttr(asset.original.sha256)}"`;
  const controls = asset.keynoteHtml ? `<span data-keynote-page data-keynote-item-id="${escapeAttr(itemId)}">슬라이드 ${presenterKeynoteHtmlPreviews.get(`${itemId}|${asset.keynoteHtml.sha256}`)?.page || 1}/${asset.keynoteHtml.pages} · 효과 재생</span><button class="btn secondary" type="button" data-keynote-html-action="play" ${identity}>음원·영상 재생</button><button class="btn secondary" type="button" data-keynote-html-action="pause" ${identity}>일시정지</button><button class="btn secondary" type="button" data-keynote-html-action="status" ${identity}>재연결</button>` : '<span>원본 보존됨 · 재생 자료 연결 필요</span>';
  return `<div class="svc-reference-media-toolbar">${controls}<label class="btn secondary">재생 자료 연결<input type="file" webkitdirectory multiple hidden data-keynote-html-files ${identity}></label></div>`;
}
async function importPresenterKeynoteHtml(input) {
  const serviceId = input.dataset.serviceId, itemId = input.dataset.keynoteItemId;
  const files = [...(input.files || [])];
  if (!files.length || presenterPptxImports.has(serviceId)) return false;
  const client = state.client, project = state.config.url;
  const item = getServiceItems(serviceId).find(row => row.id === itemId);
  const signature = JSON.stringify(getServiceItems(serviceId));
  const unchanged = () => state.client === client && state.config.url === project && state.selectedServiceId === serviceId && JSON.stringify(getServiceItems(serviceId)) === signature;
  const original = normalizeServiceAsset(parseServiceItemMemo(item?.memo).asset).original;
  if (!item || original?.format !== 'key' || !client?.storage) { showToast('Keynote 원본이 연결된 항목을 먼저 확인해 주세요.', 'error');return false; }
  presenterPptxImports.add(serviceId);input.disabled = true;
  const uploaded = [];let saveAttempted = false;
  const bucket = client.storage.from(PRESENTER_MEDIA_STORAGE_BUCKET);
  try {
    const module = await keynoteHtmlRuntime(), byName = new Map();let total = 0;
    for (const file of files) {
      const parts = file.webkitRelativePath.split('/');parts.shift();const name = parts.join('/');
      if (!name || byName.has(name) || file.size > 50 * 1024 * 1024) throw Error('폴더를 확인해 주세요. 개별 재생 파일은 50MB 이하로 준비해 주세요.');
      byName.set(name, file);total += file.size;
    }
    if (files.length > 5001 || total > 500 * 1024 * 1024 || !byName.has('manifest.json')) throw Error('민덱스에서 준비한 Keynote 재생 폴더를 선택해 주세요.');
    const manifestFile = byName.get('manifest.json');
    if (manifestFile.size > 2 * 1024 * 1024) throw Error('Keynote 재생 정보가 너무 큽니다.');
    const manifestBytes = new Uint8Array(await manifestFile.arrayBuffer()), manifest = JSON.parse(new TextDecoder().decode(manifestBytes));
    const prefix = `services/${String(serviceId).replace(/[^a-zA-Z0-9_-]/g,'')}/keynote/${crypto.randomUUID()}/`;
    const url = bucket.getPublicUrl(prefix + 'manifest.json')?.data?.publicUrl;
    const descriptor = module.normalizeKeynoteHtml({ format: manifest.format, sourceSha256: manifest.sourceSha256, pages: manifest.pages, url, poster: new URL(manifest.slides?.[0]?.thumbnail || 'invalid', url).href, sha256: await presenterPptxDigest(manifestBytes) }, original);
    if (!descriptor) throw Error('이 재생 자료가 연결된 Keynote 원본과 일치하지 않습니다.');
    module.validateKeynoteHtmlManifest(manifest, descriptor);module.assertKnownKeynoteHtmlRuntime(manifest);
    if (byName.size !== Object.keys(manifest.files).length + 1) throw Error('재생 폴더의 파일 구성이 변경됐습니다. 다시 준비해 주세요.');
    for (const [name, expected] of Object.entries(manifest.files)) {
      const file = byName.get(name);
      if (!file || file.size !== expected.size || await presenterPptxDigest(await file.arrayBuffer()) !== expected.sha256) throw Error('재생 폴더의 파일이 누락되거나 변경됐습니다.');
    }
    if (!unchanged()) throw Error('자료를 준비하는 동안 예배나 입력이 변경됐습니다.');
    if (!window.confirm(`${original.name}\n\n원본은 그대로 두고 슬라이드 ${manifest.pages}장과 효과·포함 미디어의 재생 자료를 이 예배에 연결할까요? 기존 공개 자료 저장소를 사용합니다.`)) return false;
    const mime = name => ({ js:'application/javascript', css:'text/css', html:'text/html', json:'application/json', pdf:'application/pdf', jpeg:'image/jpeg', jpg:'image/jpeg', png:'image/png', svg:'image/svg+xml', mp4:'video/mp4', mov:'video/quicktime', mp3:'audio/mpeg', m4a:'audio/mp4', wav:'audio/wav', woff:'font/woff', woff2:'font/woff2' }[name.split('.').pop().toLowerCase()] || 'application/octet-stream');
    const entries = [...byName.entries()].sort(([a],[b]) => (a === 'manifest.json') - (b === 'manifest.json'));
    let cursor = 0, failure = null, finished = 0;
    const upload = async () => {
      while (!failure && cursor < entries.length) {
        const [name, file] = entries[cursor++], path = prefix + name;
        try {
          const { error } = await bucket.upload(path, file, { contentType: mime(name), cacheControl: PRESENTER_MEDIA_CACHE_CONTROL, upsert: false });
          if (error) throw error;uploaded.push(path);finished++;
          if (finished === 1 || finished % 20 === 0) showToast(`Keynote 재생 자료 연결 중 · ${finished}/${entries.length}`, 'info');
        } catch (error) { failure = error; }
      }
    };
    await Promise.all([upload(), upload(), upload()]);if (failure) throw failure;
    if (!unchanged()) throw Error('업로드 중 예배나 입력이 변경됐습니다. 기존 입력을 유지했습니다.');
    item.memo = module.attachKeynoteHtmlToMemo(item.memo, descriptor);item._worshipElementTemplateModified = true;
    state.dirty.service = true;markServiceElementDirty(serviceId, item);
    const index = getServiceItems(serviceId).findIndex(row => row.id === itemId);
    if (index < 0) throw Error('자료를 연결할 항목을 확인해 주세요.');
    saveAttempted = true;
    if (!await saveServiceItemMutation(serviceId, index, { silent:true, renderAfterSave:false, throwOnError:true })) throw Error('저장 상태를 확인한 후 다시 저장해 주세요.');
    showToast(`Keynote ${manifest.pages}장 재생 자료를 연결했습니다.`);return true;
  } catch (error) {
    if (!saveAttempted && uploaded.length) { try { await bucket.remove(uploaded); } catch {} }
    showToast(error.message || 'Keynote 재생 자료 연결에 실패했습니다.', 'error');return false;
  } finally {
    presenterPptxImports.delete(serviceId);input.disabled = false;input.value = '';
    renderCurrentServiceModuleDetail();renderServiceList();updateSaveState();
  }
}

function presenterKeynoteHtmlPreviewSource(slide) {
  if (!presenterKeynoteHtmlSlide(slide)) return '';
  return presenterKeynoteHtmlPreviews.get(`${slide.elementId}|${slide.asset.keynoteHtml.sha256}`)?.url || slide.asset.keynoteHtml.poster || '';
}

function presenterKeynoteHtmlPreviewSlide(slide) {
  const preview = presenterKeynoteHtmlPreviewSource(slide);
  return preview ? { ...slide, type: 'image', elementType: PRESENTER_ELEMENT_TYPES.IMAGE, layout: PRESENTER_SLIDE_LAYOUTS.MEDIA, imageSrc: preview, text: '', asset: { ...slide.asset, url: preview } } : slide;
}

function handlePresenterKeynoteHtmlAction(event) {
  const button = event.target.closest('[data-keynote-html-action]');
  if (!button || button.disabled) return false;
  event.preventDefault();
  const owner = state.presenter, slide = presenterKeynoteHtmlSlide(owner.slides?.[owner.index]);
  if (!slide || owner.serviceId !== button.dataset.serviceId || slide.elementId !== button.dataset.keynoteItemId || slide.asset.original.sha256 !== button.dataset.keynoteSourceHash) {
    showToast('이 자료를 송출 대상으로 선택한 뒤 조작해 주세요.', 'info');return false;
  }
  if (!requestPresenterKeynoteHtmlMedia(owner, button.dataset.keynoteHtmlAction)) return false;
  publishPresenterState();renderPresenterControlState(owner.serviceId);return true;
}
