import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { verifyRelease } from './verify-release.mjs';
const require = createRequire(import.meta.url);
const platform = process.argv.find(v=>v.startsWith('--platform='))?.split('=')[1] || (process.platform==='darwin'?'mac':'win');
const run = args => {
  const result=spawnSync(process.execPath,args,{stdio:'inherit'});
  if(result.status!==0) throw new Error('Desktop release stopped; inspect the preceding build error.');
};
try {
  verifyRelease({platform});
  const builder=require.resolve('electron-builder/cli.js');
  run(['scripts/clean-electron-dist.mjs']);
  run([builder, ...(platform==='mac'?['--mac','dmg','zip','--arm64','--x64']:['--win','nsis','--x64']), '--publish','always','-c.forceCodeSigning=true']);
  run(['scripts/prune-electron-dist.mjs']);
} catch(error) { console.error(error.message); process.exitCode=1; }
