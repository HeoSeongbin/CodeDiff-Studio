import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { generatePatch, type PatchOperation } from '../core/patch/patch';
/** Applies only generated fixture patches inside a verified, unique temp directory. */
function gitRoundtrip(
  original: string,
  modified: string,
  operation: PatchOperation = 'modify',
  context = 3,
  path = 'src/sample.txt',
) {
  const tempRoot = resolve(tmpdir()),
    work = mkdtempSync(join(tempRoot, 'codediff-patch-'));
  if (dirname(resolve(work)) !== tempRoot || !basename(work).startsWith('codediff-patch-'))
    throw new Error('Unsafe test cleanup path');
  try {
    const file = join(work, ...path.split('/'));
    mkdirSync(dirname(file), { recursive: true });
    if (operation !== 'create') writeFileSync(file, original, 'utf8');
    const patch = generatePatch({ original, modified, operation, context, filePath: path });
    writeFileSync(join(work, 'changes.patch'), patch.text, 'utf8');
    const args = [
      '-c',
      'core.autocrlf=false',
      'apply',
      '--whitespace=nowarn',
      ...(context === 0 ? ['--unidiff-zero'] : []),
    ];
    execFileSync('git', [...args, '--check', 'changes.patch'], { cwd: work, stdio: 'pipe' });
    execFileSync('git', [...args, 'changes.patch'], { cwd: work, stdio: 'pipe' });
    if (operation === 'delete') expect(existsSync(file)).toBe(false);
    else expect(readFileSync(file)).toEqual(Buffer.from(modified, 'utf8'));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}
describe('Unified Patch compatibility with installed Git', () => {
  it.each([
    ['a\nb\n', 'a\nx\nb\n'],
    ['a', 'b'],
    ['a\n', 'a'],
    ['a', 'a\n'],
    ['a\r\nb\r\n', 'a\r\nc\r\n'],
    ['a\r\n', 'a\n'],
    ['a\n', 'a\r\n'],
    ['a\rb\r', 'a\rc\r'],
    ['', 'content\n'],
    ['old\n', ''],
    ['한글 🌏\n', '한글 🌍\n'],
    ['a\r\nb\nc', 'a\nb\r\nd\n'],
  ])('git apply --check + exact bytes for %j → %j', (original, modified) =>
    gitRoundtrip(original, modified),
  );
  it('supports quoted spaces and Unicode paths', () =>
    gitRoundtrip('before\n', 'after\n', 'modify', 3, 'folder/환경 설정.txt'));
  it('supports explicit creation and deletion', () => {
    gitRoundtrip('', 'created\r\n', 'create');
    gitRoundtrip('deleted\r\n', '', 'delete');
  });
  it('supports zero context with the documented Git flag', () =>
    gitRoundtrip('a\nb\nc\n', 'a\nx\nb\nc\n', 'modify', 0));
});
