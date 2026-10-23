"""Legacy score titles survive the virtual Title rollout without DB mutations."""
import os
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

server, url = start_local_app_server()
try:
    with sync_playwright() as pw:
        for engine in ('chromium', 'webkit'):
            browser = launch_chromium(pw) if engine == 'chromium' else pw.webkit.launch(headless=True)
            page = browser.new_page()
            page.route('**/*supabase*/**', lambda route: route.abort())
            page.goto(url + '?mindexSmokeRaw=1')
            page.wait_for_function("typeof buildPresenterSlidesForServiceItem==='function' && !document.body.classList.contains('ui-booting')")
            print(engine, page.evaluate('''() => {
              const check=(ok,message)=>{if(!ok)throw Error(message)};
              const version={id:'restore-version',name:'새찬송가',hymn_no:'359',praise_types:['hymn'],forms:[
                {id:'v1',part_type:'Verse',part_number:1,lyrics:'첫 가사'},
                {id:'c',part_type:'Chorus',lyrics:'후렴 가사'}]};
              const song={id:'restore-song',title:'복구 찬양',hymn_no:'359',praise_types:['hymn'],_relationalVersionsLoaded:true,versions:[version]};
              const service={id:'restore-service',type_id:'fixture',date:'2026-10-25'};
              state.songs=[song];state.services=[service];state.serviceTypes=[{id:'fixture',name:'검증 예배'}];
              state.client={};state.auth.session={user:{id:'offline'}};
              const images=[{url:'/assets/icon-192.png',formLabel:'V1'},{url:'/assets/icon-512.png',formLabel:'C'}];
              let count=0;
              const legacyAuto=shouldIncludeSongTitleSlide;
              shouldIncludeSongTitleSlide=()=>{throw Error('legacy automatic title path used');};
              for(const [label,key] of [['찬양 1','praise'],['파송찬양','sending'],['결단찬양','response_song'],['폐회찬송','closing_song']]) {
                for(const [name,preset,disabled,wanted] of [
                  ['legacy', {forms:['V1','C'],strength:'manual'},false,1],
                  ['no-preset',null,false,1],
                  ['legacy-cleared',null,true,1],
                  ['explicit', {forms:['Title','V1','C'],titleSequence:true,strength:'manual'},false,1],
                  ['title-only', {forms:['Title'],titleSequence:true,strength:'manual'},false,1],
                  ['explicit-repeated', {forms:['Title','V1','Title','C'],titleSequence:true,strength:'manual'},false,2],
                  ['omitted', {forms:['V1','C'],titleSequence:true,strength:'manual'},false,0],
                  ['explicit-cleared', {titleSequence:true},true,0],
                ]) {
                  const item={id:'restore-item',service_id:service.id,label,raw_title:song.title,song_id:song.id,version_id:version.id,
                    _worshipSectionKey:key,_worshipSectionTitle:label,_worshipElementTemplateModified:true,
                    memo:serializeServiceItemMemo({elementType:'praise',inputMode:'score_db',outputMode:'score',asset:{kind:'score',slides:images},formPreset:preset,formPresetDisabled:disabled})};
                  const before=JSON.stringify({item,song});
                  const slides=buildPresenterSlidesForServiceItem(item,service,0,{allowHydration:false});
                  const titles=slides.filter(s=>s.type==='song-title'||s.songTitle);
                  check(titles.length===wanted,label+' '+name+' title count '+JSON.stringify(slides.map(s=>({type:s.type,title:s.title,form:s.formLabel,songTitle:s.songTitle}))));
                  check(slides.filter(s=>s.type==='image').length===(name==='title-only'?0:2),label+' '+name+' score pages lost '+JSON.stringify(slides.map(s=>({type:s.type,src:s.imageSrc,title:s.title}))));
                  check(new Set(slides.map(s=>s.id)).size===slides.length,'duplicate IDs');
                  check(JSON.stringify({item,song})===before,'source changed');
                  if(wanted===1) {
                    check(renderPresenterSlideFrame(titles[0],{noChromakey:true}).includes('복구 찬양'),'fullscreen title lost');
                    check(renderPresenterSlideFrame(titles[0],{noChromakey:false}).includes('복구 찬양'),'keyed title lost');
                  }
                  count++;
                }
              }
              const base={id:'file-item',label:'찬양 1',raw_title:song.title,song_id:song.id,version_id:version.id};
              for(const asset of [{kind:'score',url:'https://example.invalid/score.pdf'}, {kind:'score',slides:images.map(({url})=>({url}))}]) {
                const item={...base,memo:serializeServiceItemMemo({elementType:'praise',inputMode:'score_db',outputMode:'score',formPreset:{forms:['V1','C'],strength:'manual'},asset})};
                const slides=buildPresenterSlidesForServiceItem(item,service,0,{allowHydration:false});
                check(slides.filter(s=>s.formLabel==='Title').length===1,'file/unlabelled title lost');
                check(slides.filter(s=>s.type!=='song-title').length===(asset.url?1:2),'file/unlabelled content lost');
                count++;
              }
              shouldIncludeSongTitleSlide=legacyAuto;
              return 'PASS '+count+' legacy/explicit score, PDF, unlabelled, fullscreen/keyed and immutable-source cases';
            }'''), flush=True)
            browser.close()
finally:
    server.shutdown()
