/* Version-owned children audio and worship-owned occurrence timing. */
(function (root) {
  'use strict';
  const profiles = new Map();
  let revision = 0;
  const remoteSources = new Set();
  const keyFor = (songId, versionId) => JSON.stringify([String(songId || ''), String(versionId || '')]);
  const pagesFor = slides => slides.filter(s => !s.photoTimingContinuation && !s.hiddenInPresentation && !s.autoTrailingBlank && (s.type === 'lyrics' || s.type === 'blank')).map(s => s.photoTimingBase || s);
  const fingerprint = slides => JSON.stringify(pagesFor(slides).map(s => [s.type, String(s.text || '').normalize('NFC'), ...(s.serviceTimingPage ? [s.formKey || '', s.formBackgroundImage || '', s.serviceTimingAudioSource || ''] : [])]));
  const noLead = slide => slide.type === 'blank' || /^[\s♪♫♬♩]*$/.test(slide.text || '');
  function validate(profile, slides, remote = false) {
    const pages = pagesFor(slides);
    if (!pages.length || profile?.lyricsFingerprint !== fingerprint(slides)) return '가사·송폼·장 나눔이 바뀌었어요. 시각을 다시 맞춰 주세요.';
    if (!profile.audioFingerprint || !(remote ? /^https?:\/\//.test(profile.audioUrl || '') : profile.audio instanceof Blob) || !(profile.duration > 0) || !Number.isFinite(profile.duration)) return '재생 가능한 음원을 선택해 주세요.';
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
  // Photos have absolute media-clock cues, independent of the one-second lyric lead.
  function validatePhotos(photos, duration) {
    if (photos == null) return '';
    if (!Array.isArray(photos) || photos.length > 200) return '사진은 최대 200장까지 저장할 수 있어요.';
    let previous = -1;
    for (const photo of photos) {
      if (!photo || typeof photo.at !== 'number' || !Number.isFinite(photo.at)
        || photo.at < 0 || photo.at >= duration || photo.at - previous < 0.2
        || !/^https?:\/\//.test(photo.url || '')) return '사진 주소와 전환 시각·순서를 확인해 주세요.';
      previous = photo.at;
    }
    return '';
  }
  function composePhotos(slides, photos, duration) {
    if (!photos?.length || validatePhotos(photos, duration)) return slides;
    const timed = slides.filter(s => s.syncTimeline?.serviceTiming && !s.syncTimeline.intro);
    if (!timed.length) return slides;
    const first = Math.max(0, timed[0].syncTimeline.start - timed[0].syncTimeline.lead);
    if (photos[0].at < first) return slides;
    return slides.flatMap(slide => {
      const index = timed.indexOf(slide);
      if (index < 0) return [slide];
      const sync = slide.syncTimeline;
      const start = Math.max(0, sync.start - sync.lead);
      const next = timed[index + 1]?.syncTimeline;
      const end = next ? Math.max(0, next.start - next.lead) : duration;
      const active = photos.filter(p => p.at <= start).at(-1);
      const frame = (photo, at, continuation) => ({...slide,
        id: continuation ? `${slide.id}:photo:${at}` : slide.id,
        photoTimingBase: slide,
        photoTimingContinuation: continuation,
        ...(photo ? {formBackgroundImage:photo.url, outputContext:'clean'} : {}),
        syncTimeline:{...sync, start:at, lead:0},
      });
      return [frame(active, start, false), ...photos.filter(p => p.at > start && p.at < end)
        .map(photo => frame(photo, photo.at, true))];
    });
  }
  const lyricsText = value => typeof normalizeLyricsForStorage === 'function' ? normalizeLyricsForStorage(value) : String(value || '').normalize('NFC');
  const sourceSignature = version => JSON.stringify((version?.forms || []).map(f => [f.id || '', f.part_type || '', f.part_number ?? null, f.part_variant || '', lyricsText(f.lyrics || f.text)]));
  const isChildrenMode = item => typeof servicePraiseInputMode === 'function' && servicePraiseInputMode(item) === 'children_audio';
  const isChildrenVersion = (song, version) => typeof versionEffectivePraiseTypes === 'function' && versionEffectivePraiseTypes(song, version).includes('children');
  // Audio page boundaries/repetitions may differ from the stored lyric blocks.
  // Ranges refer to the current version text, with only spacing/punctuation folded.
  const audioText = value => String(value || '').normalize('NFC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
  function validSet(profile, version) {
    const source = audioText((version?.forms || []).map(f => f.lyrics || '').join(''));
    return profile?.sourceSignature === sourceSignature(version) && Array.isArray(profile.forms) && profile.forms.length > 0
      && profile.forms.length <= 1000 && profile.forms.every(f => {
        if (f._presenterBlank === true) return !String(f.lyrics || '').trim();
        if (Array.isArray(f.audioSourceRange)) {
          const [start, end] = f.audioSourceRange;
          return f.audioSourceRange.length === 2 && Number.isInteger(start) && Number.isInteger(end)
            && start >= 0 && end > start && end <= source.length && audioText(f.lyrics) === source.slice(start, end);
        }
        return (version?.forms || []).some(v => v.id === f.id && lyricsText(v.lyrics) === lyricsText(f.lyrics));
      });
  }
  const versionProfile = (song, version) => {
    const stored = version?.audio_set || (typeof parseSongMemo === 'function' ? parseSongMemo(song?.memo).childrenAudioSets?.[version?.id] : null);
    return stored ? {...stored, url:stored.audioUrl, databaseTiming:true} : profiles.get(keyFor(song?.id, version?.id));
  };
  function formsFor(item, song, version, fallback) {
    if (!isChildrenMode(item) || !isChildrenVersion(song, version)) return fallback;
    const profile = versionProfile(song, version);
    return validSet(profile, version) ? profile.forms.map(form => ({ ...form })) : fallback;
  }
  function decorate(slides, item, song, version) {
    if (!song?.id) return slides;
    const key = keyFor(song.id, version?.id || item.version_id || item.song_version_id);
    const profile = versionProfile(song, version);
    const children = isChildrenVersion(song, version);
    const childMode = isChildrenMode(item);
    const valid = childMode && children && validSet(profile, version) && profile?.enabled && profile.url && !validate(profile, slides, Boolean(profile?.databaseTiming));
    if (valid && profile.databaseTiming) remoteSources.add(profile.url);
    let page = 0;
    return slides.map(slide => {
      const timed = slide.type === 'lyrics' || slide.type === 'blank';
      const intro = slide.type === 'song-title' && page === 0;
      const result = { ...slide, songTimingKey: key, songTimingEligible: children && childMode, songTimingAudio: childMode && children && validSet(profile, version) && profile?.url ? {url:profile.url,name:profile.audioName} : null };
      if (childMode && !valid) result.warnings = [...(slide.warnings || []), "버전 음원·타이밍이 없거나 변경됐습니다. 버전 음원·타이밍에서 자료를 확인하세요."];
      if (timed || intro) {
        // A stale or disabled local profile must not fall back to a different timeline.
        if (children || profile || childMode) delete result.syncTimeline;
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
      const mode = servicePraiseInputMode(item);
      const manual = mode === 'manual_praise' || mode === 'audio_praise';
      if (!manual && mode !== 'lyrics_db') continue;
      const original = slides.find(s => belongsTo(s, item.id) && s.songTimingKey);
      if (!manual && (!original || original.songTimingEligible)) continue;
      // Direct lyrics belong to this occurrence and never inherit a DB-version profile.
      const key = serviceKeyFor(serviceId, item, manual ? 'manual_praise' : original.songTimingKey);
      const linkedSource = normalizeServiceAudioAsset(parseServiceItemMemo(item.memo).audioAsset).url || '';
      const group = slides.filter(s => belongsTo(s, item.id)).map(s => ({ ...s, serviceTimingPage: true, serviceTimingAudioSource: linkedSource }));
      const pages = pagesFor(group);
      if (!pages.length) continue;
      const memo = parseServiceItemMemo(item.memo);
      const stored = memo.audioTiming;
      const profile = stored ? {...stored, url:stored.audioUrl} : profiles.get(key);
      const valid = profile?.enabled && profile.url && (!stored || stored.audioUrl === linkedSource) && !validate(profile, group, Boolean(stored));
      if (valid && stored) remoteSources.add(profile.url);
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
          localTiming: true, serviceTiming: true, worshipTiming: Boolean(stored),
        };
        if (timed) page++;
        return out;
      });
    }
    for (const item of items) {
      const timing = parseServiceItemMemo(item.memo).audioTiming;
      if (!timing?.photos?.length) continue;
      const group = result.filter(s => belongsTo(s, item.id));
      const composed = composePhotos(group, timing.photos, timing.duration);
      if (composed === group) continue;
      const replacements = new Map(group.map(slide => [slide, []]));
      for (const frame of composed) replacements.get(frame.photoTimingBase || frame).push(frame);
      result = result.flatMap(slide => replacements.get(slide) || [slide]);
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
  function audioFor(entries = [], elementId = '') {
    const slide = entries.map(entry => entry.slide || entry).find(slide =>
      slide.songTimingKey && (slide.songTimingElementId || slide.elementId) === elementId);
    if (slide && !slide.serviceTimingPage) return slide.songTimingEligible ? slide.songTimingAudio || null : null;
    const profile = slide && profiles.get(slide.songTimingKey);
    // A disconnected/replaced service asset must not resurrect stale cached audio.
    if (slide?.serviceTimingPage && profile?.lyricsFingerprint !== fingerprint(entries.map(entry => entry.slide || entry))) return null;
    return profile?.url ? { url: profile.url, name: profile.audioName || '동기화 음원' } : null;
  }
  function controls(serviceId, entries, options = {}) {
    const seen = new Set();
    return entries.filter(({ slide }) => slide.songTimingKey && slide.songTimingEligible
      && (options.audioSource || slide.serviceTimingAudioSource || !slide.serviceTimingPage || profiles.get(slide.songTimingKey)?.url)
      && !seen.has(slide.songTimingElementId || slide.elementId) && seen.add(slide.songTimingElementId || slide.elementId))
      .map(({ slide }) => `<button type="button" class="btn secondary" data-song-timing-open data-service-id="${escapeAttr(serviceId)}" data-element-id="${escapeAttr(slide.songTimingElementId || slide.elementId)}">음원 동기화</button>${presenterControllerIsLive(serviceId) && entries.some(({ slide: candidate }) => (candidate.songTimingElementId || candidate.elementId) === (slide.songTimingElementId || slide.elementId) && candidate.syncTimeline?.localTiming) ? `<button type="button" class="btn secondary" data-song-timing-play data-service-id="${escapeAttr(serviceId)}" data-element-id="${escapeAttr(slide.songTimingElementId || slide.elementId)}">자동 넘김 재생</button>` : ''}`).join('');
  }
  function resumeAutoSync(serviceId = state.presenter.serviceId, expected = null) {
    const music = state.serviceMusic, audio = music.audio;
    const slide = state.presenter.slides[state.presenter.index];
    const sync = slide?.syncTimeline;
    if (!presenterControllerIsLive(serviceId) || state.presenter.serviceId !== serviceId
      || state.selectedServiceId !== serviceId || !music.autoSyncSuspended || music.mode !== 'presenter-audio'
      || (music.ownerServiceId && music.ownerServiceId !== serviceId)
      || !music.playing || music.pending || !audio || audio.paused || audio.ended
      || state.presenter.safetyBlank || state.presenter.liveScripture?.active
      || !sync?.localTiming || !slide.songTimingEligible
      || normalizePresenterMediaSource(music.sourceKey) !== normalizePresenterMediaSource(sync.audioSrc)) return false;
    if (expected && (expected.serviceId !== serviceId || expected.index !== state.presenter.index || expected.groupId !== sync.groupId)) return false;
    const target = presenterSyncedLyricsTargetForTime(state.presenter.slides, state.presenter.index, audio.currentTime);
    if (!target) {
      const intro = state.presenter.slides.findIndex(s => !presenterSlideIsHidden(s) && s.syncTimeline?.intro && s.syncTimeline.groupId === sync.groupId);
      if (intro < 0 || intro > state.presenter.index || state.presenter.slides.slice(intro,state.presenter.index+1)
        .some(s => !presenterSlideIsHidden(s) && s.syncTimeline?.groupId !== sync.groupId)) return false;
      state.presenter.index = intro;
      syncSelectedServiceItemToPresenterSlide(serviceId);
      publishPresenterState();renderPresenterControlState(serviceId);
    }
    music.autoSyncSuspended = false;
    syncServiceMusicSyncedLyricsWithCurrentTime();
    updateTransport(audio);
    showToast('현재 재생 위치에서 자동 넘김을 다시 켰어요.', 'info');
    return true;
  }
  // A fixed beat grid is an editing aid, never a lyric-onset detector.
  function snapBeat(time, bpm, anchor) {
    if (![time,bpm,anchor].every(Number.isFinite) || bpm < 40 || bpm > 240 || anchor < 0) return time;
    const period = 60 / bpm;
    return Math.max(0, anchor + Math.round((time-anchor)/period)*period);
  }
  function detectBeatGrid(samples, rate) {
    if (!samples?.length || !(rate > 0) || samples.length/rate < 8 || samples.length/rate > 600) return null;
    const size=2**Math.max(5,Math.min(10,Math.round(Math.log2(rate*.032)))), hop=Math.max(1,Math.round(rate*.01)), fps=rate/hop;
    const real=new Float64Array(size), imag=new Float64Array(size), previous=new Float64Array(size/2);
    const window=Float64Array.from({length:size},(_,i)=>.5-.5*Math.cos(2*Math.PI*i/(size-1)));
    const flux=[];
    for(let start=0;start+size<=samples.length;start+=hop){
      for(let i=0;i<size;i++){real[i]=samples[start+i]*window[i];imag[i]=0;}
      for(let i=1,j=0;i<size;i++){
        let bit=size>>1;for(;j&bit;bit>>=1)j^=bit;j^=bit;
        if(i<j){const t=real[i];real[i]=real[j];real[j]=t;}
      }
      for(let len=2;len<=size;len<<=1){
        const angle=-2*Math.PI/len, wr=Math.cos(angle), wi=Math.sin(angle);
        for(let i=0;i<size;i+=len){
          let xr=1,xi=0;
          for(let j=0;j<len/2;j++){
            const a=i+j,b=a+len/2,vr=real[b]*xr-imag[b]*xi,vi=real[b]*xi+imag[b]*xr;
            real[b]=real[a]-vr;imag[b]=imag[a]-vi;real[a]+=vr;imag[a]+=vi;
            const next=xr*wr-xi*wi;xi=xr*wi+xi*wr;xr=next;
          }
        }
      }
      let rise=0;
      for(let i=1;i<size/2;i++){
        const magnitude=Math.hypot(real[i],imag[i]);rise+=Math.max(0,magnitude-previous[i]);previous[i]=magnitude;
      }
      flux.push(rise);
    }
    const sums=[0];for(const v of flux)sums.push(sums[sums.length-1]+v);
    const envelope=flux.map((v,i)=>{const low=Math.max(0,i-25),high=Math.min(flux.length,i+26);return Math.max(0,v-(sums[high]-sums[low])/(high-low));});
    const power=envelope.reduce((sum,v)=>sum+v*v,0);if(power<1e-8)return null;
    const scores=[];let coarse=0,bestCorrelation=0,bestScore=0;
    for(let lag=Math.ceil(60*fps/190);lag<=Math.floor(fps);lag++){
      let dot=0;for(let i=lag;i<envelope.length;i++)dot+=envelope[i]*envelope[i-lag];
      const correlation=dot/power,score=correlation*Math.exp(-.5*(Math.log2((60*fps/lag)/120)/.9)**2);
      scores[lag]=score;
      if(score>bestScore){bestScore=score;coarse=lag;bestCorrelation=correlation;}
    }
    if(bestCorrelation<.12)return null;
    if(scores[coarse-1] && scores[coarse+1]){
      const left=scores[coarse-1],middle=scores[coarse],right=scores[coarse+1],denom=left-2*middle+right;
      if(denom)coarse+=Math.max(-.5,Math.min(.5,.5*(left-right)/denom));
    }
    // Lock period and phase across the complete excerpt; do not accumulate rounded BPM error.
    let period=coarse,phase=0,best=-Infinity;
    const sample=at=>{const i=Math.floor(at),f=at-i;return (envelope[i]||0)*(1-f)+(envelope[i+1]||0)*f;};
    for(let step=0;step<=240;step++){
      const candidate=coarse*(.97+.06*step/240);
      for(let offset=0;offset<candidate;offset+=.5){
        let total=0,count=0;for(let at=offset;at<envelope.length-1;at+=candidate){total+=sample(at);count++;}
        const score=total/count;
        if(score>best){best=score;period=candidate;phase=offset;}
      }
    }
    let confidence=1;
    for(let part=0;part<4;part++){
      const low=Math.floor(part*envelope.length/4),high=Math.floor((part+1)*envelope.length/4);
      let total=0,onBeat=0,count=0,hits=0;for(let i=low;i<high;i++)total+=envelope[i];
      for(let at=phase+Math.ceil((low-phase)/period)*period;at<high-1;at+=period){const value=sample(at);onBeat+=value;count++;if(value>total/(high-low)*1.5)hits++;}
      if(!count || total<=0 || hits/count<.55)return null;
      const fit=(onBeat/count)/(total/(high-low));confidence=Math.min(confidence,Math.max(0,Math.min(1,(fit-1)/2)));
    }
    if(confidence<.4)return null;
    return {bpm:60*fps/period,anchor:phase/fps+size/(2*rate),confidence};
  }
  function analyzeBeatSamples(samples, rate, signal) {
    return new Promise((resolve,reject)=>{
      const url=URL.createObjectURL(new Blob([`const detectBeatGrid=${detectBeatGrid.toString()};onmessage=e=>{try{postMessage({grid:detectBeatGrid(e.data.samples,e.data.rate)})}catch(error){postMessage({error:error.message})}};`],{type:'text/javascript'}));
      let worker;
      const finish=(error,value)=>{worker?.terminate();URL.revokeObjectURL(url);signal.removeEventListener('abort',abort);error?reject(error):resolve(value);};
      const abort=()=>finish(new Error('분석이 취소됐어요.'));
      try {
        if(signal.aborted){abort();return;}
        worker=new Worker(url);signal.addEventListener('abort',abort,{once:true});
        worker.onmessage=e=>finish(e.data.error?new Error(e.data.error):null,e.data.grid);
        worker.onerror=()=>finish(new Error('박자 분석을 실행하지 못했습니다. BPM을 직접 입력해 주세요.'));
        worker.postMessage({samples,rate},[samples.buffer]);
      } catch(error){finish(error);}
    });
  }
  function transport() {
    const source = state.serviceMusic.sourceKey;
    if (state.serviceMusic.mode !== 'presenter-audio' || !(remoteSources.has(source) || [...profiles.values()].some(p => p.url === source))) return '';
    return `<label class="song-timing-seek">음원 위치 <input type="range" min="0" max="${Number(state.serviceMusic.audio?.duration) || 0}" step="0.1" value="${Number(state.serviceMusic.audio?.currentTime) || 0}" data-song-timing-seek data-source="${escapeAttr(source)}" aria-label="동기화 음원 위치"><span data-song-timing-clock></span></label><button type="button" class="btn secondary" data-song-timing-resume ${!state.serviceMusic.autoSyncSuspended || !state.serviceMusic.playing ? 'hidden' : ''}>자동 넘김 복귀 · R</button>`;
  }
  function updateTransport(audio) {
    const source = state.serviceMusic.sourceKey;
    for (const button of document.querySelectorAll('[data-song-timing-resume]')) {
      button.hidden = !state.serviceMusic.autoSyncSuspended || !state.serviceMusic.playing || !state.presenter.slides[state.presenter.index]?.songTimingEligible;
    }
    for (const input of document.querySelectorAll('[data-song-timing-seek]')) {
      if (input.dataset.source !== source) continue;
      input.max = Number.isFinite(audio.duration) ? audio.duration : 0;
      if (document.activeElement !== input) input.value = audio.currentTime || 0;
      const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
      input.parentElement.querySelector('[data-song-timing-clock]').textContent = `${clock(audio.currentTime || 0)} / ${clock(Number(input.max))}`;
    }
  }
  function play(serviceId, elementId) {
    if (!presenterControllerIsLive(serviceId)) {
      showToast('이 예배를 송출한 뒤 자동 넘김을 재생해 주세요.', 'info'); return;
    }
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
    // Explicit restart rebuilds the media pipeline. WebKit can stall on a backward
    // seek after output disconnection, leaving play() pending at HAVE_CURRENT_DATA.
    // Resume/pause controls do not use this path and retain their current position.
    state.serviceMusic.autoSyncSuspended = false;
    audio.load();
    state.serviceMusic.repeat = false;
    return runServiceMusicAction('toggle');
  }
  async function saveToWorship(serviceId, elementId, draft, slides) {
    const item = getServiceItems(serviceId).find(i => i.id === elementId);
    if (!item || !state.client?.storage) throw Error('예배 저장소에 연결되지 않았습니다.');
    const originalMemo = item.memo;
    const memo = parseServiceItemMemo(originalMemo);
    const error = validate(draft, slides, Boolean(draft.audioUrl));
    if (error) throw Error(error);
    const photoError = validatePhotos(draft.photos, draft.duration);
    if (photoError) throw Error(photoError);
    let url = draft.audioUrl;
    if (!url) {
      const file = new File([draft.audio], draft.audioName || 'audio.mp3', {type:draft.audio.type});
      const path = presenterReferenceMediaUploadPath(serviceId, item, file);
      const bucket = state.client.storage.from(PRESENTER_MEDIA_STORAGE_BUCKET);
      const uploaded = await bucket.upload(path, file, {cacheControl:PRESENTER_MEDIA_CACHE_CONTROL,contentType:file.type || undefined,upsert:false});
      if (uploaded.error) throw uploaded.error;
      url = bucket.getPublicUrl(path).data?.publicUrl;
      if (!url) throw Error('업로드한 음원의 주소를 확인하지 못했습니다.');
      draft.audioUrl = url; // Retain for retry; a lost commit response must not delete possibly committed audio.
    }
    const target = currentServiceItemForMutation(serviceId, item);
    if (!target || target.memo !== originalMemo) throw Error('편집 중 가사나 음원이 바뀌었습니다. 다시 열어 주세요.');
    memo.audioAsset = {kind:'audio',name:draft.audioName,url};
    memo.audioTiming = {version:1,audioUrl:url,audioFingerprint:draft.audioFingerprint,duration:draft.duration,
      starts:[...draft.starts],enabled:draft.enabled, photos:draft.photos || [],
      lyricsFingerprint:fingerprint(slides.map(s=>({...s,serviceTimingAudioSource:url})))};
    // Direct lyrics become an audio-led occurrence, without creating or updating a praise DB song.
    if (servicePraiseUsesDirectLyrics(memo.inputMode)) {
      target.raw_title ||= serviceItemLinkedSong(target)?.title || '';
      memo.inputMode = 'audio_praise'; target.song_id = null; target.version_id = null; target.song_version_id = null;
    }
    target.memo = serializeServiceItemMemo(memo); target._worshipElementTemplateModified = true;
    draft.lyricsFingerprint = memo.audioTiming.lyricsFingerprint;
    state.dirty.service = true; markServiceElementDirty(serviceId,target);
    const index = getServiceItems(serviceId).findIndex(i=>i.id===elementId);
    const saved = await saveServiceItemMutation(serviceId,index,{silent:true,renderAfterSave:false,throwOnError:true});
    if (!saved) throw Error('예배 저장을 확인하지 못했습니다. 입력값은 유지되며 다시 저장할 수 있습니다.');
    revision++; refreshPresenterForService(serviceId);
  }
  async function saveToVersion(song, version, draft, slides) {
    if (version?._audioSetSupported === false) throw Error('버전 음원 저장 기능이 아직 준비되지 않았습니다. DB 업데이트 후 곡을 새로 불러와 주세요.');
    if (!isChildrenVersion(song, version) || !version?._worshipVersionPersisted || !version.lyric_signature) throw Error('저장된 어린이 곡·버전을 새로 불러온 뒤 시도해 주세요.');
    if (!validSet(draft, version)) throw Error('버전의 가사·폼이 바뀌었습니다. 다시 열어 주세요.');
    const issue = validate(draft, slides, Boolean(draft.audioUrl));
    if (issue) throw Error(issue);
    const previous = version.audio_set || null, signature = version.lyric_signature;
    if (!draft.audioUrl) {
      const bucket = state.client.storage.from(PRESENTER_MEDIA_STORAGE_BUCKET);
      const path = `song-audio/v1/${await digestBytes(new TextEncoder().encode(keyFor(song.id,version.id)))}/${Date.now()}-${crypto.randomUUID()}`;
      const upload = await bucket.upload(path,draft.audio,{upsert:false,contentType:draft.audio.type || 'application/octet-stream',cacheControl:'31536000'});
      if (upload.error) throw upload.error;
      draft.audioUrl = bucket.getPublicUrl(path).data?.publicUrl;
      if (!draft.audioUrl) throw Error('업로드한 음원의 주소를 확인하지 못했습니다.');
    }
    if (version.audio_set !== previous && !(version.audio_set == null && previous == null) || signature !== version.lyric_signature || !validSet(draft, version)) throw Error('편집 중 버전 자료가 바뀌었습니다. 다시 열어 주세요.');
    const audioSet = {version:1,audioUrl:draft.audioUrl,audioName:draft.audioName,audioFingerprint:draft.audioFingerprint,
      duration:draft.duration,starts:[...draft.starts],enabled:draft.enabled,lyricsFingerprint:draft.lyricsFingerprint,
      sourceSignature:draft.sourceSignature,forms:draft.forms};
    let query = state.client.from('mindex_song_versions').update({audio_set:audioSet}).eq('id',version.id).eq('lyric_signature',signature);
    query = previous == null ? query.is('audio_set',null) : query.eq('audio_set',JSON.stringify(previous));
    const result = await query.select('id');
    if (result.error) throw Error(`곡 버전 저장 실패: ${result.error.message || 'DB 연결을 확인해 주세요.'}`);
    if (result.data?.length !== 1) throw Error('다른 곳에서 버전 자료가 변경됐습니다. 새로고침 후 다시 확인해 주세요.');
    version.audio_set = audioSet; remoteSources.add(audioSet.audioUrl); revision++;
  }
  async function open(serviceId, elementId) {
    await ready;

    if (document.querySelector('[data-song-timing-dialog]')) return;
    const all = presenterSlidesForService(serviceId).filter(s => belongsTo(s, elementId));
    const slides = pagesFor(all);
    const key = all.find(s => s.songTimingKey)?.songTimingKey;
    if (!key || !slides.length) { showToast('먼저 가사를 입력하거나 곡·버전의 가사를 로드해 주세요.', 'error'); return; }
    if (state.serviceMusic.playing || state.serviceMusic.pending) { showToast('음악을 일시정지한 뒤 동기화를 편집해 주세요.', 'info'); return; }
    const item = getServiceItems(serviceId).find(i => i.id === elementId);
    const service = state.services.find(s => s.id === serviceId);
    const song = serviceItemLinkedSong(item);
    const version = getPresenterServiceItemVersion(song, item, service);
    const serviceTiming = all.some(s => s.serviceTimingPage);
    if (!serviceTiming && (!isChildrenVersion(song, version) || !isChildrenMode(item))) { showToast('어린이 유형의 버전을 선택해 주세요.', 'error'); return; }
    const setForms = serviceTiming ? null : formsFor(item, song, version, presenterFormPlanForServiceItem(version, item, song).forms);
    const buildSetSlides = forms => presenterLyricsSlidesForServiceItem({item, section: {}, index: 0, song, version, displayText: song.title, label: item.label, forms, formWarnings: []});
    const linkedAudio = normalizeServiceAudioAsset(parseServiceItemMemo(item.memo).audioAsset);
    const stored = serviceTiming ? parseServiceItemMemo(item.memo).audioTiming : null;
    const old = stored ? {...stored, audioName:linkedAudio.name, url:stored.audioUrl} : (serviceTiming ? profiles.get(key) : versionProfile(song,version));
    const fresh = Array.isArray(old?.starts) && old?.lyricsFingerprint === fingerprint(slides);
    let draft = { key, audioUrl: stored?.audioUrl || (!serviceTiming && old?.audioUrl) || (old?.lyricsFingerprint === fingerprint(slides) ? linkedAudio.url : ''), audio: old?.audio, audioName: old?.audioName || '', audioFingerprint: old?.audioFingerprint || '',
      duration: old?.duration || 0, lyricsFingerprint: fingerprint(slides),
      sourceSignature: sourceSignature(version), forms: setForms, photos:structuredClone(old?.photos || []),
      starts: fresh ? [...old.starts] : slides.map(() => null), enabled: old?.enabled ?? true };
    let previewUrl = old?.audio ? URL.createObjectURL(old.audio) : (stored?.audioUrl || (!serviceTiming && old?.audioUrl) || '');
    const formLabels = new Map(slides.filter(slide => slide.formKey && presenterFormGroupLabel(slide)).map(slide => [slide.formKey, presenterFormGroupLabel(slide)]));
    const dialog = document.createElement('dialog');
    dialog.className = 'song-timing-dialog'; dialog.dataset.songTimingDialog = '';
    dialog.setAttribute('aria-labelledby', 'song-timing-title');
    dialog.innerHTML = `<h2 id="song-timing-title">${serviceTiming ? '예배 음원·가사·타이밍' : '어린이 버전 음원·타이밍'}</h2>
      <p>${escapeHtml(all[0]?.elementTitle || all[0]?.title || '')}</p>
      <p>${serviceTiming ? '이 예배의 가사 전환 시각을 저장합니다. 아래 사진 별도 자동 전환은 가사 시각을 바꾸지 않고 추가할 수 있습니다. 다른 예배에는 적용되지 않습니다.' : '현재 가사·폼과 음원·자동 넘김 시각을 한 세트로 저장합니다. 곡·버전에 연결해 보관하며 ‘어린이: 음원 불러오기’에서만 사용합니다.'}</p>
      <p>${serviceTiming ? '음원·가사·타이밍을 이 예배에 함께 저장합니다. 다른 컴퓨터에서도 예배를 열면 그대로 사용할 수 있습니다.' : '이 버전의 자료를 함께 사용하는 예배에 적용됩니다. 가사·악보 불러오기에는 적용하지 않습니다.'} 음원을 들으며 각 장의 시작을 기록하세요. ${serviceTiming ? '가사는 부르기 시작하는 시각을 기록하면 1초 먼저 넘깁니다. 가사 없는 사진·간주는 기록한 시각에 넘깁니다.' : '가사는 1초 먼저, 빈 화면·음표는 기록한 시각에 넘깁니다.'} 수동으로 넘기면 음악은 계속 재생하고 자동 넘김만 해제됩니다.</p>
      ${linkedAudio.url ? `<button type="button" class="btn secondary" data-timing-linked>연결된 음원 사용 · ${escapeHtml(linkedAudio.name || '음원')}</button>` : ''}
      <label>음원 선택 <input type="file" accept="audio/*" data-timing-file></label>
      <p data-timing-filename></p><audio controls preload="metadata"></audio>
      <fieldset class="song-timing-beats"><legend>박자 맞춤</legend>
        <button type="button" class="btn secondary" data-beat-analyze>음원 박자 분석</button>
        <label>BPM <input type="number" min="40" max="240" step="0.001" data-beat-bpm aria-label="박자 BPM"></label>
        <label>기준 박 (초) <input type="number" min="0" step="0.001" value="0" data-beat-anchor aria-label="기준 박 초"></label>
        <button type="button" class="btn secondary" data-beat-anchor-now>현재 위치를 기준 박으로</button>
        <label><input type="checkbox" data-beat-enabled> 새 기록을 가까운 박에 맞춤</label>
        <p data-beat-status role="status">분석 또는 직접 입력 후 켜세요. 기존 시각은 바뀌지 않습니다. 박자가 달라지는 곡은 구간별로 기준을 다시 잡으세요.</p>
      </fieldset>
      <div class="song-timing-record"><button type="button" class="btn secondary" data-timing-next>다음 장 전환 기록</button><span data-timing-next-label></span></div>
      <div class="song-timing-pages">${slides.map((slide, i) => `<div class="song-timing-row"><label>${slide.formBackgroundImage ? `<img class="song-timing-photo" src="${escapeAttr(slide.formBackgroundImage)}" alt="${i + 1}장 배경 사진">` : ''}${i + 1}장 · ${formLabels.get(slide.formKey) ? escapeHtml(formLabels.get(slide.formKey)) + ' · ' : ''}${escapeHtml(slide.text || '빈 화면')}<input aria-label="${i + 1}장 시작 초" type="number" min="0" step="0.1" data-timing-start="${i}" value="${draft.starts[i] ?? ''}" placeholder="초"></label><button type="button" class="btn secondary" data-timing-stamp="${i}">현재 시각 기록</button><button type="button" class="btn secondary" data-timing-nudge="${i}" data-delta="-0.2" aria-label="${i+1}장 0.2초 앞당기기">−0.2초</button><button type="button" class="btn secondary" data-timing-nudge="${i}" data-delta="0.2" aria-label="${i+1}장 0.2초 늦추기">+0.2초</button></div>`).join('')}</div>
      ${serviceTiming ? `<fieldset><legend>사진 별도 자동 전환</legend>
        <p>가사 시각은 유지하고 사진만 음원 위치에 맞춰 바꿉니다. 사진 파일은 이름순으로 배치됩니다.</p>
        <label>사진 선택 <input type="file" accept="image/*" multiple data-timing-photos></label>
        <label>사진 전환 초 (한 줄에 한 장, 가사보다 1초 앞당기지 않음)<textarea data-photo-times>${draft.photos.map(p=>p.at).join('\n')}</textarea></label>
        <p data-photo-names>${draft.photos.map(p=>escapeHtml(p.name || p.url.split('/').pop())).join(' · ')}</p>
        <button type="button" class="btn secondary" data-photo-clear>사진 연결 해제</button>
      </fieldset>` : ''}
      <label><input type="checkbox" data-timing-enabled ${draft.enabled ? 'checked' : ''}> 음악 재생 중 자동 넘김</label>
      <p role="status" data-timing-status>${old && !fresh ? '가사가 바뀌었어요. 모든 장의 시각을 다시 기록해 주세요.' : '음원과 시각을 저장한 뒤, 해당 곡에서 음악 재생을 누르세요.'}</p>

      <div class="song-timing-actions"><button type="button" class="btn secondary" data-timing-close>닫기</button><button type="button" class="btn" data-timing-save>${serviceTiming ? '예배에 저장' : '곡 버전에 저장'}</button></div>`;
    const audio = dialog.querySelector('audio');
    const status = dialog.querySelector('[data-timing-status]');
    const saveButton = dialog.querySelector('[data-timing-save]');
    if (previewUrl) audio.src = previewUrl;
    dialog.querySelector('[data-timing-filename]').textContent = draft.audioName;
    let beatSerial = 0, beatAbort = null;
    const beatStatus = dialog.querySelector('[data-beat-status]');
    const beatBpm = dialog.querySelector('[data-beat-bpm]');
    const beatAnchor = dialog.querySelector('[data-beat-anchor]');
    const beatEnabled = dialog.querySelector('[data-beat-enabled]');
    const resetBeat = () => { beatAbort?.abort(); beatSerial++; dialog.querySelector('[data-beat-analyze]').disabled=false; beatBpm.value=''; beatAnchor.value='0'; beatEnabled.checked=false; beatStatus.textContent='음원이 바뀌었어요. 박자를 다시 확인해 주세요.'; };
    let busy = false;
    let photoFiles = [];
    const uploadedPhotos = new Map();
    dialog.querySelector('[data-timing-photos]')?.addEventListener('change', e => {
      photoFiles = [...e.target.files].sort((a,b)=>a.name.localeCompare(b.name, 'ko', {numeric:true}));
      dialog.querySelector('[data-photo-names]').textContent = photoFiles.map(f=>f.name).join(' · ');
    });
    dialog.querySelector('[data-photo-clear]')?.addEventListener('click', () => {
      if (busy) return;
      photoFiles = []; draft.photos = [];
      dialog.querySelector('[data-timing-photos]').value = '';
      dialog.querySelector('[data-photo-times]').value = '';
      dialog.querySelector('[data-photo-names]').textContent = '사진 연결을 해제한 뒤 예배에 저장해 주세요.';
    });
    const preparePhotos = async () => {
      const raw = dialog.querySelector('[data-photo-times]')?.value.trim() || '';
      const times = raw ? raw.split(/\s+/).map(Number) : [];
      const count = photoFiles.length || draft.photos.length;
      if (times.length !== count || times.some((t,i)=>!Number.isFinite(t) || t<0 || t>=draft.duration || (i>0 && t-times[i-1]<0.2)))
        throw Error('사진 수와 전환 시각의 수·순서를 확인해 주세요.');
      const first = Math.max(0, draft.starts[0] - (noLead(slides[0]) ? 0 : 1));
      if (times.length && times[0] < first) throw Error('사진은 첫 가사·간주 화면 이후부터 배치해 주세요.');
      if (photoFiles.some(f=>f.size>20*1024*1024)) throw Error('사진은 한 장당 20MB 이하로 선택해 주세요.');
      if (photoFiles.some(f=>!f.type.startsWith('image/'))) throw Error('사진 파일만 선택해 주세요.');
      if (count>200) throw Error('사진은 최대 200장까지 저장할 수 있어요.');
      if (photoFiles.length) {
        const item = getServiceItems(serviceId).find(i=>i.id===elementId);
        const bucket = state.client.storage.from(PRESENTER_MEDIA_STORAGE_BUCKET);
        const uploaded = [];
        for (const file of photoFiles) {
          if (uploadedPhotos.has(file)) {
            uploaded.push({...uploadedPhotos.get(file),at:times[uploaded.length]}); continue;
          }
          const path = presenterReferenceMediaUploadPath(serviceId,item,file);
          const result = await bucket.upload(path,file,{cacheControl:PRESENTER_MEDIA_CACHE_CONTROL,contentType:file.type,upsert:false});
          if (result.error) throw result.error;
          const url = bucket.getPublicUrl(path).data?.publicUrl;
          if (!url) throw Error('사진 주소를 확인하지 못했습니다.');
          uploadedPhotos.set(file,{name:file.name,url});
          uploaded.push({name:file.name,url,at:times[uploaded.length]});
        }
        draft.photos = uploaded; photoFiles = [];
      } else draft.photos = draft.photos.map((photo,i)=>({...photo,at:times[i]}));
    };
    let nextStamp = Math.max(0, draft.starts.findIndex(value => value == null));
    const updateNext = () => {
      dialog.querySelector('[data-timing-next-label]').textContent = nextStamp < slides.length ? `${nextStamp + 1} / ${slides.length}장` : '모든 장 기록 완료';
    };
    updateNext();
    dialog.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
    dialog.addEventListener('close', () => { beatAbort?.abort(); beatSerial++; audio.pause(); audio.removeAttribute('src'); if (previewUrl) URL.revokeObjectURL(previewUrl); dialog.remove(); });
    dialog.addEventListener('keydown', e => e.stopPropagation());
    dialog.addEventListener('input', e => {
      if (e.target.matches('[data-beat-bpm],[data-beat-anchor]')) { beatAbort?.abort(); beatSerial++; dialog.querySelector('[data-beat-analyze]').disabled=false; }
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
        resetBeat(); audio.pause();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(file);
        if (digest !== draft.audioFingerprint) {
          draft.starts = slides.map(() => null); nextStamp = 0; updateNext();
          if (dialog.querySelector('[data-photo-times]')) dialog.querySelector('[data-photo-times]').value = '';
          dialog.querySelectorAll('[data-timing-start]').forEach(input => { input.value = ''; });
        }
        draft.audioUrl = ''; draft.audio = file; draft.audioName = file.name; draft.audioFingerprint = digest; draft.duration = 0;
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
          draft.audioUrl = linkedAudio.url;
        } catch (error) { status.textContent = error.message; }
        finally { busy = false; button.disabled = false; }
        return;
      }
      if (button.hasAttribute('data-beat-anchor-now')) { beatAbort?.abort(); beatSerial++;dialog.querySelector('[data-beat-analyze]').disabled=false; beatAnchor.value=audio.currentTime.toFixed(2); return; }
      if (button.hasAttribute('data-beat-analyze')) {
        if (!previewUrl) { beatStatus.textContent='음원을 먼저 선택해 주세요.'; return; }
        beatAbort?.abort();beatAbort=new AbortController();
        const serial=++beatSerial, url=previewUrl, signal=beatAbort.signal;
        button.disabled=true; beatEnabled.checked=false; beatStatus.textContent='이 기기에서 박자를 분석하고 있어요…';
        let context;
        try {
          const blob=draft.audio || await fetch(url,{signal}).then(r=>{if(!r.ok)throw Error('음원을 불러오지 못했습니다.');return r.blob();});
          if(blob.size>100*1024*1024)throw Error('100MB 이하 음원만 분석할 수 있어요.');
          context=new (window.AudioContext || window.webkitAudioContext)({sampleRate:8000});
          const decoded=await context.decodeAudioData(await blob.arrayBuffer());
          if(serial!==beatSerial || !dialog.isConnected)return;
          if(decoded.duration>600)throw Error('10분 이하 음원만 분석할 수 있어요. BPM을 직접 입력해 주세요.');
          const mono=new Float32Array(decoded.length);
          for(let channel=0;channel<decoded.numberOfChannels;channel++){
            const data=decoded.getChannelData(channel);for(let i=0;i<mono.length;i++)mono[i]+=data[i]/decoded.numberOfChannels;
          }
          const grid=await analyzeBeatSamples(mono,decoded.sampleRate,signal);
          if(serial!==beatSerial || !dialog.isConnected)return;
          if(!grid){beatBpm.value='';throw Error('일정한 박자를 확신할 수 없어요. BPM·기준 박을 직접 지정하거나 맞춤을 끄고 기록하세요.');}
          beatBpm.value=grid.bpm.toFixed(3);beatAnchor.value=grid.anchor.toFixed(3);
          beatStatus.textContent='박자 후보를 찾았어요. 들어 보고 기준 박을 확인한 뒤 맞춤을 켜세요. 가사 시작 시각을 분석한 결과는 아닙니다.';
        } catch(error) { if(serial===beatSerial && dialog.isConnected)beatStatus.textContent=error.message; }
        finally { if(context)void context.close(); if(serial===beatSerial && dialog.isConnected)button.disabled=false; }
        return;
      }
      if (button.hasAttribute('data-timing-nudge')) {
        const i=Number(button.dataset.timingNudge), old=draft.starts[i];
        if(!Number.isFinite(old)){status.textContent='먼저 이 장의 시각을 기록해 주세요.';return;}
        const time=Math.round((old+Number(button.dataset.delta))*100)/100;
        if(time<0 || time>=draft.duration){status.textContent='음원 길이 안에서 조정해 주세요.';return;}
        draft.starts[i]=time;dialog.querySelector(`[data-timing-start="${i}"]`).value=time;
        status.textContent=`${i+1}장 · ${time}초 (미세 조정은 박에 붙이지 않음)`;return;
      }
      if (button.hasAttribute('data-timing-close')) { dialog.close(); return; }
      if (button.hasAttribute('data-timing-stamp') || button.hasAttribute('data-timing-next')) {
        if (!draft.duration || audio.readyState < 1) { status.textContent = '음원을 먼저 선택해 주세요.'; return; }
        const i = button.hasAttribute('data-timing-next') ? nextStamp : Number(button.dataset.timingStamp);
        if (i >= slides.length) { status.textContent = '모든 장을 기록했어요. 개별 기록 버튼으로 수정할 수 있어요.'; return; }
        const raw = audio.currentTime;
        const snapped = beatEnabled.checked ? snapBeat(raw, Number(beatBpm.value), Number(beatAnchor.value)) : raw;
        if (beatEnabled.checked && (!beatBpm.value || !Number.isFinite(Number(beatBpm.value)) || Number(beatBpm.value)<40 || Number(beatBpm.value)>240 || !beatAnchor.value || !Number.isFinite(Number(beatAnchor.value)) || Number(beatAnchor.value)<0 || Number(beatAnchor.value)>=draft.duration)) { beatStatus.textContent='BPM과 기준 박을 확인해 주세요.'; return; }
        if (snapped >= draft.duration) { status.textContent='가까운 박이 음원 끝을 벗어납니다. 박자 맞춤을 끄거나 시각을 직접 입력하세요.'; return; }
        draft.starts[i] = Math.round(snapped * 100) / 100;
        if (beatEnabled.checked) beatStatus.textContent=`${raw.toFixed(2)}초 → ${draft.starts[i]}초 (박자 맞춤)`;
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
        busy = true; dialog.querySelectorAll('button,input,textarea').forEach(c=>c.disabled=true);
        try {
          const current = pagesFor(presenterSlidesForService(serviceId).filter(s => belongsTo(s, elementId)));
          if (current[0]?.songTimingKey !== key || fingerprint(current) !== draft.lyricsFingerprint) throw Error('편집 중 곡 또는 가사가 바뀌었어요. 닫고 다시 열어 주세요.');
          draft.enabled = dialog.querySelector('[data-timing-enabled]').checked;
          if (serviceTiming) {
            await preparePhotos();
            await saveToWorship(serviceId, elementId, draft, current);
            draft.lyricsFingerprint = fingerprint(pagesFor(presenterSlidesForService(serviceId).filter(s=>belongsTo(s,elementId))));
          }
          else await saveToVersion(song, version, draft, current);
          audio.pause();
          refreshPresenterForService(serviceId);
          status.textContent = serviceTiming ? '음원·가사·타이밍을 예배에 저장했어요. 다른 컴퓨터에서도 이 예배를 열면 사용할 수 있어요.' : '곡 버전에 음원·타이밍을 저장했어요. 음원 불러오기 방식에서만 적용됩니다.';
        } catch (error) { status.textContent = error.message; }
        finally { busy = false; dialog.querySelectorAll('button,input,textarea').forEach(c=>c.disabled=false); }
      }
    });
    document.body.append(dialog); dialog.showModal();
  }
  // Read-only adapter for audited Elem packages; persistence is version-owned.
  const libraryKey = value => String(value || '').normalize('NFC').replace(/\s/g, '').toLowerCase();
  async function readElemLibrary(doc, files, manifest = []) {
    if (doc?.kind !== 'mindex-song-timing' || doc.version !== 1 || !doc.songs || !doc.lyrics) throw Error('Elem 찬양-타이밍.json을 선택해 주세요.');
    const entries = Object.entries(doc.songs);
    if (!entries.length || entries.length > 100) throw Error('한 번에 1~100곡을 가져올 수 있습니다.');
    const result = [];
    for (const [key, timing] of entries) {
      const lyric = doc.lyrics[key];
      if (!timing?.title || typeof lyric?.text !== 'string' || lyric.text.length > 100000) throw Error('곡 제목이나 가사 자료가 올바르지 않습니다.');
      const pages = lyric.text.trim().split(/\n\s*\n/).map(s => s.normalize('NFC'));
      const lyricHash = (await digestBytes(new TextEncoder().encode(pages.join('\n\n')))).slice(0, 16);
      if (lyricHash !== timing.lyricsFingerprint || pages.length !== timing.pageStarts?.length || pages.length !== timing.origins?.length) throw Error(`${timing.title}: 가사와 타이밍 지문이 다릅니다.`);
      const candidates = files.filter(f => /\.(mp3|m4a|wav|aac|ogg|webm|flac)$/i.test(f.name) && libraryKey(f.name.replace(/\.[^.]+$/, '')) === libraryKey(timing.title));
      if (candidates.length !== 1) throw Error(`${timing.title}: 같은 이름의 음원 파일이 하나 있어야 합니다.`);
      const file = candidates[0];
      if (file.size > 100 * 1024 * 1024 || String(file.size) !== timing.audioFingerprint) throw Error(`${timing.title}: 음원 파일 크기가 원본과 다릅니다.`);
      const audioBytes = await file.arrayBuffer(), audioFingerprint = await digestBytes(audioBytes);
      const evidence = manifest.find(r => libraryKey(r.title) === libraryKey(timing.title));
      if (evidence && (evidence.sha256 !== audioFingerprint || evidence.bytes !== file.size)) throw Error(`${timing.title}: 음원 SHA-256이 다릅니다.`);
      const starts = [...timing.pageStarts];
      if (timing.crossStart != null) { pages.push('[후주]'); starts.push(timing.crossStart); }
      const duration = await decodedDuration(file);
      const slides = pages.map(text => /^\[(간주|int|후주)\]$/i.test(text) ? {type:'blank',text:''} : {type:'lyrics',text});
      const issue = validate({audio:file, audioFingerprint, duration, starts, lyricsFingerprint:fingerprint(slides)}, slides);
      if (issue) throw Error(`${timing.title}: ${issue}`);
      // Legacy guessed/aligned positions are never promoted by an import.
      const enabled = Boolean(evidence) && timing.origins.every(origin => origin === 'manual');
      const id = await digestBytes(new TextEncoder().encode(JSON.stringify([audioFingerprint,pages,starts,timing.origins])));
      result.push({id,title:timing.title,pages,starts,duration,enabled,audioName:file.name,audioType:file.type,
        audioBytes,audioFingerprint,origins:[...timing.origins],sourceLyricsFingerprint:timing.lyricsFingerprint});
    }
    return result;
  }
  root.MindexSongTiming = { resumeAutoSync, snapBeat, detectBeatGrid, composePhotos, validatePhotos, saveToVersion, readElemLibrary, keyFor, serviceKeyFor, pagesFor, fingerprint, validate, decorate, decorateService, audioFor, controls, open, play, transport, updateTransport, save, saveToWorship, ready, pack, unpack, share, loadShared, formsFor, sourceSignature, ownsSource: source => remoteSources.has(source) || [...profiles.values()].some(p => p.url === source), get revision() { return revision; } };
  if (typeof document !== 'undefined') document.addEventListener('input', e => {
    const input = e.target.closest('[data-song-timing-seek]');
    const audio = state.serviceMusic.audio;
    if (!input || !audio || state.serviceMusic.mode !== 'presenter-audio' || input.dataset.source !== state.serviceMusic.sourceKey) return;
    const time = Number(input.value);
    if (Number.isFinite(time) && Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(time, audio.duration));
    updateTransport(audio);
  });
  if (typeof document !== 'undefined') document.addEventListener('click', e => {
    if (e.target.closest('[data-song-timing-resume]')) { e.preventDefault(); resumeAutoSync(); return; }
    const playButton = e.target.closest('[data-song-timing-play]');
    if (playButton) { e.preventDefault(); void play(playButton.dataset.serviceId, playButton.dataset.elementId); return; }
    const button = e.target.closest('[data-song-timing-open]');
    if (button) { e.preventDefault(); void open(button.dataset.serviceId, button.dataset.elementId).catch(error => showToast(error.message, 'error')); }
  });
})(globalThis);
