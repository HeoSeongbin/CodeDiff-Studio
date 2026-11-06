import { test, expect, type Page } from '@playwright/test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname, basename, resolve } from 'node:path';
interface Fixture {
  work: string;
  original: string;
  modified: string;
  clean: () => Promise<void>;
}
async function fixture(
  old: Record<string, string | Buffer>,
  next: Record<string, string | Buffer>,
): Promise<Fixture> {
  const root = resolve(tmpdir()),
    work = await mkdtemp(join(root, 'codediff-folder-'));
  if (dirname(resolve(work)) !== root || !basename(work).startsWith('codediff-folder-'))
    throw new Error('Unsafe fixture cleanup path');
  const original = join(work, 'original'),
    modified = join(work, 'modified');
  await mkdir(original);
  await mkdir(modified);
  for (const [base, files] of [
    [original, old],
    [modified, next],
  ] as const)
    for (const [path, text] of Object.entries(files)) {
      const file = join(base, ...path.split('/'));
      await mkdir(dirname(file), { recursive: true });
      await writeFile(file, text);
    }
  return { work, original, modified, clean: () => rm(work, { recursive: true, force: true }) };
}
async function open(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Folder Compare', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '두 프로젝트의 변경사항을 한눈에.' }),
  ).toBeVisible();
}
async function choose(page: Page, f: Fixture) {
  await page.getByLabel('Original 폴더 선택', { exact: true }).setInputFiles(f.original);
  await page.getByLabel('Modified 폴더 선택', { exact: true }).setInputFiles(f.modified);
}
async function compare(page: Page) {
  await page.getByRole('button', { name: '폴더 비교 실행', exact: true }).click();
  await expect(page.getByLabel('폴더 전체 통계')).toBeVisible({ timeout: 20000 });
}
const originalText = 'export const version = 1;\r\n',
  modifiedText = 'export const version = 2;\r\n';
const old = {
  'src/App.ts': originalText,
  'src/same.py': 'print("same")\n',
  'removed.sql': 'select 1;\n',
  'old-name.txt': 'rename-content\n',
  'whitespace.txt': 'a  b\n',
  'assets/icon.bin': Buffer.from([0, 1, 2]),
  'invalid.txt': Buffer.from([255]),
  'node_modules/ignored.js': 'old\n',
  config: 'config-old',
};
const next = {
  'src/App.ts': modifiedText,
  'src/same.py': 'print("same")\n',
  'added.json': '{"ok":true}\n',
  'new-name.txt': 'rename-content\n',
  'whitespace.txt': 'ab\n',
  'assets/icon.bin': Buffer.from([0, 1, 3]),
  'invalid.txt': Buffer.from([255]),
  'node_modules/ignored.js': 'new\n',
  'config/default.json': '{}\n',
};
test('Phase 6 native folders, statuses, errors, binary, report and source-safe Code Compare handoff', async ({
  page,
  baseURL,
}) => {
  const f = await fixture(old, next);
  try {
    const external: string[] = [],
      errors: string[] = [];
    page.on('request', (r) => {
      if (
        !r.url().startsWith(baseURL!) &&
        !r.url().startsWith('blob:') &&
        !r.url().startsWith('data:')
      )
        external.push(r.url());
    });
    page.on('pageerror', (e) => errors.push(e.message));
    await open(page);
    await choose(page, f);
    await compare(page);
    const summary = page.getByLabel('폴더 전체 통계');
    await expect(summary).toContainText('11개 파일');
    for (const [label, count] of [
      ['추가 파일', '3'],
      ['삭제 파일', '3'],
      ['수정 파일', '3'],
      ['동일 파일', '1'],
      ['오류 파일', '1'],
    ])
      await expect(
        summary
          .locator('div')
          .filter({ has: page.getByText(label, { exact: true }) })
          .locator('strong'),
      ).toHaveText(count);
    await expect(
      page.getByRole('button', { name: '파일 node_modules/ignored.js', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('button', { name: '파일 src/App.ts', exact: true }).click();
    await expect(page.locator('.folder-file-panel h2')).toHaveText('src/App.ts');
    await expect(page.locator('.folder-file-panel .line-insert')).not.toHaveCount(0);
    await page.getByLabel('폴더 Diff 보기').selectOption('unified');
    await page.getByRole('button', { name: '파일 assets/icon.bin', exact: true }).click();
    await expect(page.locator('.folder-no-diff')).toContainText('바이트 비교');
    await expect(
      page.getByRole('button', { name: 'Code Compare로 복사', exact: true }),
    ).toBeDisabled();
    await page.getByRole('button', { name: '파일 invalid.txt', exact: true }).click();
    await expect(page.locator('.folder-file-meta')).toContainText('인코딩 오류');
    await page.getByRole('button', { name: '파일 config', exact: true }).click();
    await expect(page.locator('.folder-file-panel h2')).toHaveText('config');
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: '전체 결과 JSON 저장', exact: true }).click();
    const text = await readFile((await (await pending).path())!, 'utf8');
    const report = JSON.parse(text);
    expect(report.stats).toMatchObject({
      added: 3,
      removed: 3,
      modified: 3,
      unchanged: 1,
      errors: 1,
      total: 11,
    });
    expect(report.files.some((r: { path: string }) => r.path === 'old-name.txt')).toBe(true);
    expect(text).not.toContain('export const');
    expect(text).not.toContain('rename-content');
    await page.getByLabel('폴더 파일 종류').selectOption('binary');
    const filtered = page.waitForEvent('download');
    await page.getByRole('button', { name: '표시 목록 JSON 저장', exact: true }).click();
    expect(JSON.parse(await readFile((await (await filtered).path())!, 'utf8')).exportedRows).toBe(
      1,
    );
    await page.getByLabel('폴더 파일 종류').selectOption('all');
    await page.getByRole('button', { name: '파일 src/App.ts', exact: true }).click();
    await page.screenshot({ path: 'docs/phase6-folder-desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Code Compare로 복사', exact: true }).click();
    await expect(page.getByRole('heading', { name: '코드의 차이를, 명확하게.' })).toBeVisible();
    await expect(page.locator('.studio .file-row strong')).toHaveText(['src/App.ts', 'src/App.ts']);
    const editor = page.locator('.studio .monaco-editor textarea').last();
    await editor.focus();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('extra');
    const edited = page.waitForEvent('download');
    await page.getByLabel('Modified 코드 다운로드', { exact: true }).click();
    expect(await readFile((await (await edited).path())!, 'utf8')).toBe(modifiedText + 'extra');
    expect(await readFile(join(f.original, 'src/App.ts'), 'utf8')).toBe(originalText);
    expect(await readFile(join(f.modified, 'src/App.ts'), 'utf8')).toBe(modifiedText);
    await page.getByRole('button', { name: 'Folder Compare', exact: true }).click();
    await expect(summary).toBeVisible();
    expect(external).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await f.clean();
  }
});
test('Phase 6 filters, whitespace policy, editable excludes and empty folders', async ({
  page,
}) => {
  const f = await fixture(old, next);
  try {
    await open(page);
    await choose(page, f);
    await compare(page);
    await page.getByLabel('동일 파일 숨기기', { exact: true }).check();
    await expect(page.getByRole('button', { name: '파일 src/same.py', exact: true })).toHaveCount(
      0,
    );
    await page.getByLabel('폴더 공백 무시', { exact: true }).check();
    await expect(page.getByLabel('폴더 전체 통계')).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: '전체 결과 JSON 저장', exact: true }),
    ).toHaveCount(0);
    await compare(page);
    await expect(
      page.getByRole('button', { name: '파일 whitespace.txt', exact: true }),
    ).toHaveCount(0);
    await page.getByLabel('동일 파일 숨기기', { exact: true }).uncheck();
    await page.getByRole('button', { name: '파일 whitespace.txt', exact: true }).click();
    await expect(page.locator('.folder-file-meta')).toContainText('공백 옵션에서 동일');
    await page.getByLabel('폴더 확장자 필터').fill('ts,');
    await page.getByLabel('폴더 확장자 필터').press('End');
    await page.getByLabel('폴더 확장자 필터').type('py');
    await expect(page.getByLabel('폴더 확장자 필터')).toHaveValue('ts,py');
    await compare(page);
    await expect(page.getByLabel('폴더 전체 통계')).toContainText('2개 파일');
    await page.getByLabel('제외 디렉터리', { exact: true }).fill('src');
    await compare(page);
    await expect(page.getByLabel('폴더 전체 통계')).toContainText('0개 파일');
    await page.getByRole('button', { name: '기본 제외 복원', exact: true }).click();
    await expect(page.getByLabel('제외 디렉터리', { exact: true })).toHaveValue(/node_modules/);
    await compare(page);
    await expect(page.getByLabel('폴더 전체 통계')).toContainText('2개 파일');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
    await page.screenshot({ path: 'docs/phase6-folder-mobile.png', fullPage: true });
    await page.getByRole('button', { name: 'Original 빈 폴더로 설정', exact: true }).click();
    await page.getByRole('button', { name: 'Modified 빈 폴더로 설정', exact: true }).click();
    await compare(page);
    await expect(page.getByLabel('폴더 전체 통계')).toContainText('0개 파일');
    await page.setViewportSize({ width: 390, height: 844 });
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  } finally {
    await f.clean();
  }
});
test('Phase 6 case matching, cancellation and virtualized large file tree', async ({ page }) => {
  const a: Record<string, string> = {},
    b: Record<string, string> = {};
  for (let i = 0; i < 350; i++) {
    a[`bulk/f${String(i).padStart(4, '0')}.txt`] = 'same\n';
    b[`bulk/f${String(i).padStart(4, '0')}.txt`] = i === 2 ? 'changed\n' : 'same\n';
  }
  a['SRC/Util.ts'] = 'x';
  b['src/util.ts'] = 'x';
  const f = await fixture(a, b);
  try {
    await open(page);
    await choose(page, f);
    await page.getByRole('button', { name: '폴더 비교 실행', exact: true }).click();
    await page.getByRole('button', { name: '비교 취소', exact: true }).click();
    await expect(page.locator('.folder-error')).toContainText('취소');
    await expect(page.getByLabel('폴더 전체 통계')).toHaveCount(0);
    await compare(page);
    await expect(page.getByLabel('폴더 전체 통계')).toContainText('352개 파일');
    expect(await page.getByRole('treeitem').count()).toBeLessThanOrEqual(28);
    await page.getByLabel('경로 대소문자 구분', { exact: true }).uncheck();
    await compare(page);
    await expect(page.getByLabel('폴더 전체 통계')).toContainText('351개 파일');
    await page.getByLabel('폴더 파일 검색').fill('util.ts');
    await expect(page.getByRole('button', { name: '파일 src/util.ts', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '파일 src/util.ts', exact: true }).click();
    await expect(page.locator('.folder-file-meta')).toContainText('Original: SRC/Util.ts');
    await expect(page.locator('.folder-file-meta')).toContainText('Modified: src/util.ts');
  } finally {
    await f.clean();
  }
});
