// Compare bounded digests: signature changes must not format megabytes of Buffer diffs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
function fileIdentity(file){
 const fd=fs.openSync(file,'r'),buffer=Buffer.alloc(1024*1024),hash=crypto.createHash('sha256');let bytes=0;
 try {let n;while((n=fs.readSync(fd,buffer,0,buffer.length,null))>0){hash.update(buffer.subarray(0,n));bytes+=n;}}
 finally {fs.closeSync(fd);}
 return {bytes,sha256:hash.digest('hex')};
}
function record(target,app,destination){
 if(!['mac-arm64','mac-x64'].includes(target))throw Error('Expected Mac target');
 execFileSync('codesign',['--verify','--deep','--strict',app]);
 const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const original=fileIdentity(path.join('.cache','broadcast-engine',target,'ffmpeg'));
 const signed=fileIdentity(path.join(app,'Contents','Resources','broadcast-engine','ffmpeg'));
 fs.writeFileSync(destination,JSON.stringify({sourceCommit,target,original,signed})+'\n');
}
module.exports={fileIdentity,record};
if(require.main===module)record(...process.argv.slice(2));
