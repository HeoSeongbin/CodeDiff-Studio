import { describe, expect, it } from 'vitest';
import { compareText } from '../core/diff';
import { decodeFile, detectLanguage } from '../core/file';
import { exportBytes } from '../core/export';
import { executeJob } from '../workers/execute';
import type { Results } from '../workers/protocol';

const options = { ignoreWhitespace: false, ignoreCase: false, ignoreEol: false };
const physicalLines = (text: string) =>
  text ? text.split(/(?<=\n)|(?<=\r)(?!\n)/).filter(Boolean) : [];

describe('release accuracy invariants', () => {
  it('reconstructs 250 seeded mixed-EOL/repeated/Unicode edits with exact physical line positions and minimal edit counts', () => {
    let seed = 90210;
    const random = (size: number) => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed % size;
    };
    const contents = ['same', '', '한글 😀', '\t x ', 'same', '終'];
    const eols = ['\r\n', '\r', '\n'];
    const input = () =>
      Array.from(
        { length: random(14) },
        (_, i) => contents[random(contents.length)] + (i === 0 && random(2) ? '' : eols[random(3)]),
      ).join('');
    for (let trial = 0; trial < 250; trial++) {
      const original = input(),
        modified = input();
      const old = physicalLines(original),
        next = physicalLines(modified);
      const result = compareText(original, modified, options);
      // Independent insertion/deletion edit-distance oracle, not the diff library.
      const distance = Array.from(
        { length: old.length + 1 },
        () => Array(next.length + 1).fill(0) as number[],
      );
      for (let i = 0; i <= old.length; i++) distance[i][0] = i;
      for (let j = 0; j <= next.length; j++) distance[0][j] = j;
      for (let i = 1; i <= old.length; i++)
        for (let j = 1; j <= next.length; j++)
          distance[i][j] =
            old[i - 1] === next[j - 1]
              ? distance[i - 1][j - 1]
              : 1 + Math.min(distance[i - 1][j], distance[i][j - 1]);
      expect(result.added + result.removed).toBe(distance[old.length][next.length]);
      let cursor = 0;
      const rebuilt: string[] = [];
      for (const hunk of result.hunks) {
        rebuilt.push(...old.slice(cursor, hunk.oldStart - 1));
        for (const line of hunk.lines) {
          if (line.operation === 'removed') expect(line.content).toBe(old[line.oldLineNumber! - 1]);
          if (line.operation === 'added') {
            expect(line.content).toBe(next[line.newLineNumber! - 1]);
            rebuilt.push(line.content);
          }
        }
        cursor = hunk.oldStart - 1 + hunk.oldLines;
      }
      rebuilt.push(...old.slice(cursor));
      expect(rebuilt.join('')).toBe(modified);
      expect(new TextDecoder().decode(exportBytes(original))).toBe(original);
    }
  });

  it.each(['\n', '\r\n', '\r'])(
    'preserves decoded UTF16 Unicode and %j across Worker text/Patch/download adapters',
    async (eol) => {
      const original = `class 한글 {${eol}\tint 값 = 1;${eol}}`;
      const modified = original.replace('1;', '2;');
      const bytes = new Uint8Array(2 + original.length * 2);
      bytes.set([0xff, 0xfe]);
      const view = new DataView(bytes.buffer);
      for (let i = 0; i < original.length; i++)
        view.setUint16(2 + i * 2, original.charCodeAt(i), true);
      const before = bytes.slice();
      const decoded = decodeFile(bytes).text;
      const result = (await executeJob({
        kind: 'text',
        original: decoded,
        modified,
        options,
      })) as Results['text'];
      expect(result).toMatchObject({ added: 1, removed: 1 });
      expect(result.hunks[0]).toMatchObject({ oldStart: 2, newStart: 2 });
      const patch = (await executeJob({
        kind: 'patch',
        input: {
          original: decoded,
          modified,
          filePath: 'src/한글.java',
          context: 3,
          operation: 'modify',
        },
      })) as Results['patch'];
      const verified = (await executeJob({
        kind: 'patchVerify',
        original: decoded,
        modified,
        text: patch.text,
      })) as Results['patchVerify'];
      expect(verified.ok).toBe(true);
      expect(new TextDecoder().decode(exportBytes(decoded))).toBe(original);
      expect(bytes).toEqual(before);
    },
  );
});

describe('documented text file families', () => {
  it.each([
    ['JAVA', 'java'],
    ['cs', 'csharp'],
    ['py', 'python'],
    ['go', 'go'],
    ['kt', 'kotlin'],
    ['rs', 'rust'],
    ['c', 'c'],
    ['cpp', 'cpp'],
    ['h', 'cpp'],
    ['hpp', 'cpp'],
    ['html', 'html'],
    ['htm', 'html'],
    ['css', 'css'],
    ['scss', 'scss'],
    ['js', 'javascript'],
    ['jsx', 'javascript'],
    ['ts', 'typescript'],
    ['tsx', 'typescript'],
    ['vue', 'html'],
    ['sql', 'sql'],
    ['json', 'json'],
    ['jsonl', 'plaintext'],
    ['xml', 'xml'],
    ['yml', 'yaml'],
    ['yaml', 'yaml'],
    ['properties', 'ini'],
    ['ini', 'ini'],
    ['conf', 'plaintext'],
    ['env', 'plaintext'],
    ['txt', 'plaintext'],
    ['md', 'markdown'],
    ['log', 'plaintext'],
    ['sh', 'shell'],
    ['ps1', 'powershell'],
    ['bat', 'bat'],
    ['unknown', 'plaintext'],
  ])('detects .%s and compares it as text without executing content', (extension, language) => {
    expect(detectLanguage(`sample.${extension}`)).toBe(language);
    expect(compareText('before\r\n', 'after\r\n', options)).toMatchObject({ added: 1, removed: 1 });
  });
});
