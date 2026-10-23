// Ephemeral pairing only: no persistent credentials or offline command queue.
const enc=new TextEncoder(),dec=new TextDecoder();
export const actions=new Set(['prev','next','blank','unblank','play','pause','stop','resume','video-play','video-pause','video-restart','output-stop']);
export const id=()=>crypto.randomUUID();
const hex=b=>[...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('');
export async function pairing(secret){
 if(!/^[0-9a-f]{64}$/.test(secret||''))throw Error('REMOTE_INVALID_RELAY_SECRET');
 const bytes=await crypto.subtle.digest('SHA-256',enc.encode('mindex-remote-key-v3:'+secret));
 return {key:await crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt','decrypt']),
 topic:'mindex-remote-v3:'+hex(await crypto.subtle.digest('SHA-256',enc.encode('mindex-remote-topic-v3:'+secret)))};
}

const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes)));
const unb64=s=>Uint8Array.from(atob(s),x=>x.charCodeAt(0));
export async function seal(key,message,topic){
 const text=JSON.stringify(message);if(text.length>20000)throw Error('REMOTE_MESSAGE_TOO_LARGE');
 const iv=crypto.getRandomValues(new Uint8Array(12));
 return {iv:b64(iv),data:b64(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode(topic)},key,enc.encode(text)))};
}
export async function unseal(key,box,topic){
 if(!box||typeof box.iv!=='string'||box.iv.length!==16||typeof box.data!=='string'||box.data.length>30000)throw Error('REMOTE_INVALID_ENVELOPE');
 return JSON.parse(dec.decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(box.iv),additionalData:enc.encode(topic)},key,unb64(box.data))));
}
// ECDH prevents a previously seen pairing code from decrypting an established session.
export async function identity(){const keys=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);return {privateKey:keys.privateKey,publicKey:b64(await crypto.subtle.exportKey('raw',keys.publicKey))};}
export async function sessionKey(privateKey,publicKey,salt){
 if(typeof publicKey!=='string'||publicKey.length!==88)throw Error('REMOTE_INVALID_KEY');
 const other=await crypto.subtle.importKey('raw',unb64(publicKey),{name:'ECDH',namedCurve:'P-256'},false,[]);
 const bits=await crypto.subtle.deriveBits({name:'ECDH',public:other},privateKey,256);
 const material=await crypto.subtle.importKey('raw',bits,'HKDF',false,['deriveKey']);
 return crypto.subtle.deriveKey({name:'HKDF',hash:'SHA-256',salt:enc.encode(salt),info:enc.encode('mindex-remote-session-v1')},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt']);
}
export function createGate({read,execute,now=()=>performance.now()}){
 let revision=0,signature='',controller=null,epoch=id(),closed=false,busy=false,sequence=0;
 const tickets=new Map(),receipts=new Map();
 function sync(){const state=read();if(!state?.live){closed=true;throw Error('송출이 종료되어 연결이 해제됐습니다.');}
 const next=JSON.stringify(state);if(next!==signature){signature=next;revision++;}return state;}
 function snapshot(){const state=sync(),ticket=id(),time=now();tickets.set(ticket,{time,revision});for(const [k,v] of tickets)if(time-v.time>2000)tickets.delete(k);
 return {epoch,revision,ticket,state};}
 function connect(peer){if(closed||controller)throw Error('이미 연결됐거나 종료된 코드입니다.');sync();controller=peer;return snapshot();}
 async function command(peer,m){
 if(closed||peer!==controller)throw Error('연결 권한이 없습니다.');
 if(!m||typeof m.id!=='string'||m.id.length>64||!actions.has(m.action)||!Number.isSafeInteger(m.sequence))throw Error('잘못된 명령입니다.');
 if(receipts.has(m.id))return receipts.get(m.id);
 const ticket=tickets.get(m.ticket);sync();
 if(busy||m.epoch!==epoch||m.sequence<=sequence||m.revision!==revision||!ticket||ticket.revision!==revision||now()-ticket.time>2000)throw Error('화면 상태가 바뀌었습니다. 최신 상태에서 다시 눌러 주세요.');
 sequence=m.sequence;busy=true;tickets.clear();
 // Consume before execution: uncertain actions are never retried automatically.
 const result={id:m.id,ok:false,message:'실행 여부를 확인할 수 없습니다.'};receipts.set(m.id,result);
 if(receipts.size>128)receipts.delete(receipts.keys().next().value);
 try{await execute(m.action);result.ok=true;result.message='처리 완료';}catch(e){result.message=String(e.message||e).slice(0,200);}finally{busy=false;}
 return result;
 }
 return {connect,command,snapshot,close(){closed=true;controller=null;tickets.clear();},get connected(){return !!controller&&!closed;}};
}
