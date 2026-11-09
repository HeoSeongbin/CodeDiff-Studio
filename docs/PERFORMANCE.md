# Phase 8 성능 검증

측정: 2026-11-09T06:28:28.803Z, Windows / Edge 157.0.4341.42, production preview, Playwright 단일 worker. 각 시나리오 1회 관측이며 다른 기기의 성능 보장이 아니다. [원본 JSON](phase8-performance.json), [실행 테스트](../e2e/performance.spec.ts).

| 시나리오 | 결과 반영까지 ms | 최대 timer 간격 ms | p95 timer 간격 ms | 종료 후 main JS heap MiB |
|---|---:|---:|---:|---:|
| lines-100 | 375.3 | 28.7 | 19.9 | 14.3 |
| lines-1000 | 374.0 | 26.1 | 18.8 | 15.1 |
| lines-10000 | 414.5 | 23.8 | 19.8 | 15.6 |
| lines-50000 | 544.6 | 58.2 | 54.7 | 17.3 |
| single-line-500k | 449.2 | 36.6 | 34.9 | 16.5 |
| single-line-5MiB | 1155.8 | 269.9 | 258.4 | 25.5 |
| repeated-50000 | 505.5 | 74.4 | 38.2 | 29.2 |
| similar-500-changes | 376.4 | 36.4 | 22.3 | 16.5 |
| cancel-50000-disjoint | 1946.5 | 43.9 | 17.1 | 18.3 |
| json-20000-values | 290.4 | 18.4 | 18.4 | 22.0 |
| json-20000-structural-diff | 177.5 | 37.2 | 37.2 | 36.5 |
| folder-500-files | 1124.9 | 120.4 | 54.2 | 49.6 |

시간은 파일 업로드·디코딩·250ms(Text)/100ms(JSON) debounce·Worker 시작/메시지·통계 반영을 포함한다. 취소 행은 업로드부터 Worker 종료 관측까지이며 클릭 자체의 응답 시간과 다르다. Monaco의 모든 시각 Diff 완료를 기다리는 측정이 아니라 독립 분석 결과가 UI에 도착하는 경계다. 16ms interval의 간격은 이벤트 루프 지연 관측이며 실제 키보드 입력 지연 측정이 아니다. 샘플 수가 작고 반복 통계의 p95가 아니다.

CDP main-target JS heap은 각 시나리오 종료 뒤 forced GC 후 읽었다. 초기 13.1 MiB → 최종 49.6 MiB, 최종 Monaco text model 6개. 여러 탭의 데이터·뷰를 유지한 상태이며 전체 메모리나 순간 peak, Worker/WASM/native/GPU 메모리를 뜻하지 않는다. 별도 회귀에서 탭·테마 전환 뒤 모델 개수 유지도 확인한다.

정확성/렌더링 검증: 일반 변경 +1/−1 및 다중 변경 +500/−500, 변경 목록 최대100 DOM, JSON20,001 노드의 화면 행24개, 폴더500개/수정10개·화면 행28개, 원본 파일 읽기 후 불변, Worker 취소 후 새 입력 결과 반영, 외부 요청0건/pageerror0건. 어려운 비교의 취소/시간 초과를 동일로 표시하지 않는다.

보호 한도는 파일5MiB, JSON1MiB/30k값, Syntax1MiB/100k AST노드·깊이128/5k요소, Worker wall10초, Text 및 Monaco Diff1.5초, 폴더20MiB·1000파일·전체15초다. 이 기록은 모든 한도 조합을 보장하지 않는다. 5MiB 단일 행에서는 약270ms 수준의 메인 스레드 입력 구성 지연이 남았다. 큰 행의 상세는 양쪽20k자 cap이며 전체 저장은 유지된다. 파일 읽기 자체와 structured clone/Monaco 모델 구성/트리 투영/DOM 렌더는 여전히 main thread의 일을 포함한다.

실행(기존 회귀와 분리):

```powershell
npm run build
$env:CODEDIFF_TEST_PREVIEW = '1'
$env:CODEDIFF_TEST_PORT = '5217'
npm run test:perf
```

테스트는 시나리오당 wall15초·최대 event-loop gap1초 및 각 정확성/DOM/리소스 조건을 검사한다. 값이 작다는 이유로 UI 조작 전체 지연이나 대형 Monaco 번들 다운로드 성능을 보장하지 않는다. 실제 배포·다른 OS/브라우저·실기기 모바일은 미검증이다.
