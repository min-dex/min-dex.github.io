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
(async () => {
  const crypto = require('node:crypto');
  const audio = new Blob(['audio bytes'], {type:'audio/wav'});
  const portable = {...profile, key:T.keyFor('song-a','v'),audio,audioName:'fixture.wav',enabled:true,
    audioFingerprint:crypto.createHash('sha256').update(Buffer.from(await audio.arrayBuffer())).digest('hex')};
  const bundle = await T.pack(portable,slides);
  const restored = await T.unpack(bundle,portable.key,slides);
  assert.deepEqual(restored.starts,portable.starts);
  assert.equal(await restored.audio.text(),'audio bytes');
  assert.equal(restored.audioFingerprint,portable.audioFingerprint);
  await assert.rejects(T.unpack(bundle,T.keyFor('other','v'),slides),/다른/);
  await assert.rejects(T.unpack(bundle,portable.key,[...slides].reverse()),/바뀌/);
  const corrupt = new Uint8Array(await bundle.arrayBuffer());corrupt[corrupt.length-1]^=1;
  await assert.rejects(T.unpack(new Blob([corrupt]),portable.key,slides),/검증/);
  await assert.rejects(T.unpack(new Blob(['invalid']),portable.key,slides));
  await assert.rejects(T.pack({...portable,audioFingerprint:'wrong'},slides),/변경/);
  console.log('PASS portable bytes/timestamps, wrong song/version, changed lyrics and corrupted audio rejection');
})().catch(error=>{console.error(error);process.exitCode=1});

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
