// Session-only presenter marks. Coordinates are fractions of the unzoomed slide.
const presenterTools = (() => {
  const modes = {highlight:'형광펜', underline:'밑줄', spot:'스포트라이트', pan:'이동'};
  const icons = {highlight:'highlighter', underline:'underline', spot:'flashlight', pan:'hand', minus:'zoom-out', plus:'zoom-in', undo:'undo-2', reset:'rotate-ccw'};
  const button = (id, label) => `<button type="button" class="icon-btn svc-presenter-window-button" aria-label="${label}" data-slide-tool="${id}"${modes[id] ? ' aria-pressed="false"' : ''}><i data-lucide="${icons[id]}" aria-hidden="true"></i><span>${label}</span></button>`;
  const toolbar = `<section class="svc-screen-management" aria-label="발표 도구"><h3>발표 도구</h3><div class="svc-focus-tools">${Object.entries(modes).map(([id,label]) => button(id,label)).join('')}${button('minus','축소')}<output aria-label="화면 배율" title="현재 화면에서 Ctrl 또는 ⌘ + 휠로 확대·축소">100%</output>${button('plus','확대')}${button('undo','한 획 취소')}${button('reset','초기화')}</div></section>`;
  const key = (service, index, slide, live) => JSON.stringify([service,index,!!live,slide.id,slide.elementId,slide.type,slide.title,slide.text]);
  const empty = () => ({zoom:1,x:0,y:0,lines:[],spot:null});
  const clamp = (n,a,b) => Math.min(b,Math.max(a,n));
  let view=empty(), scope='', session='', mode='', frame=null, gesture=null, tick=0, watcher=null;
  let output=null, outputKey='';
  function paint(host, content, model) {
    if (!host || !content) return;
    const {zoom,x,y,lines,spot}=model;
    content.style.scale=zoom===1 ? '' : String(zoom);
    content.style.translate=x||y ? `${x*100}% ${y*100}%` : '';
    let svg=host.querySelector(':scope > .presenter-tool-overlay');
    if (!lines.length && !spot) { svg?.remove(); return; }
    const ns='http://www.w3.org/2000/svg';
    if (!svg) {
      svg=document.createElementNS(ns,'svg'); svg.classList.add('presenter-tool-overlay');
      svg.setAttribute('viewBox','0 0 1600 900'); svg.setAttribute('preserveAspectRatio','none');
      svg.setAttribute('aria-hidden','true'); host.append(svg);
    }
    const fragment=document.createDocumentFragment();
    const coord=(n,offset,size)=>((n-.5)*zoom+.5+offset)*size;
    for (const [tool,ax,ay,bx,by] of lines) {
      const line=document.createElementNS(ns,'line');
      const attrs={x1:coord(ax,x,1600),y1:coord(ay,y,900),x2:coord(bx,x,1600),y2:coord(by,y,900),
        stroke:tool==='highlight'?'#ffdf38':'#ff7160','stroke-width':(tool==='highlight'?34:6)*zoom,
        'stroke-opacity':tool==='highlight'?.48:1,'stroke-linecap':'round'};
      for (const [k,v] of Object.entries(attrs)) line.setAttribute(k,v);
      fragment.append(line);
    }
    if (spot) {
      const mask=document.createElementNS(ns,'path'), cx=spot[0]*1600, cy=spot[1]*900;
      mask.setAttribute('d',`M0 0h1600v900H0z M${cx-120} ${cy}a120 120 0 1 0 240 0a120 120 0 1 0 -240 0z`);
      mask.setAttribute('fill-rule','evenodd'); mask.setAttribute('fill','rgba(0,0,0,.68)');fragment.append(mask);
    }
    svg.replaceChildren(fragment);
  }
  function send(model) {
    if (!scope || !session || session!==state.presenter.outputSessionId) return;
    const message={type:'presenter-tools',key:scope,outputSessionId:session,model};
    try {
      if (state.presenter.channel) state.presenter.channel.postMessage(message);
      else state.presenter.outputWindow?.postMessage(message,location.origin);
    } catch {}
  }
  function draw() { paint(frame,frame?.querySelector('.svc-slide-mini-output'),view); }
  function schedule() {
    if (!tick) tick=requestAnimationFrame(()=>{tick=0;draw();send(view);});
  }
  function controls() {
    if (!frame) return;
    if (mode) frame.dataset.inkMode=mode; else delete frame.dataset.inkMode;
    const bar=frame.closest('.svc-focus-panel').querySelector('.svc-focus-tools');
    for (const b of bar.querySelectorAll('button')) {
      const id=b.dataset.slideTool;
      if (modes[id]) b.setAttribute('aria-pressed',String(mode===id));
      b.disabled=(id==='undo'&&!view.lines.length)||(['minus','pan'].includes(id)&&view.zoom===1)||(id==='plus'&&view.zoom===3);
    }
    bar.querySelector('output').textContent=Math.round(view.zoom*100)+'%';
  }
  function close() {
    if (!frame) return;
    cancelAnimationFrame(tick);tick=0;watcher?.disconnect();
    send(empty()); paint(frame,frame.querySelector('.svc-slide-mini-output'),empty());
    frame.removeEventListener('wheel', wheelZoom);
    delete frame.dataset.inkMode;frame=null;scope='';session='';gesture=null;mode='';view=empty();
  }
  function setZoom(requested, anchor) {
    const [slideX, slideY] = slidePoint(anchor);
    view.zoom = clamp(requested, 1, 3);
    const limit = (view.zoom - 1) / 2;
    view.x = clamp(anchor[0] - .5 - (slideX - .5) * view.zoom, -limit, limit);
    view.y = clamp(anchor[1] - .5 - (slideY - .5) * view.zoom, -limit, limit);
    if (!mode || mode === 'pan') mode = view.zoom > 1 ? 'pan' : '';
  }
  function wheelZoom(event) {
    if (event.currentTarget !== frame || (!event.ctrlKey && !event.metaKey) || !event.deltaY || !event.cancelable) return;
    event.preventDefault();
    if (gesture) return;
    const anchor = point(event);
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? frame.clientHeight : 1;
    // Normalize wheel notches and fine trackpad deltas to the same zoom curve.
    setZoom(view.zoom * Math.pow(1.25, -event.deltaY * unit / 100), anchor);
    if (mode === 'spot') view.spot = anchor;
    controls();
    schedule();
  }
  function action(id) {
    if (modes[id]) {mode=mode===id?'':id;view.spot=null;}
    else if (id==='reset') {mode='';view=empty();}
    else if (id==='undo') view.lines.pop();
    else {
      setZoom(view.zoom + (id === 'plus' ? .5 : -.5), [.5, .5]);
      if (mode !== 'spot') mode = view.zoom > 1 ? 'pan' : '';
    }
    gesture=null;controls();schedule();
  }
  function point(e) {
    const r=frame.getBoundingClientRect();
    return [clamp((e.clientX-r.left)/r.width,0,1),clamp((e.clientY-r.top)/r.height,0,1)];
  }
  function slidePoint([x,y]) {return [(x-.5-view.x)/view.zoom+.5,(y-.5-view.y)/view.zoom+.5];}
  function move(e) {
    if (!mode || !e.isPrimary) return;
    const p=point(e);
    if (mode==='spot') view.spot=p;
    else if (gesture?.id!==e.pointerId) return;
    else if (mode==='pan') {
      const lim=(view.zoom-1)/2;
      view.x=clamp(gesture.x+p[0]-gesture.start[0],-lim,lim);
      view.y=clamp(gesture.y+p[1]-gesture.start[1],-lim,lim);
    } else {
      const line=view.lines.at(-1), end=slidePoint(p);
      line[3]=end[0];line[4]=mode==='underline'?line[2]:end[1];
    }
    schedule();
  }
  function bind(node) {
    node.addEventListener('wheel', wheelZoom, {passive:false});
    node.onpointerdown=e=>{
      if (!mode || !e.isPrimary || e.button!==0) return;
      e.preventDefault();node.setPointerCapture(e.pointerId);
      const start=point(e);gesture={id:e.pointerId,start,x:view.x,y:view.y};
      if (mode==='highlight'||mode==='underline') {
        if (view.lines.length===96) view.lines.shift();
        const p=slidePoint(start);view.lines.push([mode,...p,...p]);controls();
      }
      move(e);
    };
    node.onpointermove=move;
    node.onpointerup=e=>{if (gesture?.id===e.pointerId) {move(e);gesture=null;}};
    node.onlostpointercapture=node.onpointercancel=()=>{gesture=null;};
    node.onpointerleave=()=>{if (view.spot) {view.spot=null;schedule();}};
  }
  function mount(panel,nextKey,nextSession) {
    if (!nextKey) {close();return;}
    if (nextKey!==scope || nextSession!==session) close();
    const node=panel.querySelector('.svc-focus-preview .svc-slide-thumb-frame');
    const changed=frame!==node;
    if (changed) {
      watcher?.disconnect();frame=node;gesture=null;bind(node);
      watcher=new MutationObserver(()=>{if (!node.isConnected) close();});
      watcher.observe(document.getElementById('detailPane'),{childList:true,subtree:true});
    }
    scope=nextKey;session=nextSession;
    panel.querySelector('.svc-focus-tools').onclick=e=>{const b=e.target.closest('[data-slide-tool]');if(b&&!b.disabled) action(b.dataset.slideTool);};
    controls();draw();
  }
  function outputFrame(root,nextKey) {
    if (output && outputKey!==nextKey) paint(output.parentNode,output,empty());
    output=root;outputKey=nextKey;
  }
  function receive(msg,id) {
    if (!output || !id || msg.outputSessionId!==id || !outputKey || msg.key!==outputKey) return;
    const m=msg.model;
    const pair=p=>Array.isArray(p)&&p.length===2&&p.every(v=>Number.isFinite(v)&&v>=0&&v<=1);
    if (!m || !Number.isFinite(m.zoom)||m.zoom<1||m.zoom>3||![m.x,m.y].every(n=>Number.isFinite(n)&&Math.abs(n)<=(m.zoom-1)/2)
      || (m.spot!==null&&!pair(m.spot)) || !Array.isArray(m.lines)||m.lines.length>96
      || !m.lines.every(l=>Array.isArray(l)&&l.length===5&&['highlight','underline'].includes(l[0])&&l.slice(1).every(n=>Number.isFinite(n)&&Math.abs(n)<=2))) return;
    paint(output.parentNode,output,m);
  }
  return {toolbar,key,mount,close,outputFrame,receive};
})();

// Manual media selection belongs with the media controls.
function loadServiceMusicFile(file) {
  if (!file) return;
  const audio = getServiceMusicAudio();
  if (state.serviceMusic.objectUrl) URL.revokeObjectURL(state.serviceMusic.objectUrl);
  state.serviceMusic.objectUrl = URL.createObjectURL(file);
  state.serviceMusic.fileName = file.name || "음악";
  setServiceMusicSource(audio, state.serviceMusic.objectUrl, "manual", { loop: false }, state.serviceMusic.fileName);
  audio.volume = state.serviceMusic.volumeLevel / 5;
  renderPresenterControlState();
}
