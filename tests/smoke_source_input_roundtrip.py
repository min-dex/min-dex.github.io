"""Exercise source round trips with real app helpers; production requests are blocked."""
import os
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
            print(page.evaluate(r'''() => {
              const check=(value,message)=>{if(!value)throw Error(message)};
              const service={id:'offline-source-roundtrip',type_id:'custom',date:'2000-01-02'};
              state.services=[service];state.serviceItems[service.id]=[];
              const source=`[[QA]]
[성경봉독]
- 제목:
- 유형: scripture_body
- 입력: scripture
[담당]
- 제목:
- 유형: title_person
- 입력: text
- 담당: QA 담당
[QA 이미지]
- 제목: 검증 이미지
- 유형: image
- 입력: asset
- 파일: 검증 이미지
- 링크: assets/worship-templates/public-closing.png
[직접 찬양]
- 제목: 테스트
- 유형: praise
- 입력: manual_praise
- 가사: |
  테스트 가사
[슬라이드 본문]
- 제목: 본문
- 유형: title_content
- 입력: text
- 슬라이드: |
  첫 화면
  ---
  둘째 화면`;
              let records=parseServiceSourceText(source);
              ensurePortableSourceItems(service, records);
              for(let round=0;round<3;round++) {
                for(const record of records) {
                  const index=getServiceItems(service.id).findIndex(i=>i.label===record.label);
                  applyServiceSourceRecord(service.id,index,record);
                }
                const items=getServiceItems(service.id);
                const get=label=>items.find(i=>i.label===label), memo=label=>parseServiceItemMemo(get(label).memo);
                check(get('성경봉독').raw_title==='', 'blank scripture turned into label');
                check(serviceMemoInputMode(memo('성경봉독'))==='scripture', 'scripture became praise');
                check(serviceMemoInputMode(memo('담당'))==='text'&&get('담당').assignee==='QA 담당','person lost');
                check(serviceMemoInputMode(memo('QA 이미지'))==='asset'&&memo('QA 이미지').asset.url.endsWith('public-closing.png'),'image mode/url lost');
                check(serviceMemoElementType(memo('QA 이미지'))==='image','image type lost');
                check(memo('직접 찬양').slides[0]==='테스트 가사','manual lyrics lost');
                check(memo('슬라이드 본문').slides.length===2,'text slides lost');
                records=parseServiceSourceText(buildServiceSourceText(service,{items}));
                check(records.find(r=>r.label==='성경봉독').value==='','serializer leaked display fallback');
              }
              // Type changes must route values using the new mode, even with old asset metadata.
              let idx=getServiceItems(service.id).findIndex(i=>i.label==='담당');
              applyServiceSourceRecord(service.id,idx,{elementType:'image',inputMode:'asset',value:'새 이미지',hasAssetUrl:true,assetUrl:'new.png'});
              check(parseServiceItemMemo(getServiceItems(service.id)[idx].memo).asset.url==='new.png','text to asset failed');
              applyServiceSourceRecord(service.id,idx,{elementType:'title_person',inputMode:'text',value:'새 제목'});
              check(getServiceItems(service.id)[idx].raw_title==='새 제목','asset to text failed');
              return 'PASS 3 source round trips: blank scripture, person, image, manual lyrics, text slides and type changes';
            }'''))
            browser.close()
    finally:
        server.shutdown()
        server.server_close()

if __name__ == '__main__':
    main()
