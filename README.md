# CodeDiff Studio

브라우저에서 소스 코드 비교·JSON 분석·필드 매핑을 로컬로 수행하는 React + TypeScript 개발 도구. 이번 버전은 **Phase 0–4** 범위입니다. 전체 요구사항은 [PROJECT.md](PROJECT.md)를 참고하세요.

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
- JSON Editor/Formatter, 가상화 Tree Viewer, Structural Diff, JSONPath, Schema, TypeScript, JSON ↔ CSV
- Field Mapping: 경로 선택·이름 변경·타입 변환·기본값·상수·배열·규칙 입출력
- Code Compare / JSON Tools / Field Mapping 작업 공간 전환 및 메모리 상태 유지
- 한국어 Dark UI, 작은 화면 대응. 파일·코드는 외부로 전송하거나 영구 저장하지 않습니다.

## 비교 방법

Original/Modified의 파일 열기 또는 각 영역 드롭으로 두 파일을 선택하세요. 언어는 마지막 업로드 파일 기준이며 수동 변경할 수 있습니다. 편집기 양쪽에서 직접 입력할 수 있고 변경 목록을 클릭하거나 화살표를 사용하면 해당 줄로 이동합니다. Ctrl/Cmd+F 검색과 선택 복사는 Monaco 기본 기능을 사용합니다. 업로드 인코딩 변경 후 파일을 다시 선택하세요.

Java, C#, Python, Go, Kotlin, Rust, C/C++, HTML, CSS, SCSS, JS/JSX, TS/TSX, Vue, SQL, JSON/JSONL, XML, YAML, Properties/INI/CONF/ENV, TXT/Markdown/LOG, Shell/PowerShell/Batch 등 텍스트를 지원합니다. 알 수 없는 확장자는 Plain Text입니다. Vue는 HTML 강조, JSONL은 Plain Text입니다. 바이너리·PDF·Word·이미지 비교는 지원하지 않습니다.

## 아키텍처와 제약

[ARCHITECTURE](docs/ARCHITECTURE.md), [설계 결정](docs/DECISIONS.md), [진행 상황](docs/PROGRESS.md), [테스트](docs/TEST-CASES.md).

jsdiff 원문 줄 토큰에 비교 옵션을 적용하고 실제 원문은 보존합니다. 수정은 같은 블록의 삭제·추가를 묶은 추정이며 이동 감지는 없습니다. Monaco 시각 강조와 분석 엔진은 독립적입니다. Monaco 공백 무시는 줄끝 공백 기준이며 분석 목록의 모든 공백 무시, 대소문자/EOL 옵션과 다를 수 있습니다. 빈 줄 무시 역시 분석 목록에 적용되며, 변경 상세는 원문을 표시합니다. 변경 영역 접기는 Monaco 결과 기준입니다. 화면에도 이를 안내합니다.

업로드 크기 정보는 업로드 시점 바이트 수입니다. BOM 없는 UTF16은 수동 선택해야 합니다. 각 파일의 저장 (UTF-8)은 현재 편집본을 BOM 없는 UTF-8로 다운로드합니다. 비교 옵션은 저장 내용에 영향을 주지 않습니다. 편집 전에는 업로드 텍스트의 혼합 개행도 보존하며, 편집 이후 Monaco가 파일 전체 개행을 모델의 형식으로 통일할 수 있습니다. 대용량 Worker·성능 측정, Light 모드, MiniMap, Patch는 후속 단계입니다.

Folder Compare·Syntax Compare는 아직 제공하지 않습니다. Folder 레일 아이콘은 예정 기능 표시이며 JSON Tools는 실제 작업 공간으로 연결됩니다. 배포 주소는 아직 없으며 GitHub Pages 및 Actions는 Phase 9 예정입니다. Vite base는 상대 경로로 설정했습니다.

## 화면

![Phase 2 코드 비교 화면](docs/phase2-desktop.png)

테스트 도구는 Vitest 5 및 ESLint 10으로 업데이트 후 검증했습니다. 개발 의존성의 minimatch 관련 moderate 보안 경고 10건이 남아 있으며 상세 상태는 PROGRESS에 기록했습니다. E2E는 설치된 Microsoft Edge를 사용합니다.

## Phase 2 사용법

상단 보기 선택으로 Side by side / Unified Diff를 전환하세요. Unified는 원본 삭제 줄과 수정 줄을 한 열에 표시하며 원본 편집은 좌우 보기에서 수행합니다. 변경 목록을 선택하고 상세 단위를 단어 또는 문자로 바꾸면 원문 변경을 볼 수 있습니다. 상세는 20,000 UTF-16 code unit 또는 계산 200ms를 넘으면 전체 블록 표시로 전환합니다.

공백 무시는 개행 이외 모든 공백 제거, 줄 끝 공백 무시는 행말 공백만 제거, 빈 줄 무시는 공백만 있는 행을 제외하여 분석합니다. 원문 줄 번호는 그대로 유지합니다. 총 비교 줄 수는 두 원문의 줄 토큰 수 합계이며 마지막 개행 뒤의 가상 빈 줄을 세지 않습니다. ‘변경 파일’은 두 입력을 비교하는 1쌍 기준입니다. 추가·삭제 줄 수는 수정 추정 블록에 포함된 연산도 셉니다.

`npm run test:e2e`는 로컬 Edge를 사용합니다. 포트 충돌 시 PowerShell에서 `$env:CODEDIFF_TEST_PORT='5192'`로 테스트 포트를 바꿀 수 있습니다. GitHub Pages 배포는 아직 수행하지 않았습니다.

## Phase 3 — JSON Tools 사용법

상단 **JSON Tools**를 누르고 JSON 파일을 열거나 Monaco Editor에 직접 입력하세요. Source JSON과 Modified JSON은 Text Diff의 입력과 독립적입니다. 작업 공간을 오가도 메모리의 편집 내용은 유지되며 새로고침 시 초기화됩니다. 서버 전송·자동 영구 저장은 없습니다.

- **Editor / Formatter:** 실시간 표준 JSON 오류, Pretty Print/Minify/재귀 Key Sorting, 들여쓰기 2/4/8. JSONC는 지원하지 않습니다. 저장은 현재 원문의 UTF-8입니다.
- **Tree Viewer:** Key/Value 검색, 전체·깊이별 펼침/접기, 타입·경로 표시, JSONPath/값 복사. 32px 가상 행으로 최대 24행만 DOM에 렌더링합니다.
- **Structural Diff:** 두 입력의 좌우 트리, 필드 추가·삭제·값/타입 변경, index 기반 배열 비교, 변경 탐색·필터. 객체 순서는 무시하고 null과 부재는 구분합니다. 배열 길이 요약 ARRAY_CHANGED는 필드 변경 통계와 분리하며 변경 필터가 미변경 필드를 강조하지 않게 합니다. Key 기반 배열 비교는 미구현 확장입니다.
- **JSONPath:** `$.roles[*]`, `$..name`, `$[0:3]`, `$["a.b"]` 등 지원. 검색 경로와 값을 표시하고 결과 클릭 시 트리 선택을 연동합니다. 복사·JSON 다운로드 지원. 필터/스크립트/함수/union은 지원하지 않으며 표현식 최대 500자, 재귀 `..`는 한 번만 허용합니다.
- **JSON Schema:** Draft-07 추론 초안 생성, JSON Schema 직접 편집·업로드·검증, 오류 경로와 메시지, 복사·다운로드. 샘플 배열의 required는 관찰한 필드의 교집합, nullable/혼합 타입은 anyOf입니다. 외부 `$ref` 로딩과 format 검증은 지원하지 않습니다. 유효성 검사는 데이터를 강제 변환하거나 기본값을 삽입하지 않습니다.
- **TypeScript:** 타입명(ASCII 식별자), Interface/Type Alias, Export, 중첩 타입, optional·nullable·union, 복사·`.ts` 다운로드. 빈 배열은 unknown[]이며 scalar/array 루트는 type alias입니다. 샘플 추론이므로 실제 API 계약을 검토해야 합니다.
- **JSON ↔ CSV:** 객체 배열, 선택 순서별 컬럼, JSON Pointer로 중첩 Flatten, 구분자 comma/semicolon/tab, 미리보기·다운로드. CSV 파일 입력과 수동 타입 추론 지원. 문자열의 스프레드시트 수식 시작 문자에는 안전 접두사 `'`를 추가합니다. 큰 정수와 선행 0 숫자는 타입 추론에서도 문자열로 유지합니다. 중첩 값/타입/빈 값 의미는 완전히 왕복되지 않을 수 있습니다.

JSON/CSV 도구 입력은 1 MiB, JSON 값 수 30,000개·깊이 80을 임시 상한으로 적용합니다. JavaScript 안전 정수 범위 밖의 정수와 non-finite 숫자는 변환·분석을 차단하고 원문은 유지합니다. 소수는 IEEE 754 정밀도를 따릅니다. 중복 JSON 키는 JSON.parse의 마지막 값 정책을 따릅니다. Schema·타입·검색 결과는 입력이나 설정 변경 시 무효화하여 오래된 결과 사용을 방지합니다. 변경/검색 목록은 100개씩 페이지로 표시합니다.

JSON 분석 모듈은 `src/core/json`에 분리하고 Ajv 8 / JSONPath-Plus 11 / Papa Parse 5를 사용합니다. 구조 비교·Schema 추론·타입 생성은 검증한 자체 모듈입니다. JSON 작업 공간은 지연 로딩됩니다. Phase 3 검증 결과: 단위 74개, Edge E2E 9개, typecheck/lint/build 통과. 런타임 의존성 npm audit 경고 0건이며 개발 의존성 moderate 10건은 남아 있습니다.

![Phase 3 JSON 구조 비교](docs/phase3-json-diff.png)

## Phase 4 — Field Mapping 사용법

상단 **Field Mapping**에서 Source JSON / Mapping Rules / Target Preview의 3열 작업 공간을 사용합니다. Source를 업로드하거나 편집하고, 트리에서 필드를 선택한 다음 **선택 경로를 규칙에 적용** 또는 **선택 경로로 규칙 추가**를 누르세요. Target Path를 바꾸면 필드 이름·중첩 구조를 변경할 수 있습니다. 규칙은 추가/삭제/적용 해제할 수 있고 250ms 후 Target이 다시 계산됩니다. Source와 기존 JSON Tools의 입력은 독립적입니다.

경로는 `$`, `$.user.name`, `$["특수.키"]`, `$.items[0]`, `$.items[*].id`를 지원합니다. 문자열 Key와 숫자 index는 구분합니다. 한 규칙의 Source/Target에는 동일하게 한 번의 `[*]`를 사용하며 index를 유지합니다. 전체 배열 복사는 `$.items → $.rows`의 copy를 사용하세요. 중첩 배열은 전체 copy 또는 명시적 index로 지원하며 다중 wildcard·필터·재귀식은 허용하지 않습니다.

| 변환     | 정책                                                                                                          |
| -------- | ------------------------------------------------------------------------------------------------------------- |
| copy     | null 포함 JSON 값을 독립 복사                                                                                 |
| string   | 문자열·숫자·boolean을 문자열로, null/객체/배열은 오류                                                         |
| number   | 숫자 또는 trim 후 엄격한 10진 숫자 문자열. 빈 값·hex·unsafe integer·non-finite는 오류                         |
| boolean  | boolean, 0/1, 정확한 문자열 true/false/0/1만 허용                                                             |
| date     | YYYY-MM-DD 또는 UTC ISO 시각(Z)을 검증해 정규화된 UTC 문자열 출력. 오프셋/로컬 시각·유효하지 않은 날짜는 오류 |
| constant | 상수 JSON 값을 사용. Target wildcard는 Source wildcard로 항목 수를 결정                                       |

누락 필드는 기본 오류이며 기본값 또는 **누락 시 제외**를 선택할 수 있습니다. 기본값은 필드가 없을 때만 사용하고 변환을 적용합니다. null은 실제 값으로 보존하며 변환이 허용하지 않으면 오류입니다. false/0/빈 문자열도 값이므로 기본값으로 덮어쓰지 않습니다. 미매핑 Source 필드는 자동 복사되지 않습니다.

Target의 중복·부모/자식 경로·wildcard/index 중첩 쓰기·컨테이너 형식 충돌은 계산 전에 거부합니다. 형제 필드는 함께 쓸 수 있습니다. 배열의 빈 인덱스는 null로 몰래 채우지 않고 오류로 처리합니다. 빈 Source 배열은 빈 Target 배열을 만듭니다. 활성 규칙이 없으면 `{}`이며 `$` Target은 다른 활성 규칙과 함께 쓸 수 없습니다.

**규칙 내보내기/복사**는 `{ "version": 1, "rules": [...] }` JSON 문서로 저장합니다. 파일 또는 텍스트 가져오기는 버전 1 문서와 MappingRule 배열을 지원합니다. ID는 고유해야 하며 알 수 없는 속성·변환·위험한 경로는 거부합니다. 적용 해제된 규칙도 경로·상수·기본값 형식 검사는 통과해야 합니다. 가져오기 실패 시 기존 규칙을 유지합니다. `defaultValue`, `constantValue`, `enabled`, `onMissing`은 선택 속성입니다.

모든 오류는 규칙 ID와 함께 표시하고 전체 Target 생성을 취소합니다. 입력 변경 시 이전 Target은 즉시 무효화되며 결과 복사·저장은 최신 성공 결과에만 활성화됩니다. Target은 새 JSON이고 Source 파일을 변경하지 않습니다. 클립보드·파일 저장은 명시적 클릭으로만 수행하고 데이터 전송·코드 평가·자동 영구 저장은 없습니다.

규칙은 최대 100개, 경로는 500자/깊이 80/index 29999까지입니다. Source·Target·규칙 입출력은 1 MiB, JSON 값은 30,000개, 실행 중 탐색은 200,000회 제한입니다. `__proto__`, `constructor`, `prototype` 경로 segment는 차단합니다. 전체 복사된 데이터 내부의 같은 이름은 own key 데이터로 보존합니다. 이 상한은 성능 보장이 아닌 보호 한도이며 소수 변환은 IEEE 754 정밀도를 따릅니다.

Phase 4 최종 검증: 단위 **161/161**, Edge E2E **12/12**, TypeScript·ESLint·Production Build 통과. 기존 Monaco 번들 경고는 유지됩니다. 다음 단계는 Phase 5 — Patch Export입니다.

![Phase 4 Field Mapping](docs/phase4-mapping-desktop.png)
