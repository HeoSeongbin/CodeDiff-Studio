import { describe, expect, it } from 'vitest';
import { compareText, type DiffOptions } from '../core/diff';
import { projectVisualDiff, visualCharacters } from '../core/visualDiff';
import { executeJob } from '../workers/execute';
import type { Results } from '../workers/protocol';

const defaults: DiffOptions = { ignoreWhitespace: false, ignoreCase: false, ignoreEol: false };
const project = (original: string, modified: string, options: Partial<DiffOptions> = {}) => {
  const flags = { ...defaults, ...options };
  return projectVisualDiff(compareText(original, modified, flags).hunks, flags);
};
describe('visual diff follows the authoritative text engine', () => {
  it.each([
    ['a  b\n', 'ab\n', { ignoreWhitespace: true }],
    ['  a\n', 'a\n', { ignoreWhitespace: true }],
    ['a  \n', 'a\n', { ignoreTrailingWhitespace: true }],
    ['head\n\nlast\n', 'head\nlast\n', { ignoreBlankLines: true }],
    ['a\n\n', 'a\n', { ignoreBlankLines: true }],
    ['Hello ΣΟΣ\n', 'hello σος\n', { ignoreCase: true }],
    ['a\r\nb\r\n', 'a\nb\n', { ignoreEol: true }],
    ['a\rb\r', 'a\nb\n', { ignoreEol: true }],
    [
      ' A  B \r\n\r\nend\r\n',
      'ab\nend\n',
      { ignoreWhitespace: true, ignoreBlankLines: true, ignoreCase: true, ignoreEol: true },
    ],
  ] as const)('does not project ignored-only changes in %j', (old, next, options) => {
    expect(project(old, next, options)).toMatchObject({ changes: [], endings: [], limited: false });
  });
  it('trailing whitespace never suppresses indentation or internal spaces', () => {
    for (const [old, next] of [
      ['  value\n', 'value\n'],
      ['a  b\n', 'a b\n'],
    ]) {
      const result = project(old, next, { ignoreTrailingWhitespace: true });
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0].inner.length).toBeGreaterThan(0);
    }
  });
  it('projects only the meaningful inline columns without rewriting ignored text', () => {
    const old = 'const Foo  = 1;\n',
      next = 'const foo=2;\n';
    const result = project(old, next, { ignoreWhitespace: true, ignoreCase: true });
    expect(result.changes[0].inner).toEqual([
      {
        original: {
          startLineNumber: 1,
          endLineNumber: 1,
          startColumn: old.indexOf('1') + 1,
          endColumn: old.indexOf('1') + 2,
        },
        modified: {
          startLineNumber: 1,
          endLineNumber: 1,
          startColumn: next.indexOf('2') + 1,
          endColumn: next.indexOf('2') + 2,
        },
      },
    ]);
  });
  it('retains contextual casing and source UTF16 columns for expanding/astral characters', () => {
    expect(visualCharacters('ΟΣ\n', { ...defaults, ignoreCase: true }).key).toBe('ος');
    const chars = visualCharacters(' İ😀x \n', {
      ...defaults,
      ignoreWhitespace: true,
      ignoreCase: true,
    });
    expect(chars.key).toBe('i\u0307😀x');
    expect(chars.columns).toEqual([
      { start: 2, end: 3 },
      { start: 2, end: 3 },
      { start: 3, end: 5 },
      { start: 3, end: 5 },
      { start: 5, end: 6 },
    ]);
  });
  it('does not color skipped blank lines within a physical change range', () => {
    const result = project('head\nbefore\n\nold\nend\n', 'head\nafter\nnew\nend\n', {
      ignoreBlankLines: true,
    });
    expect(
      result.changes.map((change) => [
        change.oldStart,
        change.oldEnd,
        change.newStart,
        change.newEnd,
      ]),
    ).toEqual([
      [2, 3, 2, 3],
      [4, 5, 3, 4],
    ]);
  });
  it('makes CRLF/CR/LF and EOF-only changes visible even if model text is identical', () => {
    const result = project('a\r\nb\r', 'a\nb\n');
    expect(result.changes).toHaveLength(1);
    expect(result.endings.map((marker) => marker.label)).toEqual(['CRLF', 'LF', 'CR', 'LF']);
    const eof = project('a\n', 'a', { ignoreEol: true });
    expect(eof.changes.length).toBeGreaterThan(0);
    expect(eof.endings.map((marker) => marker.label)).toEqual(['LF', 'EOF']);
  });
  it('does not color ignored characters when only the EOL remains significant', () => {
    const result = project('HELLO  \r\n', 'hello\n', { ignoreWhitespace: true, ignoreCase: true });
    expect(result.changes[0].inner).toEqual([]);
    expect(result.endings.map((marker) => marker.label)).toEqual(['CRLF', 'LF']);
  });
  it.each([
    ['', 'a\n'],
    ['a\n', ''],
    ['a', 'a\nnew'],
    ['a\n', 'a'],
    ['a', 'a\n'],
    ['', '\n'],
  ])('anchors empty/EOF insertions safely for %j', (old, next) => {
    for (const change of project(old, next).changes) {
      expect(change.oldStart).toBeGreaterThanOrEqual(1);
      expect(change.oldEnd).toBeGreaterThanOrEqual(change.oldStart);
      expect(change.newStart).toBeGreaterThanOrEqual(1);
      expect(change.newEnd).toBeGreaterThanOrEqual(change.newStart);
    }
  });
  it('bounds inline work without truncating source or losing changed lines', () => {
    const old = 'a'.repeat(20001);
    const result = project(old, 'b');
    expect(result.limited).toBe(true);
    expect(result.changes[0].inner[0].original.endColumn).toBe(20002);
    expect(old.length).toBe(20001);
  });
  it('adds visual metadata only for a Code Compare Worker request', async () => {
    const job = { kind: 'text' as const, original: 'a\r\n', modified: 'a\n', options: defaults };
    const result = (await executeJob({ ...job, visual: true })) as Results['text'];
    expect(result).toMatchObject({ added: 1, removed: 1 });
    expect(result.visual?.endings).toHaveLength(2);
    expect(await executeJob(job)).not.toHaveProperty('visual');
  });
});
