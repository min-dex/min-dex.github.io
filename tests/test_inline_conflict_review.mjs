import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const start=source.indexOf('async function runServiceSave('),end=source.indexOf('async function saveService(',start);
test('explicit inline save opens conflict review despite quiet success feedback',async()=>{
 for(const [message,review] of [['REVISION_CONFLICT',true],['ATOMIC_RELOAD_REQUIRED',true],['network lost',false]]){
  const calls=[];const state={saving:false};
  const ctx=vm.createContext({state,activeServiceSavePromise:null,console:{warn(){}},
   emitMonitorSaveEvent(){},beginServiceInputFeedback(){},finishServiceInputFeedback(){},updateSaveState(){},
   saveDirtyServiceTypes:async()=>{},serviceSaveErrorMessage:e=>e.message,showToast:m=>calls.push(m),
   openWorshipConflictReview:async id=>calls.push('review:'+id)});
  vm.runInContext(source.slice(start,end),ctx);ctx.fail=async()=>{throw Error(message)};
  assert.equal(await vm.runInContext('runServiceSave({silent:true,reviewConflict:true,feedbackServiceId:"service"},fail)',ctx),false);
  assert.equal(calls.includes('review:service'),review);assert.equal(state.saving,false);
 }
});
