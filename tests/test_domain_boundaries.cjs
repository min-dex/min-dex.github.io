const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const app=fs.readFileSync('app.js','utf8'), constants=fs.readFileSync('mindex.constants.js','utf8');
const c={window:{},cleanList:v=>v.map(String).map(x=>x.trim()).filter(Boolean)};vm.createContext(c);vm.runInContext(constants,c);
Object.assign(c,c.window.MINDEX_APP_CONSTANTS);vm.runInContext(fs.readFileSync('mindex.worship-model.js','utf8'),c);
for(const name of ['SERVICE_ELEMENT_TYPE_UI_OPTIONS','SERVICE_ELEMENT_TYPE_ALIASES','PRESENTER_ROLE_ALIASES']){
 const a=app.indexOf('const '+name+' =');const ends=['\n};','\n];'].map(x=>app.indexOf(x,a)).filter(x=>x>=0);vm.runInContext(app.slice(a,Math.min(...ends)+3),c);
}
vm.runInContext('const SERVICE_ELEMENT_TYPES=new Set(["",...SERVICE_ELEMENT_TYPE_UI_OPTIONS.map(x=>x[0])]);',c);
const a=app.indexOf('const WORSHIP_DB_ELEMENT_INPUT_MODES =');vm.runInContext(app.slice(a,app.indexOf('\n]);',a)+4),c);
for(const name of ['normalizeWorshipElementType','normalizeServicePresenterRole','normalizeServiceOutputMode','validateServiceSourceRecordMetadata','serviceElementTypeValue','serviceInputModeValue','normalizeServiceElementType','normalizeServiceInputMode','canonicalPraiseTypes','normalizePraiseTypes','parseList','normalizeGeneratedVersionName','normalizeLyricsForCopy','splitFreeShowParagraphs']){
 const a=app.indexOf('function '+name+'(');assert.ok(a>=0,name);vm.runInContext(app.slice(a,app.indexOf('\n}\n',a)+2),c);
}
for(const [inputs,expected] of [[['말씀','Scripture','scripture_reading','scripture-reading','scripture reading','성경 봉독',' 성경  봉독 '],'scripture_reading'],[['찬양','PRAISE','ｐｒａｉｓｅ'],'praise'],[['제목 / 내용','제목  /  내용','title-content'],'title_content']])for(const input of inputs)assert.equal(c.normalizeServiceElementType(input),expected,input);
for(const input of ['직접 입력','직접입력','manual praise','manual-praise','manual_praise'])assert.equal(c.normalizeServiceInputMode(input),'manual_praise');
assert.equal(c.serviceElementTypeValue('말씀'),'');assert.equal(c.serviceInputModeValue('직접 입력'),'');
assert.equal(c.serviceElementTypeValue('scripture_reading'),'scripture_reading');assert.equal(c.serviceInputModeValue('manual_praise'),'manual_praise');
for(const unknown of ['toString','__proto__','not-known']){assert.equal(c.normalizeServiceElementType(unknown),'');assert.equal(c.normalizeServiceInputMode(unknown),'');}
const values=['어린이 찬양','ＣＣＭ','찬송가','children','복음 성가'];const before=JSON.stringify(values);
assert.equal(JSON.stringify(c.normalizePraiseTypes(values)),JSON.stringify(['hymn','ccm','children']));assert.equal(JSON.stringify(values),before);
assert.equal(JSON.stringify(c.canonicalPraiseTypes(['children','hymn','ccm','children','찬송가'])),JSON.stringify(['hymn','ccm','children']));
assert.equal(c.normalizeGeneratedVersionName(' Default '),'Default');
for(const name of ['KOREAN_BIBLE_BOOK_ABBREVIATIONS','ENGLISH_BIBLE_BOOK_ABBREVIATIONS','BIBLE_BOOK_ALIASES'])assert.ok(!app.includes('const '+name+' ='),name+' has one owner');
for(const key of ['TOB','JDT','WSD','SIR','BAR','1MA','2MA','GKE','DA1'])assert.ok(c.BIBLE_BOOK_ALIASES[key]?.length,key);
assert.equal(c.KOREAN_BIBLE_BOOK_ABBREVIATIONS.GEN,'창');
assert.deepEqual(Array.from(c.splitFreeShowParagraphs('\r\n혼자\r\n\r\n첫째\r\n둘째\r\n셋째\r\n\r\n끝\r\n')),['혼자','첫째\n둘째\n셋째','끝']);
console.log('PASS boundary aliases, strict internal values, canonical classification order, immutable sources, single Bible table owner, paragraph units');

for (const code of vm.runInContext('Array.from(SERVICE_ELEMENT_TYPES)',c).filter(Boolean)) {
  for (const input of [code, code.toUpperCase(), '  '+code.toUpperCase()+'  ']) assert.equal(c.normalizeServiceElementType(input),code,input);
}
for (const code of vm.runInContext('Array.from(WORSHIP_DB_ELEMENT_INPUT_MODES)',c).filter(Boolean)) {
  for (const input of [code, code.toUpperCase(), '  '+code.toUpperCase()+'  ']) assert.equal(c.normalizeServiceInputMode(input),code,input);
}
console.log('PASS every canonical element/input code with uppercase and surrounding spaces at import boundary');

for (const value of ['waiting loop','WAIT-LOOP','ｗａｉｔｉｎｇ＿ｌｏｏｐ']) assert.equal(c.normalizeServicePresenterRole(value),'waiting_loop');
for (const value of ['sheet music','SHEET-MUSIC','ｓｃｏｒｅ']) assert.equal(c.normalizeServiceOutputMode(value),'score');
for (const value of ['__proto__','constructor','toString']) {
  assert.equal(c.normalizeServicePresenterRole(value),'');
  assert.equal(c.normalizeServiceOutputMode(value),'');
}
for (const value of ['말씀','activity','scripture-reading','plain-text','성경 봉독','unknown']) assert.equal(c.normalizeWorshipElementType(value),c.normalizeServiceElementType(value));
const records=[{label:'찬양',elementType:'찬양',inputMode:'직접 입력',outputMode:'가사',formHint:'V2-C-V1',value:'원문'}];
const original=JSON.stringify(records);c.validateServiceSourceRecordMetadata(records);assert.equal(JSON.stringify(records),original);
for (const key of ['elementType','inputMode','outputMode']) assert.throws(()=>c.validateServiceSourceRecordMetadata([...records,{label:'두번째', [key]:'unrecognized'}]),/두번째.*unrecognized.*입력은 유지/);
c.validateServiceSourceRecordMetadata([{elementType:'요소'},{}]);
console.log('PASS safe unknown rejection, legacy parity, role/output aliases and prototype-key rejection');

// Identifier aliases are exact compatibility mappings, never display normalization.
for (const name of ['worshipAppServiceTypeId','templateProjectionSectionKey']) {
 const a=app.indexOf('function '+name+'(');vm.runInContext(app.slice(a,app.indexOf('\n}\n',a)+2),c);
}
c.PUBLIC_TEMPLATE_SECTION_KEY_ALIASES={closing_song:'closing_visual'};
for (const value of ['constructor','__proto__','Unknown ID']) {
 assert.equal(c.worshipAppServiceTypeId(value),value);
 assert.equal(c.templateProjectionSectionKey({sectionKey:value}),value);
}
assert.equal(c.worshipAppServiceTypeId('sun_1st'),'sunday-first');
assert.equal(c.templateProjectionSectionKey({sectionKey:'closing_song'}),'closing_visual');
console.log('PASS exact legacy identifiers preserve unknown strings');
