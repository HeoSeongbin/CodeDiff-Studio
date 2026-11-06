import { describe, it, expect } from 'vitest';
import type { Json } from '../core/json/value';
import ts from 'typescript';
import {
  parseJson,
  sortKeys,
  structuralDiff,
  pathText,
  treeRows,
  stringify,
} from '../core/json/value';
import { generateSchema, generateTypes, validateSchema } from '../core/json/schema';
import { queryJson } from '../core/json/query';
import { toCsv, fromCsv, csvColumns } from '../core/json/csv';
describe('JSON parse and safety', () => {
  it.each(['null', 'true', 'false', '42', '"한글 🌏"', '[]', '{}'])(
    'parses standard JSON %s',
    (text) => expect(stringify(parseJson(text), 0)).toBe(text),
  );
  it.each(['// comment\n{}', '{"a":1,}', 'undefined', 'NaN', ''])(
    'rejects nonstandard JSON %s',
    (text) => expect(() => parseJson(text)).toThrow(),
  );
  it.each(['9007199254740993', '-9007199254740993', '1e400', '1e30'])(
    'blocks unsafe number %s before transformations',
    (text) => expect(() => parseJson(text)).toThrow('정밀도'),
  );
  it('does not flag numeric-looking keys/strings', () =>
    expect(parseJson('{"9007199254740993":"1e400"}')).toEqual({ '9007199254740993': '1e400' }));
  it('rejects oversized, too deep and too many nodes', () => {
    expect(() => parseJson('"' + 'a'.repeat(1024 * 1024) + '"')).toThrow('1 MiB');
    expect(() => parseJson('['.repeat(82) + '0' + ']'.repeat(82))).toThrow('깊이');
    expect(() => parseJson('[' + Array(30001).fill('0').join(',') + ']')).toThrow('30,000');
  });
  it('sorts deeply without mutation or prototype pollution', () => {
    const input = parseJson('{"z":{"b":2,"a":1},"__proto__":{"polluted":true},"a":0}');
    const before = stringify(input);
    const sorted = sortKeys(input);
    expect(Object.keys(sorted!)).toEqual(['__proto__', 'a', 'z']);
    expect(stringify(input)).toBe(before);
    expect(Object.hasOwn(sorted as object, '__proto__')).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});
describe('structural JSON diff', () => {
  it('ignores object order but distinguishes missing/null and scalar types', () => {
    expect(structuralDiff({ a: 1, b: null }, { b: null, a: 1 })).toEqual([]);
    expect(structuralDiff({ a: null }, { b: '1' }).map((c) => c.kind)).toEqual([
      'FIELD_REMOVED',
      'FIELD_ADDED',
    ]);
    expect(structuralDiff(1, '1')[0].kind).toBe('TYPE_CHANGED');
    expect(structuralDiff([], {})[0].kind).toBe('TYPE_CHANGED');
  });
  it('compares arrays by index, keeping length summary separate', () => {
    const changes = structuralDiff([{ id: 1 }, null], [{ id: 2 }, null, false]);
    expect(changes.map((c) => c.kind)).toEqual(['ARRAY_CHANGED', 'VALUE_MODIFIED', 'FIELD_ADDED']);
    expect(changes[1].path).toEqual([0, 'id']);
    expect(structuralDiff([1, 2], [2, 1])).toHaveLength(2);
  });
  it('handles deletion, nesting, escaped paths and literal dangerous keys', () => {
    const before = parseJson('{"__proto__":1,"a.b":{"a/b~":[1,2]}}'),
      after = parseJson('{"__proto__":2,"a.b":{"a/b~":[1]}}');
    expect(structuralDiff(before, after).map((c) => pathText(c.path))).toContain(
      '$["a.b"]["a/b~"][1]',
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('preserves both inputs', () => {
    const a = { a: [1, 2] },
      b = { a: [2, 3] };
    structuralDiff(a, b);
    expect(a).toEqual({ a: [1, 2] });
    expect(b).toEqual({ a: [2, 3] });
  });
});
describe('tree model and safe paths', () => {
  it('only walks expanded branches unless searching', () => {
    const value = { a: { b: 1 }, z: '서울' };
    expect(treeRows(value, () => false)).toHaveLength(1);
    expect(treeRows(value, () => true)).toHaveLength(4);
    expect(treeRows(value, () => false, '서울')[0].path).toEqual(['z']);
    expect(treeRows(value, () => false, 'b')[0].path).toEqual(['a', 'b']);
  });
  it('queries root, wildcard, recursive, slices and escaped property names', () => {
    const value = { users: [{ id: 1 }, { id: 2 }], 'a/b~': null };
    expect(queryJson(value, '$')[0].value).toEqual(value);
    expect(queryJson(value, '$.users[*].id').map((r) => r.value)).toEqual([1, 2]);
    expect(queryJson(value, '$..id').map((r) => r.value)).toEqual([1, 2]);
    expect(queryJson(value, '$.users[0:1]')).toHaveLength(1);
    expect(queryJson(value, '$["a/b~"]')[0]).toMatchObject({
      path: ['a/b~'],
      jsonPath: '$["a/b~"]',
      value: null,
    });
    expect(queryJson(value, '$.missing')).toEqual([]);
  });
  it.each([
    '$..[?(@.x)]',
    '$[(@.length-1)]',
    '$.x;alert(1)',
    '$[?globalThis.process.exit()]',
    'users',
    '$.users[',
    '$.users[0:2:0]',
  ])('rejects code or invalid JSONPath %s', (path) =>
    expect(() => queryJson({ users: [] }, path)).toThrow(),
  );
});
describe('Schema and TypeScript inference', () => {
  it('generates nullable unions, optional fields, nested and mixed array schema', () => {
    const value: Json = [
      { id: 1, name: 'A', extra: null },
      { id: 2, name: null },
    ];
    const schema = generateSchema(value);
    expect(schema.items?.required).toEqual(['id', 'name']);
    expect(schema.items?.properties?.name.anyOf).toEqual([{ type: 'string' }, { type: 'null' }]);
    expect(validateSchema(value, stringify(schema)).valid).toBe(true);
    expect(validateSchema([{ id: 'bad', name: null }], stringify(schema)).valid).toBe(false);
    expect(generateSchema([]).items).toEqual({});
  });
  it('reports required and type errors and never mutates source', () => {
    const value = { x: '1' };
    const result = validateSchema(
      value,
      '{"type":"object","properties":{"x":{"type":"number"}},"required":["x","y"]}',
    );
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(2);
    expect(value.x).toBe('1');
  });
  it('rejects invalid schemas and unresolved remote references without loading', () => {
    expect(() => validateSchema({}, '{')).toThrow();
    expect(() => validateSchema({}, '{"type":"invalid"}')).toThrow();
    expect(() => validateSchema({}, '{"$ref":"https://example.com/schema.json"}')).toThrow();
    expect(validateSchema(null, 'false').valid).toBe(false);
  });
  it('generates separate nested interfaces, unions and optional members', () => {
    const code = generateTypes(
      [
        { id: 1, name: 'A', 'bad-key': null },
        { id: 2, name: null },
      ],
      'Root',
      false,
      true,
    );
    expect(code).toContain('export interface RootValueItem');
    expect(code).toContain('"bad-key"?: null');
    expect(code).toContain('string | null');
    expect(code).toContain('export type Root =');
    expect(
      ts.transpileModule(code, { reportDiagnostics: true, compilerOptions: { strict: true } })
        .diagnostics,
    ).toEqual([]);
  });
  it('handles aliases, empty/mixed arrays, nested naming collisions and dangerous property names', () => {
    const code = generateTypes(
      parseJson('{"empty":[],"mix":[null,1,"x"],"__proto__":{},"a-b":{},"a_b":{}}'),
      'Root',
      true,
      false,
    );
    expect(code).toContain('type Root =');
    expect(code).not.toContain('export ');
    expect(code).toContain('(unknown)[]');
    expect(code).toContain('(null | number | string)[]');
    expect(code).toContain('Root_a_b2');
  });
  it.each(['class', '1Root', 'a b', 'interface', 'type', 'default'])(
    'rejects invalid type name %s',
    (name) => expect(() => generateTypes({}, name, false, true)).toThrow('식별자'),
  );
});
describe('CSV conversions', () => {
  it('round trips quotes, commas, multiline and Unicode as string cells', () => {
    const value = [{ name: '홍,길동', message: '"Hello"\nworld', empty: '' }];
    expect(fromCsv(toCsv(value, false))).toEqual(value);
  });
  it('supports selection order, delimiters and collision-free nested pointers', () => {
    const value = [{ 'a/b': 1, a: { b: 2 }, name: 'X' }];
    const { fields } = csvColumns(value, true);
    expect(fields).toEqual(['/a~1b', '/a/b', '/name']);
    const csv = toCsv(value, true, ['/name', '/a/b'], ';');
    expect(csv.split('\r\n')[0]).toBe('/name;/a/b');
    expect(fromCsv(csv, ';')).toEqual([{ '/name': 'X', '/a/b': '2' }]);
  });
  it('escapes spreadsheet formulae including headers', () => {
    const csv = toCsv([{ '=HEADER': '=1+1', safe: '@evil' }], false);
    expect(csv).toContain("'=HEADER");
    expect(csv).toContain("'=1+1");
    expect(csv).toContain("'@evil");
  });
  it('infers safe values while preserving unsafe numbers and leading zeroes', () => {
    expect(fromCsv('n,b,z,e,id\n9007199254740993,true,null,,001', ',', true)).toEqual([
      { n: '9007199254740993', b: true, z: null, e: '', id: '001' },
    ]);
  });
  it('rejects malformed columns, duplicate/empty headers and non-object arrays', () => {
    for (const text of ['a,a\n1,2', ',b\n1,2', 'a,b\n1', 'a\n"unterminated'])
      expect(() => fromCsv(text)).toThrow();
    expect(() => toCsv([1], false)).toThrow('객체 배열');
    expect(() => toCsv([{ a: 1 }], false, ['missing'])).toThrow();
  });
  it('treats __proto__ and constructor as data without pollution', () => {
    const rows = fromCsv('__proto__,constructor\nhello,world') as Record<string, unknown>[];
    expect(Object.hasOwn(rows[0], '__proto__')).toBe(true);
    expect(rows[0]['__proto__']).toBe('hello');
    expect(toCsv(parseJson('[{"__proto__":"safe"}]'), false)).toContain('safe');
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('JSON edge-case regressions', () => {
  it('round trips copied JSONPath keys with brackets, quotes, backslashes and numeric strings', () => {
    const value: Json = { 'a]b': { 'quote"key': { 'back\\slash': { '0': true } } } };
    const leaf = treeRows(value, () => true).at(-1)!;
    expect(queryJson(value, pathText(leaf.path))[0]).toMatchObject({
      path: leaf.path,
      value: true,
    });
    expect(queryJson({}, '$.constructor')).toEqual([]);
    expect(queryJson({}, '$["__proto__"]')).toEqual([]);
  });
  it('blocks repeated recursive searches that could amplify result count', () =>
    expect(() => queryJson({ a: { b: 1 } }, '$..*..*')).toThrow('한 번'));
  it('Schema validation handles prototype-looking own fields as data', () => {
    const value = parseJson('{"__proto__":{"polluted":true},"constructor":"x"}');
    const schema = generateSchema(value);
    expect(validateSchema(value, stringify(schema)).valid).toBe(true);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
  it('uses strict TypeScript semantic validation for inferred optional unions', () => {
    const code = generateTypes(
      parseJson('[{"x":1,"nullable":null},{"x":"a","extra":true}]'),
      'Root',
      false,
      true,
    );
    const file = '/generated.ts';
    const options = { noLib: true, strict: true, noEmit: true };
    const host = ts.createCompilerHost(options);
    host.getSourceFile = (name, language) =>
      name === file ? ts.createSourceFile(name, code, language, true) : undefined;
    host.fileExists = (name) => name === file;
    host.readFile = (name) => (name === file ? code : undefined);
    const program = ts.createProgram([file], options, host);
    expect(program.getSyntacticDiagnostics()).toEqual([]);
    expect(program.getSemanticDiagnostics()).toEqual([]);
  });
});

describe('CSV empty record fidelity', () => {
  it('round trips a single empty column and preserves quoted empty records', () => {
    expect(fromCsv(toCsv([{ a: '' }, { a: 'x' }, { a: '' }], false))).toEqual([
      { a: '' },
      { a: 'x' },
      { a: '' },
    ]);
    expect(fromCsv('a\r\n""\r\n')).toEqual([{ a: '' }]);
    expect(fromCsv('a\r\n')).toEqual([]);
  });
});
