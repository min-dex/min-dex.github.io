const {spawn} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

function registerBroadcastEngine({ipcMain,app,getLab,enabled}) {
  let active;
  function cancel() {
    if (!active) return;
    const {proc} = active;
    if (proc.pid) {
      // On macOS the helper and its encoder/receiver share this private process group.
      try { process.kill(-proc.pid,'SIGKILL'); } catch (error) { if(error.code!=='ESRCH') throw error; }
    }
  }
  app.on('before-quit',cancel);
  ipcMain.handle('mindex:rehearse-rtmps',async (event,action,chunk)=>{
    const lab = getLab();
    if (!enabled || !lab || event.sender!==lab.webContents || event.senderFrame!==lab.webContents.mainFrame)
      throw Error('시험 창에서만 사용할 수 있습니다.');
    if (action==='cancel') { cancel(); return; }
    if (action==='start') {
      if (active) throw Error('시험이 이미 진행 중입니다.');
      const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'mindex-engine-test-'));
      const exe=path.join(process.resourcesPath,'broadcast-engine','mindex-receiver');
      const proc=spawn(exe,[],{cwd:tmp,env:{TMPDIR:tmp,PATH:'/usr/bin:/bin',LANG:'C'},detached:true,stdio:['pipe','pipe','ignore']});
      const run={proc,total:0,writing:false,finishing:false};
      active=run;
      let receipt='';
      proc.stdout.on('data',part=>{receipt+=part;if(receipt.length>4096)cancel();});
      proc.stdin.on('error',()=>{}); // Per-write errors also reach the write callback.
      proc.on('error',()=>{}); // Spawn failure is reported by the close event.
      const timeout=setTimeout(cancel,35000);
      run.result=new Promise(resolve=>proc.once('close',code=>{
        clearTimeout(timeout);
        if(active===run)active=null;
        fs.rmSync(tmp,{recursive:true,force:true});
        try { resolve(code===0?JSON.parse(receipt):null); } catch { resolve(null); }
      }));
      return true;
    }
    const run=active;
    if (!run || run.finishing || run.writing) throw Error('로컬 시험 세션을 확인해 주세요.');
    if (action==='chunk') {
      if(!(chunk instanceof Uint8Array)||!chunk.length||chunk.length>1048576||run.total+chunk.length>20*1048576)
        throw Error('시험 데이터 크기를 초과했습니다.');
      run.total+=chunk.length;run.writing=true;
      try {await new Promise((ok,fail)=>run.proc.stdin.write(chunk,error=>error?fail(error):ok()));}
      finally {run.writing=false;}
      return;
    }
    if(action!=='finish')throw Error('지원하지 않는 시험 명령입니다.');
    run.finishing=true;run.proc.stdin.end();
    const result=await run.result;
    if(!result?.received||!result.certificateVerified||result.externalPublishing!==false)
      throw Error('로컬 수신 또는 인증서 검증에 실패했습니다.');
    return result;
  });
  return cancel;
}
module.exports={registerBroadcastEngine};
