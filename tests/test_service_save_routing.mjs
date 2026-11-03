import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const start = source.indexOf('async function saveServiceItemPatch(');
const end = source.indexOf('async function saveWorshipServiceElementPatch(', start);
const functions = source.slice(start, end);

function fixture({newItem=false, structural=false, outcome=false, unsupported=false}={}) {
  const item={id:'item',memo:'authored lyrics / timing'};
  const sibling={id:'other',memo:'unsaved sibling'};
  const calls=[];
  const state={selectedServiceId:'service',saving:false,services:[{id:'service'}],
    dirtyServiceStructureIds:new Set(structural?['service']:[])};
  const ctx=vm.createContext({state,Set,JSON,Boolean,Error,
    requireClient:()=>true,getServiceItems:()=>[item,sibling],isUuid:()=>!newItem,
    saveService:async()=>{calls.push('full');return true;},
    validateServiceItemScriptureInput:async()=>calls.push('validate'),
    runServiceSave:async(_options,save)=>{try{return await save();}catch{return false;}},
    saveWorshipServiceElementPatch:async()=>{calls.push('patch');
      if(unsupported)return false;
      if(!outcome)throw Error('response lost');
      return {unchanged:true};},
    clearServiceElementDirty(){},finishServiceSaveDirtyState(){},showToast(){},renderServiceList(){},
  });
  vm.runInContext(functions,ctx);
  return {ctx,calls,item,sibling};
}

test('failed/uncertain item save does not retry or save sibling drafts',async()=>{
  const {ctx,calls,item,sibling}=fixture();
  assert.equal(await vm.runInContext('saveServiceItemMutation("service",0)',ctx),false);
  assert.deepEqual(calls,['validate','patch']);
  assert.equal(item.memo,'authored lyrics / timing');assert.equal(sibling.memo,'unsaved sibling');
});

test('successful item edit uses one patch; structural and unsupported saves use one full save',async()=>{
  for(const mode of [{outcome:true},{newItem:true},{structural:true},{unsupported:true}]) {
    const {ctx,calls}=fixture(mode);
    assert.equal(await vm.runInContext('saveServiceItemMutation("service",0)',ctx),true);
    assert.deepEqual(calls,mode.outcome?['validate','patch']:mode.unsupported?['validate','patch','full']:['full']);
  }
});

test('blocked item save does not broaden its scope',async()=>{
  const {ctx,calls}=fixture();
  assert.equal(await vm.runInContext('saveServiceItemMutation("service",99)',ctx),false);
  assert.deepEqual(calls,[]);
});
