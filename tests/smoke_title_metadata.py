"""Derived title metadata and rendered roles; isolated, no output or server writes."""
import os,json
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=b.new_page(viewport={'width':1920,'height':1080})
   page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url+'?mindexSmokeRaw=1');page.wait_for_function('typeof presenterSongTitleSlide === "function" && typeof serviceItemConnectedPraiseTitle === "function" && !document.body.classList.contains("ui-booting")')
   result=page.evaluate('''()=>{
    const check=(ok,message)=>{if(!ok)throw Error(message)}, results=[];
    const cases=[
     [{id:'SONG-HYMN-N382-0001',title:'대표 제목',hymn_no:'382'},{name:'기본'},'새찬송가 382장','대표 제목'],
     [{id:'SONG-HYMN-T432-0001',title:'옛 찬송',hymn_no:'통 432'},{name:'별도 가사'},'통일찬송가 432장','옛 찬송'],
     [{title:'대표 제목',hymn_no:'382'},{name:'기본'},'382장','대표 제목'],
     [{title:'대표 제목',hymn_no:'382'},{name:'통일 432 옛 제목'},'통일찬송가 432장','대표 제목'],
     [{title:'대표 제목',original_title:'Original',subtitle:'보조'},{name:'기본',output_title:'선택한 판본 제목'},'보조','선택한 판본 제목'],
     [{title:'같은 제목',original_title:'같은 제목'},{name:'기본'},'','같은 제목'],
     [{title:'같은 제목',subtitle:'같은 제목'},{name:'기본'},'','같은 제목'],
     [{title:'제목만'},{name:'기본'},'','제목만'],
     [{title:'긴 제목 '.repeat(12),subtitle:'긴 설명 '.repeat(12)},{name:'편집용 구분'},'긴 설명 '.repeat(12).trim(),'긴 제목 '.repeat(12).trim()],
    ];
    for(const [song,version,detail,title] of cases)for(const sectionKey of ['praise','offering']){
     const before=JSON.stringify([song,version]);
     const slide=presenterSongTitleSlide({id:'fixture',label:sectionKey==='praise'?'찬양 1':'봉헌찬양'},{sectionKey},song,version,song.title,0);
     const content=presenterSongTitleContent(slide);
     check(!(slide.contentTitle||slide.title).includes('382 ') && !(slide.contentTitle||slide.title).includes('432 '),'number repeated in title');check(content.detail===detail,'detail '+JSON.stringify(content));check(content.title===title,'title '+JSON.stringify(content));
     for(const noChromakey of [true,false]){
      const frame=renderPresenterSlideFrame(slide,{noChromakey});
      check(!frame.includes('기본')&&!frame.includes('편집용 구분'),'internal version leak');
      const host=document.createElement('div');host.className='presenter-output-root'+(noChromakey?' no-chromakey':'');host.style.cssText='position:fixed;width:1920px;height:1080px;left:0;top:0';host.innerHTML=frame;document.body.append(host);
      const node=host.querySelector('.presenter-fullscreen-song-detail');
      if(noChromakey){check(Boolean(node)===Boolean(detail),'empty or lost detail');check(!node||node.textContent.replace(/^\\(|\\)$/g,'')===detail,'rendered detail');}
      if(!noChromakey && content.detailKind==='hymn')check(host.querySelector('.presenter-song-book')?.textContent===detail,'keyed hymn edition missing');
      const text=host.querySelector('.presenter-title-content-title,.presenter-title-assignee-content,.presenter-slide-text');
      results.push({sectionKey,noChromakey,detail:!!node,font:getComputedStyle(text).fontSize,weight:getComputedStyle(text).fontWeight});host.remove();
     }
     check(JSON.stringify([song,version])===before,'source mutation');
    }
    for(const sample of [{type:'title-assignee',title:'설교',orderTitle:'설교',contentTitle:'말씀 제목',assignee:'담당자'},{type:'title-assignee',title:'기도',assignee:'담당자'},{type:'title-assignee',title:'기도',assignee:''}]){
     const html=renderPresenterTitleAssigneeSlide(sample);check(!html.includes('undefined'),'invalid assignee');check(html.includes('presenter-title-assignee-person')===!!sample.assignee,'empty assignee slot');
    }
    return results;
   }''')
   print(engine,'PASS',len(result),'rendered title cases',json.dumps(result[:4]),flush=True);b.close()
finally:server.shutdown();server.server_close()
