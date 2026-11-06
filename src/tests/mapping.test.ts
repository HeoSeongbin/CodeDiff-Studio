import { describe, it, expect } from 'vitest';
import { type Json, parseJson, stringify } from '../core/json/value';
import { parseMappingPath, pathsConflict, WILDCARD } from '../core/mapping/path';
import {
  type MappingRule,
  applyMapping,
  importMappingRules,
  exportMappingRules,
  validateMappingRules,
} from '../core/mapping/engine';
import { compileDrafts, toDraft } from '../core/mapping/drafts';
const copy = (sourcePath: string, targetPath: string, id = 'rule'): MappingRule => ({
  id,
  sourcePath,
  targetPath,
  transform: 'copy',
});
const transform = (value: Json, kind: MappingRule['transform']) =>
  applyMapping({ value }, [{ ...copy('$.value', '$.result'), transform: kind }]);
function deepFreeze(value: Json): Json {
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach(deepFreeze);
    Object.freeze(value);
  }
  return value;
}
describe('mapping path grammar and collisions', () => {
  it('supports canonical escaped keys, root, arrays and wildcard', () => {
    expect(parseMappingPath('$')).toEqual([]);
    expect(parseMappingPath('$.users[*]["quoted.key"][0]')).toEqual([
      'users',
      WILDCARD,
      'quoted.key',
      0,
    ]);
    expect(
      parseMappingPath('$[' + JSON.stringify('a"b') + '][' + JSON.stringify('back\\slash') + ']'),
    ).toEqual(['a"b', 'back\\slash']);
  });
  it.each([
    'a.b',
    '$..a',
    '$[?(@.x)]',
    '$[(-1)]',
    '$[-1]',
    '$[01]',
    '$[30000]',
    '$.a[*][*]',
    '$.a;alert(1)',
    '$["unterminated]',
  ])('rejects unsupported paths %s', (path) => expect(() => parseMappingPath(path)).toThrow());
  it.each(['$.__proto__.x', '$["constructor"]', '$["prototype"]', '$["\\u005f_proto__"]'])(
    'rejects decoded dangerous keys %s',
    (path) => expect(() => parseMappingPath(path)).toThrow('위험'),
  );
  it('detects aliases, ancestor and wildcard/shape overlaps but permits siblings', () => {
    for (const [a, b] of [
      ['$.a', '$["a"]'],
      ['$.a', '$.a.b'],
      ['$.items[*].id', '$.items[0].id'],
      ['$.items[0]', '$.items.name'],
      ['$', '$.a'],
    ])
      expect(pathsConflict(parseMappingPath(a), parseMappingPath(b))).toBe(true);
    for (const [a, b] of [
      ['$.a', '$.b'],
      ['$.items[*].id', '$.items[*].name'],
      ['$[0].id', '$[1].name'],
    ])
      expect(pathsConflict(parseMappingPath(a), parseMappingPath(b))).toBe(false);
  });
});
describe('mapping core values and atomicity', () => {
  it('renames nested fields, keeps input immutable and clones copied subtrees', () => {
    const source = deepFreeze({ user: { id: 1, name: '홍' }, data: [{ x: 1 }] });
    const result = applyMapping(source, [
      copy('$.user.name', '$.account.displayName', 'name'),
      copy('$.data', '$.rows', 'rows'),
    ]);
    expect(result.errors).toEqual([]);
    expect(result.value).toEqual({ account: { displayName: '홍' }, rows: [{ x: 1 }] });
    expect(
      result.value &&
        typeof result.value === 'object' &&
        (result.value as Record<string, Json>).rows,
    ).not.toBe((source as Record<string, Json>).data);
    expect(stringify(source, 0)).toBe('{"user":{"id":1,"name":"홍"},"data":[{"x":1}]}');
  });
  it('supports whole root copies and scalar/array roots', () => {
    for (const source of [null, true, 1, 'x', [], { a: 1 }] as Json[])
      expect(applyMapping(source, [copy('$', '$')]).value).toEqual(source);
    expect(applyMapping({ a: 'x' }, [copy('$.a', '$[0]')]).value).toEqual(['x']);
    expect(applyMapping({}, []).value).toEqual({});
  });
  it('distinguishes absent/null and applies defaults only to absence', () => {
    const rules = [
      { ...copy('$.missing', '$.a', 'a'), defaultValue: 0 },
      { ...copy('$.null', '$.b', 'b'), defaultValue: 'fallback' },
    ];
    expect(applyMapping({ null: null }, rules).value).toEqual({ a: 0, b: null });
    expect(applyMapping({}, [{ ...copy('$.absent', '$.x'), defaultValue: null }]).value).toEqual({
      x: null,
    });
  });
  it('supports missing exclusion, disabled rules and falsey defaults', () => {
    const rules = [
      { ...copy('$.missing', '$.skip', 'skip'), onMissing: 'skip' as const },
      { ...copy('$.missing', '$.off', 'off'), enabled: false },
      { ...copy('$.missing', '$.flag', 'flag'), defaultValue: false },
    ];
    const result = applyMapping({}, rules);
    expect(result.value).toEqual({ flag: false });
    expect(result.skipped).toBe(1);
    expect(result.excluded).toBe(1);
    expect(result.applied).toBe(1);
  });
  it('rejects missing fields and returns no partial result on conversion errors', () => {
    const result = applyMapping({ a: 1, b: 'bad' }, [
      copy('$.a', '$.a', 'ok'),
      { ...copy('$.b', '$.b', 'bad'), transform: 'number' },
    ]);
    expect(result.value).toBeUndefined();
    expect(result.applied).toBe(0);
    expect(result.errors[0].ruleId).toBe('bad');
    expect(applyMapping({}, [copy('$.absent', '$.a')]).errors[0].message).toContain('없습니다');
  });
  it('inserts scalar, object, array and null constants as independent values', () => {
    const rules: MappingRule[] = [
      { id: 'a', targetPath: '$.x', transform: 'constant', constantValue: { a: [1, null] } },
    ];
    const result = applyMapping({}, rules);
    expect(result.value).toEqual({ x: { a: [1, null] } });
    expect((result.value as Record<string, Json>).x).not.toBe(rules[0].constantValue);
  });
  it('rejects duplicate and ancestor target conflicts before reading source', () => {
    const result = applyMapping({}, [
      copy('$.notThere', '$.a', 'one'),
      copy('$.b', '$.a.name', 'two'),
    ]);
    expect(result.value).toBeUndefined();
    expect(result.errors[0].message).toContain('충돌');
  });
  it('disabled rules do not collide but their unsafe paths still fail validation', () => {
    expect(
      applyMapping({ a: 1 }, [
        copy('$.a', '$.a', 'one'),
        { ...copy('$.a', '$.a', 'two'), enabled: false },
      ]).value,
    ).toEqual({ a: 1 });
    expect(
      applyMapping({}, [{ ...copy('$', '$.__proto__'), enabled: false }]).errors[0].message,
    ).toContain('위험');
  });
  it('makes deterministic results for repeated evaluation', () => {
    const source = { a: '1', b: false };
    const rules = [
      { ...copy('$.a', '$.x', 'a'), transform: 'number' as const },
      copy('$.b', '$.b', 'b'),
    ];
    expect(applyMapping(source, rules)).toEqual(applyMapping(source, rules));
  });
  it('never mutates prototype-looking copied payload keys', () => {
    const value = parseJson('{"__proto__":{"polluted":true},"constructor":"data"}');
    const result = applyMapping(value, [copy('$', '$.payload')]);
    expect(
      Object.hasOwn((result.value as Record<string, Json>).payload as object, '__proto__'),
    ).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
describe('mapping transformations', () => {
  it.each([
    ['42', 42],
    ['-1.25', -1.25],
    ['1e2', 100],
    [0, 0],
  ])('converts numeric value %s', (value, expected) =>
    expect(transform(value, 'number').value).toEqual({ result: expected }),
  );
  it.each([
    '',
    '  ',
    '01',
    '0x10',
    '+1',
    '1.2.3',
    'Infinity',
    '9007199254740993',
    true,
    null,
    {},
    [],
  ])('rejects unsafe/ambiguous numeric value %s', (value) =>
    expect(transform(value, 'number').value).toBeUndefined(),
  );
  it.each([
    [false, false],
    ['false', false],
    ['0', false],
    [0, false],
    ['true', true],
    ['1', true],
    [1, true],
  ])('converts boolean %s', (value, expected) =>
    expect(transform(value, 'boolean').value).toEqual({ result: expected }),
  );
  it.each(['False', 'yes', 2, null, {}, []])('rejects ambiguous boolean %s', (value) =>
    expect(transform(value, 'boolean').errors.length).toBeGreaterThan(0),
  );
  it('converts scalars to strings but never silently stringifies objects or null', () => {
    expect(transform(false, 'string').value).toEqual({ result: 'false' });
    expect(transform(1, 'string').value).toEqual({ result: '1' });
    for (const value of [null, [], {}]) expect(transform(value, 'string').value).toBeUndefined();
  });
  it('applies selected conversion to a missing-field default', () =>
    expect(
      applyMapping({}, [{ ...copy('$.a', '$.a'), transform: 'number', defaultValue: '42' }]).value,
    ).toEqual({ a: 42 }));
  it.each(['2024-02-29', '2026-11-06T14:03:02Z', '2026-11-06T14:03:02.1Z'])(
    'converts deterministic UTC date %s',
    (value) => {
      const result = transform(value, 'date');
      expect(result.errors).toEqual([]);
      expect((result.value as Record<string, Json>).result).toBe(new Date(value).toISOString());
    },
  );
  it.each([
    '2023-02-29',
    '2024-02-30',
    '2026-11-06T24:00:00Z',
    '11/06/2026',
    '2026-11-06T10:00:00',
    '2026-11-06T10:00:00+09:00',
    0,
    null,
  ])('rejects invalid/ambiguous date %s', (value) =>
    expect(transform(value, 'date').value).toBeUndefined(),
  );
});
describe('mapping arrays', () => {
  it('maps parallel per-item fields and keeps original indices', () => {
    const result = applyMapping(
      {
        users: [
          { id: '1', name: 'a' },
          { id: '2', name: 'b' },
        ],
      },
      [
        { ...copy('$.users[*].id', '$.rows[*].userId', 'id'), transform: 'number' },
        copy('$.users[*].name', '$.rows[*].name', 'name'),
      ],
    );
    expect(result.value).toEqual({
      rows: [
        { userId: 1, name: 'a' },
        { userId: 2, name: 'b' },
      ],
    });
  });
  it('maps constants per array item and supplies missing-item defaults', () => {
    const rules: MappingRule[] = [
      {
        ...copy('$.users[*]', '$.rows[*].active', 'active'),
        transform: 'constant',
        constantValue: true,
      },
      { ...copy('$.users[*].name', '$.rows[*].name', 'name'), defaultValue: 'N/A' },
    ];
    expect(applyMapping({ users: [{}, { name: null }] }, rules).value).toEqual({
      rows: [
        { active: true, name: 'N/A' },
        { active: true, name: null },
      ],
    });
  });
  it('preserves empty arrays and distinguishes an absent collection', () => {
    expect(applyMapping({ users: [] }, [copy('$.users[*].id', '$.rows[*].id')]).value).toEqual({
      rows: [],
    });
    expect(applyMapping([], [copy('$[*]', '$[*]')]).value).toEqual([]);
    expect(applyMapping({}, [copy('$.users[*]', '$.rows[*]')]).value).toBeUndefined();
    expect(
      applyMapping({}, [{ ...copy('$.users[*]', '$.rows[*]'), onMissing: 'skip' }]).value,
    ).toEqual({});
  });
  it('rejects holes instead of silently filling with null', () => {
    expect(applyMapping({ x: 1 }, [copy('$.x', '$.rows[2]')]).errors[0].message).toContain(
      '빈 인덱스',
    );
    expect(
      applyMapping({ users: [{}, { x: 1 }] }, [
        { ...copy('$.users[*].x', '$.rows[*]'), onMissing: 'skip' },
      ]).value,
    ).toBeUndefined();
  });
  it('allows nested explicit array indices and root arrays', () => {
    expect(applyMapping({ x: 'v' }, [copy('$.x', '$[0][0]')]).value).toEqual([['v']]);
    expect(applyMapping({ x: [1, 2] }, [copy('$.x', '$.rows')]).value).toEqual({ rows: [1, 2] });
  });
  it('rejects wildcard mismatches and non-array wildcard inputs', () => {
    expect(applyMapping({ x: [1] }, [copy('$.x[*]', '$.rows')]).errors[0].message).toContain('[*]');
    expect(applyMapping({ x: null }, [copy('$.x[*]', '$.rows[*]')]).errors[0].message).toContain(
      '배열',
    );
  });
});
describe('mapping imports, drafts and budgets', () => {
  it('round trips versioned documents and accepts rule arrays', () => {
    const rules = [
      { ...copy('$.x', '$.y'), defaultValue: null, enabled: false, onMissing: 'skip' as const },
    ];
    expect(importMappingRules(exportMappingRules(rules))).toEqual(rules);
    expect(importMappingRules(stringify(rules))).toEqual(rules);
  });
  it.each([
    '{"version":2,"rules":[]}',
    '{}',
    'null',
    '[null]',
    '[{"id":"x","targetPath":"$.a","transform":"eval"}]',
    '[{"id":"x","targetPath":"$.a","transform":"constant"}]',
  ])('rejects invalid import %s', (text) => expect(() => importMappingRules(text)).toThrow());
  it('rejects duplicate IDs, unknown keys, wrong field types and excess rules', () => {
    const rule = copy('$.a', '$.a');
    for (const rules of [
      [rule, rule],
      [{ ...rule, code: 'alert(1)' }],
      [{ ...rule, enabled: 'true' }],
      [{ ...rule, defaultValue: undefined }],
      [{ ...rule, sourcePath: 2 }],
      Array(101).fill(rule),
    ])
      expect(validateMappingRules(rules).errors.length).toBeGreaterThan(0);
  });
  it('preserves null/false defaults and rejects malformed draft literals', () => {
    const rule = { ...copy('$.a', '$.a'), defaultValue: false };
    expect(compileDrafts([toDraft(rule)]).rules).toEqual([rule]);
    const draft = toDraft({ ...rule, transform: 'constant', constantValue: null });
    expect(compileDrafts([draft]).rules[0].constantValue).toBeNull();
    expect(compileDrafts([{ ...draft, constantText: 'undefined' }]).errors[0].ruleId).toBe(rule.id);
  });
  it('blocks oversized output and excessive cloned values atomically', () => {
    const source = { s: 'x'.repeat(600000) };
    expect(
      applyMapping(source, [copy('$.s', '$.a', 'a'), copy('$.s', '$.b', 'b')]).value,
    ).toBeUndefined();
    const source2 = { a: Array(20000).fill(0) };
    expect(
      applyMapping(source2, [copy('$.a', '$.a', 'a'), copy('$.a', '$.b', 'b')]).errors[0].message,
    ).toContain('30,000');
  });
  it('rejects cyclic and unsafe programmatic input values', () => {
    const cyclic: Record<string, Json> = {};
    cyclic.self = cyclic;
    expect(applyMapping(cyclic, []).value).toBeUndefined();
    expect(applyMapping({ n: Infinity }, [copy('$', '$')]).value).toBeUndefined();
    expect(
      validateMappingRules([
        { id: 'x', targetPath: '$.x', transform: 'constant', constantValue: () => 0 },
      ]).errors,
    ).toHaveLength(1);
  });
});

describe('mapping portability and indexed field types', () => {
  it('rejects a combined export that exceeds the import document budget', () => {
    const rules: MappingRule[] = Array.from({ length: 2 }, (_, i) => ({
      id: String(i),
      targetPath: `$.field${i}`,
      transform: 'constant',
      constantValue: 'x'.repeat(600000),
    }));
    expect(() => exportMappingRules(rules)).toThrow('1 MiB');
  });
  it('preserves quoted numeric object keys and distinguishes them from array indices', () => {
    const result = applyMapping({ '0': 'data' }, [copy('$["0"]', '$["0"]')]);
    expect(result.value).toEqual({ '0': 'data' });
    expect(applyMapping(['data'], [copy('$[0]', '$.x')]).value).toEqual({ x: 'data' });
    expect(applyMapping({ '0': 'data' }, [copy('$[0]', '$.x')]).value).toBeUndefined();
  });
});
