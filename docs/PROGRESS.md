# 개발 진행 현황

기준일: 2026-11-06 (Asia/Seoul)

## 현재 Phase

Phase 2 구현·검증 완료. 다음 개발은 Phase 3 — JSON Tools. 이번 세션은 Phase 2 범위에서 종료한다. 아래 Phase 1 기록은 이전 세션 이력이며, 최신 검증 결과는 하단 Phase 2 기록을 기준으로 한다.

## 완료 작업

- 빈 작업 폴더와 Git 미초기화 상태 확인. 기존 파일 없음.
- 제공 지시서 전체를 PROJECT.md에 보존, AGENTS/README/PROGRESS/DECISIONS/ARCHITECTURE/TEST-CASES 생성.
- React 18, strict TypeScript, Vite, Tailwind, Zustand, Lucide 및 로컬 Monaco/Worker 구성.
- Side-by-Side 양쪽 편집, 파일 업로드·Drag & Drop·언어 감지·수동 언어·인코딩 선택.
- 독립 jsdiff 엔진, 원문 줄 종결자 보존, 변경 줄 번호·변경 목록·위치 탐색·휴리스틱 수정 표시.
- UTF8/BOM/UTF16 처리, fatal 디코딩, 바이너리 검사, 업로드 및 UTF8 편집 5 MiB 상한.
- 한국어 Dark UI, 작은 화면 레이아웃, 오류 상태·계산 상태, 예제 입력.

## 검증 결과

- npm run typecheck: 통과.
- npm run lint: 통과.
- npm test: 12/12 통과 (Vitest 5.1).
- npm run test:e2e: 2/2 통과 (설치된 Microsoft Edge, Playwright).
- 실제 Monaco 렌더링, Java/Python/C#/HTML 업로드 및 언어 설정, 변경 줄 위치·추가 강조·변경 탐색·직접 입력 후 재비교 검증.
- 파일 오류 메시지와 390px 뷰포트 수평 overflow 없음 검증.
- 브라우저 요청 감시에서 외부 요청 0건.
- Production Build 통과. Monaco 본체 약 3.52 MB(압축 약 917 KB), TS Worker 약 6 MB, chunk 크기 경고 있음.
- docs/phase1-desktop.png 생성 및 시각 검토.

## 해결한 오류

- ESLint 제어문자 정규식 경고: 문자 코드 검사로 교체.
- debounce 완료가 파일 오류를 지우던 문제: 업로드 오류와 비교 오류 상태 분리.
- Vitest가 Playwright 파일을 수집하던 문제: unit include 범위 명시.
- 테스트용 Chromium 미설치: 설치된 Edge 채널 사용.
- 초기 Vitest 관련 critical 취약점 2건: 최신 Vitest로 해소.

## 알려진 제약 / 미완료

- Monaco 시각 diff와 jsdiff 분석 목록은 독립 엔진. 모든 공백/대소문자/EOL 옵션 결과가 Monaco 강조와 다를 수 있어 화면 및 README에 안내.
- npm audit: dev-only minimatch 전이 의존성에 moderate 10건 남음. 호환 범위 audit fix로 해결되지 않음. 무리한 강제 downgrade/override는 하지 않았으며 후속 의존성 업데이트 필요. critical/high 0건.
- Worker 기반 Text Diff 계산·취소·대용량 성능 검증은 Phase 8. 현재 main-thread 250ms debounce, 1.5초 계산 timeout. 5 MiB는 측정된 성능 보장이 아닌 임시 상한.
- Light 테마, MiniMap, JSON Tools, Field Mapping, Patch, Folder, AST, 배포는 미구현. Unified와 코드 다운로드는 Phase 2에서 구현했다.
- Git 저장소 미초기화. 커밋·원격 연결·배포 수행 안 함.
- E2E 실행 환경은 Edge 필요. 다른 OS는 playwright.config.ts의 channel 변경 또는 Chromium 설치 필요.
- 배포 환경 및 모바일 실기기 미검증.

## 다음 작업

Phase 3에서 독립 JSON Tools 엔진·화면과 테스트를 구현한다. 시작 전 PROJECT/PROGRESS/DECISIONS와 Git 상태를 재확인한다. Text Diff에 JSON 의미론을 혼합하지 않는다.

## Phase 2 · 2026-11-06 · 이번 세션

### 시작 상태 대조

AGENTS, PROJECT, PROGRESS, DECISIONS, README 및 실제 소스·테스트를 확인했다. Git 미초기화 상태를 재확인했다. 기존 12개 단위 테스트·typecheck·lint 통과 후 진행했으며 이전 Phase 1 기록과 일치했다.

### 완료 기능

- Side-by-Side / Unified 전환, 기존 좌우 편집 및 Unified 수정본 편집, 편집 후 debounce 재비교.
- 추가·삭제·블록 통계 보존, 변경 파일 1쌍 기준 통계와 원문 줄 토큰 합계.
- 선택 변경 원문 단어/문자 강조, CRLF/LF/CR/EOF 표기, 20k code unit/200ms 상세 한도와 전체 블록 fallback.
- 기존 모든 공백·대소문자·EOL 옵션 보존, 줄 끝 공백/빈 줄 무시 추가. 필터 후 실제 물리 줄 번호와 끝 범위를 유지한다.
- 자동 줄바꿈, 변경 영역 접기/전체 보기, 문맥 줄 0/3/5/10 선택.
- 명시적 버튼을 통한 각 편집본 클립보드 복사와 UTF-8 다운로드. 비교 옵션은 저장 내용을 바꾸지 않는다.
- 계산 중 오래된 통계/목록 제거, 탐색 비활성화. 중복 비동기 업로드의 최신 요청만 수락하고 예제 입력은 대기 요청 무효화.

### 발견·해결 문제

- 실제 다운로드 E2E에서 CRLF가 LF로 바뀌는 기존 동기화 결함 발견. wrapper 프로그램 변경을 사용자 편집으로 역기록하지 않고 업로드 setValue로 EOL 감지하도록 수정.
- 빈 줄 제외 후 줄 번호·삽입/삭제 기준점·물리 끝 범위가 잘못 계산될 가능성을 원문 번호 토큰으로 방지. 한쪽 0줄 변경은 목록에 ‘없음 (위치 n)’으로 표시.
- E2E의 Unified DOM 가정과 높이 0인 접기 컨테이너 선택을 실제 Monaco 소스 기준으로 보정. 실제 삭제 강조·단일 열 폭과 보이는 접기 자식을 검증한다.
- 제한 환경의 포트 충돌을 피하도록 CODEDIFF_TEST_PORT 설정 지원.

### 최종 검증

- npm test: 20/20 통과 (기존 12 + 신규 8).
- npm run typecheck / npm run lint: 통과.
- npm run build: 통과. Monaco 큰 chunk 경고 유지 (main 약 3.525 MB, gzip 919 KB; TS Worker 약 6 MB).
- Edge Playwright: 5/5 통과 (기존 2 + 신규 3). 최종 테스트 포트 5192.
- Java/Python/C#/HTML 업로드·언어 설정·줄 강조·탐색·직접 입력 회귀 통과. 기존 외부 요청 감시 0건.
- Unified 실제 단일 열·삭제 강조, word 상세, 코드 복사, 실제 다운로드 CRLF 내용, 옵션 후 원문 저장, 빈 줄 필터 번호, 동일 영역 접기/복원, 수정 후 원본 유지와 수정본 CRLF, 390px Unified overflow 없음 통과.
- docs/phase2-desktop.png 및 phase2-mobile.png 생성·시각 검토. 기존 phase1-desktop.png도 회귀 테스트에서 재생성됨.

### 남은 제약과 다음 단계

- Monaco 시각 강조/영역 접기와 jsdiff 옵션 분석은 독립 정책. 공백/빈 줄/대소문자/EOL 옵션은 분석 목록에 적용되고 상세는 원문이다. 이 차이를 UI/README/ADR에 명시했다. 엔진 완전 일치는 미구현.
- 다운로드는 BOM 없는 UTF-8 편집 텍스트이며 원본 바이트 인코딩 복원이 아니다. 사용자 편집 후 혼합 EOL은 Monaco 모델 형식으로 통일될 수 있다.
- 대용량 main-thread 제한, MiniMap, Light 및 성능 측정은 후속 Phase. Monaco DiffEditor가 minimap을 내부적으로 비활성화하므로 작동하지 않는 토글은 제공하지 않았다.
- 의존성 변경 없음. 이전 보안 조회의 dev-only moderate 경고 10건은 이 세션에서 재조회하지 않았다.
- JSON/Mapping/Patch/Folder/AST/배포 미착수. 현재 진행 중 작업 없음. 다음은 Phase 3.
