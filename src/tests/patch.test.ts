import { describe, it, expect } from 'vitest';
import { applyPatch, parsePatch } from 'diff';
import {
  generatePatch,
  verifyRawPatch,
  validatePatchPath,
  MAX_PATCH_BYTES,
  type PatchOperation,
} from '../core/patch/patch';
const generate = (
  original: string,
  modified: string,
  context = 3,
  operation: PatchOperation = 'modify',
  filePath = 'src/sample.txt',
) => generatePatch({ original, modified, context, operation, filePath });
describe('raw Patch generation and exact application', () => {
  it.each([
    ['', 'a\n'],
    ['a\n', ''],
    ['', 'a'],
    ['a', ''],
    ['a\n', 'b\n'],
    ['a', 'b'],
    ['a\n', 'a'],
    ['a', 'a\n'],
    ['a\r\n', 'b\r\n'],
    ['a\r\n', 'b\n'],
    ['a\n', 'b\r\n'],
    ['a\r\nb\nc\r', 'a\nc\r\nd\r'],
    ['a\rb\r', 'a\rc\r'],
    ['한글 🌏\n', '한글 🌍\n'],
    ['\uFEFFa\n', '\uFEFFb\n'],
    ['\n', ''],
    ['', '\r\n'],
    ['a\nrepeat\na\nend\n', 'a\nchanged\na\nextra\nend'],
  ])('reconstructs exact original %j → %j', (original, modified) => {
    const result = generate(original, modified);
    expect(result.verified).toBe(true);
    expect(result.hunks).toBeGreaterThan(0);
    expect(
      applyPatch(original, result.text, { autoConvertLineEndings: false, fuzzFactor: 0 }),
    ).toBe(modified);
    expect(verifyRawPatch(original, modified, result.text).ok).toBe(true);
  });
  it('keeps whitespace, case and blank-line changes without display normalization', () => {
    const original = 'A\t \r\n\r\nend',
      modified = 'a\nend\n';
    const result = generate(original, modified);
    expect(result.text).toContain('-A\t \r\n');
    expect(result.text).toContain('+a\n');
    expect(result.text).toContain('\\ No newline at end of file');
    expect(original).toBe('A\t \r\n\r\nend');
    expect(modified).toBe('a\nend\n');
  });
  it('returns no exportable Patch for equal inputs, including empty inputs', () => {
    for (const value of ['', 'a', 'a\r\n']) {
      const result = generate(value, value);
      expect(result.text).toBe('');
      expect(result.hunks).toBe(0);
      expect(result.verified).toBe(true);
    }
  });
  it('builds valid line ranges and counts with zero context', () => {
    const result = generate('a\nb\nc\n', 'a\nx\nb\nc\n', 0);
    const h = parsePatch(result.text)[0].hunks[0];
    expect(result.text).toContain('@@ -1,0 +2,1 @@');
    expect(h).toMatchObject({ oldStart: 2, oldLines: 0, newStart: 2, newLines: 1 });
    expect(result.added).toBe(1);
    expect(result.removed).toBe(0);
  });
  it('honors context and emits separated hunks for distant changes', () => {
    const original = Array.from({ length: 30 }, (_, i) => `line${i}`).join('\n') + '\n',
      modified = original.replace('line2\n', 'changed2\n').replace('line25\n', 'changed25\n');
    expect(generate(original, modified, 1).hunks).toBe(2);
    expect(generate(original, modified, 20).hunks).toBe(1);
  });
  it('uses /dev/null only for explicit create/delete operations', () => {
    expect(generate('', 'a\n', 3, 'create').text).toContain(
      '--- /dev/null\n+++ b/src/sample.txt\n',
    );
    expect(generate('a\n', '', 3, 'delete').text).toContain(
      '--- a/src/sample.txt\n+++ /dev/null\n',
    );
    expect(generate('', 'a\n').text).toContain('--- a/src/sample.txt\n');
    expect(() => generate('not empty', 'x', 3, 'create')).toThrow('Original');
    expect(() => generate('x', 'not empty', 3, 'delete')).toThrow('Modified');
    expect(() => generate('', '', 3, 'create')).toThrow('내용 없는');
    expect(() => generate('', '', 3, 'delete')).toThrow('내용 없는');
  });
  it('quotes whitespace paths while preserving normal and Unicode file names', () => {
    expect(generate('a', 'b', 3, 'modify', 'folder/환경 설정.txt').text).toContain(
      '--- "a/folder/환경 설정.txt"\n',
    );
    expect(generate('a', 'b', 3, 'modify', 'src/a.ts').text).toContain('+++ b/src/a.ts\n');
  });
  it('rejects damaged patches, wrong source and mismatching expected targets', () => {
    const patch = generate('a\n', 'b\n').text;
    expect(verifyRawPatch('wrong\n', 'b\n', patch).ok).toBe(false);
    expect(verifyRawPatch('a\n', 'c\n', patch).ok).toBe(false);
    expect(verifyRawPatch('a\n', 'b\n', patch.replace('@@ -1,1 +1,1 @@', '@@ invalid @@')).ok).toBe(
      false,
    );
    expect(verifyRawPatch('a', 'b', '--- a/file\n+++ b/file\n').ok).toBe(false);
    expect(verifyRawPatch('a', 'b', '').ok).toBe(false);
    expect(verifyRawPatch('a', 'a', '').ok).toBe(true);
    expect(verifyRawPatch('a\n', 'b\n', patch + patch).ok).toBe(false);
  });
});
describe('Patch path, input and output guards', () => {
  it.each([
    '',
    '../x',
    'src/../x',
    '/etc/passwd',
    'C:/file',
    'src\\file',
    'src//file',
    './file',
    '.git/config',
    'folder/.GIT/config',
    'a\nb',
    'a\tb',
    'a\rb',
    'a"b',
    'a:b',
    ' file',
    'file ',
    'folder/',
    'a\0b',
    'a?b',
    'a*b',
  ])('rejects unsafe relative path %j', (path) => expect(() => validatePatchPath(path)).toThrow());
  it.each([-1, 21, 1.5, Infinity, NaN])('rejects context %s', (context) =>
    expect(() => generate('a', 'b', context)).toThrow('문맥'),
  );
  it('rejects oversized input, NUL and unpaired Unicode', () => {
    expect(() => generate('x'.repeat(5 * 1024 * 1024 + 1), '')).toThrow('5 MiB');
    expect(() => generate('a\0', 'b')).toThrow('바이너리');
    expect(() => generate('\uD800', 'x')).toThrow('Unicode');
    expect(() => validatePatchPath('\uDFFF')).toThrow('Unicode');
    expect(verifyRawPatch('a', 'b', 'x'.repeat(MAX_PATCH_BYTES + 1)).ok).toBe(false);
  });
  it('never mutates a structured Patch through repeated formatting', () => {
    const first = generate('', 'a\n', 0).text;
    expect(generate('', 'a\n', 0).text).toBe(first);
    expect(first).toContain('@@ -0,0 +1,1 @@');
  });
});
