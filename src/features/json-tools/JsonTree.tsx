import { useEffect, useMemo, useRef, useState } from 'react';
import {
  type Json,
  type Segment,
  jsonType,
  pathText,
  stringify,
  treeRows,
} from '../../core/json/value';
interface Props {
  value: Json;
  selected?: Segment[];
  onSelect?: (path: Segment[]) => void;
  changedPaths?: string[];
  label?: string;
  onlyChanges?: boolean;
}
const EMPTY_PATHS: string[] = [];
export function JsonTree({
  value,
  selected,
  onSelect,
  changedPaths = EMPTY_PATHS,
  label = 'JSON 트리',
  onlyChanges = false,
}: Props) {
  const [search, setSearch] = useState(''),
    [depth, setDepth] = useState(1),
    [overrides, setOverrides] = useState<Record<string, boolean>>({}),
    [scroll, setScroll] = useState(0),
    [notice, setNotice] = useState('');
  const view = useRef<HTMLDivElement>(null);
  const selectedKey = selected ? pathText(selected) : undefined;
  useEffect(() => {
    if (selected) {
      setOverrides((prev) => ({
        ...prev,
        ...Object.fromEntries(selected.map((_, i) => [pathText(selected.slice(0, i)), true])),
      }));
    }
  }, [selectedKey]);
  const relations = useMemo(() => {
    const exact = new Set(changedPaths),
      ancestors = new Set<string>();
    for (const path of changedPaths) {
      let prefix = '$';
      ancestors.add(prefix);
      for (const part of path.match(/\[(?:"(?:[^"\\]|\\.)*"|\d+)\]/g) ?? []) {
        prefix += part;
        ancestors.add(prefix);
      }
    }
    const changed = (path: Segment[]) =>
      path.some((_, i) => exact.has(pathText(path.slice(0, i + 1)))) || exact.has('$');
    return { ancestors, changed };
  }, [changedPaths]);
  const rows = useMemo(
    () =>
      treeRows(value, (path, d) => overrides[pathText(path)] ?? d < depth, search).filter(
        (row) =>
          !onlyChanges ||
          relations.ancestors.has(pathText(row.path)) ||
          relations.changed(row.path),
      ),
    [value, overrides, depth, search, onlyChanges, relations],
  );
  useEffect(() => {
    setScroll(0);
    if (view.current) view.current.scrollTop = 0;
  }, [value, search, depth, onlyChanges]);
  useEffect(() => {
    if (!selectedKey) return;
    const index = rows.findIndex((row) => pathText(row.path) === selectedKey);
    if (index >= 0 && view.current) {
      view.current.scrollTop = index * 32;
      setScroll(index * 32);
    }
  }, [selectedKey, rows]);
  const start = Math.max(0, Math.min(Math.floor(scroll / 32) - 5, Math.max(0, rows.length - 1)));
  const active = selected ? rows.find((row) => pathText(row.path) === selectedKey) : undefined;
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice('복사했습니다.');
    } catch {
      setNotice('복사에 실패했습니다.');
    }
  }
  return (
    <section className="json-tree" aria-label={label}>
      <div className="tool-actions">
        <input
          aria-label={`${label} 검색`}
          placeholder="Key / Value 검색"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button
          onClick={() => {
            setDepth(81);
            setOverrides({});
          }}
        >
          전체 펼치기
        </button>
        <button
          onClick={() => {
            setDepth(0);
            setOverrides({});
          }}
        >
          전체 접기
        </button>
        <label>
          깊이{' '}
          <select
            aria-label={`${label} 펼침 깊이`}
            value={depth}
            onChange={(e) => {
              setDepth(Number(e.target.value));
              setOverrides({});
            }}
          >
            {[0, 1, 2, 3, 5, 81].map((n) => (
              <option key={n} value={n}>
                {n === 81 ? '전체' : n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div
        className="tree-viewport"
        ref={view}
        role="tree"
        aria-label={`${label} 노드`}
        onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
      >
        <div style={{ height: rows.length * 32, position: 'relative' }}>
          {rows.slice(start, start + 24).map((node, i) => {
            const key = pathText(node.path);
            const open = overrides[key] ?? node.depth < depth;
            const changed = relations.changed(node.path);
            return (
              <div
                key={key}
                role="treeitem"
                aria-level={node.depth + 1}
                aria-selected={selectedKey === key}
                aria-expanded={node.expandable ? open : undefined}
                className={`tree-row ${selectedKey === key ? 'selected' : ''} ${changed ? 'changed' : ''}`}
                style={{
                  position: 'absolute',
                  top: (start + i) * 32,
                  height: 32,
                  width: '100%',
                  paddingLeft: Math.min(node.depth, 8) * 16 + 6,
                }}
              >
                <button
                  aria-label={`${open ? '접기' : '펼치기'} ${key}`}
                  disabled={!node.expandable}
                  onClick={() => setOverrides((prev) => ({ ...prev, [key]: !open }))}
                >
                  {node.expandable ? (open ? '▾' : '▸') : '·'}
                </button>
                <button className="tree-value" onClick={() => onSelect?.(node.path)} title={key}>
                  <b>{node.path.length ? String(node.path.at(-1)) : '$'}</b>{' '}
                  <em>{jsonType(node.value)}</em>{' '}
                  <span>
                    {node.expandable
                      ? `${Object.keys(node.value as object).length} items`
                      : stringify(node.value, 0)}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
      <small>{rows.length.toLocaleString()}개 노드 · 화면 행만 렌더링</small>
      {selected && (
        <div className="tree-selection">
          <code>{selectedKey}</code>
          <button onClick={() => void copy(selectedKey!)}>JSONPath 복사</button>
          {active && <button onClick={() => void copy(stringify(active.value))}>값 복사</button>}
        </div>
      )}
      {notice && <p role="status">{notice}</p>}
    </section>
  );
}
