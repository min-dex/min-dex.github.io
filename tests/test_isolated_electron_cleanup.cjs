const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto');
const {closeIsolatedElectron} = require('./helpers/close-isolated-electron.cjs');
function fixture(options = {}) {
  const token = crypto.randomBytes(16).toString('hex');
  const root = path.join(fs.realpathSync(os.tmpdir()), 'mindex-isolated-upgrade-' + token);
  fs.mkdirSync(root); fs.mkdirSync(path.join(root, 'userData'));
  fs.writeFileSync(path.join(root, 'fixture-only.json'), JSON.stringify({token, appId: 'kr.mindex.app.test', ...options.marker}));
  const calls = [], child = {pid: process.pid, exitCode: null, kill() { calls.push('kill'); }};
  const application = {
    process: () => child,
    async evaluate(callback, args) {
      const had = Object.hasOwn(globalThis, '__mindexTestIsolation'), before = globalThis.__mindexTestIsolation;
      globalThis.__mindexTestIsolation = {networkBlocked: options.networkBlocked !== false};
      try {
        return callback({app: {getPath: () => options.profile || path.join(root, 'userData')},
          BrowserWindow: {getAllWindows: () => [1, 2].map(n => ({destroy() { calls.push('destroy-' + n); }}))}}, args);
      } finally {
        if (had) globalThis.__mindexTestIsolation = before; else delete globalThis.__mindexTestIsolation;
      }
    },
    close() { calls.push('close'); return options.close ? options.close() : Promise.resolve(); },
  };
  return {application, token, root, calls, dispose() { fs.rmSync(root, {recursive: true}); }};
}
test('owned test windows are destroyed before close without invoking unsaved-input UI', async () => {
  const f = fixture();
  try {
    const result = await closeIsolatedElectron(f.application, f.token);
    assert.deepEqual(result, {owned: true, pid: process.pid, windows: 2});
    assert.deepEqual(f.calls, ['destroy-1', 'destroy-2', 'close']);
  } finally { f.dispose(); }
});
test('real/unisolated profiles and mismatched ownership markers cannot destroy or kill', async () => {
  for (const options of [{networkBlocked: false}, {profile: path.join(os.tmpdir(), 'not-the-owned-profile')},
    {marker: {appId: 'kr.mindex.app'}}, {marker: {token: 'other'}}]) {
    const f = fixture(options);
    try { await assert.rejects(closeIsolatedElectron(f.application, f.token), /isolated|marker/i); assert.deepEqual(f.calls, []); }
    finally { f.dispose(); }
  }
});
test('a marker symlink cannot authorize cleanup', async t => {
  const f = fixture(), marker = path.join(f.root, 'fixture-only.json'), stat = fs.lstatSync;
  try {
    // Exercise the guard on every runner without requiring Windows symlink privileges.
    t.mock.method(fs, 'lstatSync', value => value === marker ? {isSymbolicLink: () => true} : stat(value));
    await assert.rejects(closeIsolatedElectron(f.application, f.token), /isolated/i); assert.deepEqual(f.calls, []);
  } finally { t.mock.restoreAll(); f.dispose(); }
});
test('close failures remain failures while cleaning up only the proven test child', async () => {
  const f = fixture({close: () => Promise.reject(Error('close failed'))});
  try { await assert.rejects(closeIsolatedElectron(f.application, f.token), /close failed/); assert.deepEqual(f.calls, ['destroy-1', 'destroy-2', 'close', 'kill']); }
  finally { f.dispose(); }
});
test('hung close stops only its proven test child and fails within its deadline', async () => {
  const f = fixture({close: () => new Promise(() => {})});
  try {
    await assert.rejects(closeIsolatedElectron(f.application, f.token, {timeoutMs: 10}), /timed out/);
    assert.deepEqual(f.calls, ['destroy-1', 'destroy-2', 'close', 'kill']);
  } finally { f.dispose(); }
});
