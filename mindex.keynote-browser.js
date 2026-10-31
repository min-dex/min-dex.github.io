// Explicitly paired loopback companion; tokens stay in this tab's memory only.
const PRESENTER_KEYNOTE_BRIDGE = 'http://127.0.0.1:43181';
let presenterKeynoteBridgeSession = '';
let presenterKeynoteBridgePairing = null;

async function presenterKeynoteBridgeRequest(path, options = {}, timeout = 10000) {
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(PRESENTER_KEYNOTE_BRIDGE + path, {
      ...options, credentials: 'omit', cache: 'no-store', redirect: 'error',
      headers: { ...(presenterKeynoteBridgeSession ? { Authorization: 'Bearer ' + presenterKeynoteBridgeSession } : {}), ...options.headers },
      signal: controller.signal,
    });
    if (response.status === 401) presenterKeynoteBridgeSession = '';
    if (!response.ok) {
      let code;try { code = (await response.json()).code; } catch {}
      const messages = { 'automation-permission':'Mac 설정에서 Keynote 도우미의 Keynote 자동화 연결을 허용해 주세요.',
        'keynote-timeout':'Keynote 준비 시간이 지났습니다. 원본을 확인한 뒤 다시 시도해 주세요.',
        'keynote-unavailable':'이 Mac의 Keynote 설치와 실행 상태를 확인해 주세요.',
        'keynote-export-failed':'Keynote 내보내기를 마치지 못했습니다. 원본을 확인한 뒤 다시 시도해 주세요.' };
      throw Error(messages[code] || 'Keynote 도우미 연결을 확인해 주세요. 원본은 보존됩니다.');
    }
    return path.startsWith('/jobs/') ? await response.arrayBuffer() : await response.json();
  } finally { clearTimeout(timer); }
}

async function connectPresenterKeynoteBridge() {
  if (presenterKeynoteBridgeSession) return true;
  if (presenterKeynoteBridgePairing) return presenterKeynoteBridgePairing;
  presenterKeynoteBridgePairing = (async () => {
    let health;
    try { health = await presenterKeynoteBridgeRequest('/health', {}, 2000); }
    catch { throw Error('이 Mac에서 Keynote 연결 도우미를 먼저 실행해 주세요. 선택한 파일은 아직 저장하지 않았습니다.'); }
    if (health.protocol !== 'mindex-keynote-bridge-v1') throw Error('Keynote 연결 도우미를 업데이트해 주세요.');
    const client = Array.from(crypto.getRandomValues(new Uint8Array(32)), b => b.toString(16).padStart(2, '0')).join('');
    const pair = await presenterKeynoteBridgeRequest('/pair', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client }) });
    const approval = new URL(pair.approval);
    if (approval.origin !== PRESENTER_KEYNOTE_BRIDGE || approval.pathname !== '/connect/' + pair.id || !/^[a-f0-9-]{36}$/.test(pair.id)) throw Error('Keynote 연결 요청을 확인해 주세요.');
    const dialog = document.createElement('dialog');
    dialog.className = 'unsaved-dialog';
    dialog.setAttribute('aria-labelledby', 'keynoteBridgeTitle');
    dialog.innerHTML = '<div class="unsaved-dialog-copy"><h2 id="keynoteBridgeTitle">이 Mac의 Keynote 연결</h2><p>연결 화면에서 허용하면 선택한 KEY 파일을 자동으로 준비합니다. 원본과 기존 예배 내용은 보존됩니다.</p></div><div class="unsaved-dialog-actions"><button type="button" class="btn subtle" data-keynote-pair-cancel>취소</button><a class="btn primary" target="_blank" rel="noopener noreferrer">Mac 연결 허용</a></div><p role="status">연결 허용을 기다리고 있어요.</p>';
    dialog.querySelector('a').href = approval.href;
    let cancelled = false;
    dialog.querySelector('button').onclick = () => { cancelled = true;dialog.close(); };
    dialog.addEventListener('cancel', () => { cancelled = true; });
    const opener = document.activeElement;document.body.append(dialog);dialog.showModal();
    try {
      const start = Date.now();
      while (!cancelled && Date.now() - start < 120000) {
        const result = await presenterKeynoteBridgeRequest('/pair/' + pair.id, { headers: { 'X-Mindex-Keynote-Client': client } });
        if (cancelled) throw Error('Keynote 연결을 취소했습니다. 원본은 보존됩니다.');
        if (result.token) {
          if (!/^[a-f0-9]{64}$/.test(result.token)) throw Error('Keynote 연결 정보를 확인해 주세요.');
          presenterKeynoteBridgeSession = result.token;return true;
        }
        await new Promise(resolve => setTimeout(resolve, 750));
      }
      throw Error(cancelled ? 'Keynote 연결을 취소했습니다. 원본은 보존됩니다.' : 'Keynote 연결 시간이 지났습니다. 다시 연결해 주세요.');
    } finally { dialog.close();dialog.remove();if (opener?.isConnected) opener.focus({ preventScroll: true }); }
  })();
  try { return await presenterKeynoteBridgePairing; }
  finally { presenterKeynoteBridgePairing = null; }
}

async function preparePresenterKeynoteBrowserFile(file, unchanged = () => true) {
  await connectPresenterKeynoteBridge();
  if (!unchanged()) throw Error('예배나 입력이 변경됐습니다. 기존 작업을 보존했습니다.');
  showToast('Keynote 슬라이드를 준비하고 있습니다.', 'info');
  const originalHash = await presenterPptxDigest(await file.arrayBuffer());
  const converted = await presenterKeynoteBridgeRequest('/convert', { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file }, 320000);
  const manifest = converted.manifest;
  if (!/^[a-f0-9-]{36}$/.test(converted.id) || manifest?.sourceSha256 !== originalHash) throw Error('변환된 자료가 선택한 원본과 일치하지 않습니다.');
  const module = await keynoteHtmlRuntime();
  module.validateKeynoteHtmlManifest(manifest, manifest);module.assertKnownKeynoteHtmlRuntime(manifest);
  const manifestFile = new File([JSON.stringify(manifest)], 'manifest.json');
  if (manifestFile.size > 2 * 1024 * 1024) throw Error('Keynote 재생 정보가 너무 큽니다.');
  const files = [], entries = Object.entries(manifest.files);let cursor = 0;
  const preparedFile = (bytes, name) => {
    const result = new File([bytes], name.split('/').pop());
    Object.defineProperty(result, 'webkitRelativePath', { value: 'playback/' + name });return result;
  };
  await Promise.all([0, 1, 2].map(async () => {
    while (cursor < entries.length) {
      const [name, expected] = entries[cursor++];
      if (!unchanged()) throw Error('예배나 입력이 변경됐습니다. 기존 작업을 보존했습니다.');
      if (expected.size > 50 * 1024 * 1024) throw Error('개별 재생 자료가 너무 큽니다.');
      const bytes = await presenterKeynoteBridgeRequest('/jobs/' + converted.id + '/' + name);
      if (bytes.byteLength !== expected.size || await presenterPptxDigest(bytes) !== expected.sha256) throw Error('재생 자료가 누락되거나 변경됐습니다.');
      files.push(preparedFile(bytes, name));
    }
  }));
  if (!unchanged()) throw Error('예배나 입력이 변경됐습니다. 기존 작업을 보존했습니다.');
  Object.defineProperty(manifestFile, 'webkitRelativePath', { value: 'playback/manifest.json' });files.push(manifestFile);
  return files;
}

async function connectPresenterKeynoteItemAutomatically(button) {
  const serviceId = button.dataset.serviceId, itemId = button.dataset.keynoteItemId;
  if (state.dirty.service) { showToast('입력 중인 내용을 먼저 저장한 뒤 Keynote를 연결해 주세요.', 'info');return false; }
  if (presenterPptxImports.has(serviceId)) return false;
  const client = state.client, project = state.config.url, signature = JSON.stringify(getServiceItems(serviceId));
  const unchanged = () => state.client === client && state.config.url === project && state.selectedServiceId === serviceId && !state.dirty.service && JSON.stringify(getServiceItems(serviceId)) === signature;
  const item = getServiceItems(serviceId).find(row => row.id === itemId), original = normalizeServiceAsset(parseServiceItemMemo(item?.memo).asset).original;
  if (!original || original.format !== 'key') return false;
  presenterPptxImports.add(serviceId);button.disabled = true;
  let files;
  try {
    const bytes = await readPresenterPptxSource(new URL(original.url));
    if (await presenterPptxDigest(bytes) !== original.sha256) throw Error('Keynote 원본을 다시 확인해 주세요.');
    files = await preparePresenterKeynoteBrowserFile(new File([bytes], original.name, { type: 'application/vnd.apple.keynote' }), unchanged);
  } catch (error) { showToast(error.message || 'Keynote를 준비하지 못했습니다.', 'error');return false; }
  finally { presenterPptxImports.delete(serviceId);button.disabled = false; }
  if (!unchanged()) { showToast('예배나 입력이 변경돼 기존 작업을 보존했습니다.', 'info');return false; }
  return importPresenterKeynoteHtml({ dataset: { serviceId, keynoteItemId: itemId }, files, disabled: false, value: '' }, { requireClean: true });
}

document.addEventListener('click', event => {
  const button = event.target?.closest?.('[data-keynote-auto-connect]');
  if (button) { event.preventDefault();void connectPresenterKeynoteItemAutomatically(button); }
});
