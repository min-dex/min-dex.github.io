const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('mindex.worship-persistence.js','utf8');
const c=vm.createContext({isUuid:v=>String(v).startsWith('stored-'),serviceItemSlotKey:x=>x.slot,
 normalizeWorshipSlotKey:x=>x||'',console:{warn(){}},normalizeServiceAsset:x=>x||{},hasServiceAsset:x=>!!x.url});
for(const name of ['worshipElementPersistenceSlotKey','existingElementForWorshipSave','removeSupersededWorshipSuppressionRows','worshipElementHasPersistedContent','shouldPreserveExistingWorshipElement','preserveExistingWorshipContentRows']){
 const start=source.indexOf(`function ${name}(`);vm.runInContext(source.slice(start,source.indexOf('\n}\n',start)+2),c);
}
const service={id:'service'},section={id:'section',service_id:service.id},sections={section};
const stored={id:'stored-ad',section_id:'section',body:'old ad',source_ref:{slotKey:'announcements.department'}};
const elements={[stored.id]:stored};const item={id:'temporary',_worshipTemplateProjected:true,slot:'announcements.department'};
assert.equal(c.existingElementForWorshipSave(service,item,[item],sections,elements),stored);
const edited={...stored,body:'edited ad'};const rows={sections:[section],elements:[edited]};
c.preserveExistingWorshipContentRows(rows,[section],[stored]);assert.equal(rows.elements.length,1);assert.equal(rows.elements[0].body,'edited ad');
assert.equal(c.existingElementForWorshipSave(service,item,[item,{id:stored.id}],sections,elements),null);
assert.equal(c.existingElementForWorshipSave(service,{...item,_worshipTemplateProjected:false},[item],sections,elements),null);
assert.equal(c.existingElementForWorshipSave({id:'other'},item,[item],sections,elements),null);
assert.equal(c.existingElementForWorshipSave(service,item,[item],sections,{...elements,duplicate:{...stored,id:'stored-second'}}),null);
for(const flag of ['templateSuppressed','template_suppressed']){
 const marker={...stored,id:'marker',config:{[flag]:true}};
 const r={elements:[marker,edited]};c.removeSupersededWorshipSuppressionRows(r);assert.deepEqual(r.elements,[edited]);
 const alone={elements:[marker]};c.removeSupersededWorshipSuppressionRows(alone);assert.equal(alone.elements.length,1);
}
const conflicting={elements:[stored,{...stored,id:'another',body:'different ad'}]};c.removeSupersededWorshipSuppressionRows(conflicting);assert.equal(conflicting.elements.length,2);
console.log('PASS projected slot identity, edited body preserved, ownership/ambiguity guards, superseded markers and active conflicts');
