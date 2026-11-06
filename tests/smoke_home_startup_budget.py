"""Edition metadata overlaps activation while the legacy count keeps its own timeout budget."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
server,url=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch();page=b.new_page();page.route('**/*supabase*/**',lambda r:r.abort());page.goto(url);page.wait_for_function("typeof state!=='undefined'&&!document.body.classList.contains('ui-booting')");page.clock.install()
   page.evaluate('''()=>{
    state.module='manuals';canUseClientData=()=>true;
    window.beforeStartupBudget=JSON.stringify([state.forms,state.presenter,state.serviceMusic,state.songs]);
    window.budgetRequests=[];window.budgetEditionError=false;
    state.client={from:table=>({select(){return this},eq(){return this},abortSignal(signal){
      budgetRequests.push({table,aborted:signal.aborted});
      if(signal.aborted||table==='mindex_bible_translations'&&budgetEditionError)return Promise.resolve({error:{message:'fixture read failed'}});
      return Promise.resolve(table==='mindex_songs'?{count:1141}:{data:[{id:'fixture',name:'개역개정',canonical_source:'source'}]});
    }})};
    state.singleSongCatalog=null;homeOverviewStats=null;
    ensureSingleSongActivation=()=>new Promise(resolve=>window.releaseBudgetActivation=resolve);
    window.budgetPending=loadHomeOverviewStats();
   }''')
   page.clock.fast_forward(16000)
   assert page.evaluate("budgetRequests.length===1&&budgetRequests[0].table==='mindex_bible_translations'&&!budgetRequests[0].aborted"),'edition metadata did not overlap activation'
   result=page.evaluate('''async()=>{releaseBudgetActivation();await budgetPending;
    if(budgetRequests.length!==2||budgetRequests[1].table!=='mindex_songs'||budgetRequests[1].aborted)throw Error('catalog consumed legacy count timeout');
    if(homeOverviewStats.songs!==1141||homeOverviewStats.editions!==1||homeOverviewStats.errors.songs||homeOverviewStats.errors.editions)throw Error('valid totals lost');
    if(JSON.stringify([state.forms,state.presenter,state.serviceMusic,state.songs])!==beforeStartupBudget)throw Error('startup summary mutated editor/playback');
    ensureSingleSongActivation=async()=>{throw Error('fixture activation failure')};
    homeOverviewStats=null;await loadHomeOverviewStats();
    if(!homeOverviewStats.errors.songs||homeOverviewStats.errors.editions||homeOverviewStats.editions!==1||budgetRequests.length!==3)throw Error('activation failure hid independent edition metadata');
    budgetEditionError=true;ensureSingleSongActivation=async()=>false;
    homeOverviewStats=null;await loadHomeOverviewStats();
    if(homeOverviewStats.errors.songs||!homeOverviewStats.errors.editions||homeOverviewStats.songs!==1141||budgetRequests.length!==5)throw Error('edition failure hid valid song count');
    ensureSingleSongActivation=()=>new Promise(resolve=>window.releaseBudgetActivation=resolve);
    homeOverviewStats=null;const pending=loadHomeOverviewStats();
    state.client={from(){throw Error('stale request used replacement client')}};
    releaseBudgetActivation();await pending;
    if(homeOverviewStats.songs!==null||homeOverviewStats.editions!==null||budgetRequests.length!==6)throw Error('changed client adopted totals or started a legacy count');
    return 'PASS edition overlap, independent legacy budget, both failure directions, client switch and editor/transport';}''')
   print(engine,result,flush=True);b.close()
finally:server.shutdown()
