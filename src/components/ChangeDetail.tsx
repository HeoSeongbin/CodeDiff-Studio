import { useMemo } from 'react';
import { compareInline, type DiffHunk } from '../core/diff';
export function ChangeDetail({ hunk, unit }: { hunk: DiffHunk; unit: 'word' | 'character' }) {
  const detail = useMemo(
    () =>
      compareInline(
        hunk.lines
          .filter((l) => l.operation === 'removed')
          .map((l) => l.content)
          .join(''),
        hunk.lines
          .filter((l) => l.operation === 'added')
          .map((l) => l.content)
          .join(''),
        unit,
      ),
    [hunk, unit],
  );
  return (
    <section className="change-detail" aria-label="선택 변경 상세">
      <h2>변경 #{hunk.id.replace('change-', '')} 상세</h2>
      <p>원문 기준 · {unit === 'word' ? '단어' : '문자'} 강조 · 줄 끝 표기: CRLF / LF / CR / EOF</p>
      {detail.limited && <p>상세 비교 한도 초과: 변경 블록 전체를 표시합니다.</p>}
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
