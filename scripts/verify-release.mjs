import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export function releaseProblems(pkg, env = {}, platform = 'mac') {
  const missing = [];
  const hasAll = names => names.every(name => String(env[name] || '').trim());
  if (!['mac', 'win'].includes(platform)) missing.push('supported platform: mac or win');
  if (!/^\d+\.\d+\.\d+$/.test(pkg.version)) missing.push('stable semantic package version');
  if (!pkg.build.mac.target.includes('zip')) missing.push('mac ZIP update target');
  if (!pkg.build.mac.target.includes('dmg')) missing.push('mac DMG installer target');
  if (!pkg.build.win.target.includes('nsis')) missing.push('Windows NSIS update target');
  if (!pkg.build.publish.some(p => p.provider === 'github' && p.owner === 'min-dex' && p.repo === 'min-dex.github.io')) missing.push('GitHub update provider');
  if (!hasAll(['GH_TOKEN'])) missing.push('GH_TOKEN');
  if (!hasAll(['CSC_LINK','CSC_KEY_PASSWORD'])) missing.push('CSC_LINK + CSC_KEY_PASSWORD');
  // Pinned builder 26 supports notarytool API credentials or a keychain profile.
  // Its APPLE_ID path is legacy; do not advertise it as a release-ready option.
  if (platform === 'mac') {
    if (!pkg.build.mac.hardenedRuntime || !pkg.build.mac.notarize) missing.push('hardened runtime + notarization');
    if (env.APPLE_ID || env.APPLE_APP_SPECIFIC_PASSWORD) missing.push('unset legacy APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD; use notarytool credentials');
    if (!hasAll(['APPLE_API_KEY','APPLE_API_KEY_ID','APPLE_API_ISSUER']) && !hasAll(['APPLE_KEYCHAIN_PROFILE'])) missing.push('notarytool API credentials or APPLE_KEYCHAIN_PROFILE');
  }
  return missing;
}

export function verifyRelease({ offline = false, platform = process.platform === 'darwin' ? 'mac' : 'win' } = {}) {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url)));
  const env = offline ? { GH_TOKEN:'fixture', CSC_LINK:'fixture', CSC_KEY_PASSWORD:'fixture', APPLE_KEYCHAIN_PROFILE:'fixture' } : process.env;
  const problems = releaseProblems(pkg, env, platform);
  if (!offline) {
    const policy = JSON.parse(readFileSync(new URL('../product-release.json', import.meta.url)));
    if (policy.channel !== 'release') problems.push('reviewed product release channel');
    const tag = spawnSync('git',['ls-remote','--tags','origin',`refs/tags/v${pkg.version}`],{encoding:'utf8'});
    if (tag.status !== 0 || tag.stdout.trim()) problems.push('new unused product version verified against remote tags');
    if ((platform === 'mac' && process.platform !== 'darwin') || (platform === 'win' && process.platform !== 'win32')) problems.push(`build on a ${platform} release host`);
    const dirty = spawnSync('git', ['status','--porcelain'], { encoding:'utf8' });
    if (dirty.status !== 0 || dirty.stdout.trim()) problems.push('clean committed checkout');
  }
  if (problems.length) throw new Error(`Release stopped. Required: ${problems.join(', ')}`);
  for (const args of [
    ['--test','tests/test_electron_updater.cjs','tests/test_release_preflight.mjs','tests/test_desktop_update_ui.cjs'],
    ['tests/test_worship_input_module_contract.cjs'],
    ['--test','tests/test_product_identity.cjs'],
  ]) {
    const result = spawnSync(process.execPath,args,{stdio:'inherit'});
    if (result.status !== 0) throw new Error('Release stopped. Desktop checks failed.');
  }
  const runtime = spawnSync('python3',['tests/test_electron_runtime_files.py'],{stdio:'inherit'});
  if (runtime.status !== 0) throw new Error('Release stopped. Runtime file check failed.');
  console.log(offline ? 'Offline packaging checks passed; credentials, signatures and real installation are not verified.' : 'Release preflight passed.');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { verifyRelease({ offline: process.argv.includes('--offline'), platform: process.argv.find(v=>v.startsWith('--platform='))?.split('=')[1] }); }
  catch (error) { console.error(error.message); process.exitCode=1; }
}
