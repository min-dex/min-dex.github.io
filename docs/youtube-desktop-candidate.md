## 운영 송출창 구성

유튜브 미리보기가 기본 화면이다. 설정은 영상 입력, 자막, 송출 순서로 두고
본당 출력과 수동 자막은 필요할 때 펼친다. 믹서의 실제 입력 번호는 장비 배선에 따르며 조작 화면에는 표시하지 않는다. 설치 앱은 실제 영상 입력을
연결하기 전까지 빈 상태로 열리며 송출 시작은 비활성화된다. 예시 영상과
샘플 가사는 독립 시험 페이지에서만 사용한다. 실제 영상이 끊기면 기존
송출 중단 규칙을 유지한다.

## 2026-11-06 Church internal delivery — supersedes signing choice below

The owner chooses unsigned church-only 1.0.0 delivery; equipment acceptance is
 deferred and actual broadcasts remain prohibited during verification. Keep the
 signed release command/certificate checks unchanged. The explicit internal
 configuration keeps Mindex app/profile identity and emits an internal build
 receipt, separate from isolated TEST packages and formal signed releases.

Internal updates use the app's Update menu and startup notice to find a newer
 complete `church-vX.Y.Z` GitHub release and open the exact OS/architecture
 installer. Installation/app replacement is manual on both platforms; no claim
 of unsigned automatic installation. Prompts defer during output, download
 action rechecks output and unsaved edits, and no arbitrary URL/command executes.
 Integrated web source `89fd081c` includes the completed lyric-timing preservation batch.
Local ARM installer source `f4b9538d` passed package parity, local RTMPS and
synthetic reinstall/restart data preservation; the combined source still needs
its own full web and native gate.

Signed updater, rollback and data-store paths remain unchanged. Package parity,
 synthetic installation/preservation and local RTMPS gates are still required.

## 2026-11-06 1.0.0 signed-release preparation

The owner now requests 1.0.0 delivery with broadcast-room equipment acceptance
explicitly deferred, and chooses certificate preparation followed by signed
publication. Actual YouTube broadcasting is not started by this work. Certificates
are not available/confirmed; do not weaken signing or publish unsigned packages
as a formal release. Keep the development channel until signing can be qualified.

Candidate includes public main `4bc17d5d` (save-return protection, catalog startup,
precise MP3 transport and approved r2 dawn default). Update package/audio checks
to the documented r2 bytes/hash/duration while retaining immutable older assets
and explicit worship attachments. Installed-app tests additionally check local
file decoding against independent PCM fingerprints. Intel Mac execution reuses
the same-run x64 artifact, checks local RTMPS and same-version reinstall/restart
preservation; it is distinct from ARM/Windows 0.9.0-test to 1.0.0-test upgrades.
All unsigned checks remain separate from real signing/notarization and signed
updater qualification. No production data or active worship output is changed.

## 2026-11-04 Background/audio follow-up candidate

Approved shared web candidate `d702a6cd` (including `6947c5bf`, `d2f58911`, `d6e757d8` preview-cache isolation and source-based praise selection guidance) is integrated after verified native candidate
`e4905211`. Element-owned backgrounds retain playback and bounded cold-load
retries; the supplied final dawn MP3 remains byte-identical. Package acceptance
checks its pinned SHA-256 as well as every tracked renderer blob. The installed
TEST app also loads the bundled MP3 through its file protocol, verifies duration
and muted playback progress, seeks near the end and releases the source within
a bounded 30-second check. The installed renderer also verifies the stable public
preview key, canonical output URL, unchanged slide and untouched signed/external
sources without loading any external media. External network and native audio output stay blocked. Full web/native
checks and isolated TEST upgrade preservation must pass on the combined SHA.
Actual YouTube broadcasting, production data writes, signing/notarization and
formal publication remain excluded. Web publication is confirmed separately.

## 2026-11-04 Final web/native integration candidate

The candidate now includes main `ff65ef9b`: output freeze, staged current-service
refresh and the preserved four-icon window-control row. Native YouTube composition,
local RTMPS acceptance and isolated TEST installation/upgrade preservation remain
included. Windows fixture lookup uses native path joining to avoid MSYS rewriting.
The candidate also includes approved web candidate `9fe4b755` for device-scoped
controller scale. Native upgrade fixtures verify its namespace, raw value and
app readback across restarts. The combined commit requires a fresh full web and native gate; prior component
results do not certify this combined source. Development channel remains active;
no real YouTube broadcast, production data write or formal publication is authorized.

## 설치 보존 시험 계약

TEST 패키지만 명시적 격리 모드에서 무작위 토큰으로 만든 시스템 임시 폴더를 재사용할 수 있다. 임의 경로·표식 없는 폴더·심볼릭 링크는 거부한다. 외부 통신·재생·권한·업데이트 차단은 유지한다.

Mac DMG와 Windows NSIS로 같은 후보 소스의 0.9.0-test 시험 버전을 설치하고 가상 서버 자료·초안·복구본·설정을 보관한 다음 재실행한다. 같은 TEST appID의 1.0.0-test를 덮어 설치하고 원문과 각 SHA-256, 연결 식별자를 다시 대조한다. 실제 정식 구버전에서의 호환성이나 서명된 자동 업데이트 성공과 구분한다. 실제 사용자 앱과 프로필, 운영 DB는 사용하지 않는다.

## 2026-11-04 1.0.0 방송 시험 후보 동결

공개 웹 기준 `89e2bd0c`까지 밝기·첫소절·문서 송출·디졸브와 예배 노하우 문서를 통합했다. 40분 CI 한도와 실제 편집창 수명주기 fixture를 유지한다. 후보 브랜치 CI의 웹 검사와 Desktop Packages의 미서명 패키지 검사를 분리한다. 설치 앱의 전체 웹 런타임을 Git 원본과 대조하고 시험 프로필에서 합성 화면을 로컬 RTMPS로 수신한다. 실제 장비·채널·서명 배포 승인은 별도이며 이전 후보의 수신 기록은 아래 이력에 보존한다.

# 1.0.0 후보의 유튜브 직접 송출

설치 앱의 **방송 → 유튜브 송출**에서 캡처보드나 영상 파일과 자막을 미리 본다. YouTube Studio의 스트림 키를 입력한 뒤 **유튜브 송출 시작**을 누른다. 키는 매 연결마다 입력하며 파일·DB·프로세스 인수에 보관하지 않는다. 종료하거나 연결이 끊기면 운영자가 다시 시작한다. 연결 준비부터 송출 종료까지 앱 업데이트 재시작을 보류한다.

본당 CH8은 본당 캔버스를 사용하고 유튜브는 하단 자막을 합성한 별도 캔버스와 방송용 오디오를 사용한다. 방송 제외는 유튜브 영상과 음성에 함께 적용된다. 슬라이드 따라오기는 기존 발표 상태를 읽는다. 송출 중 입력을 바꾸려면 먼저 종료한다.

Electron 메인 프로세스는 방송 창의 최상위 로컬 문서만 받아들이며 목적지는 YouTube 기본 RTMPS 서버로 고정한다. FFmpeg는 WebM 입력을 H.264 720p30과 AAC 48 kHz로 변환한다. 메인 프로세스가 TLS 인증서를 검사하고 RTMP 바이트를 전달한다. 송출 중 표시는 인코더의 전송 진행을 뜻한다. 시청자 공개 여부는 YouTube Studio 설정을 따른다.

패키징 전에 해당 OS에서 `python tools/broadcast-engine/prepare.py`를 실행한다. Mac ARM·Intel과 Windows x64 인코더는 타깃별 고정 해시로 준비한다. unsigned 시험 패키지는 외부 서버를 사용할 수 없고 로컬 수신기와 시험 인증서가 필요하다. 로컬 검증은 별도 프로필로 패키지 메뉴를 열고 수신한 캡션·음성, 차단·복원, 종료·연결 해제를 검사한다. 실제 YouTube 인입, GC553·믹서, 대상 OS별 서명 설치 승인은 별도 단계다.

## 통합 후보 수신 기록

검증한 소스는 `d87ab8033876ab3df9ed451264975149012c3957`이며 공개 main `0a9358f8`을 포함한다. Mac ARM 시험 앱의 실제 메뉴에서 테스트 키를 입력한 뒤 회선 하나로 하단 자막과 음성 → 차단 안내와 무음 → 복원을 로컬 수신 파일에서 확인했다. CH8 유지, 정상 종료, 수신기 강제 단절 후 조작 복구도 통과했다.

같은 커밋으로 Mac ARM과 Windows x64의 미서명 앱 디렉터리를 각각 만들었다. 두 앱의 빌드 신원은 1.0.0 test이며 방송 관련 파일 9개와 플랫폼별 FFmpeg가 원본과 바이트 단위로 일치했다. Windows 검사는 PE x64 및 패키지 내용까지다. 해당 후보의 Windows 설치·실행·네임드 파이프 키 전달·수신, Mac Intel 실행, 서명·공증·업그레이드, 실제 폰·캡처보드·CH8 배선·유튜브 채널은 별도 확인 대상이다.

최신 main `c9563ca1`을 통합한 후보 `10a697f6`에서는 Intel Mac용 1.0.0-test DMG를 생성해 디스크 이미지 체크섬을 검증했다. 앱과 FFmpeg 모두 x86_64이고, 내장 인코더는 검증된 Intel 원본과 일치한다. 패키지 안의 최신 Remote·발표자·방송 관련 파일 7개도 소스와 일치했다. 이 ARM Mac에는 x86_64 실행 환경이 없어 Intel 앱의 실행·로컬 수신은 미검증이다. 갱신된 폰트·캐시 검사는 Chromium과 WebKit에서 각 72개 한글 줄바꿈 사례를 통과했다. 이전 Mac ARM의 수신 증거와 Windows x64 패키지 검사는 위에 명시한 커밋 기준이다.

## 이전 동결 후보와 남은 출시 확인

16b1759c는 GitHub Desktop 41702219277의 Mac·Windows runner 모두 패키지 전체 6,090 renderer + desktop 21 일치 및 로컬 RTMPS 수신을 통과했다. 그 후보의 web 41702219337은 shard 0/1/3 성공, 2가 20분 제한으로 취소되어 전체 gate 완료가 아니다. 새 통합 후보에서는 모든 gate를 같은 SHA로 다시 실행한다.

현장 장비가 필요한 확인은 GC553·믹서 영상/음성 입력, CH8→LED/TV 배선과 실제 음성 싱크, 폰 잠금/망 전환 및 실제 예배 부하다. 실제 유튜브 채널 인입은 장비 확인과 별도로 채널 테스트 승인이 필요하다. 출시 절차에는 서명·공증, 실제 설치/업데이트와 자료·초안·설정 보존, Intel 실행 확인, 최종 제품 태그·업데이트 게시 승인이 남아 있다.
