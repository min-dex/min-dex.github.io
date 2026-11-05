"""A slow catalog must not consume the home summary's network timeout budget."""
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
    window.budgetRequests=[];
    state.client={from:table=>({select(){return this},eq(){return this},abortSignal(signal){
      budgetRequests.push({table,aborted:signal.aborted});
      return Promise.resolve(signal.aborted?{error:{message:'aborted'}}:{data:[{id:'fixture',name:'개역개정',canonical_source:'source'}]});
    }})};
    state.singleSongCatalog={displayCount:()=>1141};homeOverviewStats=null;
    ensureSingleSongActivation=()=>new Promise(resolve=>window.releaseBudgetActivation=resolve);
    window.budgetPending=loadHomeOverviewStats();
   }''')
   page.clock.fast_forward(16000)
   assert page.evaluate('budgetRequests.length===0'),'summary read started before ID activation'
   result=page.evaluate('''async()=>{releaseBudgetActivation();await budgetPending;
    if(budgetRequests.length!==1||budgetRequests[0].aborted)throw Error('catalog consumed summary timeout');
    if(homeOverviewStats.songs!==1141||homeOverviewStats.editions!==1||homeOverviewStats.errors.songs||homeOverviewStats.errors.editions)throw Error('valid totals lost');
    if(JSON.stringify([state.forms,state.presenter,state.serviceMusic,state.songs])!==beforeStartupBudget)throw Error('startup summary mutated editor/playback');
    return 'PASS 16s activation delay retains full summary request budget, logical count and editor/transport';}''')
   print(engine,result,flush=True);b.close()
finally:server.shutdown()
