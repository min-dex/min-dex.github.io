# 홈·운영·부서 주보 최종 surface coverage · 2026-10-31

기준 공개 소스는 `befc873058a92e7f64cde06146a979f0aa684556`이다. 이번 보충은
해당 SHA의 compiled runtime을 격리 브라우저에서 실행했다. 이전 96개 렌더 상태와
공개 교회력 조회 재시도 검증은 재사용하고, 누락 표면에만 검사를 추가했다.
공개 사이트에 시험 문구를 넣거나 운영 자료를 저장하지 않았다.

## 실제 표면 inventory

| 페이지/패널/대화상자 | 확인한 상태·흐름 | 근거와 경계 |
| --- | --- | --- |
| 홈 전체 현황 | 기본·빈 목록·통계 조회 실패/재조회 표시, 최근 작업/최근 수정, 운영 진입 | 이전 96상태와 home_start/module_landings. 다가오는 예배 별칭/날짜 폭은 루트 owner 검증 재사용 |
| 운영 왼쪽 패널 | 교회력→역대 찬양 콘티→예배 매뉴얼→참고자료, 현재 항목 aria-current | 최신 소스의 실제 sidebar 렌더러 및 키보드 검사 |
| 교회력 부서 일과/성서일과 | 연도/보기 선택, 로딩·빈 연도·권한/회선 오류·재시도, 실제 셀과 생성 참고행 구분 | calendar_years/generated_readonly/load_retry, 공개 7f706510 receipt 재사용 |
| 교회력 입력 상태 | 긴 값·IME·dirty·연속 확정·늦은 성공/실패·새 초안/커서·Esc | save_order/late_failure/department_input_ime 재사용; 운영 편집 없음 |
| 역대 콘티 기간별/예배별 | 연도/월·검색·별칭/담당자·곡 링크·Back/reload/스크롤 복귀 | 최신 befc의 smoke_setlist_return 양엔진 PASS; 다년도 검증 재사용 |
| 역대 콘티 상태 | 긴 별칭/곡명, 로딩, 검색 결과 없음, 오류와 새로고침 UI | 이번 추가 fixture 렌더러. 실제 장애 서버·수동 담당자 저장은 이번 감사에서 실행하지 않음 |
| 예배 매뉴얼 본문/목차 | 섹션·출처 위계, 긴 본문, Enter로 목차 이동·제목 focus·hash 보존 | 이전 화면 근거 + 이번 실제 anchor handler |
| 참고자료 카드/인라인 편집 | 긴 제목/URL/그룹명, 체크/이동/편집 액션 표시, 그룹 이름 변경의 dirty | 이전 96상태 + 이번 실제 edit-group/done-group handler |
| 참고자료 생성 액션 | 새 링크·새 그룹 버튼의 이름과 배치 | 이 앱에는 생성 모달이 없고 바로 insert한다. 운영 생성 액션은 누르지 않음 |
| 참고자료 삭제 확인 | 브라우저 confirm 취소, 행 유지 | 실제 delete handler→native confirm dismiss, 삭제 요청 0 |
| 어린이부/청년부 주보 목록·편집 | 날짜 선택·내용·긴 문구·로딩·읽기/저장 오류·retry·dirty/커서 | 기존 actual-adapter E2E 및 공개 오류 안내 검증 재사용 |
| 주보 내용 상세 패널 | 주간 담당/발행·월간·공통 정보·도움말, 펼침 상태 유지 | 이전 렌더/입력 근거. 월간 자료 가져오기 및 공통 내용 덮어쓰기 실행은 제외 |
| 주보 양식 패널 | 수치·배경/지면/영역 선택·도움말, 잘못된 수치가 모델에 반영되지 않음 | 이번 청년부 simple 양식 실제 input/change handler. 저장/인쇄 없음 |
| 주보 임시 초안 확인 모달 | 긴 두 readonly 미리보기·선택·Tab containment·Escape·dirty 보존 | 실제 native dialog handler, 복구 적용 버튼은 누르지 않음 |
| 공통 미저장 변경 모달 | 초기 focus·Tab/ShiftTab·비활성/비동기·Escape·세 선택·focus 복귀 | 이번 신규 확정 결함과 독립 수정, 아래 참조 |

## 이번 보충 근거

두 엔진 × light/dark × 320/390/768/1440 × 6개 누락 표면의 **96개 상태**를
추가했다. 기존 96상태와 표면/목적이 다르며 모든 상태 조합의 전수 검사를 뜻하지
않는다. 복구 모달·양식/도움말·참고자료 inline/삭제 취소·운영 sidebar/매뉴얼
keyboard·역대 콘티 long/loading/empty/error를 포함한다.

`output/department-coverage-closeout-20261031/coverage.json`과
`audit_missing_surfaces.py`가 로컬 재현 근거다. JSON의 미저장 모달 16건 실패는
**수정 전 befc의 재현 결과**이며 실패를 삭제하거나 PASS로 덮어쓰지 않았다.
기존 근거는 `department-input-design-review-20261030.md`,
`department-input-e2e-20261030.md`, `department-ux-audit-20261031.md`와
`output/remote-calendar-ux-20261031/deployment.json`을 따른다.

## 신규 결함과 수정 상태

공통 미저장 확인창은 aria-modal이지만 Tab으로 배경 화면에 나갈 수 있었다.
두 엔진/두 테마/네 폭 모두 16/16 재현했다. 루트 shell owner와 함수 소유권을
합의한 뒤 `confirmUnsavedChangesAction`만 수정했다. 현재 보이는 활성 선택지를
Tab/ShiftTab으로 순환하고 모두 비활성이면 창에 focus를 유지한다. 닫은 뒤 남아
있는 opener로 focus를 돌려준다. 초기 ‘저장하고 이동’ focus와 기존 선택 결과는
유지하고 CSS/저장/폐기 로직은 바꾸지 않았다.

새 `smoke_unsaved_dialog_focus.py` 양엔진 PASS: 기본 순환, 동적 disabled,
전체 disabled, 외부 focus 후 재진입, Escape/계속 편집/저장 안 함/저장 선택,
opener 복귀/제거 시 안전 종료, 문구·dirty 불변. 필수 full gate의 명시 목록에도
등록했다. 기존 save_shortcut와 setlist_return을 offline 환경에서 양엔진 확인했고,
SOLID/runtime hash/분할 완전성·실패 전파/diff check도 통과했다.
이 수정은 독립 READY이며 배포·공개 검증 완료를 뜻하지 않는다.

## 열린 문제와 미검증 범위

- 이 담당 범위의 신규 확정 결함은 위 모달 focus 1건이며 배포 확인 전까지 열린
  항목이다. 추가 확정 결함은 발견하지 않았다.
- 다른 담당자의 Bible·찬양·presenter·Remote·전역 설정 표면은 이 문서의 감사
  완료 범위에 포함하지 않는다. 루트의 전체 inventory에 병합해야 한다.
- 생성/삭제 확정·주보 복구 적용·저장 안 함 후 실제 폐기·저장하고 이동 후 서버
  저장·출력/인쇄는 실행하지 않았다. 선택 handler의 반환과 dirty 보존만 검사했다.
- 한정 fixture의 긴 값과 실패는 확인했으나 모든 실제 문서 길이·회선·권한·운영
  동시 사용자, 물리 모바일/OS IME/보조공학 도구는 인증하지 않았다.
- 320/390px의 desktop shell 가로 스크롤은 현행 계약이다. 이를 모바일 레이아웃
  또는 물리 장비 인증으로 보고하지 않는다. 실제 재생·송출·인쇄와 운영 쓰기 0.
