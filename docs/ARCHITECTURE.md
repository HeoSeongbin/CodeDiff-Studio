# 아키텍처

Phase 1은 `app/App.tsx`(화면·Monaco lifecycle), `stores/workspace.ts`(메모리 상태), `core/file.ts`(디코딩·언어 감지·제한), `core/diff.ts`(UI 독립 비교), `tests/core.test.ts`로 구성한다.

파일 바이트 → 크기 검사 → BOM/수동 인코딩 → fatal TextDecoder → 바이너리 검사 → 편집용 상태 → 250ms debounce → jsdiff → 변경 블록 목록. Monaco는 원문을 받아 자체 diff 및 구문 강조를 수행한다. 업로드 파일 자체는 수정하지 않는다. 상태는 localStorage에 저장하지 않는다.

DiffLine은 원문, 원본/수정 줄 번호와 added/removed 연산을 보유한다. 연속된 변경 연산을 DiffHunk로 묶는다. 삭제·추가가 같이 있는 블록의 modified는 휴리스틱이며 이동은 판정하지 않는다. 비교 옵션은 정규화 비교자에만 적용한다.

향후 기능은 PROJECT.md의 독립 Text/Structured/Folder/Syntax 엔진 경계를 따른다. 지금은 미사용 라이브러리와 빈 기능 화면을 만들지 않는다.

## Phase 2 확장

- `core/diff.ts`: 물리 줄 번호 토큰과 blank/trailing-whitespace 정규화. oldEnd/newEnd는 제외된 빈 줄이 있어도 실제 변경 범위를 표시한다. totalLines는 원문 두 입력의 줄 토큰 합계.
- `components/ChangeDetail.tsx`: 선택 블록 원문에 대한 word/character 강조. 대형 블록·시간 초과 시 원문 전체 fallback. 안전한 React 텍스트 렌더링.
- `core/export.ts`: 옵션·분석 결과와 독립적으로 현재 편집 원문 UTF-8 다운로드. JSON/Folder/Patch 엔진과 의존성 없음.
- App: Unified/좌우 전환, 자동 줄바꿈·동일 영역 접기·문맥 수, 복사와 저장, 업로드 요청 버전 검증. 사용자 편집과 프로그램에 의한 모델 동기화를 분리하여 CRLF 손실 방지.

## Phase 3 — JSON 독립 엔진

`app/App.tsx`는 Code Compare / JSON Tools 선택과 lazy boundary만 담당한다. `app/CodeCompare.tsx`는 기존 비교기이며 Text Diff와 파일 처리를 보존한다. 두 workspace는 브라우저 세션 메모리에서만 상태를 유지한다.

`stores/jsonWorkspace.ts`는 JSON source/target/schema/csv/tab을 별도로 보관한다. `features/json-tools/JsonWorkspace.tsx`가 도구 입력·실행과 결과 무효화를 조정한다. JsonTree는 펼친 노드의 flat 모델에서 24행만 렌더링하고 ResultList는 100건 페이지를 표시한다.

`core/json/value.ts`는 표준 파싱, 숫자·깊이·값 수·바이트 제한, 구조 비교와 트리 모델이다. `query.ts`는 평가 없는 제한 JSONPath, `schema.ts`는 샘플 추론·Ajv·타입 생성, `csv.ts`는 Papa Parse와 명시적 손실/수식 정책을 담당한다. Text Diff, Folder Diff, Field Mapping에 의존하지 않는다. 공통 file loader와 UTF-8 download 유틸만 재사용한다.

입력 변경 → 파싱 결과/오류 → 현재 도구 실행 → 결과. Source/설정 변경 시 생성·검증·검색 결과를 비워 이전 입력의 결과를 다시 저장하지 않게 한다. Monaco JSON Worker의 외부 Schema 요청은 명시적으로 끈다. Schema 외부 $ref는 네트워크로 해결하지 않으며 사용자 코드 평가 기능을 제공하지 않는다.

## Phase 4 — Field Mapping

`core/mapping/path.ts`는 실행 없는 경로 토큰화와 잠재 쓰기 충돌을 담당한다. `engine.ts`는 규칙 형태/경로/값 검증, source own-value 조회, 명시적 변환, 독립 Target 생성과 예산·희소 배열 검사, 버전별 규칙 입출력을 담당한다. `drafts.ts`는 편집용 기본값·상수 문자열을 JSON 리터럴로 검증하여 엔진 규칙으로 변환한다. Text Diff·Structured Diff·미구현 Folder Diff에 의존하지 않는다.

`stores/mappingWorkspace.ts`는 Source 문자열·규칙 draft를 별도 세션 메모리에 보관한다. `features/field-mapping/MappingWorkspace.tsx`는 Source Monaco·가상 트리, 규칙 카드, Target JSON·트리의 반응형 3열 UI다. App의 지연 로딩 boundary로 연결하며 이전 workspace를 보존한다.

입력 변경 → Source 파싱 + draft/규칙 검증 → 250ms debounce → 엔진 → 성공 시 독립 Target 또는 오류 목록. 결과는 Source 문자열과 규칙 참조 snapshot에 결합되어 값이 바뀌는 render부터 이전 결과를 사용하지 않는다. 실패한 import는 상태에 적용되지 않는다. 버튼 클릭으로만 clipboard·파일 다운로드를 수행한다. 업로드 결과는 입력별 요청 세대를 확인한다.

## Phase 5 — Patch Export

`core/patch/patch.ts`는 경로·입력 유효성, 원문 Unified Patch 생성, 적용 결과 검증을 담당한다. Text Diff normalizer의 hunks나 옵션을 입력받지 않는다. jsdiff 원문 serializer → Patch 문자열 parse/apply → 예상 수정본 exact match가 출력의 기준이다. auto EOL conversion을 끄고 메타데이터 LF/본문 CR을 구분한다.

`features/patch-export/PatchExport.tsx`는 Code Compare 스토어의 원문 문자열을 구독하고 경로·문맥·파일 작업을 선택한다. App lazy boundary로 제공하며 기존 작업 공간 상태를 유지한다. 생성 snapshot과 현재 입력이 다르면 표시/복사/저장을 차단한다. 원문은 편집하지 않고 메모리 내 적용 검사만 수행한다. 파일 다운로드는 기존 UTF-8 유틸을 사용한다.

테스트 경계: 코어 roundtrip과 손상 거부, 외부 Git CLI 임시 fixture 적용 및 bytes 검증, 브라우저 실제 다운로드/입력 변경/회귀. 외부 서버나 사용자 디스크 파일 적용 기능은 추가하지 않았다.

## Phase 6 — Folder Compare

`core/folder/engine.ts`는 native FileList→selection 변환, 경로/옵션/예산 preflight, 읽기 전 제외/extension, 상대 경로 Map 매칭, sequential pair read·decode·bytes/text 비교, status/통계/report를 담당한다. 기존 text comparator만 호출하며 JSON의 구조 의미론·Mapping·Patch를 사용하지 않는다. Raw bytes는 pair 처리 후 버리고 report는 content를 제외한다.

`core/folder/tree.ts`는 결과 subset에서 Map hierarchy를 만들고 collapse 상태를 flat virtual rows로 변환한다. 동일 path가 old file/new directory일 때 directory row와 file row를 동시에 남긴다. `stores/folderWorkspace.ts`는 선택 File refs와 옵션만 메모리에 보관한다. `FolderCompare.tsx`는 lazy workspace, progress/cancel·snapshot·virtual28rows·readonly selected Diff·export를 담당한다.

`components/ManagedDiffEditor.tsx`는 parent layout cleanup에서 editor의 model을 분리하고 해제하여 React wrapper의 passive cleanup 순서 문제를 방지한다. CodeCompare와 Folder preview 양쪽에서 사용한다. 폴더 결과는 자동으로 전역 코드 입력을 덮어쓰지 않으며 명시적인 Code Compare 복사 버튼으로만 handoff한다. 그때 기존 편집 모델을 재생성해 원문 EOL을 감지한다.

## Phase 7 — Syntax Compare

core/syntax/adapters.ts의 언어별 AST 노드 정책, browser.ts의 로컬 runtime/grammar 로더, compare.ts의 detached AST 정보 추출·독립 매칭을 분리한다. 각 언어 Language promise만 캐시하며 parser/tree는 분석마다 생성·해제한다. 실패한 로드 캐시는 제거한다. UI는 Code Compare store의 원문 snapshot을 읽고 입력/언어가 바뀌면 이전 결과를 숨긴다. readonly Text Diff 선택 줄 이동만 수행하며 Text/JSON/Folder 엔진의 정책은 변경하지 않는다.

CR-only 원문은 길이를 보존한 분석 복사본에서 파싱하고 원문 offset으로 물리 줄을 계산한다. 문자열 내용은 보존하며 AST의 공백·주석 leaf만 제외한다. scope/kind/name/parameters의 보수적 매칭과 유일 동일 본문 rename 후보를 사용하고 이동·의미 동등성을 판정하지 않는다. 클래스 본문과 내부 메서드 변경은 별도 요소다.

ManagedDiffEditor는 Monaco 공개 API로 Diff editor와 두 model을 직접 소유한다. 외부 snapshot 교체는 이전 diff view-model 취소 후 다음 task에서 setValue하고 재연결하며, 직접 편집 echo는 값이 같으면 무시한다. clear pending timer → model detach → editor dispose → text models dispose 순서로 종료한다. 다른 JSON/Mapping 단일 Editor의 React wrapper는 유지한다. Playwright CODEDIFF_TEST_PREVIEW=1은 빌드된 dist를 테스트한다.

StrictMode의 시험 mount는 취소 가능한 microtask로 editor 생성 전에 종료해 버려진 인스턴스의 Worker 요청을 만들지 않는다. 실제 mount 시점에는 최신 props로 두 모델과 옵션을 초기화한다.
