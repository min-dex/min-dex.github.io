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
    const main = await app.firstWindow();
    assert(await app.evaluate(({app}) => app.getPath('userData').includes('mindex-isolated-') && !!globalThis.__mindexTestIsolation?.networkBlocked), 'Requires isolated QA package');
    const isWindows = process.platform === 'win32';
    if (isWindows) {
      // The isolated app blocks all remote requests. Start the controller in
      // its unconfigured state so storage startup can reach real toolbar IPC.
      await main.addInitScript(() => {
        Object.defineProperty(window, 'MINDEX_SUPABASE', { get: () => ({}), set: () => {} });
      });
      await main.reload();
      try {
        await main.locator('#desktopBroadcastBtn').waitFor({state:'visible'});
      } catch (error) {
        const boot = await main.evaluate(() => ({
          protocol: location.protocol,
          controller: location.pathname.endsWith('/index.html') && !location.search.includes('output='),
          binding: typeof bindElectronDesktopEvents,
          platform: window.mindexElectron?.platform,
          broadcast: typeof window.mindexElectron?.openBroadcast,
          bootFailed: document.body?.dataset.bootFailed === 'true',
          booting: document.body?.classList.contains('ui-booting'),
          buttonHidden: document.getElementById('desktopBroadcastBtn')?.hidden,
        }));
        throw new Error('Windows toolbar boot: ' + JSON.stringify(boot), {cause:error});
      }
      const left = main.locator('.topbar-module-strip button:visible');
      assert.equal(await left.count(), 6, 'Windows left toolbar must have six actions');
      const ids = ['themeBtn','saveAllBtn','remotePanelBtn','monitorPanelBtn','desktopUpdateBtn','desktopBroadcastBtn'];
      const boxes = await Promise.all(ids.map(id => main.locator('#'+id).boundingBox()));
      assert(boxes.every((box,index) => box && (index === 0 ||
        Math.abs(box.y-boxes[0].y)<1 && box.x>boxes[index-1].x)),
      'Windows right toolbar must have six ordered actions on one row');
      assert(await app.evaluate(({Menu}) => !Menu.getApplicationMenu().items.some(
        item => ['업데이트','방송'].includes(item.label))), 'Moved actions must be absent from the native menu');
      await main.locator('#desktopUpdateBtn').click();
      await main.getByText('자동 업데이트는 배포용 설치 앱에서 사용할 수 있습니다.',{exact:true}).waitFor();
      console.log('PASS installed Windows 6+6 toolbar and update button IPC (isolated updates disabled)');
    }
    const opened = app.waitForEvent('window');
    if (isWindows) await main.locator('#desktopBroadcastBtn').click();
    else await app.evaluate(({Menu})=>Menu.getApplicationMenu().items.find(x=>x.label==='방송').submenu.items[0].click());
    const panel = await opened;
    await panel.locator('#ytStart').waitFor({state:'visible'});
    assert(await panel.locator('#ytStart').isDisabled());
    assert(await panel.locator('#test').isHidden());
    assert.equal(await panel.locator('#title').inputValue(),'');
    await panel.getByText('영상 파일 및 입력 확인',{exact:true}).click();
    await panel.locator('#file').setInputFiles(file('fixture.mp4'));
    await panel.getByText('수동 자막 및 화면 설정',{exact:true}).click();
    await panel.locator('#text').fill('기쁨으로 함께 예배해요');
    await panel.locator('#apply').click();
    await panel.waitForFunction(()=>window.broadcastPrototype?.stats().source==='file');
    assert.equal(await panel.locator('#ytBitrate').inputValue(),'14000');
    assert(await panel.locator('#ytRecord').isChecked());
    assert.deepEqual(await panel.locator('#broadcast').evaluate(c=>[c.width,c.height]),[1920,1080]);
    // Stub only the OS dialog result. The packaged renderer, preload, main
    // handler, encoder and MP4 filesystem write still use their real paths.
    await app.evaluate(({dialog}) => {
      globalThis.__recordDialogFixture = {calls:0, destination:null};
      dialog.showSaveDialog = async (_window, options) => {
        if (!options.defaultPath.endsWith('.mp4') || !options.filters.some(filter => filter.extensions.includes('mp4'))) {
          throw Error('Expected a recording save dialog with an MP4 filter');
        }
        const fixture = globalThis.__recordDialogFixture;
        fixture.calls++;
        return fixture.destination ? {canceled:false,filePath:fixture.destination} : {canceled:true};
      };
    });
    await panel.locator('#ytKey').fill(key);
    await panel.locator('#ytStart').click();
    await panel.waitForFunction(()=>document.querySelector('#ytStatus').textContent==='저장 선택을 취소했습니다.');
    assert.equal(publishes,0);
    assert.equal(await app.evaluate(()=>globalThis.__recordDialogFixture.calls),1);
    await app.evaluate((_electron,destination)=>{ globalThis.__recordDialogFixture.destination=destination; },file('recording.mp4'));
    await panel.locator('#ytStart').click();
    await panel.waitForFunction(()=>document.querySelector('#ytStatus').textContent==='송출·녹화 중',null,{timeout:30000});
    assert.equal(await panel.locator('#ytKey').inputValue(),'');
    await sleep(2200);
    await panel.getByText('유튜브 송출 차단',{exact:true}).click();
    await panel.locator('#excludeBroadcast').click();
    // The routing toggle applies before the next animation frame paints the local preview.
    await panel.waitForFunction(()=>!broadcastPrototype.routing().broadcast && document.querySelector('#program').getContext('2d').getImageData(10,10,1,1).data[2]>210,null,{timeout:5000});
    await sleep(2500);
    await panel.locator('#excludeBroadcast').click(); await sleep(2500);
    await panel.locator('#ytStop').click();
    await panel.waitForFunction(()=>document.querySelector('#ytStatus').textContent==='송출 종료 · 녹화 저장 완료');
    await received;
    assert.equal(publishes,1); assert(matchingKey);
    assert.equal(await app.evaluate(()=>globalThis.__recordDialogFixture.calls),2);
    const packetHashes = (source,format) => {
      // The stream-copy sender reads fragmented MP4 from a non-seekable
      // pipe. Hash the recorded bytes through the same demuxer input mode.
      const input=fs.openSync(file(source),'r');
      try {
        return execFileSync(ffmpeg,['-loglevel','error','-f',format,'-i','pipe:0','-map','0:v:0','-map','0:a:0','-c','copy','-f','framehash','pipe:1'],
          {encoding:'utf8',stdio:[input,'pipe','pipe']});
      } finally { fs.closeSync(input); }
    };
    const recorded=packetHashes('recording.mp4','mp4'), transmitted=packetHashes('received.flv','flv');
    assert.match(recorded,/#dimensions 0: 1920x1080/);
    const streamHashes = (output,stream) => output.split(/\r?\n/)
      .filter(line=>line.trimStart().startsWith(stream+','))
      .map(line=>line.split(',').at(-1).trim());
    for (const stream of [0,1]) {
      assert(streamHashes(recorded,stream).length>0);
      assert.deepEqual(streamHashes(recorded,stream),streamHashes(transmitted,stream),'Recorded and transmitted packets differ for stream '+stream);
    }
    console.log('PASS packaged MP4 dialog cancellation and 1080p recording match local RTMPS packets');
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
    await panel.locator('#ytRecord').uncheck();
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
