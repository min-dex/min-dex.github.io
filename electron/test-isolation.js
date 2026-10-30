// Explicit opt-in for unsigned test packages only. Never copies an existing profile.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
function configureTestIsolation({ app, session }, pkg, env = process.env) {
  if (env.MINDEX_ISOLATED_TEST !== '1') return null;
  if (pkg.mindexTestBuild !== true) throw new Error('Isolation requires a test package');
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mindex-isolated-'));
  for (const name of ['userData', 'sessionData', 'logs', 'crashDumps']) {
    const dir = path.join(profile, name); fs.mkdirSync(dir); app.setPath(name, dir);
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
