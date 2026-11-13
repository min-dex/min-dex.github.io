import assert from 'node:assert/strict';
import {createFrameCadence} from '../tools/broadcast-prototype/frame-cadence.mjs';
for(const hz of [30,60,64,120,144]){
 const due=createFrameCadence(30),frames=[];
 for(let i=0;i<hz*10;i++){const t=i*1000/hz;if(due(t))frames.push(t);}
 assert.equal(frames.length,300,`${hz}Hz must produce 30fps without halving on rounding`);
 assert(frames.every((t,i)=>!i||t-frames[i-1]>=1000/hz-0.01));
}
const due=createFrameCadence(30);
assert(due(0));assert(!due(10));assert(due(5000));
assert(!due(5000));assert(!due(5001));assert(due(5034));
console.log('PASS 30fps composition across monitor rates, clock rounding and pause recovery without burst');
