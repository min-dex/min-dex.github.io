"""Populated inherited closing hymn remains in output. Offline; no saved data writes."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch(headless=True)
                page = browser.new_page()
                page.route('**/*', lambda r: r.abort() if '.supabase.co/' in r.request.url or r.request.method not in ('GET', 'HEAD', 'OPTIONS') else r.continue_())
                page.goto(url + '?output=presenter', wait_until='domcontentloaded')
                page.wait_for_function("typeof buildPresenterSlidesForServiceItem === 'function'")
                print(engine, page.evaluate(r'''() => {
                  const assert=(v,m)=>{if(!v)throw Error(m)};
                  const service={id:'test-service',type_id:'sunday-main',date:'2026-07-19',alias:'온세대 찬양예배'};
                  const version={id:'test-version',name:'새찬송가',praise_types:['hymn'],forms:normalizeForms([
                    {id:'v1',part_type:'Verse',part_number:1,label:'Verse 1',lyrics:'첫 줄\n\n다음 줄'},
                    {id:'v2',part_type:'Verse',part_number:2,label:'Verse 2',lyrics:'둘째 절'},
                    {id:'v4',part_type:'Verse',part_number:4,label:'Verse 4',lyrics:'넷째 절'}])};
                  const song={id:'test-song',title:'테스트 찬송',hymn_no:'352',praise_types:['hymn'],versions:[version]};
                  const item=normalizeServiceItem({id:'closing',service_id:service.id,label:'폐회찬송',raw_title:'',song_id:song.id,version_id:version.id,
                    _worshipSectionKey:'closing_visual',_worshipSectionTitle:'폐회',_worshipSectionOrder:11,_worshipElementOrder:2,
                    _worshipSectionTemplateModified:false,_worshipElementTemplateModified:false,
                    memo:serializeServiceItemMemo({elementType:'praise',inputMode:'lyrics_db',formHint:'V1A-Int-V1-V2-Int-V4-V1B',formPreset:{forms:['V1A','Int','V1','V2','Int','V4','V1B'],strength:'default'}})});
                  state.services=[service];state.songs=[song];state.serviceItems={[service.id]:[item]};
                  const before=JSON.stringify(item);
                  for(let n=0;n<2;n++){
                    const projected=getServiceOutputItems(service.id);
                    const found=projected.find(i=>i.id===item.id);
                    assert(found,'populated closing hymn omitted');
                    assert(found.song_id===item.song_id&&found.version_id===item.version_id,'identity changed');
                    assert(serviceItemFormPreset(found).forms.join('-')==='V1A-Int-V1-V2-Int-V4-V1B','saved form changed');
                    const slides=buildPresenterSlidesForServiceItem(found,service,0,{allowHydration:false});
                    assert(slides.filter(s=>s.type==='lyrics').map(s=>s.text).join('|')==='첫 줄|첫 줄|다음 줄|둘째 절|넷째 절|다음 줄','segment/repeat order changed '+JSON.stringify(slides.map(s=>({type:s.type,text:s.text,formKey:s.formKey}))));
                    assert(slides.filter(s=>s.type==='blank').length===2,'interludes lost');
                  }
                  assert(JSON.stringify(item)===before,'source mutated');
                  const empty={...item,song_id:null,version_id:null};
                  assert(shouldDropAllGenerationsRegularThirdProjectionExtra(service,empty),'empty inherited slot retained');
                  assert(!projectWorshipServiceItemsFromTemplate(service,[empty]).some(i=>i.id===item.id),'empty output retained');
                  for(const patch of [{version_id:'catalog-unavailable'},{raw_title:'저장된 제목'},{memo:serializeServiceItemMemo({elementType:'praise',audioAsset:{url:'https://example.invalid/test.mp3',type:'audio'}})},{memo:serializeServiceItemMemo({elementType:'praise',inputMode:'manual_praise',slides:['직접 입력 가사']})}]){
                    const filled={...empty,...patch};
                    assert(projectWorshipServiceItemsFromTemplate(service,[filled]).some(i=>i.id===item.id),'saved content removed');
                  }
                  const image=normalizeServiceItem({id:'closing-image',service_id:service.id,label:'마무리',_worshipSectionKey:'closing_visual',_worshipElementOrder:1,memo:serializeServiceItemMemo({elementType:'image',asset:{url:'https://example.invalid/image.png',type:'image'}})});
                  const praise=[1,2].map(n=>normalizeServiceItem({...item,id:'praise-'+n,label:'찬양 '+n,_worshipSectionKey:'praise',_worshipSlotKey:'praise.song.'+n,_worshipElementOrder:n,_worshipElementTemplateModified:true,memo:serializeServiceItemMemo({...parseServiceItemMemo(item.memo),connectedPraise:n===2})}));
                  const sources=[...praise,image,item];const original=JSON.stringify(sources);
                  const projected=projectWorshipServiceItemsFromTemplate(service,sources);
                  assert(projected.find(i=>i.id===image.id)?.label==='마무리','closing image replaced');
                  assert(projected.filter(i=>sources.some(s=>s.id===i.id)).map(i=>i.id).join(',')===sources.map(i=>i.id).join(','),'saved sibling order changed');
                  for(const sibling of praise)assert(projected.find(i=>i.id===sibling.id)?.memo===sibling.memo,'medley/form metadata changed');
                  assert(JSON.stringify(sources)===original,'siblings mutated');
                  const hidden={...item,memo:serializeServiceItemMemo({...parseServiceItemMemo(item.memo),templateSuppressed:true})};
                  state.serviceItems[service.id]=[hidden];
                  assert(!getServiceOutputItems(service.id).some(i=>i.id===item.id),'explicit suppression ignored');
                  return 'PASS populated/empty/suppressed, saved segment order and interludes, immutable source';
                }'''), flush=True)
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
