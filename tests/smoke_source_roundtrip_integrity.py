import os
import subprocess
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    old_parser = subprocess.check_output(['git', 'show', 'a4afef7b^:mindex.worship-source.js'], text=True)
    old_app = subprocess.check_output(['git', 'show', 'a4afef7b^:app.js'], text=True)
    start = old_app.index('function sundayEditSyncSourceText(')
    old_patch = old_app[start:old_app.index('\n}\n', start) + 2]
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                page = browser.new_page()
                page.route('**/*supabase*/**', lambda r: r.abort())
                page.goto(os.environ.get('MINDEX_TEST_URL', url), wait_until='domcontentloaded')
                page.wait_for_function("typeof validateServiceSourceRecordMultiplicity === 'function'")
                result = page.evaluate(r'''historical => {
                  const check=(x,m)=>{if(!x)throw Error(m)};
                  const service={id:'source-integrity-test',type_id:'custom',date:'2026-10-06'};
                  const item={id:'one',label:'설교',raw_title:'현재 제목',assignee:'현재 담당',
                    _worshipSectionKey:'sermon',_worshipSectionTitle:'설교',memo:JSON.stringify({elementType:'title_person',inputMode:'text'})};
                  const source='[[준비]]\n[대기 영상]\n- 제목: 준비\n\n[[설교]]\n[설교]\n- 제목: 이전 제목\n- 담당: 이전 담당\n\n[[폐회]]\n[마무리]\n- 제목: 보존\n';
                  state.services=[service];state.serviceItems={[service.id]:[item]};
                  const legacyPatch=new Function('doc','item','next','service',historical.parser+'\n'+historical.patch+'\nreturn sundayEditSyncSourceText(doc,item,next,service);');
                  const broken=legacyPatch({sourceText:source},item,item,service);
                  check(parseServiceSourceText(broken).filter(r=>r.label==='설교').length===2,'historical duplication not reproduced');
                  let text=source;
                  for(let i=0;i<50;i++) {
                    text=sundayEditSyncSourceText({sourceText:text},item,{...item,raw_title:'수정 '+i},service);
                    const records=parseServiceSourceText(text,{includeRanges:true});
                    check(records.length===3&&records.every(r=>r.endLine>r.startLine),'growth or bad ranges');
                    check(records.find(r=>r.label==='설교').value==='수정 '+i,'stale value');
                    check(records.find(r=>r.label==='마무리').value==='보존','unrelated content lost');
                    const again=sundayEditSyncSourceText({sourceText:text},item,{...item,raw_title:'수정 '+i},service);
                    check(again===text,'same patch is not idempotent');
                  }
                  const duplicate='[[설교]]\n[설교]\n- 제목: 하나\n[설교]\n- 제목: 둘';
                  let rejected=false;
                  try{buildServiceDocumentSnapshot({...service,_worshipSourceTextDraft:duplicate},[item])}catch(e){rejected=e.message.includes('2번')}
                  check(rejected,'full snapshot accepted duplicate draft');
                  const previous=parseServiceSourceText(duplicate);
                  validateServiceSourceRecordMultiplicity(previous,[item],previous);
                  rejected=false;
                  try{validateServiceSourceRecordMultiplicity(parseServiceSourceText(duplicate.replace('둘','변경')),[item],previous)}catch{rejected=true}
                  check(rejected,'existing conflicting group was altered');
                  const originalTextarea=serviceSourceTextareaForService,originalEnsure=ensurePortableSourceItems;
                  let touched=false,toast='';const originalToast=showToast;
                  serviceSourceTextareaForService=()=>({value:duplicate,dataset:{}});
                  ensurePortableSourceItems=()=>{touched=true};showToast=m=>{toast=m};
                  const before=JSON.stringify(state.serviceItems);
                  try{check(applyServiceSourceText(service.id)===false,'duplicate applied')}finally{
                    serviceSourceTextareaForService=originalTextarea;ensurePortableSourceItems=originalEnsure;showToast=originalToast;
                  }
                  check(!touched&&before===JSON.stringify(state.serviceItems)&&toast.includes('2번'),'preflight mutated state');
                  validateServiceSourceRecordMultiplicity(parseServiceSourceText(duplicate),[item,{...item,id:'two'}]);
                  validateServiceSourceRecordMultiplicity(parseServiceSourceText('[[다른 구역]]\n[설교]\n- 제목: 새 항목'),[item]);
                  let legacy='[설교]\n설교: 이전 제목\n  담당: 이전 담당\n\n[폐회]\n마무리: 보존';
                  for(let i=0;i<20;i++)legacy=sundayEditSyncSourceText({sourceText:legacy},item,item,service);
                  check(parseServiceSourceText(legacy).length===2,'legacy growth');
                  return 'PASS historical reproduction, repeated patch stability, duplicate preflight without mutation, snapshot guard and legitimate repeated items';
                }''', {'parser': old_parser, 'patch': old_patch})
                print(engine, result, flush=True)
                browser.close()
    finally:
        server.shutdown()
        server.server_close()


if __name__ == '__main__':
    main()
