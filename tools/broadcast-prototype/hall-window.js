(()=>{
 const canvas=document.getElementById('hall'),ctx=canvas.getContext('2d',{alpha:false});let read=null,raf=null,closed=false;
 const blank=()=>{ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);};blank();
 window.attachHallOutput=(token,getFrame)=>{if(!window.opener||token!==location.hash.slice(1)||typeof getFrame!=='function')return;read=getFrame;};
 function render(){
  if(closed)return;
  try{
   if(!window.opener||window.opener.closed||!read){blank();}
   else{const frame=read();if(frame&&frame.width>0){ctx.drawImage(frame,0,0,canvas.width,canvas.height);}else blank();}
  }catch{blank();read=null;document.getElementById('status').textContent='합성 화면 연결이 끊겼습니다. 조작 화면에서 다시 열어 주세요.';}
  raf=requestAnimationFrame(render);
 }
 document.getElementById('fullscreen').onclick=async()=>{try{
  if(!document.documentElement.requestFullscreen)throw Error('unsupported');await document.documentElement.requestFullscreen();
 }catch{document.getElementById('status').textContent='전체 화면 전환이 지원되지 않거나 거절됐습니다. 브라우저의 전체 화면 기능을 사용해 주세요.';}};
 document.getElementById('hideControls').onclick=()=>document.documentElement.classList.add('output-only');
 window.addEventListener('keydown',event=>{if(event.key==='Escape')document.documentElement.classList.remove('output-only');});
 if(!window.opener)document.getElementById('status').textContent='방송 창에서 본당 출력 창을 열어 주세요.';
 document.getElementById('close').onclick=()=>window.close();
 window.addEventListener('pagehide',()=>{closed=true;read=null;cancelAnimationFrame(raf);blank();});raf=requestAnimationFrame(render);
})();
