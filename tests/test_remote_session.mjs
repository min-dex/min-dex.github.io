import assert from 'node:assert/strict';
import {openRemote} from '../mindex.remote-session.mjs';

const channels=new Set(),packets=[];
let nextCode=100000;const registrations=new Map();
const client={async rpc(name,args={}){
 if(name==='mindex_remote_create_code'){const code=String(nextCode++),secret=crypto.randomUUID().replaceAll('-','').repeat(2),owner_token=secret;registrations.set(code,{secret,owner_token});return {data:{ok:true,code,secret,owner_token}};}
 if(name==='mindex_remote_claim_code'){const value=registrations.get(args.p_code);registrations.delete(args.p_code);return {data:value?{ok:true,secret:value.secret}:{ok:false,error:'invalid_code'}};}
 for(const [code,value] of registrations)if(value.owner_token===args.p_owner_token)registrations.delete(code);return {data:true};
},channel(topic){return {topic,on(type,filter,handler){this.handler=handler;return this;},subscribe(status){channels.add(this);queueMicrotask(()=>status('SUBSCRIBED'));return this;},async send(message){packets.push(message.payload);for(const c of channels)if(c!==this&&c.topic===topic)queueMicrotask(()=>c.handler({payload:message.payload}));return 'ok';}};},async removeChannel(c){channels.delete(c);}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(test){for(let i=0;i<100;i++){if(test())return;await wait(10);}throw Error('condition timed out');}
let code;let index=0,result,host;
const sessions=[];
try{
 host=await openRemote({client,code,host:true,read:()=>({live:true,index}),execute:()=>{index++;}});sessions.push(host);code=host.code;
 const controller=await openRemote({client,code,onResult:r=>result=r});sessions.push(controller);await until(()=>controller.usable);
 await assert.rejects(openRemote({client,code}),/만료/);
 await controller.command('next');await assert.rejects(controller.command('next'));await until(()=>result);assert(result.ok);assert.equal(index,1);
 assert(packets.every(p=>p.box?.data&&!JSON.stringify(p).includes('next')));
 await controller.end();await until(()=>!host.connected);assert(!controller.usable);
 // The consumed channel cannot be joined again after revocation.
 await assert.rejects(openRemote({client,code}),/만료/);
}finally{for(const s of sessions)s.close();}
// Exercise code-expiry callback without waiting two real minutes.
const realTimeout=globalThis.setTimeout;let expire,expired=false;
globalThis.setTimeout=(fn,ms,...args)=>{if(ms===120000)expire=fn;return realTimeout(fn,ms,...args);};
try{
 const h=await openRemote({client,host:true,read:()=>({live:true}),execute:()=>{},onClose:()=>expired=true});
 expire();assert(expired);assert(!h.connected);h.close();
}finally{globalThis.setTimeout=realTimeout;}
await until(()=>channels.size===0);
const before=registrations.size;
await assert.rejects(openRemote({client:{...client,channel(){throw Error("setup failed");}},host:true}),/setup failed/);
await until(()=>registrations.size===before);
console.log('PASS encrypted session handshake, one controller, in-flight lock, revocation, consumed code, expiry and channel cleanup');
// Immediate subscription failure must reject, not return a dead session or leave timers.
let intervals=0;const interval=globalThis.setInterval;
globalThis.setInterval=(...args)=>{intervals++;return interval(...args);};
try{
 await assert.rejects(openRemote({client:{...client,channel(topic){const c=client.channel(topic);c.subscribe=cb=>{cb('CHANNEL_ERROR');return c;};return c;}},host:true}),/연결/);
 assert.equal(intervals,0);
}finally{globalThis.setInterval=interval;}
// A lost transport send acknowledgement must not keep the Disconnect UI waiting.
let hanging=false;const unreliable={...client,channel(topic){const c=client.channel(topic),send=c.send;c.send=function(m){return hanging?new Promise(()=>{}):send.call(this,m);};return c;}};
const h=await openRemote({client:unreliable,host:true,read:()=>({live:true}),execute:()=>{}});
const c=await openRemote({client:unreliable,code:h.code});await until(()=>c.usable);
try{hanging=true;await Promise.race([c.end(),wait(1500).then(()=>{throw Error('disconnect stuck');})]);assert(!c.connected);}finally{h.close();c.close();}
console.log('PASS immediate subscribe failure and bounded disconnect with silent transport');
for(const failure of ['CHANNEL_ERROR','TIMED_OUT','CLOSED']){
 let closeCount=0;const channelsForTest=[];
 const failing={...client,channel(topic){const channel=client.channel(topic),subscribe=channel.subscribe;channel.subscribe=function(cb){this.fail=()=>cb(failure);return subscribe.call(this,cb);};channelsForTest.push(channel);return channel;}};
 const a=await openRemote({client:failing,host:true,read:()=>({live:true}),execute:()=>{throw Error('audio blocked');}});
 let outcome;const b=await openRemote({client:failing,code:a.code,onClose:()=>closeCount++,onResult:r=>outcome=r});
 try{
  await until(()=>b.usable);await b.command('play');await until(()=>outcome);assert(!outcome.ok);assert.match(outcome.message,/audio blocked/);
  channelsForTest[1].fail();channelsForTest[1].fail();assert(!b.usable);assert.equal(closeCount,0);
  await assert.rejects(b.command('next'));
  await wait(1600);await until(()=>b.usable);assert.equal(closeCount,0);
 }finally{a.close();b.close();}
}
await until(()=>channels.size===0);
console.log('PASS transport error/timeout/close, idempotent cleanup and failed execution feedback');
// Event notifications work without any heartbeat, fan out to independent peers,
// coalesce bursts and do not send unchanged state or survive close.
const savedInterval=globalThis.setInterval;
globalThis.setInterval=(fn,ms,...args)=>ms===1000?null:savedInterval(fn,ms,...args);
const fast=[];let position=0,seenA=-1,seenB=-1;
try{
 const read=()=>({live:true,index:position});
 const a=await openRemote({client,host:true,read,execute:()=>{position++;for(const h of fast)h.notify();}});fast.push(a);
 const b=await openRemote({client,host:true,read,execute:()=>{position++;for(const h of fast)h.notify();}});fast.push(b);
 const x=await openRemote({client,code:a.code,onState:s=>{if(s)seenA=s.index;}});
 const y=await openRemote({client,code:b.code,onState:s=>{if(s)seenB=s.index;}});
 try{
  await until(()=>x.usable&&y.usable);
  const before=packets.length,start=performance.now();position=4;
  for(let i=0;i<50;i++)for(const h of fast)h.notify();
  await until(()=>seenA===4&&seenB===4);
  assert(performance.now()-start<500,'event update waited for heartbeat');
  assert.equal(packets.length-before,2,'burst must send once per peer');
  for(const h of fast)h.notify();await wait(80);assert.equal(packets.length-before,2,'unchanged state sent');
  await x.command('next');await until(()=>seenA===5&&seenB===5&&x.usable);
  for(const h of fast){h.notify();h.close();}
  const closedCount=packets.length;await wait(80);assert.equal(packets.length,closedCount);
 }finally{x.close();y.close();}
}finally{for(const h of fast)h.close();globalThis.setInterval=savedInterval;}
console.log('PASS immediate two-peer state updates without heartbeat, coalescing, deduplication, command fan-out and timer cleanup');
// Suspension retains identity, rejects commands and requires a fresh response.
const wallNow=Date.now;let wallOffset=0,holdCalls=0;
Date.now=()=>wallNow()+wallOffset;
const heldHost=await openRemote({client,host:true,read:()=>({live:true,index:holdCalls}),execute:()=>holdCalls++});
const heldRemote=await openRemote({client,code:heldHost.code});
try{
 await until(()=>heldRemote.usable);heldRemote.suspend();
 assert(heldRemote.connected);assert(!heldRemote.usable);
 await assert.rejects(heldRemote.command('next'));assert.equal(holdCalls,0);
 wallOffset=179000;heldRemote.refresh();assert(!heldRemote.usable);
 await until(()=>heldRemote.usable);assert.equal(holdCalls,0);
 await heldRemote.command('next');await until(()=>heldRemote.usable);assert.equal(holdCalls,1);
 for(const outage of [180001,600000,3600000]){
  heldRemote.suspend();wallOffset+=outage;
  assert(heldRemote.connected);await assert.rejects(heldRemote.command('next'));
  heldRemote.refresh();assert(!heldRemote.usable);
  await until(()=>heldRemote.usable);assert.equal(holdCalls,1);
 }
 await heldRemote.command('next');await until(()=>heldRemote.usable);assert.equal(holdCalls,2);
 await heldHost.end();await until(()=>!heldRemote.connected);
 await assert.rejects(heldRemote.command('next'));assert.equal(holdCalls,2);
}finally{Date.now=wallNow;heldHost.close();heldRemote.close();}
console.log('PASS suspended commands rejected, recovery beyond 3min/10min/1h requires fresh state, no replay, explicit end still terminal');
// A transport send failure is recoverable, but its command is never queued.
let breakSend=false,retryCalls=0;
const retryClient={...client,channel(topic){const c=client.channel(topic),send=c.send;c.send=function(m){if(breakSend)return Promise.reject(Error('offline'));return send.call(this,m);};return c;}};
const retryHost=await openRemote({client:retryClient,host:true,read:()=>({live:true}),execute:()=>retryCalls++});
const retryRemote=await openRemote({client:retryClient,code:retryHost.code});
try{
 await until(()=>retryRemote.usable);
 const queuedCommand=retryRemote.command('next');retryRemote.suspend();await queuedCommand;
 await wait(80);assert.equal(retryCalls,0);
 retryRemote.refresh();await until(()=>retryRemote.usable);breakSend=true;
 await assert.rejects(retryRemote.command('next'));assert(!retryRemote.usable);assert(retryRemote.connected);
 breakSend=false;await wait(1600);await until(()=>retryRemote.usable);assert.equal(retryCalls,0);
 await retryRemote.command('next');await until(()=>retryRemote.usable);assert.equal(retryCalls,1);
 retryRemote.offline();retryRemote.suspend();await wait(1700);
 assert(retryRemote.connected);assert(!retryRemote.usable);
 retryRemote.refresh();await wait(1600);await until(()=>retryRemote.usable);assert.equal(retryCalls,1);
}finally{retryHost.close();retryRemote.close();}
console.log('PASS failed send recovers automatically without replaying its command');
// Slide browsing is display-only; jumps retain the same encrypted command gate.
let browseCalls=0,jumpTarget=null,slideResult=null;const scriptureCommands=[];
const listHost=await openRemote({client,host:true,read:()=>({live:true,allowed:['jump'],catalogKey:'catalog'}),browse:()=>{browseCalls++;return {key:'catalog',offset:0,total:1,items:[{index:0,title:'제목'}]};},execute:(action,target)=>{if(action==='jump')jumpTarget=target;else scriptureCommands.push({action,target});}});
const listRemote=await openRemote({client,code:listHost.code,onSlides:r=>slideResult=r});
try{
 await until(()=>listRemote.usable);await listRemote.requestSlides();await until(()=>slideResult);
 assert.equal(browseCalls,1);assert.equal(jumpTarget,null);
 await listRemote.command('jump',{index:0,key:slideResult.key});await until(()=>jumpTarget);
 assert.deepEqual(jumpTarget,{index:0,key:'catalog'});
 await until(()=>listRemote.usable);await listRemote.command('scripture-show',{query:'요 3:16'});await until(()=>scriptureCommands.length===1);
 assert.deepEqual(scriptureCommands[0],{action:'scripture-show',target:{query:'요 3:16'}});
 await until(()=>listRemote.usable);await listRemote.command('sermon-title');await until(()=>scriptureCommands.length===2);
 assert.equal(scriptureCommands[1].action,'sermon-title');
 listRemote.suspend();await assert.rejects(listRemote.command('scripture-show',{query:'요 3:16'}));await assert.rejects(listRemote.requestSlides());await assert.rejects(listRemote.command('jump',{index:0,key:'catalog'}));
 assert.equal(browseCalls,1);
}finally{listHost.close();listRemote.close();}
console.log('PASS encrypted read-only slide browsing, targeted jump and suspended control guards');
