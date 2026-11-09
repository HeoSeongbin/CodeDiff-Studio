import { useComputeClient, WorkspaceActive } from '../../hooks/useCompute';
import { useContext, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../stores/workspace';
import { type PatchInput, type PatchOperation, type VerifiedPatch } from '../../core/patch/patch';
import { downloadText } from '../../core/export';
export default function PatchExport({ onCompare }: { onCompare: () => void }) {
  const state = useWorkspace();
  const [path, setPath] = useState(state.original.name),
    [context, setContext] = useState(3),
    [operation, setOperation] = useState<PatchOperation>('modify'),
    [showCR, setShowCR] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState('');
  const [snapshot, setSnapshot] = useState<{ input: PatchInput; result: VerifiedPatch }>();
  const client = useComputeClient();
  const activeWorkspace = useContext(WorkspaceActive);
  const request = useRef(0),
    timer = useRef<ReturnType<typeof setTimeout>>();
  const input: PatchInput = {
    original: state.original.text,
    modified: state.modified.text,
    filePath: path,
    context,
    operation,
  };
  const result =
    snapshot &&
    snapshot.input.original === input.original &&
    snapshot.input.modified === input.modified &&
    snapshot.input.filePath === path &&
    snapshot.input.context === context &&
    snapshot.input.operation === operation
      ? snapshot.result
      : undefined;
  useEffect(() => {
    request.current++;
    client.cancel();
    clearTimeout(timer.current);
    setBusy(false);
    setError('');
    setNotice('');
    return () => {
      clearTimeout(timer.current);
      request.current++;
      client.cancel();
    };
  }, [input.original, input.modified, path, context, operation, client, activeWorkspace]);
  function generate() {
    const version = ++request.current;
    setBusy(true);
    setError('');
    setNotice('');
    setSnapshot(undefined);
    timer.current = setTimeout(async () => {
      try {
        const value = await client.run({ kind: 'patch', input });
        if (version === request.current) setSnapshot({ input, result: value });
      } catch (e) {
        if (version === request.current) setError((e as Error).message);
      } finally {
        if (version === request.current) setBusy(false);
      }
    }, 0);
  }
  async function copy() {
    if (!result?.text) return;
    try {
      await navigator.clipboard.writeText(result.text);
      setNotice(
        'Patch를 복사했습니다. 클립보드는 운영체제에 따라 개행을 바꿀 수 있으므로 정확한 내용 보존은 파일 저장을 사용하세요.',
      );
    } catch {
      setError('클립보드 복사에 실패했습니다.');
    }
  }
  function save(extension: 'diff' | 'patch') {
    if (result?.text)
      downloadText(result.text, `${result.filePath.split('/').at(-1)}.${extension}`);
  }
  const enabled = !busy && !!result?.text;
  return (
    <main className="patch-workspace">
      <div className="workspace-heading">
        <div>
          <div className="eyebrow">WORKSPACE / PATCH EXPORT</div>
          <h1>변경사항을 Patch로 내보내세요.</h1>
          <p>현재 Code Compare 원문 기준 · 적용 결과 검증 · 로컬 처리</p>
        </div>
        <button onClick={onCompare}>코드 비교로 돌아가기</button>
      </div>
      <section className="patch-inputs">
        <h2>비교 입력</h2>
        <div className="patch-files">
          <div>
            <span>ORIGINAL</span>
            <b>{state.original.name}</b>
            <small>
              {new TextEncoder().encode(input.original).length.toLocaleString()} UTF-8 bytes
            </small>
          </div>
          <div>
            <span>MODIFIED</span>
            <b>{state.modified.name}</b>
            <small>
              {new TextEncoder().encode(input.modified).length.toLocaleString()} UTF-8 bytes
            </small>
          </div>
        </div>
        <p>
          Code Compare에서 파일을 업로드하거나 편집하세요. 공백·대소문자·빈 줄·줄바꿈 무시 옵션은
          Patch에 적용되지 않습니다. 파일명이 달라도 Rename으로 추정하지 않으며 아래 하나의 대상
          경로에 적용할 Patch를 생성합니다.
        </p>
        <div className="patch-controls">
          <label>
            대상 상대 경로
            <input
              aria-label="Patch 대상 경로"
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="src/Greeting.java"
            />
          </label>
          <button onClick={() => setPath(state.original.name)}>Original 파일명 사용</button>
          <label>
            문맥 줄
            <select
              aria-label="Patch 문맥 줄"
              value={context}
              onChange={(e) => setContext(Number(e.target.value))}
            >
              {[0, 1, 3, 5, 10, 20].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            파일 작업
            <select
              aria-label="Patch 파일 작업"
              value={operation}
              onChange={(e) => setOperation(e.target.value as PatchOperation)}
            >
              <option value="modify">기존 파일 수정</option>
              <option value="create">파일 생성 (Original 비어 있음)</option>
              <option value="delete">파일 삭제 (Modified 비어 있음)</option>
            </select>
          </label>
          <button className="generate-patch" disabled={busy} onClick={generate}>
            {busy ? 'Patch 생성 중…' : 'Patch 생성 및 검증'}
          </button>
          {busy && (
            <button
              onClick={() => {
                ++request.current;
                clearTimeout(timer.current);
                client.cancel();
                setBusy(false);
                setError('Patch 생성이 취소되었습니다.');
              }}
            >
              Patch 생성 취소
            </button>
          )}
        </div>
      </section>
      {error && (
        <div role="alert" className="error patch-error">
          {error}
        </div>
      )}
      {notice && (
        <p role="status" className="notice">
          {notice}
        </p>
      )}
      <section className="patch-preview">
        <div className="tool-heading">
          <h2>Unified Diff Preview</h2>
          <button disabled={!enabled} onClick={() => void copy()}>
            Patch 복사
          </button>
          <button disabled={!enabled} onClick={() => save('diff')}>
            .diff 저장
          </button>
          <button disabled={!enabled} onClick={() => save('patch')}>
            .patch 저장
          </button>
          <button
            disabled={!enabled}
            onClick={async () => {
              if (result) {
                const version = ++request.current;
                setBusy(true);
                try {
                  const verified = await client.run({
                    kind: 'patchVerify',
                    original: input.original,
                    modified: input.modified,
                    text: result.text,
                  });
                  if (version !== request.current) return;
                  if (verified.ok) setNotice(verified.message);
                  else {
                    setSnapshot(undefined);
                    setError(verified.message);
                  }
                } catch (error) {
                  if (version === request.current) setError((error as Error).message);
                } finally {
                  if (version === request.current) setBusy(false);
                }
              }
            }}
          >
            Patch 적용 재검증
          </button>
        </div>
        <div className="tool-actions">
          <label>
            <input type="checkbox" checked={showCR} onChange={(e) => setShowCR(e.target.checked)} />
            미리보기 CR 문자 표시 (␍)
          </label>
        </div>
        {busy ? (
          <p role="status">원문에서 Patch를 계산하고 있습니다…</p>
        ) : result ? (
          <>
            <p role="status" className="patch-verified">
              {result.hunks
                ? '적용 검증 통과 · 수정본과 정확히 일치'
                : '원문 동일 · 내보낼 변경사항이 없습니다.'}
            </p>
            {result.hunks > 0 && (
              <>
                <div className="patch-stats">
                  <span>{result.hunks} hunks</span>
                  <span>
                    +{result.added} / −{result.removed}
                  </span>
                  <span>{result.bytes.toLocaleString()} bytes</span>
                  <span>{result.duration.toFixed(1)} ms</span>
                </div>
                <pre aria-label="Patch 미리보기" className="patch-text">
                  {showCR ? result.text.replace(/\r/g, '␍') : result.text}
                </pre>
              </>
            )}
          </>
        ) : (
          <p className="patch-empty">
            Patch 생성 및 검증을 눌러 최신 원문으로 생성하세요. 입력·경로·설정 변경 후 이전 결과는
            내보낼 수 없습니다.
          </p>
        )}
      </section>
      <section className="patch-notes">
        <h2>개행과 적용 정책</h2>
        <p>
          메타데이터 줄은 LF, 본문은 원문의 CRLF/LF/혼합 개행과 마지막 개행 여부를 그대로
          보존합니다. 단독 CR은 Patch에서 줄 구분이 아닌 내용 문자로 취급하므로 Code Compare와 줄
          번호가 다를 수 있습니다. 저장은 BOM 없는 UTF-8이며 Original 파일을 직접 수정하지 않습니다.
        </p>
        <p>
          기본 문맥은 3줄입니다. 문맥 0의 Patch는 Git에서 --unidiff-zero가 필요합니다. 실제 적용 전
          대상 파일과 경로를 확인하세요. 빈 파일이라는 이유만으로 생성/삭제를 추정하지 않으며 작업
          선택은 사용자가 지정합니다. 내용 없는 파일의 생성·삭제, Rename·권한·바이너리·여러 파일
          Patch는 현재 범위에 포함하지 않습니다.
        </p>
        <code>
          {context === 0
            ? 'git apply --check --unidiff-zero changes.patch'
            : 'git apply --check changes.patch'}
        </code>
        <p>
          원문 입력 파일당 5 MiB · Patch 출력 12 MiB · 계산 제한 1.5초. 현재 검증은 디코딩된 텍스트
          기준이며 원본 UTF-16 바이트 인코딩을 재현하지 않습니다.
        </p>
      </section>
    </main>
  );
}
