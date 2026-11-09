import { test, expect } from '@playwright/test';
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
    await page.goto('/');
    for (const side of ['Original', 'Modified'])
      await page
        .getByLabel(`${side} 파일 업로드`)
        .setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(source) });
    await page.getByRole('button', { name: 'Syntax Compare', exact: true }).click();
    await page.getByRole('button', { name: '구문 비교 실행', exact: true }).click();
    await expect(page.getByRole('heading', { name: '구문 변경 0건' })).toBeVisible();
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
