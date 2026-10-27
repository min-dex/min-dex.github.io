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
    if (current.length !== record.parts.length || byId.size !== record.parts.length || record.parts.some(part => (byId.get(part.unitId) !== part.textSha256 && (!part.displayTextSha256 || byId.get(part.unitId) !== part.displayTextSha256)) || (current.find(form => form.id === part.unitId)?.part_type && current.find(form => form.id === part.unitId).part_type !== part.kind))) {
      return {status:'stale',text:'마디: 가사가 바뀌어 재검토 필요'};
    }
    if (record.reviewStatus === 'recitative_exception') return {status:'recitative',text:'마디: 낭송형 · 일정한 마디 구분 없음'};
    // Compare actual lyric slides, never stanza totals or playback form repeats.
    const approx = value => Math.max(1, Math.round(value));
    const typical = values => {
      const counts = new Map();
      for (const value of values.map(approx)) counts.set(value, (counts.get(value) || 0) + 1);
      // A shorter closing phrase does not turn the ordinary slide size into a range.
      return [...counts].sort((a,b) => b[1]-a[1] || b[0]-a[0])[0][0];
    };
    // Repeated verses do not make their layout more representative than a refrain.
    // Compare one copy of each musical section layout, independent of stanza count.
    const layouts = new Map();
    for (const part of record.parts.filter(part => part.kind !== 'Coda')) {
      const measures = part.approxMeasuresByBlock || [];
      const key = JSON.stringify([part.kind, measures.map(approx)]);
      if (!layouts.has(key)) layouts.set(key, measures);
    }
    const body = [...layouts.values()].flat();
    const coda = record.parts.filter(part => part.kind === 'Coda').flatMap(part => part.approxMeasuresByBlock || []);
    const unmeasured = record.parts.some(part => !part.approxMeasuresByBlock && part.blockCount > 0);
    const labels = [];
    const displayed = body.length ? body : coda;
    if (displayed.length) labels.push(`approx. ${typical(displayed)} bars`);
    if (unmeasured) labels.push('일부 구간 미확인');
    return {status:'measured',text:labels.join(' / ') || '마디: 미확인'};
  }
  root.MindexHymnStructure = {describe};
})(globalThis);
