# Mindex Documentation Map

Read `HANDOFF.md` first, then open the smallest current document for the task.
When documents disagree, use the current contract or decision log and update the
stale document in the same change.

## Current Contracts

- `presenter-remote-design.md`: 배포된 원격 조작의 현행 연결·명령·복구 계약과 실기기 검증 한계.

- `server-state-current.md`: 서버 저장 통일 구현·격리 검증과 운영 적용 전 경계.

- `citation-live-output.md`: dedicated live scripture input, optional immediate
  output, draft retention, and controller scroll anchoring.
- `worship-presenter-decisions.md`: current Worship/Presenter behavior,
  service-specific rules, visual output decisions, and live-operation
  conventions.
- `worship-data-contract.md`: Supabase-backed Worship schema, persisted data
  contracts, service type IDs, input modes, and default materialization rules.
- `worship-persistence-current.md`: current persistence path, atomic-save
  boundary, and client fallback policy.
- `thread-worship-presenter.md`: implementation workflow for Worship and
  Presenter changes.
- `design-system.md`: app UI design tokens, button grammar, and design
  migration rules.
- `ui-contracts.md`: app shell and UI interaction contracts.
- `code-organization.md`: runtime script order, code ownership boundaries, and
  safe-refactoring rules.
- `friday-prayer-music.md`: Friday prayer music behavior and button-state
  contract.
- `section-editor-labels.md`: section label editing and preservation behavior.
- `version-name-preservation.md`: explicit Praise version names are user data
  and must survive normalization and saves.
- `young-adult-bulletin.md`: current bulletin editor, DB content/layout storage,
  published snapshots and printing.

## Operational Runbooks

- `audio-lyrics-sync-runbook.md`: 실제 음원 박자·가사 진입 기준 싱킹, 예배 저장,
  사진·타이밍 편집 바로가기, 음악 관리·페이드아웃 기본값, 전체 재생 검증과 임시 파일 정리.
- `manuals/operations.md`: 예배 이해·부서별 원문 순서, 현장 준비·진행·마무리, 최신 민덱스 사용법. `mindex.manuals.js`에서 자동 생성.
- `monitor-operations.md`: read-only operations panel and access boundaries.
- `supabase-capacity-maintenance.md`: conservative database capacity checks and
  cleanup procedure.
- `lyrics-validation.md`: lyric audit, repair classification, and production
  read-back verification.

## Planning Or Deferred Work

- `electron-packaging-plan.md`: packaging and auto-update plan.
- `admin-access-security.md`: admin and access-control planning.
- `solid-refactor-notes.md`: refactor notes only. Do not treat as a required
  migration plan unless the user asks to resume it.

## UI Review Evidence

- `ui-audit-20261010.md`: cross-module UI audit, verified fixes and test boundaries.

## Data Review Evidence

- `handoff-worship-service-list-payload.md`: UX->Data handoff for the light service
  list read and the Data thread response (view, source_ref guard, history size).
- `design-worship-service-history-storage.md`: design only (not applied) for the size of
  `mindexServiceDocumentHistory`: slim entries first, separate table only if needed.
- `ux-audit-2026-09-18.md`: bounded UX/code/documentation audit, regression
  coverage, preserved recovery data, and unverified production boundaries.
- `full-hymn-audit-2026-08-19.md`: full hymn dataset audit evidence.
- `hymn-reference-audit-2026-08-19.md`: read-only hymn audit and verified
  repair record. Use only as data review evidence, not as app behavior.
- `identical-hymn-lyrics-2026-08-19.md`: duplicate lyric comparison evidence.
- `worship-slot-key-audit-2026-08-26.md`: read-only Worship slotKey adapter
  audit and migration-risk review before adding DB slot constraints.
- `young-adult-bulletin-archive-review.md`: historical bulletin source review.
- `young-adult-bulletin-weekly-comparison-20260926.md`: dated bulletin content
  comparison evidence.

## Atomic Save Rollout Evidence

These files document a completed safety-sensitive rollout. Use the current
persistence and data contracts for normal changes; consult this group for
deployment, privilege, dependency, or recovery evidence.

- `worship-atomic-save-design.md`: design and invariants.
- `worship-atomic-client-release.md`: client preparation record.
- `worship-atomic-rollout-20260922.md`: production rollout record.
- `worship-atomic-canonical-check.md`: external dependency revision check.
- `worship-atomic-security-check.md`: privilege-boundary verification.
- `worship-atomic-live-audit-20260919.md`: live read-only audit.
- `worship-atomic-recovery-check.md`: recovery verification.
- `worship-atomic-preflight.sql`: operator-reviewed preflight queries; never run
  automatically.

## Retired Notes

Temporary incident logs and old worship-order drafts are not kept as active
documentation. Use Git history if you need to inspect them. Current behavior
must come from the contract documents above.

## Cleanup Rule

If a user-facing behavior changes, update the current decision log or data
contract with the same commit. Do not restore retired drafts or incident logs
as behavior sources.

Do not delete dated audit, rollout, or recovery evidence merely because no code
links to it. Delete a document only after its unique decisions and recovery
value are either obsolete by user intent or preserved in a newer canonical
record.

Completed one-time hymn repair tools and their dedicated tests were retired on
2026-09-22 after read-only production postcondition checks. See the hymn audit
records above for the retained repair evidence and Git reference.

- `ui-review-20261011.md`: current cross-module UI review, fixes, verification and limits.

- [어린이 찬양 핵심 기능 현황](children-audio-status.md): 통합 완료 범위와 검증 한계. 쪽수·전체 예배 PNG 내보내기는 제외.
- [예배 조작·장비 연동·방송 송출 아이디어](presenter-control-ideas.md): 원격 조작, 보기 전환, 순서별 음향·조명 자동 조작, OBS 없는 영상·자막 합성 및 방송 송출. 미구현 기획.
- [찬양·주보 실시간 연동](content-realtime.md): 저장 알림, 초안·재생·인쇄 보호, 현재 레코드 복구 범위.
- [운영·교회력 및 예배 목록 실시간 연동](operations-realtime.md): 셀 갱신, 생성·삭제, 열린 문서 보호와 복구.

- [프로젝트 잔재 점검](project-cleanup-20261019.md): 삭제·보존 범위와 문서 보완, 점검 한계.

- [찬송가 마디 검토·표시](hymn-musical-structure.md): 본절 측정25개/전체1203개. 읽기 전용 표시 및 미확인·가사 변경 재검토 규칙. 전곡 심층 완료가 아님.

- [폰 전용 원격 조작](presenter-remote-design.md): 코드 연결·암호화 중계·기존 조작 API, 로컬/relay 검증과 실기기 검증 한계.

- [찬송가 새171–190·연결 통일16판본 검증](hymn-measures-171-190-review-20261022.json): 신규 본절36, 전체 구간34/부분2. 누적 본절283, 후보 표시286. 검증 완료·배포 대기.

- [새191–230·연결 통일31판본 마디 검증](hymn-measures-191-230-review-20261022.json): 71판본, 신규 수치66·기존2·자유박자1·보류2. 후보353, 검증 완료·미배포.

- [새231–250·연결 통일14판본 마디 검토](hymn-measures-231-250-review-20261022.json): 확정18·보류16. 후보371 표시 검증, 미배포.

- [새231–250 보류16 해소](hymn-measures-231-250-deferrals-20261022.json): 직전 보류 판정 대체, 후보387 검증, 미배포.

- [새251–290·연결판 및 이전 보류8 검증](hymn-measures-251-290-review-20261022.json): 이번84판본, 누적463·자유박자4·미확인736, 보류0. 후보467, 검증 완료·미배포. 다음 새291부터.

- [새291–330·연결 통일판 검토](hymn-measures-291-330-review-20261023.json): 73판본 중 확정69·보류4. 누적530·자유박자4·미확인669, 후보534 검증·미배포. 다음 새331부터.

- [새331–350·연결 통일판 검토](hymn-measures-331-350-review-20261023.json): 36판본 중 확정34·보류2. 누적560·자유박자4·미확인639. 후보564 검증·미배포, 다음 새351.

- [새351–370·연결 통일판 검토](hymn-measures-351-370-review-20261023.json): 39판본 중 확정35·보류4. 누적595·자유박자4·미확인604. 후보599 검증·미배포, 다음 새371.

- [남은 찬송가 전체 범위 대조](hymn-measures-remaining-review-20261023.json): 610판본 검토. 누적 수치1150·낭송형6·보류47, 후보1156 검증. 전곡 수치 확정 아님; 미배포.

- [보류47판본 재대조](hymn-measures-deferrals-recheck-20261023.json): 신규27확정·20보류 유지. 누적1177·낭송형6·후보1183. 검증·미배포; 전체 수치 완료 아님.

- [최종20판본 재대조](hymn-measures-final20-review-20261023.json): 추가17, 수치1194·낭송형6·보류3(새620·새638·통550). 후보1200 표시/재열기 검증, 미배포.

- [출력 슬라이드 분량·새/통일 대응 정리](hymn-slide-balance-staged-20261023.json): 293판본·1123단위 후보, 대응524개 일치, 두 브라우저/세 해상도 넘침0. **운영 미적용·미배포.**

- 2026-10-23 [전곡 찬송가 슬라이드 후보 검증](hymn-slide-balance-completion-staged-20261023.json): 전체1203판본, 연결481곡군; 수정 후보440판본·1623단위. 운영 DB 미적용·묶음 배포 대기. 이전293판본 후보를 대체.

- [독립 아멘 유형 통일 후보](independent-amen-types-staged-20261023.json): 통551·553·556만 Lyrics로 통일, 기존 Coda 송폼 호환 검증. 최신 묶음443판본·1626단위, 미적용·미배포.

- [찬송가 악구 줄바꿈 전곡 재검토](hymn-line-consistency-staged-20261023.json): 고요한 밤부터 새·통일/절 사이 대응 줄바꿈 교정. 최신 묶음445판본·1643단위, 미적용·미배포.

- Keynote 원본+HTML 재생의 준비·복구 계약은 `worship-presenter-decisions.md`의 Keynote HTML 항목과 `worship-data-contract.md`를 따른다. Mac 화면 캡처 후보와 별도다.
