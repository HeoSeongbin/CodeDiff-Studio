import { JSONPath } from 'jsonpath-plus';
import { type Json, type Segment, pathText } from './value';
/** Deliberately restricted grammar: property, recursive property, wildcard, index and slice. No script/filter/function evaluation. */
export function queryJson(
  value: Json,
  expression: string,
): { path: Segment[]; jsonPath: string; value: Json }[] {
  if (
    expression.length > 500 ||
    !/^\$(?:(?:\.{1,2}(?:[A-Za-z_$][\w$]*|\*))|\[(?:\*|-?\d+|(?:-?\d*):(?:-?\d*)(?::-?\d+)?|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')\])*$/.test(
      expression,
    )
  )
    throw new Error(
      '지원하지 않는 JSONPath입니다. $, 필드, 재귀(..), *, 인덱스, slice만 지원하며 필터·코드는 실행하지 않습니다.',
    );
  // Canonical tree paths use JSON-escaped keys. Resolve them directly so quote/bracket/backslash keys round-trip exactly.
  if (/^\$(?:\[(?:"(?:[^"\\]|\\.)*"|\d+)\])*$/.test(expression)) {
    let current = value;
    const path: Segment[] = [];
    for (const token of expression.match(/\[(?:"(?:[^"\\]|\\.)*"|\d+)\]/g) ?? []) {
      const key = JSON.parse(token.slice(1, -1)) as string | number;
      if (current === null || typeof current !== 'object' || !Object.hasOwn(current, key))
        return [];
      path.push(Array.isArray(current) ? Number(key) : String(key));
      current = (current as Record<string, Json>)[String(key)];
    }
    return [{ path, jsonPath: pathText(path), value: current }];
  }
  const syntax = expression.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/g, '"key"');
  if ((syntax.match(/\.\./g) ?? []).length > 1)
    throw new Error('JSONPath 재귀 탐색(..)은 표현식당 한 번만 사용할 수 있습니다.');
  if (/\[(?:-?\d*):(?:-?\d*):-?0+\]/.test(syntax))
    throw new Error('JSONPath slice step은 0일 수 없습니다.');
  const results = JSONPath({
    path: expression,
    json: value as object,
    eval: false,
    resultType: 'all',
    wrap: true,
  }) as { pointer: string; value: Json }[];
  return results.map((result) => {
    let current = value;
    const path: Segment[] =
      result.pointer === ''
        ? []
        : result.pointer
            .slice(1)
            .split('/')
            .map((part) => {
              const key = part.replace(/~1/g, '/').replace(/~0/g, '~');
              const segment = Array.isArray(current) ? Number(key) : key;
              current = (current as Record<string, Json>)[key];
              return segment;
            });
    return { path, jsonPath: pathText(path), value: result.value };
  });
}
