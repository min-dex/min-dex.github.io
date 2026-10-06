const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const model = fs.readFileSync(path.join(root, 'mindex.worship-model.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const context = vm.createContext({});
vm.runInContext(model, context);
const plain = value => JSON.parse(JSON.stringify(value));
const normalize = value => plain(context.normalizeServiceAsset(value));
const empty = {kind:'', name:'', url:''};
for (const value of [null, undefined, false, 1, 'image.png', []]) {
  assert.deepEqual(normalize(value), empty);
}
assert.equal(normalize({type:' KEYNOTE '}).kind, 'file');
assert.equal(normalize({type:'music_score'}).kind, 'score');
assert.equal(normalize({kind:'unknown'}).kind, '');
const input = {type:'importeddeck', title:' Deck ', path:' cover.png ',
  manifest:{url:' manifest.json ', fingerprint:' abc ', stages:[
    {src:'b.png', title:' Second ', sort:2, form_label:' V2 '},
    {href:'a.png', order:1, form_key:'verse-1'}, null, {url:' '},
  ]}, sound:{src:' track.mp3 ', label:' Audio '},
  sync:{pages:[{page:2,at:4,lines:[' Line ', '']},{page:1,time:0},{page:3,start:-1}],cross:8,duration:10}};
const before = JSON.stringify(input);
const normalized = normalize(input);
assert.equal(JSON.stringify(input), before, 'Normalization must not mutate input');
assert.deepEqual(normalized.slides.map(s=>s.url), ['a.png','b.png']);
assert.equal(normalized.slides[0].formKey, 'verse-1');
assert.equal(normalized.slides[1].formLabel, 'V2');
assert.deepEqual(normalized.audio, {name:'Audio',url:'track.mp3'});
assert.deepEqual(normalized.timing, {pages:[{page:1,start:0,lines:[]},{page:2,start:4,lines:['Line']}],cross:8,duration:10});
assert.equal(normalized.manifestUrl, 'manifest.json');
assert.equal(normalized.fingerprint, 'abc');
assert.deepEqual(normalize(normalized), normalized, 'Canonical deck round-trip');
assert.deepEqual(normalize({kind:'image',images:[' a.png ', '', 'b.png']}).slides,
  [{url:'a.png',name:''},{url:'b.png',name:''}]);
assert.equal(context.hasServiceAsset({kind:'image'}), true);
assert.equal(context.hasServiceAssetContent({kind:'image'}), false);
assert.equal(context.hasServiceAssetContent({slides:[{url:'a.png'}]}), true);
assert.deepEqual(plain(context.normalizeServiceAudioAsset({url:'a.mp3'})), {kind:'audio',name:'',url:'a.mp3'});
assert.deepEqual(plain(context.normalizeServiceAudioAsset(null)), empty);
for (const name of ['normalizeServiceAsset','normalizeServiceAssetAudioPayload','normalizeServiceSyncTiming',
  'normalizeServiceAudioAsset','normalizeServiceAssetSlides','hasServiceAsset','hasServiceAssetContent']) {
  assert.equal([...model.matchAll(new RegExp(`^function ${name}\\(`, 'gm'))].length, 1);
  assert.doesNotMatch(app, new RegExp(`^function ${name}\\(`, 'm'));
}
console.log('PASS isolated media model: aliases, ordered deck, timing, audio, nonmutation, round-trip, ownership');
