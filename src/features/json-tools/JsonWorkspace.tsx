import { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useJsonWorkspace, jsonSample } from '../../stores/jsonWorkspace';
import {
  type Json,
  type Segment,
  parseJson,
  pathText,
  sortKeys,
  stringify,
  structuralDiff,
  JSON_MAX_BYTES,
} from '../../core/json/value';
import { generateSchema, generateTypes, validateSchema } from '../../core/json/schema';
import { queryJson } from '../../core/json/query';
import { csvColumns, fromCsv, toCsv } from '../../core/json/csv';
import { loadFile } from '../../core/file';
import { downloadText } from '../../core/export';
import { JsonTree } from './JsonTree';
import { ResultList } from './ResultList';
const tabs = [
  ['format', 'Editor / Formatter'],
  ['tree', 'Tree Viewer'],
  ['diff', 'Structural Diff'],
  ['path', 'JSONPath'],
  ['schema', 'JSON Schema'],
  ['types', 'TypeScript'],
  ['csv', 'JSON ↔ CSV'],
];
export default function JsonWorkspace() {
  const state = useJsonWorkspace();
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [indent, setIndent] = useState(2),
    [selected, setSelected] = useState<Segment[]>([]),
    [changeIndex, setChangeIndex] = useState(0),
    [onlyChanges, setOnlyChanges] = useState(false);
  const [expression, setExpression] = useState('$.roles[*]'),
    [pathResults, setPathResults] = useState<ReturnType<typeof queryJson>>(),
    [pathSource, setPathSource] = useState('');
  const [output, setOutput] = useState(''),
    [outputKind, setOutputKind] = useState('json'),
    [typeName, setTypeName] = useState('Root'),
    [alias, setAlias] = useState(false),
    [exported, setExported] = useState(true),
    [validation, setValidation] = useState('');
  const [direction, setDirection] = useState('toCsv'),
    [delimiter, setDelimiter] = useState(','),
    [infer, setInfer] = useState(false),
    [flatten, setFlatten] = useState(false),
    [columns, setColumns] = useState<string[]>([]);
  const uploadVersion = useRef({ source: 0, target: 0, csv: 0, schema: 0 });
  const parsed = useMemo(() => {
    try {
      return { value: parseJson(state.source), error: '' };
    } catch (e) {
      return { value: undefined, error: (e as Error).message };
    }
  }, [state.source]);
  const target = useMemo(() => {
    try {
      return { value: parseJson(state.target), error: '' };
    } catch (e) {
      return { value: undefined, error: (e as Error).message };
    }
  }, [state.target]);
  const changes = useMemo(
    () =>
      state.tab === 'diff' && parsed.value !== undefined && target.value !== undefined
        ? structuralDiff(parsed.value, target.value)
        : [],
    [parsed.value, target.value, state.tab],
  );
  const available = useMemo(() => {
    try {
      return parsed.value === undefined ? [] : csvColumns(parsed.value, flatten).fields;
    } catch {
      return [];
    }
  }, [parsed.value, flatten]);
  useEffect(() => {
    setOutput('');
    setValidation('');
    setError('');
    setChangeIndex(0);
    setPathResults(undefined);
    setColumns([]);
    setNotice('');
  }, [
    state.source,
    state.target,
    state.tab,
    state.schema,
    state.csv,
    flatten,
    direction,
    delimiter,
    infer,
    typeName,
    alias,
    exported,
  ]);
  useEffect(() => {
    if (state.tab === 'diff' && changes.length) setSelected(changes[0].path);
  }, [changes, state.tab]);
  const changedPaths = useMemo(
    () => changes.filter((c) => c.kind !== 'ARRAY_CHANGED').map((c) => pathText(c.path)),
    [changes],
  );
  function run(action: () => void) {
    setError('');
    setNotice('');
    try {
      action();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function requireValue(): Json {
    if (parsed.value === undefined) throw new Error(parsed.error);
    return parsed.value;
  }
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice('복사했습니다.');
    } catch {
      setError('클립보드 복사에 실패했습니다.');
    }
  }
  async function upload(file: File | undefined, field: 'source' | 'target' | 'csv' | 'schema') {
    if (!file) return;
    const version = ++uploadVersion.current[field];
    try {
      if (file.size > JSON_MAX_BYTES) throw new Error('JSON/CSV 도구 입력 제한은 1 MiB입니다.');
      const loaded = await loadFile(file);
      if (version !== uploadVersion.current[field]) return;
      state.set({ [field]: loaded.text });
      setError('');
    } catch (e) {
      if (version === uploadVersion.current[field]) setError((e as Error).message);
    }
  }
  function selectChange(index: number) {
    if (!changes.length) return;
    const next = (index + changes.length) % changes.length;
    setChangeIndex(next);
    setSelected(changes[next].path);
  }
  const pathValid = pathResults && pathSource === state.source;
  return (
    <main className="json-workspace">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">WORKSPACE / JSON TOOLS</div>
          <h1>JSON을 탐색하고, 변환하세요.</h1>
          <p>표준 JSON 전용 · 로컬 처리 · 원문 자동 저장 없음</p>
        </div>
        <button
          onClick={() => {
            uploadVersion.current.source++;
            state.set({ source: jsonSample });
            setError('');
          }}
        >
          JSON 샘플 불러오기
        </button>
      </div>
      <nav className="json-tabs" aria-label="JSON 도구">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            aria-pressed={state.tab === key}
            onClick={() => state.set({ tab: key })}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <div className="error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <div className="json-grid">
        <section className="json-source">
          <div className="tool-heading">
            <h2>Source JSON</h2>
            <label className="upload">
              JSON 열기
              <input
                type="file"
                aria-label="JSON 파일 업로드"
                onChange={(e) => {
                  void upload(e.target.files?.[0], 'source');
                  e.target.value = '';
                }}
              />
            </label>
            <button onClick={() => void copy(state.source)}>JSON 복사</button>
            <button onClick={() => downloadText(state.source, 'source.json')}>JSON 저장</button>
          </div>
          <div className="json-editor">
            <Editor
              height="100%"
              language="json"
              theme="vs-dark"
              value={state.source}
              onChange={(value) => state.set({ source: value ?? '' })}
              options={{
                ariaLabel: 'JSON 원본 편집기',
                automaticLayout: true,
                minimap: { enabled: false },
                fontSize: 13,
                wordWrap: 'on',
                scrollBeyondLastLine: false,
              }}
            />
          </div>
          <div
            role={parsed.error ? 'alert' : 'status'}
            className={parsed.error ? 'json-parse-error' : 'json-valid'}
          >
            {parsed.error || '유효한 표준 JSON'}
          </div>
          <small>
            최대 1 MiB · 30,000개 값 · 깊이 80 · JSONC 미지원 · 큰 정수는 문자열로 입력하세요.
          </small>
          {state.tab === 'diff' && (
            <>
              <div className="tool-heading">
                <h2>Modified JSON</h2>
                <label className="upload">
                  수정본 열기
                  <input
                    type="file"
                    aria-label="JSON 수정본 업로드"
                    onChange={(e) => {
                      void upload(e.target.files?.[0], 'target');
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>
              <div className="json-editor target-editor">
                <Editor
                  height="100%"
                  language="json"
                  theme="vs-dark"
                  value={state.target}
                  onChange={(v) => state.set({ target: v ?? '' })}
                  options={{
                    ariaLabel: 'JSON 수정본 편집기',
                    minimap: { enabled: false },
                    wordWrap: 'on',
                    automaticLayout: true,
                  }}
                />
              </div>
              {target.error && <p role="alert">{target.error}</p>}
            </>
          )}
        </section>
        <section className="json-tool-panel" aria-label="JSON 도구 결과">
          {state.tab === 'format' && (
            <>
              <h2>JSON Editor & Formatter</h2>
              <p>포맷 작업은 현재 편집본에만 적용합니다. 파일 원본은 변경하지 않습니다.</p>
              <div className="tool-actions">
                <label>
                  들여쓰기{' '}
                  <select
                    aria-label="JSON 들여쓰기"
                    value={indent}
                    onChange={(e) => setIndent(Number(e.target.value))}
                  >
                    {[2, 4, 8].map((n) => (
                      <option key={n}>{n}</option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() =>
                    run(() => state.set({ source: stringify(requireValue(), indent) }))
                  }
                >
                  Pretty Print
                </button>
                <button
                  onClick={() => run(() => state.set({ source: stringify(requireValue(), 0) }))}
                >
                  Minify
                </button>
                <button
                  onClick={() =>
                    run(() => state.set({ source: stringify(sortKeys(requireValue()), indent) }))
                  }
                >
                  Key Sorting
                </button>
              </div>
              <div className="json-help">
                <h3>하나의 입력, 일곱 가지 도구</h3>
                <p>
                  상단 탭에서 트리 탐색, 구조 비교, JSONPath 검색, Schema 분석, TypeScript 타입
                  생성, CSV 변환을 선택하세요.
                </p>
                <p>
                  JSON 숫자는 JavaScript Number로 분석됩니다. 안전 범위를 벗어난 정수·무한대는
                  변환을 차단합니다. 소수는 IEEE 754 정밀도를 따릅니다.
                </p>
              </div>
            </>
          )}
          {state.tab === 'tree' && parsed.value !== undefined && (
            <>
              <h2>Tree Viewer</h2>
              <JsonTree value={parsed.value} selected={selected} onSelect={setSelected} />
            </>
          )}
          {state.tab === 'diff' && parsed.value !== undefined && target.value !== undefined && (
            <>
              <h2>JSON Structural Diff</h2>
              <p>
                Key 순서 무시 · null/부재 구분 · 배열 index 기준. 배열 길이 요약은 필드별 변경과
                별도 집계됩니다.
              </p>
              <div className="json-diff-stats">
                <span>추가 {changes.filter((c) => c.kind === 'FIELD_ADDED').length}</span>
                <span>삭제 {changes.filter((c) => c.kind === 'FIELD_REMOVED').length}</span>
                <span>
                  수정{' '}
                  {
                    changes.filter((c) => c.kind === 'VALUE_MODIFIED' || c.kind === 'TYPE_CHANGED')
                      .length
                  }
                </span>
                <span>배열 길이 {changes.filter((c) => c.kind === 'ARRAY_CHANGED').length}</span>
              </div>
              <div className="tool-actions">
                <button disabled={!changes.length} onClick={() => selectChange(changeIndex - 1)}>
                  이전 JSON 변경
                </button>
                <button disabled={!changes.length} onClick={() => selectChange(changeIndex + 1)}>
                  다음 JSON 변경
                </button>
                <label>
                  <input
                    type="checkbox"
                    checked={onlyChanges}
                    onChange={(e) => setOnlyChanges(e.target.checked)}
                  />
                  변경 항목만 보기
                </label>
              </div>
              <ResultList
                items={changes}
                selectedIndex={changeIndex}
                render={(c, i) => (
                  <button
                    key={`${pathText(c.path)}-${c.kind}`}
                    aria-pressed={i === changeIndex}
                    onClick={() => selectChange(i)}
                  >
                    <b>{c.kind}</b>
                    <code>{pathText(c.path)}</code>
                    <span>
                      {c.before === undefined
                        ? '(필드 없음)'
                        : stringify(c.before, 0).slice(0, 120)}{' '}
                      →{' '}
                      {c.after === undefined ? '(필드 없음)' : stringify(c.after, 0).slice(0, 120)}
                    </span>
                  </button>
                )}
              />
              {!changes.length && <p>JSON 구조가 동일합니다.</p>}
              <div className="json-tree-pair">
                <JsonTree
                  value={parsed.value}
                  label="Original JSON 트리"
                  selected={selected}
                  onSelect={setSelected}
                  changedPaths={changedPaths}
                  onlyChanges={onlyChanges}
                />
                <JsonTree
                  value={target.value}
                  label="Modified JSON 트리"
                  selected={selected}
                  onSelect={setSelected}
                  changedPaths={changedPaths}
                  onlyChanges={onlyChanges}
                />
              </div>
            </>
          )}
          {state.tab === 'path' && (
            <>
              <h2>JSONPath Explorer</h2>
              <p>필드·재귀(..)·wildcard·index·slice 지원. 필터와 스크립트는 실행하지 않습니다.</p>
              <div className="tool-actions">
                <input
                  aria-label="JSONPath 표현식"
                  value={expression}
                  onChange={(e) => {
                    setExpression(e.target.value);
                    setPathResults(undefined);
                  }}
                />
                <button
                  onClick={() =>
                    run(() => {
                      setPathResults(queryJson(requireValue(), expression));
                      setPathSource(state.source);
                    })
                  }
                >
                  검색 실행
                </button>
              </div>
              {pathValid && (
                <>
                  <p role="status">{pathResults.length}개 일치</p>
                  <div className="tool-actions">
                    <button onClick={() => void copy(stringify(pathResults.map((r) => r.value)))}>
                      검색 결과 복사
                    </button>
                    <button
                      onClick={() =>
                        downloadText(
                          stringify(pathResults.map((r) => r.value)),
                          'jsonpath-results.json',
                        )
                      }
                    >
                      검색 결과 저장
                    </button>
                  </div>
                  <ResultList
                    items={pathResults}
                    render={(r) => (
                      <button key={r.jsonPath} onClick={() => setSelected(r.path)}>
                        <code>{r.jsonPath}</code>
                        <span>{stringify(r.value, 0).slice(0, 200)}</span>
                      </button>
                    )}
                  />
                </>
              )}
              {parsed.value !== undefined && (
                <JsonTree
                  value={parsed.value}
                  selected={selected}
                  onSelect={setSelected}
                  label="JSONPath 트리"
                />
              )}
            </>
          )}
          {state.tab === 'schema' && (
            <>
              <h2>JSON Schema</h2>
              <p>
                Draft-07 · 샘플 기반 추론 초안입니다. 관찰된 필드만 required로 판단하며 실제 계약을
                검토하세요. format 검증·외부 참조 로딩은 지원하지 않습니다.
              </p>
              <div className="tool-actions">
                <button
                  onClick={() =>
                    run(() => state.set({ schema: stringify(generateSchema(requireValue())) }))
                  }
                >
                  Schema 생성
                </button>
                <button
                  onClick={() =>
                    run(() => {
                      const result = validateSchema(requireValue(), state.schema);
                      setValidation(result.valid ? 'Schema 검증 통과' : result.errors.join('\n'));
                    })
                  }
                >
                  Schema 검증
                </button>
                <label className="upload">
                  Schema 열기
                  <input
                    aria-label="Schema 파일 업로드"
                    type="file"
                    onChange={(e) => {
                      void upload(e.target.files?.[0], 'schema');
                      e.target.value = '';
                    }}
                  />
                </label>
                <button onClick={() => void copy(state.schema)}>Schema 복사</button>
                <button onClick={() => downloadText(state.schema, 'schema.json')}>
                  Schema 저장
                </button>
              </div>
              <textarea
                className="tool-textarea"
                aria-label="JSON Schema 편집"
                value={state.schema}
                onChange={(e) => state.set({ schema: e.target.value })}
              />
              {validation && (
                <pre role="status" className="validation-result">
                  {validation}
                </pre>
              )}
            </>
          )}
          {state.tab === 'types' && (
            <>
              <h2>TypeScript Generator</h2>
              <p>
                샘플 기반 추론 · 배열의 누락 필드는 optional, 혼합 값은 union, 빈 배열은 unknown[].
              </p>
              <div className="tool-actions">
                <label>
                  타입명{' '}
                  <input
                    aria-label="TypeScript 타입명"
                    value={typeName}
                    onChange={(e) => setTypeName(e.target.value)}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={alias}
                    onChange={(e) => setAlias(e.target.checked)}
                  />
                  Type Alias
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={exported}
                    onChange={(e) => setExported(e.target.checked)}
                  />
                  Export
                </label>
                <button
                  onClick={() =>
                    run(() => {
                      setOutput(generateTypes(requireValue(), typeName, alias, exported));
                      setOutputKind('ts');
                    })
                  }
                >
                  타입 생성
                </button>
              </div>
            </>
          )}
          {state.tab === 'csv' && (
            <>
              <h2>JSON ↔ CSV Converter</h2>
              <p>
                타입·중첩 구조의 완벽한 왕복 복원은 보장하지 않습니다. 내보내기 시 수식 시작
                문자열에는 안전 접두사 '를 추가합니다. Flatten 경로는 JSON Pointer입니다.
              </p>
              <div className="tool-actions">
                <select
                  aria-label="CSV 변환 방향"
                  value={direction}
                  onChange={(e) => setDirection(e.target.value)}
                >
                  <option value="toCsv">JSON → CSV</option>
                  <option value="toJson">CSV → JSON</option>
                </select>
                <label>
                  구분자{' '}
                  <select
                    aria-label="CSV 구분자"
                    value={delimiter}
                    onChange={(e) => setDelimiter(e.target.value)}
                  >
                    <option value=",">Comma</option>
                    <option value=";">Semicolon</option>
                    <option value={'\t'}>Tab</option>
                  </select>
                </label>
                {direction === 'toCsv' ? (
                  <label>
                    <input
                      type="checkbox"
                      checked={flatten}
                      onChange={(e) => setFlatten(e.target.checked)}
                    />
                    중첩 Flatten
                  </label>
                ) : (
                  <label>
                    <input
                      type="checkbox"
                      checked={infer}
                      onChange={(e) => setInfer(e.target.checked)}
                    />
                    타입 추론
                  </label>
                )}
              </div>
              {direction === 'toCsv' ? (
                <>
                  <p>컬럼 순서: 선택 순서대로 출력합니다. 전체 해제 시 모든 컬럼을 사용합니다.</p>
                  <div className="csv-columns">
                    {available.map((key) => (
                      <label key={key}>
                        <input
                          type="checkbox"
                          checked={columns.includes(key)}
                          onChange={(e) => {
                            setColumns((prev) =>
                              e.target.checked ? [...prev, key] : prev.filter((k) => k !== key),
                            );
                            setOutput('');
                          }}
                        />
                        {key}
                        {columns.includes(key) ? ` (#${columns.indexOf(key) + 1})` : ''}
                      </label>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <label className="upload">
                    CSV 열기
                    <input
                      type="file"
                      aria-label="CSV 파일 업로드"
                      onChange={(e) => {
                        void upload(e.target.files?.[0], 'csv');
                        e.target.value = '';
                      }}
                    />
                  </label>
                  <textarea
                    aria-label="CSV 입력"
                    className="tool-textarea"
                    value={state.csv}
                    onChange={(e) => state.set({ csv: e.target.value })}
                  />
                </>
              )}
              <button
                onClick={() =>
                  run(() => {
                    setOutput(
                      direction === 'toCsv'
                        ? toCsv(
                            requireValue(),
                            flatten,
                            columns.length ? columns : undefined,
                            delimiter,
                          )
                        : stringify(fromCsv(state.csv, delimiter, infer)),
                    );
                    setOutputKind(direction === 'toCsv' ? 'csv' : 'json');
                  })
                }
              >
                변환 실행
              </button>
            </>
          )}
          {output && (
            <section className="generated-output">
              <div className="tool-actions">
                <button onClick={() => void copy(output)}>결과 복사</button>
                <button onClick={() => downloadText(output, `result.${outputKind}`)}>
                  결과 저장
                </button>
              </div>
              <pre aria-label="생성 결과">{output}</pre>
            </section>
          )}
        </section>
      </div>
    </main>
  );
}
