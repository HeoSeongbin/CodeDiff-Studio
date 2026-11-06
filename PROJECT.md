# CodeDiff Studio — 범용 코드·파일·데이터 비교 플랫폼 개발 지시서

## 1. 프로젝트 개요

### 프로젝트명

**CodeDiff Studio**

부제: Code, File & Structured Data Comparison Workspace

### 프로젝트 목적

React + TypeScript 기반의 웹 애플리케이션으로, 개발자가 다양한 소스 코드 파일과 구조화 데이터를 비교하고 변경된 내용을 시각적으로 분석할 수 있는 통합 개발 도구를 만든다.

사용자는 두 개의 파일이나 폴더를 선택하고, 수정 전후의 소스 코드를 비교하여 어떤 코드가 추가, 삭제, 수정되었는지 정확한 줄 번호와 변경 위치를 확인할 수 있어야 한다.

또한 JSON 전용 분석 도구를 제공하여 구조 비교, 포맷팅, JSONPath 검색, Schema 분석, TypeScript 타입 생성, CSV 변환 및 필드 매핑을 수행할 수 있도록 한다.

이 프로젝트는 GitHub에 공개할 개인 포트폴리오 프로젝트이며, 실제 개발 업무에서도 사용 가능한 완성도를 목표로 한다.

### 최우선 목표

1. 범용 소스 코드 비교
2. 추가·삭제·수정 코드 구분
3. 줄/단어/문자 단위 변경 분석
4. Side-by-Side 및 Unified Diff
5. 변경사항 탐색 및 통계
6. 다양한 파일 형식 업로드
7. 두 프로젝트 폴더 비교
8. JSON 구조 비교 및 분석
9. JSON 관련 개발자 도구
10. Source/Target JSON 필드 매핑
11. Patch 생성 및 다운로드
12. 대용량 텍스트 처리
13. 백엔드 없는 정적 웹 애플리케이션
14. GitHub Pages 배포
15. 문서 기반 개발 관리 및 자동화 테스트

### 개발 방향

**처음부터 CodeDiff Studio를 신규 프로젝트로 개발한다.**

기존 JSON Visualizer & Diff 프로젝트를 전제로 설계하지 않는다.

기존 JSON 프로젝트의 파일 구조나 개발 이력을 가정하지 않는다.

JSON 분석 기능은 CodeDiff Studio 안에 포함되는 독립적인 기능이다.

사용자가 제공한 기존 저장소가 있다면 코드를 먼저 확인하되, 명시적 지시 없이 기존 파일을 삭제하거나 덮어쓰지 않는다.

---

## 2. 핵심 기술 스택

### Frontend

- React
- TypeScript (strict mode)
- Vite
- Tailwind CSS
- Lucide React
- Zustand
- Monaco Editor
- React Router
- 필요 시 가상 스크롤 라이브러리

### 코드 비교

- Monaco Diff Editor
- jsdiff
- 자체 Diff Result Normalizer
- 자체 변경 통계 및 탐색 모듈

### 구조화 데이터 처리

- jsondiffpatch
- JSONPath 라이브러리
- Ajv
- JSON Schema
- quicktype-core 또는 적절한 타입 생성 라이브러리
- Papa Parse

### 고급 확장

- web-tree-sitter
- 언어별 Tree-sitter WASM Grammar
- Web Workers

### 테스트 및 품질

- Vitest
- React Testing Library
- Playwright
- ESLint
- Prettier

### 배포

- GitHub Pages
- GitHub Actions

패키지 이름과 버전은 실제 호환성을 확인한 뒤 사용한다.

외부 라이브러리는 반드시 프로젝트에서 실제 사용하는 기능을 기준으로 선택한다.

불필요한 라이브러리를 초기 단계에 모두 설치하지 않는다.

---

## 3. 프로젝트 아키텍처 원칙

모든 파일을 하나의 비교 알고리즘으로 처리하지 않는다.

비교 방식을 다음 네 가지로 구분한다.

### 3.1 Text Diff Engine

일반 텍스트 및 프로그래밍 언어 소스 비교.

- Line Diff
- Word Diff
- Character Diff
- 변경 블록 생성
- 변경 통계
- Patch 생성

### 3.2 Structured Diff Engine

JSON과 같이 구조가 있는 데이터의 의미론적 비교.

- 필드 추가
- 필드 삭제
- 값 변경
- 타입 변경
- 배열 변경
- 중첩 객체 변경

### 3.3 Folder Diff Engine

두 폴더의 상대 경로 및 파일 내용을 비교.

- 파일 추가
- 파일 삭제
- 파일 수정
- 동일 파일
- 파일별 Diff
- 폴더별 통계

### 3.4 Syntax Diff Engine

언어별 구문 트리 분석을 통한 코드 구조 비교.

- 클래스
- 함수
- 메서드
- 매개변수
- Import
- 코드 블록

Syntax Diff는 고급 확장 기능으로 개발하며, 일반 Text Diff와 명확하게 구분한다.

초기 버전에서는 Text Diff 정확성을 최우선으로 한다.

---

## 4. 필수 프로젝트 관리 문서

프로젝트는 반드시 다음 다섯 개 문서를 중심으로 관리한다.

### 4.1 PROJECT.md

프로젝트의 최종 목표 및 요구사항을 관리한다.

포함할 내용:

- 프로젝트 소개
- 개발 목적
- 핵심 기능
- 지원 파일 형식
- 기술 스택
- 아키텍처
- 비교 엔진 설계
- 파일 처리 정책
- 데이터 모델
- UI/UX 요구사항
- 성능 요구사항
- 보안 정책
- 테스트 전략
- 개발 단계
- 최종 완료 조건

이 지시서에 작성된 전체 기능과 개발 단계를 PROJECT.md에 반영한다.

PROJECT.md는 프로젝트의 기준 문서이며 에이전트가 편의를 위해 필수 요구사항을 삭제해서는 안 된다.

### 4.2 AGENTS.md

에이전트가 반드시 지켜야 하는 개발 규칙을 작성한다.

필수 규칙:

1. 작업 전에 PROJECT.md 확인
2. docs/PROGRESS.md 확인
3. docs/DECISIONS.md 확인
4. 기존 코드 및 Git 상태 확인
5. 현재 Phase 확인
6. 기존 정상 기능 보존
7. 기능 구현 후 테스트
8. TypeScript 타입 검사
9. ESLint 및 Production Build
10. 문서 최신화
11. 중요한 설계 변경 기록
12. 검증하지 않은 기능 완료 처리 금지
13. 다음 세션에서 개발을 이어갈 수 있도록 상태 기록

AGENTS.md에는 모든 상세 요구사항을 중복하지 않고 PROJECT.md를 참조하도록 한다.

### 4.3 README.md

GitHub 방문자와 사용자를 위한 설명서다.

포함할 내용:

- 프로젝트 소개
- 실제 구현된 기능
- 주요 화면
- 기술 스택
- 지원 파일 목록
- 비교 방법
- JSON 도구 사용법
- 폴더 비교 사용법
- 설치 및 실행
- 테스트 실행
- GitHub Pages 배포 주소
- 프로젝트 아키텍처
- 기술적 해결 사례
- 알려진 제약

README는 구현 상태와 일치해야 한다.

### 4.4 docs/PROGRESS.md

개발 진행 현황을 관리한다.

항목:

- 현재 Phase
- 완료된 작업
- 진행 중인 작업
- 미완료 작업
- 발견한 오류
- 해결한 오류
- 테스트 결과
- 다음 작업
- 알려진 제약

작업 단위가 완료될 때마다 반드시 갱신한다.

### 4.5 docs/DECISIONS.md

기술 선택과 중요한 설계 결정을 기록한다.

ADR 형식으로 다음을 작성한다.

- 결정 ID
- 날짜
- 문제
- 검토한 대안
- 선택한 방식
- 선택 이유
- 장단점
- 영향받는 코드
- 호환성 및 테스트 영향

다음 항목은 반드시 기록한다.

- Monaco Diff Editor 선택
- Text Diff 알고리즘
- 변경된 줄의 수정 판정 정책
- JSON 구조 비교 방식
- 경로 표기 방식
- 배열 비교 정책
- 파일 인코딩 정책
- 파일 크기 제한
- Web Worker 적용
- 폴더 비교 구현
- Patch 생성 방식
- AST 파서 선택

---

## 5. 권장 파일 구조

```text
codediff-studio/
├── PROJECT.md
├── AGENTS.md
├── README.md
├── docs/
│   ├── PROGRESS.md
│   ├── DECISIONS.md
│   ├── ARCHITECTURE.md
│   └── TEST-CASES.md
├── src/
│   ├── app/
│   │   ├── App.tsx
│   │   └── routes/
│   ├── components/
│   │   ├── layout/
│   │   ├── toolbar/
│   │   ├── editor/
│   │   ├── diff/
│   │   ├── tree/
│   │   └── dialogs/
│   ├── features/
│   │   ├── code-compare/
│   │   ├── folder-compare/
│   │   ├── json-tools/
│   │   ├── field-mapping/
│   │   ├── patch-export/
│   │   └── syntax-compare/
│   ├── core/
│   │   ├── file/
│   │   ├── encoding/
│   │   ├── diff/
│   │   ├── json/
│   │   ├── mapping/
│   │   └── path/
│   ├── stores/
│   ├── hooks/
│   ├── workers/
│   ├── types/
│   ├── utils/
│   └── tests/
├── public/
├── .github/
│   └── workflows/
├── index.html
├── package.json
└── vite.config.ts
```

각 기능은 독립적으로 개발 및 테스트할 수 있도록 구성한다.

단순한 파일 구조 유지를 위해 불필요한 빈 파일이나 추상화 계층을 생성하지 않는다.

---

## 6. 지원 파일 형식

### 필수 지원

**Backend 언어**

- Java (.java)
- C# (.cs)
- Python (.py)
- Go (.go)
- Kotlin (.kt)
- Rust (.rs)
- C/C++ (.c, .cpp, .h, .hpp)

**Frontend 언어**

- HTML (.html, .htm)
- CSS (.css)
- SCSS (.scss)
- JavaScript (.js, .jsx)
- TypeScript (.ts, .tsx)
- Vue (.vue)

**SQL**

- SQL (.sql)

**설정 파일**

- JSON (.json)
- JSON Lines (.jsonl)
- XML (.xml)
- YAML (.yml, .yaml)
- Properties (.properties)
- INI (.ini)
- CONF (.conf)
- ENV (.env)

**일반 텍스트**

- TXT
- Markdown
- LOG
- Shell Script
- PowerShell
- Batch

### 지원 정책

다양한 텍스트 파일은 기본적으로 Text Diff로 비교한다.

언어별 Syntax Highlight 지원 여부는 Monaco Editor의 실제 지원 범위에 따른다.

확장자로 언어를 감지할 수 없는 파일은 Plain Text 모드를 제공한다.

일반 텍스트 파일과 JSON 구조 파일의 비교 기능을 분리한다.

PDF, Word, 이미지, 실행 바이너리 비교는 첫 버전에 포함하지 않는다.

---

## 7. 파일 업로드 엔진

### 기능

- Original File 업로드
- Modified File 업로드
- Drag & Drop
- 텍스트 직접 입력
- 파일 교체
- 파일 제거
- 파일명 표시
- 파일 크기 표시
- 줄 수 표시
- 언어 자동 감지
- 언어 수동 선택
- 인코딩 선택
- 파일 다운로드

### 파일 처리

파일을 읽을 때 다음 사항을 고려한다.

- UTF-8
- UTF-8 BOM
- UTF-16 LE
- UTF-16 BE
- CRLF
- LF
- CR
- 마지막 개행 여부
- 빈 파일
- 한글 및 Unicode
- 잘못된 인코딩

레거시 인코딩(EUC-KR 등)은 브라우저 지원 여부를 확인한 뒤 수동 선택 기능으로 확장한다.

잘못된 디코딩을 무조건 정상 텍스트로 처리하지 않는다.

### 보안

- 업로드 파일 실행 금지
- 파일 내용 외부 서버 전송 금지
- 바이너리 파일 검사
- 최대 파일 크기 제한
- 메모리 사용량 제한
- HTML 안전 렌더링

---

## 8. Code Compare — 핵심 기능

두 개의 소스 코드 파일을 비교한다.

### 입력 방식

1. 파일 두 개 업로드
2. 코드 직접 입력
3. 한쪽 파일 업로드 후 다른 쪽 직접 입력
4. 예제 코드 불러오기

### 비교 모드

**Side-by-Side Diff**

Original과 Modified를 좌우로 표시한다.

**Unified Diff**

하나의 화면에서 추가/삭제 변경을 표시한다.

### 변경 유형

- ADDED
- REMOVED
- MODIFIED
- UNCHANGED

### 중요 설계

기본 Diff 알고리즘은 추가/삭제 작업을 계산한다.

MODIFIED는 삭제와 추가가 대응되는 변경 블록을 분석하여 추정한 결과로 구분한다.

사용자에게 확정적인 추가/삭제와 휴리스틱 기반 수정 판정을 혼동해서 표시하지 않는다.

### 필수 기능

- Syntax Highlight
- 줄 번호
- 추가된 줄 강조
- 삭제된 줄 강조
- 수정된 줄 강조
- 줄 내부 문자 변경 강조
- 연결된 변경 블록 표시
- 이전 변경 이동
- 다음 변경 이동
- 변경된 부분만 보기
- 전체 파일 보기
- Word Wrap
- MiniMap
- 코드 검색
- 코드 복사
- 선택 부분 복사
- 파일 다운로드

### 수정 가능 비교기

Original/Modified 모두 편집할 수 있도록 한다.

편집한 결과가 즉시 Diff에 반영되어야 한다.

성능 문제가 있는 경우 Debounce를 적용한다.

업로드한 원본 파일은 직접 수정하지 않는다.

---

## 9. Text Diff Engine

비교 로직을 UI와 분리한다.

### 비교 단위

- Line
- Word
- Character

### 데이터 모델

```ts
type DiffOperation =
  | "added"
  | "removed"
  | "unchanged";

interface DiffLine {
  operation: DiffOperation;
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}

interface DiffHunk {
  id: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}
```

추가 모델로 다음 정보를 관리한다.

- 변경 블록 번호
- 수정 대응 관계
- 문자 변경 범위
- 변경 통계
- 비교 옵션
- 계산 시간

### 비교 옵션

- 공백 변경 무시
- 줄 끝 공백 무시
- 모든 공백 무시(선택)
- 빈 줄 무시
- 대소문자 무시
- 줄바꿈 형식 무시
- 문맥 줄 수 선택

원본 텍스트는 절대 비교 옵션에 의해 변경되지 않는다.

비교용 정규화 데이터와 실제 원본 텍스트를 분리한다.

### 정확성 기준

다음 경우를 정확하게 처리한다.

- 파일 시작 부분 변경
- 파일 끝 부분 변경
- 한 줄만 변경
- 여러 줄 추가
- 여러 줄 삭제
- 여러 블록 변경
- 동일한 코드가 여러 번 반복
- 줄 위치 이동
- 빈 파일
- 한쪽만 빈 파일
- 마지막 줄 개행 없음
- 탭과 스페이스 차이
- Windows/Linux 줄바꿈 차이
- 한글 및 Unicode

알고리즘이 변경 이동을 정확히 판정할 수 없을 때는 이동이라고 단정하지 않는다.

---

## 10. 변경 통계 및 탐색

비교 결과 상단에 다음 정보를 표시한다.

- 추가된 줄
- 삭제된 줄
- 변경된 블록
- 변경된 파일
- 총 비교 줄 수

### 변경 탐색 패널

- 변경 번호
- 변경 유형
- Original 줄 범위
- Modified 줄 범위
- 코드 미리보기
- 변경 위치로 이동

사용자가 특정 변경 항목을 클릭하면 Monaco Editor의 해당 위치로 이동한다.

### 상태 표시

- 비교 완료
- 비교 중
- 파일 동일
- 비교 불가능
- 파일 크기 초과
- 인코딩 오류

---

## 11. JSON Tools — 독립된 기능 영역

JSON은 Text Diff와 Structural Diff를 모두 지원한다.

### JSON 도구 목록

1. JSON Editor
2. JSON Formatter
3. JSON Minify
4. JSON Tree Viewer
5. JSON Structural Diff
6. JSONPath Explorer
7. JSON Schema Generator
8. JSON Schema Validator
9. TypeScript Interface Generator
10. JSON ↔ CSV Converter

각 기능은 독립된 화면 또는 탭에서 사용할 수 있도록 한다.

---

## 12. JSON Editor 및 Formatter

### 기능

- Monaco Editor
- JSON Syntax Highlight
- JSON 파일 업로드
- JSON 직접 입력
- 실시간 문법 오류
- Pretty Print
- Minify
- Key Sorting
- 들여쓰기 설정
- 코드 복사
- JSON 다운로드

### 정확성

- Object
- Array
- String
- Number
- Boolean
- Null
- Unicode
- 중첩 데이터

JSONC 등 표준 JSON이 아닌 형식은 별도 모드로 구분한다.

JavaScript 숫자 정밀도 범위를 초과하는 정수는 손실 가능성을 검증한다.

정밀도 손실이 발생하는 경우 사용자에게 안내한다.

---

## 13. JSON Tree Viewer

JSON을 트리 구조로 시각화한다.

### 기능

- Object 펼치기/접기
- Array 펼치기/접기
- 데이터 타입 표시
- Key 검색
- Value 검색
- 노드 경로 표시
- JSONPath 복사
- 값 복사
- 전체 펼치기
- 전체 접기
- 깊이별 펼치기
- 선택 노드 강조

### 대용량 처리

트리 노드가 많은 경우 Lazy Rendering과 Virtual Scrolling을 사용한다.

모든 노드를 한 번에 DOM에 렌더링하지 않는다.

---

## 14. JSON Structural Diff

단순 텍스트 비교가 아닌 필드 단위 비교를 구현한다.

### 결과 유형

- FIELD_ADDED
- FIELD_REMOVED
- VALUE_MODIFIED
- TYPE_CHANGED
- ARRAY_CHANGED

### 비교 정책

- Object Key 순서 기본 무시
- null과 필드 부재 구분
- String과 Number 구분
- 배열 순서 기본 유지
- 중첩 객체 지원
- 빈 배열과 빈 객체 구분

### 배열 비교

기본적으로 Index 기반 비교를 제공한다.

확장 기능으로 Key 기반 배열 비교를 제공한다.

동일한 Key가 중복될 경우 충돌 정책을 정의한다.

### 결과 UI

- 좌우 JSON Tree 비교
- 변경 필드 강조
- 변경된 Path 표시
- 추가/삭제/수정 통계
- 이전/다음 변경 이동
- 변경 항목만 보기

---

## 15. JSONPath Explorer

JSONPath로 데이터를 검색한다.

### 기능

- JSONPath 입력
- 표현식 검증
- 검색 실행
- 일치 항목 표시
- 검색 결과 경로 표시
- 결과 복사
- JSON 다운로드
- Tree Viewer와 선택 상태 연동

안전한 JSONPath 라이브러리를 선택한다.

사용자가 입력한 표현식을 임의 JavaScript 코드로 실행하지 않는다.

---

## 16. JSON Schema

### 기능

- 입력 JSON 구조 분석
- 필드 타입 추론
- JSON Schema 생성
- Required 필드 검증
- Nullable 처리
- 중첩 구조
- 배열 타입
- Schema 기반 유효성 검사
- Schema 다운로드

하나의 JSON 샘플로 생성한 Schema는 추론 초안이라는 점을 명시한다.

---

## 17. TypeScript Generator

JSON을 TypeScript 타입으로 변환한다.

### 기능

- Interface 생성
- Type Alias 생성
- 중첩 타입 분리
- 배열 타입
- Nullable 타입
- Optional 필드
- 타입명 설정
- Export 설정
- 코드 복사
- .ts 다운로드

### 예시

입력:

```json
{
  "userId": 1001,
  "name": "Hong",
  "roles": ["ADMIN"]
}
```

결과:

```ts
export interface Root {
  userId: number;
  name: string;
  roles: string[];
}
```

잘못된 식별자, 예약어, 빈 배열, 혼합 배열 타입을 검증한다.

---

## 18. JSON ↔ CSV 변환

### JSON → CSV

- Object Array 입력
- Header 생성
- 컬럼 선택
- 컬럼 순서 설정
- 중첩 데이터 Flatten
- 미리보기
- CSV 다운로드

### CSV → JSON

- CSV 업로드
- 텍스트 입력
- Header 분석
- 구분자 선택
- 타입 추론 옵션
- JSON 미리보기
- JSON 다운로드

CSV의 따옴표, 구분자, 줄바꿈, 한글, 빈 값, Formula Injection 문제를 처리한다.

중첩 구조와 타입 정보가 완벽하게 왕복 복원된다고 가정하지 않는다.

---

## 19. JSON Field Mapping

Source JSON 필드를 Target JSON으로 매핑하는 도구를 구현한다.

### 화면

- 좌측 Source JSON Tree
- 중앙 Mapping Rules
- 우측 Target Preview

### 기능

- Source Path 선택
- Target Path 지정
- 필드 이름 변경
- 값 복사
- 데이터 타입 변환
- 기본값 지정
- 상수값 삽입
- 필드 제외
- 중첩 객체 매핑
- 배열 매핑
- 규칙 추가/삭제
- 결과 미리보기
- Mapping Rule Import/Export

### Mapping Rule

```ts
interface MappingRule {
  id: string;
  sourcePath?: string;
  targetPath: string;
  transform:
    | "copy"
    | "string"
    | "number"
    | "boolean"
    | "date"
    | "constant";
  defaultValue?: unknown;
  constantValue?: unknown;
}
```

### 필수 안전성

- 입력 JSON 불변성
- Target Path 충돌 검증
- 누락 필드 처리
- Null 처리
- 변환 오류 표시
- Prototype Pollution 방어
- 임의 코드 실행 금지
- 결정적인 변환 결과

---

## 20. Folder Compare

두 폴더 또는 프로젝트 디렉터리를 비교한다.

### 업로드

- Original Folder 선택
- Modified Folder 선택
- 브라우저 폴더 선택 API 활용
- 필요 시 Drag & Drop

### 비교 기준

상대 경로를 기준으로 파일을 매칭한다.

### 파일 상태

- ADDED_FILE
- REMOVED_FILE
- MODIFIED_FILE
- UNCHANGED_FILE

### 기능

- 폴더 트리 표시
- 파일별 상태 강조
- 파일 검색
- 변경 파일만 보기
- 동일 파일 숨기기
- 파일 클릭 시 Diff
- 파일별 추가/삭제 줄 통계
- 폴더 전체 통계
- 결과 목록 Export

### 비교 옵션

- 확장자 필터
- 파일명 검색
- 특정 디렉터리 제외
- 공백 변경 무시
- 대소문자 구분
- 텍스트/바이너리 구분

### 기본 제외 대상

- node_modules
- .git
- dist
- build
- target
- bin
- obj

사용자가 제외 항목을 변경할 수 있도록 한다.

### 중요 정책

파일 내용이 같아도 파일명이 달라진 경우 기본적으로 삭제/추가로 표시한다.

Rename Detection은 추정 기능으로 별도 구현한다.

디렉터리 이름 변경도 자동으로 확정하지 않는다.

---

## 21. Patch Export

변경사항을 Unified Diff Patch로 출력한다.

### 기능

- Patch 생성
- Patch 미리보기
- Patch 복사
- .diff 다운로드
- .patch 다운로드
- Patch 적용 검증

### 요구사항

- 파일명
- 원본 줄 범위
- 변경 줄 범위
- 문맥 줄
- 마지막 개행 처리
- CRLF/LF 정책
- Patch 표준 호환성 검토

실제 원본 텍스트와 수정 텍스트를 기반으로 Patch를 생성한다.

공백 무시 옵션을 적용한 화면용 비교 결과를 그대로 패치로 사용하지 않는다.

---

## 22. Syntax Compare — 고급 기능

Tree-sitter를 사용한 언어별 구문 분석 기능을 확장 개발한다.

### 목표

Text Diff에서는 확인하기 어려운 코드 구조 변경을 분석한다.

### 분석 항목

- 클래스 추가/삭제
- 메서드 추가/삭제
- 함수 추가/삭제
- 매개변수 변경
- Import 변경
- 코드 블록 변경
- 함수명 변경 후보

### 지원 언어

우선순위:

1. Java
2. C#
3. Python
4. JavaScript
5. TypeScript

실제 WASM Grammar와 Parser 호환성을 확인한 후 진행한다.

### 구현 원칙

- 언어별 Parser 분리
- AST 노드 추출
- 노드 매칭 알고리즘 설계
- 변경 유형 분류
- Text Diff 결과와 연동
- 미지원 언어는 Text Diff로 처리

AST 파싱 성공 자체가 의미론적 변경의 정확한 판정을 의미하지 않는다.

수정 및 이동 추정의 한계를 문서화한다.

---

## 23. UI/UX

전문적인 개발자 도구 스타일로 구현한다.

### 디자인 방향

- VS Code와 유사한 코드 편집 작업 효율
- Dark Mode 기본
- Light Mode 지원
- 높은 정보 밀도
- 명확한 색상 체계
- 불필요한 애니메이션 최소화
- 레이아웃 크기 조절
- 한국어 기본 UI
- 반응형 디자인
- 접근성 고려

### 상단 Header

- 프로젝트 로고
- Code Compare
- Folder Compare
- JSON Tools
- Field Mapping
- 테마 설정
- 도움말

### Code Compare 화면

상단:

- Original 파일 선택
- Modified 파일 선택
- 언어 선택
- 비교 옵션

중앙:

- Monaco Diff Editor

우측:

- 변경 통계
- 변경 목록
- 변경 상세

하단:

- 파일명
- 인코딩
- 파일 크기
- 줄 수
- 변경 개수

### Folder Compare 화면

좌측:

- 폴더 트리
- 파일별 상태

중앙:

- 선택된 파일의 Diff

우측:

- 폴더 통계
- 파일 정보

### JSON Tools 화면

독립적인 탭 또는 하위 내비게이션으로 도구 전환.

### Field Mapping 화면

Source / Mapping / Target의 3열 레이아웃.

### UI 기능

- 패널 크기 조절
- 탭 상태 유지
- JSON 샘플 불러오기
- 코드 비교 샘플 불러오기
- 결과 복사
- 결과 다운로드
- 오류 메시지
- 로딩 표시
- 비교 진행 상태

기능이 미구현인 버튼은 완료된 기능처럼 표시하지 않는다.

---

## 24. 상태 관리

Zustand를 사용한다.

### 주요 상태

- Active Workspace
- Original File
- Modified File
- Original Text
- Modified Text
- Detected Language
- Selected Language
- Diff Options
- Diff Results
- Selected Change
- Folder Comparison
- JSON Tool State
- Mapping Rules
- Theme

### 원칙

- 파일 바이너리와 UI 상태 구분
- 원본 데이터와 편집 데이터 분리
- 대규모 데이터의 불필요한 복제 방지
- Derived State는 필요 시 계산
- Diff 계산에 Debounce 적용
- Worker 결과의 요청 버전 검증
- Monaco Model 리소스 정리

---

## 25. 성능 요구사항

### 목표

실제 소스 코드 비교 도구로 사용할 수 있는 수준의 성능을 확보한다.

### 테스트 대상

- 100줄
- 1,000줄
- 10,000줄
- 50,000줄
- 큰 단일 행
- 반복 코드
- 유사한 변경이 많은 코드
- 대용량 JSON
- 다수 파일을 가진 폴더

### 최적화

- Web Worker
- Debounce
- Virtual Scrolling
- 메모이제이션
- Monaco Model 관리
- 비교 계산 취소
- 오래된 결과 무시
- 파일 크기 제한
- 처리 시간 측정
- 메모리 사용량 측정

성능 한계는 실제 측정 결과를 기준으로 정한다.

---

## 26. 보안 및 개인정보

브라우저 로컬 처리를 기본 원칙으로 한다.

- 소스 코드 외부 업로드 금지
- 백엔드 API 호출 금지
- 파일 내용 자동 공유 금지
- 파일 임의 실행 금지
- HTML 삽입 및 XSS 방어
- JSON Prototype Pollution 방어
- 사용자 입력 코드 평가 금지
- JSONPath의 임의 코드 실행 방지
- 브라우저 저장소에 민감한 데이터 무단 저장 금지
- 파일 크기 제한
- 비정상 입력 오류 처리

클립보드 복사 및 파일 다운로드는 사용자의 명시적 동작으로 수행한다.

---

## 27. 테스트

### File Loader

- Java/C#/Python 등 텍스트 파일
- 빈 파일
- UTF-8
- UTF-16
- BOM
- CRLF/LF
- 한글
- 잘못된 인코딩
- 바이너리 파일

### Text Diff

- 동일 파일
- 줄 추가
- 줄 삭제
- 줄 수정
- 여러 변경 블록
- 변경 위치 정확성
- 문자열 내부 변경
- 줄바꿈 차이
- 공백 차이
- 반복 코드
- Unicode

### JSON Diff

- 객체 필드 추가/삭제
- 값 변경
- 타입 변경
- Key 순서 변경
- 배열 변경
- Null과 필드 부재
- 깊은 중첩 데이터

### Folder Compare

- 동일 폴더
- 파일 추가
- 파일 삭제
- 파일 수정
- 중첩 폴더
- 제외 패턴
- 상대 경로
- 큰 폴더
- 파일명 변경

### Patch

- Patch 생성
- Patch 적용
- 원본과 수정본 비교
- 개행 처리
- 파일명 검증

### JSON Tools

- Formatter
- Tree Viewer
- JSONPath
- Schema
- TypeScript Generator
- CSV Converter
- Field Mapping

### E2E

- 두 코드 파일 업로드
- 변경된 줄 확인
- Side-by-Side 비교
- Unified Diff
- 변경 탐색
- 파일 다운로드
- 폴더 비교
- JSON Structural Diff
- GitHub Pages 배포 환경

---

## 28. GitHub Pages 배포

백엔드 없는 정적 애플리케이션으로 배포한다.

### 구성

- GitHub Actions
- Production Build
- TypeScript Type Check
- ESLint
- Unit Test
- Vite Base Path
- Monaco Worker 경로
- Web Worker 로딩
- 정적 라우팅 대응

### 배포 검증

배포 환경에서 다음 기능을 확인한다.

- 파일 업로드
- Code Compare
- JSON Tools
- Folder Compare
- 결과 다운로드
- Monaco Editor 정상 렌더링
- 새로고침
- 모바일 레이아웃

실제 배포 권한이 없으면 GitHub Actions 설정까지 완료하고 배포는 미검증 상태로 기록한다.

---

## 29. 개발 단계

### Phase 0 — 아키텍처 및 관리 문서

- 요구사항 분석
- 기술 스택 선정
- 비교 엔진 설계
- 데이터 모델
- 프로젝트 폴더 구조
- PROJECT.md
- AGENTS.md
- README.md
- docs/PROGRESS.md
- docs/DECISIONS.md

완료 기준: 프로젝트 목표와 개발 구조 확정.

### Phase 1 — 기본 Code Compare

- React + TypeScript + Vite
- Tailwind CSS
- Monaco Diff Editor
- Original/Modified 코드 입력
- 두 파일 업로드
- 언어 감지
- Side-by-Side Diff
- 추가/삭제/수정 표시
- 변경 줄 강조
- 기본 비교 옵션
- 기본 UI 레이아웃
- 테스트 환경

완료 기준: 두 코드 파일을 비교하고 변경된 위치를 확인할 수 있음.

### Phase 2 — Diff UX 고도화

- Unified Diff
- 변경 통계
- 변경 목록
- 이전/다음 변경
- 줄 내부 변경 표시
- 편집 후 재비교
- 코드 다운로드
- 비교 옵션 확장

완료 기준: 전문적인 코드 비교 UX 구현.

### Phase 3 — JSON Tools

- JSON Editor
- Formatter
- Tree Viewer
- Structural Diff
- JSONPath
- JSON Schema
- TypeScript Generator
- JSON ↔ CSV

완료 기준: JSON 분석 및 변환 도구 구현.

### Phase 4 — Field Mapping

- Source/Target JSON
- 필드 매핑
- 타입 변환
- 중첩 경로
- 배열 처리
- 결과 미리보기
- Mapping Rules Import/Export

완료 기준: JSON 필드 변환 결과 생성.

### Phase 5 — Patch Export

- Unified Diff Patch
- Patch 미리보기
- Patch 다운로드
- Patch 적용 테스트

완료 기준: 실제 적용 가능한 Patch 생성.

### Phase 6 — Folder Compare

- 폴더 업로드
- 상대 경로 기반 비교
- 파일별 상태
- 폴더 트리
- 파일별 Diff
- 변경 통계
- 제외 패턴

완료 기준: 두 소스 프로젝트 폴더 비교 가능.

### Phase 7 — Syntax Compare

- Tree-sitter 검토
- Java/C#/Python 파서
- AST 구조 분석
- 메서드/클래스 변경
- 결과 UI
- 지원 범위 문서화

완료 기준: 선택 언어의 구문 수준 비교 제공.

### Phase 8 — 성능 및 UI/UX

- Web Worker
- 대용량 파일 최적화
- Monaco 리소스 관리
- Dark/Light
- 레이아웃 크기 조절
- 반응형 UI
- 접근성 개선
- 성능 테스트

완료 기준: 안정적인 개발자 도구 수준 완성.

### Phase 9 — 통합 테스트 및 배포

- 테스트 확대
- 버그 수정
- GitHub Actions
- GitHub Pages
- README 완성
- 기술적 해결 과정 정리
- 스크린샷
- 포트폴리오 소개

완료 기준: 실제 배포 환경에서 도구 사용 가능.

---

## 30. 최종 완료 조건

- [ ] Java, C#, Python 등 코드 파일 비교
- [ ] HTML, CSS, JavaScript 비교
- [ ] SQL 및 설정 파일 비교
- [ ] 두 파일 업로드
- [ ] 코드 직접 입력
- [ ] Side-by-Side Diff
- [ ] Unified Diff
- [ ] 추가/삭제/수정 표시
- [ ] 줄 내부 변경 강조
- [ ] 정확한 줄 번호
- [ ] 변경 통계
- [ ] 변경 위치 탐색
- [ ] 공백 비교 옵션
- [ ] 파일 인코딩 처리
- [ ] 코드 편집 후 재비교
- [ ] 결과 다운로드
- [ ] JSON Structural Diff
- [ ] JSON Tree Viewer
- [ ] JSON Formatter
- [ ] JSONPath
- [ ] JSON Schema
- [ ] TypeScript Generator
- [ ] JSON ↔ CSV
- [ ] Field Mapping
- [ ] Patch Export
- [ ] Folder Compare
- [ ] AST 기반 비교 지원 범위 검증
- [ ] 대용량 파일 처리
- [ ] Dark/Light 모드
- [ ] 자동화 테스트
- [ ] GitHub Pages 배포
- [ ] PROJECT.md 관리
- [ ] AGENTS.md 관리
- [ ] README.md 최신화
- [ ] PROGRESS.md 최신화
- [ ] DECISIONS.md 기록

---

## 31. 에이전트 작업 규칙

당신은 React, TypeScript, Monaco Editor, Diff Algorithm, 파일 처리 및 개발자 도구 개발 경험이 있는 시니어 프론트엔드 개발자이자 소프트웨어 아키텍트 역할이다.

다음 원칙을 준수한다.

1. 작업 시작 전 필수 문서 확인
2. 현재 소스와 Git 상태 확인
3. 현재 Phase 파악
4. 기존 정상 기능 보존
5. 핵심 알고리즘과 UI 분리
6. 테스트 코드 작성
7. TypeScript 검사
8. ESLint 검사
9. Production Build
10. PROGRESS.md 업데이트
11. DECISIONS.md 기록
12. README.md 최신화
13. 미검증 기능 완료 처리 금지
14. 중요한 문제를 숨기지 않음
15. 다음 세션에서 작업을 이어갈 수 있도록 상태 유지

### 금지 사항

- JSON 전용 프로젝트를 먼저 생성한 후 무작정 재구성
- 불필요한 백엔드 도입
- 실제 기능 없는 UI 버튼
- Diff 정확성 검증 생략
- 원본 파일 직접 변경
- 사용자 파일 외부 서버 업로드
- 코드 실행 기능 추가
- 비교 결과를 임의로 조작
- 테스트 실패 무시
- 기존 기능 무단 삭제

---

## 32. 최초 실행 지시

이번 최초 실행에서는 **Phase 0과 Phase 1까지만 개발한다.**

### 작업 순서

1. 현재 저장소 및 Git 상태 확인
2. 기존 파일이 있는지 확인
3. 전체 요구사항 검토
4. 기술 스택 및 호환성 검토
5. 비교 엔진 아키텍처 설계
6. PROJECT.md 생성
7. AGENTS.md 생성
8. README.md 초기 작성
9. docs/PROGRESS.md 생성
10. docs/DECISIONS.md 생성
11. Vite + React + TypeScript 초기화
12. Tailwind CSS 구성
13. Monaco Editor 설정
14. Zustand 설정
15. 기본 레이아웃 구현
16. Original/Modified 파일 입력
17. 파일 업로드
18. 언어 감지
19. Side-by-Side Diff
20. 변경 줄 표시
21. 비교 옵션 구현
22. 핵심 테스트 작성
23. 타입 검사
24. 빌드 및 테스트
25. 문서 최신화
26. 최종 보고

### Phase 1 실제 검증

다음 시나리오가 동작해야 한다.

1. 사용자가 Java 파일 2개 업로드
2. Original과 Modified에 코드 표시
3. Java Syntax Highlight 적용
4. 추가/삭제된 줄 표시
5. 수정된 내용 강조
6. 줄 번호 정확하게 표시
7. 변경 위치 탐색
8. 비교 결과가 실제 원본과 일치
9. Python/C#/HTML 파일도 동일하게 비교 가능
10. 파일 업로드와 직접 입력 모두 사용 가능

### 최종 보고

- 생성/수정 파일
- 아키텍처
- 비교 엔진 설계
- 라이브러리 선택 이유
- 구현된 기능
- 테스트 결과
- 빌드 결과
- 발견한 문제
- 미완료 작업
- 다음 Phase

Phase 2 이후 기능은 이번 실행에서 개발하지 않는다.

전체 설계는 향후 JSON Tools, Folder Compare, Field Mapping, Patch Export, Syntax Compare를 확장할 수 있도록 구성한다.

**최종 목표는 개발자가 소스 코드, 설정 파일, JSON 데이터 및 프로젝트 폴더를 비교하고 변경사항을 정확하게 분석할 수 있는 전문적인 브라우저 기반 개발 도구를 만드는 것이다.**

이제 프로젝트 문서를 생성하고 Phase 0부터 개발을 진행하라.
