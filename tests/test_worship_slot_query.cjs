const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const calls = [];
const finish = new Map();
const context = {
  state: {singleSongStorage: 'legacy'},
  WORSHIP_ELEMENT_BASE_LIST_SELECT: 'id,source_ref,config,input_mode,content_state',
  detectTableColumnSupport: async (table, column) => {
    calls.push([table, column]);
    assert.notEqual(column, 'slot_key', 'The current DB has no live-element slot_key column');
    return new Promise(resolve => finish.set(column, resolve));
  },
};
vm.createContext(context);
for (const name of ['worshipElementListSelect', 'worshipElementTypedStateColumns']) {
  const start = source.indexOf(`async function ${name}(`);
  const end = source.indexOf('\n}', start) + 2;
  assert(start >= 0 && end > start);
  vm.runInContext(source.slice(start, end), context);
}
(async () => {
  assert.equal(await context.worshipElementListSelect(), context.WORSHIP_ELEMENT_BASE_LIST_SELECT);
  context.state.singleSongStorage = 'native';
  assert.equal(await context.worshipElementListSelect(), context.WORSHIP_ELEMENT_BASE_LIST_SELECT + ',praise_record_id');
  assert.equal(calls.length, 0, 'Listing elements must not require a speculative schema request');
  const pending = context.worshipElementTypedStateColumns();
  assert.equal(calls.length, 2, 'Independent column probes must both start before either completes');
  finish.get('content_state')(true);
  finish.get('input_mode')(false);
  const columns = await pending;
  assert.equal(columns.inputMode, false);
  assert.equal(columns.contentState, true);
  assert.equal(columns.slotKey, undefined);
  assert.equal(calls.length, 2);
  console.log('PASS current-schema element read/write capabilities without slot_key probe');
})().catch(error => { console.error(error); process.exitCode = 1; });
