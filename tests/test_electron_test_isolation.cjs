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
 for(const entry of ['tools/minimatch-compat/**','tests/test_minimatch_compat.cjs','tests/test_electron_test_isolation.cjs']) assert.ok(workflow.includes('      - '+entry+'\n'),entry);
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
