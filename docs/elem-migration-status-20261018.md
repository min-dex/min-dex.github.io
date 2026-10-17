# Mindex-for-Elem 통합 현황 · 2026-10-18

## 확인 범위

보존된 Mindex-for-Elem README와 Swift 소스, 현재 Mindex 웹/Electron 소스를 비교했다.
이 문서는 기능 구현 비교이며 모든 물리 출력 장치의 실사용 인증은 아니다.
기존 Weeks 기록·배경·봉헌 영상·명단 전체의 운영 DB 이관 여부는 별도 대조 대상이다.

## 통합된 핵심

- 어린이 곡 버전에 음원·가사 페이지·타이밍·지문을 함께 보관한다. 38곡 운영 검증 기록은 기존 children-seven-sync-completion 보고서에 있다.
- `children_audio` 입력 모드에서만 자료를 불러와 음원과 가사를 자동 넘긴다. 다른 입력 모드의 사용자 가사·송폼은 유지한다.
- 수동으로 장을 넘기면 자동 넘김만 멈추고 음악은 계속 흐른다. 타이밍 편집·현재 시각 기록·저장·미리 듣기·위치 이동을 지원한다.
- 이번 변경은 제목의 P 재생과 어린이 예배 입력 UI 정리다. P는 시작 전용이며 Elem의 S 토글과 동일하지 않다.
- 예배별 편집·저장, 성경 조회, 미디어 입력, 미리보기/별도 송출은 Mindex 기존 기능을 사용한다.

## 미이관 또는 부분 지원

| Elem 기능 | 현재 Mindex와 차이 | 근거 |
| --- | --- | --- |
| 아이패드 원격 조작 | QR/연결 번호로 붙어 현재 장·목록·좌우 터치/스와이프·음원을 제어하는 별도 원격 콘솔은 미이관. Mindex 접속 현황 패널은 상태 확인용이다. | Elem Remote/RemoteConsole*.swift, Mindex mindex.monitor.js |
| 자동 넘김 복귀 R | 수동 전환 뒤 현재 재생 시각에 맞춰 자동 넘김만 복귀하는 기능은 없다. 기존 자동 넘김 재생 버튼은 곡 처음부터 재시작한다. | Elem SongAudioPlayer.resumeAutoAdvance, Mindex mindex.song-timing.js play |
| 음원 서서히 끄기 | Elem S의 1.2초 fade-out 정지 동작은 미이관. 새 P는 제목에서 재생 시작만 한다. | Elem SongAudioPlayer.fadeOutAndStop, Mindex service music transport |
| 박자 맞춤 타이밍 입력 | 시각 직접 입력/현재 시각 기록은 지원하지만 BPM 분석·가까운 박에 붙이기·±0.2초 전용 조정은 미이관. 오프라인 분석으로 38곡을 검수한 것과 앱의 자동 분석 UI는 다르다. | Elem BeatGrid.swift / SongTimingPanel.swift, Mindex mindex.song-timing.js open |
| 어린이 성경책 쪽수 | 장별 실물 성경 쪽수표를 관리하여 봉독 표지에 p.152처럼 붙이는 기능은 미이관. 검색 결과의 페이지 번호와 별개다. | Elem Model/BiblePages.swift 및 README 성경 쪽수, Mindex scripture rendering |
| 헌금위원 명단표 | 기존 Mindex 담당자 입력/교회력 연결은 있으나 Elem의 날짜별 헌금위원.md 읽기·명단대로 복귀·주차별 예외 편집 흐름은 미이관. | Elem OfferingCommitteeField / 명단 모델, Mindex service assignee handling |
| Keynote 고급 처리 | Mindex macOS Electron에 Keynote 단계별 PNG 반입은 있다. Elem의 원본 CALayer 애니메이션 재생·타임라인 되감기와 첫 두 장의 안내 양식 자동 추출/제외는 동등하게 이관되지 않았다. 웹 Pages 배포에는 네이티브 .key 반입이 없다. 웹 PPTX 경로와는 별개다. | electron/keynote-importer.js keynoteExportScript, Elem KeynoteScene*.swift / KeynoteExporter.swift |
| 전체 예배 PNG 내보내기 | Elem SlideExporter의 전체 덱 1920×1080 PNG 일괄 내보내기는 Mindex presenter에 같은 기능이 확인되지 않았다. | Elem Views/SlideExporter.swift / CLI --export-png |

## 의도적으로 그대로 옮기지 않는 것

- Notion 가사/예배/타이밍 동기화: 사용자 결정에 따라 Mindex DB가 원본이다.
- Elem 고정 29항목 예배 순서와 화면 디자인: Mindex 현행 예배 모델과 출력 규칙에 맞춰 적용한다. 과거 UI를 통째로 복제하지 않는다.
- macOS 자료 폴더/iCloud zip/Sparkle 업데이트 방식: Mindex 저장·배포 체계를 사용한다. 완전 오프라인 운영과 과거 주차 데이터는 자동 이관되었다고 가정하지 않는다.

## 다음 적용 후보

찬양 운영 편의는 현재 위치에서 자동 넘김 복귀 → fade-out 정지 → 박자 맞춤 편집 순으로 검토할 수 있다.
아이패드 원격 조작은 연결·권한·동시 조작 정책을 먼저 정해야 하므로 별도 기능으로 설계한다.
이 문서는 후속 구현을 승인하거나 운영 DB를 변경하지 않는다.
