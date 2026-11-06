# 에이전트 개발 규칙

1. 작업 전 PROJECT.md, docs/PROGRESS.md, docs/DECISIONS.md와 현재 소스 및 Git 상태를 확인한다.
2. 현재 Phase와 사용자 승인 범위를 확인하고 기존 정상 기능을 보존한다.
3. 비교 알고리즘과 UI를 분리하고 기능 구현 후 정확성 테스트를 추가한다.
4. npm test, npm run typecheck, npm run lint, npm run build를 실행한다.
5. 문서와 README를 실제 구현 상태에 맞게 최신화하고 중요한 설계 결정은 ADR로 기록한다.
6. 검증하지 않은 기능을 완료 처리하지 않는다. 오류와 미완료 작업을 숨기지 않는다.
7. 다음 세션에서 이어갈 수 있도록 PROGRESS에 현재 상태와 다음 작업을 기록한다.
8. 상세 요구사항과 최종 완료 조건은 PROJECT.md를 기준으로 한다. 임의 삭제하지 않는다.
