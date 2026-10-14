"""Instance media insertion: repeated forms, row roundtrip and safe invalidation, offline."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from urllib.parse import urlsplit
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

SCRIPT=r'''async()=>{
 const check=(v,m)=>{if(!v)throw Error(m)};
 const service={id:crypto.randomUUID(),type_id:'fixture',date:'2026-10-18',title:'진행 자료 검증'};
 state.services=[service];state.selectedServiceId=service.id;state.module='presenter';
 state.client={from(){throw Error('Unexpected DB access')}};state.serviceTypes=[{id:'fixture',name:'검증 예배'}];state.serviceError='';state.loading=false;state.presenter.viewServiceId=service.id;
 state.loadedWorshipServiceIds=new Set([service.id]);state.templateElementSuppressions.clear();
 const version={id:crypto.randomUUID(),_worshipVersionPersisted:true,name:'기본',praise_types:['ccm'],
 forms:['Verse','Chorus','Coda','Tag'].map((part,i)=>({id:'f'+i,part_type:part,part_number:1,label:part,lyrics:'첫 줄 '+part+'\n둘째 줄\n셋째 줄\n넷째 줄\n다섯째 줄'}))};
 const song={id:crypto.randomUUID(),title:'시험 찬양',_relationalVersionsLoaded:true,versions:[version]};
 state.songs=[song];clearSearchCaches();
 const parent=normalizeServiceItem({id:crypto.randomUUID(),service_id:service.id,label:'찬양 1',raw_title:song.title,song_id:song.id,version_id:version.id,
 _worshipSectionKey:'praise',_worshipSectionTitle:'찬양',_worshipElementTemplateModified:true,
 memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',outputMode:'lyrics',formHint:'V-C-Int-Coda-C-Int-C-C-Tag'})},0);
 state.serviceItems[service.id]=[parent];
 const canonical=JSON.stringify(song);
 const plan=presenterProgressionForItem(parent,service.id);
 check(plan.groups.length===9,'9 form occurrences missing: '+JSON.stringify(plan));
 check(plan.groups[2].key!==plan.groups[5].key,'repeated Int identity collapsed');
 const placement={parentItemId:parent.id,formKey:plan.groups[5].key,signature:plan.signature};
 const media=addPresenterReferenceMedia(service.id,'praise',{afterItemId:parent.id,mediaPlacement:placement,render:false,focus:false});
 check(media&&isPresenterReferenceMediaItem(media),'reference media not supported in praise section');
 const mediaMemo=parseServiceItemMemo(media.memo);
 mediaMemo.asset={kind:'image',name:'교회 사진',url:'/assets/icon-192.png',slides:[{url:'/assets/icon-192.png',name:'사진 1',order:1},{url:'/assets/icon-512.png',name:'사진 2',order:2}]};
 media.memo=serializeServiceItemMemo(mediaMemo);
 const build=items=>buildServicePresenterSlidesUncached(service.id,{service,items,allowHydration:false});
 const items=getServiceItems(service.id);
 let slides=build(items);
 const mediaSlides=slides.filter(s=>s.elementId===media.id&&!s.autoTrailingBlank);
 check(mediaSlides.length===2,'photo bundle missing: '+JSON.stringify(slides.map(s=>[s.type,s.elementId,s.formKey])));
 const at=slides.findIndex(s=>s.id===mediaSlides[0].id);
 check(slides[at-1].formKey===placement.formKey,'photos are not after second Int');
 check(slides[at+2].formKey===plan.groups[6].key,'next chorus not immediately after photos');
 check(slides[at+1].imageSrc==='/assets/icon-512.png','photo order lost');
 check(slides.filter(s=>s.formKey===plan.groups[2].key).length===1,'first Int changed');
 check(JSON.stringify(song)===canonical,'canonical song mutated');
 const timed=slides.map((slide,index)=>({...slide,...(slide.elementId===parent.id?{syncTimeline:{groupId:'fixture',audioSrc:'/fixture.wav',start:index,lead:0}}:{})}));
 const beforeMedia=presenterSyncedLyricsTargetForTime(timed,at-1,999);
 check(beforeMedia?.index===at-1,'audio clock skipped inserted photos');
 check(presenterSyncedLyricsTargetForTime(timed,at+2,0)===null,'backward audio seek crossed inserted photos');
 const visual=groupPresenterSlidesBySection(slides,service.id).flatMap(g=>g.subgroups.flatMap(s=>s.slides)).filter(e=>e.slideIndex>=0).map(e=>e.slide.id);
 check(JSON.stringify(visual)===JSON.stringify(slides.map(s=>s.id)),'thumbnail order differs from playback: '+JSON.stringify({visual,expected:slides.map(s=>s.id)}));
 const subgroups=groupPresenterSlidesBySection(slides,service.id).flatMap(g=>g.subgroups);
 const segments=subgroups.filter(g=>g.id===parent.id);
 check(segments.length===2&&segments[0].label===segments[1].label,'resumed song was renumbered');
 check(subgroups.find(g=>g.id===media.id).label==='참고 화면','media was numbered as a song');
 const rows=buildWorshipPersistenceRows(service,items,{}, {},{elementTypedStateColumns:{inputMode:true,contentState:true}});
 sanitizeWorshipPersistenceRows(rows,{elementTypedStateColumns:{inputMode:true,contentState:true}});compactWorshipPersistenceRows(rows);
 const saved=rows.elements.find(e=>e.config.mediaPlacement);
 check(saved.config.mediaPlacement.formKey===placement.formKey,'placement not in normalized element config');
 const persistedParentId=rows.elements.find(e=>e.song_id===song.id).id;
 const restored=groupWorshipElements(rows.sections,rows.elements)[service.id];
 const restoredMedia=restored.find(i=>i.id===saved.id);
 check(JSON.stringify(parseServiceItemMemo(restoredMedia.memo).mediaPlacement)===JSON.stringify({...placement,parentItemId:persistedParentId}),'placement roundtrip failed '+JSON.stringify({actual:parseServiceItemMemo(restoredMedia.memo).mediaPlacement,placement}));
 const again=build(restored);const next=again.findIndex(s=>s.elementId===saved.id);
 check(again[next-1].formKey===placement.formKey&&again[next+2].formKey===plan.groups[6].key,'saved placement drifted');
 const changed=structuredClone(restored);const changedParent=changed.find(i=>i.id===persistedParentId);
 const pm=parseServiceItemMemo(changedParent.memo);pm.formHint='V-C-Int-C';pm.formPreset=null;changedParent.memo=serializeServiceItemMemo(pm);
 const invalid=build(changed).filter(s=>s.elementId===saved.id);
 check(invalid.length&&invalid.every(s=>s.hiddenInPresentation),'changed sequence silently reattached media');
 check(invalid.every(s=>!presenterSlideIsNavigable(s)),'invalid media remains navigable');
 const orphan=build(restored.filter(i=>i.id!==persistedParentId)).filter(s=>s.elementId===saved.id);
 check(orphan.length&&orphan.every(s=>s.hiddenInPresentation),'orphan media is live');
 const hidden=structuredClone(restored);const hp=hidden.find(i=>i.id===persistedParentId);hp.memo=serializeServiceItemMemo({...parseServiceItemMemo(hp.memo),hiddenInPresentation:true});
 check(build(hidden).filter(s=>s.elementId===saved.id).every(s=>s.hiddenInPresentation),'hidden song leaks photos');
 state.serviceItems[service.id]=restored;
 refs.detailPane.innerHTML='<main id="media-fixture" style="width:360px;padding:20px">'+renderPresenterProgressionAdd(restored.find(i=>i.id===persistedParentId))+renderPresenterServiceAssetInput(restoredMedia,1,parseServiceItemMemo(restoredMedia.memo))+'</main>';
 return {result:'PASS second Int, multi-chunk forms, normal next/previous order, board order, roundtrip, changed-form/orphan/hidden protection',parentId:persistedParentId,mediaId:saved.id,serviceId:service.id};
}'''

def main():
 server,url=start_local_app_server()
 try:
  with sync_playwright() as p:
   for engine in ('chromium','webkit'):
    browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch();page=browser.new_page(viewport={'width':1000,'height':900})
    page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).hostname in ('127.0.0.1','localhost') and r.request.method=='GET' else r.abort())
    page.goto(url);page.wait_for_function("typeof insertPresenterProgressionMedia==='function'&&typeof state!=='undefined'&&!!refs.saveAllBtn")
    result=page.evaluate(SCRIPT);print(engine,result,flush=True)
    page.locator('.svc-progression-media summary').click()
    check=page.locator('[data-progression-position] option').count()
    assert check==9,check
    page.screenshot(path='/private/tmp/mindex-progression-'+engine+'.png')
    page.locator('[data-media-order="1"]').first.click()
    assert page.evaluate("id=>parseServiceItemMemo(getServiceItems(state.selectedServiceId).find(i=>i.id===id).memo).asset.slides[0].url",result['mediaId'])=='/assets/icon-512.png'
    field=page.locator('[data-media-placement]').first
    field.select_option('detach')
    assert page.evaluate("id=>!parseServiceItemMemo(getServiceItems(state.selectedServiceId).find(i=>i.id===id).memo).mediaPlacement",result['mediaId'])
    page.locator('.svc-progression-media summary').first.click()
    page.locator('[data-progression-position]').first.select_option(label='6. Int 뒤')
    page.locator('[data-progression-media-add]').first.click()
    assert page.evaluate("()=>getServiceItems(state.selectedServiceId).some(i=>parseServiceItemMemo(i.memo).mediaPlacement?.formKey==='blank:instrumental:5')")
    page.screenshot(path='/private/tmp/mindex-progression-board-'+engine+'.png',full_page=True)
    print(engine,'PASS real photo-order, detach and add controls',flush=True)
    browser.close()
 finally:server.shutdown()
if __name__=='__main__':main()
