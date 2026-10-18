const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '../mindex.presenter.js'), 'utf8');
function extract(name) {
  const start = code.indexOf(`function ${name}(`);
  const end = code.indexOf('\nfunction ', start + 1);
  assert(start >= 0 && end > start);
  return code.slice(start, end);
}
const context = vm.createContext({
  compactSearchValue: value => String(value).replace(/\s+/g, '').toLowerCase(),
  displayLabel: form => form.label,
  normalizeForms: forms => forms,
  normalizeLyricsForCopy: value => value.trim(),
  presenterServiceItemFormPreset: (_version, item) => item.preset,
  presenterFormPresetWithAvailableForms: preset => preset,
  resolvePresenterFormPresetSequence: (forms, preset) => ({items: preset.forms.map(id => forms.find(f => f.id === id)), missing: []}),
  presenterMissingFormWarnings: () => [],
  presenterFormPresetShouldOmitUnlisted: () => true,
});
for (const name of ['presenterFormDisplayLabel', 'normalizePresenterFormType', 'normalizePresenterFormPresetLabel', 'presenterHymnOnceOnlyIntro', 'presenterFormPlanForServiceItem']) vm.runInContext(extract(name), context);
const plain = value => JSON.parse(JSON.stringify(value));
for (const [id, count, verses] of [['5bf20e2d-cb7e-5c2a-86ca-0a75acfdd7c0', 4, 5], ['7ab06cc7-99cf-5e67-b236-78a6758734e8', 3, 4]]) {
  const intro = Array(count).fill('할렐루야').join(' ') + '\n';
  const forms = Array.from({length: verses}, (_, i) => ({id: `v${i+1}`, label: `Verse ${i+1}`, lyrics: intro + `본절 ${i+1}\n\n끝말 할렐루야`, sort_order: i+1}));
  forms.push({id:'coda',label:'Coda',lyrics:'아멘'});
  const original = JSON.stringify(forms);
  const version = {id, forms};
  for (const ids of [null, ['v2'], ['v2','v1','v2','coda'], ['v1','v1']]) {
    const item = ids ? {preset: {forms: ids}} : {};
    const plan = context.presenterFormPlanForServiceItem(version, item);
    const selected = ids ? ids.map(id => forms.find(f => f.id === id)) : forms;
    assert.deepEqual(plain(plan.forms.map(f => f.id)), selected.map(f => f.id));
    assert.equal(plan.forms.filter(f => f.lyrics.startsWith(intro)).length, 1);
    assert.equal(plan.forms[0].lyrics, selected[0].lyrics);
    for (let i=1; i<selected.length; i++) assert.equal(plan.forms[i].lyrics, selected[i].lyrics.replace(intro, ''));
    assert.equal(JSON.stringify(forms), original, 'saved lyric units mutated');
    assert.equal(JSON.stringify(item), JSON.stringify(ids ? {preset: {forms: ids}} : {}));
  }
  assert.deepEqual(plain(context.presenterHymnOnceOnlyIntro(forms, {id:'other-edition'})), forms);
  const manual = forms.map(f => ({...f, lyrics: '직접 수정 ' + f.lyrics}));
  assert.deepEqual(plain(context.presenterHymnOnceOnlyIntro(manual, version)), manual);
  const segmented = forms.slice(0,2).map(f => ({...f, label:'Verse 1 A', _presenterVirtual:true, _presenterSourceFormId:f.id}));
  assert.deepEqual(plain(context.presenterHymnOnceOnlyIntro(segmented, version)), segmented);
}
console.log('PASS 163/166 intro once per playback plan; selection/repeats/order, other editions, manual lyrics and stored IDs preserved');
