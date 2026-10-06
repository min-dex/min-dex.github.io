const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const context = vm.createContext({
  cleanList: values => values.map(String).map(s=>s.trim()).filter(Boolean),
  compactSearchValue: value => String(value || '').replace(/\s+/g, '').toLowerCase(),
  normalizePraiseTypes: value => ['hymn', '찬송가'].includes(value) ? ['hymn'] : ['ccm'],
});
for (const name of ['parseObjectPayload', 'firstNonBlankString']) {
  const start = app.indexOf(`function ${name}(`);
  assert.ok(start >= 0);
  vm.runInContext(app.slice(start, app.indexOf('\n}\n', start) + 2), context);
}
const model = fs.readFileSync(path.join(root, 'mindex.worship-model.js'), 'utf8');
vm.runInContext(model, context);
for (const name of ['normalizeServiceFormPreset','canonicalServiceFormToken','normalizeServiceFormPresetForms',
  'collapseSingletonServiceFormPartNumbers','normalizeServiceFormHint','normalizeSongFormPresetLabel',
  'songFormPresetDisplayLabel','normalizeSongMetadataPresenterForm','normalizeServiceFormPresetRules',
  'normalizeServiceFormPresetRulePreset']) {
  assert.equal([...model.matchAll(new RegExp(`^function ${name}\\(`, 'gm'))].length, 1);
  assert.doesNotMatch(app, new RegExp(`^function ${name}\\(`, 'm'));
}
const plain = value => JSON.parse(JSON.stringify(value));
const canonical = 'V1-C-V2-C-Int-VL-C-Coda';
assert.equal(context.normalizeServiceFormHint(canonical), canonical);
assert.equal(context.normalizeServiceFormHint('V1-C1-V1-C1'), 'V1-C1-V1-C1');
assert.equal(context.normalizeServiceFormHint('V1-V2-C1-C2'), 'V1-V2-C1-C2');
assert.equal(context.normalizeServiceFormHint('V1@A-V1@-C1A'), 'V1@A-V1@-C1A');
assert.equal(context.normalizeServiceFormHint('Custom-C-C'), 'Custom-C-C');
for (const forms of [['1절','2절','간주','마지막 절'],['1절','후렴','2절','후렴','간주','마지막 절','후렴']]) {
  const preset = {forms, hint:forms.join('-')};
  const before = JSON.stringify(preset);
  const upgraded = context.normalizeServiceFormPresetRulePreset(preset, {songType:'hymn'});
  assert.equal(upgraded.forms.join('-'), canonical);
  assert.equal(upgraded.hint, canonical);
  assert.equal(upgraded.omitUnlisted, true);
  assert.equal(JSON.stringify(preset), before);
  assert.equal(context.normalizeServiceFormPresetRulePreset(preset, {songType:'ccm'}), preset);
  for (const strength of ['manual','forced','song-default']) {
    const explicit = {...preset, strength};
    assert.equal(context.normalizeServiceFormPresetRulePreset(explicit, {songType:'hymn'}), explicit);
  }
}
const rule = {form_preset:{sequence:canonical,omit_unlisted:true},condition:{song_type:'hymn'},append_coda_when_available:true};
const rules = plain(context.normalizeServiceFormPresetRules([null, {}, rule]));
assert.equal(rules.length, 1);
assert.equal(rules[0].formPreset.forms.join('-'), canonical);
assert.equal(rules[0].appendCodaWhenAvailable, true);
const preset = plain(context.normalizeServiceFormPreset(JSON.stringify({forms:['V1','V2','C'],strength:'manual',omitUnlisted:true})));
assert.deepEqual(plain(context.normalizeServiceFormPreset(JSON.parse(JSON.stringify(preset)))), preset);
assert.equal(context.normalizeServiceFormPreset(null), null);
const metadata = context.normalizeSongMetadataPresenterForm({forms:['B'],sourceForms:['V1','V2','C'],sourceHint:'V1-V2-C'});
assert.equal(metadata.forms.join('-'), 'V1-V2-C');
assert.equal(metadata.strength, 'song-default');
assert.equal(context.songFormPresetDisplayLabel('C@A'), 'Chorus@A');
console.log('PASS form defaults, manual preservation, singleton/variant/repeat identity, rule aliases and persistence round-trip');
