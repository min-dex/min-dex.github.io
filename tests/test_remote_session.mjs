import assert from 'node:assert/strict';
import {openRemote} from '../mindex.remote-session.mjs';
import {newCode} from '../mindex.remote-core.mjs';
const channels=new Set(),packets=[];
const client={channel(topic){return {topic,on(type,filter,handler){this.handler=handler;return this;},subscribe(status){channels.add(this);queueMicrotask(()=>status('SUBSCRIBED'));return this;},async send(message){packets.push(message.payload);for(const c of channels)if(c!==this&&c.topic===topic)queueMicrotask(()=>c.handler({payload:message.payload}));return 'ok';}};},async removeChannel(c){channels.delete(c);}};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function until(test){for(let i=0;i<100;i++){if(test())return;await wait(10);}throw Error('condition timed out');}
const code=newCode();let index=0,result,host;
const sessions=[];
try{
 host=await openRemote({client,code,host:true,read:()=>({live:true,index}),execute:()=>{index++;}});sessions.push(host);
 const controller=await openRemote({client,code,onResult:r=>result=r});sessions.push(controller);await until(()=>controller.usable);
 const second=await openRemote({client,code});sessions.push(second);await wait(80);assert(!second.connected,'one controller only');
 await controller.command('next');await assert.rejects(controller.command('next'));await until(()=>result);assert(result.ok);assert.equal(index,1);
 assert(packets.every(p=>p.box?.data&&!JSON.stringify(p).includes('next')));
 await controller.end();await until(()=>!host.connected);assert(!controller.usable);
 // The consumed channel cannot be joined again after revocation.
 const replay=await openRemote({client,code});sessions.push(replay);await wait(80);assert(!replay.connected);
}finally{for(const s of sessions)s.close();}
// Exercise code-expiry callback without waiting two real minutes.
const realTimeout=globalThis.setTimeout;let expire,expired=false;
globalThis.setTimeout=(fn,ms,...args)=>{if(ms===120000)expire=fn;return realTimeout(fn,ms,...args);};
try{
 const h=await openRemote({client,code:newCode(),host:true,read:()=>({live:true}),execute:()=>{},onClose:()=>expired=true});
 expire();assert(expired);assert(!h.connected);h.close();
}finally{globalThis.setTimeout=realTimeout;}
assert.equal(channels.size,0);
console.log('PASS encrypted session handshake, one controller, in-flight lock, revocation, consumed code, expiry and channel cleanup');
