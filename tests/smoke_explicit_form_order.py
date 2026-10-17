import json
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch();page=b.new_page();page.goto(url);page.wait_for_function("!document.body.classList.contains('ui-booting')")
   result=page.evaluate('''()=>{
    const forms=[{id:'v1',part_type:'Verse',part_number:1,lyrics:'verse one'},{id:'v2',part_type:'Verse',part_number:2,lyrics:'verse two'},{id:'c',part_type:'Chorus',lyrics:'chorus'}];
    const version={forms,praise_types:['ccm']},song={};const plan=(memo,v=version,s=song)=>presenterFormPlanForServiceItem(v,{label:'찬양',memo:JSON.stringify(memo)},s).forms.map(f=>f.id).join('-');
    const checks=[];const check=(name,actual,expected)=>checks.push({name,actual,expected,pass:actual===expected});
    for(const type of ['sunday-first','sunday-second','sunday-main','wednesday','friday','monthly','children','youth','young-adult']){
     for(const label of ['찬양 1','특송','봉헌특송','입례찬양','봉헌찬송']){
      const item={label,service_id:type,memo:JSON.stringify({formPresetDisabled:true})};
      check(type+'/'+label+' empty',presenterFormPlanForServiceItem(version,item,song).forms.map(f=>f.id).join('-'),'v1-c-v2-c');
      item.memo=JSON.stringify({formHint:'V2-C-V1-C',formPreset:{forms:['V2','C','V1','C'],strength:'manual'}});
      check(type+'/'+label+' manual',presenterFormPlanForServiceItem(version,item,song).forms.map(f=>f.id).join('-'),'v2-c-v1-c');
     }
    }
    for(const key of ['formHint','form_hint','forms'])check(key+' only',plan({[key]:'V2-C-V1-C'}),'v2-c-v1-c');
    check('song metadata explicit',plan({},version,{metadata:{presenter_form:'V2-C-V1-C'}}),'v2-c-v1-c');
    check('version metadata explicit',plan({}, {...version,metadata:{presenter_form:'V2-C-V1-C'}}),'v2-c-v1-c');
    for(const seq of [['V1','C','V2','C'],['V2','C','V1','C'],['C','V1','C','V2']]){
     const item={memo:JSON.stringify({formPreset:{forms:seq,strength:'manual'}})};
     const sources=forms.map(f=>({url:f.id}));const r=presenterScoreImageSourcesForFormSequence(sources,forms,forms,item,song,version);
     check('score '+seq.join('-'),r.imageSources.map(s=>s.url).join('-'),seq.map(s=>({V1:'v1',V2:'v2',C:'c'})[s]).join('-'));
    }
    return {count:checks.length,passed:checks.filter(c=>c.pass).length,failed:checks.filter(c=>!c.pass)};
   }''');assert not result['failed'],result
   print(engine,json.dumps(result,ensure_ascii=False));b.close()
finally:server.shutdown()
