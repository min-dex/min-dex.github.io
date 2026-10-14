/* Elem-style manual song timing. Local assets only; never writes worship/song records. */
(function (root) {
  'use strict';
  const profiles = new Map();
  let revision = 0;
  const keyFor = (songId, versionId) => JSON.stringify([String(songId || ''), String(versionId || '')]);
  const pagesFor = slides => slides.filter(s => !s.autoTrailingBlank && (s.type === 'lyrics' || s.type === 'blank'));
  const fingerprint = slides => JSON.stringify(pagesFor(slides).map(s => [s.type, String(s.text || '').normalize('NFC')]));
  const noLead = slide => slide.type === 'blank' || /^[\s♪♫♬♩]*$/.test(slide.text || '');
  function validate(profile, slides) {
    const pages = pagesFor(slides);
    if (!pages.length || profile?.lyricsFingerprint !== fingerprint(slides)) return '가사·송폼·장 나눔이 바뀌었어요. 시각을 다시 맞춰 주세요.';
    if (!profile.audioFingerprint || !(profile.audio instanceof Blob) || !(profile.duration > 0) || !Number.isFinite(profile.duration)) return '재생 가능한 음원을 선택해 주세요.';
    if (!Array.isArray(profile.starts) || profile.starts.length !== pages.length) return '모든 장의 시각을 기록해 주세요.';
    let previous = -Infinity;
    let previousCue = -Infinity;
    for (let i = 0; i < pages.length; i++) {
      const start = profile.starts[i];
      const cue = Math.max(0, start - (noLead(pages[i]) ? 0 : 1));
      if (typeof start !== 'number' || !Number.isFinite(start) || start < 0 || start >= profile.duration) return `${i + 1}장 시각을 음원 길이 안으로 입력해 주세요.`;
      if (start - previous < 0.2 || cue - previousCue < 0.2) return `${i + 1}장 시각이 앞 장과 너무 가깝거나 순서가 뒤집혔어요. (최소 0.2초)`;
      previous = start; previousCue = cue;
    }
    return '';
  }
  function decorate(slides, item, song, version) {
    if (!song?.id) return slides;
    const key = keyFor(song.id, version?.id || item.version_id || item.song_version_id);
    const profile = profiles.get(key);
    const valid = profile?.enabled && profile.url && !validate(profile, slides);
    let page = 0;
    return slides.map(slide => {
      const timed = slide.type === 'lyrics' || slide.type === 'blank';
      const intro = slide.type === 'song-title' && page === 0;
      const result = { ...slide, songTimingKey: key };
      if (timed || intro) {
        // A stale or disabled local profile must not fall back to a different timeline.
        if (profile) delete result.syncTimeline;
        if (valid) result.syncTimeline = {
          groupId: `${item.id}:local-song-timing`, audioSrc: profile.url,
          audioTitle: profile.audioName, page: timed ? page + 1 : 0,
          start: timed ? profile.starts[page] : null,
          lead: timed && !noLead(slide) ? 1 : 0, intro, localTiming: true,
        };
      }
      if (timed) page++;
      return result;
    });
  }
  const dbPromise = typeof indexedDB === 'undefined' ? null : new Promise((resolve, reject) => {
    const request = indexedDB.open('mindex-song-timing-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('profiles', { keyPath: 'key' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('다른 창을 닫고 다시 열어 주세요.'));
  });
  async function transaction(mode, action) {
    if (!dbPromise) throw Error('로컬 저장소를 사용할 수 없습니다.');
    const db = await dbPromise;
    return new Promise((resolve, reject) => {
      const tx = db.transaction('profiles', mode);
      const request = action(tx.objectStore('profiles'));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(tx.error || request.error || Error('로컬 저장 실패'));
    });
  }
  let loadError = null;
  const ready = dbPromise ? transaction('readonly', store => store.getAll()).then(rows => {
    for (const row of rows) {
      const audio = row.audioBytes instanceof ArrayBuffer ? new Blob([row.audioBytes], { type: row.audioType || 'audio/mpeg' }) : row.audio;
      if (audio instanceof Blob) profiles.set(row.key, { ...row, audio, url: URL.createObjectURL(audio) });
    }
    revision++;
  }).catch(error => { loadError = error; }) : Promise.resolve();
  async function save(profile, slides) {
    await ready;
    if (loadError) throw loadError;
    const error = validate(profile, slides);
    if (error) throw Error(error);
    const { url, audio, audioBytes: previousBytes, ...record } = profile;
    // ArrayBuffer avoids WebKit File/Blob transaction failures while retaining exact bytes.
    const audioBytes = await audio.arrayBuffer();
    await transaction('readwrite', store => store.put({ ...record, audioBytes, audioType: audio.type }));
    const old = profiles.get(record.key);
    profiles.set(record.key, { ...record, audio, url: URL.createObjectURL(audio) });
    if (old?.url) URL.revokeObjectURL(old.url);
    revision++;
  }
  function controls(serviceId, entries) {
    const seen = new Set();
    return entries.filter(({ slide }) => slide.songTimingKey && !seen.has(slide.elementId) && seen.add(slide.elementId))
      .map(({ slide }) => `<button type="button" class="btn secondary" data-song-timing-open data-service-id="${escapeAttr(serviceId)}" data-element-id="${escapeAttr(slide.elementId)}">${escapeHtml(slide.elementTitle || slide.title || '찬양')} · 음원 동기화</button>`).join('');
  }
  async function open(serviceId, elementId) {
    await ready;
    if (loadError) { showToast('동기화 저장소를 열지 못했습니다. ' + loadError.message, 'error'); return; }
    if (document.querySelector('[data-song-timing-dialog]')) return;
    const all = presenterSlidesForService(serviceId).filter(s => s.elementId === elementId);
    const slides = pagesFor(all);
    const key = all.find(s => s.songTimingKey)?.songTimingKey;
    if (!key || !slides.length) { showToast('먼저 곡과 가사 불러오기를 선택해 주세요.', 'error'); return; }
    stopServiceMusicPlayback({ render: false });
    const old = profiles.get(key);
    const fresh = Array.isArray(old?.starts) && old?.lyricsFingerprint === fingerprint(slides);
    let draft = { key, audio: old?.audio, audioName: old?.audioName || '', audioFingerprint: old?.audioFingerprint || '',
      duration: old?.duration || 0, lyricsFingerprint: fingerprint(slides),
      starts: fresh ? [...old.starts] : slides.map(() => null), enabled: old?.enabled ?? true };
    let previewUrl = old?.audio ? URL.createObjectURL(old.audio) : '';
    const dialog = document.createElement('dialog');
    dialog.className = 'song-timing-dialog'; dialog.dataset.songTimingDialog = '';
    dialog.setAttribute('aria-labelledby', 'song-timing-title');
    dialog.innerHTML = `<h2 id="song-timing-title">찬양 음원 동기화</h2>
      <p>${escapeHtml(all[0]?.elementTitle || all[0]?.title || '')}</p>
      <p>이 브라우저에만 저장됩니다. 음원을 들으며 각 장의 시작을 기록하세요. 가사는 1초 먼저, 빈 화면·음표는 기록한 시각에 넘깁니다.</p>
      <label>음원 선택 <input type="file" accept="audio/*" data-timing-file></label>
      <p data-timing-filename></p><audio controls preload="metadata"></audio>
      <div class="song-timing-pages">${slides.map((slide, i) => `<div class="song-timing-row"><label>${i + 1}장 · ${escapeHtml(slide.text || '빈 화면')}<input aria-label="${i + 1}장 시작 초" type="number" min="0" step="0.1" data-timing-start="${i}" value="${draft.starts[i] ?? ''}" placeholder="초"></label><button type="button" class="btn secondary" data-timing-stamp="${i}">현재 시각 기록</button></div>`).join('')}</div>
      <label><input type="checkbox" data-timing-enabled ${draft.enabled ? 'checked' : ''}> 음악 재생 중 자동 넘김</label>
      <p role="status" data-timing-status>${old && !fresh ? '가사가 바뀌었어요. 모든 장의 시각을 다시 기록해 주세요.' : '음원과 시각을 저장한 뒤, 해당 곡에서 음악 재생을 누르세요.'}</p>
      <div class="song-timing-actions"><button type="button" class="btn secondary" data-timing-close>닫기</button><button type="button" class="btn" data-timing-save>동기화 저장</button></div>`;
    const audio = dialog.querySelector('audio');
    const status = dialog.querySelector('[data-timing-status]');
    const saveButton = dialog.querySelector('[data-timing-save]');
    if (previewUrl) audio.src = previewUrl;
    dialog.querySelector('[data-timing-filename]').textContent = draft.audioName;
    let busy = false;
    dialog.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
    dialog.addEventListener('close', () => { audio.pause(); audio.removeAttribute('src'); if (previewUrl) URL.revokeObjectURL(previewUrl); dialog.remove(); });
    dialog.addEventListener('keydown', e => e.stopPropagation());
    dialog.addEventListener('input', e => {
      if (e.target.matches('[data-timing-start]')) draft.starts[Number(e.target.dataset.timingStart)] = e.target.value === '' ? null : Number(e.target.value);
    });
    audio.addEventListener('loadedmetadata', () => { draft.duration = audio.duration; });
    audio.addEventListener('error', () => { draft.duration = 0; status.textContent = '음원을 재생할 수 없습니다. 다른 파일을 선택해 주세요.'; });
    dialog.querySelector('[data-timing-file]').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      busy = true; saveButton.disabled = true; e.target.disabled = true;
      try {
        if (file.size > 100 * 1024 * 1024) throw Error('음원은 100MB 이하로 선택해 주세요.');
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
        audio.pause();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(file);
        if (digest !== draft.audioFingerprint) {
          draft.starts = slides.map(() => null);
          dialog.querySelectorAll('[data-timing-start]').forEach(input => { input.value = ''; });
        }
        draft.audio = file; draft.audioName = file.name; draft.audioFingerprint = digest; draft.duration = 0;
        audio.src = previewUrl;
        dialog.querySelector('[data-timing-filename]').textContent = file.name;
        status.textContent = '각 장이 시작되는 순간에 현재 시각 기록을 누르세요.';
      } catch (error) { status.textContent = error.message; }
      finally { busy = false; saveButton.disabled = false; e.target.disabled = false; }
    });
    dialog.addEventListener('click', async e => {
      const button = e.target.closest('button');
      if (!button || busy) return;
      if (button.hasAttribute('data-timing-close')) { dialog.close(); return; }
      if (button.hasAttribute('data-timing-stamp')) {
        if (!draft.duration || audio.readyState < 1) { status.textContent = '음원을 먼저 선택해 주세요.'; return; }
        const i = Number(button.dataset.timingStamp);
        draft.starts[i] = Math.round(audio.currentTime * 100) / 100;
        dialog.querySelector(`[data-timing-start="${i}"]`).value = draft.starts[i];
        status.textContent = `${i + 1}장 · ${draft.starts[i]}초 기록됨`;
      }
      if (button.hasAttribute('data-timing-save')) {
        busy = true; saveButton.disabled = true;
        try {
          const current = pagesFor(presenterSlidesForService(serviceId).filter(s => s.elementId === elementId));
          if (current[0]?.songTimingKey !== key || fingerprint(current) !== draft.lyricsFingerprint) throw Error('편집 중 곡 또는 가사가 바뀌었어요. 닫고 다시 열어 주세요.');
          draft.enabled = dialog.querySelector('[data-timing-enabled]').checked;
          await save(draft, current);
          audio.pause();
          refreshPresenterForService(serviceId);
          status.textContent = '이 브라우저에 저장했어요. 예배·곡·메들리 연결은 변경하지 않았어요.';
        } catch (error) { status.textContent = error.message; }
        finally { busy = false; saveButton.disabled = false; }
      }
    });
    document.body.append(dialog); dialog.showModal();
  }
  root.MindexSongTiming = { keyFor, pagesFor, fingerprint, validate, decorate, controls, open, save, ready, ownsSource: source => [...profiles.values()].some(p => p.url === source), get revision() { return revision; } };
  if (typeof document !== 'undefined') document.addEventListener('click', e => {
    const button = e.target.closest('[data-song-timing-open]');
    if (button) { e.preventDefault(); void open(button.dataset.serviceId, button.dataset.elementId).catch(error => showToast(error.message, 'error')); }
  });
})(globalThis);
