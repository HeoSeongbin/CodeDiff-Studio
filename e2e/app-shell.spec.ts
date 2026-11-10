import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const names = [
  'Code Compare',
  'JSON Tools',
  'Field Mapping',
  'Patch Export',
  'Folder Compare',
  'Syntax Compare',
];
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page, baseURL }) => {
  const collected: string[] = [];
  errors.set(page, collected);
  page.on('pageerror', (error) => collected.push(error.message));
  page.on('request', (request) => {
    if (request.url().startsWith('http') && !request.url().startsWith(baseURL!))
      collected.push(request.url());
  });
  await page.goto('/');
  await expect(page.getByText('Monaco ready', { exact: false })).toBeVisible();
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));

test('shared header and rail stay mounted across every workspace and preserve uploaded text', async ({
  page,
}) => {
  const header = page.getByRole('banner');
  const rail = page.getByRole('navigation', { name: '작업 공간 바로가기' });
  await header.evaluate((element) => element.setAttribute('data-shell-test', 'original-header'));
  await rail.evaluate((element) => element.setAttribute('data-shell-test', 'original-rail'));
  const source = 'select 1; -- 한글 😀\r\n';
  await page
    .getByLabel('Original 파일 업로드')
    .setInputFiles({ name: 'input.sql', mimeType: 'text/plain', buffer: Buffer.from(source) });
  await expect(page.getByRole('navigation', { name: '워크스페이스 메뉴' })).toBeHidden();
  for (const name of names) {
    await rail.getByRole('button', { name, exact: true }).click();
    await expect(header).toBeVisible();
    await expect(header).toHaveAttribute('data-shell-test', 'original-header');
    await expect(rail).toBeVisible();
    await expect(rail).toHaveAttribute('data-shell-test', 'original-rail');
    await expect(rail.getByRole('button', { name, exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(rail.getByRole('button', { pressed: true })).toHaveCount(1);
    await expect(page.locator('#active-workspace h1')).toBeVisible();
  }
  await rail.getByRole('button', { name: 'Code Compare', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByLabel('Original 코드 다운로드').click();
  expect(await readFile((await (await pending).path())!, 'utf8')).toBe(source);
  await page.getByRole('button', { name: 'Java 예제 불러오기', exact: true }).click();
  await expect(page.locator('.green')).toHaveText('+4');
  await expect(page.getByLabel('다음 변경')).toBeEnabled();
  await page.screenshot({ path: 'docs/ui-shell-code.png', fullPage: true });
});

test('menu defaults closed, opens above the header and restores toggle focus on Escape', async ({
  page,
}) => {
  const toggle = page.getByRole('button', { name: '워크스페이스 메뉴', exact: true });
  const menu = page.getByRole('navigation', { name: '워크스페이스 메뉴' });
  await expect(toggle).toHaveAttribute('aria-expanded', 'false');
  await expect(page.locator('.display-settings summary')).toBeHidden();
  await toggle.focus();
  await page.keyboard.press('Enter');
  await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  await expect(menu).toBeVisible();
  const bounds = await menu.boundingBox();
  const header = await page.getByRole('banner').boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(header!.y + 1);
  await menu.getByRole('button', { name: 'JSON Tools 탭', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'JSON을 탐색하고, 변환하세요.' })).toBeVisible();
  await expect(page.locator('.json-valid')).toHaveText('유효한 표준 JSON');
  await page.locator('.display-settings summary').click();
  await page.getByLabel('테마', { exact: true }).selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.screenshot({ path: 'docs/ui-shell-menu.png', fullPage: true });
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await expect(page.getByLabel('테마', { exact: true })).toHaveValue('light');
  await toggle.click();
  await expect(menu).toBeHidden();
});

test('persistent chrome and optional menu fit mobile/tablet and remain reachable while scrolling', async ({
  page,
}) => {
  const rail = page.getByRole('navigation', { name: '작업 공간 바로가기' });
  const toggle = page.getByRole('button', { name: '워크스페이스 메뉴', exact: true });
  for (const width of [390, 768]) {
    await page.setViewportSize({ width, height: 844 });
    for (const name of names) {
      await rail.getByRole('button', { name, exact: true }).click();
      await expect(page.locator('#active-workspace h1')).toBeVisible();
      await expect(page.getByRole('banner')).toBeVisible();
      await expect(rail).toBeVisible();
      await expect
        .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
        .toBe(true);
    }
    await toggle.click();
    await page.locator('.display-settings summary').click();
    const controls = await page.locator('.display-controls').boundingBox();
    expect(controls!.x).toBeGreaterThanOrEqual(0);
    expect(controls!.x + controls!.width).toBeLessThanOrEqual(width);
    await page.locator('.display-settings summary').click();
    await toggle.click();
    await page.evaluate(() => window.scrollTo(0, 500));
    await expect.poll(async () => (await page.getByRole('banner').boundingBox())!.y).toBe(0);
    await expect.poll(async () => (await rail.boundingBox())!.y).toBe(72);
    await page.evaluate(() => window.scrollTo(0, 0));
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await rail.getByRole('button', { name: 'Code Compare', exact: true }).click();
  await expect(page.getByLabel('다음 변경')).toBeEnabled();
  await page.screenshot({ path: 'docs/ui-shell-mobile.png', fullPage: true });
});
