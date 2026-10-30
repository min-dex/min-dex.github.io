const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('mindex.worship-model.js', 'utf8'), context);
const slot = context.explicitWorshipSlotKey;
assert.equal(slot({_worshipSlotKey: 'response.prayer'}), 'response.prayer');
assert.equal(slot({slotKey:'prayer.representative',slot_key:'prayer.meeting.free',_worshipSlotKey:'response.prayer'}), 'prayer.representative');
assert.equal(slot({slot_key:'prayer.meeting.free',_worshipSlotKey:'response.prayer'}), 'prayer.meeting.free');
assert.equal(slot({slotKey:'not-a-known-slot',_worshipSlotKey:'response.prayer'}), '', 'Invalid explicit metadata must not silently become another slot');
assert.equal(slot({slotKey:'prayer.representative'},{_worshipSlotKey:'response.prayer'}), 'prayer.representative', 'Earlier explicit sources keep precedence');
assert.equal(slot({_worshipSlotKey:'response.prayer'},{slotKey:'prayer.representative'}), 'prayer.representative', 'Runtime fallback must not outrank a later explicit source');
assert.equal(slot({_worshipSlotKey:'not-a-known-slot'},{slotKey:'response.prayer'}), 'response.prayer');
assert.equal(slot({_worshipSlotKey:'praise.song.3'}), 'praise.song.3');
assert.equal(slot({_worshipSlotKey:'prayer.corporate.2'}), 'prayer.corporate.2');
console.log('PASS runtime slot fallback and existing explicit/source precedence');

// Cache updates keep exact persisted identity even when legacy labels/slots collide.
const inputSource = fs.readFileSync('mindex.worship-input.js', 'utf8');
const start = inputSource.indexOf('function applyPresenterPreparationTextUpdateToWorshipElementCache(');
Object.assign(context, {
  compactSearchValue: value => String(value || '').replace(/\s/g, ''),
  cleanServiceAssignee: value => String(value || '').trim(),
  uniqueList: values => [...new Set(values)],
});
vm.runInContext(inputSource.slice(start, inputSource.indexOf('\n}\n', start)+2), context);
for (const secondSlot of ['response.prayer','prayer.meeting.free','prayer.representative']) {
  const rows = ['a','b'].map((id,index)=>({id,section_id:'section-'+id,person:'original '+id,body:'body '+id,
    source_ref:{label:'기도',slotKey:index ? secondSlot : 'prayer.representative',extension:id}}));
  const untouched = structuredClone(rows[1]);
  context.state = {worshipElements:rows,worshipSections:['a','b'].map(id=>({id:'section-'+id,service_id:'service',section_key:'prayer'}))};
  context.applyPresenterPreparationTextUpdateToWorshipElementCache({id:'service'},
    {id:'a',slotKey:'prayer.representative',sectionKey:'prayer',label:'기도',assignee:'changed',raw_title:''});
  assert.equal(rows[0].person,'changed');
  assert.deepEqual(rows[1],untouched,'Updating one persisted prayer must not rewrite another');
}
console.log('PASS distinct and legacy duplicate prayer cache rows retain exact identities');
