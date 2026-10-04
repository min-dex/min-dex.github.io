const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'mindex.worship-input.js'), 'utf8');
const start = source.indexOf('function isMainPraiseSlotItem(');
const end = source.indexOf('\n// Inserts a real row', start);
assert.ok(start >= 0 && end > start);
const context = {
  parseServiceItemMemo: memo => memo ? JSON.parse(memo) : {}, serializeServiceItemMemo: value => JSON.stringify(value),
  serviceItemSlotKey: item => item._worshipSlotKey || '',
  isMainPraiseLabel: label => /^찬양\s*\d*$/u.test(String(label || '').trim()),
  isMainPraiseServiceItem: item => item._worshipSectionKey === 'praise',
  serviceItemLinkedSong: item => ({ a: { title: '곡 A' }, b: { title: '곡 B' }, c: { title: '곡 C' } })[item.song_id] || null,
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
const group = { groupId: 'medley', role: 'primary', primaryItemId: 'a', itemIds: ['a', 'b'], title: '곡 A + 곡 B' };
const items = [
  { id: 'a', label: '찬양 4', song_id: 'a', memo: JSON.stringify({ connectedPraise: group }), _worshipSectionKey: 'praise', _worshipSlotKey: 'praise.song.4' },
  { id: 'b', label: '찬양 4', song_id: 'b', memo: JSON.stringify({ connectedPraise: { ...group, role: 'secondary' } }), _worshipSectionKey: 'praise', _worshipSlotKey: 'praise.song.4' },
  { id: 'c', label: '찬양 5', song_id: 'c', memo: '', _worshipSectionKey: 'praise', _worshipSlotKey: 'praise.song.5' },
  { id: 'entrance', label: '입례찬양', memo: '', _worshipSectionKey: 'entrance_praise', _worshipSlotKey: 'praise.entrance' },
];
context.normalizeMainPraiseSlots({}, items);
assert.deepEqual(items.map(item => item.label), ['찬양 1', '찬양 2', '찬양 3', '입례찬양']);
assert.deepEqual(JSON.parse(items[0].memo).connectedPraise.itemIds, ['a', 'b']);
items.splice(1, 1);
context.normalizeMainPraiseSlots({}, items);
assert.deepEqual(items.map(item => item.label), ['찬양 1', '찬양 2', '입례찬양']);
assert.equal(JSON.parse(items[0].memo).connectedPraise, undefined);
console.log('PASS main praise slots: medley expansion and deletion keep concrete slots consecutive');
