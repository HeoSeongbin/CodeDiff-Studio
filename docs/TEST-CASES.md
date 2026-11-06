# 테스트 사례와 실행

```sh
npm test
npm run typecheck
npm run lint
npm run build
npm run test:e2e
```

최종 결과 (2026-11-06): Unit **20/20**, Edge E2E **5/5**, typecheck/lint/build 통과. Monaco 번들 크기 경고 유지.

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
