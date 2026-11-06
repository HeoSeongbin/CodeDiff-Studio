import type { Segment } from '../json/value';
export const WILDCARD = Symbol('wildcard');
export type MappingSegment = Segment | typeof WILDCARD;
const blocked = new Set(['__proto__', 'prototype', 'constructor']);
export function parseMappingPath(text: string): MappingSegment[] {
  if (!text.startsWith('$') || text.length > 500)
    throw new Error('경로는 $로 시작하며 최대 500자입니다.');
  const tokens: MappingSegment[] = [];
  let index = 1;
  while (index < text.length) {
    const rest = text.slice(index);
    const dot = /^\.([A-Za-z_$][\w$]*)/.exec(rest);
    const bracket = /^\[(\*|0|[1-9]\d*|"(?:[^"\\]|\\.)*")\]/.exec(rest);
    let key: MappingSegment;
    if (dot) {
      key = dot[1];
      index += dot[0].length;
    } else if (bracket) {
      key = bracket[1] === '*' ? WILDCARD : (JSON.parse(bracket[1]) as Segment);
      index += bracket[0].length;
    } else throw new Error('지원하지 않는 경로입니다. $.field, ["key"], [0], [*]만 사용하세요.');
    if (typeof key === 'string' && blocked.has(key))
      throw new Error(`위험한 속성 경로는 허용하지 않습니다: ${key}`);
    if (typeof key === 'number' && (!Number.isSafeInteger(key) || key >= 30000))
      throw new Error('배열 인덱스는 0–29999 범위입니다.');
    tokens.push(key);
    if (tokens.length > 80) throw new Error('경로 깊이 제한은 80입니다.');
  }
  if (tokens.filter((t) => t === WILDCARD).length > 1)
    throw new Error('경로당 [*]는 한 번만 사용할 수 있습니다.');
  return tokens;
}
/** Whether writes can overlap or disagree on the container shape. */
export function pathsConflict(a: MappingSegment[], b: MappingSegment[]): boolean {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    const aArray = typeof a[i] === 'number' || a[i] === WILDCARD,
      bArray = typeof b[i] === 'number' || b[i] === WILDCARD;
    if (aArray !== bArray) return true;
    if (a[i] === WILDCARD || b[i] === WILDCARD) continue;
    return false;
  }
  return true;
}
