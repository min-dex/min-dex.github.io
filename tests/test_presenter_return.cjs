const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
let open=true;
const state={presenter:{serviceId:'s',outputSessionId:'one',index:0,slides:[{id:'a'},{id:'b'},{id:'c'}],liveScripture:{draft:'keep'},safetyBlank:false}};
const ctx=vm.createContext({state,structuredClone,isPresenterOutputWindowOpen:()=>open,
 suspendServiceMusicAutoSync(){},syncServiceMusicWithPresenterContext(){},clearPresenterBoardSelection(){},syncSelectedServiceItemToPresenterSlide(){},renderPresenterControlState(){},scrollPresenterOutlineToActive(){}});
const source=fs.readFileSync('mindex.presenter-controller.js','utf8');
vm.runInContext(fs.readFileSync('mindex.presenter-history.js','utf8'),ctx);
vm.runInContext('let liveScriptureRequestSerial=0;'+source.slice(0,source.indexOf('let prepareNextServiceRequestSerial'))+source.slice(source.indexOf('function presenterReturnTarget')),ctx);
const h=ctx.MindexPresenterHistory;
const publish=()=>h.record({...state.presenter,liveScripture:state.presenter.liveScripture});ctx.publishPresenterState=publish;
assert.equal(ctx.presenterReturnTarget('s'),null);publish();assert.equal(ctx.presenterReturnTarget('s'),null);
state.presenter.index=2;publish();assert.equal(ctx.presenterReturnTarget('s').id,'a');
ctx.runPresenterAction('return','s');assert.equal(state.presenter.index,0);assert.equal(ctx.presenterReturnTarget('s').id,'c');assert.equal(state.presenter.liveScripture.draft,'keep');
// Repeated state publication and blackout are not new slide history.
publish();state.presenter.safetyBlank=true;publish();assert.equal(ctx.presenterReturnTarget('s').id,'a');ctx.runPresenterAction('return','s');assert.equal(state.presenter.safetyBlank,false);
state.presenter.liveScripture={active:true,slide:{id:'live',text:'fixture'},draft:'keep'};publish();ctx.runPresenterAction('return','s');assert.equal(state.presenter.liveScripture.active,false);ctx.runPresenterAction('return','s');assert.equal(state.presenter.liveScripture.slide.text,'fixture');assert.equal(state.presenter.liveScripture.draft,'keep');
assert.equal(ctx.presenterReturnTarget('other'),null);open=false;assert.equal(ctx.presenterReturnTarget('s'),null);open=true;
state.presenter.liveScripture.active=false;state.presenter.index=2;publish();state.presenter.slides.reverse();ctx.runPresenterAction('return','s');assert.equal(state.presenter.liveScripture.active,true);
state.presenter.outputSessionId='two';publish();assert.equal(ctx.presenterReturnTarget('s'),null);
h.reset();state.presenter.slides=[{id:'a'},{id:'b'}];state.presenter.index=0;state.presenter.liveScripture.active=false;publish();state.presenter.index=1;publish();state.presenter.slides=[{id:'b'}];assert.equal(ctx.presenterReturnTarget('s'),null);
console.log('PASS actual output order, repeat, blackout, live scripture, draft retention, session boundary, missing target');
