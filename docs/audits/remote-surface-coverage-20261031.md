# Remote 화면·상태 점검 범위 · 2026-10-31

현행 공개 기준 `befc8730`. 비공개 1.0 브랜드 후보와 별개 감사다.
remote.html/css/mjs, mindex.remote/core/session/admin의 befc 대비 차이 0을 확인했다.
공개 7f706510의 실제 asset 검사 및 양 엔진 검증과 필수 gate에 등록된 아래 검사를
재사용하고, 부족한 dark 상태와 touch handler 경로만 추가 실행했다.
이는 모든 상태 × 모든 크기의 전수 조합/물리 단말 인증이라는 뜻이 아니다.

| 화면/하위 화면 | 확인 상태·행동 | 근거 |
|---|---|---|
| 공개 예배 목록 | 코드 숨김, 이름, 목록 갱신/포커스, 빈 목록, 읽기 실패, 320–1280 | smoke_remote_directory |
| 선택 후 코드 입력 | 선택한 예배 일치, 오입력, IME, 입력 보존, 대기 중 코드 고정, 종료된 예배 | smoke_remote_directory |
| 관리자 목록·예배 전환 | 코드 표시, 두 예배, 전환/나가기 시 실제 출력 유지, 키보드 포커스 | smoke_remote_admin |
| 조작 화면 | 현재/다음 preview, 긴 내용, 프레임 비율, 미디어 fallback 및 격리 | smoke_remote_preview / presenter_remote |
| 슬라이드 목록·검색 | 60장 누적 로드, lazy preview, 끝까지 탐색, 늦은 응답 무시, 목록 변경 잠금 | smoke_remote_directory |
| 그룹 이동·복귀 | Enter 포커스 유지, 검색창 포커스 탈취 방지, 닫기 복귀 | smoke_remote_flow_edges |
| 실시간 말씀·설교 제목 | 입력/caret 보존, 명시적 송출만 실행, 근처 결과 안내, 연결 불가 잠금 | directory / flow_edges / presenter_remote |
| 음악·영상 조작 | 재생/정지/처음, PC 동시 조작, 오래된 요청 차단, 원본 보존 | smoke_remote_video / presenter_remote |
| 송출 화면 관리 | 대기/시작 중/시작·종료 권한, fullscreen 등 기존 adapter | directory / smoke_remote_adapter |
| PC 원격 패널 | 코드/아이콘 규칙, 두 번 종료 차단, 종료 후 코드 유지 | smoke_remote_panel |
| 화면 꺼짐 방지 안내 | 자동 요청/복귀, 거절·실패 재시도, 숨겨진 idle 안내 | smoke_remote_phone |
| 연결 손실·복귀·종료 | background, lost ack, 명령 미재실행, BFCache, 다중 관리자+guest | smoke_remote_lifecycle / multi_lifecycle |

## 이번 추가 실행

- Chromium/WebKit의 directory/admin/phone 실제 기존 테스트를 dark color scheme으로
  재실행: 모두 PASS. directory는 빈/오류/긴 목록/IME/입력대기 상태를 포함한다.
- flow_edges의 그룹 선택·말씀 송출을 touchscreen tap으로 실행: 양 엔진 PASS.
  같은 흐름의 Enter 그룹 진입·복귀 및 caret 보존도 유지한다.
- flow_edges light/dark × 320/390/768, 44px 이상 말씀 버튼, long text overflow PASS.
- 기존 preview는 light/dark와 iframe sandbox 및 fallback을 함께 검증한다.
- 기존 공개 배포 receipt: output/remote-calendar-ux-20261031/deployment.json.
- 이번 보충 receipt: output/remote-surface-audit-20261031/verification.json.

## 구분해서 남기는 미검증

실제 iOS/Android 키보드가 차지하는 가용 화면·safe area·OS 잠금 종료, 실제 손가락의
관성 스크롤, 실제 네트워크/LTE↔Wi-Fi 전환, 실제 외부 모니터·항상 위·팝업 권한은
모의 브라우저 검사로 완료 처리하지 않는다. 각 미디어 장비와 브라우저의 실제 권한
상태도 별도다. 모든 화면/상태의 pixel-perfect 스크린샷 비교는 시행하지 않았다.
이번 점검에서 새 runtime 수정이 필요한 재현 오류는 발견하지 못했다.
