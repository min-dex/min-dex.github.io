const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const context = vm.createContext({
  parseServiceItemMemo: value => value || {},
  serviceSourceItemValue: item => item.raw_title || '',
  serviceMemoElementType: memo => memo.elementType || '',
  serviceMemoInputMode: memo => memo.inputMode || '',
  normalizeServiceOutputMode: value => value || '',
  serviceItemLinkedSong: item => item.song || null,
  serviceItemEditableAssigneeValue: item => item.assignee || '',
  serviceBibleTranslationById: id => id === 'kr' ? {label:'개역개정'} : null,
  serviceBibleTranslationDisplayLabel: value => value.label,
  isPresenterPreparationSermonTitleItem: item => item.sermon === true,
  serviceScriptureReadingReferencesForService: service => service.references || [],
  formatServiceScriptureReferenceList: values => values.join('; '),
  servicePraiseInputMode: (item, memo) => memo.inputMode,
  formatServiceManualPraiseLyricsInput: memo => (memo.slides || []).join('\n\n'),
  formatServiceManualScriptureInput: value => value?.text || '',
  normalizeServiceManualScripture: value => value || null,
  normalizeServiceAsset: value => value || {},
  normalizeServiceAudioAsset: value => value || {},
});
vm.runInContext(fs.readFileSync(path.join(root, 'mindex.worship-source.js'), 'utf8'), context);
const start = app.indexOf('function serviceSourceItemLines(');
assert.ok(start >= 0);
vm.runInContext(app.slice(start, app.indexOf('\n}\n', start) + 2), context);
const render = (item, service = {}) => context.serviceSourceItemLines(item, service).join('\n');
assert.equal(render({}), '[항목]\n- 제목: ');
const item = {label:' 특송 ', raw_title:'제목', song:{title:'연결 곡'}, song_id:'song',version_id:'version',assignee:'담당',
  memo:{elementType:'praise',inputMode:'manual_praise',outputMode:'lyrics',formHint:'V1-C1-V1-C1',
    scriptureTranslationId:'kr',slides:['첫 줄\r\n둘째 줄','후렴'],
    manualScripture:{text:'16 본문\n17 다음',translationLabel:'직접역'},
    asset:{name:'지도',url:'https://example.com/map.png'},audioAsset:{name:'음원',url:'https://example.com/a.mp3'}}};
const before = JSON.stringify(item);
assert.equal(render(item), [
  '[특송]','- 제목: 제목','- 유형: praise','- 입력: manual_praise','- 출력: lyrics',
  '- 송폼: V1-C1-V1-C1','- 곡: 연결 곡','- 곡 ID: song','- 버전 ID: version',
  '- 담당: 담당','- 역본: 개역개정','- 역본 ID: kr','- 가사: |',
  '  첫 줄','  둘째 줄','  ','  후렴','- 수동 역본: 직접역','- 수동 본문: |',
  '  16 본문','  17 다음','- 파일: 지도','- 링크: https://example.com/map.png',
  '- 음원 파일: 음원','- 음원 링크: https://example.com/a.mp3',
].join('\n'));
assert.equal(JSON.stringify(item), before, 'Rendering must not mutate inputs');
assert.equal(render({label:'설교',raw_title:'말씀',sermon:true,memo:{slides:['A','B'],scriptureTranslationId:'unknown'}},
  {references:['창세기 1:1','요한복음 3:16']}),
  '[설교]\n- 제목: 말씀\n- 역본 ID: unknown\n- 성경 본문: 창세기 1:1; 요한복음 3:16\n- 슬라이드: |\n  A\n  ---\n  B');
assert.equal(render({memo:{asset:{url:'only.png'},audio_asset:{name:'audio'},manualScripture:{translationLabel:'empty'}}}),
  '[항목]\n- 제목: \n- 파일: only.png\n- 음원 파일: audio');
const isolated = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(root, 'mindex.worship-source.js'), 'utf8'), isolated);
const fields = Object.freeze({label:'제목',value:'내용',hasTranslation:false,sermonReference:null,
  asset:Object.freeze({}),audio:Object.freeze({})});
assert.equal(isolated.serializePortableServiceSourceItem(fields).join('\n'), '[제목]\n- 제목: 내용');
assert.equal(isolated.serializePortableServiceSourceItem({...fields,hasTranslation:true,translationLabel:'',sermonReference:''}).join('\n'),
  '[제목]\n- 제목: 내용\n- 역본: \n- 성경 본문: ');
console.log('PASS portable source bytes: field order, CRLF lyrics, slide separators, manual text, sermon reference, asset/audio omission and nonmutation');
