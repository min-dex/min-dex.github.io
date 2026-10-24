/* Version-owned children audio and worship-owned occurrence timing. */
(function (root) {
  'use strict';
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
    const timed = slides.filter(s => s.syncTimeline?.serviceTiming && !s.syncTimeline.intro);
    photos = photos?.map(photo => Number.isInteger(photo.slideIndex) ? {...photo,
      at:timed[photo.slideIndex] ? Math.max(0,timed[photo.slideIndex].syncTimeline.start-timed[photo.slideIndex].syncTimeline.lead) : NaN} : photo);
    if (!photos?.length || validatePhotos(photos, duration)) return slides;
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
    const stored = version?.audio_set;
    return stored ? {...stored, url:stored.audioUrl, databaseTiming:true} : null;
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
    const valid = childMode && children && validSet(profile, version) && profile?.enabled && profile.url && !validate(profile, slides, true);
    if (valid && profile.databaseTiming) remoteSources.add(profile.url);
    let page = 0;
    return slides.map(slide => {
      const timed = slide.type === 'lyrics' || slide.type === 'blank';
      const intro = slide.type === 'song-title' && page === 0;
      const result = { ...slide, songTimingKey: key, songTimingEligible: children && childMode, songTimingAudio: childMode && children && validSet(profile, version) && profile?.url ? {url:profile.url,name:profile.audioName} : null };
      if (childMode && !valid) result.warnings = [...(slide.warnings || []), "버전 음원·타이밍이 없거나 변경됐습니다. 버전 음원·타이밍에서 자료를 확인하세요."];
      if (timed || intro) {
        // Missing, stale or disabled DB timing must not inherit another timeline.
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
      const profile = stored ? {...stored, url:stored.audioUrl} : null;
      const valid = profile?.enabled && profile.url && stored.audioUrl === linkedSource && !validate(profile, group, true);
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
  const digestBytes = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), b => b.toString(16).padStart(2, '0')).join('');
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
    return null; // Worship audio is owned by its current audioAsset, never a cached profile.
  }
  function controls(serviceId, entries, options = {}) {
    const seen = new Set();
    return entries.filter(({ slide }) => slide.songTimingKey && slide.songTimingEligible
      && (options.audioSource || slide.serviceTimingAudioSource || !slide.serviceTimingPage)
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
      || !sync?.localTiming || !slide.songTimingEligible || music.timingGroupId !== sync.groupId
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
  let activeSeekInput = null;
  function transport(options = {}) {
    const music = state.serviceMusic;
    const source = options.source || music.sourceKey;
    if (!source || (!options.source && !music.audio)) return '';
    const owner = options.serviceId || '';
    const active = source === music.sourceKey && (!owner || owner === music.ownerServiceId);
    const duration = active && Number.isFinite(music.audio?.duration) && music.audio.duration > 0 ? music.audio.duration : 0;
    const position = active ? Math.max(0, Math.min(Number(music.audio?.currentTime) || 0, duration)) : 0;
    const synced = !options.source && music.mode === 'presenter-audio' && remoteSources.has(source);
    return `<label class="song-timing-seek"><span class="song-timing-seek-label">음원 위치</span><input type="range" min="0" max="${duration}" step="0.1" value="${position}" ${duration ? '' : 'disabled'} data-song-timing-seek data-source="${escapeAttr(source)}" data-seek-owner="${escapeAttr(owner)}" aria-label="음원 재생 위치"><span data-song-timing-clock>${transportClock(position)} / ${transportClock(duration)}</span></label>${synced ? `<button type="button" class="btn secondary" data-song-timing-resume ${!music.autoSyncSuspended || !music.playing ? 'hidden' : ''}>자동 넘김 복귀 · R</button>` : ''}`;
  }
  function transportClock(seconds) {
    const safe = Number.isFinite(seconds) ? Math.max(0, seconds) : 0;
    return `${Math.floor(safe / 60)}:${String(Math.floor(safe % 60)).padStart(2, '0')}`;
  }
  function updateTransport(audio) {
    if (typeof syncPresenterFocusMusic === "function") syncPresenterFocusMusic();
    const source = state.serviceMusic.sourceKey;
    for (const button of document.querySelectorAll('[data-song-timing-resume]')) {
      if (button.closest('[data-presenter-focus-panel]')) continue;
      button.hidden = !state.serviceMusic.autoSyncSuspended || !state.serviceMusic.playing || !state.presenter.slides[state.presenter.index]?.songTimingEligible || state.serviceMusic.timingGroupId !== state.presenter.slides[state.presenter.index]?.syncTimeline?.groupId;
    }
    for (const input of document.querySelectorAll('[data-song-timing-seek]')) {
      if (input.dataset.source !== source || (input.dataset.seekOwner && input.dataset.seekOwner !== state.serviceMusic.ownerServiceId)) {
        input.disabled = true; input.max = 0; input.value = 0;
        input.parentElement.querySelector('[data-song-timing-clock]').textContent = '0:00 / 0:00';
        continue;
      }
      input.max = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : 0;
      input.disabled = Number(input.max) <= 0;
      if (activeSeekInput !== input) input.value = audio.currentTime || 0;
      input.parentElement.querySelector('[data-song-timing-clock]').textContent = `${transportClock(audio.currentTime || 0)} / ${transportClock(Number(input.max))}`;
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
    state.serviceMusic.timingGroupId = sync.groupId;
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
    root.MINDEX_CONTENT_LIVE?.publish('song',song.id);
  }
  async function open(serviceId, elementId) {
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
    const setForms = serviceTiming ? null : formsFor(item, song, version, presenterFormPlanForServiceItem(version, item, song).forms.filter(form => !form._presenterTitle));
    const linkedAudio = normalizeServiceAudioAsset(parseServiceItemMemo(item.memo).audioAsset);
    const stored = serviceTiming ? parseServiceItemMemo(item.memo).audioTiming : null;
    const old = stored ? {...stored, audioName:linkedAudio.name, url:stored.audioUrl} : (serviceTiming ? null : versionProfile(song,version));
    const fresh = Array.isArray(old?.starts) && old?.lyricsFingerprint === fingerprint(slides);
    let draft = { key, audioUrl: stored?.audioUrl || old?.audioUrl || (old?.lyricsFingerprint === fingerprint(slides) ? linkedAudio.url : ''), audio: old?.audio, audioName: old?.audioName || '', audioFingerprint: old?.audioFingerprint || '',
      duration: old?.duration || 0, lyricsFingerprint: fingerprint(slides),
      sourceSignature: sourceSignature(version), forms: setForms, photos:structuredClone(old?.photos || []),
      starts: fresh ? [...old.starts] : slides.map(() => null), enabled: old?.enabled ?? true };
    let previewUrl = old?.audio ? URL.createObjectURL(old.audio) : (stored?.audioUrl || old?.audioUrl || '');
    const formLabels = new Map(slides.filter(slide => slide.formKey && presenterFormGroupLabel(slide)).map(slide => [slide.formKey, presenterFormGroupLabel(slide)]));
    const dialog = document.createElement('dialog');
    dialog.className = 'song-timing-dialog'; dialog.dataset.songTimingDialog = '';
    dialog.setAttribute('aria-labelledby', 'song-timing-title');
    dialog.innerHTML = `<h2 id="song-timing-title">${serviceTiming ? '예배 음원·가사·타이밍' : '어린이 버전 음원·타이밍'}</h2>
      <p>${escapeHtml(all[0]?.elementTitle || all[0]?.title || '')}</p>
      <p>${serviceTiming ? '음원·가사·전환 시각을 이 예배에만 저장합니다. 다른 기기에서도 이 예배를 열면 사용할 수 있습니다.' : '가사·송폼·음원·전환 시각을 이 곡의 버전에 저장합니다. ‘어린이: 음원 불러오기’로 이 버전을 사용하는 예배에 적용됩니다.'}</p>
      <p>${serviceTiming ? '' : '가사·악보 불러오기에는 적용되지 않습니다.'} 음원을 들으며 각 장의 시작 시각을 기록하세요. ${serviceTiming ? '가사는 부르기 시작하는 시각보다 1초 먼저, 가사 없는 사진·간주는 기록한 시각에 넘깁니다.' : '가사는 1초 먼저, 빈 화면·음표는 기록한 시각에 넘깁니다.'} 수동 전환 시 자동 넘김만 꺼지고 음악은 계속 재생됩니다.</p>
      ${linkedAudio.url ? `<button type="button" class="btn secondary" data-timing-linked>연결된 음원 사용 · ${escapeHtml(linkedAudio.name || '음원')}</button>` : ''}
      <label>음원 선택 <input type="file" accept="audio/*" data-timing-file></label>
      <p data-timing-filename></p><audio controls preload="metadata"></audio>
      <fieldset class="song-timing-beats"><legend>박자 맞춤</legend>
        <button type="button" class="btn secondary" data-beat-analyze>음원 박자 분석</button>
        <label>BPM <input type="number" min="40" max="240" step="0.001" data-beat-bpm aria-label="박자 BPM"></label>
        <label>기준 박 (초) <input type="number" min="0" step="0.001" value="0" data-beat-anchor aria-label="기준 박 초"></label>
        <button type="button" class="btn secondary" data-beat-anchor-now>현재 위치를 기준 박으로</button>
        <label><input type="checkbox" data-beat-enabled> 새 기록을 가까운 박에 맞춤</label>
        <p data-beat-status role="status">박자를 분석하거나 BPM·기준 박을 입력한 뒤 켜세요. 기존 시각은 유지됩니다.</p>
        <details data-beat-help ${window.MindexDisclosure?.attrs(["timing-beat-help"])||""}><summary>박자가 달라지는 곡</summary><p>구간별로 기준 박을 다시 지정하세요.</p></details>
      </fieldset>
      <div class="song-timing-record"><button type="button" class="btn secondary" data-timing-next>다음 장 전환 기록</button><span data-timing-next-label></span></div>
      <div class="song-timing-pages">${slides.map((slide, i) => `<div class="song-timing-row"><label for="song-timing-start-${i}">${slide.formBackgroundImage ? `<img class="song-timing-photo" src="${escapeAttr(slide.formBackgroundImage)}" alt="${i + 1}장 배경 사진">` : ''}${i + 1}장 · ${formLabels.get(slide.formKey) ? escapeHtml(formLabels.get(slide.formKey)) + ' · ' : ''}${escapeHtml(slide.text || '빈 화면')}</label><div class="song-timing-row-controls"><input id="song-timing-start-${i}" aria-label="${i + 1}장 시작 초" type="number" min="0" step="0.1" data-timing-start="${i}" value="${draft.starts[i] ?? ''}" placeholder="초"><button type="button" class="btn secondary" data-timing-stamp="${i}">현재 시각 기록</button><button type="button" class="btn secondary" data-timing-nudge="${i}" data-delta="-0.2" aria-label="${i+1}장 0.2초 앞당기기">−0.2초</button><button type="button" class="btn secondary" data-timing-nudge="${i}" data-delta="0.2" aria-label="${i+1}장 0.2초 늦추기">+0.2초</button></div></div>`).join('')}</div>
      ${serviceTiming ? `<fieldset data-photo-section tabindex="-1"><legend>사진 별도 자동 전환</legend>
        <p>사진을 전환 시각이나 가사 슬라이드에 연결하세요. 가사 시각은 바뀌지 않습니다. 가사 구간에는 하단 자막을, 간주에는 사진만 표시합니다.</p>
        <label>사진 선택 <input type="file" accept="image/*" multiple data-timing-photos></label>
        <div data-photo-editor></div>
        <button type="button" class="btn secondary" data-photo-sort>시각 순으로 정렬</button>
        <details ${window.MindexDisclosure?.attrs(["timing-bulk"])||""}><summary>시각 일괄 입력</summary><label>사진 전환 초 (한 줄에 한 장, 가사보다 1초 앞당기지 않음)<textarea data-photo-times>${draft.photos.map(p=>p.at).join('\n')}</textarea></label></details>
        <button type="button" class="btn secondary" data-photo-clear>사진 연결 해제</button>
      </fieldset>` : ''}
      <label><input type="checkbox" data-timing-enabled ${draft.enabled ? 'checked' : ''}> 음악 재생 중 자동 넘김</label>
      <p role="status" data-timing-status>${old && !fresh ? '가사가 바뀌었어요. 모든 장의 시각을 다시 기록해 주세요.' : '저장한 뒤 해당 곡의 음악 재생 버튼을 누르세요.'}</p>

      <div class="song-timing-actions"><button type="button" class="btn secondary" data-timing-close>닫기</button><button type="button" class="btn primary" data-timing-save>${serviceTiming ? '예배에 저장' : '곡 버전에 저장'}</button></div>`;
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
    let photoRows = draft.photos.map(photo=>({...photo})), photoBulkError=false;
    const uploadedPhotos = new Map(), photoPreviewUrls = new Set();
    const photoCue = row => Number.isInteger(row.slideIndex)
      ? (Number.isFinite(draft.starts[row.slideIndex]) && slides[row.slideIndex] ? Math.max(0,draft.starts[row.slideIndex]-(noLead(slides[row.slideIndex])?0:1)) : null)
      : row.at;
    const syncPhotoTimes = () => {
      const field=dialog.querySelector('[data-photo-times]');
      photoBulkError=false;
      if(field)field.value=photoRows.map(photo=>photoCue(photo) ?? '').join('\n');
      dialog.querySelectorAll('[data-photo-at]').forEach(field=>{
        const row=photoRows[Number(field.dataset.photoAt)];
        if(Number.isInteger(row.slideIndex))field.value=photoCue(row) ?? '';
      });
    };
    const renderPhotos = () => {
      const editor=dialog.querySelector('[data-photo-editor]'); if(!editor)return;
      editor.innerHTML=photoRows.length ? photoRows.map((photo,i)=>`<article class="song-photo-row">
        <img src="${escapeAttr(photo.preview || photo.url || '')}" alt="사진 ${i+1} 미리보기">
        <div class="song-photo-fields"><strong>${i+1}. ${escapeHtml(photo.name || '사진')}</strong>
        <label>붙일 위치<select data-photo-anchor="${i}" aria-label="사진 ${i+1} 붙일 위치"><option value="">음원 시각 직접 지정</option>${slides.map((slide,j)=>`<option value="${j}" ${photo.slideIndex===j?'selected':''}>${j+1}장 · ${escapeHtml((slide.text || '간주 · 사진만').replace(/\s+/g,' ').slice(0,65))}</option>`).join('')}</select></label>
        <label>전환 시각 (초)<input type="number" min="0" step="0.001" data-photo-at="${i}" aria-label="사진 ${i+1} 전환 초" value="${photoCue(photo) ?? ''}" ${Number.isInteger(photo.slideIndex)?'readonly':''}></label>
        <div class="song-photo-actions"><button type="button" class="btn secondary" data-photo-stamp="${i}">지금 시각 기록</button><button type="button" class="btn secondary" data-photo-preview="${i}">이 시점 듣기</button>
        <label class="btn secondary">사진 교체<input type="file" accept="image/*" data-photo-replace="${i}" aria-label="사진 ${i+1} 교체"></label><button type="button" class="btn secondary" data-photo-remove="${i}">삭제</button></div></div></article>`).join('') : '<p>추가한 사진이 없습니다.</p>';
      syncPhotoTimes();
    };
    const fileRow = (file, previous={}) => {
      if(!file.type.startsWith('image/') || file.size>20*1024*1024)throw Error('사진 파일을 한 장당 20MB 이하로 선택해 주세요.');
      const preview=URL.createObjectURL(file);photoPreviewUrls.add(preview);
      return {...previous,file,preview,name:file.name,at:previous.at ?? null};
    };
    dialog.querySelector('[data-timing-photos]')?.addEventListener('change', e => {
      if(busy)return;
      try {
        const files=[...e.target.files].sort((a,b)=>a.name.localeCompare(b.name,'ko',{numeric:true}));
        if(photoRows.length+files.length>200)throw Error('사진은 최대 200장까지 저장할 수 있어요.');
        photoRows.push(...files.map(file=>fileRow(file)));renderPhotos();
      } catch(error){status.textContent=error.message;}
      e.target.value='';
    });
    dialog.querySelector('[data-photo-clear]')?.addEventListener('click', () => {
      if(busy)return;photoRows=[];renderPhotos();
      status.textContent='사진 연결 해제는 예배에 저장할 때 반영됩니다.';
    });
    dialog.querySelector('[data-photo-times]')?.addEventListener('input', e=>{
      const values=e.target.value.trim().split(/\s+/);
      if(values.length!==photoRows.length){photoBulkError=true;return;}
      photoRows=photoRows.map((row,i)=>{const {slideIndex,...rest}=row;return {...rest,at:values[i]===''?null:Number(values[i])};});
      renderPhotos();
    });
    dialog.addEventListener('change',e=>{
      if(busy)return;
      if(e.target.matches('[data-photo-anchor]')) {
        const row=photoRows[Number(e.target.dataset.photoAnchor)];
        if(e.target.value===''){row.at=photoCue(row);delete row.slideIndex;}else row.slideIndex=Number(e.target.value);
        renderPhotos();
      }
      if(e.target.matches('[data-photo-replace]')) {
        const i=Number(e.target.dataset.photoReplace),file=e.target.files[0];if(!file)return;
        try {photoRows[i]=fileRow(file,photoRows[i]);renderPhotos();}catch(error){status.textContent=error.message;}
      }
    });
    dialog.addEventListener('input', e=>{
      if(e.target.matches('[data-photo-at]')) {photoRows[Number(e.target.dataset.photoAt)].at=e.target.value===''?null:Number(e.target.value);syncPhotoTimes();}
      if(e.target.matches('[data-timing-start]')) {
        draft.starts[Number(e.target.dataset.timingStart)]=e.target.value===''?null:Number(e.target.value);syncPhotoTimes();
      }
    });
    dialog.addEventListener('click',e=>{
      const button=e.target.closest('button');if(!button || busy)return;
      if(button.hasAttribute('data-photo-sort')){photoRows.sort((a,b)=>(photoCue(a) ?? Infinity)-(photoCue(b) ?? Infinity));renderPhotos();}
      if(button.hasAttribute('data-photo-remove')){photoRows.splice(Number(button.dataset.photoRemove),1);renderPhotos();}
      if(button.hasAttribute('data-photo-stamp')){
        if (!draft.duration || audio.readyState<1) { status.textContent='음원을 먼저 선택해 주세요.'; return; }
        if (beatEnabled.checked && (!beatBpm.value || !Number.isFinite(Number(beatBpm.value)) || Number(beatBpm.value)<40 || Number(beatBpm.value)>240 || !beatAnchor.value || !Number.isFinite(Number(beatAnchor.value)) || Number(beatAnchor.value)<0 || Number(beatAnchor.value)>=draft.duration)) { beatStatus.textContent='BPM과 기준 박을 확인해 주세요.'; return; }
        const row=photoRows[Number(button.dataset.photoStamp)];delete row.slideIndex;
        row.at=Math.round((beatEnabled.checked?snapBeat(audio.currentTime,Number(beatBpm.value),Number(beatAnchor.value)):audio.currentTime)*1000)/1000;renderPhotos();
      }
      if(button.hasAttribute('data-photo-preview')){
        const time=photoCue(photoRows[Number(button.dataset.photoPreview)]);
        if(!Number.isFinite(time) || time>=draft.duration){status.textContent='음원과 유효한 사진 전환 시각을 먼저 지정해 주세요.';return;}
        audio.currentTime=time;void audio.play().catch(()=>{status.textContent='음원 재생 버튼을 눌러 주세요.';});
      }
    });
    renderPhotos();
    const preparePhotos = async () => {
      if(photoBulkError)throw Error('사진 수와 입력한 시각 수가 달라요. 한 장에 한 시각을 입력해 주세요.');
      const times=photoRows.map(photoCue);
      if(times.some((t,i)=>!Number.isFinite(t) || t<0 || t>=draft.duration || (i>0&&t-times[i-1]<0.2)))
        throw Error('사진 시각을 모두 지정하고 시각 순으로 정렬해 주세요. 사진 사이는 최소 0.2초입니다.');
      const first=Math.max(0,draft.starts[0]-(noLead(slides[0])?0:1));
      if(times.length && times[0]<first)throw Error('사진은 첫 가사·간주 화면 이후부터 배치해 주세요.');
      const item=getServiceItems(serviceId).find(i=>i.id===elementId);
      const uploaded=[];
      for(let i=0;i<photoRows.length;i++){
        const row=photoRows[i];let url=row.url;
        if(row.file){
          url=uploadedPhotos.get(row.file);
          if(!url){
            const bucket=state.client.storage.from(PRESENTER_MEDIA_STORAGE_BUCKET);
            const path=presenterReferenceMediaUploadPath(serviceId,item,row.file);
            const result=await bucket.upload(path,row.file,{cacheControl:PRESENTER_MEDIA_CACHE_CONTROL,contentType:row.file.type,upsert:false});
            if(result.error)throw result.error;
            url=bucket.getPublicUrl(path).data?.publicUrl;if(!url)throw Error('사진 주소를 확인하지 못했습니다.');
            uploadedPhotos.set(row.file,url);
          }
        }
        uploaded.push({name:row.name,url,at:times[i],...(Number.isInteger(row.slideIndex)?{slideIndex:row.slideIndex}:{})});
      }
      draft.photos=uploaded;
    };
    let nextStamp = Math.max(0, draft.starts.findIndex(value => value == null));
    const updateNext = () => {
      dialog.querySelector('[data-timing-next-label]').textContent = nextStamp < slides.length ? `${nextStamp + 1} / ${slides.length}장` : '모든 장 기록 완료';
    };
    updateNext();
    dialog.addEventListener('cancel', e => { if (busy) e.preventDefault(); });
    dialog.addEventListener('close', () => { photoPreviewUrls.forEach(url=>URL.revokeObjectURL(url)); beatAbort?.abort(); beatSerial++; audio.pause(); audio.removeAttribute('src'); if (previewUrl) URL.revokeObjectURL(previewUrl); dialog.remove(); });
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
          photoRows=photoRows.map(row=>({...row,at:null}));renderPhotos();
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
        draft.starts[i]=time;dialog.querySelector(`[data-timing-start="${i}"]`).value=time;syncPhotoTimes();
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
        dialog.querySelector(`[data-timing-start="${i}"]`).value = draft.starts[i];syncPhotoTimes();
        status.textContent = `${i + 1}장 · ${draft.starts[i]}초 기록됨`;
        nextStamp = i + 1; updateNext();
        dialog.querySelector(`[data-timing-start="${Math.min(nextStamp, slides.length - 1)}"]`).closest('.song-timing-row').scrollIntoView({block:'nearest'});
      }
      if (button.hasAttribute('data-timing-save')) {
        busy = true; dialog.querySelectorAll('button,input,textarea,select').forEach(c=>c.disabled=true);
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
          status.textContent = serviceTiming ? '이 예배의 음원·가사·전환 시각을 저장했습니다.' : '이 버전의 음원·전환 시각을 저장했습니다. 음원 불러오기 방식에 적용됩니다.';
        } catch (error) { status.textContent = error.message; }
        finally { busy = false; dialog.querySelectorAll('button,input,textarea,select').forEach(c=>c.disabled=false); }
      }
    });
    document.body.append(dialog); dialog.showModal();
  }
  root.MindexSongTiming = { resumeAutoSync, snapBeat, detectBeatGrid, composePhotos, validatePhotos, saveToVersion, keyFor, serviceKeyFor, pagesFor, fingerprint, validate, decorate, decorateService, audioFor, controls, open, play, transport, updateTransport, saveToWorship, formsFor, sourceSignature, ownsSource: source => remoteSources.has(source), get revision() { return revision; } };
  if (typeof document !== 'undefined') {
    document.addEventListener('pointerdown', e => {
      activeSeekInput = e.target.closest('[data-song-timing-seek]:not(:disabled)');
    });
    const finishSeek = () => {
      activeSeekInput = null;
      if (state.serviceMusic.audio) updateTransport(state.serviceMusic.audio);
    };
    document.addEventListener('pointerup', finishSeek);
    document.addEventListener('pointercancel', finishSeek);
    document.addEventListener('focusout', e => {
      if (e.target === activeSeekInput) finishSeek();
    });
    window.addEventListener('blur', finishSeek);
  }
  if (typeof document !== 'undefined') document.addEventListener('input', e => {
    const input = e.target.closest('[data-song-timing-seek]');
    const audio = state.serviceMusic.audio;
    if (!input || !audio || input.disabled || input.dataset.source !== state.serviceMusic.sourceKey || (input.dataset.seekOwner && input.dataset.seekOwner !== state.serviceMusic.ownerServiceId)) return;
    const time = Number(input.value);
    if (Number.isFinite(time) && Number.isFinite(audio.duration)) audio.currentTime = Math.max(0, Math.min(time, audio.duration));
    updateTransport(audio);
  });
  if (typeof document !== 'undefined') document.addEventListener('click', e => {
    if (e.target.closest('[data-song-timing-resume]')) { e.preventDefault(); resumeAutoSync(); return; }
    const playButton = e.target.closest('[data-song-timing-play]');
    if (playButton) { e.preventDefault(); void play(playButton.dataset.serviceId, playButton.dataset.elementId); return; }
    const button = e.target.closest('[data-song-timing-open]');
    if (button) {
      e.preventDefault();
      void open(button.dataset.serviceId, button.dataset.elementId).then(() => {
        if (button.dataset.songTimingFocus !== 'photos') return;
        const section=document.querySelector('[data-song-timing-dialog] [data-photo-section]');
        section?.focus({preventScroll:true});section?.scrollIntoView({block:'start'});
      }).catch(error => showToast(error.message, 'error'));
    }
  });
})(globalThis);
