const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const persistence = fs.readFileSync(path.join(root, 'mindex.worship-persistence.js'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
assert.ok(index.indexOf('"mindex.worship-persistence.js"') >= 0);
assert.ok(index.indexOf('"mindex.worship-persistence.js"') < index.indexOf('"app.js"'),
  'Save-row helpers must load before app integration');
const names = [
  'validateWorshipPersistenceRows', 'sanitizeWorshipPersistenceRows',
  'sanitizeSongContentStateWithoutSong', 'compactWorshipPersistenceRows',
  'normalizeWorshipPersistenceSortOrders', 'worshipElementPersistenceSlotKey',
  'worshipElementHasPersistedContent', 'shouldPreserveExistingWorshipElement',
  'preserveExistingWorshipContentRows', 'isUnmodifiedTemplatePlaceholder',
  'ensureUniqueServiceItemPersistenceIds', 'buildWorshipPersistenceRows',
  'serviceElementContentStateForSave', 'serviceItemManualBodyForSave',
  'serviceElementTypeForSave', 'worshipDbElementTypeForSave',
  'serviceElementTitleForSave', 'serviceElementConfigForSave',
  'serviceElementSourceRefForSave',
];
for (const name of names) {
  const declaration = new RegExp(`^function ${name}\\(`, 'gm');
  assert.equal([...persistence.matchAll(declaration)].length, 1, `${name}: persistence owner`);
  assert.equal([...app.matchAll(declaration)].length, 0, `${name}: duplicate app owner`);
}
assert.doesNotMatch(persistence, /\b(?:state|refs|client|window)\.|\bdocument\.(?:querySelector|getElementById|createElement)|\b(?:fetch|localStorage|BroadcastChannel)\s*\(/,
  'Persistence rules must not perform I/O or directly access controller state');
new vm.Script(persistence, { filename: 'mindex.worship-persistence.js' });
new vm.Script(app, { filename: 'app.js' });
console.log(`PASS persistence ownership and syntax (${names.length} save-row helpers)`);
