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
