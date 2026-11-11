const {test}=require('node:test');
const assert=require('node:assert/strict');
const {bitrate,encodingArgs}=require('../electron/youtube-profile');
const {Writable}=require('node:stream');
const {writeInput}=require('../electron/youtube-engine');
test('small pipe chunks can queue EOF before their OS write callback',async()=>{
 let complete;
 const output=new Writable({highWaterMark:64,write(_bytes,_encoding,done){complete=done;}});
 await writeInput(output,Buffer.alloc(10));
 assert.equal(output.writableLength,10);
 output.end();
 assert.equal(output.writableEnded,true);
 complete();
 await new Promise(resolve=>output.on('finish',resolve));
});
test('pipe backpressure remains bounded and rejects a disconnected writer',async()=>{
 let complete,settled=false;
 const output=new Writable({highWaterMark:8,write(_bytes,_encoding,done){complete=done;}});
 const pending=writeInput(output,Buffer.alloc(10)).then(()=>{settled=true;});
 await Promise.resolve();assert.equal(settled,false);
 complete();await pending;assert.equal(settled,true);
 const blocked=writeInput(output,Buffer.alloc(10));
 output.destroy();await assert.rejects(blocked,/닫혔/);
 await assert.rejects(writeInput(output,Buffer.alloc(1)),/닫혔/);
});
test('1080p30 CBR defaults and configurable rate',()=>{
 assert.equal(bitrate(),14000);
 for(const rate of [5000,14000,30000]){
  const args=encodingArgs(rate),value=k=>args[args.indexOf(k)+1];
  assert.equal(value('-b:v'),rate+'k');assert.equal(value('-minrate'),rate+'k');assert.equal(value('-maxrate'),rate+'k');
  assert.equal(value('-r'),'30');assert.equal(value('-g'),'60');assert.match(value('-vf'),/1920:1080/);
 }
 for(const rate of [0,4999,30001,NaN,Infinity,'14000',14000.5,null])assert.throws(()=>bitrate(rate));
});
