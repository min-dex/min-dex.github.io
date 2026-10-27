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
     check(measured.status==='measured'&&measured.text==='approx. 12 bars','measured metadata');
     const fractional=await describe('v',forms,{v:{...record,displayNote:'shared ending',parts:[{...record.parts[0],approxMeasuresByBlock:[25/3,23/3]},record.parts[1]]}});
     check(fractional.text==='approx. 8 bars'&&!fractional.text.includes('33333')&&!fractional.text.includes('shared ending'),'fractional boundary and shared ending explanation');
     check((await describe('v',forms,{v:{...record,parts:[{...record.parts[0],approxMeasuresByBlock:[8,6]},record.parts[1]]}})).text==='approx. 8 bars','short final phrase keeps ordinary size');
     check((await describe('v',forms,{v:{...record,parts:[{...record.parts[0],approxMeasuresByBlock:[4,4,8]},record.parts[1]]}})).text==='approx. 4 bars','most common body size excludes exceptional long block and Coda');
     check((await describe('copy',forms,records)).status==='unreviewed','copy identity');
     for(const changed of [forms.slice(1),[...forms,{id:'extra',lyrics:'extra'}],[{...forms[0],lyrics:'edit'},forms[1]],[{...forms[0],part_type:'Chorus'},forms[1]]])check((await describe('v',changed,records)).status==='stale','changed unit guard');
     check((await describe('v',forms,{v:{...record,reviewStatus:'recitative_exception'}})).status==='recitative','recitative');
     check((await describe('v',forms,{v:{...record,parts:[record.parts[0],{...record.parts[1],approxMeasures:null,approxMeasuresByBlock:null}]}})).text.includes('일부 구간 미확인'),'partial coverage');
     const data=await(await fetch('./mindex.hymn-structure.runtime.json')).json();
     check(Object.keys(data.records).length>=25,'published catalog');
     const hymn29=Object.values(data.records).find(r=>r.edition==='new'&&r.number===29);
     check(hymn29.reviewStatus==='score_supported_approximation'&&hymn29.parts.length===3&&hymn29.parts.every(p=>p.kind==='Verse'&&p.approxMeasures===16&&p.approxMeasuresByBlock.join('+')==='8+8')&&!hymn29.displayNote,'new29 is ordinary complete verses without Coda');
     const union29=Object.values(data.records).find(r=>r.edition==='union'&&r.number===29);check(union29.parts.length===3&&union29.parts.every(p=>p.kind==='Verse'&&p.approxMeasures===16),'linked union edition is checked independently');
     for(const r of Object.values(data.records))for(const part of r.parts){check(!('lyrics'in part)&&!('text'in part),'no published lyrics');if(part.approxMeasuresByBlock)check(part.approxMeasuresByBlock.length===part.blockCount&&part.approxMeasuresByBlock.reduce((a,b)=>a+b,0)===part.approxMeasures,'block consistency');}
     MindexHymnStructure.describe=(id,fs)=>describe(id,fs,records);
     const version={id:'v',name:'새찬송가',hymn_no:'10',forms},song={id:'song',title:'fixture',versions:[version],metadata:{}};
     state.songs=[song];state.selectedSongId='song';state.selectedVersionId='v';state.forms=forms.map(x=>({...x}));updateSaveState=()=>{};
     document.body.innerHTML='<div id="fixture">'+renderVersionTitleContent(song,version,state.forms,{active:true})+renderVersionMusicalStructure(version,state.forms,{metadataField:true})+'</div><textarea data-form-field="lyrics" data-index="0"></textarea>';
     const toolbar=document.createElement('div');toolbar.innerHTML=renderFormToolbar(song);check(!toolbar.querySelector('.form-toolbar-title')&&toolbar.querySelectorAll('[data-add-form]').length===5,'toolbar buttons without redundant heading');const before=JSON.stringify(song);
     await new Promise(r=>setTimeout(r,30));
     check(!document.querySelector('.version-musical-structure'),'no measure line on version card');const node=document.querySelector('[data-hymn-structure-version]');check(node.tagName==='INPUT'&&node.readOnly,'dedicated read-only metadata field');check(node.dataset.reviewStatus==='measured','rendered measured');
     const field=document.querySelector('textarea');field.value='Edited lyrics';field.focus();field.setSelectionRange(3,3);updateFormField(field);
     await new Promise(r=>setTimeout(r,30));check(node.dataset.reviewStatus==='stale','editing immediately invalidates');check(document.activeElement===field&&field.selectionStart===3,'caret preserved');check(JSON.stringify(song)===before,'no stored song mutation');
     field.value=forms[0].lyrics;updateFormField(field);await new Promise(r=>setTimeout(r,30));check(node.dataset.reviewStatus==='measured','restored draft matches');
     let settle=[];MindexHymnStructure.describe=()=>new Promise(r=>settle.push(r));
     updateVersionMusicalStructure(node,version,forms);updateVersionMusicalStructure(node,version,forms);
     settle[1]({status:'stale',text:'new result'});await Promise.resolve();await Promise.resolve();settle[0]({status:'measured',text:'old result'});await Promise.resolve();await Promise.resolve();check(node.value==='new result','stale async completion');
     MindexHymnStructure.describe=()=>Promise.reject(Error('offline'));updateVersionMusicalStructure(node,version,forms);await new Promise(r=>setTimeout(r,10));check(node.dataset.reviewStatus==='error','fetch error distinct from unmeasured');
     MindexHymnStructure.describe=(id,fs)=>describe(id,fs,records);updateVersionMusicalStructure(node,version,forms);await new Promise(r=>setTimeout(r,10));check(node.dataset.reviewStatus==='measured','retry after failure');
     // Native DB metadata needs no static lookup and updates without rebuilding the app.
     MindexHymnStructure.describe=describe;
     version._singleSongRecord=true;version.hymn_structure=structuredClone(records.v);
     updateVersionMusicalStructure(node,version,forms);await new Promise(r=>setTimeout(r,30));
     check(node.dataset.reviewStatus==='measured','native DB metadata renders');
     delete version.hymn_structure;
     updateVersionMusicalStructure(node,version,forms);await new Promise(r=>setTimeout(r,30));
     check(node.dataset.reviewStatus==='unreviewed','missing DB metadata never falls back to bundled evidence');
     return 'PASS values, partial/unknown, copy/edit/delete, caret, race and retry';
    }'''),flush=True)
    for width in [390,1200]:
     page.set_viewport_size({'width':width,'height':700});assert page.locator('[data-hymn-structure-version]').is_visible()
    browser.close()
 finally:server.shutdown();server.server_close()
if __name__=='__main__':main()
