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
  channelsForTest[1].fail();channelsForTest[1].fail();assert(!b.usable);assert.equal(closeCount,1);
  await assert.rejects(b.command('next'));
 }finally{a.close();b.close();}
}
await until(()=>channels.size===0);
console.log('PASS transport error/timeout/close, idempotent cleanup and failed execution feedback');
