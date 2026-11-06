# CodeDiff Studio

브라우저에서 소스 코드를 로컬 비교하는 React + TypeScript 개발 도구. 이번 버전은 **Phase 0–2** 범위입니다. 전체 요구사항은 [PROJECT.md](PROJECT.md)를 참고하세요.

## 실행

Node.js 22.12+ 권장 (검증 환경 24.12.0).

```sh
npm ci
npm run dev
npm test
npm run typecheck
npm run lint
npm run build
```

## 구현 기능

- Monaco Side-by-Side / Unified Diff 전환, Side-by-Side 양쪽 편집, Unified 수정본 편집, 언어별 구문 강조·줄 번호·줄 내부 변경 표시
- 두 파일 업로드, 각 파일 영역 Drag & Drop, 직접 편집, Java 예제
- 언어 자동 감지 및 수동 선택, UTF8/BOM/UTF16 LE·BE 디코딩
- 변경 블록 목록과 위치 이동, 추가·삭제 연산 수, 수정 추정 표시
- 공백·줄 끝 공백·빈 줄·대소문자·줄바꿈 분석 옵션, 250ms debounce
- 선택 변경의 원문 단어/문자 강조 및 CRLF/LF/CR/EOF 표기
- 자동 줄바꿈, 동일 영역 접기와 문맥 줄 수 선택
- 각 편집본 복사·UTF-8 다운로드, 변경 파일·총 비교 줄 수 통계
- 바이너리·잘못된 인코딩·5 MiB 초과 업로드 오류 표시
- 한국어 Dark UI, 작은 화면 대응. 파일·코드는 외부로 전송하거나 영구 저장하지 않습니다.

## 비교 방법

Original/Modified의 파일 열기 또는 각 영역 드롭으로 두 파일을 선택하세요. 언어는 마지막 업로드 파일 기준이며 수동 변경할 수 있습니다. 편집기 양쪽에서 직접 입력할 수 있고 변경 목록을 클릭하거나 화살표를 사용하면 해당 줄로 이동합니다. Ctrl/Cmd+F 검색과 선택 복사는 Monaco 기본 기능을 사용합니다. 업로드 인코딩 변경 후 파일을 다시 선택하세요.

Java, C#, Python, Go, Kotlin, Rust, C/C++, HTML, CSS, SCSS, JS/JSX, TS/TSX, Vue, SQL, JSON/JSONL, XML, YAML, Properties/INI/CONF/ENV, TXT/Markdown/LOG, Shell/PowerShell/Batch 등 텍스트를 지원합니다. 알 수 없는 확장자는 Plain Text입니다. Vue는 HTML 강조, JSONL은 Plain Text입니다. 바이너리·PDF·Word·이미지 비교는 지원하지 않습니다.

## 아키텍처와 제약

[ARCHITECTURE](docs/ARCHITECTURE.md), [설계 결정](docs/DECISIONS.md), [진행 상황](docs/PROGRESS.md), [테스트](docs/TEST-CASES.md).

jsdiff 원문 줄 토큰에 비교 옵션을 적용하고 실제 원문은 보존합니다. 수정은 같은 블록의 삭제·추가를 묶은 추정이며 이동 감지는 없습니다. Monaco 시각 강조와 분석 엔진은 독립적입니다. Monaco 공백 무시는 줄끝 공백 기준이며 분석 목록의 모든 공백 무시, 대소문자/EOL 옵션과 다를 수 있습니다. 빈 줄 무시 역시 분석 목록에 적용되며, 변경 상세는 원문을 표시합니다. 변경 영역 접기는 Monaco 결과 기준입니다. 화면에도 이를 안내합니다.

업로드 크기 정보는 업로드 시점 바이트 수입니다. BOM 없는 UTF16은 수동 선택해야 합니다. 각 파일의 저장 (UTF-8)은 현재 편집본을 BOM 없는 UTF-8로 다운로드합니다. 비교 옵션은 저장 내용에 영향을 주지 않습니다. 편집 전에는 업로드 텍스트의 혼합 개행도 보존하며, 편집 이후 Monaco가 파일 전체 개행을 모델의 형식으로 통일할 수 있습니다. 대용량 Worker·성능 측정, Light 모드, MiniMap, Patch는 후속 단계입니다.

JSON 도구·Field Mapping·Folder Compare·Syntax Compare는 아직 제공하지 않습니다. 레일 아이콘은 예정 기능 표시이며 작동 버튼이 아닙니다. 배포 주소는 아직 없으며 GitHub Pages 및 Actions는 Phase 9 예정입니다. Vite base는 상대 경로로 설정했습니다.

## 화면

![Phase 2 코드 비교 화면](docs/phase2-desktop.png)

테스트 도구는 Vitest 5 및 ESLint 10으로 업데이트 후 검증했습니다. 개발 의존성의 minimatch 관련 moderate 보안 경고 10건이 남아 있으며 상세 상태는 PROGRESS에 기록했습니다. E2E는 설치된 Microsoft Edge를 사용합니다.

## Phase 2 사용법

상단 보기 선택으로 Side by side / Unified Diff를 전환하세요. Unified는 원본 삭제 줄과 수정 줄을 한 열에 표시하며 원본 편집은 좌우 보기에서 수행합니다. 변경 목록을 선택하고 상세 단위를 단어 또는 문자로 바꾸면 원문 변경을 볼 수 있습니다. 상세는 20,000 UTF-16 code unit 또는 계산 200ms를 넘으면 전체 블록 표시로 전환합니다.

공백 무시는 개행 이외 모든 공백 제거, 줄 끝 공백 무시는 행말 공백만 제거, 빈 줄 무시는 공백만 있는 행을 제외하여 분석합니다. 원문 줄 번호는 그대로 유지합니다. 총 비교 줄 수는 두 원문의 줄 토큰 수 합계이며 마지막 개행 뒤의 가상 빈 줄을 세지 않습니다. ‘변경 파일’은 두 입력을 비교하는 1쌍 기준입니다. 추가·삭제 줄 수는 수정 추정 블록에 포함된 연산도 셉니다.

`npm run test:e2e`는 로컬 Edge를 사용합니다. 포트 충돌 시 PowerShell에서 `$env:CODEDIFF_TEST_PORT='5192'`로 테스트 포트를 바꿀 수 있습니다. 실제 배포·JSON 분석 도구는 아직 구현하지 않았습니다.
