# Mindex Remote Controller

## 현재 사용 계약 ·2026-10-24

웹 배포 기준: `20261024-disclosure-remote-batch` (`554f5146`).
2026-10-25의 3분 종료 제한 제거는 아래 소스 변경이며 아직 운영 배포하지 않았다.
로컬 Chromium/WebKit 및 실제 중계 검증과 물리 휴대폰·현장 장비 검증은 구분한다.

1. 예배 송출을 시작하면 활성 송출에 **4자리 코드**가 자동 배정된다.
2. 폰의 `remote.html`에서 송출 코드를 입력한다. 일반 조작자는 송출당 한 명이며,
   같은 입력창에서 관리자 PIN으로 들어가면 활성 송출을 선택할 수 있다.
   관리자는 여러 명이 동시에 연결할 수 있다. PIN 값은 문서에 기록하지 않는다.
3. 현재/다음 미리보기, 암전, 슬라이드와 음원·영상 조작은 PC의 기존 API를 사용한다.
   다른 기기가 상태를 바꾸면 오래된 명령은 거절하며, 끊긴 동안의 명령은 재실행하지 않는다.
4. 무응답 2.5초 초과 또는 백그라운드 전환 시 조작을 잠그고, 마지막 응답부터
   **3분 무응답 종료 제한 없이** 메모리의 연결을 유지한다. 복귀 후 최신 상태를 확인해야 조작을 재개한다.
   서버 권한 만료·명시적 종료·기존 8시간 상한은 별개로 유지한다.
5. 명시적 연결 종료·송출 종료는 즉시 종료한다. 새로고침·일반 페이지 이동·브라우저
   프로세스 종료는 연결 정보를 영구 복구하지 않는다. BFCache 복귀는 별도 지원한다.

세부 기준은 아래 **Stable four-digit output codes**, **Multiple administrators, one guest**,
**Unified entry** 및 **Automatic recovery without a three-minute cutoff (current)** 절을 따른다.
이하 날짜별 초기 구현·검증 기록은 당시 근거이며, 현행 계약과 충돌하면 위 기준과
최신 해당 절이 우선한다. 초기 6자리·2분 코드, 관리자 한 명, 10초 종료는 현재 규칙이 아니다.

### Automatic recovery without a three-minute cutoff (current) ·2026-10-25

사용자 요청으로 연결 후 무응답 180초 경과에 따른 자동 종료만 제거했다.
네트워크/백그라운드 복귀 때 같은 메모리 세션으로 재연결하고 새 request에 맞는 최신 응답을
받은 뒤에만 조작을 허용한다. 2.5초 freshness 잠금, 명령 미보관/재전송 금지, generation·ticket·
revision 검사, 단일 일반 Remote 제한은 유지한다. 송출 종료와 명시적 종료는 계속 즉시 종료한다.
서버 권한 만료와 기존 8시간 세션 상한, 브라우저 프로세스 종료/새로고침의 비영속성은 바꾸지 않는다.
DB 변경은 없다. 3분 제한 제거는 소스 변경이며 운영 배포 완료를 뜻하지 않는다.
검사: 3분 초과·10분·1시간 시계 이동 후 fresh-state 복구/명령 거절/재실행 없음과 종료,
두 브라우저의 10분 sleep 복귀 및 송출 종료. 실제 휴대폰 절전/네트워크는 별도다.

## 초기 연결 구현 기록 ·2026-10-21~22 (현행 계약 아님)

2026-10-21 · 코드 기반 연결과 폰 우선 전용 페이지 구현. 로컬 Chromium/WebKit 및
실제 Supabase Broadcast 중계 확인 완료. 미배포이며 실제 휴대폰·현장 송출 장비 검증은 별도다.

### 초기 사용 흐름

1. 민덱스에서 예배 송출을 시작하고 상단 **원격 → 연결 시작**을 누른다.
2. 폰에서 `remote.html`을 열고 PC의 연결 코드를 입력한다. 계정·이메일·추가 승인 팝업은 없다.
3. 현재/다음 텍스트와 음원 상태를 보면서 이전·다음, 암전/해제, 재생·일시정지·정지,
   자동 넘김 복귀를 조작한다. 송출 PC가 기존 presenter/music API로 실행한다.
4. 어느 쪽에서든 연결 종료 가능. 송출 종료·예배 변경·출력 세션 교체·탭 종료 시 연결을 폐기한다.
   새 연결에는 PC에서 새 코드를 만든다. 같은 코드로 두 번째 기기는 연결할 수 없다.

**숫자 6자리 서버 연결(v3)**: `migrations/2026-10-22-remote-pin.sql`의 적용이 선행되어야 한다.
v3 운영 서버 적용 완료. 클라이언트 배포 검증 진행 중.
계정·이메일·승인 팝업 없이 PC에서 생성한 6자리 숫자를 폰에 입력한다. 앞자리 0도 유지한다.
코드는 2분/한 번만 유효하다. 서버의 atomic DELETE RETURNING으로 한 기기만 claim할 수 있다.
서버는 코드 원문 대신 비공개 pepper를 이용한 HMAC을 저장하고, 256-bit 임의 relay secret을 교환한다.
6자리 숫자는 암호화 키나 Broadcast topic으로 사용하지 않는다. 대기 코드는 최대 3개다.
생성·입력 각각 프로젝트 전체 분당 5회 제한이다. 잘못된 입력도 반환 오류로 처리하여 횟수 증가가 commit된다.
브라우저 초기화나 위조 헤더로 우회할 수 없지만 다른 사용자의 반복 시도도 새 연결을 잠시 막을 수 있다.
이미 연결된 세션은 이 제한과 무관하다. 연결 최대 시간은 8시간이다.
비공개 테이블에 직접 접근할 수 없으며 공개 RPC 세 개만 허용한다. 예배·찬양 자료는 변경하지 않는다.

## 폰 전용 화면

`remote.html`, `remote.css`, `remote.mjs`는 편집 앱을 로드하지 않는다.
민덱스 `styles.css`의 Pretendard와 light/dark 테마 정의를 `tools/build_remote_theme.cjs`로
`remote.shared.css`에 생성한다. 편집 레이아웃 CSS는 가져오지 않고, 테스트로 원본과의 일치를 강제한다.
기기 색상 모드를 따르며 테마를 별도 저장하지 않는다.
폰 세로 화면에서 현재/다음 텍스트, 큰 이전·다음 버튼, 암전, 음원 조작 순으로 배치한다.
각진 5px 모서리, 공용 색상/글꼴/타이포 크기, 5/10px 간격 규칙을 사용한다.
600px 이상에서는 현재/다음을 두 열로 표시한다. 버튼 최소 높이50px, 이전·다음70px.
긴 텍스트는 미리보기 안에서 스크롤하며 가로 페이지 넘침을 방지한다.

미리보기는 현재·다음 두 장의 기존 PC thumbnail 렌더러 결과다. 각 직렬화된 UTF-8 기준4500바이트 이내로 제한하고 초과 시 텍스트 대체 화면을 표시한다. 정적 이미지·배경은 원본 URL로 표시하며 로컬 blob/file 자료는 제외한다. 전체 예배 자료나 음원은 보내지 않는다. 폰의 미리보기는 script 없는 sandbox iframe이며 영상·음원을 재생하지 않는다.
홈 화면 추가용 manifest가 있으며 service worker/offline 명령 저장은 없다.
공통 설정은 공개 브라우저 설정만 별도 파일로 공유하고 기존 inline bootstrap과 자동 대조한다.

## 초기 연결·명령 계약 ·역사적 기록

- `mindex.remote-core.mjs`: 256-bit secret 파생, AES-GCM 인증 암호화, P-256 ECDH/HKDF, 명령 gate.
- `mindex.remote-session.mjs`: Supabase Broadcast 연결, handshake, heartbeat, 만료·종료·실행 응답.
- `mindex.remote.js`: 송출 PC UI 및 기존 조작 함수 adapter.
- 기존 공용 데이터 변경 채널과 분리된 무작위 topic을 사용한다. 원격 연결 전용 private schema와 제한된 RPC만 추가한다.
  공개 채널은 암호문 relay일 뿐이고 코드 보유 증명/세션 키/epoch가 조작 권한이다.
- 최초 hello/welcome은 서버가 교환한 relay secret에서 파생한 키로 암호화한다. 연결 후 ECDH 세션 키로 전환한다.
  나중에 코드만 알게 된 기기가 기존 세션 암호문을 해독할 수 없다. 코드 유출 중 동시 연결은
  먼저 연결한 기기가 권한을 얻으므로 코드를 외부 공유하지 않는다.
- 브라우저의 세션/코드/키는 메모리에만 존재하며, 서버에는 만료 전 임시 연결 정보만 남는다. 저장해야 하는 사용자 데이터가 아니며 재접속 복구하지 않는다.
- host가 snapshot에 2초짜리 일회성 ticket과 revision을 발급한다. 명령은 epoch, peer,
  command ID, 증가 sequence, ticket, revision, 허용 action을 검증한 뒤 실행한다.
  시간은 host의 monotonic clock으로 판단한다. PC 직접 조작이 상태를 바꾸면 오래된 명령은 거절한다.
- 동시에 한 명령만 전송한다. 수신 성공과 실행 성공을 구분하고 응답 없는 명령은 재전송하지 않는다.
  중복 ID는 재실행하지 않고, 처리 중/오래된/순서가 뒤바뀐 패킷을 차단한다.
  crash 이후 exactly-once를 주장하지 않는다. 불확실할 때 현재 화면을 확인하도록 알린다.
- 1초 heartbeat. 마지막 응답 2.5초 초과 시 버튼 잠금, 10초 무응답 시 종료.
  화면 복귀 후 새 요청에 대한 snapshot을 받을 때까지 조작하지 않는다.
  네트워크 단절은 현장 재생을 정지하지 않는다. 명령 대기열은 없다.
- 사진/음원 URI, 원본 예배 문자열은 snapshot에 포함하지 않는다. 텍스트 길이/암호문 크기,
  수신 요청률 및 작업 대기 수를 제한한다. 해독 실패는 실행하지 않는다.
- 음원 소유 예배·동기화 조건은 host에서 다시 검사한다. 음원 준비/페이드아웃 중 조작은 잠근다.
  자동 재생 차단은 성공으로 표시하지 않는다. PC에서 재생 권한을 먼저 활성화해야 할 수 있다.

## 검증과 한계

- `test_remote_core.mjs`: 코드/암호화/잘못된 키, ticket·revision·sequence·epoch,
  재전송·동시 실행·출력 종료와 공개 설정 일치.
- `test_remote_session.mjs`: 암호화 handshake, 한 기기 제한, 처리 중 잠금,
  종료 후 코드 재사용 차단, 만료, 채널 해제.
- `smoke_presenter_remote.py`: 독립된 두 browser context를 암호문 relay로 연결.
  Chromium/WebKit, 320/390/768px, 긴 내용, 전체 버튼, 로컬 경합,
  재전송, 끊김/복구, 예배 변경, 잘못된 코드. 실제 DB/송출창/전체화면을 사용하지 않는다.
- `smoke_remote_adapter.py`: 실제 presenter/music/자동 넘김 함수 실행.
  출력창·오디오 하드웨어만 모의 객체. 재생 차단, 다른 예배 음원, 출력 세션 교체도 검증.
- `smoke_remote_relay_live.py --relay-only`: 별도 opt-in. 실제 Supabase에 임시 암호문 채널을
  만들고 가상 장 넘김/실행 응답/종료만 검증. DB 레코드/현장 음원에는 접근하지 않는다.
  2026-10-21 한 번 측정한 왕복 실행 확인은199ms. 평균/p95나 실기기 성능 보장은 아니다.

실제 폰의 절전·모바일 통신·홈 화면 설치, 실물 송출/음향 장비는 미검증이다.
전체 GitHub gate와 배포 확인도 별도다. 위 로컬 검증을 배포 완료로 표현하지 않는다.

2026-10-22 수정: 디자인 통일·8자리 코드. 기존 첫 배포는 GitHub run39633523909에서 완료됐으며, 이번 수정 배포는 별도 검증한다.

숫자 코드 추가 검증: `test_remote_pairing.mjs`(기본 CI), `test_remote_pin_sql.mjs`(별도 로컬 PostgreSQL).
SQL 테스트는 PGLITE_ROOT의 embedded-postgres/pg와 WORSHIP_TEST_ENGINE=postgres를 사용하며,
실제 운영 URL이나 인증 정보는 받지 않는다. 권한, 재적용, 동시 claim, 만료, 폐기, 실패 횟수 지속을 확인한다.

## 잠금·백그라운드·복귀 회귀 검증 · 2026-10-22

`tests/smoke_remote_lifecycle.py`를 로컬 Chromium/WebKit에서 통과했다.
운영 DB/현장 송출에는 접근하지 않고 독립된 브라우저 context와 암호문 중계 fixture를 쓴다.
- hidden/visible 전환은 visibility API 값을 바꾸고 이벤트를 발생시키는 시뮬레이션이다.
  숨김 상태에서 버튼 잠금, 복귀 직후 새 요청에 대응하는 상태를 받기 전 조작 금지,
  PC에서 바뀐 슬라이드의 최신 위치 반영을 검증했다.
- 명령 실행 직후 응답만 유실시켜 실행 불확실 안내와 명령 재실행 방지를 확인했다.
- 11.5초 중계 단절 후 기존 연결 종료, 새 연결의 정상 조작과 과거 명령 미실행을 확인했다.
- persisted pagehide/pageshow 이벤트를 재현해 기존 권한을 되살리지 않는 것을 확인했다.
  실제 OS 메모리 회수나 실제 BFCache navigation을 검증했다는 뜻은 아니다.
- Chromium은 CDP로 renderer를 실제 frozen 상태에 11.5초 두었다가 active로 복귀시켜
  host timeout과 복귀 후 조작 잠금을 확인했다. WebKit에는 이 freeze 검증을 적용하지 않았다.

이번 검증에서 앱 수정이 필요한 결함은 재현되지 않았다. 실제 iPhone/Android의 화면 잠금,
절전·앱 강제 종료·Wi-Fi/셀룰러 전환은 여전히 실기기 확인 대상이다.

## Remote failure matrix verification · 2026-10-22

Immediate subscribe failure now rejects instead of returning a closed session and
starting timers after cleanup. Disconnect waits at most one second for its send
acknowledgement before closing locally; the peer closes on end or heartbeat timeout.
No failed command or disconnect notice is automatically replayed.

Expanded checks cover CHANNEL_ERROR/TIMED_OUT/CLOSED, duplicate close callbacks,
execution failure, RPC timeout/abort, legacy code rejection, audio pending/fade
locks and output-window closure. Crypto/gate, isolated real PostgreSQL code limits,
and Chromium/WebKit adapter/lifecycle/presenter regressions accompany these checks.
Service quota failure is simulated through error/timeout paths without exhausting
production quota. Physical OS sleep, mobile power management and real network
handover remain outside this verification. These fixes are local, not yet deployed.

## Home-screen launch and screen wake lock · 2026-10-22

The standalone manifest retains remote.html as its start URL and now has an
explicit matching identity. Apple web-app title and safe-area top spacing are
provided. A collapsed home-screen guide explains Safari Share > Add to Home
Screen > Open as Web App and Android's browser menu. A native install button is
shown only after beforeinstallprompt; standalone/appinstalled hides the guide.
No service worker, offline commands, stored pairing key or automatic reconnection.

While a connected controller is visible, Screen Wake Lock is requested by default.
Wake Lock is automatic while connected and visible; there is no checkbox or
per-device preference (2026-10-23). Disconnect, pagehide
and hidden state release it; returning visible requests again if still connected.
Unsupported/denied/system-released states are explicit, with a manual retry for
release/denial; painting and heartbeats never create an automatic retry loop.
Late async requests after disconnect release their sentinel instead of retaining it.
Wake Lock is convenience only and never establishes command authorization.

Sources: https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API
and https://support.apple.com/guide/iphone/iphea86e5236/ios . Physical home-screen
installation and actual mobile battery/screen behavior require a real device.
Local tests mock platform APIs; protocol/lifecycle tests remain separate.

## Actionable connection errors · 2026-10-22

Invalid/used/expired code messages direct users to PC connection end/start. Rate
limits instruct waiting one minute and generating a new code; pending-code cap
explains closing unused connections or waiting two minutes. Server transport
errors instruct checking both devices' internet; legacy/malformed responses
instruct refreshing both pages. Rejected transport promises are normalized so
native technical messages are not exposed. Existing timeout/attempt rules remain.

## Panel audit · 2026-10-22

Slow explicit disconnect now locks both repeated disconnect and reconnect attempts
until cleanup finishes, on both PC and phone. This prevents a second click from
re-enabling connection while the first session's close callback is still pending.
`smoke_remote_panel.py` uses a delayed end promise and checks both engines; full
presenter remote smoke separately covers the real encrypted session path.
Panel screenshots were inspected. This audit fix is not yet deployed.

## Compact connection dialog ·2026-10-23

Use Mindex Remote with the existing small cross mark. Show a short status,
code only while pairing, and one applicable start/end action. Once connected,
hide the page link and pairing guidance; retain disconnect and failure status.
Close only dismisses the dialog; it must not disconnect. Keep the existing
opening/ending guards and six-digit pairing protocol.

## Minimal phone chrome ·2026-10-23

Remove in-page installation guidance and its custom install prompt. The existing
manifest and platform browser installation remain available. Show the wake-lock
status section only for actionable failures; idle/normal states occupy no space.
The example code uses lighter400-weight placeholder text, distinct from entered digits.


## PC 동시 조작과 영상 제어 ·2026-10-23

PC에서 슬라이드를 넘겼다 돌아오거나 음원을 시작했다 멈춰서 최종 표시가 같아도,
송출 순번과 음원 실행 순번을 비교해 그 사이 발급된 오래된 원격 명령을 거절한다.
새 상태를 받은 다음 명령은 정상 실행하며 같은 명령 ID는 재실행하지 않는다.

현재 송출 슬라이드의 일반 영상에는 재생·일시정지·처음부터 버튼을 표시한다.
폰은 영상을 재생하거나 전달받지 않는다. 송출 창의 영상 요소를 조작하고 실제 처리
응답을 받은 뒤 완료로 표시한다. 일시정지는 위치를 유지하고, 처음부터는 0초에서 재생한다.
출력 세션·슬라이드 메시지·영상 상태 변경 이력을 검사하고 중복 전달은 한 번만 처리한다.
영상 상태가 오래됐거나 준비 중이면 잠그며, 암전·실시간 말씀 중에는 영상 버튼을 숨긴다.
응답 제한은 1.8초이며 불확실한 명령은 재시도하지 않는다. 브라우저의 자동 재생 차단은
PC에서 허용하도록 안내한다. PPTX 내장 영상·배경 영상은 이 조작 대상에 포함하지 않는다.

`smoke_remote_video.py`는 별도 controller/output 페이지와 실제 HTTP MP4로 양 브라우저의
재생·일시정지·재시작, 중복 전달, PC 경합, 화면 교체와 재생 차단을 검증한다.
`smoke_remote_adapter.py`는 실제 슬라이드/음원 함수의 왕복 조작 경합을 검증한다.
암호화 relay 및 320/390/768px 영상 버튼 검사는 `smoke_presenter_remote.py`에 포함한다.
현장 휴대폰·실물 출력 장비 확인은 별도이며, 배포 완료는 Pages 기록으로 확인한다.

## PIN administrator / all active outputs · 2026-10-24

Production migration and PIN provisioning were completed by the operator on
2026-10-24. Live RPC verification confirmed PIN login, authorized listing, invalid
administrator/host rejection and logout. Publication is tracked separately in the release receipt. This supersedes email identification for remote administration
only; it does not change general app login/RLS or require prior PC registration.

The administrator enters a PIN on Remote, sees active outputs, and selects one.
Each entry shows worship title, the existing monitor display name, slide position
and a short per-output discriminator. Changing targets ends only that control
connection, never the worship output. Explicit output stop requires confirmation.
Administrator control survives browsing another worship on the host PC, while
remaining bound to the original output window/session. Six-digit guest pairing
and its existing restrictions remain available separately.

`2026-10-24-remote-admin.sql` adds private PIN/session/output/link records and
three narrow RPCs. It contains no PIN or configured hash. Provision a bcrypt
hash separately in the private singleton; never place PIN material in source,
URL, static configuration, screenshots or release evidence. Changing the PIN
must also delete administrator sessions to revoke existing access. This migration
does not modify worship/Praise data or grant direct private-table access.
Five consecutive failures lock PIN verification globally for 15 minutes (the
lock is serialized and committed even on rejection). Random administrator tokens
are hashed server-side, expire after eight hours and stay only in client memory.
Logout revokes linked sessions; closing a page also attempts logout but cannot
guarantee network delivery. Expiry remains the server-enforced boundary.

Hosts use independent random owner tokens and 30-second registration leases;
list entries require a report within ten seconds. Host reports run every two
seconds while output exists; an established control session requires a lease
response within six seconds. Failures close that session and back off ten seconds.
The list refreshes every three seconds while choosing a target. No control command
waits for list polling: commands still use the existing encrypted realtime relay,
fresh state tickets and acknowledgement. There is no offline command queue.

A requested link is not released to Remote until the host subscribes. Requests
expire after 30 seconds; a ready connection lasts at most the administrator token's
expiry. A host supports one administrator alongside its existing guest controller.
Another administrator receives busy rather than taking over. Both controllers
share the host mutation revision and execution lock: a command based on the old
state is rejected after another controller acts. Selecting another output creates
an unrelated encrypted channel. Only the administrator adapter permits output stop.

The application's existing trusted-link model still applies to host registration:
reported names identify app sessions, not authenticated physical machines. The
private registry does not establish hardware identity or silently enable the
unimplemented general Auth migration. No more than twenty fresh output entries or
administrator tokens can accumulate; stale output cleanup cascades its links.

Verification: real temporary PostgreSQL tests cover denied direct table access,
missing provisioning, committed global PIN lockout, expiry/logout, two-output
isolation, readiness, wrong-owner refusal and stale leases. Chromium/WebKit smoke
covers PIN UI, encrypted two-output control, switching without stopping, selected
output stop and logout; real host-adapter coverage includes administrator/guest
stale-command rejection and editing another service. Physical phones, OS sleep and
public deployment remain separate checks. Host registration restarts after a
page restored from the browser back/forward cache, using a fresh output identity.

## Stable four-digit output codes ·2026-10-24

Operator installed `2026-10-24-output-codes.sql`; production RPC verification
passed unique codes, host readiness, isolated guest secrets, owner rejection,
disconnect persistence and retired-code reservation. Temporary verification
outputs were removed. Publication is recorded separately in the release receipt.
The migration preserves the configured admin PIN.
This supersedes the six-digit/two-minute guest UI described earlier.

Every active output automatically gets a server-assigned four-digit code,
including leading zeros. Both presenter views show it on the remote button;
the panel keeps displaying it after guest connection or disconnection. An active
output may have one guest controller and one administrator independently. Guest
control follows the output while the PC browses another service; only the admin
adapter can end the output. Both use the shared mutation/revision safeguards.

Remote accepts the output code and waits for host subscription before receiving
an ephemeral random relay secret. The four digits never become an encryption key.
Requests use a random 256-bit controller token; readiness polls and lost-response
retries reuse that token. New code attempts share the existing server budget of
five per minute across the project. Disconnect cancels only the token's guest
slot. Established sessions retain the existing eight-hour ceiling and fresh-state
requirements; the output code itself does not have the old two-minute deadline.

A temporary network outage closes control sessions but preserves the host owner
identity and code. Code lookup requires a report within ten seconds; control
requires a report within six seconds. Recovery retries the same output identity.
BFCache suspension also retains it; returning renews the report and requires a
new controller handshake. Used/closed link IDs are not revived if a revocation
request was lost. Explicit output replacement/stop removes its registry row.

Inactive identities are retained for up to 24 hours solely for recovery; after
that, the host must register again. They are not connectable while offline. Code
reservations survive stop for 24 hours since the last report so a recently closed
code cannot immediately select another worship. Assignment is serialized with a
unique reservation; twenty fresh hosts and two hundred retained identities are
the limits. A multi-day outage is outside same-code recovery, and forgotten
server entries expire conservatively rather than claiming instant crash detection.

Legacy six-digit RPCs remain for already-open older clients during rollout; the
new UI does not create or accept those codes. This is compatibility for deployed
clients, not a fallback for missing new server functions. No worship, Praise,
lyrics, timing, media, or administrator PIN records are migrated by this change.

## Multiple administrators, one guest ·2026-10-24

User chose multiple concurrent administrators while retaining one ordinary Remote
per output. The new migration `2026-10-24-multi-admin.sql` changes only the private
admin-link primary key to (output_id, request_id), preserving existing records.
The configured PIN and all operational worship/Praise data are unchanged. The
global twenty-admin login cap is removed; PIN guess lockout, session expiry,
fresh-state checks and output registry limits remain. This is removal of the
one-controller product limit, not a claim of infinite hardware/network capacity.

The host maintains one encrypted relay per administrator and one for the guest.
Each has its own request ID, secret and readiness acknowledgement. Disconnect or
logout removes only that administrator's owned links; stopping the output removes
all its links. Every controller shares the actual host adapter's mutation revision
and execution lock, so stale simultaneous commands cannot replay across sessions.
Failed revocations remain remembered until a fresh server report confirms removal.

New hosts announce multiAdmin capability and consume a links array. Older hosts
continue receiving their single link, and a second administrator gets a host
refresh message until that PC updates. A new host with the previous server still
works with one administrator; it cannot silently pretend multi-admin is active.
The guest slot and its four-digit code behavior remain unchanged.

Local verification: real PostgreSQL migration replay and existing-link preservation,
independent secrets/readiness/logout, denied request takeover, one-guest limit,
old-host guard, more than twenty valid admin logins, output isolation and ACL.
Actual encrypted two-admin/one-guest relay tests cover stale concurrent commands,
independent disconnect and continued control. Chromium/WebKit admin UI and actual
presenter adapter checks pass. Operator SQL installation and production RPC verification are complete. Two
administrators and one guest shared a temporary output; disconnect preserved the
other links, code and second output. Temporary records were removed. Publication
is tracked separately in the deployment receipt.

## Unified entry and administrator output picker ·2026-10-24

The first four-digit entry field sends its value to mindex_remote_entry. The
server checks the configured PIN hash; a match returns an administrator session,
otherwise the existing guest output-code flow continues. No PIN literal or hash
is included in browser code. There is no separate administrator tab. The entry
field masks input, clears a successful PIN, and retains tokens only in memory.
A private project-wide five-attempt/minute entry budget protects the automatic
PIN check without counting ordinary output codes as failed administrator logins.
Existing direct PIN lockout remains enforced.

The administrator picker lists active worship titles and explicit output codes,
with PC name and current position below. The selected title/code remains visible
above controls. '예배 선택' disconnects only this controller and returns to the
picker without stopping output or logging out; '송출 종료' remains a distinct
confirmed command. This is output control, not remote editing of saved worship
documents. Logout returns to the shared entry screen.

The entry migration reserves the current configured administrator PIN against
new output code allocation. If a previously assigned code equals that PIN, only
that code is renewed; the output identity, links and actual worship stay intact.
Heartbeat reports do not perform extra PIN hash verification. Operator installation and production entry/list readback are complete; isolated
PostgreSQL and Chromium/WebKit checks pass. Publication remains a separate
deployment receipt.

## Multi-device lifecycle regression ·2026-10-24

Four isolated browser contexts run the real output registry, Remote page and
encrypted relay protocol: one host, two administrators and one ordinary guest.
Offline RPC and packet routing inject faults into only the selected peer; no
production data or physical device is used. Chromium and WebKit pass:

- Hide/restore one administrator while the other administrator and guest continue
  operating; restore requires a fresh snapshot before controls become usable.
- A 3.5-second packet outage temporarily locks only that peer, then recovers.
- An 11.5-second relay/RPC outage terminates only that administrator connection;
  the administrator can choose the output again without displacing other peers.
- A command executed before sleep with its acknowledgement lost is not replayed
  after restoration. Commands from stale snapshots remain intentionally rejected.
- Guest channel failure returns that guest to entry; both administrators remain
  usable and the guest can reconnect using the same output code.
- Administrator persisted pagehide/logout leaves the other administrator and
  guest active. Chromium additionally freezes a real renderer for 11.5 seconds
  while the other contexts continue, then verifies safe reconnection.

No product-code defect was reproduced. Added smoke_remote_multi_lifecycle.py to
the required offline suite; local partition/failure-propagation checks pass.
These are browser lifecycle/transport fault tests, not physical iOS/Android lock,
OS process eviction, cellular/Wi-Fi handover or router tests. Long inactivity is
allowed to close a connection safely; never describe this as an always-connected
guarantee. CI execution/publication of the new regression remains separate.

### Remote media section order (2026-10-24)

The connected Remote always shows audio controls before video controls. With no
video attached, the video section stays visible with `연결된 영상 없음`; its
commands remain disabled through the existing allowed-action guard. This does
not create a media element or alter the transport/heartbeat frequency.

### Event-driven Remote state (2026-10-24)

Presenter payload publication, audio control rendering, video health changes and
completed Remote commands notify all linked administrator/guest sessions. Each
session coalesces changes for 40ms and sends only changed snapshots; there is no
new polling or DB write. The existing 1s heartbeat remains the recovery path,
with unchanged freshness, revision/ticket, pending-command and expiry guards.
Encryption/dispatch is ordered so a fast state event cannot overtake a command
result. Closing a session clears queued notification timers. Unit coverage turns
off heartbeats and checks two-peer fan-out, unchanged-state suppression, burst
coalescing and close cleanup. Actual network/physical-device latency varies.

Output video play/pause/end/readiness events also coalesce a 40ms status report
to the PC controller, rather than awaiting its periodic heartbeat. The existing
video regression suspends only that heartbeat and confirms native pause/play
status within 700ms on Chromium/WebKit; it retains stale-frame, duplicate command
and autoplay-denial coverage. Isolated two-admin/guest lifecycle checks pass on
both engines after integration with the extracted presenter runtime.

### Three-minute automatic recovery ·2026-10-24 (historical; cutoff removed 2026-10-25)

This supersedes the earlier 10-second disconnect and BFCache logout behavior.
An established session keeps its in-memory identity/keys for up to 180 seconds
without a peer response. Controls still lock after 2.5 seconds, on offline or
hidden/pagehide suspension. A resumed page or replacement Broadcast channel must
receive a new request-matched snapshot before commands are enabled. A late packet
cannot revive a session after the deadline; elapsed wall time also covers OS sleep.

Only transport errors retry (1.5-second backoff), within the existing deadline.
Authentication/protocol failures and explicit end remain terminal. Channel
callbacks and delayed send failures from retired generations are ignored; queued
encryption work is invalidated on suspension. Commands are not retained/replayed.
An action executed just before loss can remain unacknowledged; UI reports that
uncertainty rather than retrying. Existing revision, ticket, replay and single
pending-command guards remain. Output registry outages pause relay control while
retaining links; control requires a fresh successful registry tick after recovery.

BFCache restores keep the session and administrator identity. Normal navigation,
reload, browser process eviction or explicit disconnect still releases in-memory
credentials; this is not persistent automatic login. Server authorization expiry,
revocation and the existing 8-hour maximum remain. No DB/schema change is needed.
Explicit output removal and output-stop notify connected peers with a terminal
message, closing the host command gate immediately. They do not enter the
three-minute recovery window; administrators return to output selection promptly.

Scoped checks cover 179-second recovery, 180-second expiry, command denial while
suspended, failed-send no replay, reconnect retries while hidden, two administrators
plus one guest, isolated channel errors, short/long packet loss, lost acknowledgments,
BFCache and actual Chromium renderer freeze. Physical phone radios remain distinct.

### On-demand slide picker ·2026-10-24

Remote opens a read-only modal with ordered groups, current-slide highlight,
search and six-slide pages. Phones use two columns; wider screens use three.
Only explicit browse requests send catalog/preview data, never heartbeat state.
Responses omit hidden slides, bound search/labels and cap preview payload at
14KB UTF-8; oversized previews use readable text fallback. No media plays in
the picker. Preview ResizeObservers are disposed on page replacement/close.

Selecting sends a jump through the existing encrypted, revision/ticket/sequence
gate and real runPresenterAction path. The target carries the source catalog
identity; replaced slides/source changes invalidate old lists. Host validates
integer bounds, visibility and catalog identity again before moving. No offline
queue/replay is added. The dialog closes only on a successful command result;
rejected/stale commands stay visible for correction. Old hosts simply do not
advertise jump, so the picker stays disabled until both sides are updated.

## Controller placement · 2026-10-25

The active output code is shown automatically at the bottom-right of its sidebar
worship card; the launch/stop icon sits at the top-right. Clicking the code opens
the existing remote dialog. A different prepared worship card never shows the
active output's code. The header remote entry remains available.
