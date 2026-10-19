const assert = require('node:assert/strict');
require('../mindex.song-timing.js');
const T = globalThis.MindexSongTiming;
const slides = [{type:'lyrics',text:'첫 가사'}, {type:'blank',text:''}, {type:'lyrics',text:'마지막'}];
const profile = {audio:new Blob(['audio']), audioFingerprint:'hash', lyricsFingerprint:T.fingerprint(slides), duration:20, starts:[2,6,10]};
assert.equal(T.validate(profile,slides),'');
for(const starts of [[2,null,10],[2,NaN,10],[2,Infinity,10],[2,1,10],[2,6,20],[2,6],[0,.1,10],[2,6,6.5]]) assert.ok(T.validate({...profile,starts},slides), JSON.stringify(starts));
assert.ok(T.validate(profile,[...slides].reverse()));
assert.ok(T.validate(profile,[...slides,{type:'lyrics',text:'새 장'}]));
assert.notEqual(T.keyFor('song-a','v'),T.keyFor('song-b','v'));
assert.notEqual(T.keyFor('song-a','v'),T.keyFor('song-a','v2'));
assert.equal(T.fingerprint([{type:'lyrics',text:'가'}]),T.fingerprint([{type:'lyrics',text:'가'}]));
const item={id:'keep',song_id:'song-a',memo:'medley unchanged',sort_order:4};
const before=JSON.stringify(item);
T.decorate(slides,item,{id:'song-a'},{id:'v'});
assert.equal(JSON.stringify(item),before);
console.log('PASS timing validation, effective cue order, identity isolation and immutable inputs');
// Beat detection must abstain on silence/free time and never rewrite cue arrays.
assert.equal(T.snapBeat(1.13,120,.1),1.1);
assert.equal(T.snapBeat(1.13,0,0),1.13);
assert.equal(T.snapBeat(.01,120,.1),.1);
function pulseTrack(times, duration=24) {
 const rate=1000, pcm=new Float32Array(duration*rate);
 for(const t of times)for(let k=0;k<30;k++)if(Math.round(t*rate)+k<pcm.length)pcm[Math.round(t*rate)+k]=Math.exp(-k/6);
 return pcm;
}
const regular=Array.from({length:47},(_,i)=>.2+i*.5);
const detected=T.detectBeatGrid(pulseTrack(regular),1000);
assert.ok(detected && Math.abs(detected.bpm-120)<1 && Math.abs(detected.anchor-.2)<.03,JSON.stringify(detected));
assert.equal(T.detectBeatGrid(new Float32Array(24000),1000),null);
assert.equal(T.detectBeatGrid(pulseTrack(regular.map((t,i)=>t+Math.sin(i*2.7)*.18)),1000),null);
assert.equal(T.detectBeatGrid(pulseTrack(regular.map((t,i)=>i<24?t:12.2+(i-24)*.7),30),1000),null);
console.log('PASS beat grid, silence/free-time/tempo-drift abstention and explicit snap');

const fractional=T.detectBeatGrid(pulseTrack(Array.from({length:220},(_,i)=>.2+i*60/138),100),1000);
assert.ok(fractional && Math.abs(fractional.bpm-138)<.1,JSON.stringify(fractional));
