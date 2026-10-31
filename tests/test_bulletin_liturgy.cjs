const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const c=vm.createContext({window:{}});vm.runInContext(fs.readFileSync('mindex.inline-text.js','utf8'),c);vm.runInContext(fs.readFileSync('mindex.bulletin.js','utf8'),c);
const B=c.window.MindexBulletin;
const data={service:{id:'liturgy-fixture',service_type_id:'children',service_date:'2026-11-01'},sections:[],elements:[],songs:[{id:'song',title:'보존할 찬양'}],calendar:[]};
const rows=[
 ['creed','사도신경','faith.creed'],['opening','예배의 부름',''],['community_confession','공 동 체 고 백','community.confession'],
 ['lords_prayer','주 기 도 문','sending.lords_prayer'],['custom','함께 드리는 고백','faith.creed'],
 ['silent_prayer','묵도','prayer.silent'],['confession','참회기도','confession.prayer'],['confession','사죄의 선언','confession.assurance']
];
rows.forEach(([key,label,slotKey],i)=>{data.sections.push({id:'s'+i,section_key:key,title:label,sort_order:i});data.elements.push({id:'e'+i,section_id:'s'+i,element_type:'body',title:label,body:'LITURGY-'+i+' original body',person:'원래 담당',source_ref:{label,slotKey},sort_order:1});});
data.sections.push({id:'p',section_key:'creed',title:'신앙고백',sort_order:9},{id:'r',section_key:'scripture_reading',title:'성경봉독',sort_order:10},{id:'w',section_key:'sermon',title:'설교',sort_order:11},{id:'a',section_key:'announcements',title:'광고',sort_order:12});
data.elements.push({id:'song-row',section_id:'s0',element_type:'praise',song_id:'song',person:'원래 담당',source_ref:{label:'사도신경'},sort_order:2},
 {id:'reading',section_id:'r',element_type:'scripture_body',scripture_reference:'누가복음 10:25–37',sort_order:1},
 {id:'sermon',section_id:'w',element_type:'title_person',title:'신앙고백을 나누는 삶',person:'설교 담당',source_ref:{slotKey:'sermon.title'},sort_order:1},
 {id:'news',section_id:'a',element_type:'body',body:'사도신경을 배우는 사용자 광고',sort_order:1});
const original=JSON.stringify(data);
for(const compactOrder of [true,false]){
 const source=B.resolveSource({...data,settings:{compactOrder}}),before=JSON.stringify(source);
 const display=B.orderRowsForDisplay(source);
 for(let i=0;i<rows.length;i++)assert.equal(display.find(r=>r.id==='e'+i).content,'','all recognized liturgical bodies are display-only summaries');
 assert.equal(display.find(r=>r.id==='song-row').content,'보존할 찬양','a liturgical shared heading cannot swallow praise');
 assert.equal(display.find(r=>r.id==='reading').content,'누가복음 10:25–37');
 assert.equal(display.find(r=>r.id==='sermon').content,'신앙고백을 나누는 삶');
 assert.equal(source.news,'사도신경을 배우는 사용자 광고');
 assert.equal(display.find(r=>r.id==='e1').person,'원래 담당');
 assert.equal(JSON.stringify(source),before,'display must not mutate raw source');
 if(!compactOrder)assert.equal(source.order.find(r=>r.id==='e1').content,'LITURGY-1 original body');
 const doc={source,fields:{news:'직접 편집한 소식',outline:'사용자 요점'},settings:{compactOrder},frames:[]};
 const stored=B.storedValue(doc),snapshotBefore=JSON.stringify(stored),rawBody=stored.content.sourceSnapshot.weekly.order.find(r=>r.id==='e1').content;
 const frozen=B.applySourceSnapshot({...source,order:[]},stored.content.sourceSnapshot);
 assert.equal(B.orderRowsForDisplay(frozen).find(r=>r.id==='e1').content,'');
 const suppressed=B.resolveSource({...data,elements:data.elements.map(e=>({...e,config:{templateSuppressed:true}})),settings:{compactOrder}});
 const oldPublication=B.applySourceSnapshot(suppressed,stored.content.sourceSnapshot);
 assert.equal(B.orderRowsForDisplay(oldPublication).find(r=>r.id==='e4').content,'','a renamed, later-suppressed liturgy stays summary-only in its old publication');
 assert.equal(stored.content.sourceSnapshot.weekly.order.find(r=>r.id==='e1').content,rawBody);
 assert.equal(JSON.stringify(stored),snapshotBefore,'published snapshot and manual fields stay unchanged');
}
const legacy={order:[{id:'legacy',label:'공동체고백',content:'OLD LITURGY',person:'다같이'},{id:'custom',label:'특별 순서',content:'주기도문에 관한 사용자 안내',person:''}]};
const before=JSON.stringify(legacy),legacyDisplay=B.orderRowsForDisplay(legacy);
assert.equal(legacyDisplay[0].content,'');assert.equal(legacyDisplay[1].content,'주기도문에 관한 사용자 안내');
assert.equal(JSON.stringify(legacy),before);assert.equal(JSON.stringify(data),original,'worship aggregate is never changed');
console.log('PASS bulletin liturgy summaries by slot/type/section/legacy label, praise/scripture/sermon/news preservation and immutable snapshots');
