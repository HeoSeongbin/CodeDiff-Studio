import { describe, it, expect, vi } from 'vitest';
import * as textEngine from '../core/diff';
import {
  type FolderSelection,
  type FolderEntry,
  type FolderOptions,
  compareFolders,
  eligibleFolder,
  browserFolder,
  normalizeFolderPath,
  defaultFolderOptions,
  MAX_FOLDER_BYTES,
  MAX_FOLDER_FILES,
  MAX_CANDIDATES,
  exportFolderReport,
} from '../core/folder/engine';
import { folderTree } from '../core/folder/tree';
const encode = (text: string) => new TextEncoder().encode(text);
function file(
  path: string,
  data: string | number[] | Uint8Array = '',
  declared?: number,
): FolderEntry {
  const bytes = typeof data === 'string' ? encode(data) : Uint8Array.from(data);
  return {
    path,
    file: {
      name: path.split('/').at(-1)!,
      size: declared ?? bytes.length,
      arrayBuffer: vi.fn(async () => bytes.slice().buffer),
    },
  };
}
const folder = (files: FolderEntry[], name = 'root'): FolderSelection => ({ name, files });
const opts = (patch: Partial<FolderOptions> = {}): FolderOptions => ({
  ...defaultFolderOptions,
  excludes: [...defaultFolderOptions.excludes],
  ...patch,
});
const compare = (old: FolderEntry[], next: FolderEntry[], options = opts()) =>
  compareFolders(folder(old, 'old'), folder(next, 'new'), options, {
    yieldControl: () => Promise.resolve(),
  });
describe('relative folder paths and native selection', () => {
  it('strips only the chosen root and preserves nested Unicode paths', () => {
    const a = file('src/한글.ts', 'x');
    const f = { ...a.file, webkitRelativePath: 'project/src/한글.ts' };
    expect(browserFolder([f])).toEqual({
      name: 'project',
      files: [{ path: 'src/한글.ts', file: f }],
    });
    expect(normalizeFolderPath('dir with spaces/constructor/__proto__.txt')).toBe(
      'dir with spaces/constructor/__proto__.txt',
    );
  });
  it.each([
    '',
    '../a',
    'root/../a',
    './a',
    '/root/a',
    'C:/a',
    'a\\b',
    'a//b',
    'a/',
    'a\0b',
    'a\nb',
  ])('rejects unsafe path %j', (path) => expect(() => normalizeFolderPath(path)).toThrow());
  it('rejects unavailable native paths, empty/mixed roots and excessive metadata', () => {
    expect(() => browserFolder([])).toThrow('빈 폴더');
    const a = file('a').file;
    expect(() => browserFolder([{ ...a, webkitRelativePath: '' }])).toThrow();
    expect(() =>
      browserFolder([
        { ...a, webkitRelativePath: 'one/a' },
        { ...a, webkitRelativePath: 'two/a' },
      ]),
    ).toThrow('하나의');
    expect(() =>
      browserFolder(Array(MAX_CANDIDATES + 1).fill({ ...a, webkitRelativePath: 'root/a' })),
    ).toThrow('메타데이터');
  });
});
describe('folder preflight filters and budgets', () => {
  it('excludes default directory segments before reading any contents', async () => {
    const excluded = [
      'node_modules/a.js',
      '.git/config',
      'dist/a.js',
      'build/a',
      'target/a',
      'bin/a',
      'obj/a',
    ].map((path) => file(path, 'ignored'));
    const visible = file('src/app.ts', 'x');
    const result = await compare([...excluded, visible], [file('src/app.ts', 'x')]);
    expect(result.excludedOriginal).toBe(7);
    for (const item of excluded) expect(item.file.arrayBuffer).not.toHaveBeenCalled();
    expect(result.stats.unchanged).toBe(1);
  });
  it('supports root-relative subtree exclusion and editable defaults', () => {
    const data = folder([
      file('src/generated/a.ts'),
      file('other/src/generated/b.ts'),
      file('node_modules/c.js'),
    ]);
    expect(
      [...eligibleFolder(data, opts({ excludes: ['src/generated'] })).entries.values()].map(
        (v) => v.path,
      ),
    ).toEqual(['other/src/generated/b.ts', 'node_modules/c.js']);
    expect(eligibleFolder(data, opts({ excludes: [] })).entries.size).toBe(3);
  });
  it('filters extensions case-insensitively and includes dot files when requested', () => {
    const data = folder([file('A.TS'), file('b.json'), file('.env'), file('README')]);
    expect(
      [...eligibleFolder(data, opts({ extensions: ['.ts', 'env'] })).entries.values()].map(
        (v) => v.path,
      ),
    ).toEqual(['A.TS', '.env']);
    expect(eligibleFolder(data, opts()).entries.size).toBe(4);
  });
  it('fails before IO for ambiguous case-folded or duplicate paths', async () => {
    const a = file('A.ts'),
      b = file('a.ts');
    expect(() => eligibleFolder(folder([a, b]), opts({ caseSensitive: false }))).toThrow('충돌');
    expect(() => eligibleFolder(folder([a, a]), opts())).toThrow('충돌');
    expect(a.file.arrayBuffer).not.toHaveBeenCalled();
    expect(eligibleFolder(folder([a, b]), opts()).entries.size).toBe(2);
  });
  it('enforces eligible count, total read bytes and encoding policy before IO', () => {
    const one = file('a', 'x', 5 * 1024 * 1024);
    expect(() =>
      eligibleFolder(
        folder(Array.from({ length: 5 }, (_, i) => ({ ...one, path: `f${i}` }))),
        opts(),
      ),
    ).toThrow('20 MiB');
    expect(() =>
      eligibleFolder(
        folder(Array.from({ length: MAX_FOLDER_FILES + 1 }, (_, i) => file(String(i)))),
        opts(),
      ),
    ).toThrow('1,000');
    expect(() => eligibleFolder(folder([one]), opts({ encoding: 'unknown' }))).toThrow('인코딩');
    expect(one.file.arrayBuffer).not.toHaveBeenCalled();
    expect(MAX_FOLDER_BYTES).toBe(20 * 1024 * 1024);
  });
});
describe('folder status accuracy and line statistics', () => {
  it('matches paths across different root names and computes adds/removes/modifications', async () => {
    const result = await compare(
      [file('src/same.ts', 'same\n'), file('old.txt', 'old\n'), file('src/change.ts', 'a\nb\n')],
      [file('src/same.ts', 'same\n'), file('new.txt', 'new\n'), file('src/change.ts', 'a\nx\nb\n')],
    );
    expect(result.rows.map((r) => [r.path, r.status])).toEqual([
      ['new.txt', 'ADDED_FILE'],
      ['old.txt', 'REMOVED_FILE'],
      ['src/change.ts', 'MODIFIED_FILE'],
      ['src/same.ts', 'UNCHANGED_FILE'],
    ]);
    expect(result.stats).toMatchObject({
      added: 1,
      removed: 1,
      modified: 1,
      unchanged: 1,
      total: 4,
      folders: 1,
      addedLines: 2,
      removedLines: 1,
      errors: 0,
    });
  });
  it('does not infer file or directory renames by equal content', async () => {
    const result = await compare([file('old/a.txt', 'same')], [file('new/a.txt', 'same')]);
    expect(result.rows.map((r) => r.status)).toEqual(['ADDED_FILE', 'REMOVED_FILE']);
  });
  it('distinguishes empty files, absent files and empty selections', async () => {
    expect((await compare([file('empty')], [file('empty')])).rows[0]).toMatchObject({
      status: 'UNCHANGED_FILE',
      added: 0,
      removed: 0,
    });
    expect((await compare([], [file('empty')])).rows[0]).toMatchObject({
      status: 'ADDED_FILE',
      added: 0,
    });
    expect((await compare([file('empty')], [])).rows[0].status).toBe('REMOVED_FILE');
    expect((await compare([], [])).stats.total).toBe(0);
  });
  it.each([
    ['a\n', 'a'],
    ['a\r\n', 'a\n'],
    ['한글 🌏', '한글 🌍'],
    ['a\rb\r', 'a\rc\r'],
    ['a\nx\na\n', 'a\ny\na\n'],
  ])('preserves EOF/EOL/Unicode/repeated text differences %j / %j', async (a, b) =>
    expect((await compare([file('a', a)], [file('a', b)])).rows[0].status).toBe('MODIFIED_FILE'),
  );
  it('ignores whitespace only when requested and reports byte inequality', async () => {
    const result = await compare(
      [file('a.ts', ' a\t b\n')],
      [file('a.ts', 'ab\n')],
      opts({ ignoreWhitespace: true }),
    );
    expect(result.rows[0]).toMatchObject({
      status: 'UNCHANGED_FILE',
      byteEqual: false,
      ignoredWhitespace: true,
      added: 0,
      removed: 0,
    });
    expect(
      (
        await compare(
          [file('a.ts', 'A\n')],
          [file('a.ts', 'a\n')],
          opts({ ignoreWhitespace: true }),
        )
      ).rows[0].status,
    ).toBe('MODIFIED_FILE');
  });
  it('treats BOM and encoding changes as modifications despite identical decoded text', async () => {
    const old = file('a.txt', [239, 187, 191, 65]),
      next = file('a.txt', 'A');
    const r = await compare([old], [next], opts({ ignoreWhitespace: true }));
    expect(r.rows[0]).toMatchObject({ status: 'MODIFIED_FILE', added: 0, removed: 0 });
    expect((await compare([file('a.txt', [255, 254, 65, 0])], [next])).rows[0].note).toContain(
      '인코딩',
    );
  });
  it('supports explicit UTF16 without BOM', async () => {
    const r = await compare(
      [file('a', [65, 0])],
      [file('a', [66, 0])],
      opts({ encoding: 'utf-16le' }),
    );
    expect(r.rows[0]).toMatchObject({ status: 'MODIFIED_FILE', kind: 'text' });
    expect(r.rows[0].original?.text).toBe('A');
  });
  it('case-insensitive matching preserves both actual spellings', async () => {
    const r = await compare(
      [file('src/A.ts', 'same')],
      [file('SRC/a.ts', 'same')],
      opts({ caseSensitive: false }),
    );
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0]).toMatchObject({
      status: 'UNCHANGED_FILE',
      path: 'SRC/a.ts',
      original: { path: 'src/A.ts' },
      modified: { path: 'SRC/a.ts' },
    });
    expect((await compare([file('A.ts')], [file('a.ts')])).stats).toMatchObject({
      added: 1,
      removed: 1,
    });
  });
  it('keeps a source-like MZ prefix as text rather than guessing EXE', async () =>
    expect(
      (await compare([file('a.txt', 'MZ = 1\n')], [file('a.txt', 'MZ = 2\n')])).rows[0].kind,
    ).toBe('text'));
});
describe('folder binary and error handling', () => {
  const png = [137, 80, 78, 71, 13, 10, 26, 10, 0, 1];
  it('compares binary bytes for same/different/add/remove without false line counts', async () => {
    const result = await compare(
      [file('same.png', png), file('changed.bin', [0, 1]), file('removed.bin', [0])],
      [file('same.png', png), file('changed.bin', [0, 2]), file('added.bin', [0, 3])],
    );
    expect(result.stats).toMatchObject({
      unchanged: 1,
      modified: 1,
      added: 1,
      removed: 1,
      binary: 4,
      unavailableLineStats: 4,
      addedLines: 0,
      removedLines: 0,
    });
    expect(result.rows.every((r) => r.added === undefined)).toBe(true);
  });
  it('separates text/binary type changes and never renders binary as text', async () => {
    const row = (await compare([file('data', 'text')], [file('data', [0, 1])])).rows[0];
    expect(row).toMatchObject({ status: 'MODIFIED_FILE', kind: 'mixed' });
    expect(row.modified?.text).toBeUndefined();
  });
  it('does not label invalid encodings or read failures as unchanged', async () => {
    const bad = file('bad.txt', [255]);
    const readError = file('error.txt');
    readError.file.arrayBuffer = vi.fn(async () => {
      throw new Error('denied');
    });
    const result = await compare([bad, readError], [file('bad.txt', [255]), file('error.txt')]);
    expect(result.stats.errors).toBe(2);
    expect(result.rows.every((r) => r.status === 'ERROR_FILE')).toBe(true);
    expect(result.rows[0].note).toContain('인코딩');
  });
  it('reports oversized files without reading them and detects size mismatches', async () => {
    const big = file('big.txt', '', 5 * 1024 * 1024 + 1),
      wrong = file('wrong.txt', 'x', 0);
    const result = await compare([big, wrong], []);
    expect(big.file.arrayBuffer).not.toHaveBeenCalled();
    expect(result.stats.errors).toBe(2);
    expect(result.rows.find((r) => r.path === 'wrong.txt')?.note).toContain('바이트');
  });
});
describe('folder cancellation, reporting and tree model', () => {
  it('aborts already-cancelled and in-progress comparisons without a partial result', async () => {
    const c = new AbortController();
    c.abort();
    await expect(
      compareFolders(folder([]), folder([]), opts(), { signal: c.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    const second = new AbortController();
    const a = file('a', 'x'),
      b = file('b', 'x');
    await expect(
      compareFolders(folder([a, b]), folder([]), opts(), {
        signal: second.signal,
        onProgress: (done) => {
          if (done === 1) second.abort();
        },
        yieldControl: () => Promise.resolve(),
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    expect(b.file.arrayBuffer).not.toHaveBeenCalled();
  });
  it('reports progress and supports many files while yielding per file', async () => {
    const yieldControl = vi.fn(async () => {}),
      onProgress = vi.fn();
    const files = Array.from({ length: 300 }, (_, i) => file(`dir/f${i}.txt`, 'x\n'));
    const result = await compareFolders(folder(files), folder(files), opts(), {
      yieldControl,
      onProgress,
    });
    expect(result.stats.unchanged).toBe(300);
    expect(yieldControl).toHaveBeenCalledTimes(300);
    expect(onProgress).toHaveBeenLastCalledWith(300, 300);
  });
  it('exports only report metadata, keeping source texts out of downloads', async () => {
    const result = await compare([file('a', 'SECRET_BEFORE')], [file('a', 'SECRET_AFTER')]);
    const text = exportFolderReport(result);
    expect(text).not.toContain('SECRET');
    const report = JSON.parse(text);
    expect(report.files[0]).toMatchObject({
      path: 'a',
      status: 'MODIFIED_FILE',
      original: { path: 'a', kind: 'text' },
    });
    expect(report.stats.total).toBe(1);
    expect(JSON.parse(exportFolderReport(result, [])).exportedRows).toBe(0);
  });
  it('builds an expandable folder tree with Map-safe names and folder counts', async () => {
    const result = await compare(
      [],
      [
        file('src/a.ts'),
        file('src/nested/b.ts'),
        file('__proto__/constructor.txt'),
        file('root.txt'),
      ],
    );
    const tree = folderTree(result.rows);
    expect(tree.filter((n) => n.directory).map((n) => n.path)).toEqual([
      '__proto__',
      'src',
      'src/nested',
    ]);
    expect(tree.find((n) => n.path === 'src')?.count).toBe(2);
    expect(folderTree(result.rows, new Set(['src'])).some((n) => n.path === 'src/a.ts')).toBe(
      false,
    );
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });
});

describe('file to directory transitions', () => {
  it('keeps both the removed file and added directory contents selectable', async () => {
    const result = await compare([file('config', 'before')], [file('config/default.json', '{}')]);
    expect(result.stats).toMatchObject({ added: 1, removed: 1 });
    const tree = folderTree(result.rows);
    expect(tree.filter((row) => row.path === 'config')).toHaveLength(2);
    expect(tree.filter((row) => !row.directory).map((row) => row.path)).toEqual([
      'config/default.json',
      'config',
    ]);
    expect(
      folderTree(result.rows, new Set(['config']))
        .filter((row) => !row.directory)
        .map((row) => row.path),
    ).toEqual(['config']);
  });
});

describe('folder per-file calculation failures', () => {
  it('does not recompute text Diff for byte-identical files', async () => {
    const spy = vi.spyOn(textEngine, 'compareText').mockImplementation(() => {
      throw new Error('forced timeout');
    });
    try {
      const result = await compare([file('same', 'same')], [file('same', 'same')]);
      expect(result.stats.unchanged).toBe(1);
      expect(spy).not.toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
  it('marks failed text calculations as explicit errors with unavailable statistics', async () => {
    const spy = vi.spyOn(textEngine, 'compareText').mockImplementation(() => {
      throw new Error('forced timeout');
    });
    try {
      const result = await compare([file('different', 'old')], [file('different', 'new')]);
      expect(result.rows[0]).toMatchObject({
        status: 'ERROR_FILE',
        kind: 'error',
        note: 'forced timeout',
      });
      expect(result.stats).toMatchObject({ errors: 1, unavailableLineStats: 1 });
    } finally {
      spy.mockRestore();
    }
  });
});
