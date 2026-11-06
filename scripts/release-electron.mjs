import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { verifyRelease } from './verify-release.mjs';
const require = createRequire(import.meta.url);

export function signedBuildArgs(platform, { publish = true } = {}) {
  if (!['mac', 'win'].includes(platform)) throw new Error('Unsupported release platform');
  return [...(platform === 'mac' ? ['--mac', 'dmg', 'zip', '--arm64', '--x64'] : ['--win', 'nsis', '--x64']),
    '--publish', publish ? 'always' : 'never', '-c.forceCodeSigning=true'];
}

export function releaseElectron({ platform, publish = true }) {
  const run = args => {
    const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
    if (result.status !== 0) throw new Error('Desktop release stopped; inspect the preceding build error.');
  };
  verifyRelease({ platform, publish });
  const builder = require.resolve('electron-builder/cli.js');
  run(['scripts/clean-electron-dist.mjs']);
  run([builder, ...signedBuildArgs(platform, { publish })]);
  run(['scripts/prune-electron-dist.mjs']);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const platform = process.argv.find(v => v.startsWith('--platform='))?.split('=')[1] || (process.platform === 'darwin' ? 'mac' : 'win');
  try { releaseElectron({ platform, publish: !process.argv.includes('--no-publish') }); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
