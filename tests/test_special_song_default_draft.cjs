const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const app = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const item = { label: '특송', raw_title: '', assignee: '할렐루야 찬양대' };
const context = vm.createContext({
  compactSearchValue: value => String(value || '').replace(/\s+/g, ''),
  presenterPreparationFieldsForService: () => [{ label: '특송' }],
  servicePrepEditorItems: () => [item],
  presenterServiceInputItem: () => ({ mode: 'manual_praise', memo: {}, model: {} }),
  presenterServiceInputHasEditableField: () => true,
  isMonthlyCorporatePrayerGroupItem: () => false,
  servicePraiseInputMode: () => 'manual_praise',
  serviceItemLinkedSong: value => value.song,
  isSpecialSongServiceItem: () => true,
  cleanServiceAssignee: value => value.trim(),
  presenterPreparationPlaceholderSongLabel: value => value.label,
  presenterPreparationDraftFromFields: (_, fields) => fields.map(f => `${f.label}: ${f.value}`).join('\n'),
});
vm.runInContext(fs.readFileSync(path.join(__dirname, '../mindex.worship-input.js'), 'utf8'), context);
const start = app.indexOf('function presenterPreparationDefaultDraftForService(');
vm.runInContext(app.slice(start, app.indexOf('\nfunction ', start + 1)), context);
const draft = () => context.presenterPreparationDefaultDraftForService({ id: 'fixture' });
const before = JSON.stringify(item);
assert.equal(draft(), '특송: ');
const parsed = context.parsePresenterPreparationInput(draft(), { skipEmptyLabels: true });
assert.equal(parsed.entries.length, 0, 'assignee-only default must not become a song update');
assert.equal(parsed.errors.length, 0);
assert.equal(JSON.stringify(item), before, 'default generation must preserve assignee and title');
item.raw_title = '실제 곡명';
assert.equal(draft(), '특송: 실제 곡명 / 할렐루야 찬양대');
item.song = { title: '연결된 곡명' };
assert.equal(draft(), '특송: 연결된 곡명 / 할렐루야 찬양대');
item.assignee = '';
assert.equal(draft(), '특송: 연결된 곡명');
console.log('PASS special-song default draft preserves empty title, assignee and linked song');
