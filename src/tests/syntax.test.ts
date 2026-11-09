import { beforeAll, describe, expect, it } from 'vitest';
import { Language, Parser } from 'web-tree-sitter';
import { compareSyntax, extractSymbols, MAX_SYNTAX_BYTES } from '../core/syntax/compare';
const grammars = new Map<string, Language>();
beforeAll(async () => {
  await Parser.init();
  for (const name of ['java', 'c_sharp', 'python', 'javascript', 'typescript'])
    grammars.set(
      name,
      await Language.load(`node_modules/tree-sitter-wasms/out/tree-sitter-${name}.wasm`),
    );
});
describe('real WASM syntax integration', () => {
  for (const [language, before, after] of [
    [
      'java',
      'class A { int f(int x) { return x; } }',
      'class A { int f(int x, int y) { return y; } }',
    ],
    [
      'c_sharp',
      'class A { int F(int x) { return x; } }',
      'class A { int F(int x, int y) { return y; } }',
    ],
    ['python', 'def f(x):\n return x\n', 'def f(x, y):\n return y\n'],
    ['javascript', 'function f(x) { return x; }', 'function f(x,y) { return y; }'],
    [
      'typescript',
      'function f(x: number) { return x; }',
      'function f(x: number,y: number) { return y; }',
    ],
  ])
    it(`${language}: parameters and block changes`, () => {
      const result = compareSyntax(before, after, grammars.get(language)!);
      expect(
        result.changes.some(
          (c) => c.details.includes('매개변수 변경') && c.details.includes('코드 블록 변경'),
        ),
      ).toBe(true);
    });
  it('recognizes imports and classes independently', () => {
    const result = compareSyntax(
      'import a.B; class A {}',
      'import a.C; class B {}',
      grammars.get('java')!,
    );
    expect(result.changes.filter((c) => c.type === 'added')).toHaveLength(2);
    expect(result.changes.filter((c) => c.type === 'removed')).toHaveLength(2);
  });
  it('only labels unique same-body function renames as candidates', () => {
    expect(
      compareSyntax('def old(x):\n return x', 'def new(x):\n return x', grammars.get('python')!)
        .changes[0].type,
    ).toBe('rename-candidate');
    expect(
      compareSyntax(
        'def old(x):\n return x',
        'def a(x):\n return x\ndef b(x):\n return x',
        grammars.get('python')!,
      ).changes.every((c) => c.type !== 'rename-candidate'),
    ).toBe(true);
  });
  it('ignores comments and spacing while preserving string contents', () => {
    const grammar = grammars.get('javascript')!;
    expect(
      compareSyntax('function f(){return "a b"}', '/*hi*/ function f() { return "a b" }', grammar)
        .changes,
    ).toHaveLength(0);
    expect(
      compareSyntax('function f(){return "a b"}', 'function f(){return "ab"}', grammar).changes,
    ).toHaveLength(1);
  });
  it('preserves physical lines, Unicode and CRLF inputs', () => {
    const source = '# 한글\r\n\r\ndef 인사(x):\r\n return x\r\n';
    const symbols = extractSymbols(source, grammars.get('python')!);
    expect(symbols[0]).toMatchObject({ name: '인사', line: 3, endLine: 4 });
    expect(source).toContain('\r\n');
  });
  it('rejects parse errors and oversize source', () => {
    expect(() => extractSymbols('class {', grammars.get('java')!)).toThrow('구문 오류');
    expect(() => extractSymbols(' '.repeat(MAX_SYNTAX_BYTES + 1), grammars.get('java')!)).toThrow(
      '1 MiB',
    );
  });
  it('matches reordered overloads by parameters', () => {
    const a = 'class A { int f(int x){return x;} int f(String x){return 1;} }';
    const b = 'class A { int f(String x){return 1;} int f(int x){return x;} }';
    expect(
      compareSyntax(a, b, grammars.get('java')!).changes.filter(
        (c) => c.before?.kind === 'function',
      ),
    ).toHaveLength(0);
  });
});

describe('syntax conservative matching and limits', () => {
  it('body-only changes do not claim declaration changes', () => {
    const result = compareSyntax(
      'function f(){return 1}',
      'function f(){return 2}',
      grammars.get('javascript')!,
      'javascript',
    );
    expect(result.changes[0].details).toEqual(['코드 블록 변경']);
  });
  it('does not collapse ambiguous duplicate signatures', () => {
    const result = compareSyntax(
      'def f(x):\n return 1\ndef f(x):\n return 2',
      'def f(x):\n return 3',
      grammars.get('python')!,
      'python',
    );
    expect(result.changes.map((c) => c.type).sort()).toEqual(['added', 'removed', 'removed']);
  });
  it('rejects excessive AST depth before fingerprint extraction', () => {
    expect(() =>
      extractSymbols(
        'def f():\n return ' + '('.repeat(150) + '1' + ')'.repeat(150),
        grammars.get('python')!,
        'python',
      ),
    ).toThrow('깊이');
  });
  it('separates nested class scopes and detects method additions', () => {
    const result = compareSyntax(
      'class A { class B {} }',
      'class A { class B { void f(){} } }',
      grammars.get('java')!,
      'java',
    );
    expect(result.changes.find((c) => c.type === 'added')?.after).toMatchObject({
      name: 'f',
      scope: '/class:A/class:B',
    });
  });
});
