import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import {keynoteStoragePlan, validateKeynoteHtmlManifest, normalizeKeynoteHtml, KEYNOTE_PARTS_FORMAT, KEYNOTE_STORAGE_PART_BYTES, KEYNOTE_HTML_RUNTIME_SHA256, patchKeynoteHtmlPlayer} from '../mindex.keynote-html-engine.mjs';
const digest=bytes=>crypto.createHash('sha256').update(new Uint8Array(bytes)).digest('hex');
const manifest=()=>({format:'apple-keynote-html-v1',sourceSha256:'a'.repeat(64),pages:1,scenes:1,slides:[{thumbnail:'assets/thumb.jpeg',sceneStart:0,scenes:1}],files:{'assets/player/main.js':{size:1,sha256:KEYNOTE_HTML_RUNTIME_SHA256},'assets/header.json':{size:1,sha256:'a'.repeat(64)},'assets/thumb.jpeg':{size:1,sha256:'a'.repeat(64)}}});
test('large Korean video is stored below the bucket limit and reconstructs byte-identically without modifying its export',async()=>{
 const original=manifest(),name='assets/포함 영상.mp4'.normalize('NFD').replaceAll(' ','_');
 const bytes=new Uint8Array(50*1024*1024+7);bytes[0]=19;bytes[bytes.length-1]=211;
 original.files[name]={size:bytes.length,sha256:digest(bytes)};
 const source=JSON.stringify(original),raw=new TextEncoder().encode(source),file=new Blob([bytes]);
 const files=new Map(Object.keys(original.files).map(name=>[name,new Blob(['x'])]));files.set(name,file);files.set('manifest.json',new Blob([raw]));
 const result=await keynoteStoragePlan(original,files,raw,digest);
 assert.equal(JSON.stringify(original),source);assert.equal(files.get(name),file);assert.equal(file.size,bytes.length);
 assert.equal(result.byName.has(name),false);assert.equal(result.manifest.sourceSha256,original.sourceSha256);
 const entry=result.manifest.files[name];assert.equal(entry.sha256,digest(bytes));assert.equal(entry.parts.length,4);
 assert.equal(result.manifest.format,KEYNOTE_PARTS_FORMAT);
 const joined=[];for(const part of entry.parts){const blob=result.byName.get(part.path);assert(blob.size<=KEYNOTE_STORAGE_PART_BYTES);const value=await blob.arrayBuffer();assert.equal(digest(value),part.sha256);joined.push(value);}
 assert.equal(digest(await new Blob(joined).arrayBuffer()),digest(bytes));
 assert([...result.byName.values()].every(file=>file.size<=50*1024*1024));
 assert.deepEqual(JSON.parse(new TextDecoder().decode(result.manifestBytes)),result.manifest);
 assert.doesNotThrow(()=>validateKeynoteHtmlManifest(result.manifest,result.manifest));
 for(const patch of [{path:'../outside.bin'},{path:'https://outside.invalid/a'},{size:KEYNOTE_STORAGE_PART_BYTES+1},{sha256:'bad'}]){
  const bad=structuredClone(result.manifest);Object.assign(bad.files[name].parts[0],patch);assert.throws(()=>validateKeynoteHtmlManifest(bad,bad));
 }
 const duplicate=structuredClone(result.manifest);duplicate.files[name].parts[1].path=duplicate.files[name].parts[0].path;assert.throws(()=>validateKeynoteHtmlManifest(duplicate,duplicate));
 const missing=structuredClone(result.manifest);missing.files[name].parts.pop();assert.throws(()=>validateKeynoteHtmlManifest(missing,missing));
 const oldFormat=structuredClone(result.manifest);oldFormat.format='apple-keynote-html-v1';assert.throws(()=>validateKeynoteHtmlManifest(oldFormat,oldFormat));
});
test('both sidecar transports survive worship normalization while unknown formats retain the original only',()=>{
 const context=vm.createContext({URL});vm.runInContext(fs.readFileSync(new URL('../mindex.worship-model.js',import.meta.url),'utf8'),context);
 const original={format:'key',name:'source.key',url:'https://media.example/source.key',size:1024,sha256:'a'.repeat(64)};
 for(const format of ['apple-keynote-html-v1',KEYNOTE_PARTS_FORMAT]){
  const sidecar={format,url:'https://media.example/deck/manifest.json',sourceSha256:original.sha256,sha256:'b'.repeat(64),pages:1};
  assert.equal(normalizeKeynoteHtml(sidecar,original).format,format);
  const result=context.normalizeServiceAsset({kind:'file',url:original.url,original,keynoteHtml:sidecar});
  assert.equal(result.keynoteHtml.format,format);assert.deepEqual(JSON.parse(JSON.stringify(result.original)),original);
 }
 const unknown=context.normalizeServiceAsset({kind:'file',url:original.url,original,keynoteHtml:{format:'unknown'}});
 assert.equal(unknown.keynoteHtml,undefined);assert.equal(unknown.original.sha256,original.sha256);
 const empty=manifest();empty.format=KEYNOTE_PARTS_FORMAT;assert.throws(()=>validateKeynoteHtmlManifest(empty,empty));
});
test('small exports keep their original manifest bytes and direct resource paths',async()=>{
 const m=manifest(),raw=new TextEncoder().encode(JSON.stringify(m,null,2)),files=new Map(Object.keys(m.files).map(name=>[name,new Blob(['x'])]));
 const result=await keynoteStoragePlan(m,files,raw,digest);assert.equal(result.manifest,m);assert.equal(result.byName,files);assert.equal(result.manifestBytes,raw);
 const source='UC=new Eg;UC.delegate.setPlaybackReadyHandler((function(){start()}));let p={url:Q,cMapUrl:_C};obj.workerSrc="./assets/player/pdfjs/pdf.worker.min.js";UC.isFullscreen||A>this.showWidth&&(A=this.showWidth);';
 assert.match(patchKeynoteHtmlPlayer(source),/async function\(\)\{if\(window\.__mindexKeynoteMediaReady/);
});
