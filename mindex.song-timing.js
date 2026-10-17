/* Elem-style song timing. Optional immutable Storage sharing; never writes worship/song records. */
(function (root) {
  'use strict';
  const profiles = new Map();
  let revision = 0;
  const keyFor = (songId, versionId) => JSON.stringify([String(songId || ''), String(versionId || '')]);
  const pagesFor = slides => slides.filter(s => !s.hiddenInPresentation && !s.autoTrailingBlank && (s.type === 'lyrics' || s.type === 'blank'));
  const fingerprint = slides => JSON.stringify(pagesFor(slides).map(s => [s.type, String(s.text || '').normalize('NFC'), ...(s.serviceTimingPage ? [s.formKey || '', s.formBackgroundImage || '', s.serviceTimingAudioSource || ''] : [])]));
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
  const lyricsText = value => typeof normalizeLyricsForStorage === 'function' ? normalizeLyricsForStorage(value) : String(value || '').normalize('NFC');
  const sourceSignature = version => JSON.stringify((version?.forms || []).map(f => [f.id || '', f.part_type || '', f.part_number ?? null, f.part_variant || '', lyricsText(f.lyrics || f.text)]));
  const isChildrenMode = item => typeof servicePraiseInputMode === 'function' && servicePraiseInputMode(item) === 'children_audio';
  const isChildrenVersion = (song, version) => typeof versionEffectivePraiseTypes === 'function' && versionEffectivePraiseTypes(song, version).includes('children');
  function validSet(profile, version) {
    return profile?.sourceSignature === sourceSignature(version) && Array.isArray(profile.forms) && profile.forms.length > 0
      && profile.forms.length <= 1000 && profile.forms.every(f => f._presenterBlank === true || (version?.forms || []).some(v => v.id === f.id && lyricsText(v.lyrics) === lyricsText(f.lyrics)));
  }
  function formsFor(item, song, version, fallback) {
    if (!isChildrenMode(item) || !isChildrenVersion(song, version)) return fallback;
    const profile = profiles.get(keyFor(song.id, version?.id));
    return validSet(profile, version) ? profile.forms.map(form => ({ ...form })) : fallback;
  }
  function decorate(slides, item, song, version) {
    if (!song?.id) return slides;
    const key = keyFor(song.id, version?.id || item.version_id || item.song_version_id);
    const profile = profiles.get(key);
    const children = isChildrenVersion(song, version);
    const childMode = isChildrenMode(item);
    const valid = childMode && children && validSet(profile, version) && profile?.enabled && profile.url && !validate(profile, slides);
    let page = 0;
    return slides.map(slide => {
      const timed = slide.type === 'lyrics' || slide.type === 'blank';
      const intro = slide.type === 'song-title' && page === 0;
      const result = { ...slide, songTimingKey: key, songTimingEligible: children };
      if (childMode && !valid) result.warnings = [...(slide.warnings || []), "어린이 음원 세트가 없거나 변경됐습니다. 음원 동기화에서 저장·공유 불러오기를 확인하세요."];
      if (timed || intro) {
        // A stale or disabled local profile must not fall back to a different timeline.
        if (profile || childMode) delete result.syncTimeline;
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
  // Timing belongs to this worship occurrence, after photos and lyric pages are composed.
  const serviceKeyFor = (serviceId, item, versionKey) => JSON.stringify(['service', serviceId, item.id, versionKey]);
  const belongsTo = (slide, elementId) => (slide.progressionParentId || slide.elementId) === elementId;
  function decorateService(slides, items, serviceId) {
    let result = slides;
    for (const item of items) {
      if (servicePraiseInputMode(item) !== 'lyrics_db') continue;
      const original = slides.find(s => belongsTo(s, item.id) && s.songTimingKey);
      if (!original || original.songTimingEligible) continue;
      const key = serviceKeyFor(serviceId, item, original.songTimingKey);
      const linkedSource = normalizeServiceAudioAsset(parseServiceItemMemo(item.memo).audioAsset).url || '';
      const group = slides.filter(s => belongsTo(s, item.id)).map(s => ({ ...s, serviceTimingPage: true, serviceTimingAudioSource: linkedSource }));
      const pages = pagesFor(group);
      if (!pages.length) continue;
      const profile = profiles.get(key);
      const valid = profile?.enabled && profile.url && !validate(profile, group);
      let page = 0;
      result = result.map(slide => {
        if (!belongsTo(slide, item.id)) return slide;
        const out = { ...slide, serviceTimingPage: true, serviceTimingAudioSource: linkedSource, songTimingKey: key,
          songTimingElementId: item.id, songTimingEligible: !slide.hiddenInPresentation };
        const timed = pagesFor([out]).length > 0;
        if (profile) {
          delete out.syncTimeline;
          if (profile.enabled && !valid) out.warnings = [...(out.warnings || []), '음원 동기화 자료가 현재 가사·사진 순서와 달라요. 시각을 다시 확인하세요.'];
        }
        if (valid && (timed || slide.type === 'song-title')) out.syncTimeline = {
          groupId: `${serviceId}:${item.id}:service-song-timing`, audioSrc: profile.url,
          audioTitle: profile.audioName, page: timed ? page + 1 : 0,
          start: timed ? profile.starts[page] : null, lead: timed && !noLead(slide) ? 1 : 0, intro: !timed,
          localTiming: true, serviceTiming: true,
        };
        if (timed) page++;
        return out;
      });
    }
    return result;
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
  const PACKAGE_LIMIT = 50 * 1024 * 1024;
  const digestBytes = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
  async function pack(profile, slides) {
    const error = validate(profile, slides);
    if (error) throw Error(error);
    if (profile.audio.size > PACKAGE_LIMIT) throw Error('공유할 음원은 50MB보다 작아야 합니다.');
    const bytes = await profile.audio.arrayBuffer();
    const audioFingerprint = await digestBytes(bytes);
    if (audioFingerprint !== profile.audioFingerprint) throw Error('음원이 변경됐어요. 시각을 다시 확인해 주세요.');
    const header = new TextEncoder().encode(JSON.stringify({
      format: 'mindex-song-timing', version: 1, key: profile.key,
      audioName: String(profile.audioName || '음원'), audioType: profile.audio.type,
      audioFingerprint, audioSize: bytes.byteLength, lyricsFingerprint: profile.lyricsFingerprint,
      starts: profile.starts, duration: profile.duration, enabled: Boolean(profile.enabled),
      sourceSignature: profile.sourceSignature || null, forms: profile.forms || null,
    }));
    if (header.byteLength > 1024 * 1024) throw Error('타이밍 정보가 너무 큽니다.');
    const length = new Uint8Array(4); new DataView(length.buffer).setUint32(0, header.byteLength);
    const blob = new Blob(['MINDXST1', length, header, bytes], { type: 'application/octet-stream' });
    if (blob.size > PACKAGE_LIMIT) throw Error('음원과 타이밍을 합쳐 50MB 이하여야 합니다.');
    return blob;
  }
  async function unpack(blob, key, slides, context = null) {
    if (!(blob instanceof Blob) || blob.size < 13 || blob.size > PACKAGE_LIMIT) throw Error('지원하지 않는 동기화 파일 크기입니다.');
    const prefix = await blob.slice(0, 12).arrayBuffer();
    if (new TextDecoder().decode(prefix.slice(0, 8)) !== 'MINDXST1') throw Error('민덱스 동기화 파일이 아닙니다.');
    const length = new DataView(prefix).getUint32(8);
    if (!length || length > 1024 * 1024 || length + 12 >= blob.size) throw Error('동기화 파일이 손상됐습니다.');
    const header = JSON.parse(await blob.slice(12, 12 + length).text());
    if (header.format !== 'mindex-song-timing' || header.version !== 1 || header.key !== key) throw Error('현재 곡·버전과 다른 동기화 자료입니다.');
    const audio = blob.slice(12 + length, blob.size, typeof header.audioType === 'string' ? header.audioType : '');
    if (audio.size !== header.audioSize || await digestBytes(await audio.arrayBuffer()) !== header.audioFingerprint) throw Error('음원 검증에 실패했습니다. 다시 불러와 주세요.');
    const profile = { key, audio, audioName: String(header.audioName || '음원'), audioFingerprint: header.audioFingerprint,
      lyricsFingerprint: header.lyricsFingerprint, starts: header.starts, duration: header.duration, enabled: header.enabled === true,
      sourceSignature: header.sourceSignature, forms: header.forms };
    if (context) {
      if (!isChildrenVersion(context.song, context.version) || !validSet(profile, context.version)) throw Error("현재 어린이 버전과 맞는 음원 세트가 아닙니다.");
      slides = context.buildSlides(profile.forms);
    }
    const error = validate(profile, slides);
    if (error) throw Error(error);
    return profile;
  }
  async function sharedPrefix(key) {
    return 'song-timing/v1/' + await digestBytes(new TextEncoder().encode(key));
  }
  async function share(profile, slides, bucket) {
    if (!bucket) throw Error('공유 저장소에 연결되지 않았습니다.');
    const bundle = await pack(profile, slides);
    const path = `${await sharedPrefix(profile.key)}/${Date.now()}-${crypto.randomUUID()}.mindex-timing`;
    // Append-only: never overwrite/delete another computer's saved version.
    const { error } = await bucket.upload(path, bundle, { contentType: 'application/octet-stream', upsert: false, cacheControl: '31536000' });
    if (error) throw error;
    return path;
  }
  async function loadShared(key, slides, bucket, context = null) {
    if (!bucket) throw Error('공유 저장소에 연결되지 않았습니다.');
    const prefix = await sharedPrefix(key);
    const listing = await bucket.list(prefix, { limit: 1, sortBy: { column: 'created_at', order: 'desc' } });
    if (listing.error) throw listing.error;
    const entry = listing.data?.[0];
    if (!entry) throw Error('이 곡·버전의 공유 저장본이 없습니다. 저장한 컴퓨터에서 공유 저장을 먼저 눌러 주세요.');
    if (!/^\d+-[0-9a-f-]+\.mindex-timing$/.test(entry.name) || Number(entry.metadata?.size) > PACKAGE_LIMIT) throw Error('올바른 공유 저장본이 아닙니다.');
    const result = await bucket.download(`${prefix}/${entry.name}`);
    if (result.error) throw result.error;
    return unpack(result.data, key, slides, context);
  }
  async function decodedDuration(blob) {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(); audio.preload = 'metadata';
    try {
      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(Error('음원 확인 시간이 초과됐습니다.')), 15000);
        audio.onloadedmetadata = () => { clearTimeout(timer); Number.isFinite(audio.duration) && audio.duration > 0 ? resolve(audio.duration) : reject(Error('음원 길이를 확인하지 못했습니다.')); };
        audio.onerror = () => { clearTimeout(timer); reject(Error('공유 음원을 재생할 수 없습니다.')); };
        audio.src = url;
      });
    } finally { audio.removeAttribute('src'); audio.load(); URL.revokeObjectURL(url); }
  }
  function controls(serviceId, entries) {
    const seen = new Set();
    return entries.filter(({ slide }) => slide.songTimingKey && slide.songTimingEligible && !seen.has(slide.songTimingElementId || slide.elementId) && seen.add(slide.songTimingElementId || slide.elementId))
      .map(({ slide }) => `<button type="button" class="btn secondary" data-song-timing-open data-service-id="${escapeAttr(serviceId)}" data-element-id="${escapeAttr(slide.songTimingElementId || slide.elementId)}">${escapeHtml(slide.elementTitle || slide.title || '찬양')} · 음원 동기화</button>${slide.syncTimeline?.localTiming ? `<button type="button" class="btn secondary" data-song-timing-play data-service-id="${escapeAttr(serviceId)}" data-element-id="${escapeAttr(slide.songTimingElementId || slide.elementId)}">동기화 처음부터 재생</button>` : ''}`).join('');
  }
  function transport() {
    const source = state.serviceMusic.sourceKey;
    if (state.serviceMusic.mode !== 'presenter-audio' || ![...profiles.values()].some(p => p.url === source)) return '';
    return `<label class="song-timing-seek">음원 위치 <input type="range" min="0" max="${Number(state.serviceMusic.audio?.duration) || 0}" step="0.1" value="${Number(state.serviceMusic.audio?.currentTime) || 0}" data-song-timing-seek data-source="${escapeAttr(source)}" aria-label="동기화 음원 위치"><span data-song-timing-clock></span></label>`;
  }
  function updateTransport(audio) {
    const source = state.serviceMusic.sourceKey;
    for (const input of document.querySelectorAll('[data-song-timing-seek]')) {
      if (input.dataset.source !== source) continue;
      input.max = Number.isFinite(audio.duration) ? audio.duration : 0;
      if (document.activeElement !== input) input.value = audio.currentTime || 0;
      const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
      input.parentElement.querySelector('[data-song-timing-clock]').textContent = `${clock(audio.currentTime || 0)} / ${clock(Number(input.max))}`;
    }
  }
  function play(serviceId, elementId) {
    if (state.serviceMusic.playing || state.serviceMusic.pending) {
      showToast('재생 중인 음악을 일시정지한 뒤 시작해 주세요.', 'info'); return;
    }
    if (isPresenterOutputWindowOpen() && state.presenter.serviceId && state.presenter.serviceId !== serviceId) {
      showToast('다른 예배가 송출 중입니다.', 'info'); return;
    }
    const slides = presenterSlidesForService(serviceId);
    const index = slides.findIndex(s => belongsTo(s, elementId) && s.syncTimeline?.localTiming && !s.hiddenInPresentation);
    if (index < 0) { showToast('현재 가사·사진 순서의 동기화를 먼저 저장해 주세요.', 'info'); return; }
    runPresenterAction('jump', serviceId, {index, scroll:false});
    const sync = state.presenter.slides[state.presenter.index]?.syncTimeline;
    if (!sync?.localTiming) return;
    const audio = getServiceMusicAudio();
    setServiceMusicSource(audio, sync.audioSrc, 'presenter-audio', {loop:false, repeatAllowed:false}, sync.audioTitle);
    audio.currentTime = 0;
    state.serviceMusic.repeat = false;
    return runServiceMusicAction('toggle');
  }
  async function open(serviceId, elementId) {
    await ready;
    if (loadError) { showToast('동기화 저장소를 열지 못했습니다. ' + loadError.message, 'error'); return; }
    if (document.querySelector('[data-song-timing-dialog]')) return;
    const all = presenterSlidesForService(serviceId).filter(s => belongsTo(s, elementId));
    const slides = pagesFor(all);
    const key = all.find(s => s.songTimingKey)?.songTimingKey;
    if (!key || !slides.length) { showToast('먼저 곡·버전과 가사 로드를 선택해 주세요.', 'error'); return; }
    if (state.serviceMusic.playing || state.serviceMusic.pending) { showToast('음악을 일시정지한 뒤 동기화를 편집해 주세요.', 'info'); return; }
    const item = getServiceItems(serviceId).find(i => i.id === elementId);
    const service = state.services.find(s => s.id === serviceId);
    const song = serviceItemLinkedSong(item);
    const version = getPresenterServiceItemVersion(song, item, service);
    const serviceTiming = all.some(s => s.serviceTimingPage);
    if (!serviceTiming && !isChildrenVersion(song, version)) { showToast('어린이 유형의 버전을 선택해 주세요.', 'error'); return; }
    const setForms = formsFor(item, song, version, presenterFormPlanForServiceItem(version, item, song).forms);
    const buildSetSlides = forms => presenterLyricsSlidesForServiceItem({item, section: {}, index: 0, song, version, displayText: song.title, label: item.label, forms, formWarnings: []});
    const linkedAudio = normalizeServiceAudioAsset(parseServiceItemMemo(item.memo).audioAsset);
    const old = profiles.get(key);
    const fresh = Array.isArray(old?.starts) && old?.lyricsFingerprint === fingerprint(slides);
    let draft = { key, audio: old?.audio, audioName: old?.audioName || '', audioFingerprint: old?.audioFingerprint || '',
      duration: old?.duration || 0, lyricsFingerprint: fingerprint(slides),
      sourceSignature: sourceSignature(version), forms: setForms,
      starts: fresh ? [...old.starts] : slides.map(() => null), enabled: old?.enabled ?? true };
    let previewUrl = old?.audio ? URL.createObjectURL(old.audio) : '';
    const formLabels = new Map(slides.filter(slide => slide.formKey && presenterFormGroupLabel(slide)).map(slide => [slide.formKey, presenterFormGroupLabel(slide)]));
    const dialog = document.createElement('dialog');
    dialog.className = 'song-timing-dialog'; dialog.dataset.songTimingDialog = '';
    dialog.setAttribute('aria-labelledby', 'song-timing-title');
    dialog.innerHTML = `<h2 id="song-timing-title">${serviceTiming ? '가사·사진 음원 동기화' : '어린이 음원 세트'}</h2>
      <p>${escapeHtml(all[0]?.elementTitle || all[0]?.title || '')}</p>
      <p>${serviceTiming ? '이 예배의 현재 곡·가사·사진 순서에 전환 시각을 저장합니다. 사진을 먼저 배치한 뒤 타이밍을 기록하세요. 다른 예배에는 적용되지 않습니다.' : '현재 가사·폼과 음원·자동 넘김 시각을 한 세트로 저장합니다. 예배 순서에서 ‘어린이: 음원 로드’를 선택하면 이 세트를 사용합니다.'}</p>
      <p>동기화 저장은 이 브라우저에 보관합니다. 다른 컴퓨터에서는 공유 저장 후 공유 불러오기를 사용하세요. 음원을 들으며 각 장의 시작을 기록하세요. ${serviceTiming ? '가사는 부르기 시작하는 시각을 기록하면 1초 먼저 넘깁니다. 가사 없는 사진·간주는 기록한 시각에 넘깁니다. 수동 넘김은 음악을 일시정지합니다.' : '가사는 1초 먼저, 빈 화면·음표는 기록한 시각에 넘깁니다.'}</p>
      ${linkedAudio.url ? `<button type="button" class="btn secondary" data-timing-linked>연결된 음원 사용 · ${escapeHtml(linkedAudio.name || '음원')}</button>` : ''}
      <label>음원 선택 <input type="file" accept="audio/*" data-timing-file></label>
      <p data-timing-filename></p><audio controls preload="metadata"></audio>
      <div class="song-timing-record"><button type="button" class="btn secondary" data-timing-next>다음 장 전환 기록</button><span data-timing-next-label></span></div>
      <div class="song-timing-pages">${slides.map((slide, i) => `<div class="song-timing-row"><label>${slide.formBackgroundImage ? `<img class="song-timing-photo" src="${escapeAttr(slide.formBackgroundImage)}" alt="${i + 1}장 배경 사진">` : ''}${i + 1}장 · ${formLabels.get(slide.formKey) ? escapeHtml(formLabels.get(slide.formKey)) + ' · ' : ''}${escapeHtml(slide.text || '빈 화면')}<input aria-label="${i + 1}장 시작 초" type="number" min="0" step="0.1" data-timing-start="${i}" value="${draft.starts[i] ?? ''}" placeholder="초"></label><button type="button" class="btn secondary" data-timing-stamp="${i}">현재 시각 기록</button></div>`).join('')}</div>
      <label><input type="checkbox" data-timing-enabled ${draft.enabled ? 'checked' : ''}> 음악 재생 중 자동 넘김</label>
      <p role="status" data-timing-status>${old && !fresh ? '가사가 바뀌었어요. 모든 장의 시각을 다시 기록해 주세요.' : '음원과 시각을 저장한 뒤, 해당 곡에서 음악 재생을 누르세요.'}</p>
      <p>공유 저장한 음원·타이밍은 공개 링크로 접근할 수 있습니다. 공유 파일은 음원 포함 50MB 이하입니다.</p>
      <div class="song-timing-actions"><button type="button" class="btn secondary" data-timing-load-shared>공유 불러오기</button><button type="button" class="btn secondary" data-timing-share>공유 저장</button><button type="button" class="btn secondary" data-timing-close>닫기</button><button type="button" class="btn" data-timing-save>동기화 저장</button></div>`;
    const audio = dialog.querySelector('audio');
    const status = dialog.querySelector('[data-timing-status]');
    const saveButton = dialog.querySelector('[data-timing-save]');
    if (previewUrl) audio.src = previewUrl;
    dialog.querySelector('[data-timing-filename]').textContent = draft.audioName;
    let busy = false;
    let nextStamp = Math.max(0, draft.starts.findIndex(value => value == null));
    const updateNext = () => {
      dialog.querySelector('[data-timing-next-label]').textContent = nextStamp < slides.length ? `${nextStamp + 1} / ${slides.length}장` : '모든 장 기록 완료';
    };
    updateNext();
    dialog.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
    dialog.addEventListener('close', () => { audio.pause(); audio.removeAttribute('src'); if (previewUrl) URL.revokeObjectURL(previewUrl); dialog.remove(); });
    dialog.addEventListener('keydown', e => e.stopPropagation());
    dialog.addEventListener('input', e => {
      if (e.target.matches('[data-timing-start]')) draft.starts[Number(e.target.dataset.timingStart)] = e.target.value === '' ? null : Number(e.target.value);
    });
    audio.addEventListener('loadedmetadata', () => { draft.duration = audio.duration; });
    audio.addEventListener('error', () => { draft.duration = 0; status.textContent = '음원을 재생할 수 없습니다. 다른 파일을 선택해 주세요.'; });
    const replaceAudio = async file => {
      if (!file) return;
      busy = true; dialog.querySelectorAll('button,input').forEach(control => { control.disabled = true; });
      try {
        if (file.size > 100 * 1024 * 1024) throw Error('음원은 100MB 이하로 선택해 주세요.');
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await file.arrayBuffer())), b => b.toString(16).padStart(2, '0')).join('');
        audio.pause();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(file);
        if (digest !== draft.audioFingerprint) {
          draft.starts = slides.map(() => null); nextStamp = 0; updateNext();
          dialog.querySelectorAll('[data-timing-start]').forEach(input => { input.value = ''; });
        }
        draft.audio = file; draft.audioName = file.name; draft.audioFingerprint = digest; draft.duration = 0;
        audio.src = previewUrl;
        dialog.querySelector('[data-timing-filename]').textContent = file.name;
        status.textContent = '각 장이 시작되는 순간에 현재 시각 기록을 누르세요.';
      } catch (error) { status.textContent = error.message; }
      finally { busy = false; dialog.querySelectorAll('button,input').forEach(control => { control.disabled = false; }); }
    };
    dialog.querySelector('[data-timing-file]').addEventListener('change', e => void replaceAudio(e.target.files[0]));
    dialog.addEventListener('click', async e => {
      const button = e.target.closest('button');
      if (!button || busy) return;
      if (button.hasAttribute('data-timing-linked')) {
        busy = true; button.disabled = true; status.textContent = '연결된 음원을 불러오고 있어요…';
        try {
          const response = await fetch(linkedAudio.url);
          if (!response.ok || Number(response.headers.get('content-length')) > 100 * 1024 * 1024) throw Error('연결된 음원을 불러올 수 없습니다. 파일을 직접 선택해 주세요.');
          const blob = await response.blob();
          await replaceAudio(new File([blob], linkedAudio.name || '연결된 음원', {type:blob.type}));
        } catch (error) { status.textContent = error.message; }
        finally { busy = false; button.disabled = false; }
        return;
      }
      if (button.hasAttribute('data-timing-close')) { dialog.close(); return; }
      if (button.hasAttribute('data-timing-stamp') || button.hasAttribute('data-timing-next')) {
        if (!draft.duration || audio.readyState < 1) { status.textContent = '음원을 먼저 선택해 주세요.'; return; }
        const i = button.hasAttribute('data-timing-next') ? nextStamp : Number(button.dataset.timingStamp);
        if (i >= slides.length) { status.textContent = '모든 장을 기록했어요. 개별 기록 버튼으로 수정할 수 있어요.'; return; }
        draft.starts[i] = Math.round(audio.currentTime * 100) / 100;
        dialog.querySelector(`[data-timing-start="${i}"]`).value = draft.starts[i];
        status.textContent = `${i + 1}장 · ${draft.starts[i]}초 기록됨`;
        nextStamp = i + 1; updateNext();
        dialog.querySelector(`[data-timing-start="${Math.min(nextStamp, slides.length - 1)}"]`).closest('.song-timing-row').scrollIntoView({block:'nearest'});
      }
      if (button.hasAttribute('data-timing-share') || button.hasAttribute('data-timing-load-shared')) {
        const loading = button.hasAttribute('data-timing-load-shared');
        if (loading && draft.audio && !window.confirm('공유 저장본으로 현재 음원·타이밍을 교체할까요? 기존 공유 저장본은 삭제하지 않습니다.')) return;
        busy = true;
        let savedLocally = false;
        dialog.querySelectorAll('button,input').forEach(control => { control.disabled = true; });
        status.textContent = loading ? '공유 음원·타이밍을 확인하고 있어요…' : '음원·타이밍을 공유 저장하고 있어요…';
        try {
          const currentSlides = () => {
            const current = pagesFor(presenterSlidesForService(serviceId).filter(s => belongsTo(s, elementId)));
            if (current[0]?.songTimingKey !== key || fingerprint(current) !== draft.lyricsFingerprint) throw Error('편집 중 곡 또는 가사가 바뀌었어요. 닫고 다시 열어 주세요.');
            return current;
          };
          const bucket = state.client?.storage?.from('mindex-worship-media');
          if (loading) {
            const incoming = await loadShared(key, currentSlides(), bucket, isChildrenMode(item) ? {song, version, buildSlides: buildSetSlides} : null);
            incoming.duration = await decodedDuration(incoming.audio);
            currentSlides();
            await save(incoming, isChildrenMode(item) ? buildSetSlides(incoming.forms) : currentSlides());
            audio.pause();
            if (previewUrl) URL.revokeObjectURL(previewUrl);
            draft = incoming; previewUrl = URL.createObjectURL(draft.audio); audio.src = previewUrl;
            dialog.querySelector('[data-timing-filename]').textContent = draft.audioName;
            dialog.querySelector('[data-timing-enabled]').checked = draft.enabled;
            dialog.querySelectorAll('[data-timing-start]').forEach(input => { input.value = draft.starts[Number(input.dataset.timingStart)]; });
            refreshPresenterForService(serviceId);
            if (isChildrenMode(item) && fingerprint(slides) !== incoming.lyricsFingerprint) {
              dialog.close(); dialog.remove(); await open(serviceId, elementId); return;
            }
            status.textContent = '공유 음원·타이밍을 이 컴퓨터에 저장했어요. 다시 열어도 사용할 수 있어요.';
          } else {
            draft.enabled = dialog.querySelector('[data-timing-enabled]').checked;
            await save(draft, currentSlides());
            savedLocally = true;
            await share(draft, currentSlides(), bucket);
            audio.pause(); refreshPresenterForService(serviceId);
            status.textContent = '공유 저장했어요. 다른 컴퓨터에서 같은 곡의 공유 불러오기를 누르세요.';
          }
        } catch (error) { status.textContent = `공유 ${loading ? '불러오기' : '저장'} 실패: ${error.message || '연결 상태를 확인해 주세요.'} ${savedLocally ? '이 컴퓨터에는 저장됐고 기존 공유본은 유지됩니다.' : '기존 저장본은 유지됩니다.'}`; }
        finally { busy = false; dialog.querySelectorAll('button,input').forEach(control => { control.disabled = false; }); }
        return;
      }
      if (button.hasAttribute('data-timing-save')) {
        busy = true; saveButton.disabled = true;
        try {
          const current = pagesFor(presenterSlidesForService(serviceId).filter(s => belongsTo(s, elementId)));
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
  root.MindexSongTiming = { keyFor, serviceKeyFor, pagesFor, fingerprint, validate, decorate, decorateService, controls, open, play, transport, updateTransport, save, ready, pack, unpack, share, loadShared, formsFor, sourceSignature, ownsSource: source => [...profiles.values()].some(p => p.url === source), get revision() { return revision; } };
  if (typeof document !== 'undefined') document.addEventListener('input', e => {
    const input = e.target.closest('[data-song-timing-seek]');
    const audio = state.serviceMusic.audio;
    if (!input || !audio || state.serviceMusic.mode !== 'presenter-audio' || input.dataset.source !== state.serviceMusic.sourceKey) return;
    const time = Number(input.value);
    if (Number.isFinite(time) && Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(time, audio.duration));
    updateTransport(audio);
  });
  if (typeof document !== 'undefined') document.addEventListener('click', e => {
    const playButton = e.target.closest('[data-song-timing-play]');
    if (playButton) { e.preventDefault(); void play(playButton.dataset.serviceId, playButton.dataset.elementId); return; }
    const button = e.target.closest('[data-song-timing-open]');
    if (button) { e.preventDefault(); void open(button.dataset.serviceId, button.dataset.elementId).catch(error => showToast(error.message, 'error')); }
  });
})(globalThis);
