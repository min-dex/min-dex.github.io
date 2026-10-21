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
