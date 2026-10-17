const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../mindex.presenter.js'), 'utf8');
const helpers = source.slice(source.indexOf('let presenterOutputFullscreenTask'), source.indexOf('function setupPresenterDelegatedFullscreen'));
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function fixture() {
  const events = [], enter = deferred(), exit = deferred();
  const document = { fullscreenElement: null, documentElement: {
    requestFullscreen: () => { events.push('enter'); return enter.promise.then(() => { document.fullscreenElement = {}; }); }
  }, exitFullscreen: () => { events.push('exit'); return exit.promise.then(() => { document.fullscreenElement = null; }); } };
  const context = vm.createContext({ document, window: { close: () => events.push('close') }, console: { warn() {} } });
  vm.runInContext(helpers, context);
  return { context, events, enter, exit, document };
}
(async () => {
  const f = fixture(), c = f.context;
  const entry = c.enterPresenterOutputFullscreen();
  assert.equal(c.enterPresenterOutputFullscreen(), entry);
  const close = c.closePresenterOutputBrowserWindow();
  assert.equal(c.closePresenterOutputBrowserWindow(), close);
  await c.enterPresenterOutputFullscreen(); // A closing output cannot start another entry.
  assert.deepEqual(f.events, ['enter']);
  f.enter.resolve(); await entry; await new Promise(r => setImmediate(r));
  assert.deepEqual(f.events, ['enter', 'exit']);
  f.exit.resolve(); assert.equal(await close, true);
  assert.deepEqual(f.events, ['enter', 'exit', 'close']);
  await c.closePresenterOutputBrowserWindow();
  assert.equal(f.events.filter(x => x === 'close').length, 1);

  const failed = fixture();
  failed.document.fullscreenElement = {};
  failed.document.exitFullscreen = async () => { throw Error('native exit failed'); };
  assert.equal(await failed.context.closePresenterOutputBrowserWindow(), false);
  assert.deepEqual(failed.events, []); // Never destroy a window in an unresolved transition.
  failed.document.fullscreenElement = null;
  assert.equal(await failed.context.closePresenterOutputBrowserWindow(), true);
  assert.deepEqual(failed.events, ['close']);

  const denied = fixture();
  denied.document.documentElement.requestFullscreen = async () => { throw Error('no activation'); };
  await denied.context.enterPresenterOutputFullscreen().catch(() => {});
  assert.equal(await denied.context.closePresenterOutputBrowserWindow(), true);
  assert.deepEqual(denied.events, ['close']);
  console.log('PASS fullscreen entry/exit ordering, duplicate close, denied entry, failed exit retry');
})().catch(error => { console.error(error); process.exitCode = 1; });
