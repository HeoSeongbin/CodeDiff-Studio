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

## ADR-013 · 2026-11-06 · 원문 기반 Unified Patch와 검증

- 문제: 화면의 정규화 Diff를 Patch로 사용하면 공백·EOL·EOF 변경을 잃을 수 있다.
- 대안: UI hunk 직렬화, 자체 Patch serializer, jsdiff 원문 생성 + 독립 적용 검사.
- 선택: 기존 diff 패키지의 createTwoFilesPatch에 원문과 문맥만 전달하고 ignoreWhitespace:false/stripTrailingCr:false/timeout1500. 반환 문자열을 parsePatch 후 applyPatch(autoConvertLineEndings:false,fuzzFactor:0)하여 수정본과 완전 일치 검사. 성공한 문자열만 preview/copy/download에 제공.
- 이유: 조작 없는 원문 기준 결과·EOF 범위·개행 보존. 자동 EOL 변환은 CRLF→LF 자체 변경을 숨길 수 있어 금지. formatPatch의 zero-line range mutation을 반복 호출하지 않도록 한 번 생성한 문자열을 그대로 사용.
- 표준 검토: [GNU Unified Format](https://www.gnu.org/s/diffutils/manual/html_node/Unified-Format.html), [Git apply](https://git-scm.com/docs/git-apply). 파일 헤더·@@ 범위·EOF 마커, metadata LF 및 원문 CR 데이터 보존. CR-only 텍스트는 LF 관점의 한 줄 데이터이며 Text Diff 줄 번호와 다를 수 있음.
- 장단점: 재현 가능한 text patch / 모든 외부 Patch 구현 호환성 보장은 아님. Git 호환성은 실제 CLI 적용 후 bytes로 검증. context0은 --unidiff-zero 안내.
- 영향: core/patch/patch.ts, PatchExport UI, patch core/Git/E2E. 기존 Text Diff·JSON·Mapping 엔진과 분리.

## ADR-014 · 2026-11-06 · 파일 메타데이터·Export 상태와 제한

- 문제: 다른 업로드 파일명·빈 입력·위험 경로와 오래된 결과의 의미를 명확하게 해야 한다.
- 대안: 자동 rename/creation 추정, 독립 old/new 이름, 단일 대상 상대 경로와 명시적 파일 작업.
- 선택: 단일 대상 상대 경로에 a/b prefix, 공백 경로 quote, 한글 허용. 경로 240자·절대/상위/.git/빈 segment·제어문자·역슬래시·따옴표·비호환 문자 거부. 입력 UTF-8 왕복 검사·NUL 차단.
- 작업: modify 기본으로 empty와 absent 구분. create는 Original empty, delete는 Modified empty 및 /dev/null. 양쪽 empty의 파일 생성/삭제는 미지원으로 명시. rename·permission·binary·multi-file은 범위 밖.
- UI: 별도 lazy Patch Export가 Code Compare 원문 스토어를 읽는다. 사용자 명시 생성 후 자동 적용 검사. snapshot과 raw strings/path/context/operation 일치할 때만 export. 예약 작업은 요청 세대로 취소. 분석 옵션과 CR 표시 옵션은 Patch 데이터를 바꾸지 않음.
- 출력: UTF-8 BOM 없이 저장, clipboard는 명시 동작이며 OS EOL 변환 경고. UTF16 원본 bytes 복원은 아님. 입력각5MiB/출력12MiB/Diff timeout1.5s; 전체 main-thread 파이프라인 성능 보장 아님.
- 장단점: 안전한 검토/내보내기와 메타데이터 의미 명확 / 단일 텍스트 Patch subset 및 portable 경로 subset만 지원.
- 영향·검증: Patch input/types, App navigation/CSS, core53/Git15/E2E3. 임시 Git fixture 디렉터리는 tmpdir 아래 생성된 절대 경로를 확인하고 해당 경로만 정리. 신규 패키지 없음.

## ADR-015 · 2026-11-06 · 폴더 입력·상대 경로·옵션과 정확성

- 문제: 프로젝트 폴더의 내용을 기존 Text/JSON/Mapping/Patch와 혼합하지 않고 비교해야 한다.
- 대안: File System Access API 전용, backend archive, browser directory FileList + 독립 엔진.
- 선택: webkitdirectory/File.webkitRelativePath로 받은 루트 내부 경로를 검증·strip하고 FolderSelection으로 보관. [MDN API 설명](https://developer.mozilla.org/en-US/docs/Web/API/HTMLInputElement/webkitdirectory)을 확인하고 실제 Edge에서 검증. empty dir 자체는 FileList에 없으므로 명시적 empty selection 버튼 제공.
- 경로: slash relative·no empty/dot/dotdot/control/backslash/drive, 최대1024자/80segments. Map 키와 caseSensitive/default 또는 toLowerCase 매칭. Unicode normalization 없음. 동일 side case collision은 전체 오류. 파일명 이동은 추가/삭제, root 이름 차이는 비교하지 않음.
- 필터: 기본 제외 디렉터리는 내용 읽기 전 적용. name any-depth 또는 root subtree로 한정, glob 없음. 확장자 insensitive, 검색·kind·unchanged 숨김은 결과 표시 필터. whole stats와 exported subset 구분.
- 정확성: 텍스트는 기존 compareText(ignoreEol:false), byte-equal fast path. 공백 의미상 동일은 rawEqual과 구분해 안내. BOM/encoding 변경은 수정. binary는 signature/control heuristic + raw byte equality. IO/encoding/oversized/diff failure는 ERROR_FILE, unavailable line counts. Added/Removed empty file과 absent를 구분.
- 장단점: 정적/local/privacy 유지·검증 가능한 상태 / empty directories, metadata 권한/mtime·rename·drop·watch는 범위 밖. binary heuristic과 API 지원 한계 명시.
- 영향: core/folder engine/tree, folderWorkspace store, UI·App navigation. Folder42 unit/3 E2E + 기존 전부 회귀 검증.

## ADR-016 · 2026-11-06 · 폴더 비동기 처리·모델 수명·보고서

- 문제: 다수 파일 처리·취소·stale 결과와 Monaco model teardown 오류를 제어해야 한다.
- 대안: 모든 bytes 동시 로딩, 별도 diff 구현, pair별 읽기/비교와 기존 Monaco 재사용.
- 선택: pair별 arrayBuffer 읽기 → classify/decode → bytes/text diff → progress/yield. raw bytes는 result에 보관하지 않고 text와 metadata만 유지. snapshot은 selection refs/options identity와 결합, request version·AbortSignal으로 오래된 결과 차단하고 입력 변경 시 이전 result 해제.
- 보호 예산: per side20k raw metadata/1000eligible/readable20MiB, per-file5MiB, whole15s(file/await checkpoints). binary/error 줄 수는 제외, unknown을 동일로 처리하지 않는다. File.arrayBuffer와 동기Diff 강제 중단은 Phase 8 검토.
- 모델: readonly folder preview는 Code Compare state를 바꾸지 않음. 명시적 가져오기는 두 입력을 교체하고 CodeCompare를 새로 mount해 EOL 감지. ManagedDiffEditor layout cleanup에서 setModel(null) 후 model.dispose하여 wrapper passive cleanup의 dispose-before-detach pageerror 해결. CodeCompare pending uploads도 unmount 시 무효화.
- 트리/보고서: virtual28rows, Map으로 file/dir 이중 경로를 별도 행 표시. 전체·subset JSON은 콘텐츠를 배제하고 statsScope/all-compared-files·exportedRows를 명시. export는 사용자 클릭만.
- 장단점: 기본 반응성·메모리와 입력 불변성 유지 / main-thread pipeline이며 hard latency·메모리 보장은 아니다. viewport readonly 강조와 통계 정책이 다를 수 있음.
- 영향·검증: FolderCompare/ManagedDiffEditor/CodeCompare/App + engine/tree, native directory fixture·cancel·350files·pageerror0·실제 다운로드·원본 파일 불변/CRLF 손실 없음. 신규 패키지 없음.

## ADR-017 · 2026-11-09 · 로컬 Syntax Compare와 보수적 매칭

- 선택: web-tree-sitter 0.25.10 + tree-sitter-wasms 0.1.13을 정확 버전 고정. 실제 Java/Python/JS/TS ABI14, C# ABI13 로드·파싱 확인. 각 언어 adapter의 노드 종류, WASM 자산 로더, AST 추출/매칭, UI를 분리한다. Vite ?url 로컬 자산만 사용하고 사용자 원문은 업로드·수정하지 않는다.
- 근거: [공식 web binding 문서](https://github.com/tree-sitter/tree-sitter/blob/master/lib/binding_web/README.md), [0.26 구형 grammar 호환성 이슈](https://github.com/tree-sitter/tree-sitter/issues/5171). Parser.init/Language.load promise를 캐시하며 실패 캐시는 재시도를 허용한다.
- 매칭: kind/scope/name + 매개변수 fingerprint 우선. 유일한 이름쌍만 매개변수 변경으로 연결하며 중복 서명은 임의 매칭하지 않는다. 유일 동일 본문·매개변수 함수쌍만 rename candidate, 이동/의미적 동등성은 추정하지 않는다. 클래스 변경과 하위 메서드 변경은 별도 요소이다.
- fingerprint: AST leaf type/text 배열 직렬화, 주석·구문 간 공백 제외, 문자열 내용 보존. 본문을 제외한 선언과 본문을 따로 비교한다. WASM Node는 결과에 남기지 않고 tree/parser를 finally 해제한다.
- 예산: 입력1 MiB, 트리100k노드·깊이128, 요소5k, parser progress callback 약1초 취소. 구형 timeout setter는 실제 런타임에서 BigInt 오류가 발생해 권장 progress callback 사용. 동기 추출/매칭의 hard deadline 보장은 없으며 Worker는 Phase8 범위다.
- 한계: 익명/화살표 함수 변수·TSX·최신 grammar 문법 전체 미지원. 파싱 오류 시 부분 AST 미표시. 원문 readonly Text Diff와 연결하며 입력 snapshot이 달라지면 결과를 숨긴다.
- 검증 제한: Node 실제 WASM 테스트 통과. 기존 Tailwind 네이티브 파일의 Windows Application Control 차단 및 WASM fallback 정지로 Vite/E2E/Production Build 확인 보류. 이를 해결하기 위해 보안 정책이나 기존 스타일 구성을 변경하지 않는다.

## ADR-018 · 2026-11-09 · Phase 7 검증 복원과 원문 모델 갱신

- 문제: Tailwind 4.3.4 native 파일은 로컬 Application Control에 차단되고 설치된 WASM fallback은 로딩에서 정지했다. [공식 4.3.5 릴리스](https://github.com/tailwindlabs/tailwindcss/releases/tag/v4.3.5)의 WASM 로딩 정지 수정(#20667)을 확인해 Tailwind/Vite plugin을 4.3.5로 갱신했다. 보안 정책 변경이나 스타일 파이프라인 제거는 하지 않았다. native 차단 환경에서도 공식 WASM fallback으로 빌드가 통과한다.
- Production 검증: Playwright의 CODEDIFF_TEST_PREVIEW=1 옵션으로 같은 테스트를 vite preview의 실제 dist에 실행한다. 이 모드에서는 기존 서버 재사용을 금지해 개발 서버를 production으로 오인하지 않는다. 사전 npm run build가 필요하다.
- 발견 오류: production의 빠른 업로드/짧은 문서 교체에서 Monaco 0.52.2의 이전 diff range/gutter가 새 줄 수를 참조해 Illegal value for lineNumber 및 범위 역전 오류를 발생시켰다. React DiffEditor의 자동 setValue와 CodeCompare의 직접 setValue가 중복되는 경로도 있었다.
- 선택: ManagedDiffEditor에서 공개 Monaco API로 생성·업데이트·정리를 직접 소유한다. 직접 편집의 store echo는 model 값이 같으면 건드리지 않는다. 외부 snapshot 변경은 setModel(null) 후 Monaco의 기존 diff view-model 해제(setTimeout 0) 다음 task에서 살아 있는 동일 텍스트 모델에 setValue하고 다시 연결한다. pending 교체는 마지막 snapshot으로 합치고 unmount 시 timer를 정리한다. CodeCompare의 upload/sample 직접 setValue는 제거한다. 원문 EOL 감지와 원본 store 불변성을 유지한다.
- 대안·트레이드오프: 같은 task에서 detach/setValue/reattach하면 이전 view-model의 비동기 해제가 끝나지 않아 경합이 남았다. 매번 새 텍스트 모델을 만들고 바로 이전 모델을 해제하면 worker가 참조할 모델이 사라지는 no diff result available 경합이 생겼다. 최종 방식은 모델 수명을 유지하되 외부 교체가 한 task 지연된다. Monaco 내부 해제 순서는 현재 0.52.2 소스와 실제 production 회귀로 확인했으며 향후 버전 변경 시 재검증한다. Worker 성능 개선은 Phase8 범위다.
- 정확성 보완: CR 단독 EOL은 동일 UTF16 길이의 분석용 LF 복사본으로 파싱해 구형 grammar의 line-comment 오해석을 방지하고, 원문 offset→물리 줄 이진 탐색을 사용한다. Import 매칭 key는 표시 원문 대신 token fingerprint, Java package/C#/TS namespace는 별도 scope로 반영한다. 요소5k 상한을 정확히 적용한다.
- 검증: 실제 WASM Node 테스트291개, production 전체 Edge E2E26개, TypeScript/ESLint/Build 통과. 5개 grammar HTTP200/304, readonly CRLF 원문 다운로드 일치, 실패 재시도, pageerror0, 기존 Text/JSON/Folder/Mapping/Patch 기능 회귀 확인. 큰 chunk/Tree-sitter glue eval·Node externalization/WASI 경고는 남는다.

StrictMode 보완: 개발 모드의 시험 mount에서 즉시 Worker를 생성하고 해제하면 Canceled/no diff result available 오류가 발생했다. editor 생성은 취소 가능한 microtask로 미뤄 시험 mount에서는 Worker 요청 자체를 시작하지 않는다. 최종 개발/production 회귀 결과는 PROGRESS 최종 기록을 기준으로 한다.

## ADR-019 · 2026-11-09 · 계산 Worker와 요청 수명

- 선택: `workers/protocol.ts`의 typed job/reply, `execute.ts`의 엔진 어댑터, Vite ES module Worker, `ComputeClient`, `useCompute`를 분리한다. Text/inline/Syntax/JSON 파싱·구조 비교·변환/Mapping 컴파일·적용·규칙 직렬화/Patch 생성·재검증은 기존 코어를 Worker에서 호출한다. Folder 엔진은 async comparator를 주입받아 파일별 Text CPU 계산만 위임하며 경로·bytes·인코딩·오류 정책은 자체 엔진에 유지한다.
- 대안: 모든 도구를 단일 Worker 큐로 직렬화하거나 main-thread fallback을 두는 방식. 선택한 client별 on-demand Worker는 새 요청이 이전 계산을 terminate하고 AbortError로 종료한다. 결과는 요청 id 및 입력 snapshot이 일치할 때만 사용한다. 실패·10초 wall timer·messageerror는 명시적 오류와 재시도를 제공하고 메인 스레드로 조용히 되돌리지 않는다. engine Text 예산1.5초와 Folder 전체15초는 유지한다. File.arrayBuffer 자체는 중단 불가능해 읽기 경계의 AbortSignal 검사도 유지한다.
- 자원: 성공 Worker는 같은 client에서 재사용하고 idle30초 후 해제한다. 작업 공간 비활성화/입력 변경/unmount 시 timer·요청·Worker를 정리한다. Syntax grammar promise 캐시는 Worker 내부에만 존재하며 종료 시 같이 해제된다. 일반 탭의 입력·선택 상태는 세션 메모리에서 유지한다. 원본 문자열은 structured clone으로 전달하며 파일 객체/디스크/서버를 쓰지 않는다.
- React: debounce(Text/Mapping250ms, JSON 파싱100ms), useMemo job identity, 결과 generation 검증을 결합한다. JSON 명시 변환은 입력·옵션 identity를 await 뒤 다시 확인해 나중에 입력된 내용을 덮어쓰지 않는다. async 변환 중 복사/저장을 비활성화해 이전 편집본을 저장하는 경합을 해결한다. 취소·오류를 파일 동일로 표시하지 않는다.
- 최적화: Text의 줄 split/normalization key를 한 번 계산, 파일의 binary/줄 수 검사를 배열 생성 없는 순회로 변경, Code Compare 줄 수는 입력 변경 시만 계산. 변경 목록은100개 페이지, snippet200자, 상세는 양쪽각20k자까지 렌더한다. 전체 원문 다운로드는 자르지 않는다. JSON/Folder 기존 가상 목록을 유지한다. 언어 목록을 Syntax parser 구현에서 분리해 UI가 WASM binding을 로드하지 않게 했다.
- 근거: [Vite Worker 번들링](https://vite.dev/guide/features#web-workers), [Worker terminate](https://developer.mozilla.org/en-US/docs/Web/API/Worker/terminate), [structured clone](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Structured_clone_algorithm).
- 검증: worker lifecycle fake-port 테스트로 supersession/AbortSignal/오래된 id/idle/timeout/crash/clone 오류를 확인하고 엔진 통합으로 원문/EOL/JSON null·정밀도/Mapping/Patch 결과를 확인한다. 실제 브라우저 Worker·원본 파일 불변·취소/재시도는 E2E와 별도 성능 행렬로 검증한다. 최종 결과는 PROGRESS를 기준으로 한다.

## ADR-020 · 2026-11-09 · 테마·레이아웃·Monaco 수명·성능 측정 범위

- UI 상태: Zustand 세션 메모리에 Dark/Light·MiniMap·분석 폭240–480px·원본 비율30–60%·편집기 높이400–900px를 둔다. localStorage/파일 내용 자동 저장은 추가하지 않는다. CSS palette와 모든 Monaco 테마(vs-dark/vs)를 일치시킨다. 네이티브 select/range/checkbox 및 focus-visible/본문 이동 링크를 제공한다. 핵심 안내 텍스트 대비4.5:1 샘플을 [W3C 기준](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum)에 따라 확인하며 전체 WCAG 적합성 인증을 주장하지 않는다.
- 반응형: 데이터 패널은 좁은 화면에서1열, 분석 폭은 viewport에 제한한다. 800px 이하에서 MiniMap을 숨기고 Code Compare는 수동 보기 선택 전까지 Unified 기본값을 적용한다. Folder/Syntax 미리보기도 좁은 화면에 맞춘다. Monaco Diff는 MiniMap을 내부적으로 끄므로 공개 inner editor updateOptions를 생성/재연결/옵션 변경 후 적용한다.
- 모델: Phase7의 deferred detach만으로는 부하 시 오래된 diff 결과 경합이 남았다. 공개 createViewModel/setModel API로 IDiffEditorViewModel을 직접 소유하고 외부 snapshot 교체 전 dispose해 token/listener를 동기적으로 정리한다. 두 텍스트 모델은 재사용해 undo·원문 EOL·할당량을 보존하고 교체 시 필요한 쪽만 setValue한다. StrictMode의 버려진 mount는 취소 가능한 microtask로 생성 전 무효화한다. unmount는 timer→detach→view model→editor→두 text model 순서로 정리한다. Monaco 시각 Diff도1.5초 예산을 둔다.
- 탭 정책: 열린 workspace의 Monaco model/입력/뷰 상태는 보존하고 계산 Worker는 비활성화 때 종료한다. 화면 설정의 모델·계산 Worker 개수는 메타데이터만 보여 주며 전체 메모리 사용량의 대체 지표가 아니다. 화면 전환·옵션 조절 후 모델 개수가 증가하지 않는지 E2E로 검증한다.
- 성능: 별도 Playwright config/test:perf를 단일 Edge worker로 실행한다. 100/1k/10k/50k줄, 500k/5MiB 단일 행, 반복/다수 변경, 취소, 20k값 JSON/구조 비교, 500파일을 다룬다. 업로드·debounce·메시지·UI 결과까지 wall time,16ms timer 간격, forced-GC 후 CDP main-target JS heap, 렌더 행/모델 수를 JSON으로 기록한다. Worker/native/GPU 메모리·실제 키보드 입력 지연·통계적 반복 측정은 포함하지 않는다. 한 환경의 관측값은 다른 기기의 SLA가 아니다.
- 범위: main Monaco chunk 경고는 유지되며 현재 Phase의 CPU·메모리·목록·UI 수명 개선과 구분한다. CI/배포·다른 OS/브라우저는 Phase9에서 검토한다. 최종 측정값은 docs/phase8-performance.json/PROGRESS를 기준으로 한다.

## ADR-021 · 2026-11-09 · GitHub Pages는 빌드 산출물만 게시

- 문제: main 루트의 Vite 소스 HTML을 legacy Pages로 게시해 /src/main.tsx404 및 빈 화면 발생.
- 대안: dist를 별도 브랜치에 커밋하거나 소스 HTML을 수동 변경. 선택: Actions에서 검사와 빌드를 통과한 dist만 공식 Pages artifact로 게시한다. 해시 파일명을 수동 관리하지 않고 원본 저장소에 dist를 커밋하지 않는다.
- 경로: configure-pages의 base_path에 /를 붙여 VITE_BASE_PATH로 전달한다. Vite 기본값 ./는 유지한다. favicon은 BASE_URL로 참조한다. Worker·동적 import·WASM은 기존 Vite URL 변환을 유지한다.
- 권한/운영: contents read, pages write, id-token write; main push 또는 workflow_dispatch; 배포 job은 build 성공에 의존. 저장소 Pages Source는 GitHub Actions(workflow)로 설정해야 한다.
- 영향: vite.config.ts, index.html, public/favicon.svg, .github/workflows/pages.yml, deployment 전용 Playwright config/test. UI/비교 알고리즘·업로드 원문에는 영향 없음.
- 검증: 실제 프로젝트 하위 경로 production Edge에서 compiled JS/Monaco/Worker/Syntax WASM/favicon 로딩 및 외부 요청0 확인. CI는 Chromium으로 같은 배포 테스트를 실행한다. 기존 Edge 회귀와 분리하여 루트 경로 테스트의 의미를 보존한다.
- 근거: https://v6.vite.dev/guide/static-deploy 및 https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## ADR-022 · 2026-11-10 · 회귀 gate와 실제 배포 검증 분리

- 문제: 기존 Pages smoke는 초기 화면/Java 로딩만 확인했고 전체31개 회귀는 수동이었다. PR과 배포 전의 동일한 검사를 보장할 필요가 있다.
- 대안: 배포 workflow에 모든 검사를 중복하거나 smoke만 계속 실행. 선택: contents read인 reusable ci.yml에서 root production 회귀를 수행하고 pages.yml은 regression 성공에 의존한다. PR은 같은 reusable workflow의 pull_request trigger로 검증한다. 실제 배포는 main push/수동 실행만 유지한다.
- 경로/브라우저: 기본 상대 경로 root 회귀와 Pages base_path smoke를 별도 build에서 검증한다. 로컬은 설치된 Edge, CI는 설치한 Chromium을 사용한다. 실제 URL은 CODEDIFF_DEPLOYMENT_URL로 서버를 띄우지 않고 재사용한다.
- 정확성: release.test.ts의 고정 seed250개 입력으로 독립 insertion/deletion 편집거리와 Diff 연산 수를 비교하고 물리 줄 위치·원문 재구성을 확인한다. UTF16 decode → Worker 어댑터 → Patch 재검증 → UTF8 export 통합과36개 확장자 감지도 추가한다.
- 개인정보: 테스트는 합성 fixture만 사용하며 HTTP GET/HEAD 외 요청, origin 외부 요청,404/pageerror를 실패로 본다. 폴더 fixture는 검증된 tmpdir 하위 고유 디렉터리만 정리한다. 원본 파일 쓰기나 서비스 업로드 구현을 추가하지 않는다.
- 영향: .github/workflows/{ci,pages}.yml, playwright.config.ts, e2e/deployment.spec.ts, src/tests/release.test.ts. 비교 엔진·JSON/Folder의 책임·파일 정책은 유지한다. 신규 외부 의존성 없음.
- 한계: seed 검사는 모든 문자열에 대한 증명이 아니다. Edge/Chromium과 viewport emulation은 Firefox/Safari/모바일 실기기·WCAG 인증을 대체하지 않는다. 새 workflow의 원격 실행 결과는 로컬 결과와 구분하여 PROGRESS에 기록한다.

## ADR-023 · 2026-11-10 · 공통 헤더·왼쪽 메뉴와 접이식 상단 메뉴

- 요청/문제: Code Compare 내부에만 있던 헤더와 왼쪽 메뉴가 다른 작업 공간에서 사라졌다. 상단 탭·화면 설정은 기본으로 숨기고 필요할 때 버튼으로 열도록 사용자가 요청했다.
- 선택: AppShell이 헤더·6개 작업 공간 아이콘 rail·상단 메뉴 disclosure를 소유하고 App은 typed WorkspaceId와 열린 작업 공간 상태를 유지한다. CodeCompare에서 중복 chrome만 제거하며 각 도구의 lazy 최초 mount/hidden 보존·Worker 활성 컨텍스트·Folder handoff를 유지한다.
- 대안: 각 도구에 헤더·rail 복사 또는 탭마다 재mount. 복사는 상태/스타일 중복, 재mount는 입력·모델 수명 손실 가능성이 있어 공통 부모를 선택했다. 비교 엔진이나 도구 책임은 변경하지 않았다.
- 동작: 기본 hidden인 상단 메뉴는 헤더 버튼의 aria-expanded/controls로 토글한다. 메뉴 안에서 Escape 시 닫고 버튼으로 포커스를 반환한다. 아이콘 메뉴는 닫힌 상태에서도6개 도구를 연다. 메뉴/테마/크기는 세션 전용이며 파일 저장이나 네트워크 기능을 추가하지 않는다.
- 레이아웃: sticky 헤더와 rail. ResizeObserver로 실제 topbar 높이를 측정해 메뉴 줄바꿈·모바일에서도 rail이 헤더 뒤로 숨지 않게 한다. observer는 unmount 때 해제한다. 화면 설정 팝업은 헤더 아래로 열어 메뉴 닫기 버튼을 가리지 않는다.
- 영향: components/AppShell.tsx, app/App.tsx, app/CodeCompare.tsx, style.css. phase8/performance 테스트는 화면 설정 전 메뉴를 열도록 사용 흐름만 조정한다. 신규 의존성 없음.
- 검증: UI E2E로 header/rail DOM 동일성,6개 공간 이동·선택 표시·CRLF 원문 저장, 기본 숨김/키보드 열기/Escape/버튼 닫기, Light 설정 보존,390/768px overflow·팝업 범위·scroll sticky를 확인한다. 최초 팝업이 닫기 버튼을 가린 실패는 위치 수정 후 재검증한다. 전체 결과는 PROGRESS 최신 기록 참조.

## ADR-024 · 2026-11-10 · Code Compare의 단일 비교 결과와 시각 어댑터

- 문제: 옵션은 core/diff의 분석에 적용됐으나 Monaco 기본 비교는 다른 기준을 사용했다. 후행 공백 옵션이 들여쓰기까지 숨기고 내부 공백/빈 줄/대소문자 강조는 남았으며 EOL은 통계만 바뀌었다.
- 선택: 기존 Text 엔진은 그대로 두고 Code Compare의 text Worker 요청에만 visual=true를 추가한다. core/visualDiff는 동일 hunks를 물리 줄/원문 UTF16 문자 범위로 투영한다. 두 번째 줄 비교나 정규화된 편집 문서는 만들지 않는다. JSON/Folder/Syntax/Patch 책임 및 원문 정책은 유지한다.
- 시각: CoreDiffProvider가 기존 Monaco Diff Editor에 Worker에서 받은 범위를 전달한다. 좌우/Unified, 원문 편집, MiniMap, 탐색/접기를 유지한다. EOL/EOF 차이는 원문에서 추출한 라벨을 zero-length injected text로 표시하며 모델 값/복사/저장에 넣지 않는다. 후행 공백은 들여쓰기를 건드리지 않으며 Unicode case expansion/astral 문자의 원래 UTF16 열로 매핑한다.
- 대안: 정규화 문자열을 편집 모델에 넣으면 원문/편집/복사 보존이 깨진다. 두 개의 새 에디터로 재구현하면 Unified·정렬·접기 수명 회귀가 크다. 기본 diffAlgorithm 옵션은 커스텀 provider를 공개 타입으로 받지 않는다. createDiffEditor의 서비스 override는 첫 전역 초기화에만 적용돼 초기 시도는 실제 브라우저에서 실패했다.
- 호환성 경계: Code Compare 인스턴스의 child instantiation service에만 diff provider를 주입한다. 어댑터 한 파일과 types/monaco-diff.d.ts에 Monaco 내부 계약을 격리하고 버전을0.52.2로 고정한다. 전역 서비스를 교체하거나 private editor 필드를 패치하지 않는다. Folder/Syntax는 기존 native factory 그대로다. Monaco 업데이트 시 이 내부 생성 경계를 재검증해야 한다는 유지보수 비용을 수용한다.
- 수명/동시성: ManagedDiffEditor의 공개 view-model 소유/취소/모델 재사용을 유지하고 child service를 unmount 때 dispose한다. core 결과가 없거나 모델 텍스트가 snapshot과 다르면 이전 강조를 지운다. 취소/오류는 workspace에서 표시하고 이를 Monaco timeout 또는 파일 동일로 처리하지 않는다. EOL 정규화 snapshot은 원문 변경 때만 계산한다.
- 한도: visual 요청만 Worker에서 투영하고 줄 내부는 양쪽합20k자/라인20ms/전체100ms 예산이다. 한도 초과는 행 강조로 폴백하고 안내한다. 원문·통계·행 범위는 자르지 않는다. JS heap 측정은 전체 브라우저 메모리가 아니며 최신 검증/성능은 PROGRESS와 별도 JSON을 따른다.
- 영향: core/visualDiff, components/CoreDiffProvider, ManagedDiffEditor, app/CodeCompare, workers/protocol/execute, style, package/lock, 단위/E2E 및 문서. 새 의존성 다운로드/외부 서버 처리 없음.
- 검증: 원문/EOL·옵션 ON/OFF·좌우/Unified·빈 모델/EOF·필터 후 물리 좌표·접기/편집·기존 다른 도구 회귀 및 별도 대용량12시나리오. 성공/실패와 최종 수치는 PROGRESS에 기록한다.

## ADR-025 · 2026-11-10 · CSV leaf 타입 보존과 명시적 빈 레코드 처리

- 문제: Flatten이 숫자를 문자열화한 뒤 수식 방어에 넘겨 음수에 작은따옴표가 붙었다. 빈 테이블은 빈 문자열 결과가 UI에서 숨겨졌고, 빈 Header를 내보낸 뒤에는 가져오지 못했다. 기본 JSON 예제와 CSV 입력창의 혼동도 확인했다.
- 선택: flatten은 Json leaf 타입을 보존하고 최종 CSV 셀 단계에서 배열/객체만 JSON 문자열로 만든다. 숫자/boolean/null과 수식 문자열을 구분하며 Papa의 escapeFormulae는 유지한다. 데이터/컬럼이 없거나 실제 선택 Header가 비어 있으면 명시적으로 거부한다. Flatten의 '/' Pointer처럼 비어 있지 않은 출력 Header는 계속 지원한다.
- 빈 행: 기존 엄격 동작을 기본으로 보존하고 skipEmptyRows를 명시적으로 추가한다. Papa의 skipEmptyLines=true는 따옴표로 감싼 빈 값도 지울 수 있어 사용하지 않는다. step의 raw cursor를 원문 레코드와 대조해 완전히 빈 비인용 레코드만 건너뛰며 quoted empty/공백/구분자 행/인용 내부 개행은 유지한다. BOM을 먼저 정리해 cursor 기준을 맞추고 오류 번호에는 원래 CSV 레코드 순서를 사용한다.
- UI: CSV→JSON이면 왼쪽에 Source CSV를 표시하고 JSON 원문/모델은 unmount하지 않고 숨겨 보존한다. 방향별 예제를 제공하고 CSV 변환 오류는 버튼 옆에 둬 모바일에서도 찾을 수 있게 한다. source CSV 복사/저장은 현재 메모리만 사용한다. 문자 입력은 textarea의 LF 정규화가 가능하고 파일 업로드 직후 raw CRLF 보존과 구분한다.
- 동시성: skipEmptyRows도 action snapshot/결과 무효화에 포함한다. 새 입력/방향/옵션/탭/취소 시 이전 Worker 결과를 버리는 기존 경계는 유지한다. CSV는 Worker 안에서 처리하고 원본 파일을 쓰거나 외부 서버에 보내지 않는다.
- 대안: 빈 행을 항상 지우면 기존 단일 컬럼 빈 레코드 의미가 바뀐다. 모든 문자열 수식 방어를 끄면 숫자 문제는 가려도 기존 방어 정책을 잃는다. 기본 JSON을 탭 전환 때 자동 교체하면 사용자 입력을 바꾸므로 명시적 예제 버튼만 사용한다.
- 영향: core/json/csv, JSON workspace/store, Worker jsonAction 옵션, CSS·관련 단위/E2E·문서. 새 의존성 없음. Text/JSON 구조 비교/Folder/Syntax/Patch 정책은 변경하지 않는다.
- 검증: CSV23개 단위·Worker 통합(총397), 신규 CSV UI 및 기존 전체 production 회귀. 최종 수치와 최초 fixture 오류·편집 LF/업로드 CRLF 차이는 PROGRESS에 기록한다. 원격 CI·실제 사이트 결과와 로컬 결과를 구분한다.
