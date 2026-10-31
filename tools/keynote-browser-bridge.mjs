// Opt-in loopback companion. No worship credentials, arbitrary paths or public listener.
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { KEYNOTE_HTML_RUNTIME_SHA256, validateKeynoteHtmlManifest, assertKnownKeynoteHtmlRuntime } from '../mindex.keynote-html-engine.mjs';

export const PROTOCOL = 'mindex-keynote-bridge-v1';
const MAX_BYTES = 500 * 1024 * 1024;
const digest = value => crypto.createHash('sha256').update(value).digest('hex');
const secret = () => crypto.randomBytes(32).toString('hex');
const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.length === b.length && crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
const nativeError = code => Object.assign(Error('Keynote 내보내기를 완료하지 못했습니다.'),{keynoteCode:code});
const mime = name => ({js:'application/javascript',css:'text/css',html:'text/html',json:'application/json',pdf:'application/pdf',jpeg:'image/jpeg',jpg:'image/jpeg',png:'image/png',svg:'image/svg+xml',mp4:'video/mp4',mov:'video/quicktime',mp3:'audio/mpeg',m4a:'audio/mp4',wav:'audio/wav',woff:'font/woff',woff2:'font/woff2'}[name.split('.').pop()] || 'application/octet-stream');

export async function prepareExport(source, folder) {
  const sourceHash = digest(await fs.readFile(source));
  const header = JSON.parse(await fs.readFile(path.join(folder, 'assets/header.json'), 'utf8'));
  if (!Array.isArray(header.slideList) || header.slideList.length < 1 || header.slideList.length > 300) throw Error('슬라이드 수를 확인해 주세요.');
  const slides = []; let scene = 0, total = 0;
  for (const id of header.slideList) {
    if (!/^[a-f0-9-]{36}$/i.test(id)) throw Error('슬라이드 정보가 올바르지 않습니다.');
    const data = JSON.parse(await fs.readFile(path.join(folder, 'assets', id, id + '.json'), 'utf8'));
    if (!Array.isArray(data.events) || data.events.length < 1 || data.events.length > 1000) throw Error('효과 정보를 확인해 주세요.');
    slides.push({ thumbnail:'assets/' + id + '/thumbnail.jpeg', sceneStart:scene, scenes:data.events.length });scene += data.events.length;
  }
  const files = {};
  async function walk(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes:true })) {
      if (entry.isSymbolicLink()) throw Error('바로가기 파일은 지원하지 않습니다.');
      if (entry.name.startsWith('.') || entry.name === 'manifest.json') continue;
      const target = path.join(dir, entry.name), name = path.relative(folder, target).split(path.sep).join('/');
      if (entry.isDirectory()) { await walk(target);continue; }
      if (!entry.isFile() || (name !== 'index.html' && !name.startsWith('assets/')) || !/^[a-zA-Z0-9_./@-]+$/.test(name) || name.split('/').some(p=>p.startsWith('.'))) throw Error('지원하지 않는 재생 자료 경로입니다.');
      const stat = await fs.stat(target);total += stat.size;
      if (stat.size > 50 * 1024 * 1024 || total > MAX_BYTES || Object.keys(files).length >= 5000) throw Error('재생 자료의 크기를 확인해 주세요.');
      files[name] = { size:stat.size, sha256:digest(await fs.readFile(target)) };
    }
  }
  await walk(folder);
  const manifest = { format:'apple-keynote-html-v1',sourceSha256:sourceHash,pages:slides.length,scenes:scene,runtimeSha256:files['assets/player/main.js']?.sha256,slides,files };
  validateKeynoteHtmlManifest(manifest, manifest);assertKnownKeynoteHtmlRuntime(manifest);
  if (manifest.runtimeSha256 !== KEYNOTE_HTML_RUNTIME_SHA256) throw Error('이 Keynote 버전의 재생 자료는 확인이 필요합니다.');
  await fs.writeFile(path.join(folder, 'manifest.json'), JSON.stringify(manifest));
  return manifest;
}

export async function exportWithKeynote(source, target) {
  if (process.platform !== 'darwin') throw Error('Keynote가 설치된 Mac에서 실행해 주세요.');
  await new Promise((resolve,reject)=>{
    const launcher=spawn('/usr/bin/open',['-g','-b','com.apple.Keynote'],{stdio:'ignore'});
    const timer=setTimeout(()=>{launcher.kill();reject(nativeError('keynote-unavailable'));},15000);
    launcher.on('error',()=>{clearTimeout(timer);reject(nativeError('keynote-unavailable'));});
    launcher.on('close',code=>{clearTimeout(timer);code===0?resolve():reject(nativeError('keynote-unavailable'));});
  });
  // Only the received private temporary copy is opened. Paths are argv, never script text.
  const script = [
    'on run argv','set sourceAlias to (POSIX file (item 1 of argv)) as alias',
    'set expectedFile to sourceAlias as text',
    'with timeout of 300 seconds','tell application id "com.apple.Keynote"','launch',
    'ignoring application responses','open sourceAlias','end ignoring',
    'set importedDocument to missing value','repeat 120 times',
    'repeat with candidate in documents','try',
    'if ((get file of candidate) as text) is expectedFile then',
    'set importedDocument to contents of candidate','exit repeat','end if',
    'end try','end repeat',
    'if importedDocument is not missing value then exit repeat','delay 0.25','end repeat',
    'if importedDocument is missing value then error "Selected working copy did not open" number -1712',
    'try','export importedDocument to (POSIX file (item 2 of argv)) as HTML',
    'on error messageText number errorNumber','close importedDocument saving no',
    'error messageText number errorNumber','end try','close importedDocument saving no',
    'end tell','end timeout','end run'
  ].join('\n');
  await new Promise((resolve,reject)=>{
    const child=spawn('/usr/bin/osascript',['-',source,target],{stdio:['pipe','ignore','pipe']});
    let error='';const timer=setTimeout(()=>{child.kill();reject(nativeError('keynote-timeout'));},310000);
    child.stderr.on('data',chunk=>{if(error.length<8192)error+=chunk;});
    child.on('error',()=>{clearTimeout(timer);reject(nativeError('keynote-unavailable'));});
    child.on('close',code=>{
      clearTimeout(timer);
      if(code===0)return resolve();
      console.error('Keynote native error code:',error.match(/\((-?\d+)\)\s*$/)?.[1]||'unknown');
      reject(nativeError(error.includes('-1743')?'automation-permission':error.includes('-1712')?'keynote-timeout':error.includes('-600')?'keynote-unavailable':'keynote-export-failed'));
    });
    child.stdin.end(script);
  });
}

export async function exportPrivateCopy(source, target, exporter) {
  const folder=await fs.mkdtemp(path.join(path.dirname(source),'working-')),working=path.join(folder,'source.key');
  await fs.copyFile(source,working);let completed=false;
  try {await exporter(working,target);completed=true;}
  finally {if(completed)await fs.rm(folder,{recursive:true,force:true});}
}

export async function createBridge({ port=43181, origin='https://min-dex.github.io', cacheDir, exporter=exportWithKeynote, approveTtl=120000 }={}) {
  if (origin !== 'https://min-dex.github.io' && !/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) throw Error('허용되지 않은 민덱스 주소입니다.');
  const root = cacheDir || await fs.mkdtemp(path.join(os.tmpdir(),'mindex-keynote-bridge-'));
  await fs.mkdir(root,{recursive:true,mode:0o700});await fs.chmod(root,0o700);
  const pairs=new Map(), sessions=new Map(), jobs=new Map();let converting=false, requests=0;
  let base='';const stopNonce=secret();
  const server=http.createServer(async(req,res)=>{
    const remote=req.socket.remoteAddress;
    const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value));};
    try {
      if (remote!=='127.0.0.1' || req.headers.host!==new URL(base).host) return json(403,{error:'연결 주소를 확인해 주세요.'});
      const requestOrigin=req.headers.origin, app=requestOrigin===origin;
      const local=!requestOrigin||requestOrigin===base;
      if (!app&&!local) return json(403,{error:'허용되지 않은 앱입니다.'});
      if (app) {
        res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
        res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers','Authorization, Content-Type, X-Mindex-Keynote-Client');
        res.setHeader('Access-Control-Allow-Private-Network','true');
      }
      if(req.method==='OPTIONS') {res.writeHead(204);return res.end();}
      const url=new URL(req.url,base);
      const read=async(limit)=>{let count=0;const chunks=[];for await(const chunk of req){count+=chunk.length;if(count>limit)throw Error('파일이 너무 큽니다.');chunks.push(chunk);}return Buffer.concat(chunks);};
      if(url.pathname==='/health'&&req.method==='GET') return json(200,{protocol:PROTOCOL});
      if(url.pathname==='/'&&req.method==='GET'&&local) {
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'"});
        return res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><title>민덱스 Keynote 도우미</title><style>body{font:18px system-ui;max-width:620px;margin:12vh auto;padding:24px;line-height:1.6}button{font:inherit;padding:12px 20px}</style><h1>Keynote 도우미 실행 중</h1><p>민덱스에서 파일을 선택하면 이 Mac의 Keynote로 슬라이드를 준비합니다.</p><form action="/stop" method="post"><input type="hidden" name="csrf" value="'+stopNonce+'"><button>이번 연결 종료</button></form></html>');
      }
      if(url.pathname==='/stop'&&req.method==='POST'&&requestOrigin===base) {
        const form=new URLSearchParams((await read(1024)).toString());
        if(!equal(form.get('csrf'),stopNonce))return json(403,{error:'도우미 관리 화면에서 종료해 주세요.'});
        if(converting)return json(409,{error:'변환을 마친 뒤 종료해 주세요.'});
        sessions.clear();pairs.clear();jobs.clear();json(200,{closed:true});queueMicrotask(()=>server.close());return;
      }
      if(url.pathname==='/pair'&&req.method==='POST'&&app) {
        if(++requests>20)return json(429,{error:'연결 요청이 많습니다. 도우미를 다시 실행해 주세요.'});
        const body=JSON.parse((await read(1024)).toString());
        if(!/^[a-f0-9]{64}$/.test(body.client||''))return json(400,{error:'연결 요청을 확인해 주세요.'});
        const id=crypto.randomUUID();pairs.set(id,{client:body.client,csrf:secret(),created:Date.now(),approved:false});
        return json(200,{id,approval:base+'/connect/'+id});
      }
      const connect=url.pathname.match(/^\/connect\/([a-f0-9-]{36})$/);
      if(connect&&local) {
        const pair=pairs.get(connect[1]);if(!pair||Date.now()-pair.created>approveTtl)return json(410,{error:'연결 요청이 만료됐습니다.'});
        if(req.method==='POST') {
          if(requestOrigin!==base)return json(403,{error:'이 Mac의 연결 화면에서 허용해 주세요.'});
          const form=new URLSearchParams((await read(1024)).toString());
          if(!equal(form.get('csrf'),pair.csrf))return json(403,{error:'연결 요청이 올바르지 않습니다.'});
          pair.approved=true;sessions.clear();pair.token=secret();sessions.set(pair.token,Date.now()+8*3600000);
        }
        res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",'X-Frame-Options':'DENY'});
        return res.end('<!doctype html><html lang="ko"><meta charset="utf-8"><title>민덱스 Keynote 연결</title><style>body{font:18px system-ui;max-width:620px;margin:12vh auto;padding:24px;line-height:1.6}button{font:inherit;padding:12px 20px}small{color:#555}</style><h1>Keynote 자동 변환</h1>'+(pair.approved?'<p>연결됐어요. 민덱스로 돌아가면 계속 진행됩니다.</p>':'<p>이 Chrome의 민덱스에서 선택한 KEY 파일을 Mac의 Keynote로 변환합니다. 원본과 예배 내용은 그대로 보존합니다.</p><p><small>다른 파일을 찾거나 읽지 않으며, 도우미를 종료하면 연결이 해제됩니다.</small></p><form method="post"><input type="hidden" name="csrf" value="'+pair.csrf+'"><button>이 Chrome 연결 허용</button></form>')+'</html>');
      }
      const poll=url.pathname.match(/^\/pair\/([a-f0-9-]{36})$/);
      if(poll&&req.method==='GET'&&app) {
        const pair=pairs.get(poll[1]);
        if(!pair||Date.now()-pair.created>approveTtl||!equal(req.headers['x-mindex-keynote-client'],pair.client))return json(403,{error:'연결 요청이 만료됐습니다.'});
        return json(200,pair.approved?{token:pair.token}:{pending:true});
      }
      const token=(req.headers.authorization||'').replace(/^Bearer /,'');
      if(!app||!sessions.has(token)||sessions.get(token)<Date.now())return json(401,{error:'이 Mac의 Keynote 도우미를 연결해 주세요.'});
      if(url.pathname==='/convert'&&req.method==='POST') {
        if(converting)return json(409,{error:'앞선 Keynote 변환을 먼저 마쳐 주세요.'});
        if(req.headers['content-type']!=='application/octet-stream')return json(400,{error:'KEY 파일을 선택해 주세요.'});
        converting=true;
        try {
          const bytes=await read(MAX_BYTES);
          if(!bytes.length)return json(400,{error:'빈 파일은 변환할 수 없습니다.'});
          const sha=digest(bytes),folder=path.join(root,sha),exported=path.join(folder,'playback'),source=path.join(folder,'source.key');
          await fs.mkdir(folder,{recursive:true,mode:0o700});await fs.writeFile(source,bytes,{mode:0o600});
          let manifest;
          try {manifest=JSON.parse(await fs.readFile(path.join(exported,'manifest.json'),'utf8'));validateKeynoteHtmlManifest(manifest,manifest);assertKnownKeynoteHtmlRuntime(manifest);if(manifest.sourceSha256!==sha)throw Error();}
          catch {await fs.rm(exported,{recursive:true,force:true});await exportPrivateCopy(source,exported,exporter);manifest=await prepareExport(source,exported);}
          const id=crypto.randomUUID();jobs.set(id,{folder:exported,manifest,token,created:Date.now()});
          return json(200,{id,manifest});
        } finally {converting=false;}
      }
      const resource=url.pathname.match(/^\/jobs\/([a-f0-9-]{36})\/(.+)$/);
      if(resource&&req.method==='GET') {
        const job=jobs.get(resource[1]),name=decodeURIComponent(resource[2]);
        if(!job||!equal(job.token,token)||Date.now()-job.created>1800000)return json(404,{error:'재생 자료를 다시 준비해 주세요.'});
        const expected=job.manifest.files[name];
        if(!expected||name.split('/').some(p=>!p||p.startsWith('.')))return json(404,{error:'재생 자료가 없습니다.'});
        const target=path.join(job.folder,...name.split('/')),stat=await fs.lstat(target);
        if(!stat.isFile()||stat.isSymbolicLink()||stat.size!==expected.size)return json(409,{error:'재생 자료가 변경됐습니다.'});
        const bytes=await fs.readFile(target);
        if(digest(bytes)!==expected.sha256)return json(409,{error:'재생 자료가 변경됐습니다.'});
        res.writeHead(200,{'Content-Type':mime(name),'Content-Length':bytes.length,'Cache-Control':'no-store'});return res.end(bytes);
      }
      return json(404,{error:'요청을 확인해 주세요.'});
    } catch (error) {
      const code=['automation-permission','keynote-timeout','keynote-unavailable','keynote-export-failed'].includes(error.keynoteCode)?error.keynoteCode:null;
      if(!res.headersSent)json(code?422:400,{error:'Keynote 자료를 준비하지 못했습니다. 원본은 보존됩니다.',...(code?{code}:{})});else res.destroy();
    }
  });
  server.requestTimeout=330000;server.headersTimeout=10000;
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',()=>resolve());});
  base='http://127.0.0.1:'+server.address().port;
  return { server,base,cacheDir:root,close:()=>new Promise(resolve=>server.close(resolve)) };
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const index=process.argv.indexOf('--cache');
  const bridge=await createBridge({cacheDir:index>=0?process.argv[index+1]:undefined});
  console.log('민덱스 Keynote 도우미 준비 완료. 민덱스의 Mac 연결에서 허용해 주세요.');
  process.on('SIGINT',async()=>{await bridge.close();process.exit(0);});
}
