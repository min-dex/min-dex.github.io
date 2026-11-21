// Regression for the CI teardown hang; an owned test profile only, never user data.
const {_electron} = require('playwright');
const {closeIsolatedElectron} = require('./helpers/close-isolated-electron.cjs');
const assert = require('node:assert/strict'), crypto = require('node:crypto'), fs = require('node:fs'), os = require('node:os'), path = require('node:path');
(async () => {
  const [exe, sha, version] = process.argv.slice(2), token = crypto.randomBytes(16).toString('hex');
  assert(exe && /^[a-f0-9]{40}$/.test(sha) && version);
  let application;
  try {
    application = await _electron.launch({executablePath: path.resolve(exe),
      env: {...process.env, MINDEX_ISOLATED_TEST: '1', MINDEX_TEST_PROFILE_TOKEN: token}});
    const native = await application.evaluate(({app}) => ({version: app.getVersion(), isolated: globalThis.__mindexTestIsolation?.networkBlocked}));
    assert.equal(native.version, version); assert(native.isolated);
    const page = await application.firstWindow();
    await page.waitForFunction(() => !!window.mindexElectron);
    assert.equal((await page.evaluate(() => mindexElectron.getBuildInfo())).build.sourceCommit, sha);
    assert(await page.evaluate(() => {
      addEventListener('beforeunload', event => {event.preventDefault(); event.returnValue = '';});
      const event = new Event('beforeunload', {cancelable: true}); dispatchEvent(event); return event.defaultPrevented;
    }), 'fixture must actually cancel unload');
  } catch (error) {
    console.error('Isolated unload assertion failed before cleanup:', error); throw error;
  } finally {
    if (application) {
      const receipt = await closeIsolatedElectron(application, token);
      assert(receipt.owned && receipt.windows > 0);
      const root = path.join(fs.realpathSync(os.tmpdir()), 'mindex-isolated-upgrade-' + token), marker = path.join(root, 'fixture-only.json');
      assert(!fs.lstatSync(root).isSymbolicLink() && !fs.lstatSync(marker).isSymbolicLink());
      const saved = JSON.parse(fs.readFileSync(marker)); assert.equal(saved.token, token); assert.equal(saved.appId, 'kr.mindex.app.test');
      fs.rmSync(root, {recursive: true});
    }
  }
  console.log('PASS owned isolated app cleanup despite canceled unload; real app/profile inaccessible');
})().catch(error => {console.error(error); process.exitCode = 1;});
