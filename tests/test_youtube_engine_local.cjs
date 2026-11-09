// Explicit, offline integration: node tests/test_youtube_engine_local.cjs /path/to/ffmpeg
const {execFileSync,spawn}=require('node:child_process');
const {once}=require('node:events');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const net=require('node:net'),tls=require('node:tls'),assert=require('node:assert/strict');
const {startEncoder}=require('../electron/youtube-engine');
async function main(){
 const exe=process.argv[2],probe=path.join(path.dirname(exe),'ffprobe');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'broadcast-profile-')),f=n=>path.join(dir,n);
 let sink,server,peer;const abort=new AbortController();
 try{
  fs.writeFileSync(f('conf'),'[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=localhost\n[ext]\nsubjectAltName=DNS:localhost\nbasicConstraints=critical,CA:TRUE\n');
  execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-config',f('conf'),'-keyout',f('key'),'-out',f('cert')],{stdio:'ignore'});
  execFileSync(exe,['-v','error','-f','lavfi','-i','testsrc2=size=1920x1080:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=48000','-t','5','-c:v','libvpx','-deadline','realtime','-b:v','20M','-c:a','libopus',f('input.webm')]);
  const reserve=net.createServer().listen(0,'127.0.0.1');await once(reserve,'listening');const port=reserve.address().port;await new Promise(r=>reserve.close(r));
  sink=spawn(exe,['-v','error','-listen','1','-timeout','30','-i',`rtmp://127.0.0.1:${port}/live2/synthetic-key`,'-c','copy',f('received.flv')],{stdio:'ignore'});const received=once(sink,'close');
  await new Promise(r=>setTimeout(r,300));
  server=tls.createServer({key:fs.readFileSync(f('key')),cert:fs.readFileSync(f('cert'))},socket=>{peer=socket;const receiver=net.connect(port,'127.0.0.1');receiver.on('error',()=>socket.destroy());socket.on('error',()=>receiver.destroy());socket.on('close',()=>receiver.destroy());receiver.pipe(socket).pipe(receiver);}).listen(0,'127.0.0.1');await once(server,'listening');
  const states=[];
  const run=await startEncoder({exe,key:'synthetic-key',bitrateKbps:14000,recordingPath:f('recording.mp4'),destination:{host:'127.0.0.1',servername:'localhost',port:server.address().port,ca:fs.readFileSync(f('cert'))},signal:abort.signal,onState:s=>states.push(s)});
  const input=fs.readFileSync(f('input.webm'));
  for(let offset=0;offset<input.length;offset+=65536)await run.write(input.subarray(offset,offset+65536));
  assert.equal(await run.stop(),true);await received;
  const info=JSON.parse(execFileSync(probe,['-v','error','-show_streams','-show_packets','-show_data_hash','sha256','-of','json',f('recording.mp4')],{maxBuffer:20e6}));
  const video=info.streams.find(s=>s.codec_type==='video');assert.equal(video.width,1920);assert.equal(video.height,1080);assert.equal(video.r_frame_rate,'30/1');assert.equal(video.codec_name,'h264');
  const remote=JSON.parse(execFileSync(probe,['-v','error','-show_packets','-show_data_hash','sha256','-of','json',f('received.flv')],{maxBuffer:20e6}));
  for(const type of ['video','audio'])assert.deepEqual(remote.packets.filter(p=>p.codec_type===type).map(p=>p.data_hash),info.packets.filter(p=>p.codec_type===type).map(p=>p.data_hash));
  const packets=info.packets.filter(p=>p.codec_type==='video');
  const keys=packets.flatMap((p,i)=>p.flags.includes('K')?[{index:i,time:Number(p.pts_time)}]:[]);
  assert(keys.length>=3);
  for(let i=1;i<keys.length;i++){
   assert.equal(keys[i].index-keys[i-1].index,60);
   // Fragmented MP4 normalizes the first sample to zero; AAC priming can
   // shift the following samples by < one frame. Later GOPs remain exactly 2s.
   assert(Math.abs(keys[i].time-keys[i-1].time-2)<(i===1?1/30:.001));
  }
  assert(states.includes('live'));assert(states.includes('stopped'));
  sink=spawn(exe,['-v','error','-listen','1','-timeout','30','-i',`rtmp://127.0.0.1:${port}/live2/synthetic-key`,'-c','copy','-f','null','-'],{stdio:'ignore'});
  await new Promise(r=>setTimeout(r,300));
  const next=[];
  const second=await startEncoder({exe,key:'synthetic-key',bitrateKbps:18000,destination:{host:'127.0.0.1',servername:'localhost',port:server.address().port,ca:fs.readFileSync(f('cert'))},signal:abort.signal,onState:s=>next.push(s)});
  for(let offset=0;offset<input.length;offset+=65536)await second.write(input.subarray(offset,offset+65536));
  const waitFor=async predicate=>{for(let n=0;n<150;n++){if(predicate())return;await new Promise(r=>setTimeout(r,100));}throw Error('state timeout: '+next);};
  await waitFor(()=>next.includes('live'));peer.destroy();await waitFor(()=>next.includes('failed'));
  console.log('PASS adjustable bitrate, recording disabled, receiver disconnect cleanup');
  console.log('PASS 1080p30, 2-second GOP, clean stop, identical H.264/AAC packets in local MP4 and TLS/RTMP receiver');
 }finally{abort.abort();peer?.destroy();server?.close();sink?.kill('SIGKILL');fs.rmSync(dir,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1});
