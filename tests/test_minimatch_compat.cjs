const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { spawnSync } = require('node:child_process');
function location(name) {
  const store = path.resolve('node_modules/.pnpm');
  const dir = fs.readdirSync(store).find(d => d.startsWith(name.replace('/', '+') + '@'));
  assert.ok(dir, name + ' must be installed');
  return path.join(store, dir, 'node_modules', name);
}
const from = name => createRequire(location(name) + '/package.json');
const legacy = from('glob')('minimatch');
test('only the pinned official patched engine performs matching', () => {
  const req = createRequire(from('glob').resolve('minimatch'));
  assert.equal(req('minimatch/package.json').version, '11.0.1');
  assert.equal(typeof req('minimatch').Minimatch.prototype.mergeRows, 'function');
  assert.equal(typeof legacy, 'function');
  assert.equal(typeof legacy.Minimatch.prototype.mergeRows, 'function');
  const mm = new legacy.Minimatch('{a*,b*}');
  assert.equal(mm.set.length, mm.globSet.length);
  assert.equal(legacy('a.js', '*.js'), true);
  assert.equal(legacy('.a.js', '*.js'), false);
  assert.equal(legacy('.a.js', '*.js', { dot: true }), true);
  assert.equal(legacy('A.JS', '*.js', { nocase: true }), true);
  assert.equal(legacy('a/b.png', '**/*.{png,jpg}'), true);
  assert.equal(legacy('a/b.png', '*.png', { matchBase: true }), true);
  assert.equal(legacy('C:/a/b.js', 'C:/**/*.js'), true);
  assert.equal(typeof mm.makeRe, 'undefined'); // Unsupported, never silently emulated.
});
test('glob7 dot, braces, nonull, ignored files and async match', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mindex-glob-'));
  try {
    const glob = require(location('glob'));
    assert.deepEqual(glob.sync('{a*,b*}', { cwd: dir, nonull: true }), ['a*', 'b*']);
    assert.deepEqual(glob.sync('{.a*,b*}', { cwd: dir, nonull: true }), ['.a*', 'b*']);
    fs.mkdirSync(path.join(dir, 'deep'));
    for (const f of ['a.js', '.a.js', 'deep/b.png', 'deep/.b.png']) fs.writeFileSync(path.join(dir, f), 'fixture');
    assert.deepEqual(glob.sync('**/*.{js,png}', { cwd: dir }).sort(), ['a.js', 'deep/b.png']);
    assert.deepEqual(glob.sync('**/*.{js,png}', { cwd: dir, dot: true, ignore: '**/.b.png' }).sort(), ['.a.js', 'a.js', 'deep/b.png']);
    const matches = await new Promise((resolve, reject) => glob('**/*', { cwd: dir, nodir: true }, (e, x) => e ? reject(e) : resolve(x)));
    assert.deepEqual(matches.sort(), ['a.js', 'deep/b.png']);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
test('official amplification guard survives the legacy bridge under a deadline', () => {
  for (const consumer of ['glob', 'app-builder-lib']) {
    const program = `const assert=require('node:assert/strict'),{createRequire}=require('node:module');const m=createRequire(process.argv[1])('minimatch');const mm=new m.Minimatch(Array(30).fill('**/../a/b').join('/'),{optimizationLevel:2,braceExpandMax:64});assert.equal(mm.set.length,64);`;
    const r = spawnSync(process.execPath, ['-e', program, location(consumer) + '/package.json'], { timeout: 5000, maxBuffer: 8192 });
    assert.equal(r.status, 0, r.error?.message || r.stderr.toString());
  }
});
