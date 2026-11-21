// Youth templates use the existing shared app-state RPC; older departments retain their table.
const pending = new WeakMap();
const storageKey = key => 'mindex.bulletin.template.v1:' + key;
const validRevision = value => typeof value === 'string' && /^[1-9][0-9]*$/.test(value)
  && BigInt(value) <= BigInt(Number.MAX_SAFE_INTEGER);
export async function readTemplate(client, key) {
  const {data, error} = await client.rpc('mindex_state_read_v1', {p_token:'', p_scope:'shared'});
  if (error) throw error;
  if (!Array.isArray(data)) throw Error('공통 양식 응답을 확인해 주세요.');
  const rows = data.filter(row => row.key === storageKey(key));
  if (rows.length > 1) throw Error('공통 양식 응답이 중복되었습니다.');
  const row = rows[0];
  if (!row || row.value === null) return null;
  if (!validRevision(row.revision) || typeof row.value !== 'string') throw Error('공통 양식 응답을 확인해 주세요.');
  const requests=pending.get(client),request=requests?.get(key);
  if(request&&BigInt(row.revision)>BigInt(request.p_revision))requests.delete(key);
  const value = JSON.parse(row.value);
  if (value.template_key !== key) throw Error('공통 양식의 연결을 확인해 주세요.');
  return {...value, revision:Number(row.revision)};
}
export async function writeTemplate(client, key, value, revision) {
  if (!Number.isSafeInteger(revision) || revision < 0) throw Error('공통 양식 저장 버전을 확인해 주세요.');
  let requests = pending.get(client);
  if (!requests) {requests = new Map(); pending.set(client, requests);}
  const serialized = JSON.stringify({template_key:key, ...value});
  let request = requests.get(key);
  if (request && (request.p_value !== serialized || request.p_revision !== String(revision))) {
    throw Error('이전 공통 양식 저장 결과를 먼저 확인해 주세요. 입력은 유지됩니다.');
  }
  request ||= {p_token:'', p_scope:'shared', p_key:storageKey(key), p_value:serialized,
    p_revision:String(revision), p_request_id:crypto.randomUUID()};
  requests.set(key, request);
  const {data, error} = await client.rpc('mindex_state_write_v1', request);
  if (error) {
    if (error.message === 'STATE_REVISION_CONFLICT') {
      const latest = await readTemplate(client, key);
      if (latest) {
        const {revision:currentRevision, ...saved} = latest;
        if (JSON.stringify(saved) === serialized) {requests.delete(key); return latest;}
      }
      requests.delete(key);
      throw Error('다른 곳에서 공통 양식을 변경했습니다. 편집 내용은 유지됩니다.');
    }
    throw error;
  }
  if (data?.key !== request.p_key || data.value !== serialized || data.requestId !== request.p_request_id
    || !validRevision(data.revision) || BigInt(data.revision) !== BigInt(revision) + 1n) {
    throw Error('공통 양식 저장 결과를 확인하지 못했습니다. 입력은 유지됩니다.');
  }
  requests.delete(key);
  return {...JSON.parse(serialized), revision:Number(data.revision)};
}
