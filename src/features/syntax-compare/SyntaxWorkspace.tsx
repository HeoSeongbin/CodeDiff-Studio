import { useRef, useState } from 'react';
import type { editor } from 'monaco-editor';
import { ManagedDiffEditor as DiffEditor } from '../../components/ManagedDiffEditor';
import { useWorkspace } from '../../stores/workspace';
import {
  compareSyntax,
  syntaxLanguages,
  type SyntaxLanguage,
  type SyntaxResult,
} from '../../core/syntax/compare';
import { loadSyntaxLanguage } from '../../core/syntax/browser';
import { ResultList } from '../json-tools/ResultList';
export default function SyntaxWorkspace() {
  const { original, modified, language } = useWorkspace();
  const [choice, setChoice] = useState('auto');
  const selected = choice === 'auto' ? language : choice;
  const supported = syntaxLanguages.includes(selected as SyntaxLanguage);
  const [state, setState] = useState<{
    before: string;
    after: string;
    language: string;
    result?: SyntaxResult;
    error?: string;
  }>();
  const [busy, setBusy] = useState(false);
  const generation = useRef(0);
  const diff = useRef<editor.IStandaloneDiffEditor>();
  const current =
    state?.before === original.text && state.after === modified.text && state.language === selected;
  async function run() {
    const version = ++generation.current;
    const snapshot = { before: original.text, after: modified.text, language: selected };
    setBusy(true);
    try {
      const grammar = await loadSyntaxLanguage(selected as SyntaxLanguage);
      const result = compareSyntax(
        snapshot.before,
        snapshot.after,
        grammar,
        selected as SyntaxLanguage,
      );
      if (version === generation.current) setState({ ...snapshot, result });
    } catch (error) {
      if (version === generation.current)
        setState({ ...snapshot, error: error instanceof Error ? error.message : '구문 분석 실패' });
    } finally {
      if (version === generation.current) setBusy(false);
    }
  }
  return (
    <main className="syntax-workspace">
      <h1>Syntax Compare</h1>
      <p>
        Code Compare의 현재 원문을 로컬 WASM으로 분석합니다. 클래스·함수·메서드·import의 선언과
        본문을 비교하며 의미적 동등성이나 이동을 판정하지 않습니다.
      </p>
      <label>
        구문 언어{' '}
        <select value={choice} onChange={(e) => setChoice(e.target.value)}>
          <option value="auto">자동 ({language})</option>
          {syntaxLanguages.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </label>{' '}
      <button disabled={!supported || busy} onClick={run}>
        {busy ? '분석 중…' : '구문 비교 실행'}
      </button>
      <p>
        공백·주석만의 변경은 AST 목록에서 제외됩니다. 화살표 함수 변수·익명 함수·TSX는 지원 범위
        밖이며 Text Diff에서 확인하세요. 클래스 본문 변경과 내부 메서드 변경은 각각 표시됩니다.
      </p>
      {!supported && <p role="status">지원하지 않는 언어입니다. 아래 Text Diff를 사용하세요.</p>}
      {state && !current && <p role="status">입력 또는 언어가 변경되었습니다. 다시 분석하세요.</p>}
      {current && state?.error && <p role="alert">{state.error}</p>}
      {current && state?.result && (
        <section aria-label="구문 비교 결과">
          <h2>구문 변경 {state.result.changes.length}건</h2>
          <p>
            원본 요소 {state.result.beforeCount}개 / 수정본 요소 {state.result.afterCount}개
          </p>
          <ResultList
            items={state.result.changes}
            render={(change, index) => (
              <button
                key={index}
                className="syntax-change"
                onClick={() => {
                  if (change.before)
                    diff.current?.getOriginalEditor().revealLineInCenter(change.before.line);
                  if (change.after)
                    diff.current?.getModifiedEditor().revealLineInCenter(change.after.line);
                }}
              >
                <strong>
                  {
                    {
                      added: '추가',
                      removed: '삭제',
                      changed: '변경',
                      'rename-candidate': '이름 변경 후보',
                    }[change.type]
                  }{' '}
                  · {(change.after ?? change.before)!.kind} · {change.before?.name}
                  {change.before && change.after && change.before.name !== change.after.name
                    ? ' → '
                    : ''}
                  {!change.before || change.before.name !== change.after?.name
                    ? change.after?.name
                    : ''}
                </strong>
                <span>
                  원본 {change.before?.line ?? '—'}행 → 수정본 {change.after?.line ?? '—'}행 ·{' '}
                  {change.details.join(', ')}
                </span>
              </button>
            )}
          />
        </section>
      )}
      <h2>
        Text Diff · {original.name} / {modified.name}
      </h2>
      <DiffEditor
        height="480px"
        language={language}
        original={original.text}
        modified={modified.text}
        theme="vs-dark"
        options={{
          readOnly: true,
          originalEditable: false,
          automaticLayout: true,
          minimap: { enabled: false },
        }}
        onMount={(instance) => {
          diff.current = instance;
        }}
      />
    </main>
  );
}
