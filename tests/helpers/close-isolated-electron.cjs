// Test harness only: prove the private profile before stopping any native process.
function nativeProcessAlive(pid) {
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === 'ESRCH') return false; throw error; }
}
async function closeIsolatedElectron(application, token, {timeoutMs = 15000,
  killMain = pid => process.kill(pid), isMainAlive = nativeProcessAlive} = {}) {
  if (!/^[a-f0-9]{32}$/.test(token || '') || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 15000
    || typeof killMain !== 'function' || typeof isMainAlive !== 'function') throw Error('Requires an owned isolated Electron test token and bounded timeout');
  const child = application.process();
  if (!Number.isInteger(child?.pid) || child.pid < 1 || typeof child.kill !== 'function') throw Error('Missing isolated Electron child');
  const receipt = await application.evaluate(({app, BrowserWindow}, {token, pid}) => {
    const fs = process.getBuiltinModule('node:fs'), path = process.getBuiltinModule('node:path'), os = process.getBuiltinModule('node:os');
    const root = path.join(fs.realpathSync(os.tmpdir()), 'mindex-isolated-upgrade-' + token), marker = path.join(root, 'fixture-only.json');
    // Pinned Playwright launches cmd.exe on Windows; Electron must be its direct child.
    const checks = {processMatches: process.pid === pid || (process.platform === 'win32' && process.ppid === pid),
      networkBlocked: !!globalThis.__mindexTestIsolation?.networkBlocked,
      profileMatches: app.getPath('userData') === path.join(root, 'userData')};
    if (!Object.values(checks).every(Boolean)) throw Error('Requires owned isolated Electron profile: ' + JSON.stringify(checks));
    if (fs.lstatSync(root).isSymbolicLink() || fs.lstatSync(marker).isSymbolicLink()) throw Error('Unsafe isolated Electron marker');
    const saved = JSON.parse(fs.readFileSync(marker, 'utf8'));
    if (saved.token !== token || saved.appId !== 'kr.mindex.app.test') throw Error('Isolated Electron marker mismatch');
    return {owned: true, pid: process.pid, launcherPid: pid, parentPid: process.ppid,
      platform: process.platform, windows: BrowserWindow.getAllWindows().length};
  }, {token, pid: child.pid});
  // Return ownership proof before a stop can close the inspector connection.
  let shutdownError;
  return new Promise((resolve, reject) => {
    let timer, poll, settled = false;
    const detach = () => { clearTimeout(timer); clearInterval(poll); child.removeListener('exit', checkStopped); };
    const finish = error => { if (settled) return; settled = true; detach(); error ? reject(error) : resolve(receipt); };
    function checkStopped() {
      if (settled) return;
      try {
        if (isMainAlive(receipt.pid) || child.exitCode === null) return;
        if (child.exitCode === 0 && !child.signalCode) finish();
        else finish(new Error('Owned isolated Electron exited unexpectedly: ' + child.exitCode + '/' + (child.signalCode || ''), {cause: shutdownError}));
      } catch (error) { finish(error); }
    }
    child.on('exit', checkStopped);
    poll = setInterval(checkStopped, 25);
    timer = setTimeout(() => {
      if (settled) return;
      settled = true; detach();
      const errors = shutdownError ? [shutdownError] : [];
      // Only stop a verified main while its owned launcher is still alive.
      if (child.exitCode === null) {
        if (receipt.platform === 'win32' && receipt.pid !== child.pid && receipt.parentPid === child.pid) {
          try { killMain(receipt.pid); } catch (error) { errors.push(error); }
        }
        try { child.kill(); } catch (error) { errors.push(error); }
      }
      reject(new Error('Owned isolated Electron close timed out', {cause: errors.length ? new AggregateError(errors) : undefined}));
    }, timeoutMs);
    void application.evaluate(({app}) => {
      // app.exit closes all windows itself. Destroying the last window first
      // can also invoke Windows' window-all-closed -> app.quit teardown.
      // Leave the inspector callback before the single owned exit request.
      setImmediate(() => app.exit(0));
    }).catch(error => { shutdownError = error; checkStopped(); });
    checkStopped();
  });
}
module.exports = {closeIsolatedElectron};
