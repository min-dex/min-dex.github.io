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
let oldLink={id:'used-link',secret:'cd'.repeat(32)},networkDown=false,opened=0;
const c2={async rpc(n,a){if(networkDown)throw Error('network');if(a.p_action==='register')return {data:{ok:true,id:'output',token:'owner',code:'0077'}};if(a.p_action==='unlink_guest')oldLink=null;return {data:{ok:true,code:'0077',link:null,guest:oldLink}};},channel(){opened++;return {on(){return this;},subscribe(cb){queueMicrotask(()=>cb('SUBSCRIBED'));return this;},async send(){return 'ok';}};},async removeChannel(){}};
const r2=createOutputRegistry(()=>({key:'steady',client:c2,adapter:{read:()=>({live:true}),execute:()=>{}},info:{}}),{interval:100000});
try{
 for(let i=0;i<50&&opened===0;i++)await new Promise(r=>setTimeout(r,10));await new Promise(r=>setTimeout(r,10));assert.equal(opened,1);
 networkDown=true;await r2.tick();networkDown=false;Date.now=()=>now()+4000;
 await r2.tick();await r2.tick();assert.equal(oldLink,null);assert.equal(opened,1);
 console.log('PASS lost revocation retried without reopening a consumed guest channel');
}finally{Date.now=now;r2.close();}
