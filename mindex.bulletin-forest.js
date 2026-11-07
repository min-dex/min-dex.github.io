// A4 half-fold children's forest layout. Only the presentation changes.
(() => {
  'use strict';
  const palette=Object.freeze({paper:'#fffdf5',cover:'#f0f2df',ink:'#294b3b',accent:'#4c785b',soft:'#e9efdf',peach:'#f7eadb',line:'#cad8c6',muted:'#294b3b'});
  // Keep stored frames and authored values; omit repeated print furniture.
  const redundant=new Set(['coverTheme','readingHelp','readingFooter','insideChurch','insideBrand']);
  const logo='assets/bulletin/children-mark-2026-11.png';
  const colorNames={paper:'종이',cover:'표지',ink:'본문',accent:'강조',soft:'연한 배경',peach:'안내 배경',line:'구분선',muted:'보조 글자'};
  function normalizeAppearance(value={},defaults={}){
    const result={version:1,palette:{...(defaults.palette||palette)},labels:{},visible:{},assets:{...(defaults.assets||{logo,artwork})}};
    for(const f of defaults.frames||frames()){
      result.visible[f.id]=!redundant.has(f.id);
      if(f.binding.startsWith('label:')&&f.type==='text')result.labels[f.id]=f.binding.slice(6);
    }
    for(const key of Object.keys(result.palette))if(/^#[0-9a-f]{6}$/i.test(value?.palette?.[key]||''))result.palette[key]=value.palette[key];
    for(const key of Object.keys(result.labels))if(typeof value?.labels?.[key]==='string'&&value.labels[key].length<=200)result.labels[key]=value.labels[key];
    for(const key of Object.keys(result.visible))if(typeof value?.visible?.[key]==='boolean')result.visible[key]=value.visible[key];
    for(const key of ['logo','artwork']){
      const asset=value?.assets?.[key];
      if(typeof asset==='string'&&((asset===''&&!!defaults.assets)|| /^assets\/bulletin\/[a-z0-9_.-]+$/i.test(asset)||(/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(asset)&&asset.length<=700000)))result.assets[key]=asset;
    }
    return result;
  }
  const visibleFrame=(frame,appearance)=>normalizeAppearance(appearance).visible[frame.id]!==false;
  function controls(doc,selected,escape,defaults){
    const value=normalizeAppearance(doc.settings.appearance,defaults);
    return `${Object.hasOwn(value.labels,selected)?`<label>고정 문구<input data-bulletin-design-label="${selected}" maxlength="200" value="${escape(value.labels[selected])}"></label>`:''}<details class="bulletin-property-section" data-bulletin-section="design-colors"><summary>색상</summary>${Object.entries(colorNames).map(([key,name])=>`<label>${name}<input type="color" data-bulletin-design-color="${key}" value="${value.palette[key]}"></label>`).join('')}</details><details class="bulletin-property-section" data-bulletin-section="design-images"><summary>로고와 그림</summary>${[['logo','로고'],['artwork','표지 그림']].map(([key,name])=>`<label>${name}<input type="file" data-bulletin-design-image="${key}" accept="image/png,image/jpeg,image/webp"></label><button type="button" data-bulletin-design-image-reset="${key}">${name} 기본값</button>`).join('')}</details>`;
  }
  const artwork='assets/bulletin/children-forest.svg';
  function frames(){
    const result=[];
    const add=(id,page,x,y,w,h,size,binding,type='text',align='left',weight=500)=>result.push({id,page,x,y,w,h,size,binding,type,align,weight});
    add('newsTitle',0,11,12.5,100,12.5,22.5,'label:우리의 주일','text','left',700);
    add('welcome',0,11,30,126.5,15,11.5,'field:welcome');
    add('news',0,11,50,126.5,42.5,12.5,'field:news','news');
    add('eventsTitle',0,11,97.5,95,10,15,'label:함께 기억해요','text','left',700);
    add('eventsMonth',0,111,97.5,26.5,10,10,'month:eventsMonth','text','right');
    add('events',0,11,110,126.5,35,10,'field:eventsText','events');
    add('staff',0,11,150,126.5,15,10,'field:staff');
    add('notices',0,11,170,126.5,22.5,10,'field:notices','list');
    add('address',0,11,196,126.5,5,7.5,'field:address');
    add('website',0,11,202,126.5,5,7.5,'field:website');
    add('forestLogo',0,159.5,12.5,37.5,22.5,10,'label:꿈꾸는 어린이부','logo');
    add('church',0,204.5,15,81.5,10,10,'field:church','text','right',700);
    add('liturgical',0,204.5,27.5,81.5,10,10,'source:liturgical','text','right');
    add('issue',0,159.5,40,126.5,7.5,10,'issue','text','left',700);
    add('coverTitle',0,159.5,52.5,126.5,40,35,'field:coverTitle','text','left',700);
    add('coverTheme',0,159.5,97.5,126.5,22.5,12.5,'field:monthlyTheme');
    add('forestArt',0,159.5,120,126.5,47.5,10,'label:작은 숲','art');
    add('verse',0,159.5,177.5,126.5,15,10,'field:verse','text','center');
    add('meeting',0,159.5,199,126.5,7.5,10,'field:meeting','text','left',700);
    add('orderTitle',1,11,12.5,90,12.5,22.5,'label:예배 순서','text','left',700);
    add('leader',1,11,27.5,126.5,12.5,10,'leader','text','right');
    add('order',1,11,45,126.5,120,12.5,'source:order','order');
    add('motto',1,11,175,126.5,20,12.5,'field:motto');
    add('insideChurch',1,11,202,126.5,5,7.5,'field:church');
    add('monthlyThemeTitle',1,165.5,16,110.5,7.5,10,'label:이달의 주제','text','left',700);
    add('monthlyTheme',1,165.5,26,110.5,30,20,'field:monthlyTheme','text','left',700);
    add('themeMonth',1,250,16,30,7.5,10,'month:curriculumMonth','text','right');
    add('memoryTitle',1,159.5,67.5,60,10,17.5,'label:새길 말씀','text','left',700);
    add('memoryReference',1,222,67.5,64,10,10,'field:memoryReference','text','right');
    add('memoryVerse',1,159.5,82.5,126.5,35,12.5,'field:memoryVerse');
    add('readingTitle',1,159.5,125,62.5,10,17.5,'label:잠잠성경','text','left',700);
    add('readingHelp',1,224.5,125,61.5,10,10,'label:잠들기 전, 잠언 읽기!','text','right');
    add('readingPlan',1,159.5,140,126.5,42.5,10,'field:readingPlan','reading');
    add('readingFooter',1,159.5,187.5,126.5,10,10,'label:부모님께 확인받고, 선생님께 달란트 받자!');
    add('insideBrand',1,159.5,202,126.5,5,7.5,'label:꿈꾸는 어린이부','text','right');
    return result;
  }
  const tovArtwork='assets/bulletin/tov-light-path.svg';
  const tovPalette={paper:'#fffcf7',cover:'#e2e3f0',ink:'#26294f',accent:'#574579',soft:'#eeebf4',peach:'#eeebf4',line:'#b6b8cd',muted:'#50567c'};
  function tovFrames(){
    const result=[];
    const add=(id,page,x,y,w,h,size,binding,type='text',align='left',weight=500)=>result.push({id,page,x,y,w,h,size,binding,type,align,weight});
    add('eventsTitle',0,19,13,118,11,22.5,'label:교회 일정','text','left',800);
    add('events',0,19,31,118,34,11.5,'field:eventsText','list');
    add('newsTitle',0,19,67,118,11,22.5,'label:토브 토킹','text','left',800);
    add('welcome',0,19,85,118,11,12.5,'field:welcome','text','left',700);
    add('news',0,19,97,118,43,11.5,'field:news','list');
    add('notices',0,19,141,118,17,10,'field:notices','list');
    add('motto',0,22,164,112,13,12.5,'field:motto','text','center',800);
    add('tovStaffTitle',0,22,179,112,5,9,'label:임원진','text','center',800);
    add('staff',0,22,185,112,13,11.5,'field:staff','text','center',700);
    add('verse',0,161,10,80,16,11.5,'field:verse');
    add('issue',0,241.5,10.5,43.5,10,11.5,'issue','text','center',700);
    add('tovTitle',0,174.5,50,96.5,36,35,'label:검단우리교회\n토브 청소년부','text','center',800);
    add('tovTag',0,182.5,93.5,80,9,12.5,'label:예수님 안에서 함께 성장하는 우리','text','center',700);
    add('tovArtwork',0,173.5,105,98.5,80,10,'label:표지 그림','art','center');
    add('tovChurch',0,158.5,189,128.5,9,15,'label:검단우리교회 청소년부','text','center',800);
    add('address',0,158.5,200,128.5,8,10,'field:address','text','center');
    add('orderTitle',1,18,12,120,11,22.5,'label:예배 순서','text','left',800);
    add('meeting',1,18,29,58,8,11.5,'field:meeting','text','left',700);
    add('leader',1,78,29,60,8,11.5,'leader','text','right',700);
    add('order',1,18,42,120,105,11.5,'source:order','order');
    add('nextPrayer',1,18,150,120,9,10,'field:nextPrayer');
    add('tovPointTitle',1,23,168,111,9,15,'label:예배 포인트','text','left',800);
    add('worshipPoint',1,23,181,111,14,11.5,'field:worshipPoint');
    add('notesTitle',1,160,12,119,11,22.5,'label:말씀 노트','text','left',800);
    add('tovScriptureTitle',1,165,33,51,8,12.5,'label:성경 본문','text','left',800);
    add('tovOutlineTitle',1,224,33,50,8,12.5,'label:말씀 이해','text','left',800);
    add('scriptureNote',1,165,44,51,112,11.5,'field:scriptureNote');
    add('outline',1,224,44,50,112,11.5,'field:outline');
    add('tovReflectionTitle',1,165,168,111,9,15,'label:내게 주신 말씀 / 내가 받은 은혜','text','left',800);
    add('reflection',1,165,181,111,14,11.5,'field:reflection');
    const displayTitles=new Set(['tovTitle','eventsTitle','newsTitle','orderTitle','notesTitle','tovPointTitle','tovReflectionTitle']);
    for(const frame of result)if(displayTitles.has(frame.id))frame.family='Paperlogy';
    return result;
  }
  function decorateTov(root,page,p,a){
    const add=(tag,props)=>root.append(a.svg(tag,props));
    const rect=(x,y,width,height,fill,rx=0)=>add('rect',{x,y,width,height,fill,rx});
    const line=(x1,y1,x2,y2,stroke=p.line)=>add('line',{x1,y1,x2,y2,stroke,'stroke-width':.3});
    const headingRule=(x,y,width)=>{
      line(x,y,x+width,y);
      rect(x,y-.4,10,.8,p.accent,.4);
    };
    rect(0,0,9,210,p.cover);
    if(page===0){
      rect(148.5,0,148.5,210,p.cover);
      rect(168,31,109,154,p.paper,5);
      line(203,44,242.5,44,p.line);
      rect(241,10,45,11,p.ink,5.5);
      rect(182.5,92,80,10,p.accent,5);
      rect(148.5,185,148.5,25,p.accent);
      rect(19,161,118,37,p.soft,3);
      rect(19,164,.8,31,p.accent,.4);
      headingRule(19,26,118);headingRule(19,80,118);
    }else{
      rect(288,0,9,210,p.cover);
      headingRule(18,25,120);headingRule(160,25,119);
      add('rect',{x:160,y:30,width:119,height:130,fill:'none',stroke:p.line,'stroke-width':.3});
      rect(160.15,30.15,118.7,11.5,p.soft);
      line(160,42,279,42);
      line(219.5,30,219.5,160);
      for(const x of [18,160]){
        rect(x,164,120,36,p.soft,4);
        line(x+5,179,x+115,179);
      }
    }
    for(const [x,angle] of page?[[4.5,-90],[292.5,90]]:[[4.5,-90]]){
      const text=a.svg('text',{x,y:105,transform:`rotate(${angle} ${x} 105)`,'text-anchor':'middle','dominant-baseline':'middle','font-family':'MindexBulletin','font-size':2.8,'font-weight':700,fill:p.ink});
      text.textContent='토브 청소년부';root.append(text);
    }
  }
  function paragraphs(value){
    const items=[];
    for(const line of String(value||'').split('\n').filter(line=>line.trim())){
      const marker=line.match(/^\s*(?:[①-⑳❶-❿]|\d+[.)]|[-•])\s*/u);
      if(marker||!items.length)items.push(marker?line.slice(marker[0].length):line);
      else items[items.length-1]+='\n'+line;
    }
    return items;
  }
  function news(group,value,f,issues,a){
    const palette=a.palette;
    let y=f.y;
    paragraphs(value).forEach((text,i)=>{
      const body=a.svg('g'),runs=a.runs(text);
      const used=a.styled(body,runs,{...f,x:f.x+12.5,y:y+3,w:f.w-17.5,h:f.y+f.h-y-6,color:palette.ink},issues,f.id);
      const h=Math.max(17.5,used+7.5);
      a.text(group,String(i+1),{...f,x:f.x+2.5,y:y+3,w:7.5,h:10,size:15,weight:700,align:'center',color:palette.accent},issues,f.id);
      group.append(body);y+=h+3.5;
      if(y-3.5>f.y+f.h+.01)issues.add(f.id);
    });
  }
  function events(group,value,f,issues,a){
    const palette=a.palette;
    let y=f.y;
    for(const line of String(value||'').split('\n').filter(Boolean)){
      const match=line.match(/^(.+?) \| (.+)$/)||line.match(/^(\d+월 \d+일)\s+(.+)$/);
      const date=match?.[1]||'',body=match?.[2]||line,w=date?f.w-30:f.w;
      const h=Math.max(8.5,Math.max(a.wrap(date,27.5,f.size).length,a.wrap(body,w,f.size).length)*12.5/a.MM+3);
      if(date)a.text(group,date,{...f,y,w:27.5,h,weight:700,color:palette.accent},issues,f.id);
      a.styled(group,a.runs(body),{...f,x:f.x+(date?30:0),y,w,h,color:palette.ink},issues,f.id);
      y+=h;group.append(a.svg('line',{x1:f.x,y1:y,x2:f.x+f.w,y2:y,stroke:palette.line,'stroke-width':.25}));
      if(y>f.y+f.h+.01)issues.add(f.id);
    }
  }
  function order(group,doc,f,issues,a){
    const palette=a.palette;
    const rows=[];
    for(const original of a.order(doc.source)){
      const row={...original,person:a.person(original.label==='광고'?a.value(doc,'announcer'):original.person)};
      const last=rows.at(-1);
      if(doc.settings.compactOrder!==false&&last&&['찬양','찬송'].includes(row.label)&&last.label===row.label&&last.person===row.person){last.content=[last.content,row.content].filter(Boolean).join('\n');}
      else rows.push(row);
    }
    const inner=f.w-60;
    if(inner<10){issues.add(f.id);return;}
    let y=f.y;
    group.append(a.svg('line',{x1:f.x,y1:y,x2:f.x+f.w,y2:y,stroke:palette.accent,'stroke-width':.5}));
    for(const row of rows){
      const n=Math.max(a.wrap(row.label,25,a.tov?Math.max(7.5,f.size-1):f.size,a.tov?700:500).length,a.wrap(row.content,inner,f.size,700).length,a.wrap(row.person,28,Math.max(7.5,f.size-2.5)).length);
      const leading=a.tov?13:15,h=n*leading/a.MM+(a.tov?3.25:4),base={...f,y:y+(a.tov?1.25:1.5),h:h-(a.tov?1.5:2),leading,color:palette.ink};
      const center=base.y+(n-1)*leading/a.MM/2;
      a.text(group,row.label,{...base,y:center,w:25,size:Math.max(7.5,f.size-1),...(a.tov?{weight:700}:{})},issues,f.id);
      a.text(group,row.content,{...base,x:f.x+27.5,w:inner,align:'center',weight:700,...(a.tov&&['성경봉독','설교'].includes(row.label)?{color:palette.accent}:{})},issues,f.id);
      a.text(group,row.person,{...base,y:center,x:f.x+f.w-28,w:28,size:Math.max(7.5,f.size-2.5),align:'right',...(a.tov?{color:palette.muted}:{})},issues,f.id);
      y+=h;group.append(a.svg('line',{x1:f.x,y1:y,x2:f.x+f.w,y2:y,stroke:palette.line,'stroke-width':.25}));
      if(y>f.y+f.h+.01)issues.add(f.id);
    }
  }
  function reading(group,value,f,issues,a){
    const palette=a.palette;
    const lines=String(value||'').split('\n').filter(Boolean),cols=lines.length>8?3:2,rows=Math.ceil(lines.length/cols),w=(f.w-4*(cols-1))/cols,step=10;
    lines.forEach((text,i)=>{
      const col=i%cols,row=Math.floor(i/cols),x=f.x+col*(w+4),y=f.y+row*step;
      group.append(a.svg('rect',{x:x+2.5,y:y+2.5,width:2.5,height:2.5,fill:'none',stroke:palette.accent,'stroke-width':.25}));
      a.text(group,text,{...f,x:x+7.5,y:y+.5,w:w-10,h:8,leading:12.5,color:palette.ink},issues,f.id);
    });
    if(rows*step-1.5>f.h+.01)issues.add(f.id);
  }
  function render(doc,mode,selected,a){
    const tov=doc.settings.design==='youth-tov';
    const appearance=normalizeAppearance(doc.settings.appearance,tov?{frames:tovFrames(),palette:tovPalette,assets:{logo:'',artwork:tovArtwork}}:undefined),palette=appearance.palette;
    a={...a,palette,tov};
    const issues=new Set(),pages=[];
    for(let page=0;page<2;page++){
      const root=a.svg('svg',{viewBox:'0 0 297 210',class:'bulletin-sheet',role:'img','aria-label':page?'주보 안쪽':'주보 겉면','data-bulletin-design':doc.settings.design});
      root.append(a.svg('rect',{width:297,height:210,fill:palette.paper}));
      if(tov)decorateTov(root,page,palette,a);
      else if(!page)root.append(a.svg('rect',{x:148.5,width:148.5,height:210,fill:palette.cover}));
      for(const f of doc.frames.filter(f=>f.page===page&&appearance.visible[f.id]!==false&&(!f.hidden||mode==='layout'))){
        const group=a.svg('g',{'data-frame-id':f.id}),check=f.hidden?new Set():issues,box={...f,color:['eventsMonth','themeMonth','liturgical','staff','address','website','memoryReference'].includes(f.id)?palette.muted:palette.ink},value=Object.hasOwn(appearance.labels,f.id)?appearance.labels[f.id]:a.bound(doc,f);
        if(tov){
          if(!String(value).trim()&&['outline','reflection'].includes(f.id)){
            const step=f.id==='reflection'?7:8;
            for(let y=f.y+step-1;y<f.y+f.h;y+=step){
              group.append(a.svg('line',{x1:f.x,y1:y,x2:f.x+f.w,y2:y,stroke:palette.line,'stroke-width':.22,'data-tov-writing-rule':''}));
            }
          }
          if(['issue','tovTag','tovChurch','address'].includes(f.id))box.color='#ffffff';
          if(['tovOutlineTitle','outline','tovPointTitle','worshipPoint','tovReflectionTitle','reflection'].includes(f.id))box.color=palette.accent;
        }
        if(f.type==='logo'||f.type==='art')group.append(a.svg('image',{href:new URL(f.type==='logo'?appearance.assets.logo:appearance.assets.artwork,document.baseURI).href,x:f.x,y:f.y,width:f.w,height:f.h,preserveAspectRatio:tov?'xMidYMax meet':'xMinYMid meet'}));
        else if(f.id==='coverTitle')a.text(group,String(value).replace(/^(\S{2,8})[ \t]+(\S{2,8})$/u,'$1\n$2'),{...box,leading:40},check,f.id);
        else if(f.id==='coverTheme')a.text(group,value,{...box,size:12.5,leading:17.5,color:palette.accent},check,f.id);
        else if(tov&&f.type==='list')a.list(group,value,{...box,itemGap:1.5},check);
        else if(f.type==='news')news(group,value,box,check,a);
        else if(f.type==='events')events(group,value,box,check,a);
        else if(f.type==='order')order(group,doc,box,check,a);
        else if(f.type==='reading')reading(group,value,box,check,a);
        else if(f.id==='monthlyTheme'){
          const lines=String(value).split('\n');
          a.styled(group,lines.map((text,i)=>({text:(i?'\n':'')+text,size:i?12.5:f.size,weight:i?500:700})),{...box,leading:17.5},check,f.id);
        }else if(f.id==='motto'||f.id==='notices'){
          a.styled(group,a.runs(value),box,check,f.id);
        }else if(f.binding==='leader'){const leader=a.value(doc,'leader');if(leader)a.styled(group,[{text:tov?'인도 : ':'인도 · ',size:f.size},...a.personRuns(leader,f.size)],box,check,f.id);}
        else if(f.binding.startsWith('month:'))a.text(group,String(value).replace('\n',' '),box,check,f.id);
        else a.styled(group,a.runs(value),box,check,f.id);
        if(mode==='layout'){
          group.append(a.svg('rect',{x:f.x,y:f.y,width:f.w,height:f.h,fill:'transparent',stroke:selected===f.id?palette.accent:palette.line,'stroke-width':.25,'data-frame-hit':f.id,class:'bulletin-frame-hit'}));
          if(selected===f.id)group.append(a.svg('rect',{x:f.x+f.w-1.5,y:f.y+f.h-1.5,width:3,height:3,fill:palette.accent,'data-resize':f.id,class:'bulletin-resize'}));
        }
        root.append(group);
      }
      pages.push(root);
    }
    return {pages,issues};
  }
  window.MindexBulletinForest=Object.freeze({frames,tovFrames,tovPalette,tovArtwork,render,artwork,visibleFrame,normalizeAppearance,controls});
})();
