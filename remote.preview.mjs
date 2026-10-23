// Display-only isolated documents. No scripts, forms, navigation or media playback.
const base=new URL('.',location.href).href;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createPreview(host,label){
 let previous='';
 const frame=document.createElement('iframe');frame.title=label;frame.setAttribute('sandbox','');frame.setAttribute('tabindex','-1');frame.referrerPolicy='no-referrer';
 host.replaceChildren(frame);
 const resize=()=>{frame.style.transform=`scale(${host.clientWidth/1920})`;};
 new ResizeObserver(resize).observe(host);resize();
 return (html,text)=>{
  const valid=typeof html==='string'&&html.length<=5500;
  const fallback=String(text||'미리보기 없음').slice(0,1800);
  const size=Math.max(20,Math.min(64,Math.sqrt(1200000/Math.max(1,fallback.length*1.8)),800/Math.max(1,fallback.split('\n').length)/1.4));
  const content=valid&&html?html:`<div class="remote-fallback" style="font-size:${size}px">${escape(fallback)}</div>`;
  if(content===previous)return;previous=content;
  frame.srcdoc=`<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; style-src 'unsafe-inline' ${escape(location.origin)}; font-src ${escape(location.origin)}; img-src https: http:; media-src 'none'; connect-src 'none'; base-uri ${escape(location.origin)}; form-action 'none'"><base href="${escape(base)}"><link rel="stylesheet" href="styles.css"><link rel="stylesheet" href="styles.presenter-output.css"><style>html,body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#000;color:#fff}body{display:block}body>.svc-slide-mini-output{width:1920px;height:1080px}.svc-slide-mini-canvas{--presenter-preview-scale:1}*,*::before,*::after{animation:none!important;transition:none!important;pointer-events:none!important}.remote-fallback{height:100%;display:grid;place-content:center;padding:100px;text-align:center;white-space:pre-wrap;overflow-wrap:anywhere;font:64px/1.4 sans-serif;overflow:hidden}video,audio,iframe,object,embed{display:none!important}</style></head><body>${content}</body></html>`;
 };
}
