import { useEffect, useState, type ReactNode } from 'react';
export function ResultList<T>({
  items,
  render,
  selectedIndex,
}: {
  items: T[];
  render: (item: T, index: number) => ReactNode;
  selectedIndex?: number;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(items.length / 100));
  const active = Math.min(page, pages - 1);
  useEffect(() => setPage(0), [items]);
  useEffect(() => {
    if (selectedIndex !== undefined) setPage(Math.floor(selectedIndex / 100));
  }, [selectedIndex]);
  return (
    <>
      <div className="json-change-list">
        {items
          .slice(active * 100, active * 100 + 100)
          .map((item, i) => render(item, active * 100 + i))}
      </div>
      {pages > 1 && (
        <div className="tool-actions">
          <button disabled={!active} onClick={() => setPage((p) => p - 1)}>
            이전 결과 페이지
          </button>
          <span>
            {active + 1} / {pages} 페이지 · {items.length}개 결과
          </span>
          <button disabled={active >= pages - 1} onClick={() => setPage((p) => p + 1)}>
            다음 결과 페이지
          </button>
        </div>
      )}
    </>
  );
}
