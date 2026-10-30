"""Multi-year archive projection without remote reads or writes."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server, sync_playwright, launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as pw:
  for engine in ('chromium','webkit'):
   b=launch_chromium(pw) if engine=='chromium' else pw.webkit.launch();p=b.new_page()
   p.route('**/*',lambda r:r.continue_() if r.request.method=='GET' and urlsplit(r.request.url).netloc==urlsplit(url).netloc else r.abort())
   p.goto(url);p.wait_for_function("typeof worshipSetlistArchiveYears==='function'&&!document.body.classList.contains('ui-booting')")
   print(engine,p.evaluate('''()=>{
    const check=(v,m)=>{if(!v)throw Error(m)};
    const dates=['2025-12-28','2026-01-02','2026-12-31','2027-01-01'];
    const sources=dates.map((date,i)=>({id:'source-'+i,service_date:date,service_type_id:'wed',aliases:['별명-'+i],leader:'담당-'+i,source_kind:'worship'}));
    const candidates=sources.map((s,i)=>({id:'song-'+i,import_source_id:s.id,candidate_level:'element',suggested_type:'praise',raw_label:'찬양 1',raw_title:'곡-'+i}));
    state.worshipSetlistArchive={sources,candidates,live:{services:[],sections:[],elements:[]},loaded:true,loading:false,error:''};
    state.worshipSetlistSongCatalog={status:'loaded',index:MindexSetlistLinks.buildIndex([])};
    state.services=[];state.serviceTypes=[];state.search='';state.worshipSetlistArchiveMonth='';
    const before=JSON.stringify(state.worshipSetlistArchive),seen=[];
    for(const view of ['date','service']){
     state.worshipSetlistArchiveView=view;
     for(const year of ['2025','2026','2027']){
      state.worshipSetlistArchiveYear=year;renderServiceSetlistArchiveDetail();
      const entries=filterWorshipSetlistArchivePeriod(worshipSetlistArchiveEntries());
      const expected=sources.filter(s=>s.service_date.startsWith(year));
      check(entries.length===expected.length,'year count');
      check(refs.detailPane.querySelectorAll('.svc-setlist-entry').length===expected.length,'visible card count');
      for(const e of entries){check(expected.some(s=>s.id===e.source.id),'wrong year');if(view==='date')seen.push(e.source.id);check(refs.detailPane.textContent.includes(e.source.aliases[0]),'alias lost');check(refs.detailPane.querySelector('[data-setlist-leader-input="'+e.source.id+'"]').value===e.source.leader,'leader lost');}
     }
    }
    check(seen.length===4&&new Set(seen).size===4,'missing or duplicate boundary');
    const week=worshipSetlistArchiveWeek('2027-01-01');check(week.title==='12월 5주'&&week.range.includes('2026년')&&week.range.includes('2027년'),'Wednesday grouping');
    state.worshipSetlistArchiveYear='2026';state.worshipSetlistArchiveMonth='01';renderServiceSetlistArchiveDetail();
    check(refs.detailPane.querySelectorAll('.svc-setlist-entry').length===1,'combined month');
    state.search='no match';renderServiceSetlistArchiveDetail();check(refs.detailPane.querySelector('option[value="2025"]'),'search removed year');
    check(before===JSON.stringify(state.worshipSetlistArchive),'original mutated');
    return 'PASS 2025–2027 card IDs, aliases, leaders, year/month, Wednesday boundary, both views and originals unchanged';
   }'''),flush=True);b.close()
finally:server.shutdown()
