import { useMemo } from 'react';
import { type DiffHunk } from '../core/diff';
import { useCompute } from '../hooks/useCompute';
export function ChangeDetail({ hunk, unit }: { hunk: DiffHunk; unit: 'word' | 'character' }) {
  const job = useMemo(
    () => ({
      kind: 'inline' as const,
      original: hunk.lines
        .filter((l) => l.operation === 'removed')
        .map((l) => l.content)
        .join('')
        .slice(0, 20_000),
      modified: hunk.lines
        .filter((l) => l.operation === 'added')
        .map((l) => l.content)
        .join('')
        .slice(0, 20_000),
      unit,
    }),
    [hunk, unit],
  );
  const computation = useCompute(job, 0);
  const detail = computation.result ?? { limited: false, changes: [] };
  const truncated = hunk.lines.reduce((n, l) => n + l.content.length, 0) > 20_000;
  return (
    <section className="change-detail" aria-label="선택 변경 상세">
      <h2>변경 #{hunk.id.replace('change-', '')} 상세</h2>
      <p>원문 기준 · {unit === 'word' ? '단어' : '문자'} 강조 · 줄 끝 표기: CRLF / LF / CR / EOF</p>
      {truncated && (
        <p>미리보기는 양쪽 각각 20,000자까지 표시합니다. 전체 원문은 코드 저장으로 확인하세요.</p>
      )}
      {computation.error && (
        <p role="alert">
          {computation.error}
          <button onClick={computation.retry}>상세 다시 계산</button>
        </p>
      )}
      {detail.limited && <p>상세 비교 한도 초과: 표시 범위의 추가·삭제 원문을 구분합니다.</p>}
      <pre>
        {detail.changes.map((part, i) => (
          <span
            key={i}
            className={part.added ? 'inline-added' : part.removed ? 'inline-removed' : ''}
          >
            {part.value
              .replace(/\r\n/g, '⟦CRLF⟧\n')
              .replace(/(?<!⟦CRLF⟧)\n/g, '⟦LF⟧\n')
              .replace(/\r/g, '⟦CR⟧\n')}
          </span>
        ))}
        <span className="eof">⟦EOF⟧</span>
      </pre>
    </section>
  );
}
