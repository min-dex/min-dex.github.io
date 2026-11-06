const net = require('node:net');
const tls = require('node:tls');
const {randomUUID} = require('node:crypto');
const {spawn} = require('node:child_process');
const {once} = require('node:events');

const youtube = {host:'a.rtmps.youtube.com', port:443, servername:'a.rtmps.youtube.com'};
const validKey = key => typeof key === 'string' && /^[A-Za-z0-9_-]{6,128}$/.test(key);

// Only the main process supplies a destination. The password travels to FFmpeg
// through a private pipe, never in argv, a settings file, or diagnostic output.
async function startEncoder({exe, key, destination = youtube, onState, signal}) {
  if (!validKey(key)) throw Error('스트림 키 형식을 확인해 주세요.');
  signal.throwIfAborted();
  const sockets = new Set();
  const listeners = [];
  let child, finished, closing = false, live = false;
  const cleanup = () => {
    for (const server of listeners) server.close();
    for (const socket of sockets) socket.destroy();
    child?.kill('SIGKILL');
  };
  const remember = socket => {
    sockets.add(socket);
    socket.on('error', () => { if (!closing) cleanup(); });
    return socket;
  };
  async function listen(server, address) {
    listeners.push(server);
    server.listen(address);
    await once(server, 'listening', {signal});
  }
  signal.addEventListener('abort', cleanup, {once:true});
  try {
    const encrypted = remember(tls.connect({...destination, rejectUnauthorized:true, minVersion:'TLSv1.2'}));
    encrypted.setTimeout(12000, () => encrypted.destroy(Error('전송 시간 초과')));
    await once(encrypted, 'secureConnect', {signal});
    const relay = net.createServer(socket => {
      relay.close();
      remember(socket).pipe(encrypted).pipe(socket);
      encrypted.on('close', () => socket.destroy());
    });
    await listen(relay, {host:'127.0.0.1', port:0});
    const windows = process.platform === 'win32';
    let preset = '/dev/fd/3';
    if (windows) {
      preset = '\\\\.\\pipe\\mindex-' + randomUUID();
      const pipe = net.createServer(socket => {
        pipe.close();
        remember(socket).end('rtmp_playpath=' + key + '\n');
        key = '';
      });
      await listen(pipe, preset);
    }
    signal.throwIfAborted();
    const args = ['-hide_banner','-loglevel','error','-nostdin','-protocol_whitelist','pipe',
      '-f','webm','-probesize','32768','-analyzeduration','0','-i','pipe:0','-map','0:v:0','-map','0:a:0',
      '-c:v','libx264','-threads','2','-preset','veryfast','-tune','zerolatency','-pix_fmt','yuv420p',
      '-r','30','-g','60','-sc_threshold','0','-b:v','4000k','-maxrate','4000k','-bufsize','8000k',
      '-c:a','aac','-b:a','128k','-ar','48000','-ac','2','-fpre',preset,'-rtmp_app','live2',
      '-rtmp_tcurl','rtmps://' + destination.host + ':' + destination.port + '/live2',
      '-rw_timeout','8000000','-progress','pipe:1','-f','flv','rtmp://127.0.0.1:' + relay.address().port + '/live2'];
    child = spawn(exe, args, {windowsHide:true, stdio:['pipe','pipe','ignore',...(windows?[]:['pipe'])]});
    child.stdin.on('error', () => {});
    if (!windows) {
      child.stdio[3].on('error', () => {});
      child.stdio[3].end('rtmp_playpath=' + key + '\n');
      key = '';
    }
    child.stdout.on('data', data => {
      if (!live && /frame=\s*[1-9]/.test(data.toString())) { live = true; onState('live'); }
    });
    finished = new Promise(resolve => {
      child.once('error', () => resolve(false));
      child.once('close', code => resolve(code === 0));
    });
    finished.then(ok => {
      cleanup();
      signal.removeEventListener('abort', cleanup);
      onState(closing && ok ? 'stopped' : 'failed');
    });
    let writing = false;
    return {
      async write(bytes) {
        if (writing || closing || !(bytes instanceof Uint8Array) || !bytes.length || bytes.length > 1048576)
          throw Error('방송 입력을 확인해 주세요.');
        writing = true;
        try { await new Promise((ok, fail) => child.stdin.write(bytes, err => err ? fail(err) : ok())); }
        finally { writing = false; }
      },
      async stop() {
        closing = true;
        child.stdin.end();
        const timer = setTimeout(cleanup, 8000);
        try { return await finished; } finally { clearTimeout(timer); }
      }
    };
  } catch {
    cleanup();
    signal.removeEventListener('abort', cleanup);
    throw Error('방송 서버 연결에 실패했습니다.');
  }
}
module.exports = {startEncoder};
