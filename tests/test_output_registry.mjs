import assert from 'node:assert/strict';
import {createOutputRegistry} from '../mindex.remote-admin.mjs';
let registrations=0,removals=0,fail=false,live=true,key='a',latest;
const client={async rpc(n,a){if(fail)throw Error('network');if(a.p_action==='register')return {data:{ok:true,id:String(++registrations),token:'test-token',code:registrations===1?'0012':'0099'}};if(a.p_action==='remove')removals++;return {data:{ok:true,link:null,guest:null,code:registrations===1?'0012':'0099'}};}};
const adapter={read:()=>({live}),execute:()=>{}};
const registry=createOutputRegistry(()=>live?{key,client,adapter,info:{title:'fixture'}}:null,{interval:100000,onUpdate:x=>latest=x});
const now=Date.now;let offset=0;
try{
 await new Promise(r=>setTimeout(r,10));assert.equal(latest.code,'0012');
 fail=true;await registry.tick();assert.equal(latest.code,'0012');assert.equal(registrations,1);assert.equal(removals,0);
 Date.now=()=>now()+offset;offset=4000;fail=false;await registry.tick();assert.equal(latest.code,'0012');assert.equal(registrations,1);
 registry.suspend();assert.equal(latest.code,'0012');await registry.resume();assert.equal(registrations,1);
 key='b';await registry.tick();assert.equal(latest.code,'0099');assert.equal(registrations,2);assert.equal(removals,1);
 live=false;await registry.tick();assert.equal(latest.code,'');assert.equal(removals,2);
 console.log('PASS output code stable across transient outage and page suspension; renewed on output replacement; cleared on stop');
}finally{Date.now=now;registry.close();}
// A failed unlink must not revive a consumed guest channel when the network returns.
let oldLink={id:'used-link',secret:'cd'.repeat(32)},networkDown=false,opened=0,failChannel;
const c2={async rpc(n,a){if(networkDown)throw Error('network');if(a.p_action==='register')return {data:{ok:true,id:'output',token:'owner',code:'0077'}};if(a.p_action==='unlink_guest')oldLink=null;return {data:{ok:true,code:'0077',link:null,guest:oldLink}};},channel(){opened++;return {on(){return this;},subscribe(cb){failChannel=()=>cb('CLOSED');queueMicrotask(()=>cb('SUBSCRIBED'));return this;},async send(){return 'ok';}};},async removeChannel(){}};
const r2=createOutputRegistry(()=>({key:'steady',client:c2,adapter:{read:()=>({live:true}),execute:()=>{}},info:{}}),{interval:100000});
try{
 for(let i=0;i<50&&opened===0;i++)await new Promise(r=>setTimeout(r,10));await new Promise(r=>setTimeout(r,10));assert.equal(opened,1);
 networkDown=true;failChannel();await new Promise(r=>setTimeout(r,10));await r2.tick();networkDown=false;Date.now=()=>now()+4000;
 await r2.tick();await r2.tick();assert.equal(oldLink,null);assert.equal(opened,1);
 console.log('PASS lost revocation retried without reopening a consumed guest channel');
}finally{Date.now=now;r2.close();}
// Multiple admins keep independent relay sessions; removing one retains the rest and guest.
let admins=[{id:'admin-one',secret:'11'.repeat(32)},{id:'admin-two',secret:'22'.repeat(32)}],guestLink={id:'guest-one',secret:'33'.repeat(32)},lastInfo,openedCount=0,closedCount=0;
const cm={async rpc(n,a){
 if(a.p_action==='register')return {data:{ok:true,id:'multi',token:'owner',code:'0042'}};
 if(a.p_action==='tick')lastInfo=a.p_info;
 if(a.p_action==='unlink')admins=admins.filter(l=>l.id!==a.p_ready);
 if(a.p_action==='unlink_guest')guestLink=null;
 return {data:{ok:true,code:'0042',links:admins,guest:guestLink}};
},channel(){openedCount++;return {on(){return this;},subscribe(cb){queueMicrotask(()=>cb('SUBSCRIBED'));return this;},async send(){return 'ok';}};},async removeChannel(){closedCount++;}};
const rm=createOutputRegistry(()=>({key:'multi',client:cm,adapter:{read:()=>({live:true}),execute:()=>{}},info:{}}),{interval:100000});
try{
 for(let i=0;i<50&&openedCount<3;i++)await new Promise(r=>setTimeout(r,10));
 assert.equal(openedCount,3);await rm.tick();assert.deepEqual(lastInfo.adminReady.sort(),['admin-one','admin-two']);assert.equal(lastInfo.guestReady,'guest-one');assert.equal(lastInfo.multiAdmin,true);
 admins=admins.slice(1);await rm.tick();assert.equal(openedCount,3);assert.equal(closedCount,1);
 await rm.tick();assert.deepEqual(lastInfo.adminReady,['admin-two']);assert.equal(lastInfo.guestReady,'guest-one');
 console.log('PASS multiple admin relays and one guest coexist; one removal preserves other sessions');
}finally{rm.close();}
// Actual encrypted handshakes: two admins plus guest share one host state/revision.
{
 const {openRemote}=await import('../mindex.remote-session.mjs');
 const channels=new Set(),packets=[],sessions=[],results=[];
 let links=[{id:'a1',secret:'44'.repeat(32)},{id:'a2',secret:'55'.repeat(32)}],g={id:'g',secret:'66'.repeat(32)},index=0;
 const client={async rpc(n,a){
  if(a.p_action==='register')return {data:{ok:true,id:'encrypted',token:'owner',code:'0088'}};
  if(a.p_action==='unlink')links=links.filter(x=>x.id!==a.p_ready);
  if(a.p_action==='unlink_guest')g=null;
  return {data:{ok:true,code:'0088',links,guest:g}};
 },channel(topic){return {topic,on(t,f,h){this.handler=h;return this;},subscribe(cb){channels.add(this);queueMicrotask(()=>cb('SUBSCRIBED'));return this;},async send(m){packets.push(m.payload);for(const c of channels)if(c!==this&&c.topic===topic)queueMicrotask(()=>c.handler({payload:m.payload}));return 'ok';}};},async removeChannel(c){channels.delete(c);}};
 const until=async fn=>{for(let i=0;i<200;i++){if(fn())return;await new Promise(r=>setTimeout(r,10));}throw Error('encrypted multi-controller timeout');};
 const adapter={read:()=>({live:true,index,version:index,allowed:['next']}),execute:()=>{index++;}};
 const registry=createOutputRegistry(()=>({key:'encrypted',client,adapter,guestAdapter:adapter,info:{}}),{interval:100000});
 try{
  await until(()=>channels.size===3);
  for(const link of [...links,g])sessions.push(await openRemote({client,registration:{secret:link.secret,code:'',revoke:async()=>{}},onResult:r=>results.push(r)}));
  await until(()=>sessions.every(s=>s.usable));
  await Promise.all(sessions.map(s=>s.command('next')));await until(()=>results.length===3);
  assert.equal(index,1);assert.equal(results.filter(r=>r.ok).length,1,'stale simultaneous commands are rejected');
  await sessions[0].end();await until(()=>links.length===1);await registry.tick();assert.equal(links.length,1);assert(g);
  assert(sessions[1].connected&&sessions[2].connected);
  sessions[1].refresh();await until(()=>sessions[1].usable);await sessions[1].command('next');await until(()=>index===2);
  sessions[2].refresh();await until(()=>sessions[2].usable);await sessions[2].command('next');await until(()=>index===3);
  assert(packets.every(p=>p.box?.data&&!JSON.stringify(p).includes('"action"')));
  registry.close();await until(()=>channels.size===2);
  // Output removal stops host-side execution immediately; remote peers notice via heartbeat.
  sessions.forEach(s=>s.close());await until(()=>channels.size===0);
  console.log('PASS encrypted two-admin/guest coexistence, simultaneous stale rejection, independent disconnect, continued controls and stop-all cleanup');
 }finally{sessions.forEach(s=>s.close());registry.close();}
}
