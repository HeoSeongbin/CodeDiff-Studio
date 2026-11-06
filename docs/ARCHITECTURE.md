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
