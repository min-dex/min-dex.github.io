// Six digits are a one-time server lookup, NEVER an encryption key or channel name.
const errors={rate_limited:'연결 시도가 많아요. 1분 뒤 PC에서 새 코드를 만들어 다시 입력해 주세요.',busy:'대기 중인 연결이 많아요. PC에서 사용하지 않는 원격 연결을 종료하거나 2분 뒤 다시 시도해 주세요.',invalid_code:'코드가 다르거나 만료·사용됐어요. PC에서 연결 종료 → 연결 시작을 눌러 새 코드를 확인해 주세요.'};
export const normalizeCode=value=>String(value||'').replace(/[\s-]/g,'');
export const validCode=value=>/^\d{6}$/.test(normalizeCode(value));
async function rpc(client,name,args={}){
 const abort=new AbortController();let timer;
 try{
  const request=client.rpc(name,args);
  const result=await Promise.race([request.abortSignal?request.abortSignal(abort.signal):request,new Promise((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error('연결 확인이 지연됐어요. PC에서 새 코드를 만들어 다시 시도해 주세요.'));},8000);})]);
  if(result?.error)throw Error('연결 서버에 접속하지 못했어요. PC와 폰의 인터넷을 확인한 뒤 PC에서 새 코드를 만들어 주세요.');
  return result?.data;
 }catch(error){if(abort.signal.aborted)throw Error('연결 확인이 지연됐어요. 인터넷을 확인하고 PC에서 새 코드를 만들어 다시 시도해 주세요.');throw Error('연결 서버에 접속하지 못했어요. PC와 폰의 인터넷을 확인한 뒤 PC에서 새 코드를 만들어 주세요.');}finally{clearTimeout(timer);}
}
export async function obtainPairing(client,host,code){
 const normalized=normalizeCode(code);
 if(!host&&!validCode(normalized))throw Error(normalized.length===8||normalized.length===16?'PC와 폰을 새로고침하고 새 숫자 6자리 코드를 만들어 주세요.':'숫자 6자리를 입력해 주세요.');
 const result=await rpc(client,host?'mindex_remote_create_code':'mindex_remote_claim_code',host?{}:{p_code:normalized});
 if(!result?.ok)throw Error(errors[result?.error]||'연결 코드를 확인할 수 없어요. PC와 폰을 새로고침하고 새 코드로 연결해 주세요.');
 if(!/^[0-9a-f]{64}$/.test(result.secret||'')||(host&&(!/^\d{6}$/.test(result.code||'')||!/^[0-9a-f]{64}$/.test(result.owner_token||''))))throw Error('연결 서버 응답을 확인할 수 없어요. PC와 폰을 새로고침하고 다시 시도해 주세요.');
 let revoked=false;
 return {secret:result.secret,code:host?result.code:normalized,
  revoke(){if(!host||revoked)return Promise.resolve();revoked=true;return rpc(client,'mindex_remote_revoke_code',{p_owner_token:result.owner_token}).catch(()=>{});}};
}
