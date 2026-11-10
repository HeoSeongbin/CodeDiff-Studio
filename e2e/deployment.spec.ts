import { test, expect, type Page } from '@playwright/test';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
import { applyPatch } from 'diff';

const issues = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page, baseURL }) => {
  const collected: string[] = [];
  issues.set(page, collected);
  page.on('pageerror', (error) => collected.push(error.message));
  page.on('requestfailed', (request) => collected.push(request.url()));
  page.on('response', (response) => {
    if (response.status() >= 400) collected.push(`${response.status()} ${response.url()}`);
  });
  page.on('request', (request) => {
    if (request.url().startsWith('http') && !request.url().startsWith(baseURL!))
      collected.push(`External request: ${request.url()}`);
    if (!['GET', 'HEAD'].includes(request.method()))
      collected.push(`Unexpected ${request.method()}`);
  });
});
test.afterEach(async ({ page }) => expect(issues.get(page)).toEqual([]));

async function download(page: Page, label: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: label, exact: true }).click();
  const file = await pending;
  return readFile((await file.path())!, 'utf8');
}

test('built application loads workers, WASM and favicon under the Pages subpath', async ({
  page,
  request,
  baseURL,
}) => {
  const errors: string[] = [];
  const failed: string[] = [];
  const external: string[] = [];
  const wasm: number[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (r) => failed.push(r.url()));
  page.on('request', (r) => {
    if (r.url().startsWith('http') && !r.url().startsWith(baseURL!)) external.push(r.url());
  });
  page.on('response', (r) => {
    if (r.status() >= 400) failed.push(`${r.status()} ${r.url()}`);
    if (r.url().includes('.wasm')) wasm.push(r.status());
  });
  const response = await page.goto('./');
  expect(response?.status()).toBe(200);
  expect(await response!.text()).not.toContain('/src/main.tsx');
  await expect(page.getByText('Monaco ready', { exact: false })).toBeVisible();
  await expect(page.getByLabel('다음 변경')).toBeEnabled();
  expect(page.workers().some((w) => w.url().includes('compute.worker'))).toBe(true);
  await page.getByRole('button', { name: 'Syntax Compare', exact: true }).click();
  await page.getByRole('button', { name: '구문 비교 실행', exact: true }).click();
  await expect(page.getByRole('heading', { name: /구문 변경/ })).toBeVisible();
  expect(wasm.length).toBeGreaterThanOrEqual(2);
  expect(wasm.every((status) => status === 200 || status === 304)).toBe(true);
  const icon = await request.get(new URL('favicon.svg', baseURL!).href);
  expect(icon.status()).toBe(200);
  expect(icon.headers()['content-type']).toContain('image/svg+xml');
  expect(errors).toEqual([]);
  expect(failed).toEqual([]);
  expect(external).toEqual([]);
});

// All release scenarios use synthetic fixtures; uploaded bytes stay in the browser.
test('uploaded CRLF source, exact patch download, refresh and mobile navigation on Pages', async ({
  page,
}) => {
  const original = '한글 😀\r\nvalue = 1;\r\n';
  const modified = '한글 😀\r\nvalue = 2;\r\n';
  await page.goto('./');
  for (const [index, side] of ['Original', 'Modified'].entries())
    await page.getByLabel(`${side} 파일 업로드`).setInputFiles({
      name: 'source.sql',
      mimeType: 'text/plain',
      buffer: Buffer.from(index ? modified : original),
    });
  await expect(page.locator('.green')).toHaveText('+1');
  await expect(page.locator('.red')).toHaveText('−1');
  const saved = page.waitForEvent('download');
  await page.getByLabel('Original 코드 다운로드').click();
  expect(await readFile((await (await saved).path())!, 'utf8')).toBe(original);
  await page.getByRole('button', { name: 'Patch Export', exact: true }).click();
  await page.getByLabel('Patch 대상 경로').fill('src/source.sql');
  await page.getByRole('button', { name: 'Patch 생성 및 검증', exact: true }).click();
  await expect(
    page.getByText('적용 검증 통과 · 수정본과 정확히 일치', { exact: true }),
  ).toBeVisible();
  const patch = await download(page, '.patch 저장');
  expect(applyPatch(original, patch, { autoConvertLineEndings: false, fuzzFactor: 0 })).toBe(
    modified,
  );
  await page.reload();
  await expect(page.getByText('Monaco ready', { exact: false })).toBeVisible();
  await expect(page.getByLabel('다음 변경')).toBeEnabled();
  await expect(page.getByRole('heading', { name: '코드의 차이를, 명확하게.' })).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 1000 });
  if (process.env.CODEDIFF_DEPLOYMENT_URL)
    await page.screenshot({ path: 'docs/phase9-deployed-desktop.png', fullPage: true });
  // A refresh starts a new session; previously uploaded file content must not persist.
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0]);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const workspace of [
    'Code Compare',
    'JSON Tools',
    'Field Mapping',
    'Patch Export',
    'Folder Compare',
    'Syntax Compare',
  ]) {
    await page.getByRole('button', { name: workspace, exact: true }).click();
    await expect(page.locator('#active-workspace h1')).toBeVisible();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  await page.getByRole('button', { name: 'Code Compare', exact: true }).click();
  await expect(page.getByLabel('비교 보기')).toHaveValue('unified');
  await expect(page.getByLabel('다음 변경')).toBeEnabled();
  if (process.env.CODEDIFF_DEPLOYMENT_URL)
    await page.screenshot({ path: 'docs/phase9-deployed-mobile.png', fullPage: true });
});

test('JSON structural comparison, formatting and Mapping downloads use local dynamic chunks on Pages', async ({
  page,
}) => {
  await page.goto('./');
  await page.getByRole('button', { name: 'JSON Tools', exact: true }).click();
  const source = '{"keep":null,"n":1}';
  await page.getByLabel('JSON 파일 업로드', { exact: true }).setInputFiles({
    name: 'source.json',
    mimeType: 'application/json',
    buffer: Buffer.from(source),
  });
  await expect(page.locator('.json-valid')).toHaveText('유효한 표준 JSON');
  await page.getByRole('button', { name: 'Structural Diff', exact: true }).click();
  await page.getByLabel('JSON 수정본 업로드').setInputFiles({
    name: 'target.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"n":"1"}'),
  });
  await expect(page.locator('.json-change-list')).toContainText('TYPE_CHANGED');
  await expect(page.locator('.json-change-list')).toContainText('FIELD_REMOVED');
  await page.getByRole('button', { name: 'Editor / Formatter', exact: true }).click();
  expect(await download(page, 'JSON 저장')).toBe(source);
  await page.getByRole('button', { name: 'Pretty Print', exact: true }).click();
  const formatted = await download(page, 'JSON 저장');
  expect(JSON.parse(formatted)).toEqual({ keep: null, n: 1 });
  expect(formatted).toContain('\n');
  await page.getByRole('button', { name: 'Field Mapping', exact: true }).click();
  await expect
    .poll(async () => JSON.parse((await page.getByLabel('매핑 Target JSON').textContent())!))
    .toEqual({
      account: { id: 1001, displayName: 'Hong' },
      members: [{ userId: 1 }, { userId: 2 }],
    });
  expect(JSON.parse(await download(page, 'Target 저장'))).toEqual({
    account: { id: 1001, displayName: 'Hong' },
    members: [{ userId: 1 }, { userId: 2 }],
  });
});

test('native folder upload, report and Code Compare handoff preserve disk originals on Pages', async ({
  page,
}) => {
  const root = resolve(tmpdir());
  const work = await mkdtemp(join(root, 'codediff-release-'));
  if (dirname(resolve(work)) !== root || !basename(work).startsWith('codediff-release-'))
    throw new Error('Unsafe fixture cleanup path');
  const sources = ['const value = 1;\r\n', 'const value = 2;\r\n'];
  try {
    const directories = [join(work, 'original'), join(work, 'modified')];
    for (const [index, directory] of directories.entries()) {
      await mkdir(directory);
      await writeFile(join(directory, 'main.ts'), sources[index]);
      await writeFile(
        join(directory, index ? 'added.json' : 'removed.sql'),
        index ? '{}' : 'select 1;',
      );
    }
    await page.goto('./');
    await page.getByRole('button', { name: 'Folder Compare', exact: true }).click();
    for (const [index, side] of ['Original', 'Modified'].entries())
      await page.getByLabel(`${side} 폴더 선택`, { exact: true }).setInputFiles(directories[index]);
    await page.getByRole('button', { name: '폴더 비교 실행', exact: true }).click();
    await expect(page.getByLabel('폴더 전체 통계')).toBeVisible();
    const report = JSON.parse(await download(page, '전체 결과 JSON 저장'));
    expect(report.stats).toMatchObject({
      total: 3,
      added: 1,
      removed: 1,
      modified: 1,
      unchanged: 0,
      errors: 0,
    });
    expect(
      report.files.map((file: { path: string; status: string }) => [file.path, file.status]),
    ).toEqual([
      ['added.json', 'ADDED_FILE'],
      ['main.ts', 'MODIFIED_FILE'],
      ['removed.sql', 'REMOVED_FILE'],
    ]);
    expect(
      report.files.find((file: { path: string }) => file.path === 'main.ts').original,
    ).not.toHaveProperty('text');
    await page.getByRole('button', { name: '파일 main.ts', exact: true }).click();
    await page.getByRole('button', { name: 'Code Compare로 복사', exact: true }).click();
    await expect(page.locator('.green')).toHaveText('+1');
    await expect(page.locator('.red')).toHaveText('−1');
    for (const [index, directory] of directories.entries())
      expect(await readFile(join(directory, 'main.ts'), 'utf8')).toBe(sources[index]);
  } finally {
    await rm(work, { recursive: true, force: true });
  }
});

for (const [name, source] of [
  ['release.cs', 'class A { int F(){return 1;} }'],
  ['release.py', 'def f():\n return 1\n'],
  ['release.js', 'function f(){return 1;}'],
  ['release.ts', 'function f(): number {return 1;}'],
] as const) {
  test(`Pages serves runtime and grammar for ${name}`, async ({ page }) => {
    const wasm: number[] = [];
    page.on('response', (response) => {
      if (response.url().includes('.wasm')) wasm.push(response.status());
    });
    await page.goto('./');
    for (const side of ['Original', 'Modified'])
      await page
        .getByLabel(`${side} 파일 업로드`)
        .setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(source) });
    await page.getByRole('button', { name: 'Syntax Compare', exact: true }).click();
    await page.getByRole('button', { name: '구문 비교 실행', exact: true }).click();
    await expect(page.getByRole('heading', { name: '구문 변경 0건' })).toBeVisible();
    expect(wasm.length).toBeGreaterThanOrEqual(2);
    expect(wasm.every((status) => status === 200 || status === 304)).toBe(true);
  });
}
