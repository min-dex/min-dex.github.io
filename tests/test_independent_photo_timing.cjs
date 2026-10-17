const assert=require('node:assert/strict');
require('../mindex.song-timing.js');
const T=globalThis.MindexSongTiming;
const pages=[['lyrics','첫 가사',2,1],['blank','',6,0],['lyrics','마지막 가사',10,1]].map(([type,text,start,lead],i)=>({id:`p${i}`,type,text,serviceTimingPage:true,serviceTimingAudioSource:'https://a/audio',syncTimeline:{serviceTiming:true,groupId:'same',audioSrc:'https://a/audio',page:i+1,start,lead}}));
const photos=[{at:6,url:'https://a/1.png'},{at:7.4,url:'https://a/2.png'},{at:9,url:'https://a/3.png'},{at:9.6,url:'https://a/4.png'},{at:15,url:'https://a/5.png'}];
const original=JSON.stringify(pages), result=T.composePhotos(pages,photos,20);
assert.equal(JSON.stringify(pages),original);
assert.equal(T.fingerprint(result),T.fingerprint(pages));
assert.deepEqual(T.pagesFor(result),pages);
for(let t=1;t<20;t+=.025){
 const expected=pages.filter(s=>s.syncTimeline.start-s.syncTimeline.lead<=t).at(-1);
 const actual=result.filter(s=>s.syncTimeline.start<=t).at(-1);
 assert.equal(actual.text,expected.text,`lyric shifted at ${t}`);
 assert.equal(actual.formBackgroundImage,photos.filter(p=>p.at<=t).at(-1)?.url,`photo at ${t}`);
}
for(const bad of [[{at:NaN,url:'https://a/x'}],[{at:20,url:'https://a/x'}],[{at:7,url:'javascript:bad'}],[photos[1],photos[0]]]){
 assert.ok(T.validatePhotos(bad,20));assert.equal(T.composePhotos(pages,bad,20),pages);
}
assert.equal(T.composePhotos(pages,[{at:0,url:'https://a/x'}],20),pages);
assert.equal(T.composePhotos(pages.map(p=>({...p,syncTimeline:null})),photos,20).length,3);
console.log('PASS independent photo clock, exact lyric lead/boundaries, seek sampling, immutable cues/fingerprint, invalid/stale profile safety');
const nineteen=Array.from({length:19},(_,i)=>({id:`lyric-${i}`,type:i===11?'blank':'lyrics',text:i===11?'':`line ${i}`,serviceTimingPage:true,syncTimeline:{serviceTiming:true,groupId:'full',audioSrc:'https://a/audio',page:i+1,start:3+i*13,lead:i===11?0:1}}));
const twentyOne=Array.from({length:21},(_,i)=>({at:150+i*4.6,url:`https://a/${i}.png`}));
const full=T.composePhotos(nineteen,twentyOne,264);
assert.equal(T.pagesFor(full).length,19);
assert.deepEqual(T.pagesFor(full).map(p=>p.syncTimeline.start),nineteen.map(p=>p.syncTimeline.start));
for(let t=2;t<264;t+=.05){
 const expected=nineteen.filter(s=>s.syncTimeline.start-s.syncTimeline.lead<=t).at(-1);
 const actual=full.filter(s=>s.syncTimeline.start<=t).at(-1);
 assert.equal(actual.text,expected.text);
 assert.equal(actual.formBackgroundImage,twentyOne.filter(p=>p.at<=t).at(-1)?.url);
}
console.log('PASS 21 independent photos over 19 unchanged lyric cues for full-length clock');
