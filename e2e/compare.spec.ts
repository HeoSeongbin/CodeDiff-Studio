import { test, expect } from '@playwright/test';
test('local Monaco: uploads, language detection, navigation, direct edit, no external requests', async ({
  page,
  baseURL,
}) => {
  const external: string[] = [];
  page.on('request', (request) => {
    if (
      !request.url().startsWith(baseURL!) &&
      !request.url().startsWith('blob:') &&
      !request.url().startsWith('data:')
    )
      external.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByText('Monaco ready', { exact: false })).toBeVisible({ timeout: 60000 });
  for (const [extension, language] of [
    ['java', 'java'],
    ['py', 'python'],
    ['cs', 'csharp'],
    ['html', 'html'],
  ]) {
    await page.getByLabel('Original 파일 업로드').setInputFiles({
      name: `sample.${extension}`,
      mimeType: 'text/plain',
      buffer: Buffer.from('first\nold\nlast\n'),
    });
    await page.getByLabel('Modified 파일 업로드').setInputFiles({
      name: `sample.${extension}`,
      mimeType: 'text/plain',
      buffer: Buffer.from('first\nnew\nlast\n'),
    });
    await expect(page.getByLabel('언어', { exact: true })).toHaveValue(language);
    await expect(page.getByText('원본 2 → 수정 2', { exact: true })).toBeVisible();
    await expect(page.locator('.monaco-diff-editor .line-insert')).not.toHaveCount(0);
    await page.getByLabel('다음 변경').click();
  }
  const editors = page.locator('.monaco-editor textarea');
  await editors.last().focus();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('extra');
  await expect(page.locator('.green')).toHaveText('+2');
  await page.screenshot({ path: 'docs/phase1-desktop.png', fullPage: true });
  expect(external).toEqual([]);
});
test('encoding errors and narrow viewport', async ({ page }) => {
  await page.goto('/');
  await page
    .getByLabel('Original 파일 업로드')
    .setInputFiles({ name: 'bad.txt', mimeType: 'text/plain', buffer: Buffer.from([255]) });
  await expect(page.locator('.error[role=alert]')).toContainText('인코딩 오류');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
});
