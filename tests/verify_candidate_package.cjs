const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const {execFileSync} = require('node:child_process');
const builder = createRequire(require.resolve('electron-builder'));
const asar = createRequire(builder.resolve('app-builder-lib'))('@electron/asar');
const {identity} = require('../scripts/product-identity.cjs');
const {fileIdentity} = require('../scripts/packaged-encoder-identity.cjs');
const [resources, target] = process.argv.slice(2);
const archive = path.join(resources, 'app.asar');
const packagedPaths = new Set(asar.listPackage(archive).map(name => name.replace(/\\/g, '/').replace(/^\//, '')));
assert.ok(!packagedPaths.has('tools/broadcast-prototype/encoder-test.mjs'), 'unused encoder rehearsal must stay out of the installer');
for (const video of ['chromakey-ready-loop.mp4', 'chromakey-ready-loop-fast.mp4']) {
 assert.ok(!packagedPaths.has('assets/presenter/' + video), video + ' must stay out of the installer');
}
const {files, ...record} = identity(process.cwd(), {test:process.argv[4]!=='internal',internal:process.argv[4]==='internal'});
assert.deepEqual(JSON.parse(asar.extractFile(archive, 'mindex-build.json')), record);
const gitBlob = bytes => crypto.createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
for (const retired of ["assets/presenter/dawn-free-prayer-69c12c677944.mp3", "assets/presenter/dawn-free-prayer-7838168016b7.mp3", "assets/presenter/dawn-free-prayer-9b2f77451de5.mp3", "assets/presenter/dawn-free-prayer-bac443d20c02.mp3", "assets/presenter/dawn-free-prayer-f9ebf1aeed23.mp3", "assets/presenter/dawn-free-prayer.mp3"]) assert.ok(!packagedPaths.has(retired), "retired dawn audio must not ship: "+retired);
let dawnAudio = null, dawnBgm = null;
for (const {name, blob} of files) {
 const bytes = asar.extractFile(archive, path.normalize(name));
 assert.equal(gitBlob(bytes), blob, name);
 if (name === 'assets/presenter/dawn-free-prayer-9778d2abaf3d.mp3') {
  dawnAudio = {bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')};
  assert.equal(dawnAudio.bytes, 92675129);
  assert.equal(dawnAudio.sha256, '9778d2abaf3df2c51efce27790724efa36dde5286b5e320b2c2fd3b07b1f878f');
 }
 if (name === 'assets/presenter/dawn-bgm-5efc56784907.mp3') {
  dawnBgm = {bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')};
  assert.equal(dawnBgm.bytes, 68302166);
  assert.equal(dawnBgm.sha256, '5efc567849076646805a5d2b02589c3da1c0797c4b4aa5160675fa9f42e3711d');
 }
}
assert.ok(dawnAudio, 'approved dawn MP3 is included');
assert.ok(dawnBgm, 'approved dawn MR BGM is included');
const desktop = execFileSync('git',['ls-files','-z','electron','tools/broadcast-prototype']).toString().split('\0').filter(Boolean);
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
for (const name of desktop) assert.equal(sha256(asar.extractFile(archive,path.normalize(name))), sha256(fs.readFileSync(name)), name);
const binary = target.startsWith('win-') ? 'ffmpeg.exe' : 'ffmpeg';
const originalEncoder = fileIdentity(path.join('.cache','broadcast-engine',target,binary));
let expectedEncoder = originalEncoder;
if (process.argv[4] === 'internal' && target.startsWith('mac-')) {
 const receipt=JSON.parse(fs.readFileSync(path.join('dist','internal',`encoder-${target}.json`)));
 assert.equal(receipt.sourceCommit,record.sourceCommit,'signed encoder source');
 assert.equal(receipt.target,target,'signed encoder architecture');
 assert.deepEqual(receipt.original,originalEncoder,'pinned encoder input');
 expectedEncoder=receipt.signed;
}
assert.deepEqual(fileIdentity(path.join(resources,'broadcast-engine',binary)),expectedEncoder,'packaged encoder identity');
console.log(JSON.stringify({source:record.sourceCommit,renderer:record.rendererTree,target,rendererFiles:files.length,desktopFiles:desktop.length,dawnAudio,dawnBgm}));
