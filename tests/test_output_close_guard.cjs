const {test} = require('node:test');
const assert = require('node:assert/strict');
const {EventEmitter} = require('node:events');
const create = require('../electron/output-close-guard');
function setup() {
  const app = new EventEmitter(), window = new EventEmitter();
  window.webContents = new EventEmitter(); window.isDestroyed = () => false;
  let active = true, choice = 0, prompts = 0, cancelledStream = false;
  create({app, getWindow:()=>window, isActive:()=>active,
    dialog:{showMessageBoxSync:(_window, options)=>{
      prompts++; assert.equal(options.defaultId, 0); assert.equal(options.cancelId, 0); return choice;
    }}}).bind(window);
  app.on('before-quit', event=>{ if (!event.defaultPrevented) cancelledStream = true; });
  const emit = (target, name) => { const event = {defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}}; target.emit(name,event); return event; };
  return {app,window,emit,setActive:v=>active=v,setChoice:v=>choice=v,
    get prompts(){return prompts;},get cancelledStream(){return cancelledStream;}};
}
test('closing the controller while output is active defaults to preserving output',()=>{
  const x=setup(); assert.equal(x.emit(x.window,'close').defaultPrevented,true);
  assert.equal(x.cancelledStream,false); assert.equal(x.prompts,1);
  x.setActive(false); assert.equal(x.emit(x.window,'close').defaultPrevented,false); assert.equal(x.prompts,1);
});
test('app quit cancellation is seen before downstream stream teardown',()=>{
  const x=setup(); assert.equal(x.emit(x.app,'before-quit').defaultPrevented,true);
  assert.equal(x.cancelledStream,false);
  x.setChoice(1); assert.equal(x.emit(x.app,'before-quit').defaultPrevented,false);
  assert.equal(x.cancelledStream,true);
  x.emit(x.window,'close'); assert.equal(x.prompts,2);
});
test('unsaved input cancelling unload restores the output guard for the next close',()=>{
  const x=setup();x.setChoice(1);x.emit(x.app,'before-quit');
  x.window.webContents.emit('will-prevent-unload');x.setChoice(0);
  assert.equal(x.emit(x.window,'close').defaultPrevented,true);assert.equal(x.prompts,2);
});
test('shared controller unload handler preserves web output and existing unsaved draft rules',()=>{
  const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
  const source=fs.readFileSync(path.join(__dirname,'../mindex.presenter-lifetime.js'),'utf8');
  let output=false,dirty=false;
  const context={window:{},state:{module:'praise'},isPresenterOutputWindowOpen:()=>output,hasDirtyChanges:()=>dirty};
  vm.runInNewContext(source.slice(source.indexOf('function handleControllerBeforeUnload(')),context);
  const call=()=>{const e={defaultPrevented:false,preventDefault(){this.defaultPrevented=true;}};context.handleControllerBeforeUnload(e);return e;};
  assert.equal(call().defaultPrevented,false);
  output=true;context.state.module='presenter';assert.equal(call().defaultPrevented,true);
  context.window.mindexElectron={isDesktop:true};assert.equal(call().defaultPrevented,false);
  context.state.module='praise';dirty=true;assert.equal(call().defaultPrevented,true);
  dirty=false;assert.equal(call().defaultPrevented,false);
});
