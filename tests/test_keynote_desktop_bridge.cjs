const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createKeynoteBridge}=require('../electron/keynote-bridge');
test('packaged controller reaches paired helper without allowing null browser origins or approval bypass',async()=>{
 let calls=0;const request=createKeynoteBridge({isController:event=>event==='controller',fetchImpl:async(url,options)=>{
  calls++;assert(url.startsWith('http://127.0.0.1:43181/'));assert.equal(options.headers.Origin,'https://min-dex.github.io');
  assert.equal(options.redirect,'error');assert.equal(options.credentials,'omit');
  return Response.json({protocol:'mindex-keynote-bridge-v1'});
 }});
 assert.deepEqual(await request('output',{path:'/health'}),{ok:false,reason:'untrusted-window'});assert.equal(calls,0);
 const result=await request('controller',{path:'/health'});assert.equal(result.status,200);assert.equal(JSON.parse(new TextDecoder().decode(result.body)).protocol,'mindex-keynote-bridge-v1');
 for(const value of [{path:'https://example.invalid/'},{path:'/connect/'+'a'.repeat(36),method:'POST'},
  {path:'/stop',method:'POST'},{path:'/health',headers:{Origin:'null'}},{path:'/health',headers:{Cookie:'private'}},
  {path:'/jobs/'+'a'.repeat(36)+'/../source.key'},{path:'/jobs/'+'a'.repeat(36)+'/%2e%2e/source.key'},
  {path:'/health',timeout:320000},{path:'/pair',method:'POST',body:'{"client":"bad"}'},
  {path:'/health',headers:{Range:'bytes=0-1'}},{path:'/jobs/'+'a'.repeat(36)+'/assets/movie.mp4',headers:{Range:'bytes=0-4194304'}},
  {path:'/convert',method:'POST',body:'unselected path'},
 ])await assert.rejects(request('controller',value));
 assert.equal(calls,1,'invalid requests never touch helper');
 const client='a'.repeat(64),headers={'Content-Type':'application/json'};
 await request('controller',{path:'/pair',method:'POST',headers,body:JSON.stringify({client})});
 const input=new Uint8Array([1,2,3]),before=Buffer.from(input);
 await request('controller',{path:'/convert',method:'POST',body:input,headers:{Authorization:'Bearer '+client,'Content-Type':'application/octet-stream'},timeout:320000});
 await request('controller',{path:'/jobs/'+'a'.repeat(36)+'/assets/섬김.mp4'.normalize('NFD'),headers:{Authorization:'Bearer '+client,Range:'bytes=0-3'}});
 assert.deepEqual(Buffer.from(input),before);
});
test('helper errors retain status; oversized and timed-out transfers stop',async()=>{
 const error=createKeynoteBridge({isController:()=>true,fetchImpl:async()=>Response.json({code:'automation-permission'},{status:422})});
 assert.equal((await error({}, {path:'/health'})).status,422);
 const large=createKeynoteBridge({isController:()=>true,fetchImpl:async()=>new Response('bad',{headers:{'content-length':String(3*1024*1024)}})});
 await assert.rejects(large({}, {path:'/health'}),/Oversize/);
 const slow=createKeynoteBridge({isController:()=>true,fetchImpl:async(_url,{signal})=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}))});
 await assert.rejects(slow({}, {path:'/health',timeout:5}),/aborted/);
});
