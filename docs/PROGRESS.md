# 개발 진행 현황

기준일: 2026-11-09 (Asia/Seoul)

## 현재 Phase

Phase 8 완료. Phase 9 — 통합 테스트 및 배포 진행 중. 현재는 GitHub Pages 빈 화면 복구 범위이며 Phase 9 전체 완료로 처리하지 않는다. 이전 기록은 당시 이력이며 최신 상태는 하단 배포 복구 기록을 기준으로 한다.

## 완료 작업

- 빈 작업 폴더와 Git 미초기화 상태 확인. 기존 파일 없음.
- 제공 지시서 전체를 PROJECT.md에 보존, AGENTS/README/PROGRESS/DECISIONS/ARCHITECTURE/TEST-CASES 생성.
- React 18, strict TypeScript, Vite, Tailwind, Zustand, Lucide 및 로컬 Monaco/Worker 구성.
- Side-by-Side 양쪽 편집, 파일 업로드·Drag & Drop·언어 감지·수동 언어·인코딩 선택.
- 독립 jsdiff 엔진, 원문 줄 종결자 보존, 변경 줄 번호·변경 목록·위치 탐색·휴리스틱 수정 표시.
- UTF8/BOM/UTF16 처리, fatal 디코딩, 바이너리 검사, 업로드 및 UTF8 편집 5 MiB 상한.
- 한국어 Dark UI, 작은 화면 레이아웃, 오류 상태·계산 상태, 예제 입력.

## 검증 결과

- npm run typecheck: 통과.
- npm run lint: 통과.
- npm test: 12/12 통과 (Vitest 5.1).
- npm run test:e2e: 2/2 통과 (설치된 Microsoft Edge, Playwright).
- 실제 Monaco 렌더링, Java/Python/C#/HTML 업로드 및 언어 설정, 변경 줄 위치·추가 강조·변경 탐색·직접 입력 후 재비교 검증.
- 파일 오류 메시지와 390px 뷰포트 수평 overflow 없음 검증.
- 브라우저 요청 감시에서 외부 요청 0건.
- Production Build 통과. Monaco 본체 약 3.52 MB(압축 약 917 KB), TS Worker 약 6 MB, chunk 크기 경고 있음.
- docs/phase1-desktop.png 생성 및 시각 검토.

## 해결한 오류

- ESLint 제어문자 정규식 경고: 문자 코드 검사로 교체.
- debounce 완료가 파일 오류를 지우던 문제: 업로드 오류와 비교 오류 상태 분리.
- Vitest가 Playwright 파일을 수집하던 문제: unit include 범위 명시.
- 테스트용 Chromium 미설치: 설치된 Edge 채널 사용.
- 초기 Vitest 관련 critical 취약점 2건: 최신 Vitest로 해소.

## 알려진 제약 / 미완료

- Monaco 시각 diff와 jsdiff 분석 목록은 독립 엔진. 모든 공백/대소문자/EOL 옵션 결과가 Monaco 강조와 다를 수 있어 화면 및 README에 안내.
- npm audit: dev-only minimatch 전이 의존성에 moderate 10건 남음. 호환 범위 audit fix로 해결되지 않음. 무리한 강제 downgrade/override는 하지 않았으며 후속 의존성 업데이트 필요. critical/high 0건.
- Phase 8에서 Worker 기반 계산·취소와 대용량 성능 행렬을 검증했다. Text250ms/JSON100ms debounce, Worker wall10초·Text/Monaco1.5초·Folder15초 예산. 5MiB는 보호 한도이며 모든 기기·입력 조합의 성능 보장은 아니다. 상세 관측값은 PERFORMANCE/JSON 기록 참조.
- Light 테마·MiniMap·패널 조절·키보드/반응형 개선은 Phase 8에서 구현했다. 배포는 미구현. AST는 Phase 7에서 구현했다. Folder Compare는 Phase 6에서 구현했다. Patch Export는 Phase 5에서 구현했다. Field Mapping은 Phase 4에서 구현했다. JSON Tools는 Phase 3에서 구현했다. Unified와 코드 다운로드는 Phase 2에서 구현했다.
- Git 저장소는 Phase 2 이후 초기화 및 origin/main 연결·푸시 완료 (시작 시 최신 커밋 5876a9f, main이 origin/main보다2개 앞섬). 배포는 미수행. 아래 Phase 1·2의 Git 미초기화 표기는 당시 이력이다.
- E2E 실행 환경은 Edge 필요. 다른 OS는 playwright.config.ts의 channel 변경 또는 Chromium 설치 필요.
- 배포 환경 및 모바일 실기기 미검증.

## 다음 작업

다음 세션은 Phase 9 — 통합 테스트 및 배포. 필수 문서·Git·실제 코드/테스트를 대조하고 통합 테스트 확대·GitHub Actions/Pages 배포를 진행한다. 원문 전송 금지와 미검증 완료 금지 원칙을 유지한다. 이번 Phase 8 변경은 아직 커밋·푸시하지 않았다.

## Phase 2 · 2026-11-06 · 이번 세션

### 시작 상태 대조

AGENTS, PROJECT, PROGRESS, DECISIONS, README 및 실제 소스·테스트를 확인했다. Git 미초기화 상태를 재확인했다. 기존 12개 단위 테스트·typecheck·lint 통과 후 진행했으며 이전 Phase 1 기록과 일치했다.

### 완료 기능

- Side-by-Side / Unified 전환, 기존 좌우 편집 및 Unified 수정본 편집, 편집 후 debounce 재비교.
- 추가·삭제·블록 통계 보존, 변경 파일 1쌍 기준 통계와 원문 줄 토큰 합계.
- 선택 변경 원문 단어/문자 강조, CRLF/LF/CR/EOF 표기, 20k code unit/200ms 상세 한도와 전체 블록 fallback.
- 기존 모든 공백·대소문자·EOL 옵션 보존, 줄 끝 공백/빈 줄 무시 추가. 필터 후 실제 물리 줄 번호와 끝 범위를 유지한다.
- 자동 줄바꿈, 변경 영역 접기/전체 보기, 문맥 줄 0/3/5/10 선택.
- 명시적 버튼을 통한 각 편집본 클립보드 복사와 UTF-8 다운로드. 비교 옵션은 저장 내용을 바꾸지 않는다.
- 계산 중 오래된 통계/목록 제거, 탐색 비활성화. 중복 비동기 업로드의 최신 요청만 수락하고 예제 입력은 대기 요청 무효화.

### 발견·해결 문제

- 실제 다운로드 E2E에서 CRLF가 LF로 바뀌는 기존 동기화 결함 발견. wrapper 프로그램 변경을 사용자 편집으로 역기록하지 않고 업로드 setValue로 EOL 감지하도록 수정.
- 빈 줄 제외 후 줄 번호·삽입/삭제 기준점·물리 끝 범위가 잘못 계산될 가능성을 원문 번호 토큰으로 방지. 한쪽 0줄 변경은 목록에 ‘없음 (위치 n)’으로 표시.
- E2E의 Unified DOM 가정과 높이 0인 접기 컨테이너 선택을 실제 Monaco 소스 기준으로 보정. 실제 삭제 강조·단일 열 폭과 보이는 접기 자식을 검증한다.
- 제한 환경의 포트 충돌을 피하도록 CODEDIFF_TEST_PORT 설정 지원.

### 최종 검증

- npm test: 20/20 통과 (기존 12 + 신규 8).
- npm run typecheck / npm run lint: 통과.
- npm run build: 통과. Monaco 큰 chunk 경고 유지 (main 약 3.525 MB, gzip 919 KB; TS Worker 약 6 MB).
- Edge Playwright: 5/5 통과 (기존 2 + 신규 3). 최종 테스트 포트 5192.
- Java/Python/C#/HTML 업로드·언어 설정·줄 강조·탐색·직접 입력 회귀 통과. 기존 외부 요청 감시 0건.
- Unified 실제 단일 열·삭제 강조, word 상세, 코드 복사, 실제 다운로드 CRLF 내용, 옵션 후 원문 저장, 빈 줄 필터 번호, 동일 영역 접기/복원, 수정 후 원본 유지와 수정본 CRLF, 390px Unified overflow 없음 통과.
- docs/phase2-desktop.png 및 phase2-mobile.png 생성·시각 검토. 기존 phase1-desktop.png도 회귀 테스트에서 재생성됨.

### 남은 제약과 다음 단계

- Monaco 시각 강조/영역 접기와 jsdiff 옵션 분석은 독립 정책. 공백/빈 줄/대소문자/EOL 옵션은 분석 목록에 적용되고 상세는 원문이다. 이 차이를 UI/README/ADR에 명시했다. 엔진 완전 일치는 미구현.
- 다운로드는 BOM 없는 UTF-8 편집 텍스트이며 원본 바이트 인코딩 복원이 아니다. 사용자 편집 후 혼합 EOL은 Monaco 모델 형식으로 통일될 수 있다.
- 대용량 main-thread 제한, MiniMap, Light 및 성능 측정은 후속 Phase. Monaco DiffEditor가 minimap을 내부적으로 비활성화하므로 작동하지 않는 토글은 제공하지 않았다.
- 의존성 변경 없음. 이전 보안 조회의 dev-only moderate 경고 10건은 이 세션에서 재조회하지 않았다.
- JSON/Mapping/Patch/Folder/AST/배포 미착수. 현재 진행 중 작업 없음. 다음은 Phase 3.

## Phase 3 · 2026-11-06 · JSON Tools

### 시작 상태 대조

AGENTS/PROJECT/PROGRESS/DECISIONS/README와 소스·테스트를 확인했다. main은 origin/main과 동기화된 clean 상태였으며 f551ae7까지 커밋되어 있었다. 문서의 Git 미초기화 기록은 과거 상태이므로 최신 상태를 보정했다. 기존 단위 20개·타입·ESLint가 통과했다.

### 완료 기능

- Code Compare를 app/CodeCompare.tsx로 분리하고 App에 작업 공간 전환 추가. 기존 컴포넌트를 유지하여 편집/보기 상태 보존. JSON 작업 공간 지연 로딩.
- 표준 JSON Monaco Editor, 파일 업로드·직접 입력·실시간 오류, Pretty/Minify/Key Sorting·들여쓰기·복사·다운로드.
- 별도 JSON 값 타입·파싱·숫자 정밀도/입력 예산 검사. 1 MiB, 30k 값, 깊이 80의 보수적 임시 제한.
- Tree Viewer: 타입·경로·노드 선택·Key/Value 검색·전체/깊이 펼침·접기·경로와 값 복사. 가상화로 DOM 최대 24행.
- 자체 index 기반 Structural Diff: Key 순서 무시, null/필드 부재·타입 구분, 배열 길이 요약과 상세 필드 변경 분리, 좌우 트리·강조·통계·이전/다음·변경 필터.
- JSONPath-Plus eval:false와 허용 문법 검증. 특수문자 Key의 복사 경로 직접 해석. 필터/코드 평가 금지, 재귀 한 번/표현식 500자 제한. 결과 경로·값·복사·저장·트리 선택.
- Schema Draft-07 추론, Ajv 검증·오류 위치, required·nullable·중첩·혼합 배열, 직접 편집/파일·복사·저장. 외부 참조 요청 및 데이터 강제변환 없음.
- 자체 TypeScript 생성: 타입명·interface/alias·export·중첩·optional/nullable/union·empty unknown[], 복사·다운로드. 예약어·충돌 이름 처리.
- Papa Parse CSV ↔ JSON: 컬럼 선택·선택 순서·JSON Pointer Flatten, 파일/직접 입력, 구분자·타입 추론, 미리보기·저장, 수식 접두사 방어.
- 결과 변경 시 오래된 결과 무효화, 변경/검색 결과 100건 페이지, 입력별 업로드 요청 세대 관리.

### 발견·해결 문제

- JSONPath slice step 0과 반복 재귀의 결과 증폭을 명시적으로 거부.
- 특수문자 Key의 JSONPath 라이브러리 표기 차이는 canonical JSON-escaped bracket 경로의 자체 own-property 해석으로 왕복 검증.
- 단일 컬럼 빈 CSV 값이 skipEmptyLines로 사라지는 문제: 빈 셀 인용과 마지막 개행에서 생긴 가상 행만 제거하도록 수정.
- 배열 길이 요약을 트리 강조에 포함하면 미변경 형제도 강조되던 문제: 상세 변경 경로만 필터 기준으로 사용.
- Ajv strictRequired는 표준상 유효한 required-only 속성을 거부하므로 해당 옵션만 false. 다른 strict 검증은 유지.
- 테스트 alert 선택자는 Monaco 접근성 alert와 구분되도록 보정. 테스트의 TypeScript 객체 추론 문제 및 escape lint 오류도 해결.

### 검증

- npm test: 74/74 통과 (기존 20 + JSON 54).
- npm run typecheck / npm run lint: 통과.
- npm run build: 통과. JSON 지연 chunk 약 198.7 KB / gzip 64.7 KB. 기존 Monaco 큰 chunk 경고 유지 (main 약 3.526 MB / gzip 919.5 KB, TS Worker 약 6 MB).
- 전체 Edge Playwright 9/9 통과 (기존 5 + 신규 4), 테스트 포트 5193.
- 가상 트리 15,002노드 중 24행 DOM, 검색/경로 클릭 선택, 구조 변경/변경 필터, 직접 타이핑 오류·undo, workspace 보존, 정밀도 차단과 원문 실제 다운로드, Schema valid/invalid, 타입 생성·예약어 오류·실제 ts 다운로드, CSV Flatten·추론·수식 방어·실제 CSV 다운로드·파일 업로드, 100건 결과 페이지, 390px 화면을 검증.
- 단위: 원시 JSON/EOF 오류·프로토타입 키·배열/타입/null/부재·원문 불변·안전경로·Schema·생성 타입의 TS semantic 검사·CSV 따옴표/개행/빈값/중복 Header/큰 수 등.
- 외부 요청 감시 0건, pageerror 없음. Monaco JSON 외부 Schema 요청을 false로 명시.
- npm audit --omit=dev: 런타임 취약점 0건. 설치 시 전체 audit는 기존 개발 의존성 moderate 10건, critical/high 0건.
- phase3-json-diff.png, phase3-json-mobile.png 시각 검토. 기존 Phase 1·2 스크린샷은 회귀 실행으로 재생성됨.

### 제약 / 다음 단계

- JSONPath는 의도적으로 제한된 문법. 필터·스크립트·union 미지원, 재귀 한 번만 허용. Key 기반 배열 매칭은 후속 확장으로 미구현.
- Schema는 샘플 추론 Draft-07. format 검증과 외부 refs는 미지원. 타입명은 ASCII 식별자만 허용. 타입은 샘플 초안이다.
- JSON.parse 중복 Key는 마지막 값, 소수는 IEEE 754 정밀도. 안전 정수 범위 밖 정수는 차단한다. CSV 타입·중첩의 무손실 왕복은 보장하지 않는다.
- JSON 계산은 main-thread이며 Worker 성능·취소 검증은 Phase 8. 현재 입력 제한은 측정된 처리시간 보장이 아니다. 실기기·실제 GitHub Pages는 미검증.
- 이번 세션 커밋·푸시는 수행하지 않음. Phase 4 이후 기능은 미착수. 다음은 Phase 4 — Field Mapping.

## Phase 4 · 2026-11-06 · Field Mapping

### 시작 상태 대조

필수 5개 문서, PROJECT의 Mapping 요구사항, 기존 코드와 Git 상태를 확인했다. Phase 3 미커밋 변경사항이 있는 main 상태로 시작했으며 해당 변경을 보존했다. 기존 단위 74개·TypeScript·ESLint 통과 후 Phase 4만 구현했다.

### 완료 작업

- Field Mapping 지연 로딩 작업 공간과 별도 Zustand 스토어. Source 편집/업로드·가상 트리, 중앙 규칙 카드, Target JSON·트리의 3열 레이아웃과 반응형 지원.
- Source 경로 선택·활성 규칙에 적용/추가, Target 경로·필드명·중첩 구조, copy/string/number/boolean/date/constant, 누락 기본값·누락 제외·규칙 적용 해제·추가/삭제.
- 배열 전체 copy·명시적 index·Source/Target 각 1개의 [*] 매핑. index 유지·빈 배열 지원, 희소 배열 거부. 날짜는 명시적 UTC 정책으로 결정적 출력.
- 경로 문법/위험 segment 검증, own-property 탐색, 중복/부모-자식/wildcard-index 겹침과 객체/배열 형식 충돌 사전 검사. 기본값은 누락에만 적용하며 null과 falsey 값 구분.
- 오류 발생 시 전체 결과 취소·규칙별 메시지. 최신 Source 문자열과 규칙 배열을 계산 snapshot에 결합하여 입력이 바뀐 render부터 이전 결과 무효화.
- 결과 복사·실제 UTF-8 다운로드, Source 원문 저장, 규칙 버전 1 문서 및 배열 import, 규칙 export/copy. 실패한 import는 기존 규칙을 보존. 수동 JSON 텍스트와 파일 모두 지원.
- Source/규칙 업로드 요청 세대 별도 관리, 예제 입력 시 대기 업로드 무효화. 메모리 세션 상태 유지, storage/서버 전송/입력 코드 실행 없음.
- 신규 의존성 없음. 기존 JsonTree·파일 loader·UTF-8 다운로드를 재사용하고 Text Diff/Structural Diff 모듈은 변경하지 않음.

### 발견·해결 문제

- 실행 예산 재귀 인자를 추가하는 초기 구현의 인자 누락을 단위/타입 검사에서 발견하고 수정. 전체 예산 공유·초과 차단 검증.
- CSV/JSON 코어와 동일하게 큰 수·non-finite·출력 값 수/깊이/크기 제한 적용. 출력 배열 hole을 JSON.stringify가 null로 바꾸기 전에 거부.
- 동일 배열 형제 필드 매핑 시 배열 prefix는 재사용하지만, 단일 Target 중복 쓰기는 금지. missing collection과 empty collection 구분.
- 규칙을 내보낸 뒤 같은 예산으로 다시 가져올 수 없던 큰 합성 문서 문제를 예방하기 위해 export에도 import 예산 검증 적용.
- 전체 오류 수가 충돌 쌍에 따라 폭증하지 않도록 규칙별 첫 Target 충돌만 보고.
- Source/Target에 같은 값이 선택된 경우 E2E locator 중복을 발견하여 Target 영역으로 scope 보정. 최종 테스트 모두 통과.

### 최종 검증

- npm test: **161/161 통과** (기존 74 + Mapping 87).
- npm run typecheck / npm run lint / npm run build: 통과.
- 전체 Edge E2E **12/12 통과** (기존 9 + Mapping 3), 테스트 포트 5194.
- 단위: 입력 deep-freeze 불변·복사 참조 분리, root 원시/배열, 누락/null/기본값/constant, 엄격 변환과 UTC 날짜·윤년, wildcard·index·empty/hole, 경로 alias·위험 키·충돌, import/export·버전·ID·미지 속성·과대 입력/출력·복제 예산·cyclic 입력, 결정성 검증.
- E2E: Source 트리 선택/규칙 적용·수정/제외·삭제·상태 유지, Target 트리 선택/복사/실제 다운로드, 기본값·상수·boolean/number/date·wildcard 결과, 충돌 시 preview 제거/저장 차단, 원문 Source 다운로드 불변, 악성 import 거부/기존 규칙 유지, 파일 export/import 왕복·빈 배열/null/root·규칙 없음, 390px overflow 없음.
- Mapping 시나리오에서 pageerror/외부 요청 0건. 기존 Text Diff/JSON Tools 회귀 전부 통과.
- Mapping lazy chunk 약 21.5 KB / gzip 7.6 KB, 기존 Monaco main 약 3.527 MB / gzip 919.7 KB·TS Worker 약 6 MB. 큰 chunk 경고 유지.
- docs/phase4-mapping-desktop.png·phase4-mapping-mobile.png 생성 및 시각 검토. 기존 화면은 회귀 테스트에서 재생성됨.

### 알려진 제약 / 다음 작업

- 한 규칙당 wildcard 한 번, Source와 Target의 개수 일치 필요. 다중 wildcard·재귀·필터·동적 표현식 미지원. 중첩 배열은 명시적 index 또는 전체 copy 사용.
- Target root와 다른 활성 경로의 혼합 불가. 위험 segment는 Source에서도 거부하며 복사 payload 내부 같은 키는 안전한 데이터로 유지. 적용 해제 규칙도 경로·리터럴 형식 검증을 수행.
- number 소수는 IEEE 754, boolean은 명시된 값만, date는 날짜 또는 UTC Z 시각만 지원. 시간대 offset/locale 추정 없음.
- 현재 규칙 100개·경로 500자/80 depth·index<30k, source/target/규칙 문서 1 MiB·30k 값, 탐색 200k 보호 한도. Worker·대용량 성능 측정은 Phase 8이며 현재 한도가 지연시간 보장은 아님.
- 패키지 변경 없는 Phase이므로 보안 조회는 재실행하지 않음. Phase 3의 runtime 0건/dev moderate 10건 기록 유지.
- Phase 3·4 변경은 로컬 작업 트리에 남아 있으며 커밋·푸시는 수행하지 않았다. Phase 5 이후 미착수. 다음은 Phase 5 — Patch Export.

## Phase 5 · 2026-11-06 · Patch Export

### 시작 상태 대조

AGENTS/PROJECT/PROGRESS/DECISIONS/README, 실제 소스 및 jsdiff의 create/apply/parse 구현과 타입을 확인했다. main은 origin/main과 동기화된 clean 상태였으며 Phase 3·4는 2382739까지 커밋·푸시된 상태였다. 기존 161개 테스트·TypeScript·ESLint가 통과했다.

### 완료 작업

- 독립 core/patch/patch.ts: 원문 기반 Unified Patch, file path/context/modify-create-delete 옵션, 생성 즉시 적용·수정본 정확 일치 검증.
- jsdiff createTwoFilesPatch를 원문·ignoreWhitespace:false·stripTrailingCr:false로 호출. 출력 문자열을 다시 parse/apply하고 autoConvertLineEndings:false/fuzzFactor:0으로 검사. EOF 마커·원문 CRLF/LF/혼합 개행 보존.
- 단일 대상 상대 경로 a/b 헤더, 공백·한글 경로 quoting, 위험 경로/제어문자/비정상 Unicode·NUL·범위 제한 검사.
- 파일 생성·삭제는 사용자가 명시하며 /dev/null 헤더. 빈 텍스트로 파일 존재/rename을 추정하지 않음.
- Patch Export 지연 로딩 화면, 현재 Code Compare 입력 요약과 왕복 이동, 문맥·작업·경로 설정, 검증 상태·추가/삭제/hunk 통계·미리보기·CR 표시·복사·.diff/.patch 저장·재검증.
- 원문·설정 snapshot으로 이전 Patch를 render부터 무효화. 생성 중 상태 및 예약 계산 취소 세대 확인. 선택 표시/분석 옵션은 Patch 계산에 영향 없음.
- UTF-8 저장 및 명시적 clipboard, 사용자 파일에 적용/서버 전송/영구 저장 없음. 신규 의존성 없음.

### 발견·해결/설계 문제

- jsdiff apply의 기본 자동 EOL 변환은 CRLF↔LF 변경을 손실할 수 있어 명시적으로 false. 실제 원문 적용 결과로 검증.
- jsdiff formatPatch가 zero-line hunk 시작값을 변경하는 구현을 확인하여 생성 함수의 단일 출력만 사용하고 반복 생성 결정성 테스트.
- 빈 텍스트는 파일 부재와 다르므로 기본 modify. create/delete만 /dev/null 사용. 내용 없는 파일 생성·삭제는 오류로 명시.
- clipboard의 OS 개행 변환은 안내하고 실제 다운로드 바이트를 비교하여 정확성 확인.
- Git 문맥 0은 --unidiff-zero 필요. UI와 README에 표시하고 실제 Git 테스트에서 적용.
- 임시 Git 테스트 cleanup guard를 finally 밖에서 검증하여 안전 경로 검사와 ESLint no-unsafe-finally를 모두 충족.

### 최종 검증

- npm test: **229/229 통과** (기존 161 + Patch 68). Patch 신규는 코어 53 + 실제 Git 15.
- npm run typecheck / npm run lint / npm run build: 통과.
- 전체 Edge E2E **15/15 통과** (기존 12 + Patch 3), 테스트 포트 5195.
- 코어: 추가/삭제/수정·여러 hunk·반복행·0/다수 문맥·빈 파일·EOF·CRLF/LF/혼합/단독CR·Unicode/BOM·순수 공백·잘못된 patch/원본/예상결과·위험 경로/크기/NUL/surrogate·생성/삭제 조건·결정성.
- 실제 Git 2.54.0.windows.1: 독립 임시 경로에서 git apply --check 및 실제 적용 결과 UTF-8 bytes 일치 15개 통과. modify 빈 파일, create/delete, zero context, 한글·공백 경로, EOF/EOL 변경 포함. 실제 프로젝트 파일에 적용하지 않음.
- E2E: 화면 옵션에서 동일해도 원문 변경 Patch 생성, CR 표시·문맥 0, .diff/.patch 실제 내용·적용 결과, clipboard·재검증, 편집 후 stale preview/다운로드 제거, 경로 오류, 동일 파일·작업 조건·Unicode 경로·삭제 EOF·390px layout. 외부 요청/pageerror 0건.
- Patch lazy chunk 약 18.1 KB / gzip 7.2 KB, 기존 Monaco main 약 3.527 MB / gzip 919.8 KB·TS Worker 약 6 MB. 큰 chunk 경고 유지.
- docs/phase5-patch-desktop.png 및 phase5-patch-mobile.png 생성·시각 검토. 이전 Phase 스크린샷은 회귀 테스트에서 갱신됨.

### 제약 / 다음 작업

- 단일 파일 text Patch. 내용 없는 파일 생성/삭제, rename·권한·binary·multi-file은 미지원. 전체 파일 바이트가 아닌 디코딩된 텍스트를 UTF-8로 저장하므로 UTF-16 원본 파일에 직접 적용하는 것을 보장하지 않음.
- 메타데이터 LF, CR/LF 데이터 보존. Patch 줄 번호는 LF 기준이며 단독 CR은 데이터. clipboard 개행 보존은 OS 의존. 경로는 portable한 240자 상대 경로 subset.
- 입력당 5 MiB/출력12 MiB/Diff 1.5초 timeout은 보호 한도. main-thread 전처리·적용 검증 전체 성능/취소·Worker는 Phase 8. 다른 CLI patch 도구·실제 GitHub Pages·모바일 실기기 미검증.
- Phase 5 신규 의존성/보안 조회 없음. 기존 Phase 3 audit 기록(runtime 0, dev moderate 10) 유지.
- Phase 5 변경은 로컬 작업 트리에 반영했고 커밋/푸시는 미수행. Phase 6 이후 미착수. 다음은 Phase 6 — Folder Compare.

## Phase 6 · 2026-11-06 · Folder Compare

### 시작 상태 대조

필수 문서와 PROJECT의 폴더 비교 범위를 확인했다. main/origin은 2382739이며 Phase 5 미커밋 변경사항을 보존했다. 기존 229개 테스트·타입·ESLint 통과 후 Phase 6만 구현했다.

### 완료 기능

- core/folder/engine: 최상위 루트 제외 상대 경로 매칭, 존재 기준 ADDED/REMOVED/MODIFIED/UNCHANGED 및 ERROR_FILE. Rename 추정 없음.
- native webkitdirectory 선택기·File.webkitRelativePath 검증, 명시적 빈 폴더, 별도 Zustand 입력/옵션과 lazy workspace. File 내용을 외부로 전송하지 않고 file refs/decoded text는 세션 메모리에만 유지.
- node_modules/.git/dist/build/target/bin/obj 읽기 전 제외·편집/복원, root subtree 제외, extension filter, 경로 case·공백·인코딩 옵션. ambiguous case/duplicate 경로는 실패.
- 텍스트는 기존 compareText 통계 사용, byte-identical 파일은 diff 생략, binary는 실제 bytes 비교. BOM/인코딩/EOL/EOF 보존. 디코딩/IO/과대 파일/Diff 계산 오류는 오류 상태와 통계 불가로 표시.
- 전체 파일/디렉터리/상태/줄/오류/제외 통계, 28행 가상 폴더 트리·폴더 펼침/접기·검색·동일 숨김·kind filter. 파일→디렉터리 전환을 서로 다른 dir/file 행으로 표시.
- 파일 선택 시 readonly Monaco 좌우/Unified와 메타데이터·오류/바이너리 안내. 명시적 Code Compare 복사로 현재 입력 교체, 새 모델로 EOL 감지. 원본 폴더와 snapshot은 편집하지 않음.
- 전체/표시 subset JSON export: 내용 제외, paths/status/encoding/size/lines/options 및 전체 statsScope/실제 exportedRows. 명시적 다운로드만 사용.
- 진행률·cooperative abort·요청 버전·snapshot identity 확인. 입력/옵션 변경 시 오래된 결과와 메모리 해제. 기본 읽기 예산과 개별파일 오류로 과대 입력 제어.

### 발견·해결 문제

- Monaco React DiffEditor가 모델을 연결된 상태에서 먼저 dispose하여 text↔binary 전환 및 Code Compare remount에서 브라우저 오류를 내는 것을 E2E에서 발견. ManagedDiffEditor layout cleanup으로 모델을 먼저 분리·해제한 뒤 wrapper passive cleanup이 수행되도록 수정. 최종 pageerror 0건.
- Source/Modified readonly preview와 기존 Code Compare 모델을 분리하고 명시적 가져오기 때만 기존 Code Compare를 재생성하여 CRLF 편집을 보존. unmount 시 대기 upload 세대도 무효화.
- 쉼표 입력을 즉시 split/join하면 다음 항목을 입력할 수 없던 제외/확장자 입력을 별도 raw draft 문자열로 보정.
- file path가 다른 쪽의 directory prefix가 되는 경우 트리 Map 노드가 파일을 가릴 수 있어 dir/file 두 행과 distinct key로 보존.
- read 오류와 계산 오류가 필터에서 빠지지 않게 ERROR_FILE/kind error로 일치. byte-identical 파일의 추가 Diff 계산을 생략하고 강제 계산 실패 mock 테스트 추가.
- E2E의 미지원 assertion(toContainValue)을 toHaveValue(regex)로 수정. 코드 오류·타입·테스트 실패를 해결한 뒤 최종 통과 확인.

### 최종 검증

- npm test **271/271 통과** (기존229 + Folder42). 타입·ESLint·Production Build 통과.
- 전체 Edge E2E **18/18 통과** (기존15 + Folder3), 포트5196.
- core: 상대경로·native root·unsafe path, 필터/제외 읽기 전 차단, count/size/encoding preflight, case collisions, 모든 status·rename 정책·빈/부재·EOF/Unicode/repeat/EOL·BOM/encoding·공백, binary/mixed·invalid encoding/IO/over-limit, cancel/progress·300파일, source 없는 report·prototype-safe tree·file→folder·Diff failure.
- E2E: 실제 임시 디렉터리 native 선택·정확한 추가3/삭제3/수정3/동일1/오류1, binary/오류 표시, readonly Diff, 전체/subset 실제 JSON파일 내용 없음, Code Compare handoff 후 CRLF 편집과 실제 원본 파일 불변, editable excludes/extension comma·whitespace·empty·case, cancel/restart·350파일/최대28 DOM, 실제 파일 Diff의 390px overflow 없음.
- native Folder 시나리오 외부 요청/pageerror 0건. 기존 Text/JSON/Mapping/Patch 전부 회귀 통과.
- Folder lazy chunk 약20.4KB/gzip7.7KB. 기존 main Monaco 약3.528MB/gzip920KB·TS Worker약6MB, chunk 경고 유지.
- docs/phase6-folder-desktop.png 및 phase6-folder-mobile.png 생성·시각 검토. 이전 스크린샷은 회귀 실행으로 갱신됨.

### 제약 / 다음 작업

- 네이티브 FileList에는 빈 디렉터리·권한·타임스탬프·symlink 종류가 없으므로 해당 메타 비교 미지원. 폴더 drop/감시/rename detection 없음. 빈 선택은 explicit 버튼으로 지원. 최신 directory API 브라우저 필요.
- Unicode normalize/locale casefold 없음. 경로 ignore-case는 toLowerCase. 제외는 name/subtree(디렉터리만), glob 미지원. 원문encoding/BOM은 공백 옵션으로 무시하지 않음. encoding 선택은 양쪽에 공통 적용.
- binary 분류는 signature/NUL/control heuristic, 미판별 invalid decode는 error. binary/mixed/error에는 줄 통계 없음. Monaco 강조와 all-whitespace 분석은 별도 정책.
- 폴더당 raw metadata20k/eligible1000/readable20MiB/per-file5MiB. 개별 oversized는 read 없이 오류 행. 전체15초 예산·취소는 file/await 경계, File.arrayBuffer와 동기Diff 즉시 강제 중단은 아님. Phase 8 Worker 성능 보장 미검증.
- 보안 조회/새 패키지 없음. 기존 Phase 3 audit(runtime0/dev moderate10) 기록 유지. GitHub Pages·모바일 실기기·다른 browser/OS는 미검증.
- Phase 5·6 변경은 로컬이며 커밋/푸시하지 않았다. 다음은 Phase 7 — Syntax Compare.


## Phase 7 — 2026-11-09 · 구현 / 최종 검증 보류

### 시작 상태 대조

- main/origin main 동기화, 변경 없음. 최신 커밋 d815a62에 Phase5·6 반영됨. 과거 문서의 미커밋 표기는 당시 기록이다.
- 기존 소스의 Folder/JSON/Mapping/Patch/Text 기능과 Phase6 문서 대조. 시작 시 기존 테스트271/271 통과.

### 구현

- 별도 core/syntax: 5개 언어 adapter, 로컬 runtime/grammar WASM 로더, AST 추출 및 독립 매칭 엔진.
- Java/C#/Python/JS/TS 실제 grammar 호환 확인(ABI14, C#13). 클래스/메서드/함수/import 추가삭제, 선언/매개변수/본문 변경, 유일 동일 본문 기반 함수명 변경 후보.
- Syntax Compare lazy workspace: Code Compare 현재 원문 사용, 자동/수동 언어, 실행/오류/입력 변경 표시, 100개씩 변경 목록, 클릭→양쪽 readonly Monaco 줄 이동, 미지원/parse error Text Diff 안내. 다른 엔진/업로드 원본 수정 없음.
- 입력1MiB/AST100k노드·깊이128/요소5k 제한, parser progress cancel, tree/parser finally 해제. ADR017 및 README 지원 범위 기록.

### 실제 검증 결과

- npm test: 286/286 통과(기존271 + 신규15). 실제5개 WASM으로 매개변수/본문/import/클래스/rename 후보/중복·오버로드/주석·문자열/한글·CRLF/파싱오류/용량·깊이 테스트.
- npm run typecheck: 통과. npm run lint: 통과.
- npm run build: 실행했으나 Vite 설정의 기존 Tailwind 로딩 단계에서 응답 정지, 중단. 성공으로 처리하지 않음.
- npm run test:e2e: 실행했으나 webServer 시작60초 시간초과. 신규6개 browser test 작성, 실행 검증 미완료. 기존18개 browser test 회귀도 이번 세션 미완료.
- 원인 분리: 직접 require('@tailwindcss/oxide-win32-x64-msvc') 시 `ERR_DLOPEN_FAILED: An Application Control policy has blocked this file.` 재현. 기존 @tailwindcss/oxide의 설치된 WASM fallback 직접 로드도 응답 정지. sandbox 밖에서도 재현. 정책 변경/스타일 파이프라인 제거는 하지 않음.
- 새 패키지 설치 audit 결과 moderate10건(기존 dev 경고), 설치 시 critical/high 없음. 추가 audit 검증은 하지 않음.

### 미완료 / 다음 작업

1. 기존 Tailwind native/WASM 로딩 가능한 개발 환경 복원 후 npm run build 및 전체 npm run test:e2e 재실행.
2. 신규 browser case: 실제5개 grammar 로드, source snapshot 변경, parse error fallback, unsupported/mobile, 외부 요청0 및 Text Diff 줄 이동을 확인한다. 현재 이 항목들은 작성된 테스트이며 검증 완료가 아니다.
3. production 산출물에서 WASM 자산 경로·로딩 및 실제 UI를 확인하고 Phase7 완료 여부 결정.
4. 이후 Phase8 — Worker/성능·UI/UX. 이번에는 Phase8에 착수하지 않음. 커밋·푸시 미수행.

### 구문 분석 한계

- 익명·화살표 함수 변수/TSX/최신 grammar 문법 전체 미지원. 주석·공백 변경은 AST 목록 제외, 원문 diff에서 확인.
- rename은 후보이며 이동·의미 동등성 판정 없음. 클래스와 내부 메서드 변경은 중복 집계될 수 있는 별도 요소.
- 메인 스레드 추출·매칭의 hard latency 보장 없음. production/browser 검증 전 기능 완료를 선언하지 않음.

## Phase 7 최종 검증 — 2026-11-09 · 완료

### 이전 상태와 대조

- 시작 시 main은 ba35486(Phase7 구현/검증 보류)까지 로컬 커밋되어 origin/main보다1개 앞섰고 작업 트리는 깨끗했다. 문서의 보류 상태와 실제 Tailwind4.3.4 로딩 정지를 재확인했다.
- 공식 Tailwind4.3.5의 WASM 로딩 정지 수정(#20667)을 확인하여 vite plugin/Tailwind와 lock만 호환 patch 범위로 갱신했다. Windows 보안 정책을 변경하지 않고 공식 fallback으로 Vite·Build 동작을 복원했다.

### 보완 구현

- Import 매칭은 raw 표시 문자열 대신 token fingerprint로 공백·주석만의 변경을 제외한다. Java package 및 C#/TS namespace scope를 구분한다.
- CR-only 입력의 구형 grammar line-comment 오해석을 같은 UTF16 길이의 분석 복사본에서 해결하고, 원문 offset 기준 CRLF/LF/CR 물리 줄 탐색을 적용했다. 원본 store·파일·다운로드는 그대로 보존한다.
- 5,000개 요소 상한을 정확히 적용하고 CR-only/Unicode, import 공백, namespace 동명이인, package, 정확한 상한 테스트5개 추가.
- Production 전용 Playwright preview 모드 추가. 실제 배포 산출물을 검증하면서 기존 dev 모드와 분리한다.
- Production 회귀에서 기존 Monaco의 문서 축소 시 이전 diff/gutter 줄 범위 경합을 발견해 수정. ManagedDiffEditor가 공개 API로 생성·원문 갱신·해제를 직접 소유하고 이전 diff view-model 취소 다음 task에서 snapshot을 적용한다. CodeCompare upload/sample의 중복 setValue는 제거했다. 직접 편집 echo는 건드리지 않는다.
- 개발 StrictMode의 시험 mount는 취소 가능한 microtask로 실제 editor 생성 전에 무효화하여 Worker Canceled 경합을 해결했다. 구문 로드 실패 주입 테스트는 Vite ?url 모듈을 차단하지 않고 실제 fetch만 차단하도록 수정했다.

### 최종 검증

- npm test: **291/291 통과** (기존271 + 실제5개 WASM Syntax20).
- npm run typecheck / npm run lint: 통과.
- npm run build: 통과. 5개 grammar 및 runtime WASM 로컬 산출물 확인.
- Production Edge 전체 E2E: **26/26 통과**. 실제5개 WASM HTTP200/304, 오류/미지원 fallback, 입력 변경 시 결과 무효화, readonly preview에서 입력해도 raw CRLF 다운로드 불변, grammar fetch 실패 후 재시도, syntax pageerror0, 외부 요청0(Java 시나리오), 기존 Text/JSON/Mapping/Patch/Folder18개 회귀.
- 개발 Edge: 기존18개와 Syntax7개 통과 후 장애 주입 fixture의 ?url 모듈 차단 문제를 수정했고, Syntax8/8 전체 재검증 통과. production/dev의 StrictMode 차이를 포함해 검증했다.
- docs/phase7-syntax-desktop.png 생성·시각 검토. 회귀 테스트가 재생성한 이전 Phase 이미지는 작업 범위에 포함하지 않는다.
- ADR018, README, ARCHITECTURE, TEST-CASES 갱신. Phase7을 완료로 변경한다. 이번 변경은 아직 커밋·푸시하지 않았다.

### 남은 한계와 다음 Phase

- 빌드의 기존 Monaco 대형 chunk 및 Tree-sitter glue eval/Node externalization, 공식 fallback WASI 실험 경고가 남는다. 사용자 원문을 eval하거나 서버로 전송하는 기능은 없다. 설치 audit의 기존 dev moderate10건 유지, 이번에 추가 audit 조회는 하지 않았다.
- main-thread Syntax 처리·정적 보호 예산이며 hard latency/Worker 취소·성능 보장은 Phase8에서 다룬다. 익명/화살표 함수 변수, TSX, 최신 문법/의미론 전체 지원 아님. 선언 노드 밖 decorator 등은 AST 결과에 포함되지 않을 수 있으므로 원문 Diff를 함께 확인한다.
- 실제 GitHub Pages, 다른 OS/브라우저, 모바일 실기기는 미검증. 환경별 Monaco 수명 검증은 버전 변경 시 다시 수행한다.
- **다음: Phase8 — 성능 및 UI/UX**. 필수 문서·Git 상태 확인 후 Worker 기반 비교/취소·성능 측정, 자원 관리, Dark/Light, 조절 가능한 레이아웃·접근성을 구현한다. 이번에는 Phase8 기능을 추가하지 않는다.


## Phase 8 — 2026-11-09 · 성능 및 UI/UX 완료

### 시작 상태와 문서 대조

- AGENTS/PROJECT/PROGRESS/DECISIONS/README, 실제 소스와 Git 확인. main의 최신 커밋5876a9f, origin/main보다2개 앞섬, 변경 없음. Phase7 구현·완료 문서와 소스 일치, 시작 테스트291/291 통과.
- README 상단의 Syntax 미제공/Light·Worker 후속 안내는 실제 Phase7 상태와 달라 실제 기능에 맞게 갱신했다. 과거 Phase 절의 당시 테스트/미커밋 문장은 이력으로 보존한다.

### 구현 / 변경 파일

- `workers/{protocol,execute,compute.worker,client}` 및 `hooks/useCompute`: Text/inline/Syntax/JSON 파싱·구조·변환/Mapping 컴파일·적용·규칙 직렬화/Patch 생성·재검증 Worker 실행. 요청id·snapshot·AbortSignal, 새 요청의 강제 종료, 오류/10초 timeout·재시도, idle30초 해제, hidden/unmount 취소. 실패를 main-thread로 fallback하거나 동일로 간주하지 않음.
- `core/folder/engine`에 async comparator 주입. File IO/경로/byte/encoding 책임은 기존 Folder 엔진에 유지. 읽기 자체는 중단하지 못하므로 경계 검사와 전체15초 예산 유지.
- `core/diff`는 split·정규화 key 재사용, `core/file`는 배열 없는 binary/줄 수 scan, CodeCompare는 줄 수 메모이제이션. 원문/EOL/공백 규칙과 다운로드 불변. `core/syntax/languages` 분리로 parser/WASM은 Worker에서만 로딩.
- `stores/preferences`, `DisplaySettings`, `useNarrowScreen`, App/CSS/각 workspace: Dark/Light 일치, MiniMap, 분석 폭/데이터 비율/편집기 높이 조절·초기화, 세션 전용 설정, 본문 이동·native keyboard controls·focus/aria·핵심 텍스트 대비, 작은 화면1열/Unified 및 MiniMap 숨김.
- `ManagedDiffEditor` 공개 view model 소유·동기 dispose, 텍스트 모델 재사용·StrictMode 취소·unmount 정리. MiniMap은 inner editor 공개 옵션으로 적용. 모델·계산 Worker 개수 HUD, 탭/테마 전환 후 모델 수 유지 검증.
- 변경 목록100개 page·선택 따라가기, snippet200자·상세 양쪽20k자 cap. 원문 저장은 무제한이 아니라 기존5MiB 입력 한도 내 전체 문자열을 보존한다.

### 발견·해결한 문제

- 공용 ResultList CSS 이름이 hidden Code 목록과 JSON 목록 선택자를 충돌시켜 className을 분리했다.
- 부하 시 과거 Monaco diff view model이 새 줄 수를 참조하는 경합을 공개 createViewModel/dispose 소유권으로 해결했다. 이전 비동기 detach만 의존하지 않는다.
- Monaco Diff가 MiniMap을 내부에서 강제 비활성화해 공개 inner editor 옵션을 적용했다. 화면이 좁을 때는 설정을 보존하고 실제 MiniMap을 숨긴다.
- async Minify 완료 전 저장하면 이전 편집본이 저장되는 경합: 변환 중 copy/save 비활성화 및 입력/옵션 변경 시 결과 폐기. 새 입력 업로드 시 오래된 변환이 덮어쓰지 않는 E2E 추가.
- JSON 계산 중/실패 때 변경0을 동일로 안내하던 조건은 정상 parse·계산 완료 시에만 동일 안내하도록 수정했다. 취소/오류를 정상 결과로 완료하지 않는다.
- 이미 abort된 새 요청이 idle 해제 timer를 지우는 수명 문제를 수정하고30초 후 Worker 종료를 단위 테스트했다.
- 대용량 취소 테스트가 이미 교체된 Worker의 close를 기다리던 fixture를 현재 Worker 관측으로 수정했다. JSON 신규 입력 fixture의 bulk keyboard 입력이 잘못된 JSON을 남기던 문제는 명시적 새 입력 업로드로 보완했다.

### 검증

- npm test **311/311 통과** (기존291 + Worker/엔진·파일 scan18 + Folder async 경계2).
- npm run typecheck / npm run lint / npm run build 통과.
- Production Edge E2E **31/31 통과** (기존26 + Phase8 5). 실제 Worker 오류/재시도/종료·raw CRLF 다운로드·새 JSON 입력 보존, Dark/Light/MiniMap/패널·핵심 안내 대비4.5:1·키보드·모바일 overflow·모델 개수 유지 및 기존 모든 기능 회귀.
- 개발 모드 기존26개와 Phase8 기존4개 통과. 신규 입력 fixture 보완 후 Phase8 전체5/5 재검증 통과. 전체 WCAG 적합성이나 모든 보조기기 동작을 검증한 것은 아니다.
- npm run test:perf production 단일 Edge **1/1 통과**,12시나리오. 100/1k/10k/50k줄,500k/5MiB 단일 행,반복/다중 변경,취소,20k JSON/구조 diff,500파일. 정확한 최종 수치는 PERFORMANCE.md 및 phase8-performance.json 참조. 외부 요청0/pageerror0, 모델6개, 목록100/JSON24/폴더28 DOM 확인.
- phase8-light-desktop.png / phase8-dark-mobile.png 생성·시각 검토. 이전 Phase 이미지는 회귀 자동 생성본을 제외하고 원래 커밋 버전을 유지한다. 작은 화면 설정 메뉴의 화면 밖 배치를 보완한 뒤 Phase8 production 전체5/5 추가 검증. 새 외부 의존성·서버·CI·배포 없음.

### 남은 한계 / 다음 작업

- 5MiB 원문 구성 단계에는 약270ms 메인 이벤트 루프 지연 관측. File IO·structured clone·Monaco 모델·JSON 트리 투영·렌더까지 모두 main-thread 비용0이 되는 것은 아니다. main heap 관측은 Worker/native/GPU 및 순간 peak를 제외하고 한 환경의 시나리오별1회 표본이다. 입력 크기 보호 한도를 모든 입력·기기 SLA로 해석하지 않는다.
- Monaco 본체 약3.53MB/TS Worker 약6MB의 기존 chunk 경고, Tree-sitter glue eval/Node externalization, Tailwind WASI 경고 유지. 기존 dev audit moderate10 이력 유지, 신규 dependency/audit 조회 없음.
- 다른 OS/브라우저·모바일 실기기·실제 배포는 미검증. 긴 단일 행에는 Monaco 자체 시각 한도와 상세 cap이 있으며 원문 다운로드는 보존한다. AST 지원 범위/rename 후보 한계는 Phase7과 동일하다.
- 다음은 Phase9 통합 테스트·Actions/Pages 배포. 이번 변경은 미커밋·미푸시이며 현재 Phase를 검증하고 종료한다.

## 2026-11-09 · GitHub Pages 빈 화면 복구

- 원인: Pages가 legacy 모드로 main 루트를 게시하여 소스 index.html의 /src/main.tsx 요청이404가 됐다. favicon.ico404는 별개의 아이콘 누락이다.
- 수정: GitHub Actions에서 npm ci → 단위 테스트/TypeScript/ESLint → Vite build → 하위 경로 브라우저 검증 → dist artifact 업로드 → Pages 배포. 소스 HTML은 개발용으로 유지한다.
- VITE_BASE_PATH로 Pages 프로젝트 경로를 주입하며 기본 상대 경로 빌드도 보존한다. 로컬 favicon.svg와 배포 전용 Playwright config/test 추가. 비교 엔진과 파일 처리 정책은 변경하지 않았다.
- 검증: npm test311/311, typecheck/lint/build 통과. /CodeDiff-Studio/ production Edge 배포 테스트1/1 통과: Monaco, 실제 계산 Worker, Syntax runtime/Java WASM, favicon200, pageerror/실패/외부 요청0. 첫 sandbox 미리보기 연결 지연 및 포트 충돌 후 별도 포트의 실제 Edge에서 재검증했다.
- 기존 Monaco chunk 크기, Tree-sitter eval/Node externalization, Tailwind WASI 경고 유지. 전체31개 회귀·성능 측정은 이번 배포 설정 수정에서 재실행하지 않았으며 기존 Phase8 결과와 구분한다.
- 실제 Pages 전환·배포 결과는 아래 후속 기록에 남긴다. Phase9의 전체 통합 검토·포트폴리오 설명 등은 후속 작업이다.
