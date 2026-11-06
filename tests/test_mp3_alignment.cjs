const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const scope = {};
vm.runInNewContext(fs.readFileSync('mindex.mp3-transport.js', 'utf8'), scope);
const { measureAlignment } = scope.MindexMp3Index;
let seed = 1937;
const reference = Float32Array.from({length:40000}, () => {
  seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
  return seed / 2147483648 - 1;
});
for (const lag of [-2257, -1728, -529, 0, 529, 1728, 2257]) {
  const decoded = reference.slice(10000-lag, 22000-lag);
  const result = measureAlignment(reference, decoded, 10000, 0, 4032);
  assert.equal(result.decoderLag, lag);
  assert.ok(result.score > .999999);
  assert.ok(result.validationScore > .999999);
}
const changed = reference.slice(10000,22000);
changed.fill(0,4096,8192);
const rejected = measureAlignment(reference,changed,10000,0,4032);
assert.equal(rejected.decoderLag,0);
assert.ok(rejected.validationScore < .995, 'independent window must reject truncated/mismatched content');
const silence = new Float32Array(12000);
assert.ok(measureAlignment(reference,silence,10000,0,4032).score < .995);
console.log('PASS signed frame delays, independent-window corruption rejection, silent calibration rejection');

const { referenceOrigin } = scope.MindexMp3Index;
const index = {sampleRate:48000, delay:576, samples:1152, metadataFrames:1};
assert.equal(referenceOrigin(index,919,1056431,48000,529).origin,0);
assert.equal(referenceOrigin(index,919,1056960,48000,0).origin,0);
assert.equal(referenceOrigin(index,919,1057536,48000,-576).origin,1105);
assert.throws(() => referenceOrigin(index,919,1057536,48000,529),/Unverified/);
assert.throws(() => referenceOrigin({...index,delay:0},919,1057536,48000,0),/ambiguous/);
console.log('PASS measured gapless trim states and unknown-origin rejection');
