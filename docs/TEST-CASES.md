# 테스트 사례와 실행

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

최종 결과 (2026-11-06): 자동화 **271/271**, Edge E2E **18/18**, typecheck/lint/build 통과. Monaco 번들 크기 경고 유지.

## 단위 테스트

`src/tests/core.test.ts` — 기존 12개: 동일/빈/한쪽 빈 파일, 추가/삭제와 정확한 줄 번호, 수정 추정, 여러 블록과 반복 코드, EOF와 CRLF/LF/CR, 공백·대소문자 옵션과 원문 불변, 한글/emoji, UTF8/BOM/UTF16, 디코딩·바이너리·크기 오류, 언어 감지.

`src/tests/phase2.test.ts` — 신규 8개: 줄 끝 공백 정책과 EOF, 빈 줄 필터 후 물리 번호, 순수 삽입·삭제 기준점, 제외 행이 낀 변경 범위, word/character 결과로 Unicode·개행 원문 재구성 (2개), 상세 크기 제한 fallback, UTF8 다운로드 내용.

## 브라우저 통합 테스트

`e2e/compare.spec.ts` — 기존 2개: 로컬 Monaco와 4가지 언어 업로드·변경 위치/강조·탐색·직접 편집, 외부 요청 없음, 인코딩 오류 및 390px 레이아웃.

`e2e/phase2.spec.ts` — 신규 3개:

1. Unified 원본 줄번호 여백과 수정 열 삭제 강조, 좌우 복귀, 단어 상세, 보기 옵션, 클립보드와 실제 CRLF 다운로드, 편집 후 재비교, pageerror 없음.
2. 빈 줄·행말 공백·대소문자 옵션 결과 및 탐색 상태, 옵션 후 원문 다운로드, 필터 해제 후 물리 줄 번호.
3. 긴 파일 동일 영역 접기와 복원, 편집 후 원본·수정본 실제 다운로드 내용, CRLF/EOF 유지, 390px Unified overflow.

E2E는 설치된 Edge가 필요하다. 포트 충돌 시 PowerShell에서 `$env:CODEDIFF_TEST_PORT='5192'` 설정. 제한 환경의 로컬 소켓 접근이 막히면 허용된 실행 환경에서 수행한다.

화면: docs/phase2-desktop.png, docs/phase2-mobile.png. 미검증: 모바일 실기기, GitHub Pages, 대용량 성능/메모리, 모든 언어 tokenizer 정확성. JSON/Folder/Mapping/Patch/AST 테스트는 해당 Phase에서 추가한다.

## Phase 3 최종 검증 (2026-11-06)

Phase 3 당시 결과: 단위 **74/74**, Edge E2E **9/9**, typecheck/lint/build 통과. 런타임 npm audit 0건. 기존 Monaco chunk 크기 경고와 개발 의존성 moderate 10건 유지.

`src/tests/json.test.ts` 신규 54개: 표준 JSON 원시 값·문법 오류·unsafe 숫자·예산, 재귀 정렬 원문 불변/프로토타입 방어, 구조 비교의 null/부재·배열/타입/경로, lazy 트리 모델, JSONPath 허용 문법/실행 거부/step 0/재귀 제한·특수문자 경로 왕복, Schema nullable/optional/혼합 배열·required 오류·외부 참조 거부, 타입 생성 TS syntax+semantic 검사·예약어·이름 충돌, CSV quoting/구분자/개행/한글·빈 셀·Header 오류·수식 방어·큰 정수·prototype-looking 필드.

`e2e/phase3.spec.ts` 신규 4개:

1. 작업 공간 이동·JSON 포맷/정렬·실제 원문 다운로드·정밀도 차단·문법 오류·외부 요청 및 pageerror 없음.
2. 15,002 트리 노드에 DOM 24행, 검색·JSONPath 결과 클릭 선택, 코드 필터 거부, 구조 비교·좌우 트리·미변경 필드 제외.
3. Schema 생성/검증 통과·실패, TypeScript 생성/예약어, CSV Flatten/타입 추론, 390px 화면.
4. Monaco 직접 타이핑 문법 오류/undo, JSONPath 결과 100건 페이지, 실제 ts/CSV 다운로드, 수식 접두사, CSV 파일 업로드.

Phase 3 화면: docs/phase3-json-diff.png, docs/phase3-json-mobile.png. 새 도구는 로컬 dev 환경에서 검증했으며 GitHub Pages·모바일 실기기·Worker 성능은 미검증이다.

## Phase 4 최종 검증 (2026-11-06)

Phase 4 당시 결과: 단위 **161/161**, Edge E2E **12/12**, typecheck/lint/build 통과. 신규 패키지는 없음.

`src/tests/mapping.test.ts` — 신규 87개:

- 경로 문법·escaped key·숫자/문자 Key·index/wildcard·root, 위험 segment와 표현식·초과 경로 차단.
- 중복/동일 alias/부모-자식/shape/wildcard-index 충돌과 유효 형제 경로.
- deep-freeze Source 불변, 독립 clone·null/부재·falsey 기본값, 상수·적용 해제·missing skip, atomic failure, root 원시값/배열.
- 엄격한 number·boolean·scalar string·UTC date, 윤년/잘못된 일자·시간대 거부·정밀도.
- 배열 전체/부분/wildcard, index 유지·빈 배열/누락 collection·defaults·per-item constants, holes/mismatch 거부.
- versioned/array rules 왕복·unknown fields/transform/version·ID·draft JSON errors·excess rule count, Source 및 Target·export 예산, cyclic/nonfinite 입력, 결정성.

`e2e/phase4.spec.ts` — 신규 3개:

1. 트리 Source 경로 선택·규칙 추가/rename/제외/삭제, Target 트리 선택·실제 다운로드·Code/JSON/Mapping 전환 유지, pageerror/외부 요청 없음.
2. 파일 Source와 가져온 규칙으로 number/boolean/date/constant/default/wildcard/null 결과, 클립보드, 충돌 시 결과 제거·저장 불가, 기본값 수정·Source 원문 다운로드 유지·390px layout.
3. prototype 경로 import 실패 시 기존 규칙 유지, versioned 실제 파일 export/import, empty array/null root/zero rules.

화면: docs/phase4-mapping-desktop.png, docs/phase4-mapping-mobile.png. 미검증: 모바일 실기기·GitHub Pages·Phase 8 Worker 성능/취소. Phase 5 Patch 테스트는 다음 단계에서 추가한다.

## Phase 5 최종 검증 (2026-11-06)

전체 **229/229 테스트**, Edge E2E **15/15**, TypeScript·ESLint·Production Build 통과. `npm test`에는 Git CLI가 필요하다.

- `src/tests/patch.test.ts` 53개: 원문 정확 적용(Unicode/BOM/EOF/혼합·CRLF↔LF/단독CR/빈쪽), 화면 옵션과 독립, 파일 생성/삭제·동일 파일, hunk 범위·문맥·통계, 경로 안전성·quoted Unicode, 손상된 Patch/원본/예상결과, 입력·출력 한도/NUL·surrogate, 0-line hunk 결정성.
- `src/tests/patch-git.test.ts` 15개: 자동 생성된 임시 fixture에서 Git --check 후 실제 적용. 결과 bytes 일치·삭제 확인, 문맥0 flag, UTF-8 한글·공백 경로·EOF·CRLF/LF/혼합·빈 파일. cleanup은 검증된 tmpdir 하위 codediff-patch-*에만 수행.
- `e2e/phase5.spec.ts` 3개: 화면 옵션으로 숨겨진 원문 차이, 실제 .diff/.patch 내용 및 Node 적용 결과, clipboard·CR 표시·재검증·0 context, 코드 편집 후 결과 무효화, 경로 오류·동일 파일, explicit create/delete·EOF·Unicode·390px overflow 없음. 외부 요청/pageerror 0건.

최종 화면: docs/phase5-patch-desktop.png / docs/phase5-patch-mobile.png. 실제 GNU patch·GitHub Pages·실기기 및 대용량 성능은 미검증이며 다음 Phase 범위와 구분한다.

## Phase 6 최종 검증 (2026-11-06)

전체 **271/271 테스트**, Edge E2E **18/18**, typecheck/lint/build 통과. 신규 dependency 없음.

- `src/tests/folder.test.ts`: 신규42개. native root/paths·제외 전 IO 방지·extension/case collision·budgets, file statuses/rename·빈/부재·EOF/EOL/Unicode/공백/BOM/UTF16, binary/mixed/error/size mismatch, cooperative cancellation/progress·300파일, content-free report·Map-safe tree·file→directory dual rows, byte-identical fast path와 diff timeout/error.
- `e2e/phase6.spec.ts`: 신규3개. 실제 browser directory input을 임시 원본/수정 폴더로 검증. 모든 상태·binary/error·selected Diff·수동 Code Compare 교체 및 CRLF 편집/원본 disk 불변, full/subset JSON 다운로드, filter/excludes/empty/ignore-case, cancel/restart·350파일 가상 DOM 최대28, 실제 Diff의 390px 화면. 외부 요청/pageerror0.
- ManagedDiffEditor로 Monaco detach-before-dispose 수명 관리 보정. binary 전환/Code Compare 재생성에서 발생하던 실제 pageerror를 탐지하고 해결한 뒤 모든 기존 E2E 재검증.

화면: docs/phase6-folder-desktop.png / docs/phase6-folder-mobile.png. 실제 GitHub Pages·실기기·대형 project memory/time benchmark는 미검증. folder tests의 tmpdir codediff-folder-*는 생성된 절대경로 검증 후 그 디렉터리만 정리한다. 다음 AST 테스트는 Phase 7에서 추가한다.
