# 예배 원문 입력 유형 보존 — 2026-10-15

원문 생성이 표시용 fallback 이름을 사용해 빈 성경 입력을 `성경봉독`으로 채웠다. 재반영에서는 모든 입력 모드를 찬양 전용 `praise_input_mode` 처리로 전달해 text/scripture/asset까지 lyrics_db로 바꾸고 슬라이드를 초기화했다. 유형 변경 전의 asset 여부를 사용하던 문제도 있었다.

수정:
- 원문 값은 성경 주소·파일·연결 곡 및 실제 raw_title에서 생성한다. 빈 값에 표시용 순서 이름을 넣거나 제목에 담당을 합치지 않는다.
- 원문 input_mode는 일반 메타데이터 복원 경로로 반영한다. 찬양 UI의 모드 전환 동작은 유지한다.
- 유형/모드 반영 이후 현재 요소를 다시 읽어 asset/text 입력 경로를 결정한다.

검증:
- `tests/smoke_source_input_roundtrip.py`: 운영 요청을 차단한 로컬 Chromium에서 빈 성경, 담당, 이미지, 직접 가사, 본문 슬라이드 3회 왕복 및 text↔asset 전환 PASS.
- `tests/smoke_service_source_v2.py`: offline 모드에서 곡/버전/음원, 역본/수동 본문, 미디어 유형 PASS.
- `tests/test_service_source_serialization.cjs`, `tests/test_source_empty_praise.cjs`, 변경 JS 문법 검사 PASS.
- 실제 anon 운영 테스트 예배 `2fe838d9-3b78-46ca-8488-991b82e63cb6`, 월삭예배, `2000-01-02`만 생성. 로컬 수정 앱의 IAB 화면에서 대표기도 담당과 별도 QA 이미지 순서를 원문에 추가해 반영·저장(revision 2), 새로고침 후 같은 원문을 다시 반영·저장(revision 3).
- 두 저장의 sections/elements/slides를 id 순으로 비교하고 감사 시각만 제외했을 때 동일. 24개 요소 유지, 성경봉독 scripture_reference 빈 문자열/input_mode scripture, QA 이미지 image/asset 및 URL 보존 확인.
- 내장 이미지 `assets/worship-templates/public-closing.png`를 연결했으며 업로드 파일이나 기존 자산을 변경하지 않았다.
- 테스트 탭 종료 후 정상 삭제 RPC로 테스트 예배 및 section/element/slide 부재 확인. 기존 126개 예배의 id/save_revision/updated_at 전부 동일. 정상 삭제의 복구 이력은 기존 정책대로 보존한다. 테스트 서버 종료.

로컬 코드 수정 및 운영 테스트까지 완료했으며 이번 작업에서 배포는 하지 않았다. 이전 예배 데이터의 일괄 수정/원문 재반영은 실행하지 않았다.

검증 화면: [source-roundtrip-20261015.png](source-roundtrip-20261015.png).
