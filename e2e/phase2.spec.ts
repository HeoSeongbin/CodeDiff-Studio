import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('Phase 2: unified, detail, options, editing, copy and exact download', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByText('Monaco ready', { exact: false })).toBeVisible();
  const original = 'const old = 1;\r\nunchanged\r\n';
  const modified = 'const next = 2;\r\nunchanged\r\n';
  for (const [side, text] of [
    ['Original', original],
    ['Modified', modified],
  ])
    await page
      .getByLabel(`${side} 파일 업로드`)
      .setInputFiles({ name: 'example.ts', mimeType: 'text/plain', buffer: Buffer.from(text) });
  await expect(page.getByLabel('선택 변경 상세')).toContainText('CRLF');
  await page.getByLabel('비교 보기').selectOption('unified');
  await expect
    .poll(() =>
      page
        .locator('.monaco-diff-editor .editor.original')
        .evaluate((el) => el.getBoundingClientRect().width),
    )
    .toBeLessThan(100);
  await expect(page.locator('.monaco-diff-editor .editor.modified .line-delete')).not.toHaveCount(
    0,
  );
  await page.getByLabel('상세 비교 단위').selectOption('word');
  await expect(page.getByLabel('선택 변경 상세')).toContainText('단어 강조');
  await page.getByLabel('자동 줄바꿈').check();
  await page.getByLabel('변경 영역만 보기').check();
  await page.getByLabel('문맥 줄').selectOption('0');
  await page.getByLabel('Modified 코드 복사').click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe(modified);
  const pending = page.waitForEvent('download');
  await page.getByLabel('Modified 코드 다운로드').click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('example.ts');
  expect(await readFile((await download.path())!, 'utf8')).toBe(modified);
  await page.getByLabel('변경 영역만 보기').uncheck();
  const editor = page.locator('.monaco-editor textarea').last();
  await editor.focus();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('extra');
  await expect(page.locator('.green')).toHaveText('+2');
  await page.getByLabel('비교 보기').selectOption('side');
  await expect
    .poll(() =>
      page
        .locator('.monaco-diff-editor .editor.original')
        .evaluate((el) => el.getBoundingClientRect().width),
    )
    .toBeGreaterThan(100);
  await page.getByLabel('이전 변경').click();
  await expect(page.getByLabel('선택 변경 상세')).toBeVisible();
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'docs/phase2-desktop.png', fullPage: true });
});
test('Phase 2 options update results without rewriting downloads', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Monaco ready', { exact: false })).toBeVisible();
  const original = 'a\n\nB  \n';
  const modified = 'a\nb\n';
  for (const [side, text] of [
    ['Original', original],
    ['Modified', modified],
  ])
    await page
      .getByLabel(`${side} 파일 업로드`)
      .setInputFiles({ name: 'data.txt', mimeType: 'text/plain', buffer: Buffer.from(text) });
  await page.getByLabel('빈 줄 무시', { exact: true }).check();
  await page.getByLabel('줄 끝 공백 무시', { exact: true }).check();
  await page.getByLabel('대소문자 무시', { exact: true }).check();
  await expect(page.getByText('선택한 비교 옵션에서 차이가 없습니다.')).toBeVisible();
  await expect(page.getByLabel('다음 변경')).toBeDisabled();
  await expect(page.getByLabel('선택 변경 상세')).toHaveCount(0);
  const pending = page.waitForEvent('download');
  await page.getByLabel('Original 코드 다운로드').click();
  const download = await pending;
  expect(await readFile((await download.path())!, 'utf8')).toBe(original);
  await page.getByLabel('대소문자 무시', { exact: true }).uncheck();
  await expect(page.getByText('원본 3 → 수정 2', { exact: true })).toBeVisible();
});

test('Phase 2: unchanged folding, wrap and source preservation after edits', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Monaco ready', { exact: false })).toBeVisible();
  const original = Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\r\n');
  const modified = original.replace('line 20', 'changed 20');
  for (const [side, text] of [
    ['Original', original],
    ['Modified', modified],
  ])
    await page
      .getByLabel(`${side} 파일 업로드`)
      .setInputFiles({ name: 'long.txt', mimeType: 'text/plain', buffer: Buffer.from(text) });
  await expect(page.getByText('원본 21 → 수정 21', { exact: true })).toBeVisible();
  await page.getByLabel('변경 영역만 보기').check();
  await page.getByLabel('문맥 줄').selectOption('3');
  await expect(page.locator('.diff-hidden-lines .center').first()).toBeVisible();
  await page.getByLabel('변경 영역만 보기').uncheck();
  await expect(page.locator('.diff-hidden-lines')).toHaveCount(0);
  const editor = page.locator('.monaco-editor textarea').last();
  await editor.focus();
  await page.keyboard.press('Control+End');
  await page.keyboard.type(' extra');
  await expect(page.locator('.green')).toHaveText('+2');
  for (const [side, text] of [
    ['Original', original],
    ['Modified', modified + ' extra'],
  ]) {
    const pending = page.waitForEvent('download');
    await page.getByLabel(`${side} 코드 다운로드`).click();
    const download = await pending;
    expect(await readFile((await download.path())!, 'utf8')).toBe(text);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByLabel('비교 보기').selectOption('unified');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({ path: 'docs/phase2-mobile.png', fullPage: true });
});
