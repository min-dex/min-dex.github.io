"""Bulletin visibility regardless of saved membership; no production requests, writes or printing."""
import os
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from urllib.parse import urlsplit
from smoke_app import start_local_app_server, sync_playwright, launch_chromium, prepare_server_state_fixture

server, url = start_local_app_server()
try:
    with sync_playwright() as p:
        for engine in ('chromium', 'webkit'):
            browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
            context = browser.new_context()
            context.route('**/*', lambda r: r.continue_() if r.request.method == 'GET' and urlsplit(r.request.url).netloc == urlsplit(url).netloc else r.abort())
            page = context.new_page()
            page.goto(url + '?mindexSmokeRaw=1')
            page.wait_for_function("!!window.MINDEX_CONTENT_LIVE&&!document.body.classList.contains('ui-booting')")
            prepare_server_state_fixture(page)
            page.evaluate('''() => {
                state.config.url='saved-bulletin-fixture';state.module='bulletin';state.search='';state.selectedServiceId='new';
                state.connectionError=null;state.serviceError='';
                state.serviceTypes=[{id:'young-adult',name:'청년부'},{id:'children',name:'어린이부'}];
                state.services=[{id:'old',date:'2026-09-27',type_id:'young-adult'},
                    {id:'new',date:'2026-11-01',type_id:'children'},
                    {id:'unsaved',date:'2026-11-08',type_id:'children'}];
                window.worshipBefore=JSON.stringify(state.services);
                window.savedIds=[];window.readFailure=false;window.saveFailure=false;window.indexReads=0;
                state.client={from(table){
                    if(table!=='mindex_bulletins')throw Error('Unexpected table read/write: '+table);
                    let patch=null;
                    const q={select(){return q},order(){return q},eq(){return q},update(v){patch=v;return q},insert(v){patch=v;return q},
                        async range(from,to){indexReads++;return readFailure?{data:null,error:{code:'42501',message:'private details'}}:{data:savedIds.slice(from,to+1).map(service_id=>({service_id})),error:null}},
                        async maybeSingle(){if(saveFailure)return {data:null,error:{code:'42501'}};
                            savedIds.push(patch.service_id);return {data:{...patch,revision:1},error:null}}};return q;
                }};
                rememberRecentEdit=()=>{};
                departmentRefreshBlocked=()=>false;hasDirtyChanges=()=>false;
                window.MINDEX_SERVICE_LIST_LIVE={refresh:async()=>true,reconcile(){},invalidate(){}};
                refs.detailPane.innerHTML='<input id="preserved-draft" value="미저장 주보 내용">';
                window.draftNode=document.getElementById('preserved-draft');
                renderBulletinList();
            }''')
            assert page.locator('[data-bulletin-open]').count() == 3
            assert page.evaluate('indexReads') == 0, 'visibility must not depend on saved index'
            page.evaluate("async()=>{savedIds=['old'];await savedBulletinList.load({force:true})}")
            assert page.locator('[data-bulletin-open=old]').count() == 1
            assert page.locator('[data-bulletin-open=new]').count() == 1
            assert page.evaluate("serviceSupportsBulletin(state.services[1])"), 'new documents can still be created from worship'
            # Actual save adapter adds only a successfully saved record to membership.
            page.evaluate('''async()=>{
                const publish=MINDEX_CONTENT_LIVE.publish;MINDEX_CONTENT_LIVE.publish=()=>{};
                try{await saveBulletinDraft('new',{content:{fields:{news:'저장할 소식'}},layout:{}},0)}finally{MINDEX_CONTENT_LIVE.publish=publish}
            }''')
            assert page.locator('[data-bulletin-open=new]').count() == 1
            page.evaluate('''async()=>{
                saveFailure=true;
                try{await saveBulletinDraft('unsaved',{content:{},layout:{}},0);throw Error('Save unexpectedly passed')}
                catch(error){if(!error.message.includes('권한'))throw error}finally{saveFailure=false}
            }''')
            assert page.locator('[data-bulletin-open=unsaved]').count() == 1
            # A different record's notification updates the list without an open controller.
            page.evaluate("()=>{savedIds=['new'];MINDEX_CONTENT_LIVE.receive({id:'remote-delete',project:state.config.url,kind:'bulletin',recordId:'old'})}")
            page.locator('[data-bulletin-open=old]').wait_for()
            # SQL changes without notifications are recovered by the existing reconciliation path.
            page.evaluate("async()=>{savedIds=['old','new'];await MINDEX_CONTENT_LIVE.reconcile()}")
            page.locator('[data-bulletin-open=old]').wait_for()
            # Saved-index failure cannot hide worship-derived bulletins.
            page.evaluate("async()=>{readFailure=true;await savedBulletinList.load({force:true});renderBulletinList()}")
            assert page.locator('[data-bulletin-open]').count() == 3
            assert not page.get_by_text('주보 목록을 불러오지 못했습니다', exact=True).is_visible()
            # The search still filters all supported worship dates, including historical dates.
            page.evaluate("()=>{state.search='2026-09';renderBulletinList()}")
            assert page.locator('[data-bulletin-open]').count() == 1
            assert page.locator('[data-bulletin-open=old]').count() == 1
            assert page.evaluate("JSON.stringify(state.services)===worshipBefore&&document.getElementById('preserved-draft')===draftNode&&draftNode.value==='미저장 주보 내용'"), 'worship records or open draft replaced'
            # Late supplemental worship hydration must keep the saved-bulletin sidebar.
            page.evaluate("""async()=>{
                const previous=[fetchCachedSupabasePaged,loadCalendarData,ensureUpcomingPublicWorshipServices];
                fetchCachedSupabasePaged=async()=>[];loadCalendarData=async()=>{};ensureUpcomingPublicWorshipServices=async()=>[];
                try{await hydrateSupplementalWorshipDataAfterInitialRender()}
                finally{[fetchCachedSupabasePaged,loadCalendarData,ensureUpcomingPublicWorshipServices]=previous}
            }""")
            assert page.locator('[data-bulletin-open=old]').count() == 1, 'late hydration replaced saved bulletin list with worship list'
            assert page.evaluate('JSON.stringify(state.services)===worshipBefore')
            print('PASS bulletin visibility: unsaved November, saved/failed saves, remote changes, index failure, search and worship/draft preservation', engine)
            browser.close()
finally:
    server.shutdown()
