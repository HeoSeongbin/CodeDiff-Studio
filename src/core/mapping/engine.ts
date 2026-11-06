import { type Json, type Segment, parseJson, stringify, pathText } from '../json/value';
import { parseMappingPath, pathsConflict, WILDCARD, type MappingSegment } from './path';
export interface MappingRule {
  id: string;
  sourcePath?: string;
  targetPath: string;
  transform: 'copy' | 'string' | 'number' | 'boolean' | 'date' | 'constant';
  defaultValue?: Json;
  constantValue?: Json;
  enabled?: boolean;
  onMissing?: 'error' | 'skip';
}
export interface MappingIssue {
  ruleId?: string;
  message: string;
}
export interface MappingResult {
  value?: Json;
  errors: MappingIssue[];
  applied: number;
  skipped: number;
  excluded: number;
}
interface Compiled {
  rule: MappingRule;
  source: MappingSegment[];
  target: MappingSegment[];
}
const transformations = ['copy', 'string', 'number', 'boolean', 'date', 'constant'];
export function validateMappingRules(input: unknown): {
  rules: MappingRule[];
  compiled: Compiled[];
  errors: MappingIssue[];
} {
  const errors: MappingIssue[] = [],
    compiled: Compiled[] = [];
  if (!Array.isArray(input) || input.length > 100)
    return { rules: [], compiled, errors: [{ message: '규칙은 최대 100개의 배열이어야 합니다.' }] };
  const ids = new Set<string>();
  for (const item of input) {
    let ruleId: string | undefined;
    try {
      if (!item || typeof item !== 'object' || Array.isArray(item))
        throw new Error('규칙은 객체여야 합니다.');
      const row = item as Record<string, unknown>;
      const allowed = [
        'id',
        'sourcePath',
        'targetPath',
        'transform',
        'defaultValue',
        'constantValue',
        'enabled',
        'onMissing',
      ];
      if (Object.keys(row).some((key) => !allowed.includes(key)))
        throw new Error('알 수 없는 규칙 속성이 있습니다.');
      if (typeof row.id !== 'string' || !row.id.trim() || row.id.length > 100 || ids.has(row.id))
        throw new Error('규칙 ID는 비어 있지 않은 고유 문자열(최대 100자)이어야 합니다.');
      ruleId = row.id;
      ids.add(ruleId);
      if (typeof row.transform !== 'string' || !transformations.includes(row.transform))
        throw new Error('지원하지 않는 변환입니다.');
      if (row.enabled !== undefined && typeof row.enabled !== 'boolean')
        throw new Error('enabled는 boolean이어야 합니다.');
      if (row.onMissing !== undefined && row.onMissing !== 'error' && row.onMissing !== 'skip')
        throw new Error('onMissing은 error 또는 skip이어야 합니다.');
      if (
        typeof row.targetPath !== 'string' ||
        (row.sourcePath !== undefined && typeof row.sourcePath !== 'string')
      )
        throw new Error('Source/Target 경로는 문자열이어야 합니다.');
      // Validate even excluded rules on import, so enabling cannot expose an unchecked path.
      const target = parseMappingPath(row.targetPath),
        source =
          typeof row.sourcePath === 'string' && row.sourcePath !== ''
            ? parseMappingPath(row.sourcePath)
            : [];
      if (row.transform !== 'constant' && !row.sourcePath)
        throw new Error('Source Path가 필요합니다.');
      if (row.transform === 'constant' && !Object.hasOwn(row, 'constantValue'))
        throw new Error('상수 JSON 값이 필요합니다.');
      for (const key of ['defaultValue', 'constantValue'])
        if (Object.hasOwn(row, key)) {
          // Reject undefined/functions/BigInt/cyclic/non-JSON values on programmatic API calls too.
          assertJson(row[key]);
        }
      const sourceWild = source.includes(WILDCARD),
        targetWild = target.includes(WILDCARD);
      if (sourceWild !== targetWild)
        throw new Error(
          'Source와 Target의 [*] 개수가 같아야 합니다. 배열 전체 복사는 [*] 없이 지정하세요.',
        );
      if (row.enabled !== false) compiled.push({ rule: item as MappingRule, source, target });
    } catch (e) {
      errors.push({ ruleId, message: (e as Error).message });
    }
  }
  for (let i = 0; i < compiled.length; i++) {
    for (let j = 0; j < i; j++) {
      if (pathsConflict(compiled[i].target, compiled[j].target)) {
        errors.push({
          ruleId: compiled[i].rule.id,
          message: `Target 경로 충돌: ${compiled[j].rule.id}와 중복·부모/자식 또는 컨테이너 형식이 겹칩니다.`,
        });
        break;
      }
    }
  }
  return { rules: input as MappingRule[], compiled, errors };
}
function assertJson(
  value: unknown,
  depth = 0,
  seen = new Set<object>(),
  budget = { nodes: 0 },
): asserts value is Json {
  if (++budget.nodes > 30000) throw new Error('JSON 값 수 제한은 30,000개입니다.');
  if (depth > 80) throw new Error('JSON 값 깊이 제한은 80입니다.');
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
  if (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    (!Number.isInteger(value) || Number.isSafeInteger(value))
  )
    return;
  if (typeof value !== 'object' || value === null || seen.has(value))
    throw new Error('상수/기본값은 정밀도 손실 없는 JSON 값이어야 합니다.');
  if (
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) !== Object.prototype &&
    Object.getPrototypeOf(value) !== null
  )
    throw new Error('상수/기본값은 JSON 객체여야 합니다.');
  seen.add(value);
  for (const item of Object.values(value)) assertJson(item, depth + 1, seen, budget);
  seen.delete(value);
  if (
    Array.isArray(value) &&
    (Object.keys(value).length !== value.length ||
      Array.from({ length: value.length }, (_, i) => Object.hasOwn(value, i)).some(
        (found) => !found,
      ))
  )
    throw new Error('희소 배열은 JSON 값으로 허용하지 않습니다.');
}
function convert(value: Json, transform: MappingRule['transform']): Json {
  if (transform === 'copy' || transform === 'constant') return value;
  if (transform === 'string') {
    if (value === null || typeof value === 'object')
      throw new Error('string 변환은 null을 제외한 문자열·숫자·boolean만 지원합니다.');
    return String(value);
  }
  if (transform === 'number') {
    if (
      typeof value !== 'number' &&
      (typeof value !== 'string' ||
        !/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(value.trim()))
    )
      throw new Error('number 변환에는 유효한 10진 숫자 또는 문자열이 필요합니다.');
    const result = Number(typeof value === 'string' ? value.trim() : value);
    if (!Number.isFinite(result) || (Number.isInteger(result) && !Number.isSafeInteger(result)))
      throw new Error('number 변환 정밀도 손실 또는 범위 오류입니다.');
    return result;
  }
  if (transform === 'boolean') {
    if (typeof value === 'boolean') return value;
    if (value === 0 || value === '0' || value === 'false') return false;
    if (value === 1 || value === '1' || value === 'true') return true;
    throw new Error('boolean 변환은 true/false, 0/1과 같은 문자열만 지원합니다.');
  }
  if (typeof value !== 'string') throw new Error('date 변환은 ISO 날짜 문자열이 필요합니다.');
  const date = /^(\d{4}-\d{2}-\d{2})(?:T(\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z)?$/.exec(value);
  if (!date) throw new Error('date는 YYYY-MM-DD 또는 UTC ISO 시각(끝 Z)만 지원합니다.');
  const expected = `${date[1]}T${date[2] ?? '00:00:00'}.${(date[3] ?? '').padEnd(3, '0')}Z`;
  const time = new Date(expected);
  if (!Number.isFinite(time.getTime()) || time.toISOString() !== expected)
    throw new Error('유효하지 않은 날짜 또는 시각입니다.');
  return expected;
}
const MISSING = Symbol('missing');
type Missing = typeof MISSING;
export function applyMapping(source: Json, input: unknown): MappingResult {
  try {
    assertJson(source);
    parseJson(stringify(source, 0));
  } catch (e) {
    return { errors: [{ message: (e as Error).message }], applied: 0, skipped: 0, excluded: 0 };
  }
  const validation = validateMappingRules(input);
  const result: MappingResult = {
    errors: [...validation.errors],
    applied: 0,
    skipped: 0,
    excluded: validation.rules.filter((r) => r?.enabled === false).length,
  };
  if (result.errors.length) return result;
  let clonedNodes = 0,
    visits = 0;
  function clone(value: Json): Json {
    if (++clonedNodes > 30000) throw new Error('Target 값 수 제한은 30,000개입니다.');
    if (Array.isArray(value)) return value.map(clone);
    if (value !== null && typeof value === 'object')
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clone(v)]));
    return value;
  }
  let output: Json =
    validation.compiled[0]?.target[0] === WILDCARD ||
    typeof validation.compiled[0]?.target[0] === 'number'
      ? []
      : (Object.create(null) as Json);
  function write(path: Segment[], value: Json, ensureArray = false) {
    if (!path.length) {
      if (ensureArray) {
        if (!Array.isArray(output)) throw new Error('Target 배열 루트 형식 충돌입니다.');
      } else output = clone(value);
      return;
    }
    let current = output;
    for (let i = 0; i < path.length; i++) {
      const key = path[i],
        last = i === path.length - 1;
      if (
        current === null ||
        typeof current !== 'object' ||
        (typeof key === 'number') !== Array.isArray(current)
      )
        throw new Error(`Target 컨테이너 형식 충돌: ${pathText(path.slice(0, i))}`);
      const container = current as Record<string, Json>;
      if (last) {
        if (ensureArray) {
          if (!Object.hasOwn(container, key)) container[String(key)] = [];
          else if (!Array.isArray(container[String(key)]))
            throw new Error('Target 배열 형식 충돌입니다.');
        } else {
          if (Object.hasOwn(container, key)) throw new Error(`Target 중복 쓰기: ${pathText(path)}`);
          container[String(key)] = clone(value);
        }
      } else {
        if (!Object.hasOwn(container, key))
          container[String(key)] =
            typeof path[i + 1] === 'number' ? [] : (Object.create(null) as Json);
        current = container[String(key)];
      }
    }
  }
  for (const { rule, source: sourcePath, target } of validation.compiled) {
    try {
      const matches: { value: Json | Missing; index?: number }[] = [];
      let collectionSeen = false;
      function visit(value: Json | Missing, position: number, index?: number) {
        if (++visits > 200000) throw new Error('매핑 탐색 제한(200,000회)을 초과했습니다.');
        if (position === sourcePath.length) {
          matches.push({ value, index });
          return;
        }
        const token = sourcePath[position];
        if (token === WILDCARD) {
          if (value === MISSING && rule.onMissing === 'skip') {
            result.skipped++;
            return;
          }
          if (!Array.isArray(value)) throw new Error('[*] Source 경로에는 배열이 필요합니다.');
          collectionSeen = true;
          value.forEach((item, i) => visit(item, position + 1, i));
        } else {
          const found =
            value !== MISSING &&
            value !== null &&
            typeof value === 'object' &&
            (typeof token === 'number') === Array.isArray(value) &&
            Object.hasOwn(value, token);
          visit(
            found ? (value as Record<string, Json>)[String(token)] : MISSING,
            position + 1,
            index,
          );
        }
      }
      if (rule.transform === 'constant' && !sourcePath.includes(WILDCARD))
        matches.push({ value: rule.constantValue! });
      else visit(source, 0);
      if (target.includes(WILDCARD) && collectionSeen)
        write(target.slice(0, target.indexOf(WILDCARD)) as Segment[], [], true);
      for (const match of matches) {
        let value = rule.transform === 'constant' ? rule.constantValue! : match.value;
        if (value === MISSING) {
          if (Object.hasOwn(rule, 'defaultValue')) value = rule.defaultValue!;
          else if (rule.onMissing === 'skip') {
            result.skipped++;
            continue;
          } else throw new Error('Source 필드가 없습니다. 기본값 또는 누락 시 제외를 지정하세요.');
        }
        const path = target.map((token) =>
          token === WILDCARD ? match.index! : token,
        ) as Segment[];
        write(path, convert(value, rule.transform));
        result.applied++;
      }
    } catch (e) {
      result.errors.push({ ruleId: rule.id, message: (e as Error).message });
    }
  }
  if (result.errors.length) return { ...result, applied: 0 };
  try {
    // Never allow JSON.stringify to silently turn array holes into nulls.
    function check(value: Json) {
      if (Array.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          if (!Object.hasOwn(value, i))
            throw new Error(
              'Target 배열에 빈 인덱스가 있습니다. 연속 인덱스를 채우거나 기본값을 지정하세요.',
            );
          check(value[i]);
        }
      } else if (value !== null && typeof value === 'object') Object.values(value).forEach(check);
    }
    check(output);
    result.value = parseJson(stringify(output, 0));
  } catch (e) {
    result.errors.push({ message: (e as Error).message });
    result.applied = 0;
  }
  return result;
}
export function importMappingRules(text: string): MappingRule[] {
  const data = parseJson(text);
  let rules: unknown = data;
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    if (Object.keys(data).some((key) => key !== 'version' && key !== 'rules') || data.version !== 1)
      throw new Error('지원하지 않는 규칙 문서입니다. version: 1을 사용하세요.');
    rules = data.rules;
  }
  const checked = validateMappingRules(rules);
  if (checked.errors.length)
    throw new Error(checked.errors.map((e) => `${e.ruleId ?? '규칙'}: ${e.message}`).join('\n'));
  return checked.rules;
}
export function exportMappingRules(rules: MappingRule[]): string {
  const checked = validateMappingRules(rules);
  if (checked.errors.length) throw new Error(checked.errors.map((e) => e.message).join('\n'));
  const text = stringify({ version: 1, rules: checked.rules });
  parseJson(text); // Exported documents must remain valid under the same import budget.
  return text;
}
