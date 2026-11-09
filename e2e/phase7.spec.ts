import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const browserErrors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on('pageerror', (error) => errors.push(error.stack ?? error.message));
});
test.afterEach(async ({ page }) => {
  expect(browserErrors.get(page)).toEqual([]);
});
test('syntax WASM stays local, raw diff and stale results remain available', async ({ page }) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:') && !request.url().startsWith('data:'))
      external.push(request.url());
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Syntax Compare', exact: true }).click();
  await page.getByRole('button', { name: '구문 비교 실행', exact: true }).click();
  await expect(page.getByRole('heading', { name: /구문 변경/ })).toBeVisible();
  await expect(page.getByRole('region', { name: '구문 비교 결과' })).toContainText(
    '코드 블록 변경',
  );
  await page.locator('.syntax-change').first().click();
  await expect(page.locator('.syntax-workspace .monaco-diff-editor')).toBeVisible();
  await page.screenshot({ path: 'docs/phase7-syntax-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Code Compare', exact: true }).click();
  await page
    .getByLabel('Modified 파일 업로드')
    .setInputFiles({ name: 'bad.java', mimeType: 'text/plain', buffer: Buffer.from('class {') });
  await page.getByRole('button', { name: 'Syntax Compare', exact: true }).click();
  await expect(page.getByText('입력 또는 언어가 변경되었습니다. 다시 분석하세요.')).toBeVisible();
  await page.getByRole('button', { name: '구문 비교 실행', exact: true }).click();
  await expect(page.locator('.syntax-workspace [role=alert]')).toContainText('구문 오류');
  await expect(page.getByRole('heading', { name: /Text Diff/ })).toBeVisible();
  expect(external).toEqual([]);
});
for (const [name, source] of [
  ['example.cs', 'class A { int F(){return 1;} }'],
  ['example.py', 'def f():\n return 1\n'],
  ['example.js', 'function f(){return 1;}'],
  ['example.ts', 'function f(): number {return 1;}'],
] as const) {
  test(`browser grammar ${name}`, async ({ page }) => {
    const wasmResponses: number[] = [];
    page.on('response', (response) => {
      if (response.url().includes('.wasm')) wasmResponses.push(response.status());
    });
    await page.goto('/');
    for (const side of ['Original', 'Modified'])
      await page
        .getByLabel(`${side} 파일 업로드`)
        .setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(source) });
    await page.getByRole('button', { name: 'Syntax Compare', exact: true }).click();
    await page.getByRole('button', { name: '구문 비교 실행', exact: true }).click();
    await expect(page.getByRole('heading', { name: '구문 변경 0건' })).toBeVisible();
    expect(wasmResponses.length).toBeGreaterThanOrEqual(2);
    expect(wasmResponses.every((status) => status === 200 || status === 304)).toBe(true);
    await page.getByLabel('구문 언어').selectOption('auto');
  });
}
test('unsupported language falls back to text diff on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page
    .getByLabel('Modified 파일 업로드')
    .setInputFiles({ name: 'plain.txt', mimeType: 'text/plain', buffer: Buffer.from('plain') });
  await page.getByRole('button', { name: 'Syntax Compare', exact: true }).click();
  await expect(
    page.getByText('지원하지 않는 언어입니다. 아래 Text Diff를 사용하세요.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: '구문 비교 실행' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('syntax analysis and readonly preview preserve exact uploaded CRLF sources', async ({
  page,
}) => {
  const sources = [
    '// 😀 한글\r\nclass A { int f(){return 1;} }\r\n',
    '// 😀 한글\r\nclass A { int f(){return 2;} }\r\n',
  ];
  await page.goto('/');
  for (const [index, side] of ['Original', 'Modified'].entries()) {
    await page.getByLabel(`${side} 파일 업로드`).setInputFiles({
      name: 'source.java',
      mimeType: 'text/plain',
      buffer: Buffer.from(sources[index]),
    });
  }
  await page.getByRole('button', { name: 'Syntax Compare', exact: true }).click();
  await page.getByRole('button', { name: '구문 비교 실행', exact: true }).click();
  await expect(page.getByRole('region', { name: '구문 비교 결과' })).toContainText(
    '원본 2행 → 수정본 2행',
  );
  await page.locator('.syntax-change').last().click();
  const preview = page.locator('.syntax-workspace .monaco-editor textarea').last();
  await preview.focus();
  await page.keyboard.type('must-not-change-source');
  await page.getByRole('button', { name: 'Code Compare', exact: true }).click();
  for (const [index, side] of ['Original', 'Modified'].entries()) {
    const pending = page.waitForEvent('download');
    await page.getByLabel(`${side} 코드 다운로드`).click();
    const download = await pending;
    expect(await readFile((await download.path())!, 'utf8')).toBe(sources[index]);
  }
});

test('grammar loading failure keeps Text Diff and permits retry', async ({ page }) => {
  await page.route(/tree-sitter-c_sharp.*\.wasm/, (route) =>
    route.request().resourceType() === 'fetch' ? route.abort() : route.continue(),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Syntax Compare', exact: true }).click();
  await page.getByLabel('구문 언어').selectOption('csharp');
  await page.getByRole('button', { name: '구문 비교 실행', exact: true }).click();
  await expect(page.locator('.syntax-workspace [role=alert]')).toBeVisible();
  await expect(page.locator('.syntax-workspace .monaco-diff-editor')).toBeVisible();
  await page.unroute(/tree-sitter-c_sharp.*\.wasm/);
  await page.getByRole('button', { name: '구문 비교 실행', exact: true }).click();
  await expect(page.getByRole('heading', { name: /구문 변경/ })).toBeVisible();
});
