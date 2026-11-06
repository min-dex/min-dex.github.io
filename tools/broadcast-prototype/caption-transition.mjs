// Alpha-layer transition only. Opaque output blackout/exclusion live outside it.
export function createCaptionTransition({makeCanvas=()=>document.createElement('canvas'),now=()=>performance.now(),duration=750}={}){
 const make=()=>{const c=makeCanvas();c.width=1280;c.height=720;return c;};
 const shown=make(),from=make(),target=make(),ctx=shown.getContext('2d');
 let empty=true,active=false,start=0,dirty=true,lastPixels=null;
 function draw(time=now()){
  if(!active&&!dirty)return shown;dirty=false;
  ctx.clearRect(0,0,1280,720);
  const p=active?Math.max(0,Math.min(1,(time-start)/duration)):1;
  // Add premultiplied contributions rather than source-over darkening overlaps.
  ctx.globalAlpha=1-p;ctx.drawImage(from,0,0);ctx.globalCompositeOperation='lighter';
  ctx.globalAlpha=p;ctx.drawImage(target,0,0);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';
  if(p===1)active=false;return shown;
 }
 function set(canvas,{immediate=false}={}){
  const data=canvas.getContext('2d').getImageData(0,0,1280,720).data;
  const pixels=new Uint32Array(data.buffer,data.byteOffset,data.byteLength/4);
  let same=!!lastPixels;
  if(same)for(let i=0;i<pixels.length;i++)if(pixels[i]!==lastPixels[i]){same=false;break;}
  if(!immediate&&same)return;
  lastPixels=pixels;
  let nextEmpty=true;for(let i=3;i<data.length;i+=4)if(data[i]){nextEmpty=false;break;}
  const t=now();draw(t);const f=from.getContext('2d');f.clearRect(0,0,1280,720);f.drawImage(shown,0,0);
  const out=target.getContext('2d');out.clearRect(0,0,1280,720);out.drawImage(canvas,0,0);
  dirty=true;active=!immediate&&empty!==nextEmpty;empty=nextEmpty;start=t;draw(t);
 }
 return {set,draw,state:()=>({empty,active,duration})};
}
