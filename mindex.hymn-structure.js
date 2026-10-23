/* Read-only, version-owned score measurements. Never supplies a song form. */
(function (root) {
  'use strict';
  let pending;
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
    if (record.reviewStatus === 'recitative_exception') return {status:'recitative',text:'마디: 낭송형 · 일정한 마디 구분 없음'};
    // Compare actual lyric slides, never stanza totals or playback form repeats.
    const approx = value => Math.max(1, Math.round(value));
    const range = values => {
      const numbers = [...new Set(values.map(approx))].sort((a,b) => a-b);
      return numbers.length === 1 ? String(numbers[0]) : `${numbers[0]}–${numbers.at(-1)}`;
    };
    const body = record.parts.filter(part => part.kind !== 'Coda').flatMap(part => part.approxMeasuresByBlock || []);
    const coda = record.parts.filter(part => part.kind === 'Coda').flatMap(part => part.approxMeasuresByBlock || []);
    const unmeasured = record.parts.some(part => !part.approxMeasuresByBlock && part.blockCount > 0);
    const labels = [];
    if (body.length) labels.push(`슬라이드당 약 ${range(body)}마디`);
    if (coda.length) labels.push(`아멘·Coda 별도 · 약 ${range(coda)}마디`);
    if (unmeasured) labels.push('일부 구간 미확인');
    return {status:'measured',text:labels.join(' / ') || '마디: 미확인'};
  }
  root.MindexHymnStructure = {describe};
})(globalThis);
