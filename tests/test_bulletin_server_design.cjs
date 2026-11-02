const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({window:{}});
for(const file of ['mindex.inline-text.js','mindex.bulletin-forest.js','mindex.bulletin.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
const B=c.window.MindexBulletin,F=c.window.MindexBulletinForest,plain=x=>JSON.parse(JSON.stringify(x));
const style=F.normalizeAppearance({palette:{cover:'#abcdef',ink:'url(evil)'},labels:{newsTitle:'',unknown:'discard'},visible:{readingHelp:true,unknown:true},assets:{logo:'javascript:evil'}});
assert.equal(style.palette.cover,'#abcdef');assert.equal(style.palette.ink,'#294b3b');assert.equal(style.labels.newsTitle,'');
assert.equal(style.assets.logo,'assets/bulletin/children-mark-2026-11.png');assert.equal(Object.hasOwn(style.visible,'unknown'),false);
const source={id:'children-server-design',department:'children',date:'2026-11-08',eventsMonth:'2026-11',order:[],sermon:'주간 설교'};
const doc={...B.normalizeSnapshot({fields:{news:'작성한 광고',memoryVerse:'작성한 성구',coverTitle:'',welcome:'내가 쓴 환영'},months:{'2026-11':'작성한 일정'},inherited:{common:{church:'내 교회'},months:{}},settings:{design:'children-forest',appearance:style}}),source};
const before=plain({fields:doc.fields,months:doc.months,inherited:doc.inherited,source:doc.source});
doc.frames.find(f=>f.id==='newsTitle').family='MindexChildrenTheme';doc.frames.find(f=>f.id==='newsTitle').weight=400;
const value=B.templateValue(doc),row={template_key:'children-forest',revision:7,...value};
assert.equal(value.department,'children');assert.equal(Object.hasOwn(value.common,'news'),false);assert.equal(Object.hasOwn(value.common,'memoryVerse'),false);assert.equal(Object.hasOwn(value.common,'coverTitle'),false);
B.applyTemplate(doc,row,{common:false});assert.deepEqual(plain({fields:doc.fields,months:doc.months,inherited:doc.inherited,source:doc.source}),before);
const stored=B.storedValue(doc),restored={};B.applyStored(restored,{revision:4,...stored});
assert.equal(restored.settings.templateKey,'children-forest');assert.equal(restored.settings.templateRevision,7);
assert.deepEqual(plain(restored.settings.appearance),plain(style));assert.equal(restored.frames.find(f=>f.id==='newsTitle').family,'MindexChildrenTheme');
assert.equal(restored.fields.coverTitle,'');assert.equal(restored.fields.news,'작성한 광고');
assert.throws(()=>B.normalizeTemplate({...row,department:'young-adult'}),/공통 양식/);
assert.throws(()=>B.applyTemplate({...doc,source:{...source,department:'young-adult'}},row),/다른 부서/);
assert.throws(()=>B.normalizeTemplate({...row,layout:{design:'simple'}}),/부서 공통/);
const bad=B.normalizeSnapshot({settings:{design:'children-forest'},frames:[{id:'newsTitle',family:'url(evil)',weight:999}]});
assert.equal(bad.frames[0].family,undefined);assert.notEqual(bad.frames[0].weight,999);
console.log('PASS server appearance validation, department identity, content/blank/month preservation and template-key/font roundtrip');

for(const design of ['simple','editorial','ink','panels','children','children-forest']){
 const department=design.startsWith('children')?'children':'young-adult';
 const d={...B.normalizeSnapshot({settings:{design,appearance:{palette:{ink:'#123456'},labels:{newsTitle:'',unknown:'discard'},assets:{logo:'javascript:evil'}}},fields:{welcome:'',news:'authored'},inherited:{common:{staff:'inherited'},months:{}},months:{'2026-11':'my month'}}),source:{...source,department}};
 const v=B.templateValue(d),r={template_key:B.TEMPLATE_KEYS[department],revision:1,...v};
 assert.equal(v.layout.design,design);assert.equal(v.layout.appearance.labels.newsTitle,'');
 assert.equal(v.layout.appearance.palette.ink,'#123456');assert.ok(!v.layout.appearance.assets.logo.startsWith('javascript:'));
 const before=JSON.stringify({fields:d.fields,inherited:d.inherited,months:d.months,source:d.source});
 B.applyTemplate(d,r,{common:false});
 assert.equal(JSON.stringify({fields:d.fields,inherited:d.inherited,months:d.months,source:d.source}),before);
 assert.equal(B.normalizeSnapshot(B.storedValue(d).content).fields.welcome,'');
}
console.log('PASS all six design defaults, safe appearance and layout-only content preservation');

for(const verticalAlign of ['top','middle','bottom']){
 const d={...B.normalizeSnapshot({settings:{design:'children-forest'},frames:[{id:'newsTitle',verticalAlign}]}),source};
 assert.equal(d.frames.find(f=>f.id==='newsTitle').verticalAlign,verticalAlign);
 const restored={};B.applyStored(restored,{revision:2,...B.storedValue(d)});
 assert.equal(restored.frames.find(f=>f.id==='newsTitle').verticalAlign,verticalAlign);
 const template={template_key:'children-forest',revision:2,...B.templateValue(d)};
 assert.equal(B.normalizeTemplate(template).layout.frames.find(f=>f.id==='newsTitle').verticalAlign,verticalAlign);
}
assert.equal(B.normalizeSnapshot({frames:[{id:'newsTitle',verticalAlign:'url(evil)'}]}).frames.find(f=>f.id==='newsTitle').verticalAlign,undefined);
assert.equal(B.normalizeSnapshot().frames.find(f=>f.id==='newsTitle').verticalAlign,undefined);
console.log('PASS frame vertical alignment enum, issue/template roundtrip and unchanged default');
