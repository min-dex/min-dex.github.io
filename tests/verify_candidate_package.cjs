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
const packagedPaths = new Set(asar.listPackage(archive).map(name => name.replace(/\\/g, '/').replace(/^\//, '')));
for (const video of ['chromakey-ready-loop.mp4', 'chromakey-ready-loop-fast.mp4']) {
 assert.ok(!packagedPaths.has('assets/presenter/' + video), video + ' must stay out of the installer');
}
const {files, ...record} = identity(process.cwd(), {test:process.argv[4]!=='internal',internal:process.argv[4]==='internal'});
assert.deepEqual(JSON.parse(asar.extractFile(archive, 'mindex-build.json')), record);
const gitBlob = bytes => crypto.createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
let dawnAudio = null;
for (const {name, blob} of files) {
 const bytes = asar.extractFile(archive, path.normalize(name));
 assert.equal(gitBlob(bytes), blob, name);
 if (name === 'assets/presenter/dawn-free-prayer-f9ebf1aeed23.mp3') {
  dawnAudio = {bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex')};
  assert.equal(dawnAudio.bytes, 87865100);
  assert.equal(dawnAudio.sha256, 'f9ebf1aeed2385f27d61a3ad48908d2dad2cc0ca0a547a20b54a8a4aded7ddd3');
 }
}
assert.ok(dawnAudio, 'approved dawn MP3 is included');
const desktop = execFileSync('git',['ls-files','-z','electron','tools/broadcast-prototype']).toString().split('\0').filter(Boolean);
for (const name of desktop) assert.deepEqual(asar.extractFile(archive,path.normalize(name)), fs.readFileSync(name), name);
const binary = target.startsWith('win-') ? 'ffmpeg.exe' : 'ffmpeg';
assert.deepEqual(fs.readFileSync(path.join(resources,'broadcast-engine',binary)), fs.readFileSync(path.join('.cache','broadcast-engine',target,binary)));
console.log(JSON.stringify({source:record.sourceCommit,renderer:record.rendererTree,target,rendererFiles:files.length,desktopFiles:desktop.length,dawnAudio}));
