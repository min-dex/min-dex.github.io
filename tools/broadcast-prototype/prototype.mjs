import {mountYoutube} from './youtube.mjs';
import {mountHallOutput} from './hall-output.mjs';
import {mountCaptureInput} from './capture-input.mjs';
import {createCaptionTransition} from './caption-transition.mjs';
import {createOutputPolicy,createAudioBuses,drawBroadcast} from './output-routing.mjs';
import {followPresenter} from './live.mjs';
let follower=null,mediaLoad=null,captureInput=null,captureReady=false;
// The standalone preview keeps sample inputs. The installed broadcaster starts empty.
const $=id=>document.getElementById(id);
const desktop=Boolean(window.youtubeOutput);
for(const control of document.querySelectorAll('[data-demo-only]')) control.hidden=desktop;
const canvas=$('program'),ctx=canvas.getContext('2d',{alpha:false});
const broadcast=$('broadcast'),broadcastCtx=broadcast.getContext('2d',{alpha:false}),outputPolicy=createOutputPolicy(),exclusions=new Map();
const outputWidth=desktop?1920:1280,outputHeight=desktop?1080:720,outputScale=outputWidth/1280;
for(const c of [canvas,broadcast]){c.width=outputWidth;c.height=outputHeight;c.getContext('2d').scale(outputScale,outputScale);}
let routeKey='sample:0',audioContext=null,audioBuses=null,hallAudio=null,broadcastAudio=null;
function paintRoute(){const policy=outputPolicy.read();audioBuses?.apply(policy);captureInput?.applyPolicy();if(!policy.broadcast)drawBroadcast(broadcastCtx,canvas,policy);$('routeStatus').textContent=`${policy.broadcast?'유튜브 송출 허용':policy.reason} · 본당 화면 유지 · 유튜브 음성 ${policy.broadcast?'허용 경로':'차단 경로'}`;$('excludeBroadcast').setAttribute('aria-pressed',String(policy.manual));$('excludeBroadcast').textContent=policy.manual?'수동 제외 해제':'방송 제외';}
function routeSlide(key,value=false){const wasExcluded=outputPolicy.read().excluded;routeKey=key;outputPolicy.setExcluded(exclusions.has(key)?exclusions.get(key):value===true);$('excludeSlide').checked=outputPolicy.read().excluded;if(wasExcluded&&!outputPolicy.read().excluded)captionTransition.set(emptyCaption,{immediate:true});paintRoute();}
$('excludeBroadcast').onclick=()=>{outputPolicy.setManual(!outputPolicy.read().manual);paintRoute();};
$('excludeSlide').onchange=()=>{exclusions.set(routeKey,$('excludeSlide').checked);outputPolicy.setExcluded($('excludeSlide').checked);paintRoute();};
const layer=document.createElement('canvas');layer.width=outputWidth;layer.height=outputHeight;
const ink=layer.getContext('2d'),captionTransition=createCaptionTransition({width:outputWidth,height:outputHeight});
const hallLayer=document.createElement('canvas');hallLayer.width=outputWidth;hallLayer.height=outputHeight;
const hallInk=hallLayer.getContext('2d'),hallTransition=createCaptionTransition({width:outputWidth,height:outputHeight});
ink.scale(outputScale,outputScale);hallInk.scale(outputScale,outputScale);
let lyrics=null;
const emptyCaption=document.createElement('canvas');emptyCaption.width=outputWidth;emptyCaption.height=outputHeight;
let blackScreen=false,sourceBlack=false,manualCaptionHidden=false;
function caption(options){buildCaption();captionTransition.set(layer,options);
 hallInk.clearRect(0,0,1280,720);
 if(lyrics!==null&&visible&&!manualCaptionHidden&&mode!=='camera')drawLyrics(hallInk,lyrics,true);
 else hallInk.drawImage(layer,0,0,1280,720);
 hallTransition.set(hallLayer,options);$('clear').textContent=manualCaptionHidden?'자막 표시':'자막 숨김';}
function setBlack(value){blackScreen=value;syncBlack();}
function syncBlack(){$('black').disabled=sourceBlack;$('black').setAttribute('aria-pressed',String(blackScreen||sourceBlack));$('black').textContent=sourceBlack?'송출 암전':blackScreen?'암전 해제':'암전';}

const video=$('sourceVideo');video.muted=true;video.playsInline=true;video.loop=true;video.preload='auto';
let importedImage=null,importedFrames=[],frameGeneration=0;
const samples=[{type:'lyrics',title:'주일 예배',text:'기쁨으로 함께 예배해요\n우리의 마음을 모아'},{type:'lyrics',title:'찬양',text:'한목소리로 찬양해요\n감사의 노래를 드려요'},{title:'안내',text:'예배 후 함께 인사해 주세요'}];
let slide=desktop?{title:'',text:''}:{...samples[0]},sample=0,mode='overlay',opacity=.4,visible=!desktop,paused=false,source=desktop?'none':'test',url='',generation=0,frame=0,ticks=0,last=performance.now(),raf,disposed=false,captionBuilds=0;
lyrics=slide.type==='lyrics'?slide.text:null;
$('title').value=slide.title;
$('text').value=slide.text;
$('sourceState').textContent=desktop?'영상 입력 대기':'테스트 영상';
function wrap(text,max,brush=ink){const lines=[];for(const paragraph of text.split('\n')){let line='';for(const ch of Array.from(paragraph)){if(line&&brush.measureText(line+ch).width>max){lines.push(line);line='';}line+=ch;}lines.push(line);}return lines;}
function drawLyrics(brush,text,hall){
 if(!text.trim())return;
 const area=hall?590:190;
 let size=hall?88:46,lines;
 for(;size>=12;size--){
  brush.font=`650 ${size}px "Mindex Presenter", sans-serif`;
  lines=wrap(text,1120,brush);
  if(lines.length*size*1.25<=area)break;
 }
 const height=Math.min(area,lines.length*size*1.25);
 const top=hall?(720-height)/2:684-height;
 brush.save();brush.fillStyle=`rgba(0,0,0,${opacity})`;brush.fillRect(40,top-12,1200,height+24);
 brush.beginPath();brush.rect(64,top,1152,height);brush.clip();
 brush.fillStyle='#fff';brush.textAlign='center';brush.textBaseline='middle';brush.shadowColor='#000';brush.shadowBlur=5;
 lines.forEach((line,i)=>brush.fillText(line,640,top+(i+.5)*size*1.25));
 brush.restore();
}
function buildCaption(){captionBuilds++;ink.clearRect(0,0,1280,720);if(!visible||manualCaptionHidden||mode==='camera')return;
 if(lyrics!==null){drawLyrics(ink,lyrics,false);return;}
 if(importedImage){ink.drawImage(importedImage,0,0,1280,720);return;}
 if(!slide.title.trim()&&!slide.text.trim())return;
 const area=mode==='slide'?570:210,maxWidth=1120;let size=48,lines=[];
 for(;size>=16;size--){ink.font=`600 ${size}px "Mindex Presenter", sans-serif`;lines=wrap(slide.text,maxWidth);if(lines.length*size*1.32<=area-55)break;}
 // Explicit clipping notice instead of drawing outside the video for extreme input.
 const limit=Math.max(1,Math.floor((area-55)/(size*1.32))),overflow=lines.length>limit;
 lines=lines.slice(0,limit);if(overflow)lines[limit-1]='…';
 $('notice').textContent=overflow?'자막이 너무 깁니다. 여러 장으로 나눠 주세요.':'자막 합성 중';
 const height=Math.min(area,lines.length*size*1.32+66),top=mode==='slide'?(720-height)/2:720-height-30;
 ink.fillStyle=`rgba(0,0,0,${opacity})`;ink.fillRect(40,top,1200,height);
 ink.textAlign='center';ink.textBaseline='top';ink.fillStyle='#fff';ink.shadowColor='rgba(0,0,0,.85)';ink.shadowBlur=5;
 ink.font='500 21px "Mindex Presenter", sans-serif';ink.fillText(slide.title,640,top+12,1120);
 ink.font=`600 ${size}px "Mindex Presenter", sans-serif`;lines.forEach((line,i)=>ink.fillText(line,640,top+45+i*size*1.32));
 ink.shadowBlur=0;
}
function release(){if(captureInput.active())captureInput.stop();generation++;mediaLoad?.abort();mediaLoad=null;video.pause();video.removeAttribute('src');video.load();if(url)URL.revokeObjectURL(url);url='';}
function resetSource(){
 release();
 source=desktop?'none':'test';paused=false;
 $('pause').textContent='일시정지';$('pause').disabled=desktop;
 $('sourceState').textContent=desktop?'영상 입력 대기':'테스트 영상';
 youtube.syncInput();
}
async function file(file){
 if(!file)return;release();const own=generation,load=new AbortController();mediaLoad=load;source='loading';youtube.syncInput();
 const webm=/webm/i.test(file.type||'')||/\.webm$/i.test(file.name||'');
 $('sourceState').textContent='영상 여는 중';
 let timeout,conversionTimeout=setTimeout(()=>load.abort(),95000);
 try{
  const prepared={blob:file,converted:false};clearTimeout(conversionTimeout);
  if(own!==generation||disposed||load.signal.aborted)return;
  url=URL.createObjectURL(prepared.blob);video.src=url;
  await Promise.race([video.play(),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error('load-timeout')),8000);})]);
  if(own!==generation||disposed)return;source='file';paused=false;$('pause').disabled=false;$('pause').textContent='일시정지';youtube.syncInput();
  $('sourceState').textContent=file.name+(prepared.converted?' · 호환 사본':'');
 }catch(error){
  if(own!==generation)return;resetSource();
  $('notice').textContent=webm?'이 파일을 재생할 수 없습니다. MP4 파일을 선택해 주세요.':'이 영상을 재생할 수 없습니다. 다른 영상 파일을 선택해 주세요.';
 }finally{clearTimeout(timeout);clearTimeout(conversionTimeout);if(mediaLoad===load)mediaLoad=null;}
}
function render(now,schedule=true){if(disposed)return;frame++;if(!paused)ticks++;ctx.fillStyle='#121a24';ctx.fillRect(0,0,1280,720);
 if(mode!=='slide'){
  if((source==='file'||source==='capture')&&video.readyState>=2&&video.videoWidth>0){const s=Math.min(1280/video.videoWidth,720/video.videoHeight);ctx.drawImage(video,(1280-video.videoWidth*s)/2,(720-video.videoHeight*s)/2,video.videoWidth*s,video.videoHeight*s);}
  else if(!desktop){const g=ctx.createLinearGradient(0,0,1280,720);g.addColorStop(0,'#193c4c');g.addColorStop(1,'#795442');ctx.fillStyle=g;ctx.fillRect(0,0,1280,720);ctx.fillStyle='#e8b778';ctx.beginPath();ctx.arc(170+(ticks*3)%940,250,65,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff';ctx.font='24px sans-serif';ctx.fillText('MINDEX · TEST INPUT',48,55);}
 }
 const policy=outputPolicy.read();
 if(blackScreen||sourceBlack){ctx.fillStyle='#000';ctx.fillRect(0,0,1280,720);drawBroadcast(broadcastCtx,canvas,policy);}
 else{
  drawBroadcast(broadcastCtx,canvas,policy);
  if(policy.broadcast)broadcastCtx.drawImage(captionTransition.draw(now),0,0,1280,720);
  ctx.drawImage(hallTransition.draw(now),0,0,1280,720);
 }if(now-last>=1000){$('metrics').textContent=`${Math.round(frame*1000/(now-last))} fps · ${outputWidth} × ${outputHeight}`;frame=0;last=now;}if(schedule)raf=requestAnimationFrame(render);
}
function applyFollowedText(title,text){slide={title:String(title||''),text:String(text||'')};}
function setSlide(value){lyrics=value.type==='lyrics'?String(value.text||''):null;routeSlide('sample:'+sample,value.broadcastExcluded);outputPolicy.setPending(false);paintRoute();frameGeneration++;importedImage=null;importedFrames=[];$('slideList').disabled=true;slide={title:String(value.title||'').slice(0,120),text:String(value.text||'').slice(0,2000)};visible=true;caption();}
$('file').onchange=e=>file(e.target.files[0]);$('test').onclick=resetSource;
$('pause').disabled=desktop;
$('pause').onclick=async()=>{if(source==='loading'||source==='capture')return;if(source==='file'&&paused){try{await video.play();}catch{$('notice').textContent='재생을 시작하지 못했습니다.';return;}}else if(source==='file')video.pause();paused=!paused;$('pause').textContent=paused?'재생':'일시정지';};
$('apply').onclick=()=>setSlide({type:'lyrics',title:$('title').value,text:$('text').value});$('clear').onclick=()=>{const wasBlack=blackScreen;setBlack(false);manualCaptionHidden=wasBlack?true:!manualCaptionHidden;caption({immediate:wasBlack});};
$('black').onclick=()=>setBlack(!blackScreen);
$('mode').onchange=()=>{mode=$('mode').value;caption();};$('opacity').oninput=()=>{opacity=Number($('opacity').value)/100;caption();};
function navigate(d){if(importedFrames.length){const i=(Number($('slideList').value)+d+importedFrames.length)%importedFrames.length;$('slideList').value=String(i);void selectImported(i);return;}sample=(sample+d+samples.length)%samples.length;setSlide(samples[sample]);$('title').value=slide.title;$('text').value=slide.text;}
$('previous').onclick=()=>navigate(-1);$('next').onclick=()=>navigate(1);
function dispose(){stopHallOutput();captureInput.dispose();audioBuses?.dispose();void audioContext?.close();follower?.stop();disposed=true;frameGeneration++;cancelAnimationFrame(raf);release();}window.addEventListener('pagehide',dispose);
window.broadcastPrototype={setSlide,dispose,transition:()=>captionTransition.state(),stats:()=>({blackScreen:blackScreen||sourceBlack,manualCaptionHidden,source,paused,ticks,captionBuilds,videoTime:video.currentTime,disposed}),routing:()=>({...outputPolicy.read(),audioReady:!!audioBuses,hallGain:audioBuses?.hall.gain.value,broadcastGain:audioBuses?.broadcast.gain.value}),alphaAt:(x,y)=>ink.getImageData(x,y,1,1).data[3]};
caption();document.fonts.ready.then(()=>{if(!disposed)caption();});raf=requestAnimationFrame(render);

async function selectImported(index){
 const request=++frameGeneration;const entry=importedFrames[index];lyrics=null;routeSlide('import:'+index,entry?.broadcastExcluded);outputPolicy.setPending(true);paintRoute();
 if(!entry||entry.unsupported){importedImage=null;visible=false;caption({immediate:true});$('slideStatus').textContent='이 장은 영상·이미지 등 별도 미디어 연결이 필요합니다. 자막을 비웠습니다.';return;}
 try{
  const image=new Image();image.src=entry.png;await image.decode();
  if(request!==frameGeneration||disposed)return;
  if(image.naturalWidth!==1280||image.naturalHeight!==720)throw Error('size');
  importedImage=image;lyrics=typeof entry.lyricText==='string'?entry.lyricText:null;visible=true;caption();outputPolicy.setPending(false);paintRoute();$('slideStatus').textContent=`${Number(index)+1} / ${importedFrames.length} · ${entry.title||'자막'} · 원본 송출 변경 없음`;
 }catch{if(request!==frameGeneration)return;importedImage=null;visible=false;caption({immediate:true});$('slideStatus').textContent='슬라이드를 읽지 못했습니다. 자막을 비웠습니다.';}
}
$('slideList').onchange=()=>selectImported(Number($('slideList').value));
$('slideFile').onchange=async e=>{
 const file=e.target.files[0];if(!file)return;
 const request=++frameGeneration;importedImage=null;importedFrames=[];visible=false;caption();$('slideList').disabled=true;$('slideList').replaceChildren();
 try{
  if(file.size>30_000_000)throw Error('large');const packet=JSON.parse(await file.text());if(request!==frameGeneration)return;
  if(packet.kind!=='mindex-broadcast-frames-v1'||!Array.isArray(packet.frames)||!packet.frames.length||packet.frames.length>300)throw Error('format');
  if(packet.frames.some(f=>!f||(!f.unsupported&&(!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(f.png)||f.png.length>2_000_000))))throw Error('image');
  exclusions.clear();importedFrames=packet.frames;for(const [i,entry] of importedFrames.entries()){const option=document.createElement('option');option.value=i;option.textContent=`${i+1}. ${String(entry.title||'자막').slice(0,120)}`;$('slideList').append(option);}
  $('slideList').disabled=false;await selectImported(0);
 }catch{if(request===frameGeneration)$('slideStatus').textContent='민덱스 합성용 슬라이드 파일을 선택해 주세요.';}
};

$('follow').onclick=()=>{
 if(follower){follower.stop();follower=null;$('follow').textContent='실시간 슬라이드 따라오기';$('follow').setAttribute('aria-pressed','false');for(const id of ['apply','previous','next','slideFile'])$(id).disabled=false;return;}
 for(const id of ['apply','previous','next','slideFile','slideList'])$(id).disabled=true;
 frameGeneration++;importedImage=null;visible=false;caption();$('follow').textContent='따라오기 해제';$('follow').setAttribute('aria-pressed','true');
 follower=followPresenter({onAccepted(slide,key){sourceBlack=false;syncBlack();routeSlide('live:'+key,slide?.broadcastExcluded);outputPolicy.setPending(true);paintRoute();},clear(reason){sourceBlack=reason==='blackout';syncBlack();outputPolicy.setPending(reason!=='blackout');paintRoute();importedImage=null;visible=false;caption({immediate:true});},status:text=>$('followStatus').textContent=text,async render(slide,current){
  lyrics=null;
  if(slide.type==='lyrics'&&slide.elementType==='praise'&&typeof slide.text==='string'){
   lyrics=slide.text;importedImage=null;visible=true;caption();outputPolicy.setPending(false);paintRoute();return;
  }
  if(!current())return;
  importedImage=null;
  const unsupported=['audio','video','image','file','score'].some(type=>[slide.type,slide.elementType].includes(type));
  const blank=slide.type==='blank'||slide.elementType==='blank';
  visible=!unsupported&&!blank;
  const text=slide.text||slide.bodyText||'';
  applyFollowedText(slide.title,text);
  caption();outputPolicy.setPending(unsupported);paintRoute();
  if(unsupported)return '미디어 장 · 유튜브 미리보기 대기';

 }});
};

paintRoute();

$('prepareAudio').onclick=async()=>{
 if(captureInput.active()){$('audioStatus').textContent='캡처보드 오디오 신호는 입력 테스트 수치에서 확인하세요.';return;}
 try{
  if(!audioContext){audioContext=new AudioContext();const source=audioContext.createMediaElementSource(video);audioBuses=createAudioBuses(audioContext,source);hallAudio=audioContext.createMediaStreamDestination();broadcastAudio=audioContext.createMediaStreamDestination();audioBuses.hall.connect(hallAudio);audioBuses.broadcast.connect(broadcastAudio);audioBuses.apply(outputPolicy.read());video.muted=false;}
  await audioContext.resume();$('audioStatus').textContent='음성 경로 준비됨 · 예배당/방송 분리 · 스피커 출력 없음';
 }catch{video.muted=true;$('audioStatus').textContent='음성 경로를 준비하지 못했습니다.';}
};

captureInput=mountCaptureInput({policy:()=>outputPolicy.read(),video,onStart(){
 generation++;mediaLoad?.abort();video.pause();video.removeAttribute('src');video.load();if(url)URL.revokeObjectURL(url);url='';source='capture';paused=false;$('pause').textContent='실시간 입력';$('pause').disabled=true;$('sourceState').textContent='캡처보드 입력';
 youtube.syncInput();
},onReady(){captureReady=true;youtube.syncInput();},onStop(){if(source==='capture'){
 captureReady=false;
 youtube.abort();source=desktop?'none':'test';paused=false;
 $('pause').textContent='일시정지';$('pause').disabled=desktop;
 $('sourceState').textContent=desktop?'영상 입력 대기':'테스트 영상';
 youtube.syncInput();
}}});

const stopHallOutput=mountHallOutput({getFrame(){if(disposed)return null;if(document.hidden)render(performance.now(),false);return canvas;}});

const youtube = mountYoutube(async () => {
 if (!captureInput.active()) await $('prepareAudio').onclick();
 const bus = captureInput.active() ? captureInput.broadcastStream() : broadcastAudio?.stream;
 const stream = broadcast.captureStream(30);
 let silent;
 const release = () => { stream.getTracks().forEach(track => track.stop()); if (silent) void silent.close(); };
 try {
  let audio = bus?.getAudioTracks()[0];
  if (!audio) {
   silent = new AudioContext();
   await silent.resume();
   audio = silent.createMediaStreamDestination().stream.getAudioTracks()[0];
  }
  stream.addTrack(audio.clone());
  return {stream,release};
 } catch (error) { release(); throw error; }
}, () => source==='file' || captureReady);
