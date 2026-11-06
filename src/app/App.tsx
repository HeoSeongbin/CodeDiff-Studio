import { useEffect, useRef, useState } from 'react';
import { DiffEditor } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import {
  ArrowDown,
  ArrowUp,
  Braces,
  ChevronRight,
  FileCode2,
  Files,
  GitCompareArrows,
  ShieldCheck,
  Upload,
} from 'lucide-react';
import { useWorkspace } from '../stores/workspace';
import { compareText } from '../core/diff';
import { downloadText } from '../core/export';
import { ChangeDetail } from '../components/ChangeDetail';
import { detectLanguage, languages, lineCount, loadFile, MAX_BYTES } from '../core/file';

export default function App() {
  const state = useWorkspace();
  const [error, setError] = useState('');
  const [compareError, setCompareError] = useState('');
  const [result, setResult] = useState<ReturnType<typeof compareText>>();
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(0);
  const [encoding, setEncoding] = useState('auto');
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState('side');
  const [wrap, setWrap] = useState(false);
  const [changesOnly, setChangesOnly] = useState(false);
  const [context, setContext] = useState(3);
  const [unit, setUnit] = useState<'word' | 'character'>('character');
  const [notice, setNotice] = useState('');
  const uploadVersion = useRef({ original: 0, modified: 0 });
  const diffEditor = useRef<editor.IStandaloneDiffEditor>();
  useEffect(() => {
    setBusy(true);
    setResult(undefined);
    const timer = setTimeout(() => {
      try {
        setResult(compareText(state.original.text, state.modified.text, state.options));
        setCompareError('');
        setActive(0);
      } catch (e) {
        setResult(undefined);
        setCompareError((e as Error).message);
      } finally {
        setBusy(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [state.original.text, state.modified.text, state.options]);
  useEffect(
    () => () => {
      diffEditor.current = undefined;
    },
    [],
  );
  async function upload(side: 'original' | 'modified', file?: File) {
    if (!file) return;
    const version = ++uploadVersion.current[side];
    try {
      const input = await loadFile(file, encoding);
      if (version !== uploadVersion.current[side]) return;
      state.setFile(side, input);
      const codeEditor =
        side === 'original'
          ? diffEditor.current?.getOriginalEditor()
          : diffEditor.current?.getModifiedEditor();
      // setValue detects the uploaded EOL; wrapper executeEdits otherwise retains the previous model EOL.
      codeEditor?.setValue(input.text);
      state.setLanguage(detectLanguage(file.name));
      setError('');
    } catch (e) {
      if (version === uploadVersion.current[side]) setError((e as Error).message);
    }
  }
  function navigate(index: number) {
    if (busy || !result?.hunks.length) return;
    const selected = (index + result.hunks.length) % result.hunks.length;
    setActive(selected);
    const h = result.hunks[selected];
    diffEditor.current?.getOriginalEditor().revealLineInCenter(h.oldStart);
    diffEditor.current?.getModifiedEditor().revealLineInCenter(h.newStart);
    diffEditor.current?.getModifiedEditor().setPosition({ lineNumber: h.newStart, column: 1 });
  }
  return (
    <div className="studio">
      <header>
        <div className="brand">
          <span className="logo">
            <GitCompareArrows size={22} />
          </span>
          <div>
            CodeDiff <strong>Studio</strong>
            <small>CODE COMPARISON WORKSPACE</small>
          </div>
        </div>
        <span className="version">v0.2 / Phase 2</span>
        <div className="privacy">
          <ShieldCheck size={15} /> 브라우저 로컬 처리
        </div>
      </header>
      <div className="shell">
        <aside className="rail">
          <div className="rail-active" title="Code Compare">
            <GitCompareArrows />
          </div>
          <span title="Folder Compare · Phase 6 예정">
            <Files />
          </span>
          <span title="JSON Tools · Phase 3 예정">
            <Braces />
          </span>
          <div className="rail-bottom">CD</div>
        </aside>
        <main>
          <div className="workspace-heading">
            <div>
              <div className="eyebrow">WORKSPACE / CODE COMPARE</div>
              <h1>코드의 차이를, 명확하게.</h1>
              <p>두 파일을 나란히 비교하고 변경된 내용을 확인하세요.</p>
            </div>
            <button
              onClick={() => {
                uploadVersion.current.original++;
                uploadVersion.current.modified++;
                state.sample();
                const current = useWorkspace.getState();
                diffEditor.current?.getOriginalEditor().setValue(current.original.text);
                diffEditor.current?.getModifiedEditor().setValue(current.modified.text);
                setError('');
                setNotice('');
              }}
            >
              <FileCode2 size={15} /> Java 예제 불러오기
            </button>
          </div>
          <section className="comparison" aria-label="코드 비교 작업 영역">
            <div className="comparison-top">
              <span>
                <GitCompareArrows size={17} /> Code Compare{' '}
                <select
                  aria-label="비교 보기"
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                >
                  <option value="side">Side by side</option>
                  <option value="unified">Unified Diff</option>
                </select>
              </span>
              <label>
                언어{' '}
                <select
                  aria-label="언어"
                  value={state.language}
                  onChange={(e) => state.setLanguage(e.target.value)}
                >
                  {[...new Set(Object.values(languages))].sort().map((language) => (
                    <option key={language}>{language}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="inputs">
              {(['original', 'modified'] as const).map((side, i) => (
                <div
                  key={side}
                  className="file-input"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    void upload(side, e.dataTransfer.files[0]);
                  }}
                >
                  <div className="file-label">
                    <span className={side === 'original' ? 'dot old' : 'dot new'} />
                    <b>{i === 0 ? 'ORIGINAL' : 'MODIFIED'}</b>
                    <span>{i === 0 ? '원본' : '수정본'}</span>
                  </div>
                  <div className="file-row">
                    <FileCode2 size={18} />
                    <div>
                      <strong>{state[side].name}</strong>
                      <small>
                        {lineCount(state[side].text)} lines · {state[side].size.toLocaleString()} B
                        업로드 · {state[side].encoding}
                      </small>
                    </div>
                    <label className="upload">
                      <Upload size={14} /> 파일 열기
                      <input
                        aria-label={i === 0 ? 'Original 파일 업로드' : 'Modified 파일 업로드'}
                        type="file"
                        onChange={(e) => {
                          void upload(side, e.target.files?.[0]);
                          e.target.value = '';
                        }}
                      />
                    </label>
                    <button
                      aria-label={i === 0 ? 'Original 코드 다운로드' : 'Modified 코드 다운로드'}
                      onClick={() => downloadText(state[side].text, state[side].name)}
                    >
                      저장 (UTF-8)
                    </button>
                    <button
                      aria-label={i === 0 ? 'Original 코드 복사' : 'Modified 코드 복사'}
                      onClick={() => {
                        void navigator.clipboard.writeText(state[side].text).then(
                          () => setNotice('코드를 복사했습니다.'),
                          () =>
                            setNotice(
                              '클립보드 복사에 실패했습니다. 편집기에서 선택 복사를 사용하세요.',
                            ),
                        );
                      }}
                    >
                      복사
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div className="options">
              <span className="option-title">비교 옵션</span>
              {(
                [
                  { key: 'ignoreWhitespace', label: '공백 무시' },
                  { key: 'ignoreTrailingWhitespace', label: '줄 끝 공백 무시' },
                  { key: 'ignoreBlankLines', label: '빈 줄 무시' },
                  { key: 'ignoreCase', label: '대소문자 무시' },
                  { key: 'ignoreEol', label: '줄바꿈 형식 무시' },
                ] as const
              ).map((option) => (
                <label key={option.key}>
                  <input
                    type="checkbox"
                    checked={!!state.options[option.key]}
                    onChange={(e) =>
                      state.setOptions({ ...state.options, [option.key]: e.target.checked })
                    }
                  />
                  {option.label}
                </label>
              ))}
              <label className="encoding">
                인코딩{' '}
                <select
                  aria-label="업로드 인코딩"
                  value={encoding}
                  onChange={(e) => setEncoding(e.target.value)}
                >
                  <option value="auto">자동 감지</option>
                  <option value="utf-8">UTF-8</option>
                  <option value="utf-16le">UTF-16 LE</option>
                  <option value="utf-16be">UTF-16 BE</option>
                </select>
              </label>
            </div>
            <div className="options view-options">
              <label>
                <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} />
                자동 줄바꿈
              </label>

              <label>
                <input
                  type="checkbox"
                  checked={changesOnly}
                  onChange={(e) => setChangesOnly(e.target.checked)}
                />
                변경 영역만 보기
              </label>
              <label>
                문맥 줄{' '}
                <select
                  aria-label="문맥 줄"
                  value={context}
                  onChange={(e) => setContext(Number(e.target.value))}
                >
                  {[0, 3, 5, 10].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                상세 단위{' '}
                <select
                  aria-label="상세 비교 단위"
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as 'word' | 'character')}
                >
                  <option value="character">문자</option>
                  <option value="word">단어</option>
                </select>
              </label>
            </div>
            {notice && (
              <div role="status" className="notice">
                {notice}
              </div>
            )}
            {(error || compareError) && (
              <div role="alert" className="error">
                {error || compareError}
              </div>
            )}
            <div className="editor-area">
              <DiffEditor
                height="100%"
                language={state.language}
                original={state.original.text}
                modified={state.modified.text}
                theme="vs-dark"
                loading={<div className="loading">로컬 코드 에디터를 준비하고 있습니다…</div>}
                options={{
                  originalEditable: true,
                  readOnly: false,
                  renderSideBySide: mode === 'side',
                  useInlineViewWhenSpaceIsLimited: false,
                  hideUnchangedRegions: {
                    enabled: changesOnly,
                    contextLineCount: context,
                    minimumLineCount: 1,
                    revealLineCount: context || 1,
                  },
                  automaticLayout: true,
                  fontSize: 13,
                  lineHeight: 23,
                  minimap: { enabled: false },
                  scrollBeyondLastLine: false,
                  ignoreTrimWhitespace: !!(
                    state.options.ignoreWhitespace || state.options.ignoreTrailingWhitespace
                  ),
                  renderOverviewRuler: true,
                  padding: { top: 16 },
                  diffWordWrap: wrap ? 'on' : 'off',
                  wordWrap: wrap ? 'on' : 'off',
                }}
                onMount={(editor) => {
                  diffEditor.current = editor;
                  setReady(true);
                  const subscriptions = [
                    editor.getOriginalEditor().onDidChangeModelContent((event) => {
                      if (
                        event.isFlush ||
                        (event.changes.length === 1 &&
                          event.changes[0].text === useWorkspace.getState().original.text)
                      )
                        return;
                      const value = editor.getOriginalEditor().getValue();
                      if (new TextEncoder().encode(value).length <= MAX_BYTES)
                        useWorkspace.getState().setText('original', value);
                      else {
                        editor.getOriginalEditor().setValue(useWorkspace.getState().original.text);
                        setError('편집 텍스트 제한은 UTF-8 기준 5 MiB입니다.');
                      }
                    }),
                    editor.getModifiedEditor().onDidChangeModelContent((event) => {
                      if (
                        event.isFlush ||
                        (event.changes.length === 1 &&
                          event.changes[0].text === useWorkspace.getState().modified.text)
                      )
                        return;
                      const value = editor.getModifiedEditor().getValue();
                      if (new TextEncoder().encode(value).length <= MAX_BYTES)
                        useWorkspace.getState().setText('modified', value);
                      else {
                        editor.getModifiedEditor().setValue(useWorkspace.getState().modified.text);
                        setError('편집 텍스트 제한은 UTF-8 기준 5 MiB입니다.');
                      }
                    }),
                  ];
                  editor.onDidDispose(() => subscriptions.forEach((s) => s.dispose()));
                }}
              />
            </div>
            <div className="editor-footer">
              <span>
                <span className="status-dot" />
                {error || compareError
                  ? '비교 불가능'
                  : busy
                    ? '비교 중'
                    : result?.hunks.length
                      ? '비교 완료'
                      : '파일 동일'}
              </span>
              <span>
                {mode === 'side'
                  ? '양쪽 코드 직접 편집 가능'
                  : 'Unified: 수정본 편집 가능 · 원본은 좌우 보기에서 편집'}
              </span>
              <span>{ready ? 'Monaco ready' : 'Loading editor'} · UTF · 최대 5 MiB</span>
            </div>
          </section>
          <div className="note">
            <ShieldCheck size={14} /> 파일은 기기에서만 처리되며 서버로 전송되지 않습니다.
            <span>텍스트 비교 · Phase 2</span>
          </div>
        </main>
        <aside className="changes">
          <div className="changes-title">
            변경 분석<span className="live">LIVE</span>
          </div>
          <p>파일 사이의 변경사항을 확인하세요.</p>
          <div className="stats">
            <div>
              <span className="green">+{result?.added ?? 0}</span>
              <small>추가된 줄</small>
            </div>
            <div>
              <span className="red">−{result?.removed ?? 0}</span>
              <small>삭제된 줄</small>
            </div>
          </div>
          <div className="summary">
            <span>변경 블록</span>
            <b>{result?.hunks.length ?? 0}</b>
          </div>
          <div className="summary">
            <span>계산 시간</span>
            <b>{result?.duration.toFixed(1) ?? '—'} ms</b>
          </div>
          <div className="summary">
            <span>변경 파일</span>
            <b>{result ? (result.hunks.length ? 1 : 0) : '—'} / 1</b>
          </div>
          <div className="summary">
            <span>총 비교 줄 수</span>
            <b>{result?.totalLines ?? '—'}</b>
          </div>
          <div className="change-heading">
            <span>변경 목록</span>
            <div>
              <button
                aria-label="이전 변경"
                disabled={busy || !result?.hunks.length}
                onClick={() => navigate(active - 1)}
              >
                <ArrowUp size={15} />
              </button>
              <button
                aria-label="다음 변경"
                disabled={busy || !result?.hunks.length}
                onClick={() => navigate(active + 1)}
              >
                <ArrowDown size={15} />
              </button>
            </div>
          </div>
          <div className="change-list">
            {result?.hunks.map((h, i) => (
              <button
                key={h.id}
                className={`change ${active === i ? 'selected' : ''}`}
                onClick={() => navigate(i)}
              >
                <div>
                  <span className={`change-kind ${h.kind}`}>
                    {h.kind === 'modified' ? '수정 추정' : h.kind === 'added' ? '추가' : '삭제'}
                  </span>
                  <span>
                    #{i + 1}
                    <ChevronRight size={13} />
                  </span>
                </div>
                <strong>
                  원본{' '}
                  {h.oldLines
                    ? `${h.oldStart}${h.oldLines > 1 ? `–${h.oldEnd}` : ''}`
                    : `없음 (위치 ${h.oldStart})`}{' '}
                  → 수정{' '}
                  {h.newLines
                    ? `${h.newStart}${h.newLines > 1 ? `–${h.newEnd}` : ''}`
                    : `없음 (위치 ${h.newStart})`}
                </strong>
                <code>{h.lines[0]?.content.trim()}</code>
              </button>
            ))}
          </div>
          {!busy && result && !result.hunks.length && <p>선택한 비교 옵션에서 차이가 없습니다.</p>}
          {result?.hunks[active] && <ChangeDetail hunk={result.hunks[active]} unit={unit} />}
          <div className="analysis-note">
            <b>비교 결과 안내</b>
            <p>
              추가·삭제는 Diff 연산 결과입니다. ‘수정 추정’은 같은 변경 블록의 삭제와 추가를 묶은
              판정입니다.
            </p>
            <p>
              옵션은 분석 목록에 적용됩니다. 변경 상세는 원문 차이를 보여줍니다. Monaco 강조와 변경
              영역 접기는 자체 알고리즘을 사용하며 공백·빈 줄·대소문자·줄바꿈 옵션과 다를 수
              있습니다.
            </p>
          </div>
        </aside>
      </div>
      <footer>
        <span>CodeDiff Studio</span>
        <span>
          로컬 워크스페이스 <span className="status-dot" />
        </span>
      </footer>
    </div>
  );
}
