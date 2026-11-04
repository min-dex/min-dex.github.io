const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const {createRequire} = require('node:module');
const {execFileSync} = require('node:child_process');
const builder = createRequire(require.resolve('electron-builder'));
const asar = createRequire(builder.resolve('app-builder-lib'))('@electron/asar');
const {identity} = require('../scripts/product-identity.cjs');
const [resources, target] = process.argv.slice(2);
const archive = path.join(resources, 'app.asar');
const {files, ...record} = identity(process.cwd(), {test:true});
assert.deepEqual(JSON.parse(asar.extractFile(archive, 'mindex-build.json')), record);
const gitBlob = bytes => crypto.createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
let dawnAudio = null;
for (const {name, blob} of files) {
 const bytes = asar.extractFile(archive, path.normalize(name));
 assert.equal(gitBlob(bytes), blob, name);
 if (name === 'assets/presenter/dawn-free-prayer-69c12c677944.mp3') {
  dawnAudio = {bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')};
  assert.equal(dawnAudio.bytes, 79675315);
  assert.equal(dawnAudio.sha256, '69c12c677944b1dc38ee666e2758f26631ef6075a2d88202d2567e0ca8bfe0f5');
 }
}
assert.ok(dawnAudio, 'approved dawn MP3 is included');
const desktop = execFileSync('git',['ls-files','-z','electron','tools/broadcast-prototype']).toString().split('\0').filter(Boolean);
for (const name of desktop) assert.deepEqual(asar.extractFile(archive,path.normalize(name)), fs.readFileSync(name), name);
const binary = target.startsWith('win-') ? 'ffmpeg.exe' : 'ffmpeg';
assert.deepEqual(fs.readFileSync(path.join(resources,'broadcast-engine',binary)), fs.readFileSync(path.join('.cache','broadcast-engine',target,binary)));
console.log(JSON.stringify({source:record.sourceCommit,renderer:record.rendererTree,target,rendererFiles:files.length,desktopFiles:desktop.length,dawnAudio}));
