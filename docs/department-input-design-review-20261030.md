# 부서 입력기·홈/운영 디자인 검토 · 2026-10-30

## 범위와 근거

기준은 `design-system.md`, `ui-contracts.md`, `operations-realtime.md`,
`young-adult-bulletin.md`다. 공개 UI는 CUA에서 교회력·주보 목록·운영·참고자료를
읽기 전용으로 확인했다. 공개 화면에 시험 문구를 입력하거나 저장하지 않았다.
코드 기준은 `b9c113ac`에서 분리한 `codex/department-form-input-review`다.

| 화면 | 현재 입력/표시 inventory | 확인 |
| --- | --- | --- |
| 교회력 | 기념·일정, 부서 담당, 성서일과 contenteditable 셀 | 조합 Enter/Esc/229, 정상 Enter·Tab, Esc 취소, 포커스/실패 표시 |
| 어린이부 주보 | 소식, 새길 말씀/출처, 읽기표, 인도자/호수, 공통/월간 문구, 양식 수치 | 여러 줄·원번호·커서, 조합 단축키, 실패/재시도, 복구 보존 |
| 청년부 주보 | 소식/설교 요점, 담당·발행·공통 문구, 양식 수치 | 동일 모듈 입력 규격·색상·레이아웃과 기존 저장/복구 회귀 |
| 홈 | 5개 모듈 개요, 최근 작업, 운영 메뉴 | 제목·카드/버튼 위계, 포커스, 중립 표면, 양 테마/폭 |
| 운영 | 교회력→역대 찬양 콘티→예배 매뉴얼→참고자료 | 실제 메뉴 순서/이름, 홈의 동일 진입 버튼 |
| 참고자료 | 제목/URL/그룹, 표시 checkbox, 순서/열기/완료/삭제 | 입력 규격, 중립 도구, 접근성 이름, 좁은 패널의 열/겹침 |

격리 Chromium/WebKit × light/dark × 390/768/1440의 60개 렌더 상태와
40개 스크린샷을 수집했다. 개인 자료 대신 fixture를 사용했고 외부 요청은
차단했다. 로컬 근거는 `output/department-design-audit-20261030/measurements.json`
및 같은 폴더의 PNG다. 활성 실제 텍스트의 측정 최소 대비는 5.82:1,
대표 키보드 포커스는 60개 모두 2px solid다. 원시 수치는 RGB와 color(srgb)를
해석하고 투명 배경을 조상 표면에 합성하여 계산했다. 비활성·네이티브
checkbox와 인쇄/미리보기 artwork는 텍스트 대비 판정에서 제외했다.

## 재현과 수정

| ID | 문제 / 계약 | 근거 / 심각도 | 수정과 상태 |
| --- | --- | --- | --- |
| IN-01 | 조합 중 Enter가 교회력 셀 blur와 자동 저장을 실행, Esc는 초안 취소 | baseline Chromium에서 composing Enter 후 writes=1/focus=false, 입력 확정 오발동 | `992dd75b`: calendar keydown의 isComposing/229 보호. 양 엔진 PASS |
| IN-02 | 주보 모듈 저장 단축키가 조합을 무시 | 공용 capture hook을 분리한 실제 mount에서 composing Ctrl+S 저장 spy=1 | `992dd75b`: 주보 root keydown 보호. 전역 보호는 Remote 담당의 별도 수정이며 중복 변경 없음 |
| IN-03 | 늦은 교회력 저장 실패가 이후 새 입력까지 원복 | 별도 fixture에서 새 초안이 서버 원본으로 사라짐. 입력 손실 | `48076779`: 실패 요청 값이 그대로 보일 때만 원복. 최신 텍스트·focus·caret 보존, 서버 baseline/Esc 유지 |
| DS-01 | 주보 오류/경고가 선택용 accent를 공유 | `styles.bulletin.css` warning=accent, 모듈이 모든 실패/넘침을 warning으로 합침 | 고유 status만 warning→warn, 실패→danger. 문구·원본·저장/인쇄 조건 보존 |

DS-01의 실제 넘침/저장 실패 fixture 대비는 양 엔진 동일하다.
Light: 경고 6.80:1 / 실패 6.57:1. Dark: 경고 12.40:1 / 실패 9.83:1.
저장 실패 후 입력과 dirty 상태가 유지되며 인쇄 iframe은 생성되지 않았다.

## 확인한 의도 차이와 변경하지 않은 항목

- 앱은 고정 데스크톱 shell과 최소 작업 폭을 유지한다. 390px에서의 페이지
  수평 이동을 임의로 모바일 drawer 결함으로 분류하지 않았다. 주보 inspector
  안의 입력과 참고자료 패널의 열/겹침은 별도 좁은 폭 검사로 확인했다.
- 교회력 읽기 셀의 14/500과 편집 포커스의 14/600은 기존 계약상 구분이다.
- 주보 A4 preview/인쇄 폰트·색·좌표, 부서별 지면 차이는 shell 규격으로
  강제하지 않았다. 출력 배경/원문/레이아웃 저장값 변경은 없다.
- 홈의 22/700 wordmark와 14/700 모듈 탐색 버튼은 서로 다른 역할이다.
  참고자료 text controls와 주보 text controls는 14/600을 유지한다.
- disabled opacity, native checkbox/선택 동작, 삭제의 danger, 명시 빈 값과
  아직 확정되지 않은 미래 예배 내용은 보존했다.
- 전역 token/shared CSS를 변경하지 않았다. DS-01은 Mindex owner가 승인한
  주보 status selector/state만 수정한다. 전체 앱 감사 완료를 뜻하지 않는다.

## Scoped 검증과 한계

PASS: `smoke_department_input_ime.py`, `smoke_calendar_late_failure.py`,
`smoke_bulletin_status_semantics.py`, `smoke_server_bulletin.py`,
`smoke_calendar_states.py`, `smoke_utility_input_density.py`의 양 엔진;
`test_bulletin.cjs`, `test_app_runtime.cjs`, SOLID audit와 diff check.
주보 저장 실패/복구 실패는 메모리 adapter로만 만들었다. 소식 Enter는
다음 원번호, Shift+Enter는 이어 쓰기, 일반 textarea는 여러 줄을 유지한다.

보충 수동 검사 `test_bulletin_persistence.cjs`는 변경 전 b9c113ac의 app.js에서도
fixture의 `rememberRecentEdit` 부재로 동일 실패했다. 이번 변경의 기본 gate
목록에는 없으며 관련 없는 저장 제품 코드는 변경하지 않았다.
`test_bulletin_children.cjs`는 로컬 Node playwright 의존성이 없어 미실행이다.
Python Playwright의 실제 children fixture와 기존 주보 core 검사는 별도 PASS다.

운영 DB 쓰기·실제 인쇄·재생·송출은 모두 0이다. 실제 OS IME 후보창/물리 장비
인증과 전체 화면/상태 조합 인증은 하지 않았다. 개별 final gate·release ticket·
push는 없으며, 독립 READY를 단일 배포 owner에게 인계한다. 배포/공개 검증은
통합 후보의 필수 검사 뒤 별도로 확인해야 한다.
