const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const modules = ['mindex.presenter-praise.js', 'mindex.presenter-live.js', 'mindex.presenter-board.js', 'mindex.presenter-controller.js'];
const html = read('index.html');
const moduleList = html.slice(html.indexOf('const modules = ['), html.indexOf('const styles = ['));
const packaged = JSON.parse(read('package.json')).build.files;
for (const file of modules) {
  assert(packaged.includes(file), file + ' must ship in desktop');
  assert(moduleList.indexOf('"mindex.presenter.js"') < moduleList.indexOf('"mindex.presenter-controller.js"'));
  assert.equal(moduleList.split('"' + file + '"').length - 1, 1, file + ' loads exactly once');
  assert(moduleList.indexOf('"' + file + '"') < moduleList.indexOf('"app.js"'), file + ' must be ready before bootstrap');
  // Presenter model constants must initialize before controller compatibility tables.
  // No app state, DOM, storage or database objects are available.
  const context = vm.createContext({});
  const presenter = read('mindex.presenter.js');
  const modelStart = presenter.indexOf('const PRESENTER_ELEMENT_TYPES = {');
  const modelEnd = presenter.indexOf('const PRESENTER_SONG_NOTE =', modelStart);
  assert(modelStart >= 0 && modelEnd > modelStart);
  vm.runInContext(presenter.slice(modelStart, modelEnd), context);
  vm.runInContext(read(file), context, {filename:file});
  assert(Object.values(context).every(value => typeof value === 'function'));
}
const styles = html.slice(html.indexOf('const styles = ['), html.indexOf('const retryUrl ='));
assert.match(styles, /"styles.css", "styles.workspace.css", "styles.presenter-output.css"/);
assert(packaged.includes('styles*.css'), 'all ordered styles must ship in desktop');
const source = read('app.js');
assert(!source.includes('function runPresenterAction('), 'controller has one owner');
assert(!read('mindex.presenter.js').includes('function presenterFormPlanForServiceItem('), 'praise planner has one owner');
console.log('PASS runtime modules load once before bootstrap without side effects; desktop assets and CSS cascade order retained');
