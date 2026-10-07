"""Preview layout reads precede writes; overlapping fit requests run once."""
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                try:
                    page = browser.new_page()
                    page.route('**/*supabase*/**', lambda r: r.abort())
                    page.goto(url, wait_until='domcontentloaded')
                    page.wait_for_function("typeof schedulePresenterPreviewLayoutUpdate==='function'")
                    page.wait_for_timeout(300)
                    print(engine, page.evaluate('''async () => {
                      const check=(v,m)=>{if(!v)throw Error(m)};
                      const operations=[];
                      const values=Array.from({length:100},()=>0);
                      const canvases=values.map((_,i)=>({
                        closest:()=>({getBoundingClientRect:()=>{operations.push('read');return {width:320,height:180}}}),
                        style:{getPropertyValue:()=>values[i],setProperty:(_,v)=>{operations.push('write');values[i]=v}}
                      }));
                      applyPresenterPreviewScales({querySelectorAll:()=>canvases});
                      check(operations.join(',')===[...Array(100).fill('read'),...Array(100).fill('write')].join(','),'interleaved layout read/write');
                      operations.length=0;
                      applyPresenterPreviewScales({querySelectorAll:()=>canvases});
                      check(operations.every(x=>x==='read'),'unchanged scales rewritten');
                      const host=document.createElement('div'), child=document.createElement('div'), detached=document.createElement('div');
                      host.append(child);document.body.append(host);
                      const original=fitPresenterPreviewText,calls=[];
                      fitPresenterPreviewText=node=>calls.push(node);
                      try {
                        schedulePresenterPreviewLayoutUpdate(child);
                        schedulePresenterPreviewLayoutUpdate(host);
                        schedulePresenterPreviewLayoutUpdate(host);
                        schedulePresenterPreviewLayoutUpdate(detached);
                        await new Promise(requestAnimationFrame);
                        check(calls.length===1&&calls[0]===host,'overlapping hosts not coalesced');
                        schedulePresenterPreviewLayoutUpdate(child);
                        await new Promise(requestAnimationFrame);
                        check(calls.length===2&&calls[1]===child,'subsequent frame lost');
                      } finally {fitPresenterPreviewText=original;host.remove();}
                      state.client={};state.module='presenter';state.selectedServiceId='load-a';
                      state.services=[{id:'load-a',type_id:'special'},{id:'load-b',type_id:'special'}];
                      state.loadedWorshipServiceIds=new Set();state.worshipSections=[];state.worshipElements=[];state.serviceItems={};
                      state.dirty.service=false;
                      loadFullServiceSourceRefInBackground=()=>{};shouldDeferPastWorshipServiceLoad=()=>false;
                      projectWorshipServiceItemsFromTemplate=(_,items)=>items;
                      loadSongsForIds=async()=>{};loadSongsForIdsInBackground=()=>{};
                      captureCleanFingerprint=()=>{};renderLoadingStatus=()=>{};
                      warmWorshipScriptureReferencesForService=()=>{};warmServiceItemScriptureReferencesForService=()=>{};
                      let resolveRows,fullRenders=0;const patches=[];
                      fetchWorshipRowsForServiceIds=()=>new Promise(resolve=>resolveRows=resolve);
                      renderCurrentServiceModuleDetail=()=>fullRenders++;
                      renderPresenterControlState=id=>patches.push(id);
                      const first=loadServiceItems('load-a');resolveRows({sections:[],elements:[]});await first;
                      check(patches.join()==='load-a'&&fullRenders===0,'loaded presenter rebuilt instead of patched');
                      state.selectedServiceId='load-b';const second=loadServiceItems('load-b');
                      state.selectedServiceId='load-a';resolveRows({sections:[],elements:[]});await second;
                      check(patches.join()==='load-a'&&fullRenders===0,'late response redrew another service');
                      return 'PASS batched layout, deduplicated fit, patch-only hydration and late-response isolation';
                    }'''))
                finally:
                    browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
