import { useNarrowScreen } from '../../hooks/useNarrowScreen';
import { useCompute } from '../../hooks/useCompute';
import { usePreferences } from '../../stores/preferences';
import { useEffect, useMemo, useRef, useState } from 'react';
import Editor from '@monaco-editor/react';
import { useMappingWorkspace } from '../../stores/mappingWorkspace';
import { type Segment, pathText, stringify, JSON_MAX_BYTES } from '../../core/json/value';
import { type MappingRule, importMappingRules } from '../../core/mapping/engine';
import { JsonTree } from '../json-tools/JsonTree';
import { loadFile } from '../../core/file';
import { downloadText } from '../../core/export';
export default function MappingWorkspace() {
  const state = useMappingWorkspace();
  const [selected, setSelected] = useState<Segment[]>([]),
    [active, setActive] = useState(state.rules[0]?.id ?? ''),
    [targetSelected, setTargetSelected] = useState<Segment[]>([]),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [importText, setImportText] = useState(''),
    [showImport, setShowImport] = useState(false);
  const uploadVersion = useRef({ source: 0, rules: 0 });
  const prefs = usePreferences();
  const narrow = useNarrowScreen();
  const job = useMemo(
    () => ({ kind: 'mapping' as const, source: state.source, rules: state.rules }),
    [state.source, state.rules],
  );
  const computation = useCompute(job);
  const parsed = computation.result?.parsed ?? { value: undefined, error: computation.error };
  const result = computation.result?.result;
  const busy = computation.busy;
  useEffect(() => {
    if (!state.rules.some((r) => r.id === active)) setActive(state.rules[0]?.id ?? '');
  }, [state.rules, active]);
  const output = result?.value !== undefined ? stringify(result.value) : undefined;
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice('복사했습니다.');
    } catch {
      setError('클립보드 복사에 실패했습니다.');
    }
  }
  function run(action: () => void) {
    setError('');
    setNotice('');
    try {
      action();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function exportRules() {
    if (computation.result?.exportError) throw new Error(computation.result.exportError);
    if (!computation.result?.exportedRules) throw new Error('규칙 분석을 완료한 뒤 내보내세요.');
    return computation.result.exportedRules;
  }
  function importRules(text: string) {
    const rules = importMappingRules(text);
    state.replace(rules);
    setActive(rules[0]?.id ?? '');
    setNotice(`규칙 ${rules.length}개를 가져왔습니다.`);
  }
  async function upload(file: File | undefined, kind: 'source' | 'rules') {
    if (!file) return;
    const version = ++uploadVersion.current[kind];
    setError('');
    try {
      if (file.size > JSON_MAX_BYTES) throw new Error('입력 파일 제한은 1 MiB입니다.');
      const loaded = await loadFile(file);
      if (version !== uploadVersion.current[kind]) return;
      if (kind === 'source') state.setSource(loaded.text);
      else importRules(loaded.text);
    } catch (e) {
      if (version === uploadVersion.current[kind]) setError((e as Error).message);
    }
  }
  function add() {
    const id = state.add(pathText(selected));
    if (!id) setError('규칙 제한은 100개입니다.');
    else {
      setActive(id);
      setError('');
    }
  }
  return (
    <main className="mapping-workspace">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">WORKSPACE / FIELD MAPPING</div>
          <h1>필드를 연결하고, 데이터를 변환하세요.</h1>
          <p>Source → Mapping Rules → Target · 로컬 처리 · 입력 불변</p>
        </div>
        <button
          onClick={() => {
            uploadVersion.current.source++;
            uploadVersion.current.rules++;
            state.sample();
            setSelected([]);
            setActive('account-id');
            setError('');
            setImportText('');
          }}
        >
          매핑 예제 불러오기
        </button>
      </div>
      <div className="mapping-policy">
        <b>경로 안내</b>
        <p>
          $.user.name / $["특수.키"] / $.items[0] / $.items[*].id → $.rows[*].id · [*]는 양쪽에 한
          번씩 사용합니다. 없는 필드는 오류가 기본이며, 기본값 또는 제외를 선택할 수 있습니다.
          null은 필드 부재와 구분합니다.
        </p>
        <p>
          중복·부모/자식 경로와 객체/배열 충돌은 허용하지 않습니다. 오류가 있으면 전체 Target 생성을
          중단합니다.
        </p>
      </div>
      {error && (
        <div role="alert" className="error mapping-import-error">
          {error}
        </div>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <div className="mapping-grid">
        <section className="mapping-panel mapping-source">
          <div className="tool-heading">
            <h2>Source JSON</h2>
            <label className="upload">
              Source 열기
              <input
                aria-label="Mapping Source 파일 업로드"
                type="file"
                onChange={(e) => {
                  void upload(e.target.files?.[0], 'source');
                  e.target.value = '';
                }}
              />
            </label>
            <button onClick={() => downloadText(state.source, 'mapping-source.json')}>
              Source 저장
            </button>
          </div>
          <div className="mapping-editor">
            <Editor
              height="100%"
              language="json"
              theme={prefs.theme === 'dark' ? 'vs-dark' : 'vs'}
              value={state.source}
              onChange={(v) => state.setSource(v ?? '')}
              options={{
                ariaLabel: 'Mapping Source 편집기',
                automaticLayout: true,
                minimap: { enabled: prefs.minimap && !narrow },
                wordWrap: 'on',
                fontSize: 12,
              }}
            />
          </div>
          {busy ? (
            <p role="status">JSON·매핑 분석 중…</p>
          ) : parsed.error ? (
            <p role="alert" className="mapping-source-error">
              {parsed.error}
            </p>
          ) : (
            <p className="json-valid">유효한 표준 JSON</p>
          )}
          <div className="source-path-selection">
            <code aria-label="선택한 Source Path">{pathText(selected)}</code>
            <button
              disabled={!state.rules.some((r) => r.id === active)}
              onClick={() => state.update(active, { sourcePath: pathText(selected) })}
            >
              선택 경로를 규칙에 적용
            </button>
            <button onClick={add}>선택 경로로 규칙 추가</button>
          </div>
          {parsed.value !== undefined && (
            <JsonTree
              value={parsed.value}
              selected={selected}
              onSelect={setSelected}
              label="Mapping Source 트리"
            />
          )}
        </section>
        <section className="mapping-panel">
          <div className="tool-heading">
            <h2>
              Mapping Rules <small>({state.rules.length}/100)</small>
            </h2>
            <button onClick={add}>규칙 추가</button>
          </div>
          <div className="tool-actions">
            <label className="upload">
              규칙 파일 열기
              <input
                aria-label="매핑 규칙 파일 업로드"
                type="file"
                onChange={(e) => {
                  void upload(e.target.files?.[0], 'rules');
                  e.target.value = '';
                }}
              />
            </label>
            <button
              disabled={busy}
              onClick={() => run(() => downloadText(exportRules(), 'mapping-rules.json'))}
            >
              규칙 내보내기
            </button>
            <button
              disabled={busy}
              onClick={() =>
                run(() => {
                  void copy(exportRules());
                })
              }
            >
              규칙 복사
            </button>
            <button aria-expanded={showImport} onClick={() => setShowImport((v) => !v)}>
              규칙 JSON 가져오기
            </button>
          </div>
          {showImport && (
            <div className="rule-import">
              <textarea
                aria-label="매핑 규칙 JSON"
                className="tool-textarea"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <button
                onClick={() =>
                  run(() => {
                    uploadVersion.current.rules++;
                    importRules(importText);
                  })
                }
              >
                가져오기 적용
              </button>
              <p>
                version: 1 문서 또는 MappingRule 배열을 지원합니다. 실패한 가져오기는 기존 규칙을
                바꾸지 않습니다.
              </p>
            </div>
          )}
          <div className="mapping-rule-list">
            {state.rules.map((rule, i) => {
              const issues = result?.errors.filter((e) => e.ruleId === rule.id) ?? [];
              return (
                <article
                  key={rule.id}
                  className={`mapping-rule ${active === rule.id ? 'active' : ''}`}
                  aria-label={`매핑 규칙 ${i + 1}`}
                >
                  <div className="mapping-rule-heading">
                    <button aria-pressed={active === rule.id} onClick={() => setActive(rule.id)}>
                      규칙 {i + 1} 선택
                    </button>
                    <label>
                      <input
                        aria-label={`규칙 ${i + 1} 적용`}
                        type="checkbox"
                        checked={rule.enabled !== false}
                        onChange={(e) => state.update(rule.id, { enabled: e.target.checked })}
                      />
                      적용
                    </label>
                    <button aria-label={`규칙 ${i + 1} 삭제`} onClick={() => state.remove(rule.id)}>
                      삭제
                    </button>
                  </div>
                  <small className="rule-id">{rule.id}</small>
                  <label>
                    Source Path
                    <input
                      aria-label={`규칙 ${i + 1} Source Path`}
                      value={rule.sourcePath ?? ''}
                      onChange={(e) => state.update(rule.id, { sourcePath: e.target.value })}
                    />
                  </label>
                  <label>
                    Target Path
                    <input
                      aria-label={`규칙 ${i + 1} Target Path`}
                      value={rule.targetPath}
                      onChange={(e) => state.update(rule.id, { targetPath: e.target.value })}
                    />
                  </label>
                  <div className="mapping-rule-options">
                    <label>
                      변환
                      <select
                        aria-label={`규칙 ${i + 1} 변환`}
                        value={rule.transform}
                        onChange={(e) =>
                          state.update(rule.id, {
                            transform: e.target.value as MappingRule['transform'],
                          })
                        }
                      >
                        {['copy', 'string', 'number', 'boolean', 'date', 'constant'].map((type) => (
                          <option key={type}>{type}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      누락 시
                      <select
                        aria-label={`규칙 ${i + 1} 누락 처리`}
                        value={rule.onMissing ?? 'error'}
                        onChange={(e) =>
                          state.update(rule.id, { onMissing: e.target.value as 'error' | 'skip' })
                        }
                      >
                        <option value="error">오류</option>
                        <option value="skip">제외</option>
                      </select>
                    </label>
                  </div>
                  {rule.transform === 'constant' && (
                    <label>
                      상수 (JSON)
                      <textarea
                        aria-label={`규칙 ${i + 1} 상수 JSON`}
                        value={rule.constantText}
                        onChange={(e) => state.update(rule.id, { constantText: e.target.value })}
                      />
                    </label>
                  )}
                  {rule.transform !== 'constant' && (
                    <>
                      <label className="default-toggle">
                        <input
                          aria-label={`규칙 ${i + 1} 기본값 사용`}
                          type="checkbox"
                          checked={rule.useDefault}
                          onChange={(e) => state.update(rule.id, { useDefault: e.target.checked })}
                        />
                        누락 필드 기본값 사용
                      </label>
                      {rule.useDefault && (
                        <label>
                          기본값 (JSON)
                          <textarea
                            aria-label={`규칙 ${i + 1} 기본값 JSON`}
                            value={rule.defaultText}
                            onChange={(e) => state.update(rule.id, { defaultText: e.target.value })}
                          />
                        </label>
                      )}
                    </>
                  )}
                  {rule.enabled === false && (
                    <p>이 규칙은 결과에서 제외됩니다. 경로 형식·위험 속성은 계속 검증합니다.</p>
                  )}
                  {issues.map((issue, index) => (
                    <p role="alert" className="mapping-rule-error" key={index}>
                      {issue.message}
                    </p>
                  ))}
                </article>
              );
            })}
            {!state.rules.length && (
              <p>
                규칙이 없으므로 빈 객체를 생성합니다. Source에서 필드를 선택하고 규칙을 추가하세요.
              </p>
            )}
          </div>
          <details className="mapping-help">
            <summary>변환과 배열 정책</summary>
            <p>
              copy는 JSON 값을 복사합니다. string은 null 이외 원시 값만 지원합니다. number는 엄격한
              10진 문자열·숫자, boolean은 true/false·0/1과 같은 문자열만 지원합니다. date는
              YYYY-MM-DD 또는 UTC ISO 시각(Z)을 UTC 문자열로 출력합니다.
            </p>
            <p>
              기본값은 필드가 없을 때만 적용하며 null은 그대로 값으로 취급합니다. 기본값에도 선택한
              변환이 적용됩니다. 배열은 전체 copy, 인덱스, 한 단계 [*] 매핑을 지원합니다. 빈 배열은
              []를 유지하며 건너뛰기로 인덱스 구멍이 생기면 오류입니다.
            </p>
          </details>
        </section>
        <section className="mapping-panel mapping-target">
          <div className="tool-heading">
            <h2>Target Preview</h2>
            <button
              disabled={busy || output === undefined}
              onClick={() => output !== undefined && void copy(output)}
            >
              Target 복사
            </button>
            <button
              disabled={busy || output === undefined}
              onClick={() => output !== undefined && downloadText(output, 'mapped-target.json')}
            >
              Target 저장
            </button>
          </div>
          <p role="status" className="mapping-status">
            {busy
              ? '매핑 계산 중'
              : result?.errors.length
                ? '매핑 오류: 결과 없음'
                : `매핑 완료 · 쓰기 ${result?.applied ?? 0} · 누락 제외 ${result?.skipped ?? 0} · 규칙 제외 ${result?.excluded ?? 0}`}
          </p>
          {result?.errors.length ? (
            <div className="mapping-errors" role="alert">
              <b>{result.errors.length}개 오류 · 부분 결과는 저장할 수 없습니다.</b>
              {result.errors.map((issue, i) => (
                <p key={i}>
                  {issue.ruleId ? `[${issue.ruleId}] ` : ''}
                  {issue.message}
                </p>
              ))}
            </div>
          ) : null}
          {output !== undefined && (
            <>
              <pre aria-label="매핑 Target JSON" className="mapping-output">
                {output}
              </pre>
              <JsonTree
                value={result!.value!}
                label="Mapping Target 트리"
                selected={targetSelected}
                onSelect={setTargetSelected}
              />
            </>
          )}
          {busy && (
            <p role="status">
              입력과 규칙 변경 후 로컬 Worker에서 계산합니다.
              <button onClick={computation.cancel}>매핑 취소</button>
            </p>
          )}
          {(computation.cancelled || computation.error) && (
            <p role="status">
              {computation.error || '매핑이 취소되었습니다.'}
              <button onClick={computation.retry}>매핑 다시 계산</button>
            </p>
          )}
          <p>
            최대 입력/출력 1 MiB · 값 30,000개 · 깊이 80 · Target은 새로운 JSON이며 Source를
            변경하지 않습니다.
          </p>
        </section>
      </div>
    </main>
  );
}
