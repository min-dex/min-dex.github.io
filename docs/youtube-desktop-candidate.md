## 1.0.9 합성 주기 수정 후보 · 2026-11-13

설치 앱의 예약된 합성은 모니터 주사율 대신 인코더와 같은 30fps를 따른다.
1080p·비트레이트·오디오·750ms 자막 전환은 유지한다. 숨겨진 본당 출력의
직접 프레임 요청은 건너뛰지 않고, 장시간 멈췄다 돌아와도 밀린 프레임을
몰아서 그리지 않는다. 독립 웹 시제품의 해상도/주기는 이번 변경 밖이다.

64fps 합성과 함께 실행하던 Windows 진단은 종료 시간 초과를 재현했다.
30fps 시험 조건의 private run 43376405677 (8b13536d)은 기존 종료·패킷·음성
검사를 유지한 채 통과했다. 이 결과는 원인을 좁힌 근거이며 새 설치본의
검증을 대체하지 않는다. 실제 수정 소스는 주사율/반올림/복귀 unit 검사,
캡처 끊김/방송 차단 검사와 1080p browser 제어 검사를 통과했다.
동일 SHA의 전체 웹·Windows·Mac 설치/보존 gate 후에만 게시한다.

## 1.0.9 Windows 송출 종료·파비콘 후보 · 2026-11-11

비공개 소스 전환은 사용자 요청으로 준비만 유지한다. 이 후보는 현행 공개
1.0.8에서 분리했으며 이관 workflow·게시 경로·권한·refs 변경을 포함하지 않는다.
Windows 종료 지연은 미해결이다. 효과가 입증되지 않은 pipe acceptance 변경은
후보에서 제거했다. 고정 WebM 입력은 Windows 정상 종료와 녹화·수신 패킷
동일성 검사를 통과했으며 브라우저 캡처 경로는 진단 중이다. Safari Dawn
ICO/PNG 경로를 포함한다. 해결 전 게시하지 않는다.
공개 1.0.8에서 1.0.9로 격리 업데이트하며 자료·초안·설정 보존을 검사한다.
기존 1.0.8 asset은 불변이다. 현재는 후보이며 전체 gate·공개 게시 완료가 아니다.

## 방송실 안정화 우선순위 ·2026-11-09

NDI 송수신은 후속 범위다. 우선 현장 경로인 AV 믹서 PGM(HDMI 영상·음성)
→ GC553 → 설치 앱 합성 → 본당 출력·YouTube RTMPS를 안정화한다.
본당용 합성 출력이 다시 카메라 입력 PGM에 포함되지 않도록 하는 실제
믹서 라우팅은 장비 확인 항목이며, 소프트웨어만으로 검증했다고 보지 않는다.

장치 트랙의 종료 감시는 스트림을 받은 즉시, 영상 재생·오디오 초기화 대기보다
먼저 등록한다. 이미 종료된 스트림은 준비 완료로 전환하지 않는다. 준비 중
연결이 끊기면 입력을 해제하고 기존 onStop 경로로 송출 준비/진행을 취소한다.
늦게 끝난 이전 연결은 새 연결을 중단하거나 준비 완료로 되돌릴 수 없다.

`tests/test_broadcast_capture.mjs`는 장치 없이 연결 중 종료, 이미 끝난 트랙,
권한 대기 중 취소, 재연결, 오래된 트랙 이벤트, 방송 제외/복귀의 영상·음성
분리를 검사하며 Cloud 기본 검사에 등록한다. 본당 오디오 경로는 유지하고,
방송 제외·자막 준비 상태 중 하나라도 남아 있으면 방송 음성은 0을 유지한다.
이 검사는 실제 GC553 인식·HDMI 오디오·장시간 A/V 싱크·현장 디스플레이와
YouTube 실송출 확인을 대체하지 않는다. 실제 방송은 켜지 않는다.

## 운영 송출창 구성

유튜브 미리보기가 기본 화면이다. 설정은 영상 입력, 자막, 송출 순서로 두고
본당 출력과 수동 자막은 필요할 때 펼친다. 영상 장치는 설치 앱에서 바로 연결한다. 믹서의 실제 입력 번호는 장비 배선에 따르며 조작 화면에는 표시하지 않는다. 설치 앱은 실제 영상 입력을
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

Electron 메인 프로세스는 방송 창의 최상위 로컬 문서만 받아들이며 목적지는 YouTube 기본 RTMPS 서버로 고정한다. FFmpeg는 WebM 입력을 H.264 1080p30과 AAC 48 kHz로 변환한다. 메인 프로세스가 TLS 인증서를 검사하고 RTMP 바이트를 전달한다. 송출 중 표시는 인코더의 전송 진행을 뜻한다. 시청자 공개 여부는 YouTube Studio 설정을 따른다.

패키징 전에 해당 OS에서 `python tools/broadcast-engine/prepare.py`를 실행한다. Mac ARM·Intel과 Windows x64 인코더는 타깃별 고정 해시로 준비한다. unsigned 시험 패키지는 외부 서버를 사용할 수 없고 로컬 수신기와 시험 인증서가 필요하다. 로컬 검증은 별도 프로필로 패키지 메뉴를 열고 수신한 캡션·음성, 차단·복원, 종료·연결 해제를 검사한다. 실제 YouTube 인입, GC553·믹서, 대상 OS별 서명 설치 승인은 별도 단계다.

## 통합 후보 수신 기록

검증한 소스는 `d87ab8033876ab3df9ed451264975149012c3957`이며 공개 main `0a9358f8`을 포함한다. Mac ARM 시험 앱의 실제 메뉴에서 테스트 키를 입력한 뒤 회선 하나로 하단 자막과 음성 → 차단 안내와 무음 → 복원을 로컬 수신 파일에서 확인했다. CH8 유지, 정상 종료, 수신기 강제 단절 후 조작 복구도 통과했다.

같은 커밋으로 Mac ARM과 Windows x64의 미서명 앱 디렉터리를 각각 만들었다. 두 앱의 빌드 신원은 1.0.0 test이며 방송 관련 파일 9개와 플랫폼별 FFmpeg가 원본과 바이트 단위로 일치했다. Windows 검사는 PE x64 및 패키지 내용까지다. 해당 후보의 Windows 설치·실행·네임드 파이프 키 전달·수신, Mac Intel 실행, 서명·공증·업그레이드, 실제 폰·캡처보드·CH8 배선·유튜브 채널은 별도 확인 대상이다.

최신 main `c9563ca1`을 통합한 후보 `10a697f6`에서는 Intel Mac용 1.0.0-test DMG를 생성해 디스크 이미지 체크섬을 검증했다. 앱과 FFmpeg 모두 x86_64이고, 내장 인코더는 검증된 Intel 원본과 일치한다. 패키지 안의 최신 Remote·발표자·방송 관련 파일 7개도 소스와 일치했다. 이 ARM Mac에는 x86_64 실행 환경이 없어 Intel 앱의 실행·로컬 수신은 미검증이다. 갱신된 폰트·캐시 검사는 Chromium과 WebKit에서 각 72개 한글 줄바꿈 사례를 통과했다. 이전 Mac ARM의 수신 증거와 Windows x64 패키지 검사는 위에 명시한 커밋 기준이다.

## 이전 동결 후보와 남은 출시 확인

16b1759c는 GitHub Desktop 41702219277의 Mac·Windows runner 모두 패키지 전체 6,090 renderer + desktop 21 일치 및 로컬 RTMPS 수신을 통과했다. 그 후보의 web 41702219337은 shard 0/1/3 성공, 2가 20분 제한으로 취소되어 전체 gate 완료가 아니다. 새 통합 후보에서는 모든 gate를 같은 SHA로 다시 실행한다.

현장 장비가 필요한 확인은 GC553·믹서 영상/음성 입력, CH8→LED/TV 배선과 실제 음성 싱크, 폰 잠금/망 전환 및 실제 예배 부하다. 실제 유튜브 채널 인입은 장비 확인과 별도로 채널 테스트 승인이 필요하다. 출시 절차에는 서명·공증, 실제 설치/업데이트와 자료·초안·설정 보존, Intel 실행 확인, 최종 제품 태그·업데이트 게시 승인이 남아 있다.


## 2026-11-09 송출·녹화 기본값 (소스 후보, 미배포)

설치 앱 캡처 입력은 1920×1080/30fps를 요청하고 합성 캔버스도 1920×1080을 사용한다.
장치가 낮은 해상도를 반환하면 실제 디테일은 늘어나지 않는다. 기존 720p 슬라이드 가져오기와
독립 브라우저 데모의 좌표·기본 해상도는 유지한다.

송출은 H.264 libx264 veryfast, CFR 30fps, CBR 14,000 Kbps, GOP 60프레임(2초),
AAC 128 Kbps/48 kHz/stereo다. 비트레이트는 5,000~30,000 Kbps 정수로 바꿀 수 있고
다음 실행에 유지한다. 하드웨어 인코더 자동 선택은 이 후보에 포함하지 않는다.
브라우저→FFmpeg 입력은 여전히 VP8/Opus로 압축되며 영상 목표 비트레이트는
max(20 Mbps, 송출 비트레이트×2)다. 따라서 카메라 원본 무손실 녹화라고 부르지 않는다.

‘송출과 같은 품질로 녹화’가 기본 선택된다. 시작할 때 MP4 저장 위치를 고른다.
대화상자를 취소하면 송출도 시작하지 않는다. 기존 파일 덮어쓰기는 금지한다.
H.264/AAC를 한 번 인코딩한 fragmented MP4 바이트를 파일과 RTMP remuxer에 함께 전달한다.
송출·녹화의 압축 패킷은 동일하며 녹화용 별도 인코더는 없다. 송출 종료 시 녹화도 종료된다.
네트워크/디스크 오류나 앱 종료 시 함께 중단되므로 남은 파일의 마지막 부분을 확인해야 한다.
장시간 현장 실시간 성능, 캡처보드와 음성 싱크, 실제 YouTube 인입은 별도 현장 검증 대상이다.

검사 진입점: `node --test tests/test_youtube_profile.cjs` (Cloud 등록),
`node tests/test_broadcast_profile_browser.cjs` (Playwright 필요),
`node tests/test_youtube_engine_local.cjs /path/to/ffmpeg` (동일 디렉터리 ffprobe 필요).
로컬 TLS 수신기로 1080p30/GOP 60, 정상 종료 및 녹화/수신 영상·음성 패킷 해시 일치를 검사한다.
기존 packaged desktop acceptance는 기본값·캔버스 크기를 검사하고 녹화 선택을 해제한 송출 경로를 유지한다.


The packaged acceptance opens the installed app's broadcast window and exercises
the real dialog IPC with synthetic cancel and MP4 destination results. It
checks that cancel never contacts the local receiver and that the completed
recording has the same encoded packet hashes as the local RTMPS stream.

### 2026-11-13 설치 검사 정리 보완

ba4df4f1의 Windows TEST 및 교회용 설치본은 모두 기존 RTMPS 종료·동일 패킷·
음성 차단/복귀 검사를 통과했다. 교회용 보존 검사도 seed/upgrade 해시를
출력했으나, 미저장 가상 편집창을 닫는 정리 단계 이후 진행되지 않아 해당
실행 43377489937을 취소했다. 공개 1.0.8 업데이트 보존과 Intel gate는 이
시도에서 완료되지 않았으며 취소를 성공으로 취급하지 않는다.

후속 테스트는 오류를 정리 전에 기록하고, 격리/소유 임시 프로필 확인 후
가상 창만 강제 종료한다. 저장된 fixture는 다음 restart 검사까지 유지한다.
RTMPS 테스트의 마지막 OS 종료 확인도 격리 정리 단계에서만 응답한다.
제품 종료 보호, 원래 검사·기한·실패 exit는 변경하지 않는다.
로컬 1.0.8 격리 프로필에서 seed/upgrade/restart와 자료 해시 보존·정리 종료를
확인했으며, 후보 설치본에 대한 전체 동일 SHA 검사는 별도로 다시 수행한다.
