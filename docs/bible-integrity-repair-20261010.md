# 성경 잔여 문제 수정 — 2026-10-10

상태: **운영 SQL 적용 및 read-only 사후 전수 검증 완료. 화면 코드 웹 배포와 실제 브라우저 확인 완료.**
사용자 SQL Editor 결과: `bible_integrity_repaired`, `backed_up = 9`.
직접 DB 연결은 ENOTFOUND, 브라우저 Supabase 대시보드는 로그인이 필요했다.
이전 표제 migration은 이미 적용됐으며 다시 실행하지 않는다.

## 적용 대상

`migrations/2026-10-10-bible-integrity-repair.sql`은 이미 운영에 적용됐다. 재실행할 필요 없다.
성공 결과: `bible_integrity_repaired`, `backed_up = 9`.

- 쉬운성경 시편 60:1: 117자 소제목을 section_title로 이동. 제목·본문 문구는 보존.
- 우리말 계시록 17:1: 닫는 괄호가 빠진 제목을 확인된 경계에서 분리. 본문 문구는 보존.
- 개역개정 신명기 6:18: verse_end=19.
- 쉬운성경 사사기 20:22, 사무엘하 4:6, 열왕기상 8:41:
  verse_end를 각각 23/7/42로 지정. 뒤의 빈 행 3개는 is_active=false로 보존한다.

공개 열람본과 대조한 결과, 빈 절은 독립 본문 유실이 아니라 앞 절에 포함된 구간이었다.
새 본문을 만들거나 기존 본문을 삭제하지 않는다.

## 근거

- [대한성서공회 개역개정 신명기 6장](https://www.bskorea.or.kr/bible/korbibReadpage.php?version=GAE&book=deu&chap=6): 18–19 합본 표시 및 기존 본문 일치.
- [CTM 쉬운성경 사사기 20장](https://bible.ctm.kr/ibible/bibleread.asp?HEB_CH=b&HEV_CH=&bun=7&jang=20): 23절에 `(22절)` 표기.
- [CTM 쉬운성경 사무엘하 4장](https://bible.ctm.kr/ibible/bibleread.asp?HEB_CH=b&HEV_CH=&bun=10&jang=4): 7절에 `(6절)` 표기.
- [CTM 쉬운성경 열왕기상 8장](https://bible.ctm.kr/ibible/bibleread.asp?HEB_CH=b&HEV_CH=&bun=11&jang=8): 42절에 `(41절)` 표기.
- [지니 우리말성경 계시록 17장](https://www.genie.co.kr/detail/songInfo?xgnm=83256861): 제목은 “붉은 짐승”에서 끝나고 1절은 “일곱 대접”부터 시작. 이 경계만 참고했으며 문구는 사용자 제공 원본을 그대로 분리했다.
- 시편 60:1은 사용자 제공 XML 자체에 닫는 괄호가 있어 제목 경계가 명확하다.

## 보호 장치와 검증

수정 직전 운영에서 9개 전체 행을 새로 읽어 manifest에 저장했다.
SQL은 역본 ID/이름/활성 상태, 각 행의 모든 열을 정확히 확인하고 실행한다.
동시 수정이 있으면 중단한다. 원본 전체 행은 비공개
`mindex_maintenance.bible_integrity_20261010`에 백업한다.
전체 DO 블록은 원자적이며, 재실행은 원본 또는 동일한 수정 결과만 허용한다.
후속 변경을 덮어쓰지 않는다. 백업 테이블은 anon/authenticated 접근을 차단한다.

PostgreSQL 17.6에서 실제 9행 사전 사본으로 다음을 통과했다:
전체 백업, 정확한 기대 결과, 소스 불일치 중단, 변경 중 오류 전체 rollback,
재실행, 후속 변경 감지, 다른 세션 결과 조회, 백업 접근 권한 차단.

## 화면 코드

- 번호 공백만으로 합본 범위를 추정하지 않는다. 명시된 verse_end만 사용한다.
- 합본 뒤쪽 절만 요청해도 해당 합본 본문을 찾는다.
- 읽기 화면·선택·복사·본문 슬라이드에서 합본 범위를 보존한다.
- 캐시 prefix v3으로 이전 자동 추정값과 오래된 본문을 무효화한다.
- XML importer의 소제목 100자 제한을 제거한다. 닫는 괄호 없는 제목은 자동 추정하지 않는다.

`test_bible_explicit_ranges.cjs`, `test_bible_heading_reader.cjs`,
`test_bible_integrity_repair.mjs`, 감사 도구 테스트 3개와 JS 문법 검사를 통과했다.
`smoke_app.py`의 합본 fixture도 명시적인 verse_end로 맞췄다.
전체 앱 smoke test와 실제 웹 배포 후 검증은 아직 실행하지 않았다.

## 적용 후 전수 대조

```sh
python3 -B scripts/audit_bible_integrity.py '<원본 ZIP 경로>' \
  --repair-manifest docs/bible-repair-20261010-manifest.json \
  --output /private/tmp/mindex-bible-after-repair.json \
  --cache-dir /private/tmp/mindex-bible-after-repair
```

기대값: 총 행 수 404,259 유지, 원본 대비 주소 누락/추가/중복 0,
manifest 반영 본문·소제목·verse_end·is_active 차이 0,
활성 빈 본문 0. 쉬운성경 비활성 빈 행 3개는 보존된 기록이며 오류가 아니다.
쉬운성경 소제목 2,342개, 우리말 1,811개. 명시적 합본 4개.
원본 ZIP 자체는 수정하지 않는다. 기존 importer로 전체 재수입하면 수동 교정이 되돌아갈 수
있으므로 전체 재수입은 이 수정 작업에 포함하지 않는다.

## 운영 사후 검증 완료

검사 종료 UTC: 2026-10-10T06:12:38Z.
13개 역본 404,259행을 제공 ZIP과 승인된 수정 manifest에 전수 대조했다.
누락·추가·중복·본문/소제목/합본 범위/활성 상태의 예상 밖 차이는 모두 0건이다.
활성 빈 본문 0건, 쉬운성경 비활성 빈 행 3개 보존, 명시적 합본 4개를 확인했다.
쉬운성경 소제목 2,342개, 우리말 1,811개다.
별도 조회로 변경된 9개 전체 행이 정확히 기대 결과와 같고 다른 열도 보존됐음을 확인했다.
비공개 백업 9행은 사용자가 제공한 SQL 실행 결과 기준이며 직접 읽은 것은 아니다.
기계 판독 결과: `docs/bible-integrity-after-repair-20261010.json`.
웹 화면 배포와 실제 검색·표시·복사를 확인했다. 실제 예배 송출은 변경하거나 실행하지 않았다.

## 웹 배포 완료

- 배포 커밋: `d55bcf07`, 릴리스 `20261010-bible-integrity`.
- 원격 main push 후 공개 release JSON 갱신 및 실제 app.js와 커밋 내용의 완전 일치 확인.
- 실제 Chrome: 개역개정 신 6:19 검색 시 18–19 합본 선택, 복사 장절 및 본문 확인.
- 실제 Chrome: 쉬운성경 삿 20:23 검색 시 22–23 합본 선택, 독립 빈 23절 행 없음 확인.
- 실제 Chrome: 쉬운성경 시 60:1 및 우리말 계 17:1의 제목·본문 분리 확인.
- 로컬 범위·소제목·캐시 테스트 및 JS 문법 검사 통과.
- 기존 미커밋 문서 및 사용자가 비운 SQL 파일은 변경·포함하지 않았다.
