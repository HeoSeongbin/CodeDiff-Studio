# 릴리스 검증표 — Phase 9

기준일: 2026-11-10 (Asia/Seoul). PROJECT.md의 최종 완료 조건과 실제 구현·테스트를 연결한다. 아래 확인은 명시한 환경과 지원 정책에 한정한다. 신규 CI workflow의 원격 실행은 작업 트리 검증과 별도로 PROGRESS에 기록한다.

| 요구사항 | 구현 / 검증 근거 |
| --- | --- |
| Java, C#, Python 등 코드 파일 비교 | core/file.ts, core/diff.ts; core/release 단위 테스트, compare E2E |
| HTML, CSS, JavaScript 비교 | 공통 Text 엔진과 언어 감지; release 확장자 행렬, compare E2E HTML, phase7 JS grammar |
| SQL 및 설정 파일 비교 | release 확장자 행렬; 실제 Pages SQL 업로드/Patch 및 Folder 결과 |
| 두 파일 업로드 | compare E2E, deployment CRLF 입력 |
| 코드 직접 입력 / 편집 후 재비교 | compare, phase2, phase3 E2E |
| Side-by-Side / Unified Diff | phase2/phase8 E2E, 실제 Pages 모바일 Unified |
| 추가·삭제·수정 표시 | core/phase2 단위 테스트, phase2 E2E; 수정은 삭제+추가 대응의 휴리스틱 |
| 줄 내부 변경 강조 | phase2 word/character 재구성, phase2 E2E 상세 |
| 정확한 줄 번호 | core/phase2/release 단위 테스트; 고정 seed250 입력에서 재구성·물리 위치·독립 편집거리 확인 |
| 변경 통계 / 위치 탐색 | core/release 테스트, compare/phase2/phase8 E2E |
| 공백 비교 옵션 | core/phase2/folder 테스트, phase2/phase5/phase6 E2E; 저장 원문 불변 |
| 파일 인코딩 | core/release UTF8/BOM/UTF16, invalid/binary/size; compare E2E |
| 결과 다운로드 | phase2–phase7 E2E, 실제 Pages 원문/JSON/Mapping/Patch/Folder 보고서 |
| JSON Structural Diff | json 단위, phase3 E2E, 실제 Pages null/부재·숫자/문자열 차이 |
| JSON Tree Viewer | phase3 E2E; 가상화·선택·경로 |
| JSON Formatter | json 단위, phase3 E2E, 실제 Pages formatting 후 저장 |
| JSONPath | json 단위 및 phase3 E2E; 임의 JS 평가 금지 |
| JSON Schema | json 단위 및 phase3 E2E; 생성/검증/다운로드 |
| TypeScript Generator | json 단위 및 phase3 E2E; 예약어 오류·생성 다운로드 |
| JSON ↔ CSV | json 단위 및 phase3 E2E; 인용/줄바꿈/타입/flatten/수식 방어 정책 |
| Field Mapping | mapping 단위 및 phase4 E2E, 실제 Pages Target 다운로드 |
| Patch Export | patch/patch-git/release 단위·Git 통합, phase5 E2E, 실제 Pages 다운로드 재적용 |
| Folder Compare | folder 단위, phase6 E2E, 실제 Pages 네이티브 폴더·상태·보고서·원본 디스크 불변 |
| AST 지원 범위 검증 | syntax 단위·실제5개 WASM; phase7 E2E와 실제 Pages Java/C#/Python/JS/TS |
| 대용량 파일 처리 | 기존 Phase8 성능12시나리오 결과(PERFORMANCE.md), 이번 phase8 전체 회귀;5MiB/시간/목록 상한 적용 |
| Dark/Light 모드 | phase8 E2E; 모든 작업 공간·MiniMap·모델 수·패널·핵심 텍스트 대비 |
| 자동화 테스트 | Vitest351/351, production Edge31/31, 실제 Pages Edge8/8; 원격 신규 CI 결과는 별도 확인 |
| GitHub Pages 배포 | 2026-11-09 Actions 배포 성공 및2026-11-10 실제 주소8개 시나리오 통과 |
| PROJECT / AGENTS / README / PROGRESS / DECISIONS 관리 | 기준 요구사항 보존, 현 상태와 제한·검증을 문서화 |

## 재현

Git CLI, Node24.12.0, npm, 설치된 Microsoft Edge를 사용한 Windows 검증이다.

```powershell
npm ci
npm test
npm run typecheck
npm run lint
npm run build
$env:CODEDIFF_TEST_PREVIEW = '1'
npm run test:e2e -- --workers=1
Remove-Item Env:CODEDIFF_TEST_PREVIEW
$env:VITE_BASE_PATH = '/CodeDiff-Studio/'
npm run build
npm run test:deployment -- --workers=1
Remove-Item Env:VITE_BASE_PATH
$env:CODEDIFF_DEPLOYMENT_URL = 'https://heoseongbin.github.io/CodeDiff-Studio/'
npm run test:deployment -- --workers=1
Remove-Item Env:CODEDIFF_DEPLOYMENT_URL
```

성능은 별도 `npm run test:perf`로 실행한다. 이번 Phase9에서는 시간/heap benchmark를 다시 측정하지 않았으며 Phase8 측정값을 새 측정값으로 보고하지 않는다. E2E가 docs의 화면 이미지를 재생성할 수 있으므로 새 검증 화면과 기존 Phase의 이력 이미지를 구분한다.

## 제한과 후속 확인

- 비교 옵션은 분석 목록에 적용된다. Monaco 시각 Diff와 원문 Patch는 독립 정책이며 모든 옵션에서 시각 결과가 동일하다고 보장하지 않는다.
- 대용량 처리는 보호 상한 안에서 수행한다. 모든 기기에서 즉시 완료/메모리 일정/메인 스레드 지연0을 보장하지 않는다.
- Syntax rename은 후보이며 이동/의미 동등성·모든 최신 문법·TSX를 지원한다고 주장하지 않는다.
- Firefox, Safari, 모바일 실기기 및 전체 WCAG 적합성 인증은 미검증이다. Windows Edge 검증과 과거 Ubuntu CI Chromium smoke 결과를 구분한다.
- 신규 reusable CI의 원격 실행, PR 이벤트 및 배포 gate는 커밋·푸시 후 Actions 결과 확인이 필요하다. 로컬 테스트로 원격 성공을 대신 표시하지 않는다.
