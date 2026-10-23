# Friday Prayer Music and Button States

## Scope

- Friday free-prayer items (slot `prayer.meeting.free` or exact label `자율기도`) offer a dedicated player at the element, separate from sidebar background music.
- Other service types do not receive this player. Existing explicit slide audio is unchanged.
- Selection and rendering never start playback. The operator starts music explicitly.
- Play/pause, stop, repeat and volume have independent session state and a persistent, lazily created Audio instance. Navigation does not stop playback. No worship records or schema are changed.
- While output is open, the topbar offers a return to the live service from other views, protecting unsaved edits and preserving output/index without reloading service data.
- Presenter/editor button hover, pressed, busy and disabled states use existing theme tokens. Disabled pointer handling remains unchanged.
- The section editor uses the existing ordinal display helper without rewriting untouched labels.

## Global transport (2026-10-17)

- The topbar shows the active music title/state with play/pause and stop across
  module/tab navigation. Stopped/paused loaded music keeps a restart control.
- Global controls target the active audio owner, even when a different service
  is selected. They reuse the same Audio instance and never select another file.
- An open output shows its service title, return-to-service and output-stop.
  Returning keeps the existing unsaved-edit guard. Stopping output does not
  stop independently playing music; stopping music does not close output.
- Pending playback can be cancelled from the global toggle. Rendering never
  starts playback. No fade, music data or worship-record changes are included.
- Offline Chromium/WebKit coverage: `tests/smoke_global_playback.py`.

## Audio

- Original supplied M4A, unchanged, approximately 46 minutes 42 seconds.
- SHA-256: `8c888a525cde94b7fbd91046f0ee774a7ba8fda06a199646112b201eb57f72da`
- Path: `assets/presenter/friday-free-prayer.m4a`
- No transcoding, trimming, automatic playback or database upload.

## Verification

- `tests/smoke_friday_music.py`: Chrome/WebKit player isolation, explicit playback, repeat, stop, compact layout and guarded live-service return. Audio playback is stubbed; original AAC metadata was verified in the initial release.
- `tests/smoke_section_label_display.py`: singleton/peer/custom labels and unchanged-source preservation.
- Physical church audio routing is not covered by these local tests.

## Release Status

Prepared and verified in an isolated worktree. The DB task confirmed that this UI-only release can proceed; its inactive atomic-storage changes in the root worktree are excluded.

## Optional fade-out stop · 2026-10-18

- 송출·음악의 `페이드아웃 정지` 체크박스는 기기 localStorage에 저장하며 기본은 해제다.
- 명시적인 음악 정지만 1.2초 동안 음량을 줄인 뒤 처음 위치로 정지한다. 한 번 더 정지하면 즉시 멈춘다.
- 일시정지, 준비 취소, 송출 종료와 음원 교체는 즉시 처리한다. 이전 fade timer는 취소되고 설정 볼륨을 복구한다.
- fade 중 볼륨 조정은 남은 감쇠 비율에 적용한다. 체크 해제는 진행 중인 정지를 즉시 완료한다.
- 운영 음원과 예배 저장 데이터는 변경하지 않는다.

## Shared playback position · 2026-10-20

- 음악 관리의 음원 위치 슬라이더는 동기화 여부와 관계없이 현재 Audio 소유자의 재생 위치를 조절한다. 재생/일시정지 상태와 음원 소유자는 유지한다.
- 길이를 아직 모르는 음원은 비활성화하며 metadata/duration 변경 시 갱신한다. 다른 음원에서 남은 입력은 무시한다. 자동 넘김 복귀는 동기화 음원에만 표시한다.
- 상단 버튼의 상태 점은 공간을 예약하지 않는다. 홈은 5px 리듬과 큰 간격 10px 단위를 사용하며 삭제된 큰 카드 전용 규칙은 제거한다.

- 재생 위치를 조절한 뒤 입력칸에 키보드 포커스가 남아 있어도 슬라이더는 실제 재생 시간을 따라간다. 포인터로 드래그하는 동안만 자동 위치 갱신을 보류한다.
- 음악 관리에서는 음원 위치와 고정 폭 숫자 시간을 윗줄, 전체 폭 슬라이더를 아랫줄에 배치한다. 화면 이동은 Audio 인스턴스·소유자·재생 상태를 교체하지 않는다.

### 음악 관리 패널 배치

- 제목/닫기 → 곡명·상태 → 위치·시간·슬라이더 → 재생·정지·페이드아웃 설정 한 줄 순서로 배치한다.
- 조작 버튼은 각각 30px 높이이며 아이콘과 짧은 텍스트를 함께 표시한다. 상태는 보조 색상으로 두고 곡명을 우선한다.

- 컨트롤러 자율기도 조작은 고정 너비 재생 버튼, 정지, 음량 순서를 유지한다. 연결 음원은 파일명·관리 작업을 첫 줄, 전체 폭 기본 미리 듣기 재생창을 둘째 줄에 둔다. 좁은 화면에서만 관리 작업을 아래로 줄바꿈한다. 기존 미리 듣기와 실제 송출 음원의 소유권·재생 방식은 변경하지 않는다.

### Controller slot / children alignment

- 자율기도와 어린이부 연결 음원은 부모 영역 전체 폭, 상단 음원명/조작·하단 재생 위치 구조를 사용한다. 과거 어린이부 전용 flex 배치 덮어쓰기는 제거한다.
- 자율기도 위치 슬라이더는 현재 source와 service owner가 모두 일치할 때만 활성화된다. 다른 예배의 같은 음원을 탐색하거나 조절하지 않는다. 아직 불러오지 않은 음원은 비활성화한다.
- 어린이부 기본 audio 재생창은 미리 듣기이며 자동 넘김 송출 경로는 기존대로 유지한다.

### Spacing / usability audit

- 음악 관련 중복 덮어쓰기 규칙을 하나의 영역으로 통합한다. 내부 간격5px, 조작 그룹 간격10px, 버튼 높이30px를 사용한다. 기본 media 재생창은 브라우저의40px 높이를 유지한다.
- 고정520px 상한과 viewport640px 예외는 제거한다. 부모 영역 폭과 내용의 최소 너비에 따라 자연스럽게 줄바꿈하며, 긴 파일명은 전체 내용을 title로 제공한다.
- 재생 위치는 항상 음원명/조작 다음 줄에 두고 전체 가용 폭을 쓴다. 숫자는 tabular-nums와 최소11ch를 사용해 시간 갱신에 따른 흔들림을 줄인다.

- 음악 UI는 민덱스의 field/panel/line/ink 토큰을 재사용한다. 위치 트랙은 중립 색상, 키보드 포커스는 안쪽 accent 테두리로 표시한다. 기본 audio의 내부 스타일을 지원하는 브라우저에서는 둥근 미디어 캡슐을 기존 필드 반경·표면에 맞추며, native controls와 키보드 기능은 유지한다.

### Button state final review

- 음악 조작은 중립 버튼, 재생/반복 활성 상태만 accent-soft를 사용한다. 비활성 버튼은 공통 보조 글자색·투명 배경이며 클릭해도 배치가 움직이지 않는다.
- 음악 관리·컨트롤러·연결 음원 작업 버튼의 키보드 포커스는 안쪽2px outline을 사용한다. 저장·삭제 등 다른 명령과 송출 화면에는 적용하지 않는다.

### Volume control ·2026-10-24
Volume uses a compact speaker/slider/percentage field (0–100%, 1% keyboard steps).
The internal 0–5 scale and audio owner/fade handling remain unchanged. Input
updates transport text in place rather than rebuilding the controller, preserving
slider focus and drag. Narrow controls wrap without overflow.

The free-prayer play button warms metadata on pointer hover or keyboard focus
using a separate muted, metadata-only Audio. It never calls play, changes the
shared audio/source/owner, or runs from rendering. Warmup stops after metadata
or ten seconds; failure permits a later retry. The original media is unchanged.
This reduces first-click waiting when there is preparation time; it cannot
guarantee instant playback on a cold or slow network.
