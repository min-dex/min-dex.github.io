const net = require('node:net');
const tls = require('node:tls');
const {randomUUID} = require('node:crypto');
const {spawn} = require('node:child_process');
const {once} = require('node:events');
const {encodingArgs,bitrate} = require('./youtube-profile');
const fs = require('node:fs');
const {Writable} = require('node:stream');
const {pipeline} = require('node:stream/promises');

const youtube = {host:'a.rtmps.youtube.com', port:443, servername:'a.rtmps.youtube.com'};
const validKey = key => typeof key === 'string' && /^[A-Za-z0-9_-]{6,128}$/.test(key);

// Only the main process supplies a destination. The password travels to FFmpeg
// through a private pipe, never in argv, a settings file, or diagnostic output.
async function startEncoder({exe, key, destination = youtube, onState, signal, bitrateKbps = 14000, recordingPath}) {
  if (!validKey(key)) throw Error('스트림 키 형식을 확인해 주세요.');
  bitrate(bitrateKbps);
  signal.throwIfAborted();
  const sockets = new Set();
  const listeners = [];
  const transferAbort = new AbortController();
  let completeRelay;
  const relayDrained = new Promise(resolve => { completeRelay = resolve; });
  let child, muxer, recording, transfer, finished, relaySocket, closing = false, live = false;
  const cleanup = preserveSocket => {
    completeRelay(false);
    transferAbort.abort();
    for (const server of listeners) server.close();
    for (const socket of sockets) if (socket !== preserveSocket) socket.destroy();
    child?.kill('SIGKILL');
    muxer?.kill('SIGKILL');
    recording?.destroy();
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
    // Local muxer exit does not mean the relay's final TLS writes have drained.
    // Finish local TLS writes, then allow a graceful half-close. A peer need
    // not return EOF immediately; the original stop deadline bounds retirement.
    let transportFailed = false;
    const transportDrained = new Promise(resolve => {
      encrypted.once('finish', () => resolve(true));
      encrypted.once('error', () => { transportFailed = true; resolve(false); });
      encrypted.once('close', hadError => {
        if (hadError || !encrypted.writableFinished) transportFailed = true;
        resolve(!transportFailed);
      });
    });
    encrypted.setTimeout(12000, () => encrypted.destroy(Error('전송 시간 초과')));
    await once(encrypted, 'secureConnect', {signal});
    encrypted.once('end', () => { if (!closing) cleanup(); });
    encrypted.once('close', () => { if (!closing) cleanup(); });
    const relay = net.createServer(socket => {
      relay.close();
      relaySocket = socket;
      socket.once('end', () => completeRelay(true));
      socket.once('error', () => completeRelay(false));
      socket.once('close', () => completeRelay(socket.readableEnded));
      remember(socket).pipe(encrypted).pipe(socket);
      // FFmpeg can close its local RTMP socket without a readable EOF. Once
      // that source is closed, end (not destroy) TLS so buffered writes flush.
      socket.once('close', () => {
        if (!closing) return;
        encrypted.unpipe(socket);
        encrypted.resume();
        if (!encrypted.writableEnded) encrypted.end();
      });
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
    // Encode once. The same fragmented MP4 bytes go to disk and to a
    // stream-copy RTMP muxer; recording does not introduce another encoder.
    if (recordingPath) {
      const fd = fs.openSync(recordingPath, 'wx', 0o600);
      recording = fs.createWriteStream(recordingPath, {fd});
      recording.on('error', () => cleanup());
    }
    const common = ['-hide_banner','-loglevel','error','-nostdin'];
    const muxArgs = [...common,'-protocol_whitelist','pipe','-f','mp4','-i','pipe:0',
      '-map','0:v:0','-map','0:a:0','-c','copy','-fpre',preset,'-rtmp_app','live2',
      '-rtmp_tcurl','rtmps://' + destination.host + ':' + destination.port + '/live2',
      '-rw_timeout','8000000','-progress','pipe:1','-f','flv','rtmp://127.0.0.1:' + relay.address().port + '/live2'];
    muxer = spawn(exe, muxArgs, {windowsHide:true, stdio:['pipe','pipe','ignore',...(windows?[]:['pipe'])]});
    // A dead muxer cannot read late server replies. Do not write them into its
    // closed TCP endpoint: EPIPE would destroy the still-readable outgoing tail.
    const discardReplies = () => {
      if (relaySocket) { encrypted.unpipe(relaySocket); encrypted.resume(); }
    };
    muxer.once('exit', discardReplies);
    muxer.once('close', discardReplies);
    muxer.stdin.on('error', () => {});
    if (!windows) {
      muxer.stdio[3].on('error', () => {});
      muxer.stdio[3].end('rtmp_playpath=' + key + '\n'); key = '';
    }
    const args = [...common,'-protocol_whitelist','pipe','-f','webm','-probesize','32768','-analyzeduration','0',
      '-i','pipe:0','-map','0:v:0','-map','0:a:0',...encodingArgs(bitrateKbps),
      '-movflags','+frag_keyframe+empty_moov+default_base_moof','-f','mp4','pipe:1'];
    child = spawn(exe,args,{windowsHide:true,stdio:['pipe','pipe','ignore']});
    child.stdin.on('error', () => {});
    const closed = process => new Promise(resolve => {
      process.once('error', () => resolve(false)); process.once('close', code => resolve(code === 0));
    });
    const encoderClosed=closed(child), muxerClosed=closed(muxer);
    muxerClosed.then(ok => { if (!ok && !closing) cleanup(); });
    const write = (target, bytes) => new Promise((resolve,reject) => target.write(bytes,error => error?reject(error):resolve()));
    transfer = pipeline(child.stdout,new Writable({
      write(bytes, _encoding, done) {
        Promise.all([write(muxer.stdin,bytes),...(recording?[write(recording,bytes)]:[])]).then(()=>done(),done);
      },
      final(done) {
        const end = target => new Promise((resolve,reject) => {
          target.once('error',reject); target.end(()=>{target.removeListener('error',reject);resolve();});
        });
        Promise.all([end(muxer.stdin),...(recording?[end(recording)]:[])]).then(()=>done(),done);
      }
    }),{signal:transferAbort.signal}).then(()=>true,()=>{cleanup();return false;});
    let progress='';
    muxer.stdout.on('data', data => {
      progress += data.toString();
      const lines=progress.split('\n');progress=lines.pop();
      // A stream-copy muxer need not report encoded frame counts.
      if (!live && lines.some(line=>/^out_time_us=[1-9][0-9]*$/.test(line.trim()))) {
        live = true; onState('live');
      }
    });
    finished = Promise.all([encoderClosed,muxerClosed,transfer,relayDrained,transportDrained])
      .then(results=>results.every(Boolean) && !transportFailed && !signal.aborted);
    finished.then(ok => {
      const graceful = closing && ok;
      cleanup(graceful ? encrypted : undefined);
      const detach = () => signal.removeEventListener('abort', cleanup);
      if (graceful && !encrypted.destroyed) encrypted.once('close', detach);
      else detach();
      onState(graceful ? 'stopped' : 'failed');
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
        try { return await finished; } finally {
          // Successful writes may finish before the peer's half-close. Keep
          // that TLS socket alive only within the same total stop deadline.
          if (encrypted.destroyed) clearTimeout(timer);
          else encrypted.once('close', () => clearTimeout(timer));
        }
      }
    };
  } catch {
    cleanup();
    signal.removeEventListener('abort', cleanup);
    throw Error('방송 서버 연결에 실패했습니다.');
  }
}
module.exports = {startEncoder};
