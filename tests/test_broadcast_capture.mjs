import assert from 'node:assert/strict';
import {mountCaptureInput} from '../tools/broadcast-prototype/capture-input.mjs';
import {createOutputPolicy,createAudioBuses,drawBroadcast} from '../tools/broadcast-prototype/output-routing.mjs';
// No device, speaker, network, or production profile access.
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
class Track extends EventTarget {readyState='live';stop(){this.readyState='ended';}end(){this.stop();this.dispatchEvent(new Event('ended'));}}
const makeStream=()=>{const track=new Track();return {track,getTracks:()=>[track],getAudioTracks:()=>[]};};
globalThis.window={youtubeOutput:{}};
globalThis.Option=class {constructor(label,value){this.value=value;}};
let pending;
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{enumerateDevices:async()=>[],getUserMedia:()=>pending.promise}}});
const elements=new Map();
const root={getElementById(id){if(!elements.has(id))elements.set(id,{value:'',options:[],replaceChildren(...options){this.options=options;},add(option){this.options.push(option);}});return elements.get(id);}};
let playing,ready=0,stops=0;
const video={muted:true,srcObject:null,play:()=>playing.promise};
const capture=mountCaptureInput({root,video,policy:()=>({broadcast:true}),onStart(){},onReady(){ready++;},onStop(){stops++;}});
await Promise.resolve();await Promise.resolve();
const connect=()=>{root.getElementById('captureVideo').value='fixture';pending=deferred();playing=deferred();return root.getElementById('captureConnect').onclick();};
try {
 // Losing a device before play resolves must invalidate readiness immediately.
 let run=connect(),stream=makeStream();pending.resolve(stream);await Promise.resolve();
 stream.track.end();assert.equal(capture.active(),false);assert.equal(stops,1);assert.equal(video.srcObject,null);
 playing.resolve();await run;assert.equal(ready,0);assert.equal(root.getElementById('captureConnect').disabled,false);
 // A returned stream may already have ended before event listeners exist.
 run=connect();stream=makeStream();stream.track.stop();pending.resolve(stream);await run;
 assert.equal(capture.active(),false);assert.equal(ready,0);
 // Cancellation while permission is pending releases the eventual stream.
 run=connect();capture.stop();stream=makeStream();pending.resolve(stream);await run;
 assert.equal(stream.track.readyState,'ended');assert.equal(capture.active(),false);
 // A fresh connection works, and stale tracks cannot disconnect it.
 const old=stream;run=connect();stream=makeStream();pending.resolve(stream);playing.resolve();await run;
 assert.equal(ready,1);old.track.end();assert.equal(capture.active(),true);
 stream.track.end();assert.equal(capture.active(),false);assert.equal(root.getElementById('captureDisconnect').disabled,true);
} finally {capture.dispose();}
// Exclusion mutes the broadcast bus only; restoring cannot override another block.
const policy=createOutputPolicy();
const gain=()=>({gain:{value:0,setValueAtTime(v){this.value=v;},cancelScheduledValues(){}},disconnect(){}});
const context={currentTime:0,createGain:gain};const buses=createAudioBuses(context,{connect(){},disconnect(){}});
const ctx={clearRect(){},drawImage(){this.frames=(this.frames||0)+1;},fillRect(){},fillText(){}};
for(const block of ['setManual','setExcluded','setPending']){
 policy[block](true);buses.apply(policy.read());assert.equal(buses.hall.gain.value,1);assert.equal(buses.broadcast.gain.value,0);
 const before=ctx.frames||0;drawBroadcast(ctx,{},policy.read());assert.equal(ctx.frames||0,before);
 policy[block](false);
}
policy.setExcluded(true);policy.setManual(true);policy.setManual(false);assert.equal(policy.read().broadcast,false);
policy.setExcluded(false);buses.apply(policy.read());assert.equal(buses.broadcast.gain.value,1);
drawBroadcast(ctx,{},policy.read());assert.equal(ctx.frames,1);buses.dispose();
console.log('PASS capture startup loss, ended streams, cancellation, reconnect and isolated output exclusion');
