import assert from 'node:assert/strict';
import {validCode,normalizeCode,obtainPairing} from '../mindex.remote-pairing.mjs';
assert(validCode('012345'));assert.equal(normalizeCode(' 012 345 '),'012345');for(const s of ['12345','1234567','abcdef'])assert(!validCode(s));
let calls=[];const client={async rpc(name,args){calls.push({name,args});return {data:{ok:true,code:'012345',secret:'11'.repeat(32),owner_token:'22'.repeat(32)}};}};
const host=await obtainPairing(client,true);assert.equal(host.code,'012345');await host.revoke();await host.revoke();assert.equal(calls.length,2);
calls=[];const phone=await obtainPairing(client,false,'012345');await phone.revoke();assert.equal(calls.length,1);assert.equal(calls[0].args.p_code,'012345');
await assert.rejects(obtainPairing(client,false,'1234'));assert.equal(calls.length,1);
for(const error of ['rate_limited','busy','invalid_code'])await assert.rejects(obtainPairing({rpc:async()=>({data:{ok:false,error}})},true));
await assert.rejects(obtainPairing({rpc:async()=>({error:{message:'private details'}})},true),e=>!e.message.includes('private details'));
await assert.rejects(obtainPairing({rpc:async()=>({data:{ok:true,secret:'123456'}})},false,'012345'));
console.log('PASS six-digit leading zeros, server-only pairing, one-time revoke, fail-closed errors and response validation');
for(const legacy of ['ABCDEFGH','ABCDEFGHJKLMNPQR'])await assert.rejects(obtainPairing(client,false,legacy),/새로고침/);
// Server never answers: abort the request and return a recoverable message.
const originalTimeout=globalThis.setTimeout;let aborted=false;
globalThis.setTimeout=(fn,ms,...args)=>originalTimeout(fn,ms===8000?5:ms,...args);
try{
 await assert.rejects(obtainPairing({rpc(){return {abortSignal(signal){signal.addEventListener('abort',()=>aborted=true);return new Promise(()=>{});}};}},true),/지연/);
 assert(aborted);
}finally{globalThis.setTimeout=originalTimeout;}
console.log('PASS legacy version rejection and stalled server timeout/abort');
