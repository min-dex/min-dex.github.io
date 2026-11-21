// Only the trusted packaged controller may reach the existing paired Mac helper.
const BASE = 'http://127.0.0.1:43181';
const ORIGIN = 'https://min-dex.github.io';
const UUID = '[a-f0-9-]{36}';
function validate(payload = {}) {
  const {path,method='GET',headers={},body,timeout=10000}=payload;
  const convert=path==='/convert',pair=path==='/pair';
  const resource=typeof path==='string'&&new RegExp('^/jobs/'+UUID+'/[\\p{L}\\p{M}\\p{N}_./@-]+$','u').test(path)
    && !path.split('/').slice(1).some(part=>!part||part.startsWith('.'));
  if(!((path==='/health'&&method==='GET')||(pair&&method==='POST')
    ||(typeof path==='string'&&new RegExp('^/pair/'+UUID+'$').test(path)&&method==='GET')
    ||(convert&&method==='POST')||(resource&&method==='GET'))||path.length>2048)throw Error('Invalid Keynote request');
  if(!Number.isInteger(timeout)||timeout<1||timeout>(convert?320000:30000))throw Error('Invalid timeout');
  const safe={Origin:ORIGIN};
  for(const [key,value] of Object.entries(headers)) {
    if(typeof value!=='string')throw Error('Invalid header');
    if(key==='Authorization'&&/^Bearer [a-f0-9]{64}$/.test(value))safe[key]=value;
    else if(key==='X-Mindex-Keynote-Client'&&/^[a-f0-9]{64}$/.test(value))safe[key]=value;
    else if(key==='Content-Type'&&value===(pair?'application/json':'application/octet-stream'))safe[key]=value;
    else if(key==='Range'&&resource){
      const match=value.match(/^bytes=(\d+)-(\d+)$/),start=Number(match?.[1]),end=Number(match?.[2]);
      if(!match||!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||end<start||end-start+1>4*1024*1024)throw Error('Invalid range');
      safe[key]=value;
    }
    else throw Error('Invalid header');
  }
  if(convert&&(!(body instanceof Uint8Array)||!body.byteLength||body.byteLength>500*1024*1024))throw Error('Invalid source bytes');
  if(pair){if(typeof body!=='string'||body.length>256)throw Error('Invalid pairing');const value=JSON.parse(body);if(!value||Object.keys(value).length!==1||typeof value.client!=='string'||!/^[a-f0-9]{64}$/.test(value.client))throw Error('Invalid pairing');}
  if(!convert&&!pair&&body!==undefined)throw Error('Unexpected request body');
  return {path,method,headers:safe,body,timeout,limit:resource?(safe.Range?4:50)*1024*1024:2*1024*1024};
}
function createKeynoteBridge({isController,fetchImpl=fetch}) {
  return async(event,payload)=>{
    if(!isController(event))return {ok:false,reason:'untrusted-window'};
    const value=validate(payload),controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),value.timeout);
    try {
      const response=await fetchImpl(BASE+value.path,{method:value.method,headers:value.headers,body:value.body,
        redirect:'error',credentials:'omit',signal:controller.signal});
      if(Number(response.headers.get('content-length'))>value.limit)throw Error('Oversize helper response');
      const reader=response.body?.getReader(),chunks=[];let size=0;
      if(reader)for(;;){const {done,value:chunk}=await reader.read();if(done)break;size+=chunk.byteLength;
        if(size>value.limit){await reader.cancel();throw Error('Oversize helper response');}chunks.push(chunk);}
      const body=new Uint8Array(size);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}
      return {ok:true,status:response.status,body};
    }finally{clearTimeout(timer);controller.abort();}
  };
}
module.exports={createKeynoteBridge};
