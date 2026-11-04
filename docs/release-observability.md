# 배포 다운로드·시간 기록 계약

## 작은 소스부터 받고 검사가 필요할 때 확장한다

`offline-web`은 `cloud` sparse checkout으로 시작한다. actions/checkout v4는
이 경우 blob 필터를 사용하므로 미디어 전체를 먼저 받지 않는다. 동일 SHA의
필수 네 검사와 scope 증명이 확인된 main 작업은 이 작은 checkout으로 끝낸다.
재사용할 수 없거나 API 증명이 불확실하면 `git sparse-checkout disable`로 **같은
SHA의 전체 소스**를 받은 다음 기존 전체/scope 검사를 실행한다. 어떤 검사를
선택하거나 생략하는 새 규칙은 아니다. Pages는 공개 자산 전체가 필요하므로
기존 committed-only archive와 전체 checkout을 유지한다. 실제 CI 속도 단축은
후속 실행의 timing artifact로 확인하며 로컬 sparse 시험을 속도 개선 실측으로
보고하지 않는다.

## 로컬 배포 시간은 세션 시작부터 닫을 때까지 기록한다

작업 시작 시 다음 명령으로 release ID를 만들고 인계에도 그대로 남긴다.

```sh
python3 cloud/release_queue.py start --owner codex/my-task
```

반환된 release ID를 `MINDEX_RELEASE_ID`에 넣는다. 모든 관련 명령은 아래
wrapper로 실행한다. 명령 인자·환경·stdout/stderr는 timing 파일에 저장하지 않는다.

```sh
python3 cloud/release_queue.py run --release "$MINDEX_RELEASE_ID" --phase local_checks -- python3 tests/test_release_timing.py
python3 cloud/release_queue.py join --owner codex/my-task --release "$MINDEX_RELEASE_ID"
```

join→첫 성공 claim의 큐 대기는 자동 기록된다. `queueWallSeconds`는 대기 중
로컬 검사와 겹친 시간도 포함하는 별도 축이며, 전체 phase 합계에 더하지 않는다. claim을 반복 확인해도 대기 시작이나
성공 시각을 덮지 않는다. 기존 FIFO/ticket/소유권 규칙은 그대로다. join에 release
ID를 생략해도 새 ticket을 ID로 한 기록을 자동 생성하지만, 개발·수정·인증 대기와
재입장을 한 번에 비교하려면 처음 만든 ID를 계속 사용한다.

명령 종류에 맞는 phase는 `preparing`, `local_checks`, `repair`, `push`, `ci`,
`integration`, `pages`, `public_readback`이다. 성공 후 다음 동작까지의 공백은
`handoff`로 자동 계산된다. 인증 오류로 명령이 실패하면 `auth_wait`, 다른 실패면
`repair_wait`로 자동 전환한다. 이후 명령을 시작할 때 이 대기 구간이 자동 닫힌다.
인증을 복구하는 동안 ticket을 반환했다가 다시 join해도 같은 release ID의 대기는
이어 기록된다. **실제 사람이 로그인한 시각을 감지하는 것이 아니라 실패 관찰부터
다음 기록 명령까지의 대기**다. 이를 순수 인증 처리 시간으로 과장하지 않는다.

연결 도구의 승인 거부처럼 wrapper 밖에서 일어난 경계는 즉시 아래처럼 남긴다.
그렇지 않으면 시간 자체는 빠지지 않지만 preparing/handoff와 구분할 수 없다.

```sh
python3 cloud/release_queue.py phase --release "$MINDEX_RELEASE_ID" --phase auth_wait
```

원인 확인/수정 작업 진입도 `--phase repair`로 표시한다. 기록 없이 수행한 외부
도구의 의미를 자동 추정할 수는 없다. 담당자는 raw 명령이나 미기록 진행을 쓰지
말고 경계를 남길 책임이 있다. 기록 전 요청 시각이나 다른 담당자의 작업 시각은
소급해 만들지 않는다. 시작/끝 없는 작업은 미측정 또는 진행 중으로 보고한다.

독립 공개 확인과 자기 ticket 반환 후 세션을 닫고 보고서를 읽는다.

```sh
python3 cloud/release_queue.py finish --release "$MINDEX_RELEASE_ID" --outcome complete
python3 cloud/release_queue.py report --release "$MINDEX_RELEASE_ID"
```

중단은 `--outcome abandoned`로 구분한다. 실행 중 wrapper가 강제 종료됐으면 다음
명령이 실패하며, 실제 프로세스가 멈췄음을 확인한 후 `recover --release ...`로
미확인 종료 경계를 명시해야 한다. 취소된 명령을 성공으로 바꾸거나 다른 소유자의
프로세스를 중단하지 않는다. 시스템 시계가 역행하면 음수 시간을 만들지 않고 실패한다.

기록은 Git common directory의 `mindex-release-queue/timings/<release>.json`에
원자적으로 보존되며 모든 worktree가 공유한다. 대기열과 기록은 각 파일 단위로
원자 저장된다. 프로세스/디스크 장애 시 두 파일을 함께 확인하고 불일치를 복구한다.
예전 ticket은 호환하지만 도입 전 claim/leave 시각을 소급 생성하지 않는다.
세션이 닫히기 전에는 합계가 진행 중이라는 표시가 남는다. timing은 검사 성공이나
배포 권한의 증거가 아니다.

## GitHub 단계는 자동 artifact로 보존한다

`timing` job이 scope·네 shard·Pages의 종료 후 성공/실패 경로 모두에서 현재
attempt의 job/step 시작·끝·상태를 수집한다. 읽기 권한만 사용하고 로그·환경·토큰은
수집하지 않는다. `release-timing-<run>-<attempt>` artifact를 14일 보존한다.
이 job은 Pages 의존 조건을 완화하거나 대체하지 않는다. 수집 job 자체가 아직
실행 중인 값은 null이며 완료 시간을 추정하지 않는다. 전체 workflow 취소나
GitHub 장애로 artifact가 없으면 로컬 journal의 관찰 구간과 함께 미수집을 표시한다.
완료 인계 시 작은 JSON을 기존 지속 증빙 위치에 복사해 artifact 만료 뒤에도 보존한다.

실패·수정·인증·재검사 attempt를 제외한 최종 성공 시간과, 이를 포함한 전체 관찰
시간을 각각 보고한다. 네 병렬 작업/서로 겹치는 step의 시간은 합산하지 않는다.
비교할 때 SHA·검사 수·scope·cache·runner 조건 차이도 남긴다. 다운로드가 빨라졌다는
주장은 실제 checkout 구간을 비교한 후에만 하고, 총 시간이 증가했으면 그대로 알린다.

구현 근거: [actions/checkout v4 가져오기 처리](https://github.com/actions/checkout/blob/v4/src/git-source-provider.ts)
는 sparse checkout에 blob filter를 사용한다. 다운로드 범위 축소는 이 기존 기능을 사용한다.
