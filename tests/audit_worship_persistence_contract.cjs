const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const persistence = fs.readFileSync(path.join(__dirname, '../mindex.worship-persistence.js'), 'utf8');
function extract(name, async = false, sourceText = source) {
  const source = sourceText;
  const start = source.indexOf(`${async ? 'async ' : ''}function ${name}(`);
  assert.ok(start >= 0, `Missing function ${name}`);
  return source.slice(start, source.indexOf('\n}\n', start) + 2);
}
assert.ok(!source.includes('MINDEX_WORSHIP_ATOMIC_PROTOCOL'), 'retired protocol switch returned');
for (const name of ['saveWorshipServiceInstance', 'saveWorshipServiceElementPatch',
  'persistSundayEditSync', 'insertWorshipServicesWithCalendarAssignees', 'deleteService']) {
  const body = extract(name, true);
  assert.ok(body.includes('await worshipAtomicClient()'), `${name}: missing RPC client`);
  assert.doesNotMatch(body, /\.from\(["']mindex_worship_(?:services|sections|elements)["']\)/,
    `${name}: direct instance storage returned`);
  assert.doesNotMatch(body, /if\s*\(atomic\)/, `${name}: optional RPC returned`);
}
const validation = {
  WORSHIP_DB_ELEMENT_TYPES: new Set(['plain_text']),
  WORSHIP_DB_ELEMENT_INPUT_MODES: new Set(['']),
  normalizeServiceInputMode: x => x || '',
  normalizeServiceAsset: x => x || {}, hasServiceAsset: () => false,
  normalizeWorshipSlotKey: x => x || '',
};
vm.createContext(validation);
vm.runInContext(extract('validateWorshipPersistenceRows', false, persistence), validation);
const validRows = {
  sections: [{id:'section',service_id:'service',created_at:'now',updated_at:'now'}],
  elements: [{id:'item',section_id:'section',element_type:'plain_text',created_at:'now',updated_at:'now'}],
};
const validate = rows => validation.validateWorshipPersistenceRows(rows, {serviceId:'service'});
assert.doesNotThrow(() => validate(validRows));
assert.doesNotThrow(() => validate({sections:[],elements:[]}));
assert.throws(() => validate({...validRows,sections:[{...validRows.sections[0],service_id:'foreign'}]}), /service ownership mismatch/);
assert.throws(() => validate({...validRows,elements:[{...validRows.elements[0],section_id:'foreign'}]}), /section is not in this save/);
assert.throws(() => validate({...validRows,sections:[...validRows.sections,...validRows.sections]}), /duplicate id/);
assert.throws(() => validate({...validRows,elements:[...validRows.elements,...validRows.elements]}), /duplicate id/);
console.log('PASS mandatory RPC writes, payload ownership, and duplicate ID guards');
