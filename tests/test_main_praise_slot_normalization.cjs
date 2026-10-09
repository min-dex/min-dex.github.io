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
  { id: 'entrance', label: '입례찬양', memo: '', _worshipSectionKey: 'entrance_praise', _worshipSlotKey: 'praise.entrance' },
  { id: 'b', label: '찬양 4', song_id: 'b', memo: JSON.stringify({ connectedPraise: { ...group, role: 'secondary' } }), _worshipSectionKey: 'praise', _worshipSlotKey: 'praise.song.4' },
  { id: 'c', label: '찬양 5', song_id: 'c', memo: '', _worshipSectionKey: 'praise', _worshipSlotKey: 'praise.song.5' },
];
context.normalizeMainPraiseSlots({}, items);
assert.deepEqual(items.map(item => item.label), ['찬양 1', '찬양 2', '찬양 3', '입례찬양']);
assert.deepEqual(items.map(item => item.id), ['a', 'b', 'c', 'entrance']);
assert.deepEqual(JSON.parse(items[0].memo).connectedPraise.itemIds, ['a', 'b']);
items.splice(1, 1);
context.normalizeMainPraiseSlots({}, items);
assert.deepEqual(items.map(item => item.label), ['찬양 1', '찬양 2', '입례찬양']);
assert.equal(JSON.parse(items[0].memo).connectedPraise, undefined);
console.log('PASS main praise slots: medley expansion and deletion keep concrete slots consecutive');

// Sunday third shares the praise section; the next hierarchy projection sorts
// by element order after normalizeMainPraiseSlots has repaired the array order.
const appSource = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
const compareStart = appSource.indexOf('function compareServiceItemsByTemplateHierarchy(');
vm.runInContext(appSource.slice(compareStart, appSource.indexOf('\n}', compareStart) + 2), context);
const sunday = [
  { id:'welcome',label:'환영',memo:'',_worshipSlotKey:'praise.welcome',_worshipElementOrder:1 },
  { id:'entrance',label:'입례찬양',memo:'',_worshipSlotKey:'praise.entrance',_worshipElementOrder:2 },
  ...Array.from({length:4},(_,i)=>({id:`song${i+1}`,label:`찬양 ${i+1}`,memo:'',_worshipSlotKey:`praise.song.${i+1}`,_worshipElementOrder:i+3})),
].map(item=>({...item,_worshipSectionKey:'praise',_worshipSectionOrder:2}));
for (let pass=0;pass<2;pass++) {
  context.normalizeMainPraiseSlots({type_id:'sunday-third'},sunday);
  sunday.sort(context.compareServiceItemsByTemplateHierarchy);
  assert.deepEqual(sunday.map(item=>item.id),['welcome','song1','song2','song3','song4','entrance']);
  assert.equal(sunday.at(-1)._worshipElementTemplateModified,true);
  // Saving uses compact per-section sort_order values; exercise a reload too.
  sunday.forEach((item,index)=>{item._worshipElementOrder=index+1});
}
console.log('PASS Sunday third entrance remains after main praise through hierarchy sort and save/reload order');
