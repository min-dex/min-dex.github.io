import assert from 'node:assert/strict';
import {validOutputCode,obtainOutputPairing} from '../mindex.output-pairing.mjs';
assert(validOutputCode('0123'));for(const c of ['123','12345','abcd'])assert(!validOutputCode(c));
let calls=[],ready=false;
const client={async rpc(name,args){calls.push(args);if(args.p_action==='disconnect')return {data:{ok:true}};const wasReady=ready;ready=true;return {data:{ok:true,output:'test-output',ready:wasReady,secret:wasReady?'ab'.repeat(32):undefined}};}};
const p=await obtainOutputPairing(client,'0123');assert.equal(p.code,'0123');assert.equal(calls[0].p_token,calls[1].p_token);assert.equal(calls[0].p_code,'0123');assert.match(calls[0].p_token,/^[a-f0-9]{64}$/);await p.revoke();await p.revoke();assert.equal(calls.length,3);
for(const error of ['busy','rate_limited','invalid_code','offline']){
 let cancelled=false;
 await assert.rejects(obtainOutputPairing({async rpc(n,a){if(a.p_action==='disconnect'){cancelled=true;return {data:{ok:true}};}return {data:{ok:false,error}};}},'0123'));
 assert(cancelled);
}
let cancelled=false;
await assert.rejects(obtainOutputPairing({async rpc(n,a){if(a.p_action==='disconnect'){cancelled=true;return {data:{ok:true}};}return {data:{ok:true,output:'test-output',ready:true,secret:'short'}};}},'0123'));
assert(cancelled);
console.log('PASS four-digit leading zero, readiness polling uses one request token, idempotent cleanup, denied/invalid responses fail closed');

// A selected output is bound on every poll and cannot resolve to a different PC.
let boundCalls=[];
const bound=await obtainOutputPairing({async rpc(n,a){boundCalls.push(a);return {data:{ok:true,output:'selected',ready:true,secret:'ab'.repeat(32)}};}},'0123','selected');
assert.equal(boundCalls[0].p_output,'selected');await bound.revoke();
let wrongRevoke;
await assert.rejects(obtainOutputPairing({async rpc(n,a){if(a.p_action==='disconnect')wrongRevoke=a;return {data:{ok:true,output:'other',ready:true,secret:'ab'.repeat(32)}};}},'0123','selected'),/선택한 예배/);
assert(wrongRevoke);assert.equal(wrongRevoke.p_output,null);
console.log('PASS selected output enforced and mismatched response never opens relay');
