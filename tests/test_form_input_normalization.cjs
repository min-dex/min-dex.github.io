const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('app.js','utf8');const c={cleanList:x=>x.map(String).map(x=>x.trim()).filter(Boolean),parseObjectPayload:x=>x&&typeof x==='object'&&!Array.isArray(x)?x:null,firstNonBlankString:(...xs)=>xs.map(x=>String(x||'').trim()).find(Boolean)||''};vm.createContext(c);
vm.runInContext(fs.readFileSync('mindex.worship-model.js','utf8'),c);
for(const [raw,expected] of [[' v - pc - c - 간주 ','V-PC-C-Int'],['v1a - v2b - c2 - pc1a - b - tags - vl','V1A-V2B-C2-PC1A-B-Tags-VL'],['verse 1 → Pre-Chorus + chorus, interlude > ending','V1-PC-C-Int-Coda'],['1절 - 후렴 - 마지막 절','V1-C-VL'],['V-C-C-Int-C','V-C-C-Int-C'],['custom label - V','custom label-V']]){assert.equal(c.normalizeServiceFormHint(raw),expected);assert.equal(c.normalizeServiceFormHint(expected),expected);const p=c.normalizeServiceFormPreset(raw,raw,'manual');assert.equal(p.hint,expected);assert.equal(p.forms.join('-'),expected);}
assert.equal(c.normalizeServiceFormPresetForms(['v1a',' pc ','간주','C','C']).join('-'),'V1A-PC-Int-C-C');
assert.equal(c.normalizeServiceFormHint('Verse 2 A - Chorus 1 B - Bridge A'),'V2A-C1B-BA');
assert.equal(c.canonicalServiceFormToken('Chorus 1 A'),'C1A');
assert.equal(c.normalizeServiceFormHint('V1@ - C@A - Bridge@B'),'V1@-C@A-B@B');
assert.equal(c.normalizeServiceFormHint('V1-C1-V1-C1'),'V1-C1-V1-C1');
assert.equal(c.normalizeServiceFormHint('V1-C1-C2'),'V1-C1-C2');
assert.equal(c.normalizeServiceFormHint('V1-C1A'),'V1-C1A');
assert.equal(c.canonicalServiceFormToken('Chorus @ A'),'C@A');
assert.equal(c.canonicalServiceFormToken('Coda@'),'Coda@');
assert.equal(c.normalizeServiceFormHint('  '),'');
const inputSrc=fs.readFileSync('mindex.worship-input.js','utf8');
assert.match(inputSrc,/const formHint = normalizeServiceFormHint\(field.value\)/);
assert.match(src,/const formHint = normalizeServiceFormHint\(value.formHint/);
console.log('PASS input/save normalization, numbered parts, repeats, Korean hymn aliases, unknown labels, idempotence');
c.document={};c.compactSearchValue=x=>String(x).replace(/\s+/g,'').toLowerCase();vm.runInContext(fs.readFileSync('mindex.presenter.js','utf8'),c);
for(const token of ['1절','2절','후렴','마지막 절','간주','v1a','pc','c2','b','tags'])assert.equal(JSON.stringify(c.normalizePresenterFormPresetLabel(token)),JSON.stringify(c.normalizePresenterFormPresetLabel(c.canonicalServiceFormToken(token))),token+' must keep playback meaning');
for(const [label,expected] of [['Verse 2 A','verse:2:a'],['Chorus 1 B','chorus:1:b'],['Bridge A','bridge:a']])assert.equal(c.normalizePresenterFormPresetLabel(label).key,expected,label+' must resolve as a stable presenter target');
for(const [label,expected] of [['Verse 1@','verse:1:@'],['Chorus@','chorus:@'],['Chorus@A','chorus:@:a'],['Coda@','coda:@']])assert.equal(c.normalizePresenterFormPresetLabel(label).key,expected,label+' must keep variant identity');

// Explicit Coda blocks remain distinct; unsplit Coda still supports A/B selection.
for (const [label,key] of [['Coda A','coda:a'],['Coda B','coda:b'],['Coda 2 B','coda:2:b'],['Ending B','coda:b'],['Coda@A','coda:@:a']]) {
  assert.equal(c.normalizeSongFormPresetLabel(label).key,key);
  assert.equal(c.normalizePresenterFormPresetLabel(label).key,key);
  assert.equal(c.normalizeSongFormPresetLabel(c.canonicalServiceFormToken(label)).key,key);
}
assert.equal(c.normalizeServiceFormHint('Coda A - Coda B - Coda 2 B'), 'CodaA-CodaB-Coda2B');
const codas = [{id:'a',label:'Coda A',lyrics:'A first\nA second'}, {id:'b',label:'Coda B',lyrics:'B first\nB second'}];
for (const [label,id] of [['Coda A','a'],['Coda B','b']]) {
  const resolved=c.findPresenterFormForPresetLabel(codas,label);
  assert.equal(resolved.id,id);
  assert.equal(resolved.lyrics,codas.find(f=>f.id===id).lyrics);
}
assert.equal(c.findPresenterFormForPresetLabel(codas,'Coda C'),null);
const unsplit=[{id:'whole',label:'Coda',lyrics:'A first\nA second\nB first\nB second'}];
assert.equal(c.findPresenterFormForPresetLabel(unsplit,'Coda A').lyrics,'A first\nA second');
assert.equal(c.findPresenterFormForPresetLabel(unsplit,'Coda B').lyrics,'B first\nB second');
assert.equal(c.normalizePresenterMissingFormLabel('Coda B'),'Coda B');
console.log('PASS Coda A/B identity, explicit block selection and unsplit grouping');
c.PART_TYPES=['Verse','Chorus','Pre-Chorus','Bridge','Coda','Lyrics'];
for (const name of ['withLocalId','normalizeForms','normalizeFormPartType','normalizeFormPartNumber','normalizeFormPartVariant','formPartLabelIdentity','formatFormPartLabel','normalizeLyricsForStorage','normalizeLyricsForCopy','normalizeRelationalUnit','normalizeRelationalUnitPartType','displayLabel']) {
  const start=src.indexOf(`function ${name}(`);
  assert.ok(start>=0,name);
  vm.runInContext(src.slice(start,src.indexOf('\n}\n',start)+2),c);
}
const edited=c.normalizeForms(codas.map(f=>({...f,part_type:'Coda',part_variant:f.id.toUpperCase()})));
// The relational schema saves the identity in curated_unit_label, not part_variant.
const persisted=JSON.parse(JSON.stringify(edited.map((f,i)=>({id:f.id,version_id:'fixture',curated_unit_type:f.part_type,curated_unit_label:c.displayLabel(f),text:f.lyrics,curated_order:i+1}))));
const reopened=c.normalizeForms(persisted.map(c.normalizeRelationalUnit));
assert.deepEqual(Array.from(reopened,f=>[f.id,f.part_variant,f.lyrics]),Array.from(edited,f=>[f.id,f.part_variant,f.lyrics]));
const replay=c.resolvePresenterFormPresetSequence(reopened,['CodaB','CodaA','CodaB']);
assert.equal(replay.missing.length,0);
assert.deepEqual(Array.from(replay.items,f=>f.id),['b','a','b']);
assert.equal(c.findPresenterFormForPresetLabel(reopened,'Coda@A'),null);
console.log('PASS Coda label-only persistence/reopen and B-A-B playback retain IDs and complete lyrics');

for(const [raw,shown] of [['V2B','Verse 2 B'],['C1A','Chorus 1 A'],['PC2B','Pre-Chorus 2 B'],['B1A','Bridge 1 A'],['Coda2B','Coda 2 B'],['V2','Verse 2'],['CA','Chorus A']]) {
 assert.equal(c.presenterFormPresetDisplayLabel(raw),shown);
 assert.equal(c.songFormPresetDisplayLabel(raw),shown);
 assert.equal(c.normalizePresenterFormPresetLabel(raw).key,c.normalizePresenterFormPresetLabel(shown).key);
}
console.log('PASS spaced A/B display labels and unchanged form identity');

// Full user-input matrix: spelling/case, separator spaces, groups and @ aliases.
let matrixCount = 0;
for (const base of ['Verse 1','Verse1','V1','verse 1','verse1','v1']) {
  for (const gap of ['', ' ', '  ']) {
    for (const [suffix, canonical, display] of [
      ['', 'V1','Verse 1'], ['A','V1A','Verse 1 A'], ['a','V1A','Verse 1 A'],
      ['B','V1B','Verse 1 B'], ['b','V1B','Verse 1 B'], ['@','V1@','Verse 1 @'],
      ...['A','a','B','b'].flatMap(g => ['@'+g, '@ '+g, g+'@', g+' @'].map(s =>
        [s, 'V1@'+g.toUpperCase(), 'Verse 1 @ '+g.toUpperCase()])),
    ]) {
      const raw = base + gap + suffix;
      assert.equal(c.normalizeServiceFormHint(raw), canonical, raw);
      assert.equal(c.normalizeServiceFormHint(canonical), canonical);
      assert.equal(c.songFormPresetDisplayLabel(raw), display, raw);
      assert.equal(c.presenterFormPresetDisplayLabel(raw), display, raw);
      assert.equal(c.normalizePresenterFormPresetLabel(raw).key, c.normalizeSongFormPresetLabel(canonical).key);
      const identity = c.formPartLabelIdentity(raw, 'Verse');
      assert.equal(c.formatFormPartLabel('Verse', identity.part_number, identity.part_variant), display);
      matrixCount++;
    }
  }
}
for (const [raw, expected] of [
  ['v - c - c b - tags','V-C-CB-Tags'], ['v-c-c-b-tags','V-C-C-B-Tags'],
  ['v c cb tags','v c cb tags'], ['Verse 1 A@B','Verse 1 A@B'],
  ['V1-C1-V1-C1','V1-C1-V1-C1'], ['c b','CB'], ['c-b','C-B'],
  ['pre-chorus 1 b@ - bridge a@ - coda @ b','PC1@B-B@A-Coda@B'],
]) assert.equal(c.normalizeServiceFormHint(raw), expected, raw);
for (const raw of ['Verse 1 A@B', 'v c cb tags']) {
  assert.equal(c.findPresenterFormForPresetLabel([{id:'plain',label:'Verse 1',lyrics:'keep'}],raw),null);
}
console.log(`PASS ${matrixCount} input combinations, full-name round trips, explicit numbers, ambiguous input and sequence boundaries`);
