// Read-only output preflight. Never saves a service or changes its song/form links.
(() => {
  let pending = null, session = null, checking = false;
  const live = () => isPresenterOutputWindowOpen() || Boolean(state.presenter.outputPendingAt);
  function notify(songId = null) {
    if (!session || !live() || (songId && !session.songs.has(songId)) || session.notified) return;
    session.notified = true;
    showToast('찬양·예배 변경이 있습니다. 현재 송출은 유지하며, 송출 종료 후 다시 시작할 때 최신 자료를 확인합니다.', 'info');
  }
  async function revision(client, id) {
    const r = await client.from('mindex_worship_services').select('id,save_revision').eq('id', id).single();
    if (r.error || !r.data?.id || r.data.save_revision == null) throw Error('예배의 최신 상태를 확인하지 못했습니다. 다시 시도해 주세요.');
    return String(r.data.save_revision);
  }
  async function freshSongs(ids) {
    if (!ids.length) return [];
    const songs = await fetchSupabaseBatches(ids, batch => fetchSupabasePaged('mindex_songs', '*', q => q.in('id', batch).order('id')));
    if (ids.some(id => !songs.some(s => s.id === id))) throw Error('연결된 찬양을 찾지 못했습니다. 곡 연결을 확인해 주세요.');
    const versions = [...new Map((await Promise.all(['source_song_id', 'canonical_song_id'].map(column =>
      fetchSupabaseBatches(ids, batch => fetchSupabasePaged('mindex_song_versions', '*', q => q.in(column, batch).order('id')))
    ))).flat().map(row => [row.id, row])).values()];
    const units = versions.length ? await fetchSupabaseBatches(versions.map(v => v.id), batch =>
      fetchSupabasePaged('mindex_version_units', '*', q => q.in('version_id', batch).order('id'))) : [];
    const normalized = songs.map(normalizeServerSong);
    // Missing rows must not fall back to old memo-backed lyrics.
    normalized.forEach(song => { song.versions = []; });
    attachRelationalSongVersionRows(versions, units, ids, normalized);
    return normalized;
  }
  async function verify(serviceId, token = null) {
    const client = state.client, project = state.config.url, selected = state.selectedServiceId, generation = state.presenter.outputGeneration;
    if (!client) throw Error('DB에 연결한 뒤 송출을 시작해 주세요.');
    if (state.dirty.song || state.dirty.forms) throw Error('편집 중인 찬양을 저장한 뒤 송출을 시작해 주세요.');
    await hydratePresenterServiceData(serviceId);
    const service = state.services.find(s => s.id === serviceId);
    if (!service) throw Error('예배를 불러오지 못했습니다.');
    const items = getServiceOutputItems(serviceId);
    if (serviceItemsShouldUseDocumentSlideFallback(items) && serviceDocumentPresenterSlides(service).some(s => s.type === 'lyrics')) {
      throw Error('저장된 슬라이드 사본만으로는 최신 가사를 확인할 수 없습니다. 예배 항목을 다시 불러와 주세요.');
    }
    const signature = JSON.stringify(getServiceItems(serviceId));
    const before = await revision(client, serviceId);
    const ids = [...new Set(items.filter(i => !['manual_praise', 'audio_praise'].includes(servicePraiseInputMode(i))).map(i => i.song_id).filter(Boolean))];
    const songs = await freshSongs(ids);
    const after = await revision(client, serviceId);
    if (generation !== state.presenter.outputGeneration || (token && pending !== token) || selected !== state.selectedServiceId || before !== after || client !== state.client || project !== state.config.url || signature !== JSON.stringify(getServiceItems(serviceId))
      || state.dirty.song || state.dirty.forms || live()) throw Error('확인 중 자료가 변경되었습니다. 다시 송출을 시작해 주세요.');
    for (const item of items) {
      if (!item.song_id || ['manual_praise', 'audio_praise'].includes(servicePraiseInputMode(item))) continue;
      const song = songs.find(s => s.id === item.song_id);
      const selectedId = item.version_id || item.song_version_id;
      const version = selectedId ? song.versions.find(v => v.id === selectedId) : song.versions[0];
      if (!version) throw Error('연결된 찬양 버전을 확인하지 못했습니다. 버전을 선택해 주세요.');
      if (serviceItemOutputMode(item, parseServiceItemMemo(item.memo)) !== 'score' && !presenterVersionHasUsableLyrics(version)) {
        throw Error('선택한 찬양 버전에 가사가 없습니다. 가사를 확인해 주세요.');
      }
    }
    const map = new Map(state.songs.map(s => [s.id, s]));
    songs.forEach(s => map.set(s.id, s));state.songs = [...map.values()];clearSearchCaches();presenterSlideBuildCache.delete(serviceId);
    session = { serviceId, revision: after, songs: new Map(songs.map(s => [s.id, structuredClone(s)])), notified: false };
    return true;
  }
  async function beforeOpen(serviceId) {
    if (live()) {
      if (session && session.serviceId !== serviceId) {
        showToast('현재 송출을 종료한 뒤 다른 예배의 송출을 시작해 주세요.', 'info');
        return false;
      }
      return true;
    }
    if (pending) return false;
    // Reserve inside the click gesture, but never send slides before verification.
    const reserved = !window.mindexElectron?.openPresenterOutput ? window.open('about:blank', 'mindexPresenterOutput', presenterOutputWindowFeatures(resolvePresenterTargetScreenRect())) : null;
    const token = {}; pending = token;
    let timeout;
    try {
      await Promise.race([verify(serviceId, token), new Promise((_, reject) => {
        timeout = setTimeout(() => reject(Error('최신 가사 확인이 지연되었습니다. 연결 상태를 확인하고 다시 시도해 주세요.')), 20000);
      })]);
      if (reserved?.closed) throw Error('송출 준비가 취소되었습니다.');
      if (reserved) {
        // This newly reserved popup must not inherit a stopped output session.
        state.presenter.outputSessionId = crypto.randomUUID();
        state.presenter.outputClientId = '';
        const url = new URL(presenterOutputUrl());url.searchParams.set('fullscreen', 'start');
        reserved.location.replace(url.toString());state.presenter.outputWindow = reserved;
      }
      return true;
    } catch (error) {
      if (reserved && !reserved.closed) reserved.close();
      session = null;
      showToast(`송출을 시작하지 않았습니다. ${error.message || '최신 가사를 확인하지 못했습니다.'}`, 'error');
      return false;
    } finally { clearTimeout(timeout); if (pending === token) pending = null; }
  }
  function song(id, serviceId) {
    if (!session || session.serviceId !== serviceId || !live()) return null;
    return session.songs.get(id) || null;
  }
  async function checkLiveRevision() {
    if (checking || !session || !live() || session.notified) return;
    checking = true;
    try { if (await revision(state.client, session.serviceId) !== session.revision) notify(); }
    catch { /* Keep current output on network loss; next preparation remains strict. */ }
    finally { checking = false; }
  }
  globalThis.MindexPresenterFreshness = { beforeOpen, verify, freshSongs, song, notify, checkLiveRevision };
})();
