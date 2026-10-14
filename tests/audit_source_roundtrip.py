"""Read-only offline audit: run real source helpers on disposable in-memory fixtures."""
import json
import os
from pathlib import Path
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            browser = launch_chromium(p)
            page = browser.new_page()
            page.route('**/*supabase*/**', lambda route: route.abort())
            page.goto(url)
            page.wait_for_function("typeof applyServiceSourceRecord === 'function'")
            results = page.evaluate(r'''() => {
              const service={id:'offline-source-audit',type_id:'custom',date:'2000-01-04'};
              state.services=[service];
              const song={id:'qa-song',title:'QA 연결 곡',versions:[{id:'qa-v1',name:'원본',_worshipVersionPersisted:true},{id:'qa-v2',name:'편곡',_worshipVersionPersisted:true}]};
              const forms='V1-C-V2-C-Coda';
              const cases=[
                {name:'linked_song_selected_version',item:{song_id:'qa-song',version_id:'qa-v2',song_version_id:'qa-v2',raw_title:''},memo:{elementType:'praise',inputMode:'lyrics_db',outputMode:'lyrics',formHint:forms}},
                {name:'unloaded_song_catalog',songs:[],item:{song_id:'qa-song',version_id:'qa-v2',song_version_id:'qa-v2',raw_title:''},memo:{elementType:'praise',inputMode:'lyrics_db',formHint:forms}},
                {name:'unloaded_version_catalog',songs:[{...song,versions:[]}],item:{song_id:'qa-song',version_id:'qa-v2',song_version_id:'qa-v2',raw_title:''},memo:{elementType:'praise',inputMode:'lyrics_db',formHint:forms}},
                {name:'score_mode',item:{song_id:'qa-song',version_id:'qa-v2',song_version_id:'qa-v2',raw_title:''},memo:{elementType:'praise',inputMode:'score_db',outputMode:'score',formHint:'1-3'}},
                {name:'manual_lyrics_v_c_coda',item:{raw_title:'QA 직접 가사'},memo:{elementType:'praise',inputMode:'manual_praise',outputMode:'lyrics',formHint:forms,slides:['[V1]\nQA 절 첫줄\nQA 절 둘째줄','[C]\nQA 후렴','[Coda]\nQA 마침']}},
                {name:'manual_lyrics_internal_blank',item:{raw_title:'QA 가사 빈줄'},memo:{elementType:'praise',inputMode:'manual_praise',outputMode:'lyrics',slides:['QA 첫줄\n\nQA 같은 화면','QA 다음 화면']}},
                {name:'form_clear',clearForm:true,item:{raw_title:'QA 송폼 삭제'},memo:{elementType:'praise',inputMode:'manual_praise',outputMode:'lyrics',slides:['QA'],formHint:forms}},
                {name:'lyrics_clear',clearLyrics:true,item:{raw_title:'QA 가사 삭제'},memo:{elementType:'praise',inputMode:'manual_praise',outputMode:'lyrics',slides:['QA 가사']}},
                {name:'form_disabled',item:{raw_title:'QA 직접 가사'},memo:{elementType:'praise',inputMode:'manual_praise',outputMode:'lyrics',slides:['QA'],formHint:'',formPresetDisabled:true}},
                {name:'announcement_multiline_bold',item:{label:'광고',_worshipSectionKey:'announcements',raw_title:'**QA 환영**\n\n1. **QA 수료식**\n   오후 2시\n\n2. QA 안내'},memo:{elementType:'body',inputMode:'text'}},
                {name:'announcement_regions',item:{label:'광고',_worshipSectionKey:'announcements',raw_title:'**QA 환영**\n\n1. **QA 소식**\nQA 상세\n\n**QA 마침**'},memo:{elementType:'body',inputMode:'text',slides:['**QA 환영**\n\n1. **QA 소식**\nQA 상세\n\n**QA 마침**'],announcementRegions:{welcome:'**QA 환영**',news:'1. **QA 소식**\nQA 상세',footer:'**QA 마침**'}}},
                {name:'literal_title_block',item:{label:'안내',raw_title:'|\n[[구역처럼 보이는 본문]]\n[항목처럼 보이는 본문]\n- 제목: 실제 본문'},memo:{elementType:'plain_text',inputMode:'text'}},
                {name:'lyrics_literal_separator',item:{raw_title:'QA 구분자'},memo:{elementType:'praise',inputMode:'manual_praise',outputMode:'lyrics',slides:['첫줄\n---\n마지막줄','다음 화면']}},
                {name:'plain_text_multiline',item:{label:'안내',raw_title:'QA 첫줄\nQA 둘째줄'},memo:{elementType:'plain_text',inputMode:'text'}},
                {name:'audio_name_and_url',item:{raw_title:'QA 가사'},memo:{elementType:'praise',inputMode:'manual_praise',outputMode:'lyrics',slides:['QA'],audioAsset:{name:'QA.mp3',url:'https://example.com/qa.mp3'}}},
                {name:'audio_url_only',item:{raw_title:'QA 가사'},memo:{elementType:'praise',inputMode:'manual_praise',outputMode:'lyrics',slides:['QA'],audioAsset:{url:'https://example.com/qa.mp3'}}},
                {name:'text_slides',item:{label:'안내',raw_title:'QA 안내'},memo:{elementType:'title_content',inputMode:'text',slides:['QA 첫 화면','QA 둘째 화면']}},
              ];
              function snapshot(item){const m=parseServiceItemMemo(item.memo);return {title:item.raw_title||'',songId:item.song_id||null,versionId:item.version_id||item.song_version_id||null,type:serviceMemoElementType(m),mode:serviceMemoInputMode(m,item),output:m.outputMode,form:m.formHint,formDisabled:m.formPresetDisabled,slides:m.slides,audio:m.audioAsset,regions:m.announcementRegions,visibleRegions:isAnnouncementTextInputItem(item)?serviceAnnouncementRegions(item,m):null};}
              const results=[];
              for(const c of cases){
                state.songs=c.songs||[song];state.songLookupSource=null;
                const item=normalizeServiceItem({id:'qa-item',service_id:service.id,label:'찬양 1',sort_order:1,_worshipSectionTitle:'QA',_worshipSectionKey:'qa',...c.item,memo:serializeServiceItemMemo(c.memo)},0);
                state.serviceItems[service.id]=[item];
                const before=snapshot(item);const expected=JSON.parse(JSON.stringify(before));
                if(c.clearForm){expected.form='';expected.formDisabled=true;}
                if(c.clearLyrics)expected.slides=[];
                const rounds=[];
                for(let i=0;i<3;i++){
                  const current=getServiceItems(service.id)[0];
                  let source=buildServiceSourceText(service,{items:[current]});
                  if(c.clearForm)source=source.replace(/^- 송폼:.*$/m,'- 송폼: ');
                  if(c.clearLyrics)source=source.replace(/- 가사(?: 화면)?: \|[\s\S]*$/,'- 가사 화면: ');
                  const records=parseServiceSourceText(source);
                  if(records.length!==1){rounds.push({error:'record_count',count:records.length,source});break;}
                  applyServiceSourceRecord(service.id,0,records[0]);
                  const after=snapshot(getServiceItems(service.id)[0]);
                  const changed=Object.keys(before).filter(k=>JSON.stringify(expected[k])!==JSON.stringify(after[k]));
                  rounds.push({changed,after,source});
                }
                results.push({name:c.name,before,expected,rounds,pass:rounds.length===3&&rounds.every(r=>r.changed?.length===0)});
              }
              // Rebuild a new item from explicit regions, then edit only its news block.
              state.serviceItems[service.id]=[];
              let source=`[[QA 광고]]\n[QA 광고]\n- 유형: body\n- 입력: text\n- 환영 문구: **환영**\n- 주간 소식: |\n  1. 첫 소식\n  상세\n- 하단 안내: **마침**`;
              let records=parseServiceSourceText(source);
              ensurePortableSourceItems(service,records);
              applyServiceSourceRecord(service.id,0,records[0]);
              let ad=getServiceItems(service.id)[0], regions=parseServiceItemMemo(ad.memo).announcementRegions;
              if(!serviceSourceItemIsUserDiscretionary(ad,service))throw Error('portable body filtered out');
              if(regions.welcome!=='**환영**'||regions.news!=='1. 첫 소식\n상세'||regions.footer!=='**마침**')throw Error('new announcement regions lost');
              source=buildServiceSourceText(service,{items:[ad]}).replace('첫 소식','바뀐 소식');
              applyServiceSourceRecord(service.id,0,parseServiceSourceText(source)[0]);
              ad=getServiceItems(service.id)[0];regions=parseServiceItemMemo(ad.memo).announcementRegions;
              if(regions.news!=='1. 바뀐 소식\n상세'||regions.welcome!=='**환영**'||!ad.raw_title.includes('바뀐 소식')||ad.raw_title.includes('첫 소식'))throw Error('announcement edit stale');
              // Exercise the full Apply path, including its candidate filter.
              const originalTextarea=serviceSourceTextareaForService;
              const textarea={value:source,dataset:{}};
              serviceSourceTextareaForService=()=>textarea;
              try {
                state.serviceItems[service.id]=[];
                if(!applyServiceSourceText(service.id,{silent:true,renderAfterApply:false,refreshPresenter:false}))throw Error('full apply failed');
                const created=getServiceItems(service.id).find(i=>i.label==='QA 광고');
                if(!created||!parseServiceItemMemo(created.memo).announcementRegions?.news.includes('바뀐 소식'))throw Error('full apply omitted body');
                if(!buildServiceSourceText(service,{items:getServiceItems(service.id)}).includes('바뀐 소식'))throw Error('full export omitted body');
              } finally {serviceSourceTextareaForService=originalTextarea;}
              return results;
            }''')
            out=Path(__file__).resolve().parents[1]/'docs/source-input-audit-20261015.json'
            out.write_text(json.dumps(results,ensure_ascii=False,indent=2))
            for r in results:
                print(('PASS' if r['pass'] else 'CHANGED'),r['name'],r['rounds'][0].get('changed',r['rounds'][0].get('error')))
            if os.environ.get('MINDEX_SOURCE_AUDIT_STRICT') == '1':
                assert all(r['pass'] for r in results), 'Source round-trip regression'
            browser.close()
    finally:
        server.shutdown();server.server_close()

if __name__ == '__main__':main()
