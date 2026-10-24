import {adminRpc} from './mindex.remote-admin.mjs?v=5';
const messages={rate_limited:'연결 시도가 많아요. 1분 뒤 다시 입력해 주세요.',busy:'이 송출에 다른 기기가 연결돼 있어요. 기존 연결을 해제한 뒤 다시 입력해 주세요.',invalid_code:'송출 코드를 확인해 주세요.',offline:'송출 PC의 연결이 끊겼어요. 인터넷 복귀 후 같은 코드로 다시 연결해 주세요.'};
export const validOutputCode=code=>/^\d{4}$/.test(String(code||'').trim());
export async function obtainOutputPairing(client,code){
 code=String(code||'').trim();
 if(!validOutputCode(code))throw Error('송출 화면의 숫자 4자리를 입력해 주세요.');
 const token=[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
 let output=null,revoked=false;
 async function revoke(){if(revoked)return;revoked=true;await adminRpc(client,'mindex_remote_guest',{p_action:'disconnect',p_token:token,p_output:output}).catch(()=>{});}
 try{
  const until=performance.now()+15000;
  while(performance.now()<until){
   const r=await adminRpc(client,'mindex_remote_guest',{p_action:'connect',p_token:token,p_code:code});
   output=r.output;
   if(r.ready){if(!/^[a-f0-9]{64}$/.test(r.secret||''))throw Error('연결 응답을 확인할 수 없어요.');return {secret:r.secret,code,revoke};}
   await new Promise(resolve=>setTimeout(resolve,500));
  }
  throw Error('송출 PC의 응답이 늦어요. 같은 코드로 다시 연결해 주세요.');
 }catch(e){await revoke();throw Error(messages[e.code]||e.message);}
}
