"""Display-only form spacing; stored labels and playback identity stay intact."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import launch_chromium,start_local_app_server,sync_playwright
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ('chromium','webkit'):
   browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=browser.new_page()
   page.add_init_script('Element.prototype.requestFullscreen=async()=>{};window.open=()=>null')
   page.route('**/*supabase*/**',lambda r:r.abort())
   page.goto(url+'?mindexSmokeRaw=1',wait_until='load')
   page.wait_for_function("typeof renderReadonlyFormBlock==='function'")
   print(engine,page.evaluate('''()=>{
    const check=(v,m)=>{if(!v)throw Error(m)};
    const cases=[['V2B','Verse 2 B','Verse',2,'B'],['C1A','Chorus 1 A','Chorus',1,'A'],['C@','Chorus @','Chorus',null,'@'],['V1@A','Verse 1 @A','Verse',1,'@A'],['PC2@B','Pre-Chorus 2 @B','Pre-Chorus',2,'@B'],['Coda@','Coda @','Coda',null,'@']];
    const host=document.createElement('main');document.body.replaceChildren(host);
    for(const [raw,shown,part_type,part_number,part_variant] of cases){
     const form={id:raw,part_type,part_number,part_variant,lyrics:'첫 줄\\n둘째 줄'};
     const source=JSON.stringify(form),stored=displayLabel(form),copy=formatBlockForCopy(form);
     check(songFormPresetDisplayLabel(raw)===shown,'shared '+raw);
     check(presenterFormPresetDisplayLabel(raw)===shown,'presenter '+raw);
     check(presenterResolvedFormMarker({...form,_presenterPresetLabel:raw})===shown,'marker '+raw);
     check(presenterFormGroupLabel({formLabel:raw})===shown,'badge/timing '+raw);
     host.insertAdjacentHTML('beforeend',renderReadonlyFormBlock(form));
     check(host.lastElementChild.querySelector('.form-label-text').textContent===shown,'readonly '+raw);
     check(JSON.stringify(form)===source&&displayLabel(form)===stored&&formatBlockForCopy(form)===copy,'source/copy changed');
     check(normalizePresenterFormPresetLabel(raw).key===normalizePresenterFormPresetLabel(shown).key,'playback identity');
    }
    check(displayLabel({part_type:'Chorus',part_variant:'@'})==='Chorus@','storage label changed');
    return 'PASS readonly, badges, timing labels, source/copy and playback identity';
   }'''),flush=True)
   page.screenshot(path='/tmp/form-label-spacing-'+engine+'.png');browser.close()
finally:server.shutdown()
