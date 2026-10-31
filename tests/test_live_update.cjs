const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const ctx={window:{},location:{protocol:'file:',hostname:''}};
vm.runInNewContext(fs.readFileSync('mindex.live-update.js','utf8'),ctx);
function fixture(){
 let clock=0,blocked=false,next='release-two',reads=0,reloads=0,notice=false;
 const updater=ctx.window.MindexLiveUpdate.create({version:'release-one',now:()=>clock,
 readVersion:async()=>{reads++;if(next instanceof Error)throw next;return next},blocked:()=>blocked,
 notify:v=>notice=v,reload:()=>reloads++});
 return {u:updater,time:v=>clock=v,block:v=>blocked=v,next:v=>next=v,result:()=>({reads,reloads,notice})};
}
test('two confirmed observations and idle saved editor reload exactly once',async()=>{
 const f=fixture();f.time(6000);await f.u.check();assert.equal(f.result().reloads,0);
 await f.u.check();assert.equal(f.result().reloads,1);f.u.apply();await f.u.check();assert.equal(f.result().reloads,1);
});
test('dirty or pending work stays intact until blockers clear and typing stops',async()=>{
 const f=fixture();f.block(true);await f.u.check();await f.u.check();f.time(10000);assert.equal(f.u.apply(),false);
 f.block(false);f.u.touch();f.time(14999);assert.equal(f.u.apply(),false);f.time(15000);assert.equal(f.u.apply(),true);
});
test('offline, malformed and changing releases cannot force reload',async()=>{
 const f=fixture();f.time(6000);await f.u.check();f.next(new Error('offline'));await f.u.check();assert.equal(f.result().reloads,0);
 f.next('release-two');await f.u.check();assert.equal(f.result().reloads,0);
 f.next('<bad>');await f.u.check();f.next('release-three');await f.u.check();assert.equal(f.result().reloads,0);
 f.next('release-one');await f.u.check();assert.equal(f.result().notice,false);
});
test('a new edit during version fetch wins; stale confirmation expires',async()=>{
 let resolve,clock=6000,dirty=false,reloads=0;
 const u=ctx.window.MindexLiveUpdate.create({version:'release-one',now:()=>clock,readVersion:()=>new Promise(r=>resolve=r),blocked:()=>dirty,notify(){},reload:()=>reloads++});
 let p=u.check();resolve('release-two');await p;
 p=u.check();dirty=true;resolve('release-two');await p;assert.equal(reloads,0);
 dirty=false;clock=52000;assert.equal(u.apply(),false);
 p=u.check();resolve('release-two');await p;assert.equal(reloads,1);
});
