import { describe, expect, it } from 'vitest';
import { csvColumns, fromCsv, toCsv } from '../core/json/csv';
import { executeJob } from '../workers/execute';
import type { Results } from '../workers/protocol';
import type { Json } from '../core/json/value';

describe('CSV scalar fidelity and explicit export validation', () => {
  it('retains numeric/boolean/null leaf types during flatten without changing source', () => {
    const input = [
      {
        amount: -12,
        nested: { value: -3, positive: 5, zero: 0, enabled: false, nil: null },
        array: [1, 2],
        empty: {},
      },
    ];
    const before = JSON.stringify(input);
    expect(csvColumns(input, true).rows[0]).toMatchObject({
      '/amount': -12,
      '/nested/value': -3,
      '/nested/enabled': false,
      '/nested/nil': null,
    });
    const output = toCsv(input, true);
    expect(output).not.toContain("'-12");
    expect(fromCsv(output, ',', true)).toEqual([
      {
        '/amount': -12,
        '/nested/value': -3,
        '/nested/positive': 5,
        '/nested/zero': 0,
        '/nested/enabled': false,
        '/nested/nil': null,
        '/array': '[1,2]',
        '/empty': '{}',
      },
    ]);
    expect(JSON.stringify(input)).toBe(before);
  });
  it.each([false, true])('retains formula protection for strings when flatten=%s', (flatten) => {
    const output = toCsv(
      [{ '=header': '=1+1', minus: '-12', plus: '+x', at: '@x', number: -12 }],
      flatten,
    );
    const row = fromCsv(output, ',', true) as Record<string, unknown>[];
    expect(Object.values(row[0])).toEqual(["'=1+1", "'-12", "'+x", "'@x", -12]);
    if (!flatten) expect(Object.keys(row[0])[0]).toBe("'=header");
  });
  it.each([{ value: [] }, { value: [{}] }, { value: [{}, {}] }] as { value: Json }[])(
    'reports empty/non-tabular data %j instead of silent output',
    ({ value }) => {
      expect(() => toCsv(value, false)).toThrow('데이터나 컬럼');
      expect(() => toCsv(value, true)).toThrow('데이터나 컬럼');
    },
  );
  it('allows empty cells but rejects selected empty headers and empty explicit column lists', () => {
    expect(fromCsv(toCsv([{ a: '' }], false))).toEqual([{ a: '' }]);
    expect(() => toCsv([{ '': 1 }], false)).toThrow('Header');
    expect(() => toCsv([{ '  ': 1 }], false)).toThrow('Header');
    expect(() => toCsv([{ a: 1 }], false, [])).toThrow('하나 이상');
    expect(fromCsv(toCsv([{ '': 1 }], true), ',', true)).toEqual([{ '/': 1 }]);
    expect(fromCsv(toCsv([{ '': 1, valid: 2 }], false, ['valid']), ',', true)).toEqual([
      { valid: 2 },
    ]);
  });
  it('retains missing cells, column order and escaped pointer paths', () => {
    const value: Json = [{ 'a/b': { '~': -4 }, name: '홍,길동' }, { name: 'Heo' }];
    const text = toCsv(value, true, ['/name', '/a~1b/~0'], ';');
    expect(text.split('\r\n')[0]).toBe('/name;/a~1b/~0');
    expect(fromCsv(text, ';', true)).toEqual([
      { '/name': '홍,길동', '/a~1b/~0': -4 },
      { '/name': 'Heo', '/a~1b/~0': '' },
    ]);
  });
});

describe('optional empty CSV records preserve meaningful empty cells', () => {
  it.each(['\n', '\r\n', '\r'])('skips only empty records with %j and preserves source', (eol) => {
    const input = `${eol}name,age${eol}Hong,30${eol}${eol}Heo,28${eol}${eol}`;
    expect(() => fromCsv(input, ',', true)).toThrow('Header');
    expect(fromCsv(input, ',', true, true)).toEqual([
      { name: 'Hong', age: 30 },
      { name: 'Heo', age: 28 },
    ]);
    expect(input.startsWith(eol)).toBe(true);
  });
  it.each([false, true])(
    'preserves quoted empty rows and delimiter-only rows with skip=%s',
    (skip) => {
      expect(fromCsv('a\r\n""\r\n', ',', false, skip)).toEqual([{ a: '' }]);
      expect(fromCsv('a,b\n,\n"",""\n', ',', false, skip)).toEqual([
        { a: '', b: '' },
        { a: '', b: '' },
      ]);
      expect(fromCsv('a\n \n', ',', false, skip)).toEqual([{ a: ' ' }]);
    },
  );
  it('distinguishes a bare empty record from a quoted empty cell in one-column CSV', () => {
    expect(fromCsv('a\n\n""\n')).toEqual([{ a: '' }, { a: '' }]);
    expect(fromCsv('a\n\n""\n', ',', false, true)).toEqual([{ a: '' }]);
  });
  it('preserves multiline quoted cells, escaped quotes and Unicode before empty rows', () => {
    const input = 'name,note\r\n"홍,길동","a\r\n\r\n""quoted"""\r\n\r\nHeo,x\r\n';
    expect(fromCsv(input, ',', false, true)).toEqual([
      { name: '홍,길동', note: 'a\r\n\r\n"quoted"' },
      { name: 'Heo', note: 'x' },
    ]);
  });
  it('keeps record numbers from the input after skipped empty records', () => {
    expect(() => fromCsv('a,b\n\n1\n', ',', false, true)).toThrow('레코드 3');
    expect(() => fromCsv('a,b\n \n', ',', false, true)).toThrow('컬럼 수');
  });
  it.each(['', '\n\n', 'a,a\n1,2', 'a\n"unterminated'])(
    'retains validation for %j even when skipping',
    (text) => {
      expect(() => fromCsv(text, ',', false, true)).toThrow();
    },
  );
  it('handles BOM, quoted empty headers and prototype-like fields without pollution', () => {
    expect(fromCsv('\uFEFF\n__proto__,constructor\nhello,world\n\n', ',', false, true)).toEqual([
      {
        __proto__: 'unused',
        constructor: 'world',
        ...Object.fromEntries([['__proto__', 'hello']]),
      },
    ]);
    expect(() => fromCsv('"",b\n1,2', ',', false, true)).toThrow('Header');
    expect(Object.hasOwn({}, 'polluted')).toBe(false);
  });
  it('retains conservative inference for unsafe numeric literals and leading zeroes', () => {
    expect(fromCsv('id,big,n\n\n001,9007199254740993,-12\n', ',', true, true)).toEqual([
      { id: '001', big: '9007199254740993', n: -12 },
    ]);
  });
  it('passes skip and scalar fidelity through the actual Worker dispatcher', async () => {
    const exported = (await executeJob({
      kind: 'jsonAction',
      action: 'toCsv',
      source: '[{"n":-12,"nested":{"n":-3}}]',
      flatten: true,
    })) as Results['jsonAction'];
    expect(exported.text).not.toContain("'-12");
    const imported = (await executeJob({
      kind: 'jsonAction',
      action: 'fromCsv',
      source: 'n\n\n-12\n',
      infer: true,
      skipEmptyRows: true,
    })) as Results['jsonAction'];
    expect(JSON.parse(imported.text)).toEqual([{ n: -12 }]);
    await expect(
      executeJob({ kind: 'jsonAction', action: 'fromCsv', source: 'a,b\n\n1,2' }),
    ).rejects.toThrow('컬럼 수');
    await expect(executeJob({ kind: 'jsonAction', action: 'toCsv', source: '[]' })).rejects.toThrow(
      '데이터나 컬럼',
    );
  });
});
