import { describe, expect, it } from 'vitest';
import { compareInline, compareText } from '../core/diff';
import { exportBytes } from '../core/export';
const defaults = { ignoreWhitespace: false, ignoreCase: false, ignoreEol: false };
describe('phase 2 text comparison', () => {
  it('ignores only trailing whitespace without hiding indentation or EOF', () => {
    const opts = { ...defaults, ignoreTrailingWhitespace: true };
    expect(compareText(' a  \r\n', ' a\r\n', opts).hunks).toHaveLength(0);
    expect(compareText(' a\n', 'a\n', opts).hunks).toHaveLength(1);
    expect(compareText('a \n', 'a', opts).hunks).toHaveLength(1);
  });
  it('retains physical line numbers and ranges when blank lines are ignored', () => {
    const r = compareText('\nfirst\n\nold\n\nlast\n', 'first\n\nnew\nlast\n', {
      ...defaults,
      ignoreBlankLines: true,
    });
    expect(r.hunks).toHaveLength(1);
    expect(r.hunks[0]).toMatchObject({ oldStart: 4, newStart: 3, oldEnd: 4, newEnd: 3 });
    expect(r.totalLines).toBe(10);
  });
  it('handles pure insert/remove anchors after skipped blanks', () => {
    const opts = { ...defaults, ignoreBlankLines: true };
    const inserted = compareText('a\n\nb\n', 'a\nx\nb\n', opts).hunks[0];
    expect(inserted).toMatchObject({ oldStart: 3, newStart: 2, oldLines: 0, newLines: 1 });
    const removed = compareText('a\nx\nb\n', 'a\n\nb\n', opts).hunks[0];
    expect(removed).toMatchObject({ oldStart: 2, newStart: 3, oldLines: 1, newLines: 0 });
    expect(compareText('\n \n', '', opts).hunks).toEqual([]);
  });
  it('keeps last physical line for a filtered block with gaps', () => {
    const h = compareText('a\n\nb\n', 'x\n\ny\n', { ...defaults, ignoreBlankLines: true }).hunks[0];
    expect(h).toMatchObject({
      oldStart: 1,
      oldEnd: 3,
      oldLines: 2,
      newStart: 1,
      newEnd: 3,
      newLines: 2,
    });
  });
  for (const unit of ['word', 'character'] as const)
    it(`reconstructs exact Unicode and line endings from ${unit} segments`, () => {
      const original = '한글 🌏\r\nconst old = 1;';
      const modified = '한글 🌍\r\nconst next = 2;\n';
      const result = compareInline(original, modified, unit);
      expect(result.limited).toBe(false);
      expect(
        result.changes
          .filter((p) => !p.added)
          .map((p) => p.value)
          .join(''),
      ).toBe(original);
      expect(
        result.changes
          .filter((p) => !p.removed)
          .map((p) => p.value)
          .join(''),
      ).toBe(modified);
      expect(result.changes.some((p) => p.added)).toBe(true);
    });
  it('bounds inline detail work and preserves fallback text', () => {
    const original = 'x'.repeat(20001);
    const r = compareInline(original, 'y', 'character');
    expect(r.limited).toBe(true);
    expect(r.changes[0].value).toBe(original);
  });
  it('exports current raw UTF8 text including CR, CRLF, Unicode and EOF', () => {
    for (const text of ['', '한글\r\na\rb\n', 'no final newline'])
      expect(new TextDecoder().decode(exportBytes(text))).toBe(text);
  });
});
