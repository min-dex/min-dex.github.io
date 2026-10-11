import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {releaseProblems} from '../scripts/verify-release.mjs';
const pkg=JSON.parse(readFileSync(new URL('../package.json',import.meta.url)));
const windows={GH_TOKEN:'test',CSC_LINK:'test',CSC_KEY_PASSWORD:'test'};
test('Windows release does not require Apple credentials; mac release does',()=>{
 assert.deepEqual(releaseProblems(pkg,windows,'win'),[]);
 assert.ok(releaseProblems(pkg,windows,'mac').some(p=>p.includes('notarytool')));
 assert.deepEqual(releaseProblems(pkg,{...windows,APPLE_KEYCHAIN_PROFILE:'test'},'mac'),[]);
 assert.deepEqual(releaseProblems(pkg,{...windows,APPLE_API_KEY:'test',APPLE_API_KEY_ID:'test',APPLE_API_ISSUER:'test'},'mac'),[]);
 assert.ok(releaseProblems(pkg,{...windows,APPLE_ID:'test',APPLE_APP_SPECIFIC_PASSWORD:'test'},'mac').length);
});
test('missing ZIP/provider/signing blocks release without printing credential values',()=>{
 const bad=structuredClone(pkg);bad.build.mac.target=['dmg'];bad.build.publish=[];
 const problems=releaseProblems(bad,{},'mac').join(' ');
 assert.match(problems,/ZIP/);assert.match(problems,/provider/);assert.match(problems,/CSC_LINK/);
});

test('test installers are isolated, unsigned and cannot join the update channel',async()=>{
 const {default:config}=await import('../electron-builder.test.cjs');
 assert.notEqual(config.appId,pkg.build.appId);
 assert.equal(config.extraMetadata.mindexTestBuild,true);
 assert.notEqual(config.extraMetadata.name,pkg.name);
 assert.equal(config.publish,null);
 assert.equal(config.mac.identity,null);assert.equal(config.mac.notarize,false);
 assert.equal(config.win.signAndEditExecutable,false);
 assert.match(config.directories.output,/test/);
});
