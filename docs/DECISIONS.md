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

## ADR-008 · 2026-11-06 · JSON 엔진과 작업 공간 분리

- 문제: Text Diff를 보존하면서 다양한 JSON 분석 도구 제공.
- 대안: 기존 Diff에 JSON 의미론 추가, jsondiffpatch/quicktype 일괄 도입, 작은 독립 엔진과 필요한 런타임만 사용.
- 선택: core/json/value(표준 파싱·구조 비교·트리 모델), query(JSONPath-Plus 11.3), schema(Ajv 8.20 및 자체 추론/타입), csv(Papa Parse 5.7). JSON 전용 Zustand 스토어와 지연 로딩 작업 공간. 코드 비교는 CodeCompare로 이동하고 상태·Monaco 모델을 보존.
- 이유: 구조 비교는 정해진 index 기반 정책을 직접 구현하면 배열 이동 추정에 의존하지 않는다. 타입 생성은 샘플 Schema를 공유하는 작은 생성기로 처리하여 불필요한 다언어·네트워크 기능을 도입하지 않는다. 선언은 실제 TypeScript semantic 검사로 검증한다.
- 장단점: 원문·기능 경계·번들 관리 명확 / JSON의 모든 전문 확장과 quicktype 수준 추론은 제공하지 않음.
- 영향: app/App, app/CodeCompare, core/json, features/json-tools, stores/jsonWorkspace, package/lock.
- 호환성·테스트: 기존 20 unit/5 E2E 유지. 신규 54 unit/4 E2E 추가. Runtime audit 0건. Tree와 결과 리스트 DOM 수를 제한하고 원문 데이터를 storage에 기록하지 않는다.

## ADR-009 · 2026-11-06 · JSON 정확성·경로·자원 정책

- 문제: 큰 정수 손실, null/부재, 배열·경로와 비정상 입력을 정확하게 처리해야 한다.
- 대안: 무조건 Number 변환, 임의 문자열 경로, BigInt 확장, 원문 보존 + 위험 숫자 차단.
- 선택: JSON.parse 후 원문 숫자 토큰 검사로 unsafe integer/non-finite를 차단한다. 큰 수는 문자열 입력을 안내하고 원문은 유지. 소수는 IEEE 754. 모든 own key를 데이터로 취급하고 Object.fromEntries/Map과 Object.hasOwn으로 prototype pollution 방어. key 정렬은 새 객체에 재귀 수행.
- 구조 비교: 객체 key 순서 무시, null/부재 구분, 타입 구분, 배열 index. ARRAY_CHANGED는 길이 요약이며 상세 필드 연산과 별도 통계. 트리 필터는 요약을 제외한 상세 경로로 판단한다. Key 매칭·중복 충돌 정책은 아직 미구현 확장.
- 경로: segment(string|number)[] 및 JSON-escaped bracket JSONPath. canonical 복사 경로는 직접 own-property 해석하여 quote/bracket/backslash/numeric key를 왕복한다. Flatten CSV는 RFC 6901 방식 JSON Pointer 경로.
- JSONPath: 허용 문법 검사 + eval:false. 필터·함수·스크립트·union 미지원, 표현식 500자/재귀 1개로 제한. JSONPath-Plus 공식 [변경 기록](https://github.com/JSONPath-Plus/JSONPath/blob/main/CHANGES.md)의 eval:false 정책 확인.
- 자원: JSON/CSV 입력 1 MiB, JSON 깊이 80/값 30k. Tree 32px 가상 행 최대 24 DOM, 변경/검색 결과 100건 페이지. Worker는 Phase 8, 현재 계산시간 보장은 아님.
- 장단점: 손실·실행 위험을 드러내며 입력 예산 명확 / 일부 유효 대형 JSON과 JSONPath 확장 거부. 중복 JSON 키는 JSON.parse 마지막 값 정책.
- 영향·검증: value/query/JsonTree/ResultList, 안전성·물리 경로·15k 트리/경계·외부 요청 테스트.

## ADR-010 · 2026-11-06 · Schema·TypeScript·CSV 변환 정책

- 문제: 샘플 추론의 한계와 변환 시 정보 손실을 명시하면서 유효한 결과 제공.
- 대안: 모든 필드 optional, 샘플 그대로 required, 관찰된 배열 객체 교집합을 required로 추론.
- 선택: Draft-07, 샘플 객체 union의 관찰 타입 anyOf/required 교집합. 빈 배열 items는 {}. Ajv strict/ownProperties, strictRequired:false(표준 유효 required-only 허용). coercion/default/removal 없음. compileAsync/loadSchema 없음, format 검증 미지원 명시. Monaco enableSchemaRequest:false.
- TypeScript: interface/type alias·export·중첩 별도 선언, optional/nullable/union, empty unknown[]. ASCII 타입명·예약어·이름 충돌 검증. 원시/배열 root는 type alias.
- CSV: Papa Parse 따옴표/개행 처리, 중첩은 JSON Pointer Flatten, 배열/객체 셀은 JSON 문자열. 컬럼은 선택 순서. 입력 Header 중복/공백·컬럼 수 불일치 오류. 값 타입 추론은 opt-in이며 unsafe integer/leading-zero는 문자열 보존. escapeFormulae:true(헤더 포함). 빈 셀 명시 인용, 최종 개행의 가상 행만 제거해 단일 빈 컬럼 손실을 방지.
- 장단점: 표준 도구와 안전 기본값 / JSON↔CSV 전체 타입·중첩 왕복 보장 안 함, Schema/TS는 API 계약 아닌 초안.
- 영향: schema/csv/JsonWorkspace, 단위 JSON 54개와 E2E의 실제 파일 내용·변환 검증. 신규 패키지는 package-lock에 기록.

## ADR-011 · 2026-11-06 · 독립 Field Mapping 엔진과 경로

- 문제: JSON 필드 변환에서 입력 불변·경로 충돌·prototype pollution을 보장해야 한다.
- 대안: JSONPath 결과를 직접 대입, 문자열 split 기반 경로, 명시적 segment parser와 별도 엔진.
- 선택: core/mapping/path.ts의 string/number/WILDCARD 토큰 parser, engine.ts의 타입 검증·사전 충돌 검사·own-property 조회·새 Target 생성. JSONPath 실행기/Structural Diff와 독립. 기존 Json 값 파서와 안전 예산만 재사용.
- 경로 정책: $, dot identifier, JSON-escaped double-quoted key, nonnegative index, wildcard 한 번. Key는 decoded 후 **proto**/constructor/prototype 거부. Source numeric token은 array에만, 문자열 token은 object에만 적용. Target 종류는 첫 활성 규칙의 root token에서 추론. $ Target은 독점 경로.
- 충돌: 경로 alias·같은/부모/자식·wildcard/index 잠재 overlap·array/object shape 충돌을 입력 값과 무관하게 거부. 형제 경로는 허용. 규칙별 첫 충돌만 보고.
- 배열: 전체 copy 또는 explicit index 또는 동일 index의 한 단계 wildcard. 배열 prefix는 형제 필드에서 공유. empty는 [] 유지, missing collection은 기본 오류/skip. hole은 null로 채우지 않고 전체 오류. 다중 wildcard·필터·재귀식은 범위 밖.
- 이유: 결과의 결정성·오류 위치를 명시하고 임의 평가와 추정 overwrite를 배제.
- 장단점: 검증 가능한 안전 정책 / 일반 JSONPath 표현식이나 Target merge는 제공하지 않음.
- 영향: mapping path/engine, store, MappingWorkspace. import/export·Source 불변·유형별 unit, browser 실제 결과 테스트.

## ADR-012 · 2026-11-06 · 변환·오류·규칙 문서와 예산

- 문제: 암묵 변환·누락/Null 혼동·부분 결과 내보내기와 과대 입력을 방지해야 한다.
- 대안: JS 기본 truthiness/Number/Date 추측, 규칙별 부분 결과, 명시적 변환·원자적 결과.
- 선택: copy는 clone, string은 non-null primitive, number는 trim 후 decimal/finite/safe integer, boolean은 boolean/0/1 및 정확한 같은 문자열만 허용. date는 YYYY-MM-DD/UTC Z ISO만 달력 검증 후 UTC canonical 문자열. 상수/기본값도 JSON만 허용.
- 기본값: undefined/missing 때만 적용 후 선택 변환 실행. null/false/0/빈 문자열은 실제 값. onMissing error 기본, skip 선택. enabled:false는 쓰기를 제외하되 형식·경로·literal 검증은 유지.
- 원자성: 오류 하나라도 있으면 Target을 반환하지 않음. UI snapshot은 Source 문자열과 규칙 배열 identity에 연결하여 이전 결과를 즉시 무효화. 250ms debounce 후 재계산. 원본 파일·Source 객체 불변, clone 결과만 사용.
- 문서: MappingRule 배열 또는 {version:1,rules}. ID 고유·엄격 속성 검사. export도 import의 parse 예산을 통과해야 함. 실패한 가져오기는 현재 규칙을 바꾸지 않음. 필드 enabled/onMissing은 초기 요구 모델의 하위 호환 선택 확장.
- 예산: rule 100, path 500자/80 segments/index<30000, source/target/rules document 1 MiB·30k JSON 값/깊이80, 탐색200k. 기본값/상수·Source 유효성 및 clone 예산 검사. Worker 성능은 Phase 8.
- 장단점: 모호한 데이터 손실과 오래된 preview 저장을 차단 / 제한된 타입 변환·날짜·배열 정책을 사용자가 따라야 함.
- 영향·검증: engine/drafts, mappingWorkspace store, UI·Mapping 87 unit/3 E2E. 신규 의존성 없음. 엄격 boolean/date·위험 경로·원문 및 실제 파일 다운로드·import 왕복·budget 검증.
