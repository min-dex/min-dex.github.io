import assert from 'node:assert/strict';
import {createScreenAwake} from '../remote.screen.mjs';
const tick=()=>new Promise(r=>setTimeout(r,0));
function sentinel(){const s=new EventTarget();s.released=false;s.release=async()=>{s.released=true;s.dispatchEvent(new Event('release'));};return s;}
let status,calls=0,locks=[];
const screen=createScreenAwake({request:async()=>{calls++;const s=sentinel();locks.push(s);return s;},onChange:s=>status=s});
assert.equal(status,'idle');screen.update({active:true});await tick();assert.equal(status,'held');
for(let i=0;i<20;i++)screen.update({active:true});assert.equal(calls,1);
screen.update({visible:false});await tick();assert(locks[0].released);assert.equal(status,'hidden');
screen.update({visible:true});await tick();assert.equal(calls,2);
await locks[1].release();assert.equal(status,'released');await tick();assert.equal(calls,2,'no retry loop after system release');
screen.retry();await tick();assert.equal(status,'held');screen.close();await tick();assert(locks[2].released);assert.equal(status,'idle');
screen.update({active:true});await tick();screen.close();await tick();assert(locks[3].released);assert.equal(status,'idle');
let finish;const late=createScreenAwake({request:()=>new Promise(r=>finish=r),onChange:s=>status=s});late.update({active:true});late.close();const abandoned=sentinel();finish(abandoned);await tick();assert(abandoned.released);assert.equal(status,'idle');
let failures=0;const denied=createScreenAwake({request:async()=>{failures++;throw Error('denied');},onChange:s=>status=s});denied.update({active:true});await tick();assert.equal(status,'blocked');for(let i=0;i<20;i++)denied.update({active:true});assert.equal(failures,1);denied.retry();await tick();assert.equal(failures,2);denied.close();
const unsupported=createScreenAwake({request:null,onChange:s=>status=s});unsupported.update({active:true});assert.equal(status,'unsupported');
console.log('PASS screen wake lock lifecycle, release/reacquire, automatic activation, denial, unsupported, request race and no retry loop');
