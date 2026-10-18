"""Offline field-family rendering, section disclosure and keyboard/hover coverage."""
import os,sys
os.environ['MINDEX_SMOKE_OFFLINE']='1'
sys.path.insert(0,'tests')
from smoke_app import start_local_app_server,sync_playwright,launch_chromium
from urllib.parse import urlsplit
s,u=start_local_app_server()
try:
 with sync_playwright() as p:
  for engine in ['chromium','webkit']:
   b=launch_chromium(p) if engine=='chromium' else p.webkit.launch()
   page=b.new_page(viewport={'width':1300,'height':1500})
   page.route('**/*',lambda r:r.continue_() if urlsplit(r.request.url).netloc==urlsplit(u).netloc else r.abort())
   page.goto(u);page.wait_for_function("typeof renderFormBlock==='function'&&!document.body.classList.contains('ui-booting')")
   page.evaluate('''()=>{
const song={id:'fixture',title:'무엇보다도 뜨겁게',metadata:{artist:'찬양팀',composer:'작곡가'},scripture:[]};
const svc={id:'fixture',type_id:'fixture'};state.services=[svc];state.selectedServiceId=svc.id;
const items=[{id:'a',label:'설교',raw_title:'서로 사랑하라',assignee:'테스트 목사',_origIndex:0,memo:serializeServiceItemMemo({elementType:'title_person'})}];
const section=`<div class="presenter-section-editor"><div class="presenter-section-editor-body"><label class="presenter-section-editor-field"><span>섹션 이름</span><input value="말씀"></label><div class="presenter-section-editor-list">${items.map((it,i)=>renderPresenterSectionEditorItem(it,i,{service:svc,sectionItems:items})).join('')}</div><div class="presenter-section-editor-add"><select aria-label="새 엘리멘트 타입">${renderServiceElementTypeOptions('')}</select><input placeholder="새 엘리멘트 이름"><button class="reference-new-btn" type="button"><i data-lucide="plus"></i>추가</button></div></div></div>`;
const form={part_type:'Verse',part_number:1,part_variant:'A',lyrics:'사랑이 넘치는 교회\\n섬김을 원하는 교회'};state.forms=[form];
const field=(label,html)=>`<label class="field"><span>${label}</span>${html}</label>`;
const general='<div class="field-grid">'+field('제목','<input type="text" value="긴 제목도 편안하게 입력">')+field('선택','<select><option>기본 예배 순서</option></select>')+field('날짜','<input type="date" value="2026-10-18">')+field('월','<input type="month" value="2026-10">')+field('수치','<input type="number" value="80">')+field('이메일','<input type="email" placeholder="name@example.org">')+field('읽기 전용','<input readonly value="연결된 자료">')+field('사용 불가','<select disabled><option>선택 불가</option></select>')+field('확인 필요','<input class="is-invalid" aria-invalid="true" value="자료를 확인해 주세요">')+field('메모','<textarea rows="3">여러 줄은 높이를 유지합니다.\\n다음 줄</textarea>')+'</div>';
const native='<div class="field-grid">'+field('파일','<input type="file">')+field('슬라이더','<input type="range">')+'<label><input type="checkbox" checked> 자동 전환</label><label><input type="radio" checked> 기본</label></div>';
const editor=`<div class="svc-board-subgroup-controls"><div style="display:grid;grid-template-columns:1fr 1fr;gap:10px"><input type="text" class="svc-edit-title" value="찬양 제목"><select class="svc-song-version-select"><option>기본 버전</option></select><input type="text" class="svc-edit-assignee" value="찬양팀"><input type="text" class="svc-form-hint compact" value="V1-C-V2-C"></div></div>`;
const template='<details class="svc-template-guide" open><summary class="svc-template-head"><span>섹션 추가</span></summary><div class="svc-template-flow">'+['찬양','성경봉독','설교','봉헌','아주 긴 이름을 가진 예배 순서'].map(label=>renderServiceTemplateStep({label},0,'fixture')).join('')+'</div></details>';
const groups=[['기본 · 날짜 · 선택 · 상태',general],['찬양 정보',renderSongMetadataDialog(song)],['예배 편집',editor],['가사 블록',`<div class="praise-forms-panel">${renderFormBlock(form,0)}</div>`],['섹션 편집 · 항목 추가',section],['섹션 추가',template],['파일 · 체크 · 슬라이더',native]];
document.body.innerHTML='<style>body{display:block;overflow:auto;padding:20px}#audit{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;max-width:1240px;margin:auto}.audit-panel{background:var(--ui-surface-panel);padding:15px;border-radius:5px;min-width:0}.audit-panel h2{font-size:16px;margin:0 0 15px}.field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.field-grid input,.field-grid select{width:100%}.field-grid input[type=checkbox],.field-grid input[type=radio]{width:auto}.metadata-popover-layer,.metadata-popover,.presenter-section-editor{position:static!important;inset:auto!important;width:100%!important;max-width:100%!important;max-height:none!important;box-shadow:none!important;border:0!important}.metadata-popover{padding:0!important}.presenter-section-editor-body{padding:0!important}@media(max-width:760px){#audit{grid-template-columns:minmax(0,1fr)}.field-grid{grid-template-columns:minmax(0,1fr)}}</style><main id="audit">'+groups.map(([title,html])=>`<section class="audit-panel"><h2>${title}</h2>${html}</section>`).join('')+'</main>';
refreshIcons();resizeFormTextareas();
}''')
   for theme in ['dark','light']:
    page.evaluate('(v)=>document.body.dataset.theme=v',theme)
    for width in [1300,700]:
     page.set_viewport_size({'width':width,'height':1500})
     page.evaluate('resizeFormTextareas()')
     page.screenshot(path=f'/tmp/mindex-fields-{engine}-{theme}-{width}.png',full_page=True)
     print(engine,theme,width,page.evaluate('''()=>{
const visible=[...document.querySelectorAll('input,textarea,select')].filter(e=>e.getBoundingClientRect().width);
const overflow=visible.filter(e=>{const r=e.getBoundingClientRect(),p=e.closest('.audit-panel').getBoundingClientRect();return r.left<p.left||r.right>p.right}).map(e=>e.outerHTML);
if(overflow.length)throw Error('overflow '+overflow);
const heights=[...new Set(visible.filter(e=>e.tagName!=='TEXTAREA'&&!['checkbox','radio','range','file'].includes(e.type)).map(e=>getComputedStyle(e).height))];
if(heights.some(h=>!['30px','35px'].includes(h)))throw Error('inconsistent single-line height '+heights);
return heights;
}'''),flush=True)
    field=page.locator('input[type=text]').first
    field.focus();assert field.evaluate('e=>getComputedStyle(e).outlineWidth')=='2px'
    btn=page.locator('.svc-template-step').first
    page.mouse.move(0,0);before=btn.evaluate('e=>getComputedStyle(e).backgroundColor');btn.hover();page.wait_for_timeout(200);assert btn.evaluate('e=>getComputedStyle(e).backgroundColor')!=before
    page.locator('.svc-template-head').click();assert not page.locator('.svc-template-guide').evaluate('e=>e.open')
    page.locator('.svc-template-head').focus();page.keyboard.press('Enter');assert page.locator('.svc-template-guide').evaluate('e=>e.open')
   b.close()
finally:s.shutdown()
