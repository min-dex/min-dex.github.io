const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
require('../mindex.setlist-links.js');
const links = globalThis.MindexSetlistLinks;
const app = fs.readFileSync(require.resolve('../app.js'), 'utf8');
const index = links.buildIndex([
  {id:'a',title:'동명곡'}, {id:'b',title:'동명곡',hymn_no:'91'},
  {id:'c',title:'셋째 곡'}, {id:'d',title:'마지막 곡'},
]);
const connection = groupId => ({groupId});
const snapshot = {
  services:[{id:'s',service_date:'2026-10-04',service_type_id:'sun_3rd'}],
  sections:[{id:'p',service_id:'s',sort_order:1,title:'찬양'}],
  elements:[
    {id:'1',song_id:'a',connectedPraise:connection('pair')},
    {id:'2',song_id:'b',source_connectedPraise:connection('pair')},
    {id:'3',song_id:'a',connected_praise:connection('triple')},
    {id:'4',title:'직접 입력',source_connected_praise:connection('triple')},
    {id:'5',song_id:'c',config:{connectedPraise:connection('triple')}},
    {id:'6',song_id:'d'},
    {id:'7',song_id:'a',connectedPraise:connection('orphan')},
    {id:'8',song_id:'b',connectedPraise:connection('orphan'),template_suppressed:true},
  ].map((row,i)=>({...row,section_id:'p',sort_order:i,element_type:'praise',label:`찬양 ${i+1}`})),
};
const before = JSON.stringify(snapshot);
const result = links.fromServices(snapshot, [], index);
assert.deepEqual(result.candidates.map(c=>c.raw_label),['찬양 1–2','찬양 3–5','찬양 6','찬양 7']);
assert.equal(JSON.stringify(snapshot),before);
assert.equal(result.candidates[0].archive_members.length,2);
assert.equal(result.candidates[3].archive_members,undefined);
const separated = JSON.parse(JSON.stringify(snapshot));
separated.elements[1].section_id = 'other';
separated.sections.push({id:'other',service_id:'s',sort_order:2,title:'찬양'});
assert.equal(links.fromServices(separated,[],index).candidates.find(c=>c.id==='1').archive_members,undefined,
  'matching group IDs cannot fold across sections');
const interrupted = JSON.parse(JSON.stringify(snapshot));
interrupted.elements.splice(1,0,{id:'gap',section_id:'p',sort_order:0.5,element_type:'praise',song_id:'d',label:'찬양'});
assert.equal(links.fromServices(interrupted,[],index).candidates.find(c=>c.id==='1').archive_members,undefined,
  'a standalone song must keep its position between disconnected members');
const context = {
  window:{MindexSetlistLinks:links}, state:{worshipSetlistSongCatalog:{index}},
  worshipAppServiceTypeId:id=>id,
  serviceTypeSortOrder:id=>({children:10,nursery:11,youth:12}[id] ?? 20),
};
vm.createContext(context);
for(const name of ['worshipSetlistCandidateLinks','worshipSetlistArchiveTypeOrder','renderSearchResultsForCurrentModule']) {
  const start=app.indexOf(`function ${name}(`);
  vm.runInContext(app.slice(start,app.indexOf('\n}\n',start)+2),context);
}
const matches=context.worshipSetlistCandidateLinks(result.candidates[0]);
assert.deepEqual(Array.from(matches,m=>m.song.id),['a','b'],'each explicit DB link survives same-title medley');
assert.deepEqual(Array.from(matches,m=>m.text),['동명곡','91 동명곡']);
assert.deepEqual(Array.from(context.worshipSetlistCandidateLinks(result.candidates[1]),m=>m.status),['linked','excluded','linked']);
assert(context.worshipSetlistArchiveTypeOrder('nursery') < context.worshipSetlistArchiveTypeOrder('children'));
let renders=0;
Object.assign(context,{
  SERVICE_SETLIST_ARCHIVE_PANEL_ID:'archive',renderSongList(){},
  isServiceDataModule:()=>['home','service','presenter','bulletin'].includes(context.state.module),
  renderServiceSetlistArchiveDetail(){renders++;},renderDetail(){},
});
for(const module of ['home','service']) {
  context.state.module=module;context.state.selectedServiceTypeId='archive';
  context.renderSearchResultsForCurrentModule();
}
assert.equal(renders,2,'search rerenders both home and service archive routes');
context.state.module='home';context.state.selectedServiceTypeId='recent';
context.renderSearchResultsForCurrentModule();assert.equal(renders,2);
console.log('PASS linked medley ranges, member IDs/manual text, suppressed members, nursery order and home archive search');
