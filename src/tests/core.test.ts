import { describe, it, expect } from 'vitest';
import { compareText } from '../core/diff';
import { decodeFile, detectLanguage, MAX_BYTES } from '../core/file';
const options = { ignoreWhitespace: false, ignoreCase: false, ignoreEol: false };
describe('text diff', () => {
  it('identical and empty inputs', () => {
    expect(compareText('', '', options).hunks).toEqual([]);
    expect(compareText('한글\n', '한글\n', options).hunks).toEqual([]);
  });
  it('counts additions and exact line numbers', () => {
    const r = compareText('a\nb\n', 'a\nx\nb\n', options);
    expect(r.added).toBe(1);
    expect(r.removed).toBe(0);
    expect(r.hunks[0].newStart).toBe(2);
  });
  it('removal at end and one empty side', () => {
    expect(compareText('a\nb', 'a\n', options).removed).toBe(1);
    expect(compareText('a', '', options).removed).toBe(1);
    expect(compareText('', 'a', options).added).toBe(1);
  });
  it('groups replacements as heuristic modifications', () => {
    const h = compareText('a\nx\nz', 'a\ny\nz', options).hunks[0];
    expect(h.kind).toBe('modified');
    expect(h.oldStart).toBe(2);
    expect(h.newStart).toBe(2);
  });
  it('multiple blocks and repeated lines', () => {
    const r = compareText('a\nx\na\nb\nz', 'a\ny\na\nb\nq', options);
    expect(r.hunks).toHaveLength(2);
    expect(r.hunks[1].oldStart).toBe(5);
  });
  it('preserves newline differences and final newline', () => {
    expect(compareText('a\n', 'a', options).hunks).toHaveLength(1);
    expect(compareText('a\r\n', 'a\n', { ...options, ignoreEol: true }).hunks).toHaveLength(0);
    expect(compareText('a\r', 'a\n', options).hunks).toHaveLength(1);
  });
  it('normalizes comparison only', () => {
    const original = ' A\t b\r\n';
    expect(
      compareText(original, 'ab\n', { ignoreWhitespace: true, ignoreCase: true, ignoreEol: true })
        .hunks,
    ).toHaveLength(0);
    expect(original).toBe(' A\t b\r\n');
  });
  it('Unicode changes', () =>
    expect(compareText('안녕 🌏', '안녕 🌍', options).hunks[0].kind).toBe('modified'));
});
describe('file loading', () => {
  it('UTF8 and BOM', () => {
    expect(decodeFile(new TextEncoder().encode('한글')).text).toBe('한글');
    expect(decodeFile(new Uint8Array([239, 187, 191, 65])).text).toBe('A');
  });
  it('UTF16 endian detection', () => {
    expect(decodeFile(new Uint8Array([255, 254, 65, 0])).text).toBe('A');
    expect(decodeFile(new Uint8Array([254, 255, 0, 65])).text).toBe('A');
  });
  it('rejects invalid encoding, binary, oversized input', () => {
    expect(() => decodeFile(new Uint8Array([255]))).toThrow('인코딩');
    expect(() => decodeFile(new Uint8Array([0, 1]))).toThrow('바이너리');
    expect(() => decodeFile(new Uint8Array(MAX_BYTES + 1))).toThrow('크기');
  });
  it('supports empty input and requested languages', () => {
    expect(decodeFile(new Uint8Array()).text).toBe('');
    for (const [file, language] of [
      ['a.java', 'java'],
      ['a.py', 'python'],
      ['a.cs', 'csharp'],
      ['a.html', 'html'],
      ['a.unknown', 'plaintext'],
    ])
      expect(detectLanguage(file)).toBe(language);
  });
});
