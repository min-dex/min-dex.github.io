# Mindex Remote Controller

2026-10-21 · 코드 기반 연결과 폰 우선 전용 페이지 구현. 로컬 Chromium/WebKit 및
실제 Supabase Broadcast 중계 확인 완료. 미배포이며 실제 휴대폰·현장 송출 장비 검증은 별도다.

## 사용 흐름

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

## 연결·명령 계약

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
