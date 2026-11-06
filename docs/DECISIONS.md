# 설계 결정 (ADR)

## ADR-001 · 2026-11-06 · 프론트엔드와 Monaco

- 문제: 로컬 전용 편집 가능한 코드 비교.
- 대안: textarea 자체 렌더러, CodeMirror, Monaco.
- 선택: React 18 + strict TypeScript + Vite 6, Tailwind Vite 플러그인, Zustand 5, Monaco 0.52 + React wrapper 4.7.
- 이유: 안정된 peer 범위와 두 편집기·언어 지원. UI에서 Lucide 사용.
- 장단점: 검증된 편집 기능 / 큰 번들. Monaco와 언어 Worker를 로컬 번들에 포함하여 CDN을 사용하지 않는다.
- 영향: main.tsx, app/App.tsx, package.json. lockfile과 build로 호환성 검증.

## ADR-002 · 2026-11-06 · Text Diff 및 수정 판정

- 문제: 정확한 추가·삭제와 줄 번호, 추정 수정의 구분.
- 대안: 자체 LCS, jsdiff, Monaco 결과만 사용.
- 선택: jsdiff diffArrays의 원문 줄 토큰과 비교자. 줄 종결자를 보존하고 빈 파일은 0 토큰. 연속된 제거/추가를 블록으로 정규화. 양쪽 연산이 있는 블록은 수정 추정.
- 장단점: UI와 독립 테스트 가능 / Monaco의 시각 강조 알고리즘과 결과가 다를 수 있음. 특히 대소문자·EOL 옵션은 분석 목록에 적용되며 화면에 명시한다.
- 영향: core/diff.ts. Unicode, 반복 코드, EOF, CRLF 테스트 필요. 계산 제한 1.5초, debounce 250ms.

## ADR-003 · 2026-11-06 · 파일 인코딩과 크기

- 문제: 잘못된 텍스트를 정상으로 처리하지 않기.
- 대안: 자동 추측 라이브러리, UTF8 고정, BOM + 수동 선택.
- 선택: UTF8 기본, UTF16 LE/BE BOM 자동 감지, 수동 UTF8/UTF16, fatal 디코딩. 제어문자 검사. 파일당 5 MiB 임시 상한.
- 장단점: 오류 명확 / BOM 없는 UTF16 자동 감지 및 EUC-KR 미지원, 제어문자를 가진 정상 텍스트도 거부할 수 있음.
- 영향: core/file.ts. 실제 성능 측정에 따라 상한 재검토. 업로드 파일과 편집 상태는 분리되며 원본 디스크는 불변.

## ADR-004 · 2026-11-06 · 후속 엔진 정책 (미구현)

- 문제: 모든 형식을 텍스트 알고리즘에 강제하지 않기.
- 대안: 하나의 엔진 또는 목적별 독립 엔진.
- 선택: 목적별 엔진. JSON은 key 순서 무시, null/부재 구분, 배열 index 기본. 경로 표기는 JSONPath와 안전한 path segment 모델을 검토한다. key 기반 배열 중복은 충돌 오류 방향으로 검토한다.
- 폴더: 루트 제외 상대 경로 매칭, rename은 삭제/추가. 기본 제외는 PROJECT 참조.
- Patch: 정규화 화면이 아닌 원문에서 Unified Patch 생성 및 적용 검증.
- Worker: Phase 8에 요청 버전 검증·취소·오래된 결과 무시를 도입. 현재 main thread 계산과 timeout만 사용하므로 대용량 반응성 미보장.
- AST: Phase 7에 web-tree-sitter 및 실제 grammar WASM 호환성을 조사하고 Java/C#/Python 우선. 아직 파서 미선정.
- 영향: 후속 독립 기능과 테스트. 위 잠정 정책은 구현 시 호환성 검증 ADR로 구체화한다.

## ADR-005 · 2026-11-06 · 테스트 도구 보안 업데이트

- 문제: 초기 Vitest 3 설치의 tinypool critical 취약점과 E2E 환경 호환성.
- 대안: 구버전 유지, 강제 override, 공식 최신 버전 업데이트.
- 선택: Vitest 5.1, ESLint 10, typescript-eslint 8 최신 호환 범위. Unit과 E2E 수집 범위를 분리. Playwright는 설치된 Edge 사용.
- 이유: critical 제거와 실제 테스트 성공. 최소 Node 버전은 22.12+로 안내.
- 장단점: critical/high 0건 / dev minimatch 경고 10건은 upstream 호환 수정이 필요하여 기록 후 유지.
- 영향: package.json/lockfile, vitest.config.ts, playwright.config.ts. typecheck/lint/unit/E2E/build 재검증.

## ADR-006 · 2026-11-06 · Phase 2 보기와 원문 분석

- 문제: Unified와 상세 비교를 제공하면서 원문 정확성을 유지해야 한다.
- 대안: 자체 전체 편집기 렌더러, 정규화된 데이터를 Monaco에 입력, Monaco 보기 + 독립 원문 상세.
- 선택: Monaco renderSideBySide로 전환하고 hideUnchangedRegions와 diffWordWrap으로 보기 옵션 구현. jsdiff는 물리 줄 번호를 가진 토큰을 비교한다. 빈 줄 필터 후에도 실제 번호와 마지막 변경 줄 번호를 유지한다. 인접 삭제·추가의 수정 판정은 기존 휴리스틱을 보존한다.
- 이유: 원문을 바꾸지 않고 Monaco의 편집·가상화 기능 보존. 단어/문자 상세는 원문에서 diffWordsWithSpace/diffChars로 계산한다.
- 장단점: 원문·EOF 분석 가능 / Monaco 시각 강조와 영역 접기는 별도 알고리즘이므로 분석 옵션과 완전히 같지 않음. 명시적 UI 안내 유지. MiniMap은 현재 Monaco DiffEditor가 비활성화하므로 실제 작동하지 않는 토글을 제공하지 않는다.
- 영향: core/diff.ts, components/ChangeDetail.tsx, app/App.tsx, style.css.
- 호환성·테스트: 기존 diff 계약을 보존하고 옵션은 선택 필드로 확장. 빈 줄 필터의 삽입/삭제 기준점·물리 범위, Unicode 및 개행을 단위 테스트한다. 상세 계산은 20k code unit/200ms 한도 후 원문 블록으로 fallback.

## ADR-007 · 2026-11-06 · 편집 동기화 및 다운로드

- 문제: React wrapper의 수정본 executeEdits가 이전 모델의 LF를 유지해 CRLF 업로드 텍스트가 상태로 역기록되는 오류를 E2E에서 발견했다.
- 대안: 정규화 저장, wrapper 교체, programmatic 동기화 구분 및 모델 setValue.
- 선택: 업로드 시 setValue로 모델의 개행 감지를 수행하고 programmatic flush/현재 상태 원문과 일치하는 전체 교체 이벤트는 편집으로 기록하지 않는다. 사용자 편집은 모델 값을 기록한다. 최신 업로드 요청 버전만 수락하고 예제 로드는 대기 업로드를 무효화한다.
- 다운로드: 사용자 버튼에서 현재 원문을 TextEncoder로 UTF-8 BOM 없이 인코딩하고 Object URL을 생성·해제한다. 원래 디스크 파일은 수정하지 않는다. 복사 역시 명시적 클릭에서만 수행하고 실패 안내를 제공한다.
- 이유: 비교 옵션과 저장 내용을 분리하고 원문 개행 보존. 인코딩 선택은 업로드 디코딩용이며 저장 인코딩은 버튼에 UTF-8로 표시한다.
- 장단점: 미편집 원문 보존 / Monaco 사용자 편집 이후 혼합 개행은 모델 EOL로 통일될 수 있음. 원본 바이너리와 BOM을 그대로 복원하는 다운로드는 아님.
- 영향: app/App.tsx, core/export.ts, phase2 unit/E2E.
- 호환성·테스트: CRLF/EOF/Unicode 인코딩 단위 테스트, 브라우저 실제 다운로드 바이트와 clipboard, 편집 후 원본 보존, 기존 4가지 언어 업로드 회귀 테스트.
