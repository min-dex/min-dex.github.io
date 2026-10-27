// Praise persistence and single-ID lifecycle controller.
// Loaded before app bootstrap; no I/O until called by the editor.

async function saveSongMeta(liveSong) {
  if (liveSong?._singleSongRecord) {
    if (!state.singleSongRepository) throw new Error("SINGLE_SONG_REPOSITORY_REQUIRED");
    const record = state.singleSongCatalog.get(liveSong.id);
    const version = liveSong.versions?.[0];
    if (liveSong.versions?.length !== 1 || version?.id !== liveSong.id) throw new Error("SINGLE_SONG_IDENTITY_CHANGED");
    const repository = state.singleSongRepository;
    const pending = praisePendingSaves.get(liveSong);
    if (pending && pending.singleRepository !== repository) throw new Error("SINGLE_SONG_REPOSITORY_CHANGED");
    const before = pending?.before || structuredClone(liveSong), formsBefore = pending?.formsBefore || JSON.stringify(state.forms);
    const next = pending?.next || globalThis.MindexSingleSong.fromLegacySong(before, before.versions[0], liveSong.id);
    if (!pending) {
      next.legacy = record.legacy; next.provenance = record.provenance;
      next.relations = record.relations; next.revision = before._singleSongRevision ?? record.revision;
      praisePendingSaves.set(liveSong, {singleRepository:repository,before,formsBefore,next});
    }
    let saved;
    try { saved = await repository.save(next); }
    catch (error) {
      if (/SINGLE_SONG_CONFLICT|SINGLE_SONG_REQUEST_REUSED|INVALID_SINGLE_SONG/.test(error.message)) praisePendingSaves.delete(liveSong);
      throw error;
    }
    praisePendingSaves.delete(liveSong);
    if (repository !== state.singleSongRepository) return false;
    const records = state.singleSongCatalog.ids().map(id => id === saved.id ? saved : state.singleSongCatalog.get(id));
    state.singleSongCatalog = globalThis.MindexSingleSong.createCatalog(records);
    const savedSong = state.singleSongCatalog.appSong(saved.id);
    const unchanged = JSON.stringify(liveSong) === JSON.stringify(before) && JSON.stringify(state.forms) === formsBefore;
    const { mergeEditorDraft } = await import(`./mindex.draft-merge.mjs?v=${encodeURIComponent(window.MINDEX_RELEASE || "draft-merge")}`);
    Object.assign(liveSong, mergeEditorDraft(before, liveSong, savedSong).value);
    state.cleanFingerprints.praise = JSON.stringify(dirtyComparableValue({song:savedSong,versionId:saved.id,forms:savedSong.versions[0].forms||[]}));
    if (!unchanged) { state.dirty.song = true; state.dirty.forms = true; }
    clearSearchCaches();
    return unchanged;
  }
  const client = state.client, project = state.config.url;
  const pending = praisePendingSaves.get(liveSong);
  if (pending && (pending.client !== client || pending.project !== project)) throw new Error("연결이 변경되었습니다. 이전 저장 결과 확인 전에는 덮어쓸 수 없습니다.");
  if (!pending) {
    // Assign IDs before taking the immutable request snapshot, so late edits keep
    // referring to the same versions/units even when these are newly created.
    if (state.songVersionTablesSupported && state.dirty.forms) {
      for (const version of liveSong.versions || []) {
        const oldId = version.id;
        if (!isUuid(version.id)) version.id = createUuid();
        if (state.selectedVersionId === oldId) {
          state.selectedVersionId = version.id;
          for (const form of state.forms) form.song_id = version.id;
        }
        for (const form of version.forms || []) {
          const oldFormId = form.id;
          if (!isUuid(form.id)) form.id = createUuid();
          if (state.selectedVersionId === version.id) {
            const visible = state.forms.find(item => item.id === oldFormId);
            if (visible) visible.id = form.id;
          }
        }
      }
    }
  }
  const before = pending?.before || structuredClone(liveSong);
  const formsBefore = pending?.formsBefore || JSON.stringify(state.forms);
  const selectedVersionId = pending?.selectedVersionId || state.selectedVersionId;
  const song = pending?.draft || structuredClone(liveSong);
  const { mergeEditorDraft } = await import(`./mindex.draft-merge.mjs?v=${encodeURIComponent(window.MINDEX_RELEASE || "draft-merge")}`);
  let req = pending?.req;
  if (!req) {
    if (cleanList(song.scripture).length) await validateScriptureReferences(song.scripture);
    const baseline = JSON.parse(state.cleanFingerprints.praise || 'null')?.song;
    if (!baseline || baseline.id !== song.id) throw new Error("저장 기준을 확인하지 못했습니다. 입력을 보존한 채 최신본을 다시 확인해 주세요.");
    const result = await client.rpc('get_praise_snapshot_v1', {sid:song.id});
    if (result.error) throw new Error("안전한 찬양 저장 연결을 확인하지 못했습니다. 입력은 유지됩니다.", {cause:result.error});
    const fresh = praiseSnapshotSong(result.data);
    if (praiseSaveComparable(baseline) !== praiseSaveComparable(fresh)) throw new Error("다른 곳에서 이 곡이 변경되었습니다. 내 입력은 유지하고 최신본 덮어쓰기는 막았습니다.");
    const metadata = normalizeSongMetadata(song.metadata);
    const hasPromotedColumns = hasPromotedSongMetadataColumns(song);
    const hasScriptureRefsColumn = hasSongColumn(song, "scripture_refs");
    const aggregatePraiseTypes = aggregateSongPraiseTypes(song);
    const useVersionTables = state.songVersionTablesSupported === true;
    const useRelationTable = state.songRelationsSupported === true;
    const plan = useVersionTables && state.dirty.forms ? await saveSongVersions(song, {detached:true, planOnly:true}) : {};
    const payload = {
      title: cleanSongTitleForSave(song),
      subtitle: nullIfBlank(song.subtitle),
      original_title: nullIfBlank(song.original_title),
      hymn_no: nullIfBlank(song.hymn_no),
      ...(hasSongColumn(song, "praise_types") ? { praise_types: aggregatePraiseTypes } : {}),
      memo: serializeSongMemo(song, {
        omitPromotedMetadata: hasPromotedColumns,
        omitScripture: hasScriptureRefsColumn,
        omitVersions: useVersionTables,
        omitRelatedSongs: useRelationTable,
      }),
    };

    if (hasPromotedColumns) {
      Object.assign(payload, promotedSongMetadataPayload(song, metadata));
    }

    if (hasScriptureRefsColumn) {
      payload.scripture_refs = normalizeSongScriptureRefs(song.scripture);
    }


    // Editing lyrics must not erase import provenance or media source metadata.
    for (const row of plan.units || []) {
      const original = result.data.units.find(unit => unit.id === row.id);
      if (original) for (const key of ['source_unit_id','trigger','slide_numbers','review_note']) {
        if (Object.prototype.hasOwnProperty.call(original,key)) row[key]=original[key];
      }
    }
    req = {protocolVersion:1,requestId:createUuid(),songId:song.id,expected:result.data,songPatch:payload,...plan,
      ...(useRelationTable ? {relatedIds:cleanList(song.related_song_ids).filter(id=>id!==song.id)} : {})};
    if (client !== state.client || project !== state.config.url) throw new Error("연결이 변경되어 저장하지 않았습니다. 입력은 유지됩니다.");
    praisePendingSaves.set(liveSong,{client,project,req,before,formsBefore,selectedVersionId,draft:song});
  }
  // Keep exactly the same request after an unknown outcome (e.g. lost response).
  // No fallback to non-transactional table writes if the RPC is unavailable.
  const result = await client.rpc('save_praise_v1', {req});
  if (result.error) {
    if (result.error.code === 'P0001' || result.error.code === '23505' || result.error.code === '23503') praisePendingSaves.delete(liveSong);
    throw new Error(result.error.message?.includes('PRAISE_CONFLICT')
      ? "다른 곳에서 이 곡이 변경되어 저장을 중단했습니다. 내 입력은 유지됩니다."
      : "저장을 확인하지 못했습니다. 입력은 유지됩니다. 연결 후 다시 저장하면 결과를 확인합니다.", {cause:result.error});
  }
  const saved = praiseSnapshotSong(result.data?.snapshot);
  praisePendingSaves.delete(liveSong);
  if (client !== state.client || project !== state.config.url) return false;
  const unchanged = JSON.stringify(liveSong) === JSON.stringify(before) && JSON.stringify(state.forms) === formsBefore;
  const merged = mergeEditorDraft(before, liveSong, saved).value;
  merged.memo = saved.memo;
  Object.assign(liveSong, merged);
  if (getSelectedSong() === liveSong) {
    const savedVersion = saved.versions?.find(version => version.id === selectedVersionId);
    if (savedVersion) state.cleanFingerprints.praise = JSON.stringify(dirtyComparableValue({song:saved,versionId:selectedVersionId||"",forms:savedVersion.forms||[]}));
  }
  if (!unchanged && getSelectedSong() === liveSong) {state.dirty.song=true;state.dirty.forms=true;}
  clearSearchCaches();
  return unchanged;
}


// Native lifecycle is enabled only after verified server-phase activation.
function singleSongRevisions(ids) {
  return Object.fromEntries([...new Set(ids)].sort().map(id=>[id,state.singleSongCatalog.get(id).revision]));
}
function singleSongGroup(id) {
  return [id,...(state.singleSongCatalog.get(id).relations?.same_song || [])];
}
async function mutateSingleSong(operation, input, scope) {
  const repository = state.singleSongRepository;
  if (!repository?.mutate) throw new Error("SINGLE_SONG_LIFECYCLE_REQUIRED");
  const result = await repository.mutate(operation,input,scope);
  if (repository !== state.singleSongRepository) throw new Error("SINGLE_SONG_REPOSITORY_CHANGED");
  const cached = new Map(state.singleSongCatalog.ids().map(id=>[id,state.singleSongCatalog.get(id)]));
  for (const id of result.deleted) cached.delete(id);
  for (const record of result.records) {
    if (!cached.has(record.id) || record.revision >= cached.get(record.id).revision) cached.set(record.id,record);
  }
  state.singleSongCatalog = globalThis.MindexSingleSong.createCatalog([...cached.values()]);
  // Relationship writes never replace an editor's lyrics or a late title edit.
  state.songs = state.songs.filter(song=>!result.deleted.includes(song.id));
  for (const record of result.records) {
    const fresh = state.singleSongCatalog.appSong(record.id), live = state.songs.find(song=>song.id===record.id);
    if (live) Object.assign(live,{same_song_ids:fresh.same_song_ids,related_song_ids:fresh.related_song_ids,_singleSongRevision:fresh._singleSongRevision});
    else state.songs.push(fresh);
  }
  state.songs.sort(sortSongs);clearSearchCaches();return result;
}
async function editSingleSongRelation(song, kind, targetId, remove = false) {
  if (!song?._singleSongRecord || state.saving) return;
  if (state.dirty.song || state.dirty.forms) {showToast("편집 중인 곡을 먼저 저장해 주세요.","info");return;}
  if (!["same_song","related"].includes(kind) || targetId===song.id) return;
  let members, affected;
  if (kind==="same_song") {
    if (remove && !singleSongGroup(song.id).includes(targetId)) return;
    affected=[...new Set([...singleSongGroup(song.id),...singleSongGroup(targetId)])];
    members=remove ? singleSongGroup(song.id).filter(id=>id!==targetId) : affected;
  } else {
    members=[...new Set(state.singleSongCatalog.get(song.id).relations?.related || [])].filter(id=>id!==targetId);
    if (!remove) members.push(targetId);
    affected=[song.id];
  }
  state.saving=true;updateSaveState();
  try {
    await mutateSingleSong(kind,{id:song.id,members,expectedRevisions:singleSongRevisions(affected)});
    if (!state.dirty.song && !state.dirty.forms) captureCleanFingerprint("praise");
    renderDetail();showToast("곡 관계를 저장했습니다.");
  } catch(error) {showToast(error.message,"error");}
  finally {state.saving=false;updateSaveState();}
}
async function deleteSingleSong(song) {
  if (state.saving || state.dirty.song || state.dirty.forms) {showToast("편집 중인 곡을 먼저 저장해 주세요.","info");return;}
  if (!canDeletePraiseSong(song)) {showToast("내용이 비어 있는 곡만 삭제할 수 있어요.","error");return;}
  if (!confirm(`“${song.title}”을 삭제할까요?`)) return;
  const before=JSON.stringify({song,forms:state.forms});state.saving=true;updateSaveState();
  try {
    await mutateSingleSong("delete",{id:song.id,expectedRevisions:singleSongRevisions(singleSongGroup(song.id))});
    if (state.selectedSongId===song.id && before!==JSON.stringify({song,forms:state.forms})) {
      state.songs.push(song);state.dirty.song=true;
      showToast("빈 곡은 삭제됐지만 대기 중 입력은 화면에 유지했습니다. 새 곡으로 복사해 주세요.","info");return;
    }
    if (state.selectedSongId===song.id) {state.selectedSongId=null;state.selectedVersionId=null;state.forms=[];captureCleanFingerprint("praise");}
    persistUiState();render();showToast("빈 곡을 삭제했습니다.");
  } catch(error) {showToast(error.message,"error");}
  finally {state.saving=false;updateSaveState();}
}
async function addSingleSongArrangement(song) {
  if (state.saving || state.dirty.song || state.dirty.forms) {showToast("편집 중인 곡을 먼저 저장해 주세요.","info");return;}
  const pending=state.singleSongRepository.pendingMutation?.(`arrangement:${song.id}`);
  const name=pending?.content?.name ?? prompt("새 버전 이름 (가사는 복사하고 음원은 별도로 등록)","새 버전");if (name===null) return;
  const source=state.singleSongCatalog.get(song.id);
  const metadata=structuredClone(source.metadata);
  for (const key of ["id","versions","related_song_ids","same_song_ids","_singleSongRecord","_singleSongRevision"]) delete metadata[key];
  // Match existing add-version behavior: new units, identical lyrics, no inherited audio/timing.
  const content=pending?.content || {name:name.trim()||"새 버전",raw_section_name:name.trim()||"새 버전",is_primary:true,
    praise_types:source.content.praise_types || source.metadata.praise_types,
    forms:(source.content.forms||[]).map(form=>({...structuredClone(form),id:createUuid()}))};
  state.saving=true;updateSaveState();
  try {
    const result=await mutateSingleSong("create",{baseId:song.id,metadata:pending?.metadata || metadata,content,
      expectedRevisions:pending?.expectedRevisions || singleSongRevisions(singleSongGroup(song.id))},`arrangement:${song.id}`);
    if (getSelectedSong()===song && !state.dirty.song && !state.dirty.forms) {
      state.selectedSongId=result.id;state.selectedVersionId=result.id;
      state.forms=normalizeForms(state.singleSongCatalog.get(result.id).content.forms);captureCleanFingerprint("praise");
    }
    persistUiState();render();showToast("별도 ID로 새 버전을 만들었습니다.");
  } catch(error) {showToast(error.message,"error");}
  finally {state.saving=false;updateSaveState();}
}
function renderSingleSongRelations(song) {
  if (!song?._singleSongRecord) return "";
  const options=state.songs.filter(row=>row.id!==song.id).map(row=>`<option value="${escapeAttr(row.id)}">${escapeHtml(row.title)} · ${escapeHtml(row.versions?.[0]?.name || "기본")} (${escapeHtml(row.id)})</option>`).join("");
  return `<details><summary>곡 관계 편집</summary><div data-single-relations>
    <select aria-label="연결할 곡">${options}</select>
    <button type="button" data-single-relation="same_song">같은 곡으로 묶기</button>
    <button type="button" data-single-relation="same_song" data-remove="true">같은 곡에서 분리</button>
    <button type="button" data-single-relation="related">관련 곡 연결</button>
    <button type="button" data-single-relation="related" data-remove="true">관련 곡 해제</button>
    <p>같은 곡: ${escapeHtml((song.same_song_ids||[]).map(id=>state.songs.find(row=>row.id===id)?.title||id).join(" · ")||"없음")}</p>
  </div></details>`;
}

// Release bootstrap checks server phase before enabling native storage.
let singleSongActivationPending = null;
async function ensureSingleSongActivation() {
  if (globalThis.MINDEX_SINGLE_SONG_BOOTSTRAP_READY !== true || !state.client) return false;
  const client = state.client;
  if (state.singleSongRepository) {
    if (state.singleSongClient !== client) throw new Error("연결이 변경되었습니다. 입력을 보존한 뒤 앱을 다시 열어 주세요.");
    return true;
  }
  if (singleSongActivationPending) {
    if (singleSongActivationPending.client !== client) throw new Error("PRAISE_STORAGE_CLIENT_CHANGED");
    return singleSongActivationPending.promise;
  }
  const promise = (async () => {
    const prepared = await globalThis.MindexSingleSong.loadActivation(client);
    if (state.client !== client) throw new Error("PRAISE_STORAGE_CLIENT_CHANGED");
    if (prepared.phase === 'legacy') return false;
    if (state.saving || Object.values(state.dirty || {}).some(Boolean)) throw new Error("미저장 입력을 보존한 뒤 다시 열어 주세요.");
    const catalog = globalThis.MindexSingleSong.createCatalog(prepared.records);
    state.singleSongStorage = 'native';
    state.singleSongCatalog = catalog;
    state.singleSongRepository = prepared.repository;
    state.singleSongClient = client;
    state.songs = catalog.ids().map(id => catalog.appSong(id));
    state.selectedSongId = state.selectedVersionId = null;
    state.forms = [];
    clearSearchCaches();
    return true;
  })();
  singleSongActivationPending = {client,promise};
  try { return await promise; }
  finally { if (singleSongActivationPending?.promise === promise) singleSongActivationPending = null; }
}

function installSingleSongSession(records, repository, {worshipStorage = "native"} = {}) {
  if (!["localhost", "127.0.0.1", "[::1]"].includes(location.hostname)) {
    throw new Error("SINGLE_SONG_LOCAL_VERIFICATION_ONLY");
  }
  if (!repository || typeof repository.read !== "function" || typeof repository.save !== "function") {
    throw new Error("SINGLE_SONG_REPOSITORY_REQUIRED");
  }
  const catalog = globalThis.MindexSingleSong.createCatalog(records);
  if (!["native", "legacy"].includes(worshipStorage)) throw new Error("INVALID_SINGLE_SONG_STORAGE");
  state.singleSongStorage = worshipStorage;
  state.singleSongCatalog = catalog;
  state.singleSongRepository = repository;
  state.songs = catalog.ids().map(id => catalog.appSong(id));
  clearSearchCaches();
}

async function readSingleSongs(ids) {
  const repository = state.singleSongRepository;
  const uniqueIds = [...new Set(ids)];
  const rows = [];
  // Bound each read: the full native catalogue exceeds the hosted SQL timeout.
  for (let at = 0; at < uniqueIds.length; at += 100) {
    rows.push(...await repository.read(uniqueIds.slice(at, at + 100)));
  }
  const catalog = globalThis.MindexSingleSong.createCatalog(rows);
  if (ids.some(id => !catalog.ids().includes(id))) throw new Error("SONG_REFERENCE_MISSING");
  if (repository !== state.singleSongRepository) throw new Error("SINGLE_SONG_REPOSITORY_CHANGED");
  const cached = new Map(state.singleSongCatalog.ids().map(id => [id, state.singleSongCatalog.get(id)]));
  for (const row of rows) {
    if (!cached.has(row.id) || row.revision >= (cached.get(row.id).revision ?? -1)) cached.set(row.id, row);
  }
  state.singleSongCatalog = globalThis.MindexSingleSong.createCatalog([...cached.values()]);
  return ids.map(id => state.singleSongCatalog.appSong(id));
}


// Display projection only: never put a group object into state.songs or persistence.
function praiseDisplayGroups() {
  return globalThis.MindexSingleSong.groupSongs(state.songs.filter(isSelectablePraiseSong));
}
function praiseDisplayGroup(song) {
  return praiseDisplayGroups().find(group => group.members.some(row => row.id === song?.id))
    || {id:song?.id, representative:song, members:song ? [song] : []};
}
function groupPraiseSongs(matches, preferRepresentative = false) {
  const groups = praiseDisplayGroups(), byId = new Map();
  for (const group of groups) for (const member of group.members) byId.set(member.id, group);
  const seen = new Set(), matching = new Map(matches.map(song=>[song.id,song]));
  return matches.flatMap(song => {
    const group = byId.get(song.id); if (!group || group.members.length < 2) return [song];
    if (seen.has(group.id)) return []; seen.add(group.id);
    const selected = preferRepresentative ? matching.get(group.id) || song : song;
    return [{...selected, _praiseGroupIds:group.members.map(row=>row.id),
      hymn_no:group.representative.hymn_no, _praiseGroupTitle:group.representative.title, _praiseGroupRepresentative:group.representative,
      _praiseGroupCount:group.members.length}];
  });
}
function praiseGroupIsSelected(song) {
  return song.id === state.selectedSongId || song._praiseGroupIds?.includes(state.selectedSongId);
}
function praiseGroupTitle(song) {
  const representative = praiseDisplayGroup(song).representative || song;
  return (representative.hymn_no ? stripHymnNumber(representative.title) : representative.title) || "제목 없는 찬양";
}
function praiseVariantLabel(song, peers) {
  const name = versionDisplayName(song, song.versions?.[0] || {});
  const repeated = peers.filter(row=>versionDisplayName(row,row.versions?.[0]||{})===name).length > 1;
  if (!repeated) return name;
  const detail = song.versions?.[0]?.output_title || song.title;
  return `${name} · ${detail}${peers.filter(row => (row.versions?.[0]?.output_title || row.title) === detail).length > 1 ? ` · ${peers.findIndex(row=>row.id===song.id)+1}` : ""}`;
}
function renderSingleSongVersionPicker(song) {
  if (!song?._singleSongRecord) return "";
  const peers = praiseDisplayGroup(song).members;
  if (peers.length < 2) return "";
  return `<label class="field compact single-song-version-picker"><span>판본</span><select data-single-version-select aria-label="곡 판본">${peers.map(row => `<option value="${escapeAttr(row.id)}"${row.id === song.id ? " selected" : ""}>${escapeHtml(praiseVariantLabel(row,peers))}</option>`).join("")}</select></label>`;
}
async function selectSingleSongVersion(field) {
  const song = getSelectedSong(), id = field.value;
  if (!song?._singleSongRecord || !praiseDisplayGroup(song).members.some(row=>row.id===id)) { field.value = song?.id || ""; return; }
  try { await selectSong(id); }
  finally { if (field.isConnected) field.value = getSelectedSong()?.id || ""; }
}

function renderNativeVersionHeading(song, version) {
  const title = String(version?.output_title || song.title || "").trim();
  return title && (song.hymn_no ? stripHymnNumber(title) : title) !== praiseGroupTitle(song)
    ? `<span class="version-title-text">${escapeHtml(title)}</span>` : "";
}
function renderNativeVersionMetadata(song) {
  if (!song?._singleSongRecord) return "";
  const version = song.versions[0];
  return `<div class="metadata-popover-grid">
    ${praiseDisplayGroup(song).members.length > 1 || !isDefaultVersionName(versionEditableName(song,version)) ? `<label class="field compact"><span>판본 이름</span><input data-version-name-field="${escapeAttr(version.id)}" value="${escapeAttr(versionEditableName(song,version))}" aria-label="버전 이름" /></label>` : ""}
    <label class="field compact"><span>다른 출력 제목</span><input data-version-output-title-field="${escapeAttr(version.id)}" value="${escapeAttr(version.output_title || "")}" placeholder="비워 두면 이 판본의 곡 제목 사용" aria-label="버전 전용 제목" /></label>
  </div>`;
}
function renderServicePraiseGroupChoice(song,index) {
  const item = getServiceItems(state.selectedServiceId)[index] || {}, service = selectedServiceForEditor();
  const peers = praiseDisplayGroup(song).members.filter(row =>
    (!serviceItemRequiresNewHymnalScoreSong(item) || serviceSongHasScore(row))
    && serviceSelectableSongVersions(row,item,service).length);
  if (peers.length < 2) return peers.length ? renderServiceSongPickerResult(peers[0],index) : "";
  return `<details class="svc-song-group-choice"><summary>${escapeHtml(praiseGroupTitle(song))} · ${peers.length}개 판본</summary>
    ${peers.map(row => `<button class="svc-song-picker-result" type="button" data-service-song-select="${escapeAttr(row.id)}" data-service-song-index="${index}" role="option"><strong>${escapeHtml(praiseVariantLabel(row,peers))}</strong>${row.title !== song._praiseGroupTitle ? `<span>${escapeHtml(row.title)}</span>` : ""}</button>`).join("")}</details>`;
}

function getGlobalPraiseResults(tokens) {
  if (!tokens.length) return [];
  const matches = state.songs.filter(isSelectablePraiseSong)
    .map(song => ({song, match:getSongSearchMatch(song,tokens,{includeLyrics:true,crossFields:true})}))
    .filter(entry=>entry.match)
    .sort((a,b)=>b.match.score-a.match.score || sortSongsForCurrentList(a.song,b.song));
  const byId = new Map(matches.map(entry=>[entry.song.id,entry.match]));
  return groupPraiseSongs(matches.map(entry=>entry.song)).slice(0,8).map(song=>({song,match:byId.get(song.id)}));
}

function praiseGroupSearchMatches(tokens, options) {
  const matches = new Map();
  for (const group of praiseDisplayGroups()) {
    const best = group.members.map(song=>getSongSearchMatch(song,tokens,options)).filter(Boolean)
      .sort((a,b)=>b.score-a.score)[0];
    if (best) for (const song of group.members) matches.set(song.id,best);
  }
  return matches;
}
