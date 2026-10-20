/* Read-only, version-owned score measurements. Never supplies a song form. */
(function (root) {
  'use strict';
  let pending;
  const formatMeasures = value => Number(value.toFixed(2)).toString();
  function load() {
    if (!pending) pending = fetch('./mindex.hymn-structure.runtime.json', {cache:'no-cache'})
      .then(response => { if (!response.ok) throw Error('Measure metadata unavailable'); return response.json(); })
      .then(data => { if (data.schemaVersion !== 1 || !data.records) throw Error('Invalid measure metadata'); return data.records; })
      .catch(error => { pending = null; throw error; });
    return pending;
  }
  async function textHash(text) {
    const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(text || '')));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2,'0')).join('');
  }
  async function describe(versionId, forms, records) {
    const record = (records || await load())[versionId];
    if (!record) return {status:'unreviewed',text:'마디: 미확인'};
    const current = forms || [];
    const hashes = await Promise.all(current.map(async form => [form.id, await textHash(form.lyrics ?? form.text)]));
    const byId = new Map(hashes);
    if (current.length !== record.parts.length || byId.size !== record.parts.length || record.parts.some(part => byId.get(part.unitId) !== part.textSha256 || (current.find(form => form.id === part.unitId)?.part_type && current.find(form => form.id === part.unitId).part_type !== part.kind))) {
      return {status:'stale',text:'마디: 가사가 바뀌어 재검토 필요'};
    }
    if (record.reviewStatus === 'stored_structure_mismatch') return {status:'structure-review',text:`마디: 악보 각 절 ${formatMeasures(record.stanzaApproxMeasures)} · 블록 ${record.scoreApproxMeasuresByBlock.map(formatMeasures).join('+')} · 저장 가사 구조 확인 필요`};
    if (record.reviewStatus === 'recitative_exception') return {status:'recitative',text:'마디: 낭송형 · 일정한 마디 구분 없음'};
    const patterns = [...new Set(record.parts.filter(part => part.kind === 'Verse' && part.approxMeasuresByBlock).map(part => part.approxMeasuresByBlock.map(formatMeasures).join('+')))];
    const chorus = [...new Set(record.parts.filter(part => part.kind === 'Chorus' && part.approxMeasures != null).map(part => part.approxMeasures))];
    const coda = [...new Set(record.parts.filter(part => part.kind === 'Coda' && part.approxMeasures != null).map(part => part.approxMeasures))];
    const unmeasured = record.parts.some(part => part.approxMeasures == null && part.blockCount > 0);
    return {status:'measured',text:`마디: 본절 약 ${formatMeasures(record.stanzaApproxMeasures)} · 블록 ${patterns.join(' / ')}${chorus.length ? ` · 후렴 약 ${chorus.map(formatMeasures).join('/')}` : ''}${coda.length ? ` · 아멘·Coda 약 ${coda.map(formatMeasures).join('/')}` : ''}${record.displayNote ? ` · ${record.displayNote}` : ''}${unmeasured ? ' · 기타 구간 미확인' : ''}`};
  }
  root.MindexHymnStructure = {describe};
})(globalThis);
