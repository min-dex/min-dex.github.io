// Send only the broadcast canvas and its post-policy audio bus. No destination input.
export async function rehearse(stream,engine){
 const recorder=new MediaRecorder(stream,{mimeType:'video/webm;codecs=vp8,opus',videoBitsPerSecond:2500000});
 let pending=Promise.resolve(),failure,timer,started=false;
 try{
  await engine.start();started=true;
  await new Promise((resolve,reject)=>{
   recorder.onstop=resolve;recorder.onerror=()=>reject(Error('시험 입력을 인코딩할 수 없습니다.'));
   recorder.ondataavailable=({data})=>{
    pending=pending.then(async()=>{
     if(failure)return;
     for(let i=0;i<data.size;i+=1048576)await engine.write(new Uint8Array(await data.slice(i,i+1048576).arrayBuffer()));
    }).catch(error=>{failure=error;if(recorder.state==='recording')recorder.stop();});
   };
   recorder.start(250);timer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},4000);
  });
  await pending;if(failure)throw failure;
  return await engine.finish();
 }finally{
  clearTimeout(timer);
  if(recorder.state!=='inactive')recorder.stop();
  stream.getTracks().forEach(track=>track.stop());
  if(started)await engine.cancel().catch(()=>{});
 }
}
