"""Shared reference rules with offline chapter fixtures; never contacts production."""
import os
os.environ["MINDEX_SMOKE_OFFLINE"]="1"
from smoke_app import launch_chromium, start_local_app_server, sync_playwright
server, url = start_local_app_server()
try:
 with sync_playwright() as pw:
  for engine in ['chromium', 'webkit']:
   browser = launch_chromium(pw) if engine == 'chromium' else pw.webkit.launch(headless=True)
   page = browser.new_page()
   page.route('**/*supabase*/**', lambda r: r.abort())
   page.goto(url + '?output=presenter&mindexSmokeRaw=1')
   page.wait_for_function("typeof validateScriptureReferences==='function'")
   print(engine, page.evaluate('''async()=>{
    const check=(ok,msg)=>{if(!ok)throw Error(msg)};
    const fails=async(fn,part)=>{try{await fn()}catch(e){check(e.message.includes(part),e.message);return}throw Error('accepted '+part)};
    state.scriptureBooks=[{code:'JHN',koreanName:'요한복음',chapterCount:21},{code:'PSA',koreanName:'시편',chapterCount:150},{code:'PHP',koreanName:'빌립보서',chapterCount:4}];
    const translation={id:'test-krv',name:'개역한글',translationKey:'KRV',language:'ko'};
    state.bibleTranslations=[translation];state.client={};requireClient=()=>true;
    ensureBibleBookLookups=async()=>{};
    const fixtures={JHN:{3:36},PSA:{100:5},PHP:{1:30}};
    state.client={from(table){check(table==='mindex_bible_verses','unexpected write '+table);const filters={};const q={select(){return q},eq(k,v){filters[k]=v;return q},async order(){const n=fixtures[filters.book_code]?.[filters.chapter]||0;return {data:Array.from({length:n},(_,i)=>({book_code:filters.book_code,chapter:filters.chapter,verse:i+1,text:'fixture '+(i+1)}))}}};return q}};
    const inputs=['요3장16절','John 3:16','요 3.16','요 3:16'];
    for(const raw of inputs){check(normalizeSongScriptureRefs([raw])[0]==='요한복음 3:16','song '+raw);check(normalizeServiceItemReferenceSpacing(raw)==='요한복음 3:16','service '+raw);await validateScriptureReferences(raw)}
    const mixed='요 3:16, 18–20; 빌1:21';
    check(inspectScriptureReferences(mixed).references.join(';')==='요한복음 3:16;요한복음 3:18–20;빌립보서 1:21','context');
    for(const raw of ['요 3:16; 오류','요 3:20-16','요 99:1','요 3:0']){
      check(!inspectScriptureReferences(raw).valid,'invalid syntax '+raw);
      check(normalizeServiceItemReferenceSpacing(raw)===raw,'lost draft '+raw);
      check(normalizeServiceScriptureReferenceList(raw).length===0,'partial acceptance');
      await fails(()=>validateScriptureReferences(raw),'성구를 확인');
    }
    for(const [label,elementType] of [['성경봉독','scripture_reading'],['말씀본문','scripture_body'],['인용 구절','scripture_body']]){
      const item={label,raw_title:'요 3:16; 오류',memo:JSON.stringify({elementType})};
      check(serviceItemScriptureInputInvalid(item),'item '+label);
      await fails(()=>validateServiceItemScriptureInput(item),'오류');
      item.raw_title='요 3:16-99';await fails(()=>validateServiceItemScriptureInput(item),'성구를 확인');
      item.raw_title=mixed;const before=JSON.stringify(item);await validateServiceItemScriptureInput(item);check(JSON.stringify(item)===before,'validation mutated item');
    }
    await fails(()=>validateScriptureReferences('요 3:16-99'),'성구를 확인');
    await validateScriptureReferences('시 100');
    const live=await buildLiveScriptureSlide(mixed);check(live.text.includes('fixture 16')&&live.text.includes('fixture 21'),'live multi');
    await fails(()=>buildLiveScriptureSlide('요3:16; 오류'),'오류');
    await fails(()=>buildLiveScriptureSlide('요3:16-99'),'성구를 확인');
    let writes=0;const beforeClient=state.client;
    const song={id:'fixture',title:'fixture',memo:null,scripture:['요 3:16; 오류'],scripture_refs:[],versions:[],metadata:{}};
    state.songVersionTablesSupported=true;state.dirty.forms=false;saveSongRelationsIfAvailable=async()=>false;
    await fails(()=>saveSongMeta(song),'오류');check(song.scripture[0]==='요 3:16; 오류','song draft lost');
    let payload;state.client={from(table){if(table==='mindex_bible_verses')return beforeClient.from(table);check(table==='mindex_songs','unexpected write');const q={update(v){writes++;payload=v;return q},eq(){return q},is(){return q},select(){return q},async single(){return {data:{id:song.id,...payload}}}};return q}};
    song.scripture=[mixed];await saveSongMeta(song);check(writes===1&&song.scripture.length===3,'save/reopen');
    check(song.scripture[1]==='요한복음 3:18–20','normalized reopen');
    document.body.innerHTML=renderInput('성구','scripture','요3:16; 오류');
    check(document.querySelector('[data-scripture-validation-hint]').textContent.includes('오류'),'inline hint');
    // A network failure must not validate or write a new, uncached chapter.
    state.client={from(){return {select(){return this},eq(){return this},async order(){throw Error('offline')}}}};
    song.scripture=['요 4:1'];await fails(()=>saveSongMeta(song),'offline');check(writes===1,'wrote after failure');
    return 'PASS aliases, mixed invalid preservation, range endpoints, all entry points, save/reopen and offline guard';
   }'''), flush=True)
   browser.close()
finally:
 server.shutdown();server.server_close()
