import os
os.environ["MINDEX_SMOKE_OFFLINE"]="1"
"""Actual mode-select events and editor layout; all DB access blocked."""
import argparse
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--url')
    args = parser.parse_args()
    server, url = (None, args.url) if args.url else start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ['chromium', 'webkit']:
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                try:
                    page = browser.new_page(viewport={'width':1440,'height':1000})
                    page.route('**/*supabase*/**', lambda r:r.abort())
                    page.goto(url, wait_until='domcontentloaded')
                    page.wait_for_function("typeof state!=='undefined' && !document.body.classList.contains('ui-booting')")
                    page.evaluate('''()=>{
                      state.config={...state.config,authRequired:false};state.client={};state.connectionError='';state.loading=false;
                      state.serviceTypes=[{id:'wednesday',name:'수요예배',fixed_items:[]}];
                      state.services=[{id:'mode-ui',type_id:'wednesday',date:'2099-01-07'}];
                      state.serviceItems={'mode-ui':[]};
                      state.songs=[{id:'song',title:'테스트 찬송',hymn_no:1,_relationalVersionsLoaded:true,versions:[
                        {id:'arrangement',name:'편곡',_worshipVersionPersisted:true,praise_types:['ccm']},
                        {id:'hymnal',name:'새찬송가',_worshipVersionPersisted:true,praise_types:['hymn']}]}];
                      songCatalogLoaded=true;clearSearchCaches();state.module='service';state.selectedServiceId='mode-ui';
                      state.selectedServiceTypeId='wednesday';state.servicePrepEditorOpenId='mode-ui';state.loadedWorshipServiceIds.add('mode-ui');
                      const items=getServiceItems('mode-ui');
                      Object.assign(items[1],{song_id:'song',version_id:'hymnal',song_version_id:'hymnal',raw_title:'',
                        _worshipElementTemplateModified:true,_worshipTemplatePlaceholder:false,
                        memo:serializeServiceItemMemo({...parseServiceItemMemo(items[1].memo),inputMode:'lyrics_db',outputMode:'lyrics'})});
                      window.modeSaves=[];
                      saveCommittedServiceItem=(index,id)=>{const i=getServiceItems(id)[Number(index)];modeSaves.push({song:i.song_id,version:i.version_id,mode:servicePraiseInputMode(i)});};
                      render();
                    }''')
                    selector='.svc-prep-editor select[data-service-item-field="praise_input_mode"][data-service-item-index="1"]'
                    for width in [1440,1024,768]:
                        page.set_viewport_size({'width':width,'height':1000})
                        for mode in ['score_db','lyrics_db']:
                            page.locator('.svc-prep-editor input[data-service-item-field=raw_title][data-service-item-index="1"]').click()
                            count=page.evaluate('modeSaves.length')
                            page.locator(selector).select_option(mode)
                            page.wait_for_timeout(150)
                            assert page.evaluate('modeSaves.length')==count+1,(engine,width,mode,page.evaluate('modeSaves'))
                            assert page.locator(selector).input_value()==mode
                            assert page.locator('.svc-prep-editor input[data-service-item-field=raw_title][data-service-item-index="1"]').input_value()=='1 테스트 찬송'
                            assert page.evaluate("modeSaves.at(-1).version==='hymnal' && modeSaves.at(-1).song==='song'")
                            page.locator(selector).scroll_into_view_if_needed()
                            result=page.locator(selector).evaluate('''el=>{
                              const root=el.closest('.svc-edit-title-wrap');const box=root.getBoundingClientRect();
                              const controls=[...root.querySelectorAll('input:not([type=hidden]),select,button')].filter(n=>{const closed=n.closest('details:not([open])');return (!closed||closed.querySelector('summary')?.contains(n))&&n.getBoundingClientRect().width&&getComputedStyle(n).visibility!=='hidden'});
                              const errors=[];
                              for(const n of controls){const r=n.getBoundingClientRect();if(r.left<box.left-1||r.right>box.right+1)errors.push('overflow '+n.tagName);}
                              for(let i=0;i<controls.length;i++)for(let j=i+1;j<controls.length;j++){
                                const a=controls[i].getBoundingClientRect(),b=controls[j].getBoundingClientRect();
                                if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>2&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>2)errors.push('overlap');
                              }
                              return errors;
                            }''')
                            assert not result,(engine,width,mode,result)
                        page.screenshot(path=f'/tmp/mindex-mode-ui-{engine}-{width}.png')
                    print(engine,'PASS actual select events, one save/event, stable versions and layout at 1440/1024/768px',flush=True)
                finally:browser.close()
    finally:
        if server:server.shutdown()

if __name__=='__main__':main()
