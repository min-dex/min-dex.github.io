const assert = require('node:assert/strict');
const api = require('../mindex.single-song.js');

function fixtureRecords(prefix, size) {
  return Array.from({length:size}, (_, i) => {
    const id = `SONG-${prefix}${String(i+1).padStart(prefix.startsWith('CONT') ? 4 : 3, '0')}-0001`;
    return {id, revision:1, metadata:{title:id}, content:{name:'원본', forms:[], text:'fixture'.repeat(900)}, relations:{same_song:[], related:[]}};
  });
}
const original = [...fixtureRecords('CONT-', 510), ...fixtureRecords('HYMN-N', 645), ...fixtureRecords('HYMN-T', 558)];
const clone = structuredClone;
function mock(records, {indexed=true, mode='', epoch='1'} = {}) {
  const status = {phase:'native', protocol:1, idFormat:'4-4-4-4', epoch, manifest:'current', recordCount:records.length};
  if (indexed) status.catalogIndex = 1;
  const byId = new Map(records.map(row => [row.id, row]));
  const calls = [], client = {calls, bytes:0, peak:0};
  let active = 0, statuses = 0;
  client.rpc = async (name, args) => {
    calls.push({name,args});
    const data = value => { client.bytes += Buffer.byteLength(JSON.stringify(value)); return {data:clone(value)}; };
    if (name === 'get_praise_storage_status_v1') {
      statuses++;
      return data({...status, manifest:mode === 'drift' && statuses > 1 ? 'later' : status.manifest});
    }
    if (name === 'get_praise_catalog_index_v1') {
      if (mode === 'missing-index') return {error:{code:'PGRST202'}};
      const entries = records.map(row => [row.id,row.revision]);
      if (mode === 'duplicate') entries[1] = entries[0];
      return data({epoch,manifest:status.manifest,entries});
    }
    if (name === 'get_single_praise_records_v1') {
      active++;
      client.peak = Math.max(client.peak, active);
      try {
        await new Promise(resolve => setImmediate(resolve));
        if (mode === 'timeout' && args.ids.length > 25) return {error:{code:'57014'}};
        const rows = args.ids.map(id => byId.get(id));
        if (mode === 'wrong-revision') rows[0] = {...rows[0],revision:99};
        return data(rows);
      } finally { active--; }
    }
    assert.equal(active, 0, 'fallback overlapped unfinished indexed workers');
    assert.equal(name, 'get_single_praise_catalog_page_v1');
    const rows = records.filter(row => !args.after_id || row.id > args.after_id).slice(0,args.page_size);
    return data({epoch,manifest:status.manifest,records:rows,after:rows.at(-1)?.id ?? null});
  };
  return client;
}
const byId = client => client.calls.filter(call => call.name === 'get_single_praise_records_v1').flatMap(call => call.args.ids);
(async () => {
  const cold = mock(original), old = mock(original, {indexed:false});
  const [indexed, paged] = await Promise.all([api.loadActivation(cold), api.loadActivation(old)]);
  assert.deepEqual(indexed.records, paged.records);
  assert.deepEqual(byId(cold), original.map(row => row.id));
  assert.equal(cold.peak, 3);
  assert.ok(cold.bytes < old.bytes, 'index must recover more bytes than the range overlap');

  const changed = clone(original.slice(1));
  changed[0].revision++;
  changed[0].content.text = '바뀐 원문';
  changed.push(...fixtureRecords('HYMN-T', 1).map(row => ({...row,id:'SONG-HYMN-T558-0002'})));
  let saved = {status:{...indexed.status,manifest:'previous'},records:indexed.records};
  global.MindexCatalogCache = {
    read: async (client,status,options) => { assert.equal(options.allowPrevious,true); return saved; },
    write: async (client,prepared) => { saved = clone({status:prepared.status,records:prepared.records}); },
    remove: async () => {},
  };
  const delta = mock(changed);
  const result = await api.loadActivation(delta,{persistent:true});
  assert.deepEqual(result.records, changed);
  assert.deepEqual(byId(delta), [changed[0].id, changed.at(-1).id]);
  assert.equal(delta.calls.length, 4);
  assert.equal(saved.status.manifest, 'current');
  for (const mode of ['missing-index','duplicate','wrong-revision','timeout']) {
    const client = mock(original,{mode});
    assert.deepEqual((await api.loadActivation(client)).records,original);
    assert.ok(client.peak <= 3);
    if (mode === 'timeout') assert.ok(client.calls.some(call => call.args?.ids?.length === 25));
    else assert.ok(client.calls.some(call => call.name === 'get_single_praise_catalog_page_v1'));
  }
  await assert.rejects(api.loadActivation(mock(original,{mode:'drift'})), /PRAISE_STORAGE_CHANGED/);
  console.log(JSON.stringify({result:'PASS',records:original.length,changed:byId(delta).length,coldBytes:{paged:old.bytes,indexed:cold.bytes},deltaBytes:delta.bytes}));
})().catch(error => { console.error(error); process.exitCode=1; });
