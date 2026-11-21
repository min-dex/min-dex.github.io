const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), crypto = require('node:crypto'), vm = require('node:vm');
const {EventEmitter} = require('node:events');
const {closeIsolatedElectron} = require('./helpers/close-isolated-electron.cjs');
function fixture(options = {}) {
  const token = crypto.randomBytes(16).toString('hex'), root = path.join(fs.realpathSync(os.tmpdir()), 'mindex-isolated-upgrade-' + token);
  fs.mkdirSync(root); fs.mkdirSync(path.join(root, 'userData'));
  fs.writeFileSync(path.join(root, 'fixture-only.json'), JSON.stringify({token, appId: 'kr.mindex.app.test', ...options.marker}));
  const calls = [], child = new EventEmitter(); let nativeAlive = true, evaluations = 0;
  Object.assign(child, {pid: 10001, exitCode: options.launcherAlreadyExited ? 0 : null, kill() {calls.push('kill'); nativeAlive = false; child.exitCode = 1; child.signalCode = 'SIGTERM'; child.emit('exit', null, 'SIGTERM');}});
  const native = {pid: options.nativePid ?? child.pid, ppid: options.nativeParentPid ?? 10000,
    platform: options.platform || 'darwin', getBuiltinModule: name => process.getBuiltinModule(name)};
  const application = {
    process: () => child,
    async evaluate(callback, args) {
      if (++evaluations > 1 && options.shutdownError) throw Error('shutdown RPC failed');
      const fn = vm.runInNewContext('(' + callback.toString() + ')', {process: native,
        __mindexTestIsolation: {networkBlocked: options.networkBlocked !== false}});
      const result = fn({app: {getPath: () => options.profile || path.join(root, 'userData'), exit(code) {
        calls.push('exit-' + code);
        if (!options.hang) {nativeAlive = false; child.exitCode = options.exitCode ?? code; child.emit('exit', child.exitCode, null);}
      }}, BrowserWindow: {getAllWindows: () => [1, 2].map(n => ({destroy() {calls.push('destroy-' + n);}}))}}, args);
      return evaluations > 1 && options.lostStopReply ? new Promise(() => {}) : result;
    },
  };
  return {application, token, root, calls, native, alive: () => nativeAlive,
    dispose() {fs.rmSync(root, {recursive: true, maxRetries: 5, retryDelay: 100});}};
}
const close = (f, options = {}) => closeIsolatedElectron(f.application, f.token, {isMainAlive: f.alive, ...options});
test('owned windows stop before verified native disappearance and launcher exit zero', async () => {
  const f = fixture();
  try {const r = await close(f); assert(r.owned && r.windows === 2 && r.pid === 10001); assert.deepEqual(f.calls, ['destroy-1', 'destroy-2', 'exit-0']);}
  finally {f.dispose();}
});
test('Windows direct child is owned; unrelated and POSIX parent relationships are rejected', async () => {
  const f = fixture({platform: 'win32', nativePid: 10002, nativeParentPid: 10001});
  try {const r = await close(f); assert.equal(r.pid, 10002); assert.equal(r.launcherPid, 10001);}
  finally {f.dispose();}
  for (const options of [{platform: 'win32', nativePid: 10002, nativeParentPid: 10000}, {platform: 'darwin', nativePid: 10002, nativeParentPid: 10001}]) {
    const f = fixture(options);
    try {await assert.rejects(close(f), /processMatches/); assert.deepEqual(f.calls, []);}
    finally {f.dispose();}
  }
});
test('real/unisolated profiles and wrong markers cannot destroy or kill', async () => {
  for (const options of [{networkBlocked: false}, {profile: path.join(os.tmpdir(), 'not-owned')}, {marker: {appId: 'kr.mindex.app'}}, {marker: {token: 'other'}}]) {
    const f = fixture(options);
    try {await assert.rejects(close(f), /isolated|marker/i); assert.deepEqual(f.calls, []);}
    finally {f.dispose();}
  }
});
test('a marker symlink cannot authorize cleanup', async t => {
  const f = fixture(), marker = path.join(f.root, 'fixture-only.json'), stat = fs.lstatSync;
  try {t.mock.method(fs, 'lstatSync', value => value === marker ? {isSymbolicLink: () => true} : stat(value)); await assert.rejects(close(f), /isolated/i); assert.deepEqual(f.calls, []);}
  finally {t.mock.restoreAll(); f.dispose();}
});
test('lost stop reply requires independent native stop, not just an exited Windows shell', async () => {
  const f = fixture({platform: 'win32', nativePid: 10002, nativeParentPid: 10001, launcherAlreadyExited: true, lostStopReply: true});
  try {assert((await close(f)).owned); assert.deepEqual(f.calls, ['destroy-1', 'destroy-2', 'exit-0']); assert.equal(f.alive(), false);}
  finally {f.dispose();}
});
test('nonzero exit remains a failing check', async () => {
  const f = fixture({exitCode: 7});
  try {await assert.rejects(close(f), /unexpectedly: 7/);}
  finally {f.dispose();}
});
test('an exited Windows launcher alone cannot certify or force-stop a still-running native app', async () => {
  const f = fixture({platform: 'win32', nativePid: 10002, nativeParentPid: 10001, launcherAlreadyExited: true, hang: true});
  try {await assert.rejects(close(f, {timeoutMs: 10, killMain: pid => f.calls.push('kill-main-' + pid)}), /timed out/); assert.deepEqual(f.calls, ['destroy-1', 'destroy-2', 'exit-0']); assert.equal(f.alive(), true);}
  finally {f.dispose();}
});
test('failed stop without native exit fails within deadline and stops only its proven child', async () => {
  const f = fixture({shutdownError: true});
  try {await assert.rejects(close(f, {timeoutMs: 10}), /timed out/); assert.deepEqual(f.calls, ['kill']);}
  finally {f.dispose();}
});
test('hung Windows stop targets only the verified main and launcher', async () => {
  const f = fixture({platform: 'win32', nativePid: 10002, nativeParentPid: 10001, hang: true});
  try {await assert.rejects(close(f, {timeoutMs: 10, killMain: pid => f.calls.push('kill-main-' + pid)}), /timed out/); assert.deepEqual(f.calls, ['destroy-1', 'destroy-2', 'exit-0', 'kill-main-10002', 'kill']);}
  finally {f.dispose();}
});
