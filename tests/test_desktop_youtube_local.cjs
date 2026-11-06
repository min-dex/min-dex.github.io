// Packaged, isolated desktop acceptance. The test build can connect only to loopback.
const { _electron } = require('playwright');
const {spawn,execFileSync} = require('node:child_process');
const {once} = require('node:events');
const {setTimeout:sleep} = require('node:timers/promises');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const net = require('node:net'), tls = require('node:tls'), assert = require('node:assert/strict');

async function main() {
  const [desktop,ffmpeg] = process.argv.slice(2);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(),'mindex-youtube-qa-'));
  const file = name => path.join(tmp,name);
  let app, sink, server, peer;
  try {
    fs.writeFileSync(file('openssl.cnf'),'[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=localhost\n[ext]\nsubjectAltName=DNS:localhost\nbasicConstraints=critical,CA:TRUE\n');
    execFileSync('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-config',file('openssl.cnf'),'-keyout',file('qa.key'),'-out',file('qa.pem')],{stdio:'ignore'});
    execFileSync(ffmpeg,['-loglevel','error','-f','lavfi','-i','color=blue:size=320x180:rate=30','-f','lavfi','-i','sine=frequency=440','-t','3','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',file('fixture.mp4')]);
    const reserve = net.createServer().listen(0,'127.0.0.1'); await once(reserve,'listening');
    const port = reserve.address().port; await new Promise(ok=>reserve.close(ok));
    const key = 'isolated-demo-key';
    sink = spawn(ffmpeg,['-loglevel','error','-listen','1','-timeout','45','-i','rtmp://127.0.0.1:'+port+'/live2/'+key,'-c','copy','-f','flv',file('received.flv')],{stdio:'ignore'});
    const received = once(sink,'close');
    let publishes = 0, matchingKey = false;
    server = tls.createServer({key:fs.readFileSync(file('qa.key')),cert:fs.readFileSync(file('qa.pem'))},socket=>{
      peer=socket; publishes++;
      const receiver = net.connect(port,'127.0.0.1');
      let previous = Buffer.alloc(0);
      socket.on('data',data=>{
        if(matchingKey) return;
        const sample=Buffer.concat([previous,data]); matchingKey=sample.includes(Buffer.from(key)); previous=sample.subarray(-key.length);
      });
      receiver.on('error',()=>socket.destroy());socket.on('error',()=>receiver.destroy());
      socket.on('close',()=>receiver.destroy());
      receiver.pipe(socket).pipe(receiver);
    }).listen(0,'127.0.0.1');
    await once(server,'listening');
    app = await _electron.launch({executablePath:desktop,args:['--no-first-run'],env:{...process.env,MINDEX_ISOLATED_TEST:'1',MINDEX_QA_RTMPS_PORT:String(server.address().port),MINDEX_QA_RTMPS_CA:file('qa.pem')}});
    await app.firstWindow();
    assert(await app.evaluate(({app}) => app.getPath('userData').includes('mindex-isolated-') && !!globalThis.__mindexTestIsolation?.networkBlocked), 'Requires isolated QA package');
    const opened = app.waitForEvent('window');
    await app.evaluate(({Menu})=>Menu.getApplicationMenu().items.find(x=>x.label==='방송').submenu.items[0].click());
    const panel = await opened;
    await panel.locator('#file').setInputFiles(file('fixture.mp4'));
    await panel.waitForFunction(()=>window.broadcastPrototype?.stats().source==='file');
    await panel.locator('#ytKey').fill(key);
    assert.equal(publishes,0);
    await panel.locator('#ytStart').click();
    await panel.waitForFunction(()=>document.querySelector('#ytStatus').textContent==='송출 중',null,{timeout:20000});
    assert.equal(await panel.locator('#ytKey').inputValue(),'');
    await sleep(2200);
    await panel.locator('#excludeBroadcast').click();
    assert(await panel.evaluate(()=>!broadcastPrototype.routing().broadcast && document.querySelector('#program').getContext('2d').getImageData(10,10,1,1).data[2]>210));
    await sleep(2500);
    await panel.locator('#excludeBroadcast').click(); await sleep(2500);
    await panel.locator('#ytStop').click();
    await panel.waitForFunction(()=>document.querySelector('#ytStatus').textContent==='송출 종료');
    await received;
    assert.equal(publishes,1); assert(matchingKey);
    const decode = args => execFileSync(ffmpeg,['-loglevel','error','-i',file('received.flv'),...args,'pipe:1'],{maxBuffer:40*1024*1024});
    const frames = decode(['-an','-vf','fps=4,scale=160:90','-pix_fmt','rgb24','-f','rawvideo']);
    const audio = decode(['-vn','-ac','1','-ar','8000','-f','s16le']);
    const phases=[];
    for(let i=0;i<Math.floor(frames.length/(160*90*3));i++){
      const frame=frames.subarray(i*160*90*3,(i+1)*160*90*3), blue=frame[2]>180&&frame[0]<60;
      let bright=0;
      for(let y=60;y<89;y++)for(let x=5;x<155;x++){const j=3*(y*160+x);if(Math.min(...frame.subarray(j,j+3))>150) bright++;}
      let peak=0;
      for(let j=i*4000;j<Math.min(audio.length,(i+1)*4000);j+=2)peak=Math.max(peak,Math.abs(audio.readInt16LE(j)));
      phases.push(blue && bright>5 && peak>200?'caption+tone':!blue && peak===0?'slate+silent':'transition');
    }
    const sequence=phases.filter(x=>x!=='transition').filter((x,i,a)=>!i||a[i-1]!==x);
    assert.deepEqual(sequence,['caption+tone','slate+silent','caption+tone'],JSON.stringify(phases));
    sink = spawn(ffmpeg,['-loglevel','error','-listen','1','-timeout','30','-i','rtmp://127.0.0.1:'+port+'/live2/'+key,'-c','copy','-f','null','-'],{stdio:'ignore'});
    await panel.locator('#ytKey').fill(key);
    await panel.locator('#ytStart').click();
    await panel.waitForFunction(()=>document.querySelector('#ytStatus').textContent==='송출 중');
    peer.destroy();
    await panel.waitForFunction(()=>!document.querySelector('#ytStart').disabled && document.querySelector('#ytStatus').textContent.includes('중단'));
    await sleep(700);
    assert.equal(publishes,2);
    console.log('PASS receiver disconnect releases controls without automatic publication');
    console.log('PASS desktop menu, key entry, authenticated TLS receiver, caption + tone → slate + silence → restored, CH8 retained, clean stop');
  }finally{if(app)await app.close();peer?.destroy();server?.close();sink?.kill('SIGKILL');fs.rmSync(tmp,{recursive:true,force:true});}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
