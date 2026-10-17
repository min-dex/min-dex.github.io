const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync(require('node:path').join(__dirname, '../app.js'), 'utf8');
const start = source.indexOf('async function loadScriptureBooksOnce(');
const end = source.indexOf('\nasync function loadServiceData(', start);
async function check(initial, current, error = null) {
  let resolve; const response = new Promise(r => resolve = r);
  let renders = 0, lists = 0, verses = 0, persisted = 0;
  const state = {module: initial, selectedBookCode:'GEN', bibleTranslations:[{}], scriptureBooks:[]};
  const query = {select(){return this},eq(){return this},order(){return response}};
  state.client = {from(table){assert.equal(table,'mindex_scripture_books');return query}};
  const context = vm.createContext({state, requireClient:()=>true, renderLoadingStatus(){},
    renderScriptureList(){lists++}, normalizeServerScriptureBook:x=>x, sortBibleBooks:()=>0,
    clearSelectedBookOutsideFilter(){}, persistUiState(){persisted++}, render(){renders++},
    loadBibleBookVerses:async()=>{verses++}, showToast(){}});
  vm.runInContext(source.slice(start,end),context);
  const task = context.loadScriptureBooksOnce({silent:true});
  assert.equal(state.scriptureBooksLoading,true);
  state.module=current;resolve({data:[{code:'GEN'}],error});await task;
  assert.equal(state.scriptureBooksLoading,false);
  assert.equal(renders,!error && current==='scripture' ? 1 : 0,'background lookup rebuilt another module');
  assert.equal(persisted,error ? 0 : 1);
  assert.equal(verses,error ? 0 : 1,'existing selected-book loading changed');
  assert.equal(state.scriptureBooks.length,error ? 0 : 1);
}
(async()=>{
  for(const [initial,current] of [['presenter','presenter'],['home','home'],['scripture','scripture'],['scripture','presenter'],['presenter','scripture']])await check(initial,current);
  await check('presenter','presenter',{message:'fixture failure'});
  console.log('PASS background scripture lookup preserves non-scripture DOM; current module, selected book and errors remain correct');
})().catch(error=>{console.error(error);process.exitCode=1});
