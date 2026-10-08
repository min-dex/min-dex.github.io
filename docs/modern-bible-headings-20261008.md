# 현대어 소제목 분리

## 상태

2026-10-08: 원본/운영 데이터 비교와 로컬 검증 완료. 운영 SQL 적용 및 웹 배포는
아직 하지 않았다. 직접 DB 연결은 ENOTFOUND로 실패했다. 이전 연결에서는 인증서
체인 검증도 실패했으며 인증서 검증을 해제하지 않았다.

## 확인한 원인과 범위

사용자가 제공한 `성경(.xml).zip`의 현대어 XML은 66권, 1,189장, 31,099절이다.
Git 이력의 importer(1364e7f1)는 선두 `<…>`만 section_title로 분리한다.
원본 사무엘하 22장의 8개 소제목은 이 형식이고, 다른 2,428개 구절은 `[…]`로
시작한다. 원본을 기존 importer로 읽은 결과가 운영 DB의 2,428개 대상 본문 및
빈 section_title과 모두 일치함을 read-only API로 확인했다.

본문에 `[`가 있는 구절은 2,467개지만 수정 범위는 선두 대괄호가 있는 2,428개다.
첫 대괄호 안의 전체 내용을 section_title로 옮긴다. 시편의 긴 부제·설명·참조도
줄이지 않고 보존한다. 본문 중간 대괄호, 기존 8개 소제목, 다른 역본은 수정하지 않는다.

## 운영 적용

SQL Editor에서 `migrations/2026-10-08-modern-bible-headings.sql`만 실행한다.
예배 무결성 migration이나 기존 성경 importer를 다시 실행하지 않는다.

- 원본에서 계산한 구절 주소·본문 MD5 집계값과 대상 2,428개를 검증한다.
- 전체 변경 전 행을 비공개 `mindex_maintenance.modern_bible_headings_20261008`에
  보관한다. 브라우저 역할과 PUBLIC에는 접근 권한을 주지 않는다.
- text와 section_title만 변경하고 모든 나머지 열의 동일성을 검사한다.
- 모두 하나의 transaction이다. 원본 불일치, 기존 백업 불일치, 후속 변경 또는
  적용 실패가 있으면 rollback한다. 동일 결과에 대한 재실행은 값을 다시 쓰지 않는다.
- 성공 결과: `modern_bible_headings_installed`, backed_up=2428,
  verses_with_headings=2436. 백업에는 자동 삭제 정책이 없다.

이 백업은 해당 2,428개 행의 사전 사본이며 전체 운영 DB 백업을 대신하지 않는다.
운영 실행 결과를 받은 뒤 read-only 조회로 다시 확인해야 한다.

## 화면 코드

성경 reader, 예배 성구 조회, 본문 검색에서 section_title을 함께 가져온다.
reader와 예배 성구가 공유하는 장 캐시의 버전을 v2로 올려 오래된 본문/빈 제목이
12시간 동안 남지 않게 했다. 기존 reader의 별도 제목 표시를 사용하며 본문 중간
주석은 유지한다. 이미 저장된 예배 내용은 자동으로 수정하지 않는다.

## 검증

- `tests/test_modern_bible_headings.mjs`: PostgreSQL 17.6에서 분리, 전체 사전 행
  보존, 다른 역본 보존, 재실행, 권한, 변경 감지, 실패 rollback 확인.
- 같은 테스트에 로컬 원본 파싱 JSON을 MODERN_BIBLE_SOURCE_JSON으로 제공하여
  현대어 31,099절 전체를 비교했고 변경 대상 2,428개 외의 행은 동일했다.
- `tests/test_bible_heading_reader.cjs`: 기존 캐시 무효화, 실제 조회 필드에 따른
  제목 전달, HTML escaping, 본문 주석 보존 및 새 캐시 재조회 확인.
- app.js 문법과 git diff whitespace 검사 통과.
