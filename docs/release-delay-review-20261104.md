# 연합예배 검사·배포 지연 회고 · 2026-11-04

완료된 공개 SHA는 `89e2bd0c05f5d8290b4a38dcbf7d8c12f4147fcb`다.
branch run `41712281638`, main/Pages run `41717163159`가 성공했고 공개 파일과
Chromium/WebKit 확인까지 마쳤다. 아래는 확인된 원인별 기록이며, 각 단계의
총 소요 시간이나 특정 네트워크의 책임을 추정한 통계는 아니다.

| 막힌 지점 | 확인된 원인 | 처리 및 다음 작업 기준 |
| --- | --- | --- |
| 배포 슬롯 대기 | 먼저 시작된 다른 담당자의 release가 슬롯을 사용 중 | FIFO 준수. 대기 중 focused 검사·계약·fixture 준비, 슬롯 탈취/중복 final gate 금지 |
| 전체 CI 시간초과 | 기존20분 job budget 안에 전체 작업 미완료 | 이미40분으로 수정. 네 shard·개별180초·실패 차단 유지. 시간 연장은 속도 향상이 아님 |
| 재검사 | WebKit 성경 입력 테스트에서 편집 중 raw 값과 저장 canonical 값의 수명주기 혼동 | 실제 close/focusout/fresh read/reopen으로 fixture 수정. draft 보존·canonical 저장·추가 쓰기 없음 유지 |
| 재실행 요청 | 연결 API403와 브라우저 로그인 불가 | 인증/권한 실패를 CI 실패와 분리. 허용된 경로 확인 후 재개, 우회 없음 |
| 공개 확인 준비 | 비공개 전체 snapshot을 공개 페이지에 주입하는 검증이 승인 검토에서 거부됨 | 전체1,659건/신규74건은 로컬, 공개는 가상 데이터+동일 소스 대조로 완료 |

## 이번 후속 개선

`cloud/plan_checks.py`는 실제 `cloud/check.py` 분배를 그대로 읽어 네 shard의
검사 수·과거 smoke 시간·미측정 항목을 출력한다. 별도 목록을 복제하거나 검사를
선택/실행하지 않는다. 계획 도구 자체를 governance 검사에 등록했다.
과거 시간은 runner/setup/unit/Pages를 포함하지 않으므로 마감 약속에 사용하지 않는다.

[Cloud 절차](cloud-development.md)의 실패 분류·동결·재개 기준과
[예배 제작 가이드](worship-production-runbook.md)의 시작/마감 순서를 함께 적용한다.
문서만 읽고 같은 오류를 반복하지 않도록 시작 시 계획 확인, 변경 직후 focused
검사, 후보 동결 후 단일 final gate, 동일 SHA 공개 확인 순으로 진행한다.
검사 축소·타임아웃 완화·캐시 재사용 범위 확대는 하지 않는다.

## 남은 측정

후속 실제 release에서 큐/runner/setup/test/Pages/readback 시간을 분리해 기록한다.
이번 계획 도구로 실제 배포가 몇 분 빨라졌다는 결과는 아직 없다. 오래된 timing의
갱신이나 shard 재분배는 최신 CI 로그와 coverage 검사를 확보한 후 별도 변경한다.
