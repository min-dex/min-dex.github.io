import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKeynoteHtml, validateKeynoteHtmlManifest, patchKeynoteHtmlPlayer, keynoteCheckpoint, keynoteFrameDocument, keynoteHtmlFrameBridge, attachKeynoteHtmlToMemo, assertKnownKeynoteHtmlRuntime, KEYNOTE_HTML_RUNTIME_SHA256 } from '../mindex.keynote-html-engine.mjs';
const hash='a'.repeat(64), original={sha256:hash};
const descriptor={format:'apple-keynote-html-v1',url:'https://media.example/deck/manifest.json',sha256:hash,sourceSha256:hash,pages:1};
const file={sha256:hash,size:10};
const manifest=()=>({format:descriptor.format,sourceSha256:hash,pages:1,scenes:2,slides:[{thumbnail:'assets/slide/thumbnail.jpeg',sceneStart:0,scenes:2}],files:{'assets/player/main.js':file,'assets/header.json':file,'assets/slide/thumbnail.jpeg':file}});
test('export descriptor keeps source identity and rejects credentials, schemes and wrong originals',()=>{
 assert.deepEqual(normalizeKeynoteHtml(descriptor,original),descriptor);
 for(const patch of [{url:'javascript:alert(1)'},{url:'https://user:secret@media.example/deck/manifest.json'},{sourceSha256:'b'.repeat(64)},{pages:301}])assert.equal(normalizeKeynoteHtml({...descriptor,...patch},original),null);
});
test('manifest bounds files, resource paths and scene continuity',()=>{
 assert.equal(validateKeynoteHtmlManifest(manifest(),descriptor).pages,1);
 for(const path of ['../outside.js','/root.js','assets//main.js','assets/./main.js','assets/../../main.js','https://external.invalid/file','private.json','assets/.private']){
  const m=manifest();m.files[path]=file;assert.throws(()=>validateKeynoteHtmlManifest(m,descriptor));
 }
 const m=manifest();m.slides[0].sceneStart=1;assert.throws(()=>validateKeynoteHtmlManifest(m,descriptor));
});
test('bridge patches only a recognized export and preserves original input string',()=>{
 const source='UC=new Eg;let p={url:Q,cMapUrl:_C};obj.workerSrc="./assets/player/pdfjs/pdf.worker.min.js";';const patched=patchKeynoteHtmlPlayer(source);
 assert.match(patched,/window\.__mindexKeynoteController/);assert.match(patched,/document.baseURI/);assert.ok(!source.includes('__mindex'));
 assert.throws(()=>patchKeynoteHtmlPlayer(source+'UC=new Eg'));
 assert.throws(()=>patchKeynoteHtmlPlayer('unsupported runtime'));
});
test('checkpoint preserves scene, phase, actual slide and final successor without rewind',()=>{
 const value={scene:0,phase:'final',playing:false,slide:1,nextScene:1,atEnd:false,terminalTransition:false,media:[{src:'https://media.example/deck/a.mp4',time:12.5,paused:false,resume:true}]};
 assert.deepEqual(keynoteCheckpoint(value,3),value);
 assert.equal(keynoteCheckpoint({...value,nextScene:3},3),null);
 assert.equal(keynoteCheckpoint({...value,slide:-1},3),null);
 assert.equal(keynoteCheckpoint({...value,phase:'Playing'},3),null);
 assert.equal(keynoteCheckpoint({...value,atEnd:true},3).atEnd,false);
 assert.equal(keynoteCheckpoint({scene:2,phase:'final',slide:2,nextScene:-1,atEnd:true},3).atEnd,true);
});
test('frame has an opaque-compatible CSP, inert external navigation and escaped scripts',()=>{
 const html=keynoteFrameDocument({baseUrl:descriptor.url,player:'/* </script><script> */',token:'00000000-0000-4000-8000-000000000000',bridge:keynoteHtmlFrameBridge});
 assert.match(html,/default-src 'none'/);assert.match(html,/form-action 'none'/);assert.ok(!html.includes('/* </script><script> */'));assert.match(html,/event.source !== parent/);
 assert.throws(()=>keynoteFrameDocument({baseUrl:'file:///tmp/',player:'',token:'bad',bridge:keynoteHtmlFrameBridge}));
});

test('attachment changes only the sidecar and preserves unknown memo/asset data and exact text',()=>{
 const memo={note:'  preserve whitespace\n',lyrics:['First','Second'],form:'V1-C',deleted:false,timing:[0,12,35],offeringVariants:{praise:{memo:'original'}},unknown:{version:4},asset:{kind:'file',url:'original.key',original:{format:'key',sha256:hash},custom:{user:'keep'}}};
 const result=JSON.parse(attachKeynoteHtmlToMemo(JSON.stringify(memo),descriptor));
 assert.deepEqual(result,{...memo,asset:{...memo.asset,keynoteHtml:descriptor}});
 assert.throws(()=>attachKeynoteHtmlToMemo(JSON.stringify(memo),{...descriptor,sourceSha256:'b'.repeat(64)}));
});

test('unknown vendor runtime is rejected before attachment or execution',()=>{
 assert.throws(()=>assertKnownKeynoteHtmlRuntime(manifest()));
 const m=manifest();m.runtimeSha256=KEYNOTE_HTML_RUNTIME_SHA256;m.files['assets/player/main.js']={...file,sha256:KEYNOTE_HTML_RUNTIME_SHA256};assert.doesNotThrow(()=>assertKnownKeynoteHtmlRuntime(m));
});
