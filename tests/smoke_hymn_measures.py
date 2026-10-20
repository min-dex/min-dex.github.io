"""Offline musical metadata UI, draft invalidation and async races; no DB writes."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

def main():
 server,url=start_local_app_server()
 try:
  with sync_playwright() as pw:
   for engine in ['chromium','webkit']:
    browser=launch_chromium(pw) if engine=='chromium' else pw.webkit.launch(headless=True)
    page=browser.new_page();page.route('**/*supabase*/**',lambda r:r.abort())
    page.goto(url+'?output=presenter&mindexSmokeRaw=1');page.wait_for_function("typeof renderVersionMusicalStructure==='function'")
    print(engine,page.evaluate('''async()=>{
     const check=(x,m)=>{if(!x)throw Error(m)};
     const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),x=>x.toString(16).padStart(2,'0')).join('');
     const forms=[{id:'verse',part_type:'Verse',lyrics:'First block\\n\\nSecond block',sort_order:1},{id:'amen',part_type:'Coda',lyrics:'Amen',sort_order:2}];
     const record={stanzaApproxMeasures:16,reviewStatus:'score_supported_approximation',parts:[{unitId:'verse',kind:'Verse',textSha256:await hash(forms[0].lyrics),blockCount:2,approxMeasuresByBlock:[12,4],approxMeasures:16},{unitId:'amen',kind:'Coda',textSha256:await hash('Amen'),blockCount:1,approxMeasuresByBlock:[2],approxMeasures:2}]};
     const records={v:record},describe=MindexHymnStructure.describe;
     const measured=await describe('v',forms,records);
     check(measured.status==='measured'&&measured.text.includes('12+4')&&measured.text.includes('Coda 약 2'),'measured metadata');
     const fractional=await describe('v',forms,{v:{...record,displayNote:'shared ending',parts:[{...record.parts[0],approxMeasuresByBlock:[25/3,23/3]},record.parts[1]]}});
     check(fractional.text.includes('8.33+7.67')&&!fractional.text.includes('33333')&&fractional.text.includes('shared ending'),'fractional boundary and shared ending explanation');
     check((await describe('copy',forms,records)).status==='unreviewed','copy identity');
     for(const changed of [forms.slice(1),[...forms,{id:'extra',lyrics:'extra'}],[{...forms[0],lyrics:'edit'},forms[1]],[{...forms[0],part_type:'Chorus'},forms[1]]])check((await describe('v',changed,records)).status==='stale','changed unit guard');
     check((await describe('v',forms,{v:{...record,reviewStatus:'recitative_exception'}})).status==='recitative','recitative');
     check((await describe('v',forms,{v:{...record,parts:[record.parts[0],{...record.parts[1],approxMeasures:null}]}})).text.includes('기타 구간 미확인'),'partial coverage');
     const data=await(await fetch('./mindex.hymn-structure.runtime.json')).json();
     check(Object.keys(data.records).length>=25,'published catalog');
     const hymn29=Object.values(data.records).find(r=>r.edition==='new'&&r.number===29);
     check(hymn29.parts.filter(p=>p.kind==='Verse').map(p=>p.approxMeasures).join(',')==='16,16,15'&&hymn29.parts.find(p=>p.kind==='Coda').approxMeasures===1&&hymn29.displayNote.includes('15마디+Coda 1마디'),'shared Amen is mapped per unit, not counted twice');
     for(const r of Object.values(data.records))for(const part of r.parts){check(!('lyrics'in part)&&!('text'in part),'no published lyrics');if(part.approxMeasuresByBlock)check(part.approxMeasuresByBlock.length===part.blockCount&&part.approxMeasuresByBlock.reduce((a,b)=>a+b,0)===part.approxMeasures,'block consistency');}
     MindexHymnStructure.describe=(id,fs)=>describe(id,fs,records);
     const version={id:'v',name:'새찬송가',hymn_no:'10',forms},song={id:'song',title:'fixture',versions:[version],metadata:{}};
     state.songs=[song];state.selectedSongId='song';state.selectedVersionId='v';state.forms=forms.map(x=>({...x}));updateSaveState=()=>{};
     document.body.innerHTML='<div id="fixture">'+renderVersionTitleContent(song,version,state.forms,{active:true})+'</div><textarea data-form-field="lyrics" data-index="0"></textarea>';
     const before=JSON.stringify(song);
     await new Promise(r=>setTimeout(r,30));
     const node=document.querySelector('[data-hymn-structure-version]');check(node.dataset.reviewStatus==='measured','rendered measured');
     const field=document.querySelector('textarea');field.value='Edited lyrics';field.focus();field.setSelectionRange(3,3);updateFormField(field);
     await new Promise(r=>setTimeout(r,30));check(node.dataset.reviewStatus==='stale','editing immediately invalidates');check(document.activeElement===field&&field.selectionStart===3,'caret preserved');check(JSON.stringify(song)===before,'no stored song mutation');
     field.value=forms[0].lyrics;updateFormField(field);await new Promise(r=>setTimeout(r,30));check(node.dataset.reviewStatus==='measured','restored draft matches');
     let settle=[];MindexHymnStructure.describe=()=>new Promise(r=>settle.push(r));
     updateVersionMusicalStructure(node,version,forms);updateVersionMusicalStructure(node,version,forms);
     settle[1]({status:'stale',text:'new result'});await Promise.resolve();await Promise.resolve();settle[0]({status:'measured',text:'old result'});await Promise.resolve();await Promise.resolve();check(node.textContent==='new result','stale async completion');
     MindexHymnStructure.describe=()=>Promise.reject(Error('offline'));updateVersionMusicalStructure(node,version,forms);await new Promise(r=>setTimeout(r,10));check(node.dataset.reviewStatus==='error','fetch error distinct from unmeasured');
     MindexHymnStructure.describe=(id,fs)=>describe(id,fs,records);updateVersionMusicalStructure(node,version,forms);await new Promise(r=>setTimeout(r,10));check(node.dataset.reviewStatus==='measured','retry after failure');
     return 'PASS values, partial/unknown, copy/edit/delete, caret, race and retry';
    }'''),flush=True)
    for width in [390,1200]:
     page.set_viewport_size({'width':width,'height':700});assert page.locator('[data-hymn-structure-version]').is_visible()
    browser.close()
 finally:server.shutdown();server.server_close()
if __name__=='__main__':main()
