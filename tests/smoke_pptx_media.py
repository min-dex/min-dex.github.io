"""PPT embedded audio, main-sequence commands and output lifecycle; no DB writes."""
import os
os.environ["MINDEX_SMOKE_OFFLINE"] = "1"
from io import BytesIO
import copy
import wave
import zipfile
from urllib.parse import urlsplit
from lxml import etree as E
from smoke_pptx import fixture
from smoke_app import launch_chromium, start_local_app_server, sync_playwright

P = "http://schemas.openxmlformats.org/presentationml/2006/main"
A = "http://schemas.openxmlformats.org/drawingml/2006/main"
R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"

def media_fixture():
    audio = BytesIO()
    with wave.open(audio, "wb") as stream:
        stream.setnchannels(1); stream.setsampwidth(2); stream.setframerate(8000)
        stream.writeframes(bytes(8000 * 2 * 4))  # Silent PCM; test playback, not speaker volume.
    out = BytesIO()
    with zipfile.ZipFile(BytesIO(fixture())) as original, zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as target:
        poster = E.fromstring(original.read("ppt/slides/slide1.xml")).find(".//{%s}pic" % P)
        for name in original.namelist():
            data = original.read(name)
            if name in [f"ppt/slides/slide{i}.xml" for i in (1, 2, 3)]:
                page = int(name.split("slide")[-1].split(".")[0])
                xml = E.fromstring(data)
                for old in xml.findall("{%s}timing" % P): xml.remove(old)
                picture = copy.deepcopy(poster)
                picture.find(".//{%s}cNvPr" % P).set("id", "10")
                picture.find(".//{%s}blip" % A).set("{%s}embed" % R, "rIdPoster")
                nv = picture.find(".//{%s}nvPr" % P)
                E.SubElement(nv, "{%s}audioFile" % A, {"{%s}link" % R: "rIdAudio"})
                xml.find(".//{%s}spTree" % P).append(picture)
                effects = []
                commands = ["playFrom(0.0)", "pause", "play", "stop"] if page == 1 else ["playFrom(0.0)"]
                for index, command in enumerate(commands):
                    condition = '<p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond>' if page != 2 and index == 0 else '<p:cond delay="indefinite"/>'
                    delay = 700 if page == 3 else 0
                    effects.append(f'<p:par><p:cTn id="{10+index*4}" fill="hold"><p:stCondLst>{condition}</p:stCondLst><p:childTnLst><p:par><p:cTn id="{11+index*4}" presetID="1" presetClass="mediacall" nodeType="clickEffect"><p:stCondLst><p:cond delay="{delay}"/></p:stCondLst><p:childTnLst><p:cmd type="call" cmd="{command}"><p:cBhvr><p:cTn id="{12+index*4}" dur="1"/><p:tgtEl><p:spTgt spid="10"/></p:tgtEl></p:cBhvr></p:cmd></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par>')
                timing = f'<p:timing xmlns:p="{P}"><p:tnLst><p:par><p:cTn id="1" nodeType="tmRoot"><p:childTnLst><p:seq><p:cTn id="2" nodeType="mainSeq"><p:childTnLst>{"".join(effects)}</p:childTnLst></p:cTn></p:seq><p:audio><p:cMediaNode vol="25000"><p:cTn id="99" repeatCount="indefinite"><p:stCondLst><p:cond delay="indefinite"/></p:stCondLst></p:cTn><p:tgtEl><p:spTgt spid="10"/></p:tgtEl></p:cMediaNode></p:audio></p:childTnLst></p:cTn></p:par></p:tnLst></p:timing>'
                xml.append(E.fromstring(timing)); data = E.tostring(xml)
            elif name in [f"ppt/slides/_rels/slide{i}.xml.rels" for i in (1, 2, 3)]:
                xml = E.fromstring(data)
                for id_, type_, path in [("rIdAudio", "audio", "../media/test.wav"), ("rIdPoster", "image", "../media/image1.png")]:
                    E.SubElement(xml, "{%s}Relationship" % xml.nsmap[None], Id=id_, Type=R+"/"+type_, Target=path)
                data = E.tostring(xml)
            elif name == "[Content_Types].xml":
                xml = E.fromstring(data)
                E.SubElement(xml, "{%s}Default" % xml.nsmap[None], Extension="wav", ContentType="audio/wav")
                data = E.tostring(xml)
            target.writestr(name, data)
        target.writestr("ppt/media/test.wav", audio.getvalue())
    return out.getvalue()


def main():
    server, url = start_local_app_server()
    source = media_fixture()
    try:
        with sync_playwright() as p:
            for engine in ("chromium", "webkit"):
                browser = launch_chromium(p) if engine == "chromium" else p.webkit.launch()
                page = browser.new_page()
                page.route("**/*", lambda r: r.continue_() if urlsplit(r.request.url).hostname in ("localhost", "127.0.0.1") or r.request.url.startswith(("blob:", "data:")) else r.abort())
                page.route("**/media-fixture.pptx", lambda r: r.fulfill(body=source, content_type="application/octet-stream"))
                page.goto(url + "?output=presenter")
                page.wait_for_function("typeof state!=='undefined' && !!document.getElementById('presenterOutputRoot')")
                page.evaluate("""async () => {
                  window.check=(v,m)=>{if(!v)throw Error(m)};
                  window.source=new URL('/media-fixture.pptx',location.href).href;
                  window.entry=await loadPresenterPptx(source);
                  check(entry.value.deck.slides[0].animations[0].kind==='media','not a media command');
                  check(entry.value.deck.slides[0].animations[0].autoStart,'auto lost');
                  window.payload={serviceId:'media-test',index:0,slides:[0,1,2].map(page=>({id:'p'+page,type:'image',elementType:'image',layout:'media',pptx:{url:source,page,clicks:0}}))};
                  window.nativePlay=HTMLMediaElement.prototype.play;window.rejectPlay=true;
                  HTMLMediaElement.prototype.play=function(){return rejectPlay?Promise.reject(new DOMException('Test block','NotAllowedError')):nativePlay.call(this)};
                  renderPresenterOutput(payload);
                }""")
                page.wait_for_function("!!document.querySelector('.is-active [data-autoplay-blocked=true]')")
                page.evaluate("check(document.getElementById('presenterOutputRoot').dataset.pptxError.includes('스페이스'),'blocked not reported');rejectPlay=false")
                page.keyboard.press("Space")
                page.wait_for_function("document.querySelector('.is-active audio')?.currentTime>0.05 && !document.querySelector('.is-active audio').paused")
                page.evaluate("""() => {
                  window.audio=document.querySelector('.is-active audio');
                  check(audio.volume===0.25&&audio.loop&&!audio.controls,'media settings');
                  check(payload.slides[0].pptx.clicks===3,'legacy clicks not refreshed');
                  window.initialTime=audio.currentTime;renderPresenterOutput(payload);
                  check(document.querySelector('.is-active audio')===audio&&!audio.paused&&audio.currentTime>=initialTime,'duplicate replay');
                  payload=applyPresenterActionToPayload(payload,'next');renderPresenterOutput(payload);check(audio.paused,'pause command');
                  const button=document.createElement('button');button.textContent='Resume test';button.onclick=()=>{requestPresenterPptxMedia(payload,'play');renderPresenterOutput(payload)};button.style='position:fixed;top:0;z-index:999999';document.body.append(button);
                }""")
                page.get_by_role("button", name="Resume test").click()
                page.wait_for_function("!audio.paused && audio.currentTime>initialTime")
                page.evaluate("""() => {
                  requestPresenterPptxMedia(payload,'pause');renderPresenterOutput(payload);check(audio.paused,'manual pause');
                  payload=applyPresenterActionToPayload(payload,'next');renderPresenterOutput(payload);
                  payload=applyPresenterActionToPayload(payload,'next');renderPresenterOutput(payload);
                  check(audio.paused&&audio.currentTime===0,'stop command');
                  payload=applyPresenterActionToPayload(payload,'prev');renderPresenterOutput(payload);
                  check(audio.paused,'rewind leaked old sound');
                  window.rewound=document.querySelector('.is-active audio');check(rewound.paused,'rewind replayed audio');
                  renderPresenterOutput({...payload,safetyBlank:true});check(rewound.paused,'blackout leaked sound');
                  payload={...payload,index:2,pptxProgress:null};renderPresenterOutput(payload);
                }""")
                page.wait_for_function("document.getElementById('presenterOutputRoot')._pptxMetadata?.key===presenterPptxKey(payload.slides[2]) && !!document.querySelector('.is-active audio')")
                page.evaluate("window.delayed=document.querySelector('.is-active audio');renderPresenterOutput({...payload,safetyBlank:true})")
                page.wait_for_timeout(850)
                page.evaluate("""() => {
                  check(delayed.paused,'late timer played after blackout');
                  state.presenter.serviceId='media-test';state.presenter.slides=payload.slides;state.presenter.index=1;state.presenter.safetyBlank=false;
                  let published=0;publishPresenterState=()=>{published++};renderPresenterControlState=()=>{};
                  adoptPresenterPptxMetadata({serviceId:'wrong',key:presenterPptxKey(payload.slides[1]),clicks:99,mediaCount:9});check(!published,'foreign metadata');
                  adoptPresenterPptxMetadata({serviceId:'media-test',key:presenterPptxKey(payload.slides[1]),...presenterPptxPageMetadata(entry,1)});
                  check(state.presenter.slides[1].pptx.clicks===1&&published===1,'legacy controller refresh');
                  runPresenterAction('pptx-play','media-test');check(state.presenter.pptxProgress.mediaRequest.action==='play','play action');
                  check(normalizePresenterPayload(state.presenter).pptxProgress.mediaRequest.id===state.presenter.pptxProgress.mediaRequest.id,'transport lost command');
                  runPresenterAction('pptx-pause','media-test');check(state.presenter.pptxProgress.mediaRequest.action==='pause','pause action');
                  const prior=state.presenter.pptxProgress;state.presenter.safetyBlank=true;runPresenterAction('pptx-play','media-test');check(state.presenter.pptxProgress===prior,'blackout play accepted');
                }""")
                page.evaluate("""() => {
                  window.badSource=URL.createObjectURL(new Blob(['invalid audio'],{type:'audio/wav'}));
                  presenterPptxMediaElements(entry.value.deck.slides[1])[0].media.src=badSource;
                  payload={...payload,index:1,pptxProgress:null};renderPresenterOutput(payload);
                }""")
                page.wait_for_function("!!document.getElementById('presenterOutputRoot').dataset.pptxError && !document.getElementById('presenterOutputRoot').hasAttribute('aria-busy')")
                page.evaluate("check(document.getElementById('presenterOutputRoot').classList.contains('is-blackout'),'decode error replaced held frame');URL.revokeObjectURL(badSource)")
                print("PASS", engine, "embedded audio, auto/click, native playback, policy recovery, manual control, metadata, rewind, blackout/timer cleanup", flush=True)
                browser.close()
    finally:
        server.shutdown()

if __name__ == "__main__":
    main()
