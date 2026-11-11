const {test}=require('node:test');
const assert=require('node:assert/strict');
const {bitrate,encodingArgs}=require('../electron/youtube-profile');
test('1080p30 CBR defaults and configurable rate',()=>{
 assert.equal(bitrate(),14000);
 for(const rate of [5000,14000,30000]){
  const args=encodingArgs(rate),value=k=>args[args.indexOf(k)+1];
  assert.equal(value('-b:v'),rate+'k');assert.equal(value('-minrate'),rate+'k');assert.equal(value('-maxrate'),rate+'k');
  assert.equal(value('-r'),'30');assert.equal(value('-g'),'60');assert.match(value('-vf'),/1920:1080/);
 }
 for(const rate of [0,4999,30001,NaN,Infinity,'14000',14000.5,null])assert.throws(()=>bitrate(rate));
});
