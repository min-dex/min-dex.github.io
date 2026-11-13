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
