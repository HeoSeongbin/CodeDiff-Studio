export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };
export type Segment = string | number;
export const JSON_MAX_BYTES = 1024 * 1024;
export function jsonType(value: Json): string {
  return value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
}
export function pathText(path: Segment[]): string {
  return '$' + path.map((key) => `[${JSON.stringify(key)}]`).join('');
}
export function parseJson(text: string): Json {
  if (new TextEncoder().encode(text).length > JSON_MAX_BYTES)
    throw new Error('JSON 도구 입력 제한은 1 MiB입니다.');
  const value = JSON.parse(text) as Json;
  const tokens = text.match(/"(?:[^"\\]|\\.)*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ?? [];
  for (const token of tokens)
    if (!token.startsWith('"')) {
      const number = Number(token);
      if (!Number.isFinite(number) || (Number.isInteger(number) && !Number.isSafeInteger(number)))
        throw new Error(
          '숫자 정밀도 손실 가능성: 안전한 정수 범위를 벗어나는 값은 문자열로 입력하세요. 원문은 유지됩니다.',
        );
    }
  const pending: { value: Json; depth: number }[] = [{ value, depth: 0 }];
  let count = 0;
  while (pending.length) {
    const node = pending.pop()!;
    if (++count > 30000 || node.depth > 80)
      throw new Error('JSON 처리 제한: 최대 30,000개 값, 깊이 80입니다.');
    if (node.value && typeof node.value === 'object')
      for (const child of Object.values(node.value))
        pending.push({ value: child, depth: node.depth + 1 });
  }
  return value;
}
export function stringify(value: unknown, indent = 2): string {
  return JSON.stringify(value, null, indent);
}
export function sortKeys(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys(value[key])]),
    );
  return value;
}
export interface JsonChange {
  path: Segment[];
  kind: 'FIELD_ADDED' | 'FIELD_REMOVED' | 'VALUE_MODIFIED' | 'TYPE_CHANGED' | 'ARRAY_CHANGED';
  before?: Json;
  after?: Json;
}
export function structuralDiff(before: Json, after: Json): JsonChange[] {
  const changes: JsonChange[] = [];
  function visit(a: Json, b: Json, path: Segment[]) {
    if (Object.is(a, b)) return;
    if (jsonType(a) !== jsonType(b)) {
      changes.push({ path, kind: 'TYPE_CHANGED', before: a, after: b });
      return;
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) changes.push({ path, kind: 'ARRAY_CHANGED', before: a, after: b });
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        if (i >= a.length) changes.push({ path: [...path, i], kind: 'FIELD_ADDED', after: b[i] });
        else if (i >= b.length)
          changes.push({ path: [...path, i], kind: 'FIELD_REMOVED', before: a[i] });
        else visit(a[i], b[i], [...path, i]);
      }
    } else if (a && b && typeof a === 'object' && typeof b === 'object') {
      const old = a as Record<string, Json>,
        next = b as Record<string, Json>;
      for (const key of new Set([...Object.keys(old), ...Object.keys(next)])) {
        if (!Object.hasOwn(next, key))
          changes.push({ path: [...path, key], kind: 'FIELD_REMOVED', before: old[key] });
        else if (!Object.hasOwn(old, key))
          changes.push({ path: [...path, key], kind: 'FIELD_ADDED', after: next[key] });
        else visit(old[key], next[key], [...path, key]);
      }
    } else changes.push({ path, kind: 'VALUE_MODIFIED', before: a, after: b });
  }
  visit(before, after, []);
  return changes;
}
export interface TreeNode {
  path: Segment[];
  value: Json;
  depth: number;
  expandable: boolean;
}
export function treeRows(
  value: Json,
  expanded: (path: Segment[], depth: number) => boolean,
  search = '',
): TreeNode[] {
  const rows: TreeNode[] = [];
  function visit(item: Json, path: Segment[], depth: number) {
    const expandable = item !== null && typeof item === 'object' && Object.keys(item).length > 0;
    const match =
      !search ||
      String(path.at(-1) ?? '$')
        .toLowerCase()
        .includes(search.toLowerCase()) ||
      (!expandable && stringify(item).toLowerCase().includes(search.toLowerCase()));
    if (match) rows.push({ path, value: item, depth, expandable });
    if (expandable && (search || expanded(path, depth)))
      for (const [key, child] of Object.entries(item))
        visit(child, [...path, Array.isArray(item) ? Number(key) : key], depth + 1);
  }
  visit(value, [], 0);
  return rows;
}
