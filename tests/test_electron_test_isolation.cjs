const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {configureTestIsolation}=require('../electron/test-isolation');
test('test isolation is opt-in, rejects real packages and blocks before renderer startup',async()=>{
 assert.equal(configureTestIsolation({}, {}, {}),null);
 assert.throws(()=>configureTestIsolation({}, {}, {MINDEX_ISOLATED_TEST:'1'}),/test package/);
 const paths={},listeners={};let intercept;
 const app={setPath:(k,v)=>paths[k]=v,commandLine:{appendSwitch(){}},whenReady:()=>Promise.resolve(),on:(k,f)=>listeners[k]=f};
 const session={defaultSession:{webRequest:{onBeforeRequest:(_filter,f)=>intercept=f},setPermissionRequestHandler(f){this.permission=f},setPermissionCheckHandler(f){this.check=f}}};
 const state=configureTestIsolation({app,session},{mindexTestBuild:true},{MINDEX_ISOLATED_TEST:'1'});
 try{assert.equal(Object.keys(paths).length,4);assert.ok(Object.values(paths).every(p=>p.startsWith(state.profile)));await Promise.resolve();assert(state.networkBlocked);intercept({},result=>assert.equal(result.cancel,true));assert.equal(state.blockedRequests,1);assert.equal(session.defaultSession.check(),false);let muted=false;listeners['web-contents-created']({}, {setAudioMuted:v=>muted=v,setWindowOpenHandler:f=>assert.equal(f().action,'deny'),on(){}});assert(muted);}finally{fs.rmSync(state.profile,{recursive:true,force:true});}
});

test('native security changes trigger unsigned platform validation before main',()=>{
 const workflow=fs.readFileSync('.github/workflows/desktop-release.yml','utf8').replace(/\r\n/g,'\n');
 assert.match(workflow,/branches: \[main, codex\/mindex-presenter-handoff, codex\/native-\*\]/);
 for(const entry of ['tools/minimatch-compat/**','tests/test_minimatch_compat.cjs','tests/test_electron_test_isolation.cjs','scripts/release-electron.mjs','tests/test_release_preflight.mjs']) assert.ok(workflow.includes('      - '+entry+'\n'),entry);
 assert.match(workflow,/run: pnpm audit --audit-level=moderate/);
 for(const [platform,os] of [['mac','macos-15'],['win','windows-latest']]) assert.ok(workflow.includes(`- platform: ${platform}\n            os: ${os}`));
 const unsigned=workflow.split('      - name: Build isolated unsigned test installers')[1].split('      - name: Build signed packages')[0];
 assert.ok(unsigned.includes('if: ${{ !inputs.publish_release }}'));
 assert.ok(unsigned.includes('run: pnpm electron:test:${{ matrix.platform }}'));
 assert.ok(unsigned.includes("CSC_IDENTITY_AUTO_DISCOVERY: 'false'"));
 const signed=workflow.split('      - name: Build signed packages')[1].split('      - uses: actions/upload-artifact')[0];
 assert.ok(signed.includes('if: ${{ inputs.publish_release }}'));
 assert.ok(signed.includes('--publish never'));
 const draft=workflow.split('  draft-release:')[1];
 assert.ok(draft.includes('if: ${{ inputs.publish_release }}'));
 assert.ok(draft.includes('needs: build'));
 assert.ok(draft.includes('--draft'));
 assert.doesNotMatch(workflow,/continue-on-error:/);
});


test('persistent fixture is test-only, token-scoped and rejects symlink paths',()=>{
 const os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
 const token=crypto.randomBytes(16).toString('hex');
 const profile=path.join(fs.realpathSync(os.tmpdir()),'mindex-isolated-upgrade-'+token);
 const app={setPath(){},commandLine:{appendSwitch(){}},whenReady:()=>new Promise(()=>{}),on(){}};
 const env={MINDEX_ISOLATED_TEST:'1',MINDEX_TEST_PROFILE_TOKEN:token};
 try {
  assert.throws(()=>configureTestIsolation({app},{},env),/test package/);
  assert.throws(()=>configureTestIsolation({app},{mindexTestBuild:true},{...env,MINDEX_TEST_PROFILE_TOKEN:'../original'}),/Invalid/);
  const first=configureTestIsolation({app},{mindexTestBuild:true},env);
  fs.writeFileSync(path.join(profile,'userData','fixture'),'preserved');
  assert.equal(configureTestIsolation({app},{mindexTestBuild:true},env).profile,first.profile);
  assert.equal(fs.readFileSync(path.join(profile,'userData','fixture'),'utf8'),'preserved');
  if(process.platform!=='win32'){
   fs.rmdirSync(path.join(profile,'logs'));
   fs.symlinkSync(os.tmpdir(),path.join(profile,'logs'));
   assert.throws(()=>configureTestIsolation({app},{mindexTestBuild:true},env),/Unsafe/);
   fs.unlinkSync(path.join(profile,'logs'));
  }
  fs.writeFileSync(path.join(profile,'fixture-only.json'),'{}');
  assert.throws(()=>configureTestIsolation({app},{mindexTestBuild:true},env),/Unrecognized/);
 } finally {fs.rmSync(profile,{recursive:true,force:true});}
});


test('Windows shell fixture lookup uses native path joining without POSIX suffix conversion',()=>{
 const workflow=fs.readFileSync('.github/workflows/desktop-release.yml','utf8');
 assert.equal(workflow.split('require("path").join(process.env.RUNNER_TEMP,"install-fixture.json")').length-1,2);
 assert.ok(!workflow.includes('process.env.RUNNER_TEMP+"/install-fixture.json"'));
 const path=require('node:path');
 assert.equal(path.win32.join('D:\\a\\_temp','install-fixture.json'),'D:\\a\\_temp\\install-fixture.json');
});


test('Intel acceptance reuses exact-run artifacts and keeps publication disabled',()=>{
 const workflow=fs.readFileSync('.github/workflows/desktop-release.yml','utf8');
 const intel=workflow.split('  verify-intel:')[1].split('  draft-release:')[0];
 assert.match(intel,/if: \$\{\{ !inputs.publish_release \}\}/);
 assert.match(intel,/needs: build/);assert.match(intel,/runs-on: macos-15-intel/);
 assert.match(intel,/name: mindex-mac-test/);assert.doesNotMatch(intel,/run-id:|continue-on-error:|--publish always/);
 for(const name of ['verify_candidate_package.cjs','test_desktop_youtube_local.cjs','test_desktop_upgrade.cjs'])assert.ok(intel.includes(name));
});


test('Intel restores the test subdirectory kept by the upload common root',()=>{
 const workflow=fs.readFileSync('.github/workflows/desktop-release.yml','utf8');
 const intel=workflow.split('  verify-intel:')[1].split('  draft-release:')[0];
 assert.match(intel,/name: mindex-mac-test\n          path: dist\n/);
 const path=require('node:path');
 // The upload includes dist/* and dist/test/*: ZIP entries retain test/.
 const archiveEntry='test/Mindex-Test-1.0.0-test-mac-x64.dmg';
 assert.equal(path.posix.join('dist',archiveEntry),'dist/test/Mindex-Test-1.0.0-test-mac-x64.dmg');
 assert.match(intel,/test -f "\$installer"/);
});
