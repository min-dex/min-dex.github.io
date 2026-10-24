/* Single-record Praise boundary. No implicit activation, network or storage writes. */
(function(root) {
  'use strict';
  const copy = value => structuredClone(value);
  const code = value => /^(?:knh|kth|ccm|kid)-\d{3,}(?:-\d{3})?$/.test(String(value || ''));
  const fail = message => { throw new Error(message); };
  function fromLegacySong(song, version, id) {
    if (!code(id) || !song?.id || !version?.id) fail('INVALID_SINGLE_SONG_MAPPING');
    const metadata = copy(song), content = copy(version);
    delete metadata.id; delete metadata.versions;
    for (const key of ['_singleSongRecord','_singleSongRevision','same_song_ids','related_song_ids']) delete metadata[key];
    for (const key of ['_singleSongRecord','_legacyTimingKey','_legacyVersionId']) delete content[key];
    for (const key of ['id', 'canonical_song_id', 'source_song_id']) delete content[key];
    return { id, metadata, content, legacy: { songId: song.id, versionId: version.id,
      canonicalId: version.canonical_song_id || null,
      timingKey: JSON.stringify([String(song.id), String(version.id)]) } };
  }
  function createCatalog(records) {
    const byId = new Map(), versions = new Map(), songs = new Map();
    function add(map, id, record) {
      if (!id) return;
      if (!map.has(id)) map.set(id, new Set());
      map.get(id).add(record.id);
    }
    for (const input of records) {
      if (!code(input.id) || byId.has(input.id) || !input.content || !input.metadata) fail('INVALID_SINGLE_SONG_RECORD');
      const r = copy(input); byId.set(r.id, r);
      add(versions, r.legacy?.versionId, r);
      add(songs, r.legacy?.songId, r); add(songs, r.legacy?.canonicalId, r);
    }
    function unique(ids) {
      if (!ids?.size) fail('SONG_REFERENCE_MISSING');
      if (ids.size !== 1) fail('SONG_REFERENCE_AMBIGUOUS');
      return [...ids][0];
    }
    function resolve(songId, versionId = null) {
      if (!songId && !versionId) return null;
      if (code(songId)) {
        if (!byId.has(songId)) fail('SONG_REFERENCE_MISSING');
        if (versionId && versionId !== songId && unique(versions.get(versionId)) !== songId) fail('SONG_REFERENCE_MISMATCH');
        return songId;
      }
      if (versionId) {
        const id = byId.has(versionId) ? versionId : unique(versions.get(versionId));
        if (songId && !songs.get(songId)?.has(id)) fail('SONG_REFERENCE_MISMATCH');
        return id;
      }
      return unique(songs.get(songId));
    }
    function get(id) {
      if (!byId.has(id)) fail('SONG_REFERENCE_MISSING');
      return copy(byId.get(id));
    }
    function appSong(id) {
      const r = get(id);
      return { ...r.metadata, id, _singleSongRecord: true, _singleSongRevision: r.revision,
        same_song_ids: copy(r.relations?.same_song || []),
        related_song_ids: copy(r.relations?.related || r.metadata.related_song_ids || []),
        versions: [{ ...r.content, id, _singleSongRecord: true, _legacyTimingKey: r.legacy?.timingKey || null, _legacyVersionId: r.legacy?.versionId || null }] };
    }
    function singleItem(input) {
      const item = copy(input);
      if (item.praise_record_id && (item.song_id || item.version_id || item.song_version_id)) fail('SONG_REFERENCE_MISMATCH');
      const id = resolve(item.praise_record_id || item.song_id, item.version_id || item.song_version_id);
      item.song_id = id;
      delete item.version_id; delete item.song_version_id; delete item.praise_record_id;
      return item;
    }
    // Existing atomic backend compatibility ONLY: never send a short code to a UUID FK.
    function legacyElement(input) {
      const item = copy(input);
      if (!item.song_id) return item;
      const r = get(resolve(item.song_id, item.version_id || item.song_version_id));
      if (!r.legacy?.songId || !r.legacy?.versionId) fail('SINGLE_SONG_BACKEND_REQUIRED');
      item.song_id = r.legacy.songId; item.song_version_id = r.legacy.versionId;
      delete item.version_id;
      return item;
    }
    function nativeElement(input) {
      const item = copy(input), id = resolve(item.song_id, item.version_id || item.song_version_id);
      item.praise_record_id = id; item.song_id = null; item.song_version_id = null;
      delete item.version_id; return item;
    }
    function sourceFields(input) {
      const fields = copy(input);
      if (!fields.songId && !fields.versionId) return fields;
      fields.songId = resolve(fields.songId, fields.versionId);
      delete fields.versionId;
      return fields;
    }
    return Object.freeze({ get, resolve, appSong, singleItem, legacyElement, nativeElement, sourceFields,
      ids: () => [...byId.keys()] });
  }
  // Transport must supply a single-record CAS transaction; no direct-table fallback.
  function createRepository(transport) {
    if (typeof transport?.read !== 'function' || typeof transport?.commit !== 'function') fail('SINGLE_SONG_TRANSPORT_REQUIRED');
    const pending = new Map(), mutations = new Map();
    async function read(ids) {
      const rows = await transport.read([...new Set(ids)]);
      const catalog = createCatalog(rows);
      if (ids.some(id => !catalog.ids().includes(id))) fail('SONG_REFERENCE_MISSING');
      if (rows.some(r => !Number.isSafeInteger(r.revision) || r.revision < 0)) fail('SONG_REVISION_MISSING');
      return copy(rows);
    }
    async function save(record) {
      createCatalog([record]);
      if (!Number.isSafeInteger(record.revision) || record.revision < 0) fail('SONG_REVISION_MISSING');
      const frozen = copy(record), signature = JSON.stringify(frozen);
      let job = pending.get(record.id);
      if (job && job.signature !== signature) fail('SONG_SAVE_OUTCOME_UNKNOWN');
      if (!job) {
        job = {signature, request: {requestId: root.crypto.randomUUID(), expectedRevision: record.revision, record:frozen}, promise:null};
        pending.set(record.id, job);
      }
      if (job.promise) return job.promise;
      job.promise = (async () => {
        const saved = await transport.commit(copy(job.request));
        if (saved?.id !== record.id || saved?.revision !== record.revision + 1) fail('SONG_COMMIT_ACK_INVALID');
        createCatalog([saved]); pending.delete(record.id); return copy(saved);
      })();
      try { return await job.promise; }
      catch (error) {
        job.promise = null;
        if (/SINGLE_SONG_CONFLICT|SINGLE_SONG_REQUEST_REUSED|INVALID_SINGLE_SONG/.test(error.message)) pending.delete(record.id);
        throw error;
      }
    }
    async function mutate(operation, input, scope = input.id || 'create') {
      if (typeof transport.mutate !== 'function') fail('SINGLE_SONG_LIFECYCLE_REQUIRED');
      const frozen = copy(input), signature = JSON.stringify({operation,input:frozen});
      let job = mutations.get(scope);
      if (job && job.signature !== signature) fail('SONG_MUTATION_OUTCOME_UNKNOWN');
      if (!job) {
        job = {signature,request:{...frozen,operation,protocolVersion:1,requestId:root.crypto.randomUUID()},promise:null};
        mutations.set(scope,job);
      }
      if (job.promise) return job.promise;
      job.promise = (async()=>{
        const result = await transport.mutate(copy(job.request));
        if (!Array.isArray(result?.records) || !Array.isArray(result?.deleted)
          || result.records.some(r=>!Number.isSafeInteger(r.revision)||r.revision<1)
          || result.deleted.some(id=>!code(id))) fail('SONG_MUTATION_ACK_INVALID');
        createCatalog(result.records);
        if (operation==='create' && !result.records.some(r=>r.id===result.id)) fail('SONG_MUTATION_ACK_INVALID');
        if (operation==='delete' && !result.deleted.includes(input.id)) fail('SONG_MUTATION_ACK_INVALID');
        mutations.delete(scope);return copy(result);
      })();
      try { return await job.promise; }
      catch(error) {
        job.promise=null;
        if (/SINGLE_SONG_(?:CONFLICT|GRAPH_CONFLICT|REQUEST_REUSED|MISSING|NOT_EMPTY|IN_USE|CREATED_THEN_REMOVED|SUFFIX_EXHAUSTED)|INVALID_SINGLE_SONG/.test(error.message)) mutations.delete(scope);
        throw error;
      }
    }
    return Object.freeze({read,save,mutate,pendingMutation:scope => mutations.has(scope) ? copy(mutations.get(scope).request) : null,pendingRecord:id => pending.has(id) ? copy(pending.get(id).request.record) : null});
  }
  function createRpcRepository(client) {
    async function rpc(name, args) {
      const response = await client.rpc(name, args);
      if (response.error) throw new Error(response.error.message || 'SINGLE_SONG_RPC_FAILED');
      return response.data;
    }
    return createRepository({
      read: ids => rpc('get_single_praise_records_v1', {ids}),
      commit: req => rpc('save_single_praise_record_v1', {req}),
      mutate: req => rpc('mutate_single_praise_v1', {req}),
    });
  }
  // Read-only bootstrap. A missing rollout RPC is the only legacy fallback.
  async function loadActivation(client) {
    const statusResponse = await client.rpc('get_praise_storage_status_v1');
    if (statusResponse.error) {
      if (statusResponse.error.code === 'PGRST202' && /get_praise_storage_status_v1/.test(statusResponse.error.message || '')) return {phase:'legacy',records:[]};
      fail('PRAISE_STORAGE_STATUS_UNAVAILABLE');
    }
    const status = statusResponse.data;
    if (status?.protocol !== 1 || !['legacy','maintenance','native'].includes(status.phase)) fail('PRAISE_STORAGE_PROTOCOL_UNSUPPORTED');
    if (status.phase === 'legacy') return {phase:'legacy',records:[]};
    if (status.phase === 'maintenance') fail('찬양 저장소 전환 중입니다. 잠시 후 다시 열어 주세요.');
    if (!Number.isSafeInteger(status.recordCount) || status.recordCount < 1 || typeof status.epoch !== 'string' || typeof status.manifest !== 'string') fail('INVALID_CATALOG_MANIFEST');
    const records = [], seen = new Set(); let after = null;
    while (records.length < status.recordCount) {
      const response = await client.rpc('get_single_praise_catalog_page_v1', {after_id:after,page_size:200,expected_epoch:status.epoch,expected_manifest:status.manifest});
      if (response.error) fail('PRAISE_STORAGE_CHANGED');
      const page = response.data;
      if (page?.epoch !== status.epoch || page.manifest !== status.manifest || !Array.isArray(page.records) || !page.records.length || page.records.length > 200) fail('INVALID_CATALOG_PAGE');
      for (const r of page.records) {
        if (!code(r.id) || seen.has(r.id) || (after !== null && r.id <= after)) fail('INVALID_CATALOG_PAGE');
        seen.add(r.id);records.push(r);after=r.id;
      }
      if (page.after !== after || records.length > status.recordCount) fail('INVALID_CATALOG_PAGE');
    }
    const final = await client.rpc('get_praise_storage_status_v1');
    if (final.error || final.data?.phase !== 'native' || final.data.epoch !== status.epoch || final.data.manifest !== status.manifest || final.data.recordCount !== records.length) fail('PRAISE_STORAGE_CHANGED');
    createCatalog(records); // Validate before any caller replaces its visible state.
    return {phase:'native',records,status,repository:createRpcRepository(client)};
  }
  function parseMemo(value) {
    if (value && typeof value === 'object') return copy(value);
    if (!value) return {};
    try { return JSON.parse(value); } catch { return null; }
  }
  // Only named reference fields are rewritten. Lyrics, URLs, timing arrays and prose stay byte-identical.
  function rewriteStructured(value, catalog) {
    const pending = [];
    function visit(input, path) {
      if (Array.isArray(input)) return input.map((v, i) => visit(v, `${path}/${i}`));
      if (!input || typeof input !== 'object') return input;
      const out = copy(input);
      for (const [sk, vk] of [['song_id','song_version_id'], ['songId','versionId']]) {
        const alias = sk === 'song_id' ? 'version_id' : 'songVersionId';
        if (!out[sk] && !out[vk] && !out[alias]) continue;
        try {
          if (out[vk] && out[alias] && catalog.resolve(null, out[vk]) !== catalog.resolve(null, out[alias])) fail('SONG_REFERENCE_MISMATCH');
          out[sk] = catalog.resolve(out[sk], out[vk] || out[alias]);
          delete out[vk]; delete out[alias];
        } catch (e) { pending.push({path, reason:e.message}); }
      }
      for (const [k, v] of Object.entries(out)) if (v && typeof v === 'object') out[k] = visit(v, `${path}/${k}`);
      return out;
    }
    return {value:visit(value, ''), pending};
  }
  // A source block is an independent selection; never borrow another block's version.
  function rewriteSource(text, catalog) {
    const eol = text.includes('\r\n') ? '\r\n' : '\n';
    const lines = text.split(eol), pending = [], out = [];
    let block = [];
    function flush() {
      if (!block.length) return;
      const song = block.map((s,i)=>({i,m:s.match(/^-\s*곡 ID:\s*(\S+)\s*$/i)})).filter(x=>x.m);
      const version = block.map((s,i)=>({i,m:s.match(/^-\s*버전 ID:\s*(\S+)\s*$/i)})).filter(x=>x.m);
      if (song.length || version.length) {
        try {
          if (song.length>1 || version.length>1) fail('DUPLICATE_SOURCE_REFERENCE');
          const id=catalog.resolve(song[0]?.m[1],version[0]?.m[1]);
          const at=song[0]?.i ?? version[0].i;
          block=block.flatMap((s,i)=>i===at ? [`- 곡 ID: ${id}`] : version.some(x=>x.i===i) ? [] : [s]);
        } catch(e) {pending.push({line:out.length+1,reason:e.message});}
      }
      out.push(...block);block=[];
    }
    for (const line of lines) { if (/^\[/.test(line)) flush(); block.push(line); }
    flush(); return {text:out.join(eol),pending};
  }
  const api = Object.freeze({isId:code,fromLegacySong,createCatalog,createRepository,createRpcRepository,loadActivation,rewriteStructured,rewriteSource,parseMemo});
  root.MindexSingleSong=api;
  if (typeof module!=='undefined' && module.exports) module.exports=api;
})(typeof globalThis!=='undefined' ? globalThis : this);
