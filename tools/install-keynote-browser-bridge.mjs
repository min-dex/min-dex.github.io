// Local opt-in installation only. --prepare creates a reviewable bundle without starting anything.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const label='org.mindex.keynote-bridge';
const xml=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function agentPlist(home, folder) {
  const args=[path.join(folder,'runtime/node'),path.join(folder,'tools/keynote-browser-bridge.mjs'),'--cache',path.join(home,'Library/Caches/Mindex/Keynote')];
  return '<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Label</key><string>'+label+'</string><key>ProgramArguments</key><array>'+args.map(v=>'<string>'+xml(v)+'</string>').join('')+'</array><key>RunAtLoad</key><true/><key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict><key>ThrottleInterval</key><integer>30</integer><key>StandardOutPath</key><string>'+xml(path.join(folder,'helper.log'))+'</string><key>StandardErrorPath</key><string>'+xml(path.join(folder,'helper-error.log'))+'</string></dict></plist>';
}
export async function prepareBundle(folder,{runtime=process.execPath}={}) {
  folder=path.resolve(folder);await fs.mkdir(path.join(folder,'runtime'),{recursive:true,mode:0o700});await fs.mkdir(path.join(folder,'tools'),{recursive:true,mode:0o700});
  for(const file of ['tools/keynote-browser-bridge.mjs','mindex.keynote-html-engine.mjs']) await fs.copyFile(path.join(repo,file),path.join(folder,file));
  await fs.copyFile(runtime,path.join(folder,'runtime/node'));await fs.chmod(path.join(folder,'runtime/node'),0o755);
  const entries={};
  for(const file of ['tools/keynote-browser-bridge.mjs','mindex.keynote-html-engine.mjs','runtime/node']) {
    const bytes=await fs.readFile(path.join(folder,file));entries[file]={size:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
  }
  await fs.writeFile(path.join(folder,'bundle.json'),JSON.stringify({protocol:'mindex-keynote-bridge-v1',files:entries},null,2),{mode:0o600});
  return entries;
}
const run=(command,args)=>new Promise((resolve,reject)=>{
  const child=spawn(command,args,{stdio:['ignore','ignore','pipe']});let error='';
  child.stderr.on('data',chunk=>{if(error.length<4096)error+=chunk;});
  child.on('error',reject);child.on('close',code=>code===0?resolve():reject(Error('Mac 연결 도우미 설정을 완료하지 못했습니다.')));
});
export async function installBridge({home=os.homedir(),autostart=false,runner=run}={}) {
  if(process.platform!=='darwin')throw Error('Mac에서만 설치할 수 있습니다.');
  const folder=path.join(home,'Library/Application Support/Mindex/Keynote Helper');
  const files=await prepareBundle(folder);await fs.chmod(folder,0o700);
  if(autostart) {
    const agents=path.join(home,'Library/LaunchAgents'),plist=path.join(agents,label+'.plist');
    await fs.mkdir(agents,{recursive:true});await fs.writeFile(plist,agentPlist(home,folder),{mode:0o600});
    await runner('/bin/launchctl',['bootstrap','gui/'+process.getuid(),plist]);
  }
  return {folder,files,autostart};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const index=process.argv.indexOf('--prepare');
  if(index>=0&&process.argv[index+1]) {await prepareBundle(process.argv[index+1]);console.log('연결 도우미 검토용 묶음을 준비했습니다. 실행·설치하지 않았습니다.');}
  else if(process.argv.includes('--install')) {
    const result=await installBridge({autostart:process.argv.includes('--autostart')});
    console.log(result.autostart?'Keynote 연결 도우미를 설치하고 로그인 시 자동 실행하도록 설정했습니다.':'Keynote 연결 도우미를 설치했습니다. 아직 실행하지 않았습니다.');
  } else throw Error('--prepare 폴더 또는 승인 후 --install 옵션을 사용해 주세요.');
}
