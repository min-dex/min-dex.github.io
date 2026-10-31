"""Isolated native encoding + real RTMPS loopback. No external publishing API."""
import pathlib, subprocess, tempfile, socket, ssl, threading, time, os, select
import sys
MAX_CHUNK=1024*1024
MAX_TOTAL=20*1024*1024

def encoder_path():
 # The test package has one pinned encoder alongside the frozen helper.
 exe=pathlib.Path(sys.executable).resolve().with_name('ffmpeg.exe' if os.name=='nt' else 'ffmpeg')
 if not exe.is_file():raise RuntimeError('Packaged encoder missing')
 return str(exe)

def local_target(port):
 if type(port) is not int or not 1024<=port<=65535:raise ValueError('local port')
 return f'rtmps://localhost:{port}/live/local-test'

def encoder_args(exe,target,*,native_h264=False):
 # FFmpeg encodes RTMP locally; the verified Python TLS adapter carries RTMPS.
 # macOS SecureTransport does not honor this test CA reliably, so never disable verification.
 # Only the generated loopback target is accepted, even by direct Python callers.
 from urllib.parse import urlsplit
 u=urlsplit(target)
 if u.hostname!='localhost' or u.scheme!='rtmps' or u.username or u.password or u.query or u.fragment or target!=local_target(u.port):raise ValueError('External publishing disabled')
 video=['-c:v','copy'] if native_h264 else ['-vf','scale=1280:720,fps=30','-c:v','libx264','-threads','2','-preset','ultrafast','-tune','zerolatency','-pix_fmt','yuv420p','-b:v','2500k','-maxrate','2500k','-bufsize','5000k','-g','60','-keyint_min','60','-sc_threshold','0']
 return [exe,'-hide_banner','-loglevel','error','-nostdin','-protocol_whitelist','pipe',
  '-f','webm','-probesize','32768','-analyzeduration','0','-i','pipe:0',
  '-map','0:v:0','-map','0:a:0',*video,
  '-c:a','aac','-b:a','128k','-ar','48000','-ac','2',
  '-rw_timeout','5000000','-f','flv',f'rtmp://127.0.0.1:{u.port}/live/local-test']

def stop_process(proc):
 if proc and proc.poll() is None:
  proc.terminate()
  try:proc.wait(timeout=2)
  except subprocess.TimeoutExpired:proc.kill();proc.wait(timeout=2)

class LoopbackSession:
 """Bounded 30s test sink. All media and disposable TLS material stay in tempdir."""
 def __init__(self,*,_soak_seconds=None,_native_h264=False):
  if _soak_seconds is not None and (type(_soak_seconds) is not int or not 1<=_soak_seconds<=600):raise ValueError("soak duration")
  self.max_seconds=30 if _soak_seconds is None else _soak_seconds+90
  self.max_bytes=MAX_TOTAL if _soak_seconds is None else 512*1024*1024
  self.finishing=False
  self.lock=threading.Lock();self.closed=False;self.seq=0;self.bytes=0;self.last=time.monotonic();self.started=self.last
  self.encoder=None;self.receiver=None;self.listener=None;self.sender_listener=None;self.connections=[];self.tls=False;self.verified_tls=False;self.relay_bytes=0;self.failure=None
  self.temp=tempfile.TemporaryDirectory(prefix='mindex-rtmps-');self.path=pathlib.Path(self.temp.name);self.output=self.path/'received.flv'
  self.env={k:v for k,v in os.environ.items() if k.lower() not in ('http_proxy','https_proxy','all_proxy')}
  try:
   self.exe=encoder_path()
   # New test-only key, never an existing credential. It is neither logged nor returned.
   cert=self.path/'cert.pem';key=self.path/'key.pem'
   if os.name=='nt':
    from windows_runtime import issue_local_certificate
    issue_local_certificate(cert,key)
   else:
    config=self.path/'cert.cnf';config.write_text('[req]\ndistinguished_name=dn\nx509_extensions=ext\nprompt=no\n[dn]\nCN=localhost\n[ext]\nsubjectAltName=DNS:localhost\nbasicConstraints=critical,CA:TRUE\n')
    subprocess.run(['/usr/bin/openssl','req','-x509','-newkey','rsa:2048','-nodes','-days','1','-config',str(config),'-keyout',str(key),'-out',str(cert)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=True,timeout=10)
    key.chmod(0o600)
   context=ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER);context.minimum_version=ssl.TLSVersion.TLSv1_2;context.load_cert_chain(cert,key)
   with socket.socket() as reserve:reserve.bind(('127.0.0.1',0));rtmp_port=reserve.getsockname()[1]
   self.receiver=subprocess.Popen([self.exe,'-hide_banner','-loglevel','error','-nostdin','-rw_timeout','3000000','-listen','1','-timeout','10','-i',f'rtmp://127.0.0.1:{rtmp_port}/live/local-test','-c','copy','-f','flv',str(self.output)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,env=self.env)
   self.listener=socket.socket();self.listener.bind(('127.0.0.1',0));self.listener.listen(1);self.listener.settimeout(10)
   port=self.listener.getsockname()[1]
   self.relay=threading.Thread(target=self._relay,args=(context,rtmp_port),daemon=True);self.relay.start()
   self.sender_listener=socket.socket();self.sender_listener.bind(('127.0.0.1',0));self.sender_listener.listen(1);self.sender_listener.settimeout(10)
   self.sender=threading.Thread(target=self._send_tls,args=(cert,port),daemon=True);self.sender.start()
   self.log=open(self.path/'encoder.log','wb')
   self.encoder=subprocess.Popen(encoder_args(self.exe,local_target(self.sender_listener.getsockname()[1]),native_h264=_native_h264),stdin=subprocess.PIPE,stdout=subprocess.DEVNULL,stderr=self.log,bufsize=0,env=self.env)
   threading.Thread(target=self._watch,daemon=True).start()
  except Exception:self.close();raise
 def _send_tls(self,cert,port):
  try:
   raw,_=self.sender_listener.accept();raw.settimeout(5);self.connections.append(raw)
   context=ssl.create_default_context(cafile=str(cert));context.minimum_version=ssl.TLSVersion.TLSv1_2
   with raw, socket.create_connection(('127.0.0.1',port),timeout=5) as transport:
    with context.wrap_socket(transport,server_hostname='localhost') as secure:
     self.connections.append(secure);self.verified_tls=True
     while not self.closed:
      readable,_,_=select.select([raw,secure],[],[],.2)
      if secure.pending():readable=list(set(readable+[secure]))
      for src in readable:
       data=src.recv(65536)
       if not data:return
       (secure if src is raw else raw).sendall(data)
  except Exception:
   if not self.closed:self.failure='verified TLS transport failed'
 def _relay(self,context,port):
  try:
   raw,_=self.listener.accept();raw.settimeout(8);self.connections.append(raw)
   with context.wrap_socket(raw,server_side=True) as incoming:
    self.connections.append(incoming);self.tls=True
    # Retry refused loopback connects only; never probe/consume the RTMP listener.
    peer=None
    for _ in range(50):
     try:peer=socket.create_connection(('127.0.0.1',port),timeout=1);break
     except ConnectionRefusedError:time.sleep(.02)
    if peer is None:raise RuntimeError('receiver')
    with peer:
     self.connections.append(peer);peer.settimeout(5)
     while not self.closed:
      readable,_,_=select.select([incoming,peer],[],[],.2)
      if incoming.pending():readable=list(set(readable+[incoming]))
      for src in readable:
       data=src.recv(65536)
       if not data:return
       dst=peer if src is incoming else incoming
       dst.sendall(data)
       if src is incoming:self.relay_bytes+=len(data)
  except Exception:
   if not self.closed:self.failure='local receiver disconnected'
 def _watch(self):
  while not self.closed:
   time.sleep(.25)
   if (not self.finishing and time.monotonic()-self.last>10) or time.monotonic()-self.started>self.max_seconds:self.close();return
 def write(self,seq,data):
  with self.lock:
   if self.closed or self.encoder.poll() is not None:raise ValueError('session stopped')
   if type(seq) is not int or seq!=self.seq:raise ValueError('chunk order')
   if not data or len(data)>MAX_CHUNK or self.bytes+len(data)>self.max_bytes:raise ValueError('media limit')
   # Nonblocking pipe with bounded backpressure; never queue unbounded media.
   fd=self.encoder.stdin.fileno();
   if os.name!='nt':os.set_blocking(fd,False)
   view=memoryview(data);deadline=time.monotonic()+5
   while view:
    if self.closed or time.monotonic()>deadline:raise ValueError('encoder backpressure')
    if os.name=='nt' or select.select([],[fd],[],.1)[1]:
     try:n=os.write(fd,view);view=view[n:]
     except BlockingIOError:pass
   self.seq+=1;self.bytes+=len(data);self.last=time.monotonic()
 def finish(self):
  with self.lock:
   if self.closed:raise ValueError('session stopped')
   self.last=time.monotonic();self.finishing=True;self.encoder.stdin.close()
   try:
    # Bound receiver shutdown as well as connection setup; always decode received media afterward.
    code=self.encoder.wait(timeout=8);self.sender.join(timeout=3);self.relay.join(timeout=3);self.receiver.wait(timeout=12)
    if code or not self.verified_tls or not self.tls or not self.output.exists():raise ValueError('RTMPS test failed')
    # Decode the received stream, not just sender exit status or uploaded byte count.
    check=subprocess.run([self.exe,'-hide_banner','-i',str(self.output),'-map','0:v:0','-map','0:a:0','-f','null','-'],capture_output=True,timeout=max(10,self.max_seconds/5),env=self.env)
    details=check.stderr.decode(errors='replace')
    if check.returncode or 'Video: h264' not in details or 'Audio: aac' not in details or '1280x720' not in details:raise ValueError('receiver decode failed')
    import array
    # Stream the verification PCM instead of retaining the entire recording in RAM.
    decoder=subprocess.Popen([self.exe,'-v','error','-i',str(self.output),'-map','0:a:0','-ac','1','-f','f32le','pipe:1'],stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,env=self.env)
    peak=0.;count=0;tail=b'';deadline=time.monotonic()+max(10,self.max_seconds/5)
    try:
     while True:
      if time.monotonic()>deadline:raise ValueError('audio inspection timeout')
      if os.name!='nt' and not select.select([decoder.stdout],[],[],.1)[0]:continue
      block=os.read(decoder.stdout.fileno(),65536)
      if not block:break
      block=tail+block;size=len(block)//4*4;tail=block[size:]
      samples=array.array('f');samples.frombytes(block[:size]);count+=len(samples)
      if samples:peak=max(peak,max(map(abs,samples)))
     if decoder.wait(timeout=2) or not count:raise ValueError('empty audio')
    finally:
     stop_process(decoder);decoder.stdout.close()
    pixel=subprocess.run([self.exe,'-v','error','-ss','0.5','-i',str(self.output),'-vf','format=rgb24,crop=2:2:10:10','-frames:v','1','-pix_fmt','rgb24','-f','rawvideo','pipe:1'],capture_output=True,check=True,timeout=10,env=self.env).stdout
    if len(pixel)!=12:raise ValueError('empty video')
    return {'audioPeak':peak,'pixel':list(pixel[:3]),'received':True,'tls':True,'certificateVerified':self.verified_tls,'video':'H.264','audio':'AAC','width':1280,'height':720,'receivedBytes':self.output.stat().st_size,'inputBytes':self.bytes,'externalPublishing':False}
   finally:self._stop()
 def _stop(self):
  self.closed=True;stop_process(self.encoder)
  if self.encoder and self.encoder.stdin and not self.encoder.stdin.closed:self.encoder.stdin.close()
  for conn in self.connections:
   try:conn.close()
   except OSError:pass
  if self.listener:self.listener.close()
  if self.sender_listener:self.sender_listener.close()
  if hasattr(self,'log'):self.log.close()
  stop_process(self.receiver)
 def close(self):
  self._stop()
  if hasattr(self,'temp'):self.temp.cleanup()
