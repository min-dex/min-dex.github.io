"""Cross-slide audio and OOXML playback conditions, isolated local fixtures."""
import os
os.environ['MINDEX_SMOKE_OFFLINE']='1'
from io import BytesIO
import zipfile
from urllib.parse import urlsplit
from lxml import etree as E
from smoke_pptx_media import media_fixture, P
from smoke_app import start_local_app_server, launch_chromium, sync_playwright


def conditions_fixture(repeat_duration=False):
    out=BytesIO()
    with zipfile.ZipFile(BytesIO(media_fixture())) as src, zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as dst:
        for name in src.namelist():
            data=src.read(name)
            if name in ['ppt/slides/slide1.xml','ppt/slides/slide2.xml','ppt/slides/slide3.xml']:
                xml=E.fromstring(data)
                if name.endswith('slide1.xml'):
                    media=xml.find('.//{%s}cMediaNode'%P);media.set('numSld','3')
                    main=xml.xpath('//*[@nodeType="mainSeq"]')[0].find('{%s}childTnLst'%P)
                    for child in list(main)[1:]:main.remove(child)
                elif name.endswith('slide2.xml'):
                    xml.remove(xml.find('{%s}timing'%P))
                    pic=xml.xpath('//*[local-name()="pic"][.//*[@id="10"]]')[0];pic.getparent().remove(pic)
                else:
                    media=xml.find('.//{%s}cMediaNode'%P)
                    timing=media.find('{%s}cTn'%P)
                    timing.attrib.pop('repeatCount',None)
                    timing.set('repeatDur' if repeat_duration else 'repeatCount','1100' if repeat_duration else '2000')
                    pic=xml.xpath('//*[local-name()="pic"][.//*[@id="10"]]')[0]
                    ext=E.SubElement(pic.find('.//{%s}nvPr'%P),'{%s}extLst'%P)
                    ext=E.SubElement(ext,'{%s}ext'%P,uri='test-media-trim')
                    ns='http://schemas.microsoft.com/office/powerpoint/2010/main'
                    E.SubElement(E.SubElement(ext,'{%s}media'%ns),'{%s}trim'%ns,st='250ms',end='3s')
                    for condition in xml.xpath('//*[@delay="700"]'):condition.set('delay','0')
                    main=xml.xpath('//*[@nodeType="mainSeq"]')[0].find('{%s}childTnLst'%P)
                    main.append(E.fromstring(f'''<p:par xmlns:p="{P}"><p:cTn id="200" presetClass="entr" presetID="1" nodeType="afterEffect"><p:stCondLst><p:cond evt="onEnd" delay="0"><p:tn val="99"/></p:cond></p:stCondLst><p:childTnLst><p:set><p:cBhvr><p:cTn id="201" dur="1"/><p:tgtEl><p:spTgt spid="2"/></p:tgtEl></p:cBhvr></p:set></p:childTnLst></p:cTn></p:par>'''))
                    root=xml.xpath('//*[@nodeType="tmRoot"]')[0].find('{%s}childTnLst'%P)
                    root.append(E.fromstring(f'''<p:seq xmlns:p="{P}"><p:cTn id="300" nodeType="interactiveSeq"><p:stCondLst><p:cond evt="onClick" delay="0"><p:tgtEl><p:spTgt spid="10"/></p:tgtEl></p:cond></p:stCondLst><p:childTnLst><p:par><p:cTn id="301" presetClass="mediacall" nodeType="clickEffect"><p:childTnLst><p:cmd cmd="togglePause"><p:cBhvr><p:cTn id="302" dur="1"/><p:tgtEl><p:spTgt spid="10"/></p:tgtEl></p:cBhvr></p:cmd></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:seq>'''))
                data=E.tostring(xml)
            dst.writestr(name,data)
    return out.getvalue()


def verify(page,url):
    page.goto(url+'?output=presenter')
    page.wait_for_function("typeof state!=='undefined' && !!document.getElementById('presenterOutputRoot')")
    page.evaluate('''async()=>{
      window.check=(v,m)=>{if(!v)throw Error(m)};
      window.entry=await loadPresenterPptx(new URL('/conditions.pptx',location.href).href);
      window.root=document.getElementById('presenterOutputRoot');
      window.p={serviceId:'conditions',index:0,slides:[0,1,2,3].map(page=>({id:'p'+page,elementId:'one-deck',type:'image',layout:'media',pptx:{url:new URL('/conditions.pptx',location.href).href,page,clicks:0}}))};
      window.go=index=>{p={...p,index,pptxProgress:null};renderPresenterOutput(p)};
      window.manual=action=>{requestPresenterPptxMedia(p,action);renderPresenterOutput(p)};
      const b=document.createElement('button');b.textContent='Resume';b.style='position:fixed;z-index:999999;top:0;right:0';b.onclick=()=>manual('play');document.body.append(b);
      const settings=entry.value.deck.slides[2].mediaSettings[0];
      check(settings.trimStart===.25&&settings.trimEnd===3&&settings.repeatCount===2,'OOXML trim/repeat');
      check(entry.value.deck.slides[2].interactiveAnimations.length===1,'interactive sequence missing');
      check(entry.value.deck.slides[2].animations.length===2&&entry.value.deck.slides[2].animations[1].waitForMedia===10,'end dependency missing/main clicks polluted');
      go(0);
    }''')
    page.wait_for_function("!!document.querySelector('.is-active audio')")
    page.get_by_role('button',name='Resume',exact=True).click()
    page.wait_for_function("document.querySelector('.is-active audio').currentTime>.1")
    page.evaluate("window.audio=document.querySelector('.is-active audio');window.t=audio.currentTime;go(1)")
    page.wait_for_function("root._pptxMetadata?.key===presenterPptxKey(p.slides[1])")
    page.wait_for_function("audio.currentTime>t+.1&&!audio.paused")
    page.evaluate('''()=>{
      check(root.querySelector('.presenter-pptx-audio-bank audio')===audio,'replaced carried player');
      check(root._pptxMetadata.mediaCount===1,'lost media controls on empty page');
      check(entry.refs>=2,'deck not pinned');
      renderPresenterOutput(p);check(!audio.paused,'duplicate stopped BGM');
      manual('pause');check(audio.paused,'background pause');
    }''')
    page.get_by_role('button',name='Resume',exact=True).click()
    page.wait_for_function('!audio.paused')
    page.evaluate('go(3);check(audio.paused,"range did not stop")')
    page.wait_for_function('root._pptxMetadata?.key===presenterPptxKey(p.slides[3])')
    page.evaluate('check(root._pptxBackground.size===0,"carried track leaked");go(0)')
    page.wait_for_function("!!document.querySelector('.is-active audio')")
    page.get_by_role('button',name='Resume',exact=True).click()
    page.evaluate("window.audio=document.querySelector('.is-active audio');go(1)")
    page.wait_for_function('root._pptxMetadata?.key===presenterPptxKey(p.slides[1])')
    page.evaluate('renderPresenterOutput({...p,safetyBlank:true});check(audio.paused&&root._pptxBackground.size===0,"blackout leaked BGM");go(2)')
    page.wait_for_function('root._pptxMetadata?.key===presenterPptxKey(p.slides[2])')
    page.evaluate("window.clip=document.querySelector('.is-active audio');check(clip.currentTime>=.25,'trim start');window.shape=document.querySelector('.is-active [data-el=\"2\"]');check(shape.style.visibility==='hidden'||shape.style.opacity==='0','end dependent shown early')")
    page.get_by_role('button',name='Resume',exact=True).click()
    page.wait_for_function('clip.currentTime>.3&&!clip.paused')
    page.evaluate("window.looped=false;clip.addEventListener('seeked',()=>{if(clip.currentTime<.3)looped=true})")
    page.locator('.is-active [data-el="10"]').click()
    page.evaluate('check(clip.paused,"object click pause")')
    page.locator('.is-active [data-el="10"]').click()
    page.wait_for_function('!clip.paused')
    page.wait_for_function("clip.paused&&shape.style.visibility!=='hidden'&&shape.style.opacity!=='0'",timeout=6000)
    page.evaluate('check(looped,"finite repeat missing");check(clip.currentTime>=.9&&clip.currentTime<1.15,"trim end/repeat boundary");renderPresenterOutput({...p,safetyBlank:true})')

    # A carried player must stop on reverse navigation, service change and a
    # live-scripture takeover, even while the new visual frame is preparing.
    for action in ("go(0)", "p.serviceId='other';go(1)", "renderPresenterOutput({...p,liveScripture:{active:true,slide:presenterSafetyBlankSlide()}})"):
        page.evaluate("go(3)")
        page.wait_for_function('root._pptxMetadata?.key===presenterPptxKey(p.slides[3])')
        page.evaluate("go(0)")
        page.wait_for_function("!!document.querySelector('.is-active audio')")
        page.get_by_role('button',name='Resume',exact=True).click()
        page.evaluate("window.carried=document.querySelector('.is-active audio');go(1)")
        page.wait_for_function('root._pptxMetadata?.key===presenterPptxKey(p.slides[1])')
        page.evaluate(action+";check(carried.paused,'navigation leaked background audio')")
    page.evaluate("renderPresenterOutput({...p,safetyBlank:true})")
    page.evaluate("""async()=>{
      const url=new URL('/duration.pptx',location.href).href;
      const e=await loadPresenterPptx(url);
      check(e.value.deck.slides[2].mediaSettings[0].repeatSeconds===1.1,'repeat duration parse');
      p.slides=p.slides.map(s=>({...s,pptx:{...s.pptx,url}}));go(2);
    }""")
    page.wait_for_function('root._pptxMetadata?.key===presenterPptxKey(p.slides[2])')
    page.get_by_role('button',name='Resume',exact=True).click()
    page.evaluate("window.durationAudio=document.querySelector('.is-active audio')")
    page.wait_for_function('durationAudio.paused&&durationAudio.currentTime>.5',timeout=6000)
    page.evaluate("check(durationAudio.currentTime<.75,'repeat duration ignored');renderPresenterOutput({...p,safetyBlank:true})")


def main():
    server,url=start_local_app_server();source=conditions_fixture();duration=conditions_fixture(True)
    try:
        with sync_playwright() as p:
            for engine in ('chromium','webkit'):
                browser=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
                page=browser.new_page(viewport={'width':1280,'height':720})
                page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).hostname in ('127.0.0.1','localhost') or r.request.url.startswith(('blob:','data:')) else r.abort())
                page.route('**/conditions.pptx',lambda r:r.fulfill(body=source,content_type='application/octet-stream'))
                page.route('**/duration.pptx',lambda r:r.fulfill(body=duration,content_type='application/octet-stream'))
                verify(page,url)
                print('PASS',engine,'cross-slide continuity, range, manual control, blackout, trim, repeat, interactive click, media-end effect',flush=True)
                browser.close()
    finally:server.shutdown()

if __name__=='__main__':main()
