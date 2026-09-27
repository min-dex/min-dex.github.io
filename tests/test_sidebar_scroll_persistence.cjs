const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('app.js', 'utf8');
const session = new Map();
const context = {
  STORAGE: { listScroll: 'mindex.ui.listScroll' },
  state: {
    listScroll: {},
    module: 'presenter',
    selectedServiceId: 'service-a',
    presenter: { viewServiceId: '' },
    search: '',
  },
  normalizeSearchValue: value => String(value || '').trim().toLowerCase(),
  isGlobalSearchActive: () => false,
  safeStorageGet: (_scope, key, fallback = '') => session.has(key) ? session.get(key) : fallback,
  safeStorageSet: (_scope, key, value) => { session.set(key, value); return true; },
  safeStorageRemove: (_scope, key) => { session.delete(key); return true; },
};
vm.createContext(context);
for (const name of ['readListScrollState', 'persistListScrollState', 'getListScrollKey']) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf('\n}\n', start) + 2;
  vm.runInContext(source.slice(start, end), context);
}

assert.equal(context.getListScrollKey(), 'presenter:service-a:');
context.state.listScroll = { 'presenter:service-a:': 480, 'presenter:service-b:': 960 };
context.persistListScrollState();
context.state.listScroll = context.readListScrollState();
assert.deepEqual(JSON.parse(JSON.stringify(context.state.listScroll)), {
  'presenter:service-a:': 480,
  'presenter:service-b:': 960,
});
context.state.selectedServiceId = 'service-b';
assert.equal(context.getListScrollKey(), 'presenter:service-b:');
console.log('PASS presenter sidebar scroll persists per service in the current session');
