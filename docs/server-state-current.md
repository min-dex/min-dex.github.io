# 서버 저장 통일 · 2026-10-19

사용자 지시: 초안·복구본을 포함한 모든 앱 저장의 기준을 서버로 통일한다.
아래 경로 전환을 구현하고 운영 DB 적용, 확인 가능한 Safari/Chrome 자료 이관,
Linux 검증과 Pages 배포를 완료했다. 다른 기기의 기존 자료는 해당 기기의 다음
앱 실행 때 같은 이관 경로로 처리한다. 확인하지 않은 기기의 이관 완료를 뜻하지 않는다.

## 저장 분류

- 공용: 등록 배경, 앱 공통 설정. 저장 성공은 서버 응답으로만 확인한다.
- 기기/세션별 서버 저장: UI 선택·스크롤·탭, 출력 모니터와 always-on-top,
  주보 초안/복구본, 예배 복구본/충돌 원문, atomic 저장 요청과 creation ID,
  부서 기도자 재시도, 미반영 일요 편집, 기기 이름.
- 편집 초안: 찬양/폼, 말씀, 예배/원문, 주보, 참고자료의 미저장 값을 서버에
  보존하되 committed record를 자동으로 덮어쓰지 않는다. 복구는 명시적으로 적용한다.
- 송출 상태와 IPC: 현재 출력은 메모리+통신으로 전달하며 저장 복구용 snapshot은
  서버에 기록한다. 서버 장애가 현재 송출을 강제 중단하거나 변경해서는 안 된다.
- 구형 음원 타이밍 IndexedDB: 이관 입력만 허용한다. 새 저장은 공유 음원·타이밍
  서버 경로를 사용하고 서버 확인 전 기존 자료를 지우지 않는다.
- 성경/정적 데이터 캐시: 이미 서버에 원본이 있으므로 중복 서버 업로드 금지.
  메모리 캐시만 허용하며 localStorage를 authoritative fallback으로 사용하지 않는다.
- 인증·접속 식별자는 데이터가 아니라 서버 접근에 필요한 bootstrap 정보다.
  토큰/키는 로그·문서·공개 저장소로 출력하거나 일반 상태 테이블에 이관하지 않는다.

## 필수 불변식

1. 큐에 넣기/메모리 변경은 서버 저장 완료가 아니다. pending/error를 표시한다.
2. 최신본을 채택하거나 초안을 버리기 전에 서버 복구본 저장을 await한다.
   비동기 보존 후 입력/선택/프로젝트를 다시 검사한다.
3. 원자적 예배 저장은 기존 RPC 경로를 유지한다. 재시도 journal은 서버에 먼저
   확정하고 요청 ID를 유지한다. 실패·응답 유실·충돌 시 최신 요청을 지우지 않는다.
4. 서버 오류는 로컬 저장 성공으로 우회하지 않는다. 입력은 메모리에 유지하고
   저장 실패를 표시하며 미확정 내용이 있으면 종료/문서 교체를 보호한다.
5. 로컬 이관은 허용된 앱 데이터 키만 대상으로 한다. 서버 기존 값 덮어쓰기 금지,
   응답 재검증 전 로컬 원본 삭제 금지. 서버 연결 프로젝트가 모호한 자료는 보류한다.
6. 개인 초안/복구본은 공개 미디어 버킷 또는 공개 읽기 테이블에 저장하지 않는다.
   공용 미디어와 분리된 접근 제어가 필요하다.

## 확인된 기존 경로

- app.js safeStorageGet/Set/Remove, worship recovery history/latest/conflict,
  config/UI persistence, background registry, Sunday edit sync, calendar pending.
- mindex.worship-store.mjs + mindex.worship-atomic-client.mjs journal.
- mindex.bulletin.js draft/profile/recovery storage.
- mindex.presenter.js payload/navigation/signal storage fallback.
- mindex.presenter-ui.js always-on-top preference.
- mindex.monitor.js device name/token/tab coordination.
- mindex.song-timing.js profiles IndexedDB.
- content/worship/department realtime storage event fallback.

## 검증 게이트

서버 격리·권한·revision/동시 쓰기·응답 유실·재시도·이관 재실행을 실제 임시
PostgreSQL에서 검증한다. 브라우저에서는 서버 장애/저장 중 종료, 초안 보존,
송출 유지, 프로젝트 전환과 복구 UI를 검증한다. 기본 Linux gate + 변경별 테스트,
운영 적용·readback·배포 파일 검증은 각각 별도 결과로 기록한다.

## 구현 및 운영 경계 · 2026-10-19

초안/복구본, UI 설정, 배경 registry, 원자적 저장 journal, 구형 음원 타이밍의
새 저장을 서버 확인 경로로 연결했다. 공개 배경/음원은 기존 미디어 버킷,
개인 초안은 capability로 분리한 private schema/RPC를 사용한다. 기기별 초안은
계정 공통 초안함이 아니며, 다른 기기에 자동으로 공개되지 않는다. 브라우저의
접속 식별자를 삭제하면 해당 개인 namespace를 자동 복구할 수 없다.

이관 대상과 목적지를 설명한 뒤 사용자의 진행 지시를 받았다. 소스 코드를
수정한 뒤 사용자가 Safari 사용을 다시 허용했다. 운영 SQL을 적용하고 권한을
재조회했다. 최초 적용 직후 새 저장 테이블은 0행이었다. 이후 Safari의 실제
세션 자료 7건(549 bytes)을 이관하고 독립 서버 readback으로 원문 일치를 확인했다.
원본은 그대로 보존했고, 해당 프로필의 구형 음원은 0건이었다. Chrome은 배포 후
앱 초기화 경로로 이관한다. 서버 기존 값과 다른 원본은 덮어쓰지 않고 device
비공개 archive로 보존하며, 재이관은 중복 레코드를 만들지 않는다.

최신 main 564c5981까지 통합했다. 로컬 전체 gate 36 unit +48 smoke entry points와
후속 legacy/storage/audio/runtime/icon/domain 및 Chromium/WebKit server-state 검증이
통과했다. Linux/Pages 및 실제 Chrome 이관 최종 결과는 별도 배포 기록으로 남긴다.

- UI 쓰기는 300ms로 합쳐 전송한다. 예배 원자적 저장은 서버 journal 확인 후
  기존 RPC를 호출한다. 실패하면 입력/요청 ID를 유지하며 성공으로 표시하지 않는다.
- 개인 journal은 device namespace를 사용하여 탭을 닫아도 서버 요청이 남는다.
  UI 탭/선택 값은 session namespace다. 인증/접속 식별자만 브라우저에 남는다.
- 공통 설정은 서버 broadcast와 60초 복구 조회, 같은 기기의 상태는 값이 없는
  BroadcastChannel 알림 후 서버 조회를 사용한다. 현재 편집값을 강제 교체하지 않는다.
- 서버 revision 충돌은 자동 덮어쓰지 않는다. 일반 네트워크 실패는 동일 요청으로
  재시도한다. 실제 동시 변경 충돌은 원본 확인이 필요하며 무조건 재시도로 덮지 않는다.
- 초안 복구는 명시적 선택과 baseline 일치 검사를 거친다. 원본 변경/현재 입력이
  있으면 보존하고 중단한다. 찬양 lookup cache와 예배 공통 설정 dirty ID도 복원한다.
- 주보 다시 불러오기는 복구본 확인을 기다리고 그 사이 입력이 바뀌면 중단한다.
- 송출 IPC는 메모리/채널/창 메시지를 사용한다. next/previous 같은 행동 명령은
  한 경로로만 전달하여 중복 진행을 막는다. 저장 장애가 재생을 멈추지 않는다.
- IndexedDB는 구형 자료를 읽는 이관 입력이다. 새 음원/타이밍은 서버에 저장한다.
  이관 확인 전 기존 브라우저 원본은 삭제하지 않는다.

## 격리 검증

- Node: 서버 확인/응답 유실/동일 요청 재시도, read/write 경합, 오래된 응답 차단,
  queue 중 추가 입력, 종료 보호, 프로젝트/이관 allowlist, 기존 값/삭제 표식 보존,
  async atomic journal 확인 전 쓰기 차단과 확정 후 cleanup 실패 보존.
- 임시 PostgreSQL17.6: 실제 SQL 실행, private namespace 격리/테이블 권한,
  요청 재사용 변조 거부, revision 충돌, shared/private 경계와 credential key 거부.
- Chromium/WebKit: 장애/재시도/재접속, 개인/공용 분리, 실제 초안 복구 버튼,
  기기 이름 탭 연동, 페이드아웃 설정 복원, 시스템 테마 첫 화면과 서버 설정,
  채널 유무에 따른 송출 단축키 1회당 한 장 이동. native fullscreen 차단.
- 기본 offline gate 32 unit + 45 smoke가 통과했다. 추가 음원 unit 1개, 주보/송출
  smoke 2개와 후속 변경 범위 재검증도 통과했고 현재 gate는 33 unit + 47 smoke다.
  실제 생성/삭제 atomic lifecycle도 두 브라우저에서 별도 통과했다. 운영 네트워크 지연,
  실제 DB 이관, Linux CI/Pages 배포, 물리 음향/출력은 이 검사로 확인하지 않았다.


## 운영 schema readback

2026-10-19 Safari SQL Editor, Mindex 프로젝트 `tdulobbnppmpiqqxbvqy`에서 적용.
사전 조회에서 테이블/두 RPC는 없었고 실행 결과는 Success. No rows returned였다.
별도 조회: RLS true, anon schema access false, anon/authenticated table SELECT
false, anon read/write RPC execute true, state_rows 0. 실제 사용자 데이터 쓰기나
브라우저 이관은 실행하지 않았다. [구조화된 기록](server-state-verification-20261019.json).


## 실제 이관·배포 완료

- Safari: 세션 자료7건/549bytes, 서버 원문 readback 일치, 원본 보존. 구형 음원0건.
- 기존 Chrome 예배 탭: 자동 이관38건, 기존 서버 값 충돌0건. 구형 음원 프로필1건
  업로드·서버 manifest 저장 완료. 재접속 결과 신규 이관0/기존 서버 값38/음원1로
  복원됐고, 서버 준비 완료·음원 읽기 오류 없음·저장 대기 없음·미저장 수정 없음.
- 음원 업로드 전 원본 지문 검증과 서버 업로드 응답, 재접속 manifest 복원을 확인했다.
  실제 스피커 청음 또는 업로드 파일의 독립 다운로드 대조까지 수행한 것은 아니다.
- 최종 배포0d88bec84b340b51ff87d8f15a5e0990e8728e52,
  release20261019-source-metadata-guard. 다른 스레드의 입력 검증 보완을 함께 포함한다.
- Linux/Pages run39195317576 성공(36 unit+49 smoke). 공개 파일24개 byte-for-byte 일치.
- 이전 run39192743816의 WebKit 빠른 출력창 재시작 timeout은 이후 전체 Linux
  run39193565137,39194478276,39195317576에서 통과했다. run39194478276의 배포는
  최신 main 보호 장치에 의해 중단됐고 최신 run이 실제 배포를 완료했다.
- 사용자가 잠금을 해제한 뒤 Safari도 배포 버전으로 재접속했다. 서버 준비 완료,
  신규 이관0/기존 서버 값7/별도 archive0, 음원0/읽기 오류 없음, 로딩 완료/저장 대기
  없음과 실제 홈 화면을 확인했다. 원본 삭제·기존 예배 내용 변경은 하지 않았다.


## 기기 간 초안 이어쓰기 ·2026-10-19

편집 초안 전용의 별도 private capability를 사용한다. 현재 접속 설정은 로그인
필수가 아니므로 초안을 공용 anonymous namespace에 공개하지 않는다. 각 기기의
‘초안 이어쓰기 → 다른 기기 연결’에서 한 번 연결 코드를 전달한다. 코드를 가진
기기만 같은 초안함을 읽는다. 원래 device 저장소의 복구본/journal은 공유하지 않는다.
연결 코드는 bootstrap 식별자이며 앱 초안 내용은 브라우저에 새로 저장하지 않는다.

예배·찬양/폼·말씀·참고자료 및 주보/공통 양식의 새 편집 초안을 별도로 복사한다.
기존 일반 편집 초안도 private 저장본을 읽어 복사한다. 주보의 이전 복구본은 기존
‘임시 초안’ 복구 후 편집하면 전달된다. 서로 다른 탭/기기는 다른 작성자 키를 써서
동시 초안을 덮어쓰지 않는다. 이전 초안은 새 기기에 복구해도 삭제하지 않는다.
목록 알림은 내용 없는 broadcast이며 값은 서버에서 읽는다. 300ms 합치기,
60초 복구 조회/재연결·창 복귀 재조회, 실패 시 재시도와 종료 보호를 적용한다.

초안 수신은 편집창을 바꾸지 않는다. 사용자가 현재 문서의 ‘이 초안 이어쓰기’를
눌러야 적용하며 dirty/재생/저장 중에는 중단한다. 일반 편집은 baseline 일치,
주보는 revision과 복구본 보관 전후 입력·선택 검사를 통과해야 한다. 적용은 편집기만
변경하며 원본 DB 저장은 기존 경로와 명시적 저장 동작을 유지한다.

구형 음원은 키가 가리키는 원래 곡·버전 또는 예배 항목에 연결한다. 현재 확인된
운영1건은 곡 버전이 아닌 직접 입력 예배 MR/19개 시각이다. 원래 예배 항목에
연결하며 임의의 찬양을 만들지 않는다. 다른 공용 음원은 덮어쓰지 않고, 원문/시각
검증과 다운로드 SHA-256 대조 후 기존 atomic 예배 저장 또는 version CAS를 쓴다.
서버 재조회 후 성공을 표시하고 구형 원본은 남긴다. 버전 저장도 content-live
알림을 보낸다. 운영 연결·최종 배포 확인은 별도 기록한다.

실사용 중 발견한 목록 스크롤 저장 키 누락도 수정했다. 정의되지 않은 키는
네트워크/재시도 큐에 넣기 전에 거부한다. 저장 실패를 로컬 성공으로 우회하지 않는다.

운영 대조 결과: 기존 MR과 공용 예배 음원의 파일 지문·길이는 같지만 주소와
19개 중8개 시각이 다르다. 공용 음원은 독립 다운로드10,569,839bytes의 SHA-256이
저장 지문과 일치했고 활성19개 시각이 존재한다. 사용자는 구형을 재사용할 의도가
없음을 확인했다. 현재 공용 예배 타이밍을 유지하고, 구형은 private 서버의 원본
보관본으로 남긴다. 현재 코드는 공용 예배 audioTiming을 구형 profile보다 우선한다.
이 대조에서 예배 내용·타이밍을 변경하지 않았다.

### 배포 검증 완료 ·2026-10-19

- 배포: d158d0fda0252840e9219c6e7ef4d55b5956eda0 / 20261019-draft-handoff.
- Linux/Pages run39200023720 성공. 로컬38 unit+51 smoke 통과, 공개26파일 byte-for-byte 일치.
- Chrome 기존 프로필1건 복원, 서버 준비 완료/저장 대기 경고 없음/미저장 수정 없음.
- Safari 서버 준비 완료/저장 대기 없음/미저장 수정 없음. 기존 목록 스크롤의
  잘못된 키 요청은 올바른 키의 서버 영수증을 확인한 뒤 재접속했고 오류가 사라졌다.
- 실제 예배의 현재 공용 MR은19페이지/19시각 validation 통과, public worship
  syncTimeline 생성 확인. 송출·청음이나 운영 예배 저장은 실행하지 않았다.
- 서로 독립된 Chromium/WebKit 프로필로 연결·초안 복원/dirty 보호를 검증했다.
  사용자의 실제 Chrome/Safari는 아직 서로 pairing하지 않았다. 최초1회
  ‘초안 이어쓰기 → 다른 기기 연결’ 코드 전달이 필요하다.

## 레거시 음원 실행 경로 종료 ·2026-10-19

사용자 지시에 따라 음원은 공용 DB만 사용한다. 버전은 `audio_set`, 예배 항목은
현재 `audioAsset`/`audioTiming`을 읽고 기존 version CAS/atomic 저장으로 저장한다.
위의 IndexedDB 자동 이관·private manifest 재생·구형 음원 공용 연결 설명은 과거
배포 기록이며 현재 동작이 아니다. 새 실행에서 해당 저장소를 열거나 업로드하지
않는다. memo.childrenAudioSets fallback, 별도 바이너리 공유 저장/불러오기도 종료했다.

기존 IndexedDB/private manifest/업로드 원본은 삭제하지 않고 앱에서 사용하지 않는다.
확인된 공용 MR의 현재19시각과38곡 버전 자료를 레거시 시각으로 덮어쓰지 않는다.
DB 자료가 없거나 가사가 달라지면 기존 검증/안내를 사용하며 옛 자료로 우회하지 않는다.
초안 이어쓰기, P/R, 박자 편집, 사진 전환, 페이드아웃 및 현재 저장 경로는 유지한다.

### 레거시 종료 배포 확인

- 배포 커밋: ce177e8e6e2d6c6094f7a194fe070b74988b904f, release20261019-audio-db-only.
- Linux/Pages run39204041389 성공:37 unit+52 smoke. 공개26파일 byte-for-byte 일치.
- 로컬37 unit+51 smoke 통과 후 추가된 폐회찬송/편집 필드 검사를 각각 통과했다.
  현재 DB 음원과 예배 MR의 저장 실패/재시도/독립 프로필 재접속·재생도 두 엔진에서 통과.
- 첫 Linux run39202100444는 기존 찬송가 smoke가 앱 helper 로드 전에 실행돼 실패.
  사용하는 helper 전체의 준비를 기다리도록 테스트만 보완했고 후속 Linux 전체 통과.
- Chrome 실제 홈 정상 로딩, 새 release 스크립트와 초안 이어쓰기 화면 확인.
  구형 음원 공용 연결 메뉴 없음. 운영 음원/시각 수정·삭제나 실제 음향 출력은 하지 않았다.
- 최신 원격의 편집창/포커스 표시와 폐회찬송 보존 수정도 통합했다.

## 레거시 보존 필드 제거 및 원본 폐기 요청 ·2026-10-19

사용자가 옛 원본·백업 영구 삭제를 요청했다. parseSongMemo/serializeSongMemo의
childrenAudioSets 보존 분기를 제거한다. 현재 audio_set과 audioTiming, 곡 버전/가사/
metadata/성경 연결 및 atomic 저장 경로는 유지한다.

운영 사전 대조: private manifest1건, 해당 옛 URL의 현재 예배/버전 참조0건.
현재 공용 MR은 별도 URL, 같은 SHA-256,19시각. 현재 버전 음원38건.
실제 삭제는 별도 결과 확인 전까지 완료로 간주하지 않는다.

상단의 `초안 이어쓰기` 버튼은 사용자 요청으로 제거했다. 기기 연결 UI를
상시 노출하지 않으며 기존 초안 보관·자동 복구와 명시적 복구 경로는 유지한다.

### Permanent deletion receipt

After explicit action-time confirmation, deleted the private legacy manifest and
its unreferenced old audio copy. Readback: manifest0, old URL NoSuchKey.
Chrome and Safari mindex-song-timing-v1 IndexedDB deletion was confirmed.
Current version audio_set38 and worship MR19 cues remain unchanged. Independent
MR download:10,569,839bytes; SHA-256
123046c4372aad18996808b724875576886916ec096a67a4f91404b6405182af matches.
Current song memo childrenAudioSets count0. Physical audio output not tested.

One0byte song-timing/.emptyFolderPlaceholder remains in Storage. The user
reserved Safari, so this empty marker cleanup is deferred. It is not audio
or a backup; do not claim zero remaining Storage objects.
Local37 unit+52 smoke and Linux branch gate passed before latest-main merge.
Latest toolbar removal is preserved. Final deployment verification is separate.
