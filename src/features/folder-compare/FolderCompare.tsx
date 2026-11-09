import { useNarrowScreen } from '../../hooks/useNarrowScreen';
import { useComputeClient, WorkspaceActive } from '../../hooks/useCompute';
import { usePreferences } from '../../stores/preferences';
import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ManagedDiffEditor as DiffEditor } from '../../components/ManagedDiffEditor';
import { useFolderWorkspace } from '../../stores/folderWorkspace';
import {
  type FolderResult,
  type FolderSelection,
  type FolderOptions,
  browserFolder,
  compareFolders,
  DEFAULT_EXCLUDES,
  exportFolderReport,
} from '../../core/folder/engine';
import { folderTree } from '../../core/folder/tree';
import { detectLanguage } from '../../core/file';
import { downloadText } from '../../core/export';
import { useWorkspace } from '../../stores/workspace';
const statusLabel = {
  ADDED_FILE: '추가',
  REMOVED_FILE: '삭제',
  MODIFIED_FILE: '수정',
  UNCHANGED_FILE: '동일',
  ERROR_FILE: '오류',
};
export default function FolderCompare({ onCompare }: { onCompare: () => void }) {
  const state = useFolderWorkspace();
  const client = useComputeClient();
  const activeWorkspace = useContext(WorkspaceActive);
  const prefs = usePreferences();
  const narrow = useNarrowScreen();
  const [excludeText, setExcludeText] = useState(state.options.excludes.join(',')),
    [extensionText, setExtensionText] = useState(state.options.extensions.join(','));
  const [snapshot, setSnapshot] = useState<{
      original: FolderSelection;
      modified: FolderSelection;
      options: FolderOptions;
      result: FolderResult;
    }>(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [progress, setProgress] = useState({ done: 0, total: 0 }),
    [selected, setSelected] = useState(''),
    [search, setSearch] = useState(''),
    [onlyChanged, setOnlyChanged] = useState(false),
    [kind, setKind] = useState('all'),
    [collapsed, setCollapsed] = useState<Set<string>>(new Set()),
    [scroll, setScroll] = useState(0),
    [sideBySide, setSideBySide] = useState(true);
  const controller = useRef<AbortController>(),
    request = useRef(0),
    treeView = useRef<HTMLDivElement>(null);
  useEffect(() => setSideBySide(!narrow), [narrow]);
  useEffect(() => {
    if (!activeWorkspace) {
      ++request.current;
      controller.current?.abort();
      setBusy(false);
    }
  }, [activeWorkspace]);
  const result =
    snapshot?.original === state.original &&
    snapshot?.modified === state.modified &&
    snapshot?.options === state.options
      ? snapshot?.result
      : undefined;
  useEffect(() => {
    request.current++;
    controller.current?.abort();
    setSnapshot(undefined);
    setBusy(false);
    setError('');
    return () => {
      request.current++;
      controller.current?.abort();
    };
  }, [state.original, state.modified, state.options]);
  const filtered = useMemo(
    () =>
      result?.rows.filter(
        (row) =>
          (!onlyChanged || row.status !== 'UNCHANGED_FILE') &&
          (kind === 'all' || kind === row.kind) &&
          row.path.toLowerCase().includes(search.toLowerCase()),
      ) ?? [],
    [result, onlyChanged, kind, search],
  );
  const tree = useMemo(() => folderTree(filtered, collapsed), [filtered, collapsed]);
  useEffect(() => {
    if (!filtered.some((row) => row.path === selected)) setSelected(filtered[0]?.path ?? '');
  }, [filtered, selected]);
  useEffect(() => {
    setScroll(0);
    if (treeView.current) treeView.current.scrollTop = 0;
  }, [result, search, onlyChanged, kind, collapsed]);
  const row = result?.rows.find((file) => file.path === selected),
    canDiff = !!row && row.kind === 'text' && row.status !== 'ERROR_FILE';
  function choose(side: 'original' | 'modified', files: FileList | null) {
    if (!files) return;
    try {
      state.setFolder(side, browserFolder(Array.from(files)));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function compare() {
    if (!state.original || !state.modified) return;
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    const version = ++request.current;
    setBusy(true);
    setSnapshot(undefined);
    setError('');
    setSelected('');
    try {
      const value = await compareFolders(state.original, state.modified, state.options, {
        signal: abort.signal,
        compare: (original, modified, options) =>
          client.run({ kind: 'text', original, modified, options }, { signal: abort.signal }),
        onProgress: (done, total) => {
          if (version === request.current) setProgress({ done, total });
        },
      });
      if (version === request.current) {
        setSnapshot({
          original: state.original,
          modified: state.modified,
          options: state.options,
          result: value,
        });
        setSelected(
          value.rows.find((file) => file.status !== 'UNCHANGED_FILE')?.path ??
            value.rows[0]?.path ??
            '',
        );
        setCollapsed(new Set());
      }
    } catch (e) {
      if (version === request.current) setError((e as Error).message);
    } finally {
      if (version === request.current) setBusy(false);
    }
  }
  function openCode() {
    if (!row || !canDiff) return;
    const workspace = useWorkspace.getState();
    for (const side of ['original', 'modified'] as const) {
      const file = row[side];
      workspace.setFile(side, {
        name: file?.path ?? row.path,
        text: file?.text ?? '',
        encoding: file?.encoding ?? 'utf-8',
        size: file?.size ?? 0,
      });
    }
    workspace.setLanguage(detectLanguage(row.path));
    workspace.setOptions({
      ...workspace.options,
      ignoreWhitespace: state.options.ignoreWhitespace,
      ignoreEol: false,
      ignoreCase: false,
      ignoreBlankLines: false,
      ignoreTrailingWhitespace: false,
    });
    onCompare();
  }
  const start = Math.max(0, Math.floor(scroll / 34) - 5);
  return (
    <main className="folder-workspace">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">WORKSPACE / FOLDER COMPARE</div>
          <h1>두 프로젝트의 변경사항을 한눈에.</h1>
          <p>상대 경로로 파일 매칭 · Rename 추정 없음 · 로컬 읽기 전용</p>
        </div>
        <button onClick={compare} disabled={busy || !state.original || !state.modified}>
          {busy ? '폴더 비교 중…' : '폴더 비교 실행'}
        </button>
      </div>
      <section className="folder-setup">
        <div className="folder-pickers">
          {(['original', 'modified'] as const).map((side, i) => (
            <div key={side}>
              <span>{i === 0 ? 'ORIGINAL' : 'MODIFIED'} FOLDER</span>
              <b>{state[side]?.name ?? '선택한 폴더 없음'}</b>
              <small>
                {state[side]?.files.length.toLocaleString() ?? 0}개 파일 메타데이터 · 선택 루트 이름
                제외
              </small>
              <div className="tool-actions">
                <label className="upload">
                  폴더 선택
                  <input
                    ref={(input) => input?.setAttribute('webkitdirectory', '')}
                    type="file"
                    multiple
                    aria-label={i === 0 ? 'Original 폴더 선택' : 'Modified 폴더 선택'}
                    onChange={(e) => {
                      choose(side, e.target.files);
                      e.target.value = '';
                    }}
                  />
                </label>
                <button onClick={() => state.setFolder(side, { name: '(빈 폴더)', files: [] })}>
                  {' '}
                  {i === 0 ? 'Original' : 'Modified'} 빈 폴더로 설정
                </button>
              </div>
            </div>
          ))}
        </div>
        <div className="folder-options">
          <label>
            제외 디렉터리 (이름 또는 루트 기준 경로, comma 구분)
            <input
              aria-label="제외 디렉터리"
              value={excludeText}
              onChange={(e) => {
                setExcludeText(e.target.value);
                state.setOptions({
                  ...state.options,
                  excludes: e.target.value
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean),
                });
              }}
            />
          </label>
          <button
            onClick={() => {
              setExcludeText(DEFAULT_EXCLUDES.join(','));
              state.setOptions({ ...state.options, excludes: [...DEFAULT_EXCLUDES] });
            }}
          >
            기본 제외 복원
          </button>
          <label>
            확장자 필터
            <input
              aria-label="폴더 확장자 필터"
              placeholder="ts,tsx,json (비우면 전체)"
              value={extensionText}
              onChange={(e) => {
                setExtensionText(e.target.value);
                state.setOptions({
                  ...state.options,
                  extensions: e.target.value
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean),
                });
              }}
            />
          </label>
          <label>
            텍스트 인코딩
            <select
              aria-label="폴더 텍스트 인코딩"
              value={state.options.encoding}
              onChange={(e) => state.setOptions({ ...state.options, encoding: e.target.value })}
            >
              <option value="auto">UTF-8 / BOM 자동</option>
              <option value="utf-8">UTF-8</option>
              <option value="utf-16le">UTF-16 LE</option>
              <option value="utf-16be">UTF-16 BE</option>
            </select>
          </label>
          <label className="inline-option">
            <input
              type="checkbox"
              checked={state.options.caseSensitive}
              onChange={(e) =>
                state.setOptions({ ...state.options, caseSensitive: e.target.checked })
              }
            />
            경로 대소문자 구분
          </label>
          <label className="inline-option">
            <input
              type="checkbox"
              checked={state.options.ignoreWhitespace}
              onChange={(e) =>
                state.setOptions({ ...state.options, ignoreWhitespace: e.target.checked })
              }
            />
            폴더 공백 무시
          </label>
        </div>
        <p>
          제외·확장자 필터는 읽기 전에 적용됩니다. 폴더당 비교 대상 최대 1,000개 / 읽을 내용 합계 20
          MiB / 파일당 5 MiB. 파일 읽기·인코딩 오류는 동일로 표시하지 않습니다. 빈 디렉터리 자체는
          브라우저 FileList에 포함되지 않습니다.
        </p>
      </section>
      {error && (
        <div role="alert" className="error folder-error">
          {error}
        </div>
      )}
      {busy && (
        <div className="folder-progress">
          <p role="status">
            파일 처리 {progress.done} / {progress.total}
          </p>
          <progress value={progress.done} max={progress.total || 1} />
          <button
            onClick={() => {
              request.current++;
              controller.current?.abort();
              setBusy(false);
              setError('폴더 비교를 취소했습니다.');
            }}
          >
            비교 취소
          </button>
        </div>
      )}
      {result ? (
        <>
          <section className="folder-summary" aria-label="폴더 전체 통계">
            {[
              ['추가 파일', result.stats.added],
              ['삭제 파일', result.stats.removed],
              ['수정 파일', result.stats.modified],
              ['동일 파일', result.stats.unchanged],
              ['오류 파일', result.stats.errors],
              ['바이너리/혼합', result.stats.binary],
            ].map(([label, value]) => (
              <div key={label}>
                <strong>{value}</strong>
                <span>{label}</span>
              </div>
            ))}
            <p>
              {result.stats.total}개 파일 · {result.stats.folders}개 하위 경로 · 텍스트 줄 +
              {result.stats.addedLines} / −{result.stats.removedLines} · 줄 통계 불가{' '}
              {result.stats.unavailableLineStats}개 · 제외 Original {result.excludedOriginal} /
              Modified {result.excludedModified} · {result.duration.toFixed(1)} ms
            </p>
          </section>
          <div className="folder-results">
            <section className="folder-tree-panel">
              <h2>폴더 트리</h2>
              <input
                aria-label="폴더 파일 검색"
                className="folder-search"
                placeholder="파일명 / 상대 경로 검색"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <div className="tool-actions">
                <label>
                  <input
                    type="checkbox"
                    checked={onlyChanged}
                    onChange={(e) => setOnlyChanged(e.target.checked)}
                  />
                  동일 파일 숨기기
                </label>
                <select
                  aria-label="폴더 파일 종류"
                  value={kind}
                  onChange={(e) => setKind(e.target.value)}
                >
                  <option value="all">전체 종류</option>
                  <option value="text">텍스트</option>
                  <option value="binary">바이너리</option>
                  <option value="mixed">형식 변경</option>
                  <option value="error">읽기/비교 오류</option>
                </select>
                <button onClick={() => setCollapsed(new Set())}>폴더 전체 펼치기</button>
                <button
                  onClick={() =>
                    setCollapsed(
                      new Set(
                        folderTree(filtered)
                          .filter((node) => node.directory)
                          .map((node) => node.path),
                      ),
                    )
                  }
                >
                  폴더 전체 접기
                </button>
              </div>
              <p>
                {filtered.length} / {result.rows.length}개 파일 표시 · 화면 행만 렌더링
              </p>
              <div
                ref={treeView}
                role="tree"
                aria-label="폴더 비교 트리"
                className="folder-tree-view"
                onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
              >
                <div style={{ height: tree.length * 34, position: 'relative' }}>
                  {tree.slice(start, start + 28).map((node, i) => (
                    <div
                      key={`${node.directory ? 'dir' : 'file'}:${node.path}`}
                      role="treeitem"
                      aria-level={node.depth + 1}
                      aria-expanded={node.directory ? !collapsed.has(node.path) : undefined}
                      aria-selected={!node.directory && selected === node.path}
                      className={`folder-tree-row ${!node.directory && selected === node.path ? 'selected' : ''}`}
                      style={{
                        position: 'absolute',
                        top: (start + i) * 34,
                        height: 34,
                        width: '100%',
                        paddingLeft: Math.min(node.depth, 8) * 13 + 6,
                      }}
                    >
                      <button
                        title={node.path}
                        aria-label={node.directory ? `폴더 ${node.path}` : `파일 ${node.path}`}
                        onClick={() => {
                          if (node.directory)
                            setCollapsed((prev) => {
                              const next = new Set(prev);
                              if (next.has(node.path)) next.delete(node.path);
                              else next.add(node.path);
                              return next;
                            });
                          else setSelected(node.path);
                        }}
                      >
                        <span>{node.directory ? (collapsed.has(node.path) ? '▸' : '▾') : '·'}</span>
                        <b>{node.path.split('/').at(-1)}</b>
                        {node.directory ? (
                          <small>{node.count}</small>
                        ) : (
                          <>
                            <em className={node.file!.status.toLowerCase()}>
                              {statusLabel[node.file!.status]}
                            </em>
                            <small>
                              {node.file!.added === undefined
                                ? '—'
                                : `+${node.file!.added}/−${node.file!.removed}`}
                            </small>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div className="tool-actions">
                <button
                  onClick={() => downloadText(exportFolderReport(result), 'folder-comparison.json')}
                >
                  전체 결과 JSON 저장
                </button>
                <button
                  onClick={() =>
                    downloadText(exportFolderReport(result, filtered), 'folder-filtered.json')
                  }
                >
                  표시 목록 JSON 저장
                </button>
              </div>
            </section>
            <section className="folder-file-panel">
              <div className="tool-heading">
                <h2>{row?.path ?? '파일을 선택하세요.'}</h2>
                <button
                  disabled={!canDiff}
                  title="Code Compare의 현재 두 입력을 선택 파일로 교체합니다."
                  onClick={openCode}
                >
                  Code Compare로 복사
                </button>
              </div>
              {row && (
                <>
                  <div className="folder-file-meta">
                    <span>
                      {statusLabel[row.status]} · {row.kind}
                    </span>
                    <span>
                      Original: {row.original?.path ?? '(없음)'} · {row.original?.size ?? 0} bytes ·{' '}
                      {row.original?.encoding ?? '—'}
                    </span>
                    <span>
                      Modified: {row.modified?.path ?? '(없음)'} · {row.modified?.size ?? 0} bytes ·{' '}
                      {row.modified?.encoding ?? '—'}
                    </span>
                    {row.note && <p>{row.note}</p>}
                  </div>
                  {canDiff ? (
                    <>
                      <div className="tool-actions">
                        <label>
                          Diff 보기
                          <select
                            aria-label="폴더 Diff 보기"
                            value={sideBySide ? 'side' : 'unified'}
                            onChange={(e) => setSideBySide(e.target.value === 'side')}
                          >
                            <option value="side">Side by side</option>
                            <option value="unified">Unified</option>
                          </select>
                        </label>
                        <span>
                          텍스트 줄 +{row.added} / −{row.removed}
                        </span>
                      </div>
                      <div className="folder-diff-editor">
                        <DiffEditor
                          height="100%"
                          original={row.original?.text ?? ''}
                          modified={row.modified?.text ?? ''}
                          language={detectLanguage(row.path)}
                          theme={prefs.theme === 'dark' ? 'vs-dark' : 'vs'}
                          options={{
                            readOnly: true,
                            originalEditable: false,
                            renderSideBySide: sideBySide,
                            useInlineViewWhenSpaceIsLimited: false,
                            automaticLayout: true,
                            minimap: { enabled: prefs.minimap && !narrow },
                            fontSize: 12,
                            scrollBeyondLastLine: false,
                            ignoreTrimWhitespace: state.options.ignoreWhitespace,
                          }}
                        />
                      </div>
                    </>
                  ) : (
                    <div
                      className="folder-no-diff"
                      role={row.status === 'ERROR_FILE' ? 'alert' : 'status'}
                    >
                      {row.status === 'ERROR_FILE'
                        ? '파일 읽기 또는 비교 오류로 텍스트 Diff를 제공하지 않습니다.'
                        : '바이너리·형식 변경 파일은 바이트 비교 결과만 제공합니다.'}
                    </div>
                  )}
                </>
              )}
              {!row && <p>왼쪽 트리에서 파일을 선택하세요.</p>}
              <p className="folder-note">
                인코딩/BOM 변경은 공백 옵션과 별개로 수정입니다. 바이너리는 바이트만 비교합니다.
                Monaco 강조는 자체 알고리즘이므로 ‘모든 공백 무시’ 분석과 다를 수 있습니다. Code
                Compare로 복사는 현재 코드 입력을 명시적으로 교체합니다.
              </p>
            </section>
          </div>
        </>
      ) : (
        !busy && (
          <p className="folder-empty">
            두 폴더를 선택한 뒤 폴더 비교 실행을 누르세요. 입력·비교 옵션이 바뀌면 이전 결과와 저장
            기능은 무효화됩니다.
          </p>
        )
      )}
    </main>
  );
}
