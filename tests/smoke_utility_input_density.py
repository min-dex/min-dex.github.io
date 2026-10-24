"""Offline real-renderer geometry for compact metadata/reference inputs."""
import os
os.environ['MINDEX_SMOKE_OFFLINE'] = '1'
from smoke_app import launch_chromium, start_local_app_server, sync_playwright


def main():
    server, url = start_local_app_server()
    try:
        with sync_playwright() as p:
            for engine in ('chromium', 'webkit'):
                browser = launch_chromium(p) if engine == 'chromium' else p.webkit.launch()
                page = browser.new_page(viewport={'width': 1200, 'height': 900})
                page.route('**/*', lambda r: r.continue_() if r.request.url.startswith(url.rsplit('/', 1)[0] + '/') and r.request.method == 'GET' else r.abort())
                page.goto(url)
                page.wait_for_function("typeof renderSongMetadataDialog==='function' && !document.body.classList.contains('ui-booting')")
                for theme in ('light', 'dark'):
                    for width in (300, 360, 500, 560, 720):
                        result = page.evaluate('''({width, theme}) => {
                          document.body.dataset.theme=theme;
                          state.referenceGroupSupported=true;
                          state.forms=[];
                          const host=document.getElementById('density-fixture') || document.body.appendChild(Object.assign(document.createElement('main'),{id:'density-fixture'}));
                          host.style.cssText='position:fixed;inset:60px auto auto 20px;z-index:99;width:'+width+'px';
                          host.innerHTML=renderReferenceEditorRow({id:'fixture',title:'긴 참고자료 제목',url:'https://example.test/long/path',group_name:'예배 준비'})+renderSongMetadataDialog({id:'fixture',title:'제목',metadata:{},scripture:[]});
                          const pop=host.querySelector('.metadata-popover');
                          pop.style.cssText='position:static;box-sizing:border-box;width:100%;max-height:none';
                          host.querySelector('.metadata-popover-layer').style.cssText='position:static';
                          const errors=[];
                          for(const selector of ['.reference-editor-main','.metadata-popover-grid']) {
                            const group=host.querySelector(selector), bounds=group.getBoundingClientRect();
                            const inputs=[...group.querySelectorAll('input,select')].filter(n=>n.getBoundingClientRect().width);
                            const boxes=inputs.map(n=>n.getBoundingClientRect());
                            for(const b of boxes) if(b.left<bounds.left-1 || b.right>bounds.right+1 || b.width<90)errors.push(selector+' bounds');
                            for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(Math.min(boxes[i].right,boxes[j].right)>Math.max(boxes[i].left,boxes[j].left)+1 && Math.min(boxes[i].bottom,boxes[j].bottom)>Math.max(boxes[i].top,boxes[j].top)+1)errors.push(selector+' overlap');
                            const expected=selector.includes('reference')?(bounds.width>=680?3:bounds.width>=440?2:1):(bounds.width>=520?3:bounds.width>=340?2:1);
                            const firstRow=boxes.filter(b=>Math.abs(b.top-boxes[0].top)<2).length;
                            if(firstRow!==expected)errors.push(selector+' expected '+expected+' got '+firstRow);
                          }
                          return errors;
                        }''', {'width': width, 'theme': theme})
                        assert not result, (engine, theme, width, result)
                        if width in (360, 560, 720):
                            page.locator('#density-fixture').screenshot(path=f'/tmp/utility-density-{engine}-{theme}-{width}.png')
                page.evaluate("document.getElementById('density-fixture').remove();renderWorshipBackgroundsDetail()")
                for width in (300, 420, 600, 720):
                    result = page.locator('.background-manager').evaluate("""(manager,width) => {
                      manager.style.width=width+'px';
                      const group=manager.querySelector('.background-toolbar'),g=group.getBoundingClientRect();
                      const boxes=[...group.querySelectorAll('input,select,button')].map(n=>n.getBoundingClientRect());
                      const errors=[];
                      for(const b of boxes)if(b.left<g.left-1||b.right>g.right+1)errors.push('background overflow');
                      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)if(Math.min(boxes[i].right,boxes[j].right)>Math.max(boxes[i].left,boxes[j].left)+1&&Math.min(boxes[i].bottom,boxes[j].bottom)>Math.max(boxes[i].top,boxes[j].top)+1)errors.push('background overlap');
                      if(width>=720&&boxes.some(b=>Math.abs(b.top-boxes[0].top)>1))errors.push('background unnecessary row');
                      return errors;
                    }""", width)
                    assert not result, (engine, width, result)
                print('PASS', engine, 'metadata/reference/background columns, containment, overlap; both themes and narrow widths')
                browser.close()
    finally:
        server.shutdown()


if __name__ == '__main__':
    main()
