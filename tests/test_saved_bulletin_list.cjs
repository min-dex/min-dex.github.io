const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const app = fs.readFileSync('app.js', 'utf8');
const read = (start, end) => app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)));
let records = [], fail = false, incomplete = false, pending = null;
const calls = [], rendered = [];
const client = {from(table) {
  assert.equal(table, 'mindex_bulletins');
  const q = {select(value) {assert.equal(value, 'service_id');return q;}, order(value) {assert.equal(value, 'service_id');return q;}, async range(from,to) {
    calls.push([from,to]);
    const response = {data: records.slice(from,to+1), error: fail ? {code:'42501',message:'secret server error'} : null};
    if (pending) await new Promise(resolve => {pending.release=resolve;});
    return incomplete ? {data:null,error:null} : response;
  }};
  return q;
}};
const state = {client,config:{url:'one'},module:'service',search:'',services:[]};
const ctx = vm.createContext({window:{},state,SUPABASE_PAGE_SIZE:2,renderBulletinList(){rendered.push(true);},
  normalizeSearchValue:value=>String(value).toLowerCase(),bulletinPageTabTitle:()=> '주보',
  serviceSupportsBulletin:s=>s.department!==false});
vm.runInContext(read('async function fetchAllRows(', 'function chunkArray('),ctx);
vm.runInContext(read('function departmentInputError(', 'function setCalendarCellSaveState('),ctx);
vm.runInContext(fs.readFileSync('mindex.bulletin.js', 'utf8'),ctx);
vm.runInContext(read('const savedBulletinList =', 'function renderBulletinList('),ctx);
const savedBulletinList = vm.runInContext('savedBulletinList',ctx);
(async()=>{
  state.services=[{id:'old',date:'2026-09-27'},{id:'new',date:'2026-11-01'},{id:'unsaved',date:'2026-11-08'},{id:'other',date:'2026-11-09',department:false}];
  const before=JSON.stringify(state.services);
  assert.equal(await savedBulletinList.load(),true);
  assert.equal(ctx.getBulletinSidebarServices().length,0,'empty DB never substitutes worship rows');
  records=[{service_id:'old'},{service_id:'new'},{service_id:'other'},{service_id:'missing-service'}];
  calls.length=0;
  assert.equal(await savedBulletinList.load({force:true}),true);
  assert.deepEqual(calls,[[0,1],[2,3],[4,5]],'read every page');
  assert.deepEqual(Array.from(ctx.getBulletinSidebarServices(),s=>s.id),['new','old'],'stored historical bulletins remain visible; unsaved and unsupported services do not');
  state.search='2026-09';assert.equal(ctx.getBulletinSidebarServices()[0].id,'old');state.search='';
  fail=true;assert.equal(await savedBulletinList.load({force:true}),false);
  assert.match(savedBulletinList.state().error,/권한/);
  assert.equal(savedBulletinList.state().ids.size,4,'failed reads retain last confirmed IDs');
  fail=false;incomplete=true;assert.equal(await savedBulletinList.load({force:true}),false);
  assert.equal(savedBulletinList.state().ids.size,4,'incomplete response never acts like deletion');
  incomplete=false;records=[{}];assert.equal(await savedBulletinList.load({force:true}),false);
  records=[];assert.equal(await savedBulletinList.load({force:true}),true);
  assert.equal(ctx.getBulletinSidebarServices().length,0,'confirmed external deletion removes membership');
  pending={};const oldProjectRead=savedBulletinList.load({force:true});
  await Promise.resolve();state.config.url='two';savedBulletinList.state();
  pending.release();pending=null;assert.equal(await oldProjectRead,false);
  assert.equal(savedBulletinList.state().loaded,false,'old project results never populate new project');
  records=[];assert.equal(await savedBulletinList.load(),true);
  pending={};const beforeSave=savedBulletinList.load({force:true});await Promise.resolve();
  savedBulletinList.remember('new');pending.release();pending=null;
  assert.equal(await beforeSave,false,'a read begun before a successful save cannot remove it');
  assert.equal(savedBulletinList.state().ids.has('new'),true);
  assert.equal(JSON.stringify(state.services),before,'no worship rows were changed');
  console.log('PASS saved bulletin membership: empty, paginated, historical, search, deletion, errors, project/save races and worship preservation');
})().catch(error=>{console.error(error);process.exitCode=1;});
