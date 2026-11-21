// Test harness only: never destroy a window or kill a process without proving ownership.
async function closeIsolatedElectron(application, token, {timeoutMs = 15000} = {}) {
  if (!/^[a-f0-9]{32}$/.test(token || '') || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000) {
    throw Error('Requires an owned isolated Electron test token and bounded timeout');
  }
  const child = application.process();
  if (!Number.isInteger(child?.pid) || typeof child.kill !== 'function') throw Error('Missing isolated Electron child');
  const receipt = await application.evaluate(({app, BrowserWindow}, {token, pid}) => {
    const fs = process.getBuiltinModule('node:fs'), path = process.getBuiltinModule('node:path'), os = process.getBuiltinModule('node:os');
    const root = path.join(fs.realpathSync(os.tmpdir()), 'mindex-isolated-upgrade-' + token);
    const marker = path.join(root, 'fixture-only.json');
    if (process.pid !== pid || !globalThis.__mindexTestIsolation?.networkBlocked
      || app.getPath('userData') !== path.join(root, 'userData')
      || fs.lstatSync(root).isSymbolicLink() || fs.lstatSync(marker).isSymbolicLink()) {
      throw Error('Requires owned isolated Electron profile before cleanup');
    }
    const saved = JSON.parse(fs.readFileSync(marker, 'utf8'));
    if (saved.token !== token || saved.appId !== 'kr.mindex.app.test') throw Error('Isolated Electron marker mismatch');
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) window.destroy();
    return {owned: true, pid, windows: windows.length};
  }, {token, pid: child.pid});
  let timer, stopAttempted = false;
  const stopOwnedChild = () => {
    if (!stopAttempted && child.exitCode === null) { stopAttempted = true; child.kill(); }
  };
  try {
    await Promise.race([
      application.close(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          // A timed-out cleanup remains a failing check; only its proven test child is stopped.
          try { stopOwnedChild(); }
          catch (error) { reject(new Error('Owned isolated Electron cleanup could not stop its child', {cause: error})); return; }
          reject(Error('Owned isolated Electron close timed out'));
        }, timeoutMs);
      }),
    ]);
  } catch (error) {
    try { stopOwnedChild(); }
    catch (stopError) { throw new AggregateError([error, stopError], 'Owned isolated Electron cleanup failed'); }
    throw error;
  } finally { clearTimeout(timer); }
  return receipt;
}
module.exports = {closeIsolatedElectron};
