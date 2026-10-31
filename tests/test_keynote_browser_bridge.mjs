import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createBridge,prepareExport,PROTOCOL} from '../tools/keynote-browser-bridge.mjs';
import {KEYNOTE_HTML_RUNTIME_SHA256} from '../mindex.keynote-html-engine.mjs';
import {prepareBundle,agentPlist} from '../tools/install-keynote-browser-bridge.mjs';
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

test('loopback bridge requires exact origin, local approval and tab session; resource hashes and original survive', async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'mindex-bridge-test-')),origin='http://127.0.0.1:43280';
  let exports=0;const bridge=await createBridge({port:0,origin,cacheDir:root,exporter:async()=>{exports++;if(exports===2)throw Object.assign(Error('private native details'),{keynoteCode:'automation-permission'});throw Error('No native execution in tests');}});
  const request=(route,options={})=>fetch(bridge.base+route,{...options,headers:{Origin:origin,...options.headers}});
  try {
    assert.equal((await (await request('/health')).json()).protocol,PROTOCOL);
    assert.equal((await fetch(bridge.base+'/health',{headers:{Origin:'https://untrusted.example'}})).status,403);
    assert.equal((await request('/convert',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:'KEY'})).status,401);
    const client=hash('offline-client'),pair=await (await request('/pair',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client})})).json();
    assert.equal((await request('/connect/'+pair.id)).status,401,'app cannot read approval form');
    assert.equal((await request('/connect/'+pair.id,{method:'POST',body:'csrf=wrong'})).status,401,'app cannot self approve');
    const pending=await (await request('/pair/'+pair.id,{headers:{'X-Mindex-Keynote-Client':client}})).json();assert.equal(pending.pending,true);
    assert.equal((await request('/pair/'+pair.id,{headers:{'X-Mindex-Keynote-Client':'b'.repeat(64)}})).status,403);
    const html=await (await fetch(pair.approval)).text(),csrf=html.match(/name="csrf" value="([a-f0-9]+)"/)[1];
    assert.equal((await fetch(pair.approval,{method:'POST',headers:{Origin:bridge.base},body:'csrf=wrong'})).status,403);
    assert.equal((await fetch(pair.approval,{method:'POST',headers:{Origin:bridge.base},body:'csrf='+csrf})).status,200);
    const {token}=await (await request('/pair/'+pair.id,{headers:{'X-Mindex-Keynote-Client':client}})).json();
    const auth={Authorization:'Bearer '+token},source=Buffer.from('offline-selected-key'),sha=hash(source),folder=path.join(root,sha,'playback');
    await fs.mkdir(path.join(folder,'assets'),{recursive:true});
    const thumbnail=Buffer.from('offline-thumbnail');await fs.writeFile(path.join(folder,'assets/slide.jpeg'),thumbnail);
    const manifest={format:'apple-keynote-html-v1',sourceSha256:sha,pages:1,scenes:1,runtimeSha256:KEYNOTE_HTML_RUNTIME_SHA256,slides:[{thumbnail:'assets/slide.jpeg',sceneStart:0,scenes:1}],files:{
      'assets/player/main.js':{size:1,sha256:KEYNOTE_HTML_RUNTIME_SHA256},
      'assets/header.json':{size:2,sha256:hash('{}')},
      'assets/slide.jpeg':{size:thumbnail.length,sha256:hash(thumbnail)}
    }};
    await fs.writeFile(path.join(folder,'manifest.json'),JSON.stringify(manifest));
    const result=await (await request('/convert',{method:'POST',headers:{...auth,'Content-Type':'application/octet-stream'},body:source})).json();
    assert.equal(result.manifest.sourceSha256,sha);assert.equal(exports,0,'verified source hash selects existing export');
    assert.deepEqual(await fs.readFile(path.join(root,sha,'source.key')),source);
    const resource='/jobs/'+result.id+'/assets/slide.jpeg';
    assert.deepEqual(Buffer.from(await (await request(resource,{headers:auth})).arrayBuffer()),thumbnail);
    assert.equal((await request('/jobs/'+result.id+'/source.key',{headers:auth})).status,404);
    assert.equal((await request('/jobs/'+result.id+'/%2e%2e%2fsource.key',{headers:auth})).status,404);
    await fs.writeFile(path.join(folder,'assets/slide.jpeg'),'tampered');
    assert.equal((await request(resource,{headers:auth})).status,409);
    const unsupported=await request('/convert',{method:'POST',headers:{...auth,'Content-Type':'application/octet-stream'},body:'new source'});
    assert.equal(unsupported.status,400);assert.equal(exports,1);
    const denied=await request('/convert',{method:'POST',headers:{...auth,'Content-Type':'application/octet-stream'},body:'permission fixture'});
    assert.equal(denied.status,422);const deniedBody=await denied.json();assert.equal(deniedBody.code,'automation-permission');assert.ok(!JSON.stringify(deniedBody).includes('private native'));
    assert.equal((await request(resource,{headers:{Authorization:'Bearer wrong'}})).status,401);
  } finally {await bridge.close();await fs.rm(root,{recursive:true,force:true});}
});

test('preparation rejects unsupported runtime and links without rewriting source',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'mindex-bridge-export-'));
  try {
    const source=path.join(root,'source.key'),folder=path.join(root,'playback'),id='00000000-0000-4000-8000-000000000000';
    await fs.writeFile(source,'original');await fs.mkdir(path.join(folder,'assets',id),{recursive:true});await fs.mkdir(path.join(folder,'assets/player'));
    await fs.writeFile(path.join(folder,'assets/header.json'),JSON.stringify({slideList:[id]}));
    await fs.writeFile(path.join(folder,'assets',id,id+'.json'),JSON.stringify({events:[{}]}));
    await fs.writeFile(path.join(folder,'assets',id,'thumbnail.jpeg'),'thumb');await fs.writeFile(path.join(folder,'assets/player/main.js'),'unknown');
    await assert.rejects(prepareExport(source,folder));
    assert.equal(await fs.readFile(source,'utf8'),'original');
    await fs.symlink(source,path.join(folder,'assets/link'));
    await assert.rejects(prepareExport(source,folder),/바로가기/);
  } finally {await fs.rm(root,{recursive:true,force:true});}
});

test('reviewable helper bundle pins its local runtime and keeps launch arguments separate',async()=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'mindex-bridge-package-'));
  try {
    const runtime=path.join(root,'fixture-node');await fs.writeFile(runtime,'offline runtime');
    const folder=path.join(root,'package'),entries=await prepareBundle(folder,{runtime});
    assert.equal(entries['runtime/node'].sha256,hash('offline runtime'));
    assert.equal(JSON.parse(await fs.readFile(path.join(folder,'bundle.json'),'utf8')).protocol,PROTOCOL);
    const plist=agentPlist('/Users/test & review',folder);
    assert.ok(plist.includes('test &amp; review'));assert.ok(plist.includes('<key>RunAtLoad</key><true/>'));
    assert.ok(plist.includes('<key>ProgramArguments</key><array>'));assert.ok(!plist.includes('/bin/sh'));
  } finally {await fs.rm(root,{recursive:true,force:true});}
});
