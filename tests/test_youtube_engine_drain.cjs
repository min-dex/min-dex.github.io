const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter,once,getEventListeners}=require('node:events');
const {Duplex,PassThrough,Writable}=require('node:stream');
const {setTimeout:sleep}=require('node:timers/promises');

function fixture({delay=40,holdClose=false,closeDelay=0,sourceCloseWithoutEOF=false,replyAfterMuxerExit=false,deadlineDelay}={}) {
 const delivered=[],replies=[],states=[],servers=[],children=[],deadlines=[];
 let relaySocket, muxerExited=false;
 class DelayedTLS extends Duplex {
  constructor(){super();this.pending=[];}
  _read(){}
  _write(bytes,encoding,done){
   const item={bytes:Buffer.from(bytes),done};this.pending.push(item);
   item.timer=setTimeout(()=>{this.pending=this.pending.filter(p=>p!==item);delivered.push(item.bytes);done();},delay);
  }
  _final(done){done();if(!holdClose)setTimeout(()=>this.push(null),closeDelay);}
  _destroy(error,done){for(const p of this.pending){clearTimeout(p.timer);p.done(error||Error('TLS write interrupted'));}this.pending=[];done(error);}
  setTimeout(){return this;}
 }
 const encrypted=new DelayedTLS();
 const fakeNet={createServer(accept){
  const server=new EventEmitter();server.accept=accept;server.listen=()=>{process.nextTick(()=>server.emit('listening'));return server;};
  server.close=()=>server;server.address=()=>({port:12345});servers.push(server);return server;
 }};
 const fakeTLS={connect(){process.nextTick(()=>encrypted.emit('secureConnect'));return encrypted;}};
 const fakeSpawn=(_exe,args)=>{
  const child=new EventEmitter();child.kill=()=>{};child.stdout=new PassThrough();child.stdio=[null,child.stdout,null,new PassThrough()];children.push(child);
  if(args.includes('mp4')&&args.includes('flv')){
   // The muxer exits after writing to its local TCP connection. The Node relay
   // still has asynchronous TLS writes outstanding, like a slow real transport.
   relaySocket=new Duplex({read(){},write(_bytes,_encoding,done){replies.push(Buffer.from(_bytes));done(replyAfterMuxerExit && muxerExited ? Error('write after muxer exit') : undefined);}});
   servers[0].accept(relaySocket);
   child.stdin=new Writable({write(bytes,_encoding,done){for(let offset=0;offset<bytes.length;offset+=65536)relaySocket.push(Buffer.from(bytes.subarray(offset,offset+65536)));child.stdout.write('out_time_us=1\n');done();},final(done){if(sourceCloseWithoutEOF)setImmediate(()=>relaySocket.destroy());else relaySocket.push(null);done();setImmediate(()=>{muxerExited=true;child.emit('exit',0);if(replyAfterMuxerExit)setTimeout(()=>encrypted.push(Buffer.from('late acknowledgement')),5);setTimeout(()=>{child.stdout.end();child.emit('close',0);},replyAfterMuxerExit?15:0);});}});
  }else{
   child.stdin=new Writable({write(bytes,_encoding,done){child.stdout.write(bytes);done();},final(done){child.stdout.end();done();setImmediate(()=>child.emit('close',0));}});
  }
  child.stdio[0]=child.stdin;return child;
 };
 const module={exports:{}};
 const localRequire=name=>name==='node:net'?fakeNet:name==='node:tls'?fakeTLS:name==='node:child_process'?{spawn:fakeSpawn}:name==='./youtube-profile'?require('../electron/youtube-profile'):require(name);
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../electron/youtube-engine.js'),'utf8'),{require:localRequire,module,exports:module.exports,process:{platform:'darwin'},Buffer,Uint8Array,AbortController,setTimeout:(fn,ms)=>{deadlines.push(ms);return setTimeout(fn,ms===8000&&deadlineDelay!==undefined?deadlineDelay:ms);},clearTimeout});
 const abort=new AbortController();
 return {encrypted,delivered,replies,states,abort,deadlines,async start(){return module.exports.startEncoder({exe:'synthetic-encoder',key:'synthetic-key',signal:abort.signal,destination:{host:'localhost'},onState:s=>states.push(s)});}};
}

test('normal stop drains the last TLS bytes before reporting success',async()=>{
 const f=fixture();
 try{
  const run=await f.start();const bytes=Buffer.from('first packet\nlast packet\n');await run.write(bytes);
  const stopped=run.stop();await sleep(10);
  assert(!f.states.includes('stopped'),'must not report stopped before TLS finishes');
  assert.equal(await stopped,true);
  assert.deepEqual(Buffer.concat(f.delivered),bytes);
  assert(f.states.includes('stopped'));
 }finally{f.abort.abort();}
});


test('abort during pending TLS writes remains a failed stop',async()=>{
 const f=fixture({delay:1000});
 try{
  const run=await f.start();await run.write(Buffer.from('pending tail'));
  const stopped=run.stop();await sleep(5);f.abort.abort();
  assert.equal(await stopped,false);assert(!f.states.includes('stopped'));assert(f.states.includes('failed'));
  assert.equal(f.delivered.length,0);
 }finally{f.abort.abort();}
});

test('TLS error is propagated without claiming a successful drain',async()=>{
 const f=fixture({delay:1000});
 try{
  const run=await f.start();await run.write(Buffer.from('pending tail'));
  const stopped=run.stop();await sleep(5);f.encrypted.destroy(Error('synthetic transport failure'));
  assert.equal(await stopped,false);assert(!f.states.includes('stopped'));assert(f.states.includes('failed'));
 }finally{f.abort.abort();}
});

test('a TLS write that never drains remains bounded by the existing 8-second deadline',async()=>{
 const f=fixture({delay:1000,deadlineDelay:30});
 try{
  const run=await f.start();await run.write(Buffer.from('flushed but peer remains open'));
  assert.equal(await run.stop(),false);
  assert.deepEqual(f.deadlines,[8000]);assert(!f.encrypted.writableFinished);assert(!f.encrypted.readableEnded);
  assert(!f.states.includes('stopped'));assert(f.states.includes('failed'));
 }finally{f.abort.abort();}
});


test('a delayed normal peer EOF completes without cutting the tail',async()=>{
 const f=fixture({delay:1,closeDelay:20});
 try{
  const run=await f.start();const bytes=Buffer.from('complete tail');await run.write(bytes);
  assert.equal(await run.stop(),true);assert.deepEqual(Buffer.concat(f.delivered),bytes);
  assert(f.encrypted.writableFinished);assert(!f.encrypted.destroyed);assert(f.states.includes('stopped'));
  await once(f.encrypted,'close');assert(f.encrypted.readableEnded);
 }finally{f.abort.abort();}
});


test('local RTMP close without EOF cannot claim a complete stream',async()=>{
 const f=fixture({delay:40,sourceCloseWithoutEOF:true});
 try{
  const run=await f.start();const bytes=Buffer.from('queued packet after local process exit');await run.write(bytes);
  assert.equal(await run.stop(),false);assert.deepEqual(Buffer.concat(f.delivered),bytes);
  assert(!f.states.includes('stopped'));assert(f.states.includes('failed'));
 }finally{f.abort.abort();}
});

test('finished writes succeed without peer EOF and retire within the original deadline',async()=>{
 const f=fixture({delay:1,holdClose:true,deadlineDelay:30});
 try{
  const run=await f.start();await run.write(Buffer.from('flushed tail'));
  assert.equal(await run.stop(),true);assert.deepEqual(f.deadlines,[8000]);
  assert(f.states.includes('stopped'));assert(!f.states.includes('failed'));
  assert(!f.encrypted.destroyed);await once(f.encrypted,'close');assert(f.encrypted.destroyed);
 }finally{f.abort.abort();}
});


test('late peer replies cannot destroy the outgoing tail after muxer exit',async()=>{
 const f=fixture({delay:20,replyAfterMuxerExit:true});
 try{
  const run=await f.start();const bytes=Buffer.alloc(262144,37);await run.write(bytes);
  assert.equal(await run.stop(),true);
  assert.deepEqual(Buffer.concat(f.delivered),bytes);
  assert(f.states.includes('stopped'));
 }finally{f.abort.abort();}
});


test('live peer replies still reach the running muxer',async()=>{
 const f=fixture({delay:1});
 try{
  const run=await f.start();const reply=Buffer.from('live acknowledgement');
  f.encrypted.push(reply);await sleep(5);
  assert.deepEqual(Buffer.concat(f.replies),reply);
  await run.write(Buffer.from('complete stream'));assert.equal(await run.stop(),true);
 }finally{f.abort.abort();}
});


test('retired TLS sockets detach abort listeners without affecting a new session',async()=>{
 const first=fixture({delay:1,holdClose:true,deadlineDelay:30});
 const second=fixture({delay:1});
 try{
  const old=await first.start();await old.write(Buffer.from('old stream'));
  assert.equal(await old.stop(),true);assert(!first.encrypted.destroyed);
  const next=await second.start();
  await once(first.encrypted,'close');
  assert.equal(getEventListeners(first.abort.signal,'abort').length,0);
  assert(!second.encrypted.destroyed);assert(!second.states.includes('failed'));
  await next.write(Buffer.from('new stream'));assert.equal(await next.stop(),true);
  if(!second.encrypted.destroyed)await once(second.encrypted,'close');
  assert.equal(getEventListeners(second.abort.signal,'abort').length,0);
 }finally{first.abort.abort();second.abort.abort();}
});
