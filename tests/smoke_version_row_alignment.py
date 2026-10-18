import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,launch_chromium,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page(viewport={'width':1600,'height':1000})
   page.add_init_script('Element.prototype.requestFullscreen=async()=>{};window.open=()=>null')
   page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url+'?mindexSmokeRaw=1',wait_until='load')
   page.wait_for_function("typeof renderVersionCompare==='function'")
   page.evaluate('''()=>{
    window.fixture={id:'test-song',title:'감사하는 성도여',versions:['a','b'].map((id,k)=>({id,name:k?'통일찬송가':'새찬송가',forms:Array.from({length:k?3:4},(_,i)=>({id:id+i,part_type:'Verse',part_number:i+1,lyrics:i===1&&k?'긴 가사를 좁은 화면에서 여러 줄로 보여 주는 비교용 문구입니다. '.repeat(9):'감사하는 성도여 추수 찬송 부르세\\n추운 겨울 오기 전 염려 없게 거뒀네\\n\\n하나님이 우리게 일용 양식 주시니'}))}))};
    getSelectedSong=()=>fixture;state.selectedVersionId='a';state.forms=normalizeForms(fixture.versions[0].forms);state.dirty.forms=true;
    document.body.dataset.module='praise';
    window.draw=()=>{document.body.innerHTML='<main class="praise-forms-panel" style="padding:25px">'+renderVersionCompare(fixture,fixture.versions)+'</main>';resizeFormTextareas();};draw();
   }''')
   for width in (1600,900,700):
    page.set_viewport_size({'width':width,'height':1000})
    for active in ('a','b'):
     page.evaluate('(id)=>{state.selectedVersionId=id;state.forms=normalizeForms(fixture.versions.find(v=>v.id===id).forms);draw();}',active)
     page.evaluate('''()=>{
      const cols=[...document.querySelectorAll('.version-compare-column')];
      for(let i=0;i<3;i++){
       const boxes=cols.map(c=>c.children[i].getBoundingClientRect());
       if(Math.abs(boxes[0].top-boxes[1].top)>1||Math.abs(boxes[0].height-boxes[1].height)>1)throw Error('row drift '+i+' '+JSON.stringify(boxes));
      }
      for(const col of cols) for(let i=1;i<col.children.length;i++) if(col.children[i].getBoundingClientRect().top < col.children[i-1].getBoundingClientRect().bottom) throw Error('overlapping rows');
      const before=JSON.stringify(fixture);const area=document.querySelector('.form-textarea');area.value+='\\n'.repeat(10)+'입력 중';resizeFormTextarea(area);
      const boxes=cols.map(c=>c.children[1].getBoundingClientRect());if(Math.abs(boxes[0].top-boxes[1].top)>1)throw Error('input drift');
      if(JSON.stringify(fixture)!==before)throw Error('source changed');
     }''')
    print(engine,width,'PASS aligned rows, unequal lengths, active switch, input growth',flush=True)
   browser.close()
finally:server.shutdown()
