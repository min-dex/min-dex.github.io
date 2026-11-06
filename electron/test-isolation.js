// Explicit opt-in for unsigned test packages only. Never copies an existing profile.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
function configureTestIsolation({ app, session }, pkg, env = process.env) {
  if (env.MINDEX_ISOLATED_TEST !== '1') return null;
  if (pkg.mindexTestBuild !== true && pkg.mindexInternalBuild !== true) throw new Error('Isolation requires a test package or internal package');
  // A test runner may keep its own random fixture across restarts. No arbitrary
  // paths or pre-existing unmarked directories are accepted.
  const token = env.MINDEX_TEST_PROFILE_TOKEN;
  let profile;
  if (token !== undefined) {
    if (!/^[a-f0-9]{32}$/.test(token)) throw new Error('Invalid test profile token');
    profile = path.join(fs.realpathSync(os.tmpdir()), 'mindex-isolated-upgrade-' + token);
    const marker = path.join(profile, 'fixture-only.json');
    if (!fs.existsSync(profile)) {
      fs.mkdirSync(profile, { mode: 0o700 });
      fs.writeFileSync(marker, JSON.stringify({ token, appId: 'kr.mindex.app.test' }), { flag: 'wx', mode: 0o600 });
    }
    if (fs.lstatSync(profile).isSymbolicLink() || fs.lstatSync(marker).isSymbolicLink()) throw new Error('Unsafe test profile');
    const saved = JSON.parse(fs.readFileSync(marker, 'utf8'));
    if (saved.token !== token || saved.appId !== 'kr.mindex.app.test') throw new Error('Unrecognized test profile');
  } else profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mindex-isolated-'));
  for (const name of ['userData', 'sessionData', 'logs', 'crashDumps']) {
    const dir = path.join(profile, name);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir);
    if (!fs.lstatSync(dir).isDirectory() || fs.lstatSync(dir).isSymbolicLink()) throw new Error('Unsafe test profile directory');
    app.setPath(name, dir);
  }
  app.commandLine.appendSwitch('disable-background-networking');
  app.commandLine.appendSwitch('host-resolver-rules', 'MAP * ~NOTFOUND');
  const state = { profile, blockedRequests: 0, networkBlocked: false };
  const protectSession = target => {
    target.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, done) => {
      state.blockedRequests += 1; done({ cancel: true });
    });
    target.setPermissionRequestHandler((_window, _permission, done) => done(false));
    target.setPermissionCheckHandler(() => false);
  };
  app.on('session-created', protectSession);
  app.whenReady().then(() => { protectSession(session.defaultSession); state.networkBlocked = true; });
  app.on('web-contents-created', (_event, contents) => {
    contents.setAudioMuted(true);
    contents.setWindowOpenHandler(() => ({ action: 'deny' }));
    contents.on('will-navigate', (event, url) => { if (!url.startsWith('file:')) event.preventDefault(); });
    contents.on('will-attach-webview', event => event.preventDefault());
  });
  return state;
}
module.exports = { configureTestIsolation };
