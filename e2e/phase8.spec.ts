import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const collected: string[] = [];
  errors.set(page, collected);
  page.on('pageerror', (error) => collected.push(error.stack ?? error.message));
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page)).toEqual([]);
});
async function toggleSettings(page: Page) {
  const menu = page.getByRole('button', { name: '워크스페이스 메뉴', exact: true });
  if ((await menu.getAttribute('aria-expanded')) === 'false') await menu.click();
  await page.locator('.display-settings summary').click();
}
async function upload(page: Page, original: string, modified: string) {
  for (const [index, side] of ['Original', 'Modified'].entries())
    await page.getByLabel(`${side} 파일 업로드`).setInputFiles({
      name: `phase8-${side}.txt`,
      mimeType: 'text/plain',
      buffer: Buffer.from(index ? modified : original),
    });
}
async function checkTextContrast(page: Page) {
  const ratios = await page
    .locator('.workspace-heading p, .changes > p, .analysis-note p, .privacy')
    .evaluateAll((elements) =>
      elements
        .filter((element) => element.getClientRects().length)
        .map((element) => {
          const rgb = (value: string) => (value.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number);
          const luminance = (values: number[]) =>
            values
              .map((value) => {
                const c = value / 255;
                return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
              })
              .reduce((sum, c, index) => sum + c * [0.2126, 0.7152, 0.0722][index], 0);
          let parent: Element | null = element;
          while (parent && getComputedStyle(parent).backgroundColor === 'rgba(0, 0, 0, 0)')
            parent = parent.parentElement;
          const a = luminance(rgb(getComputedStyle(element).color)),
            b = luminance(
              rgb(getComputedStyle(parent ?? document.documentElement).backgroundColor),
            );
          return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        }),
    );
  expect(ratios.length).toBeGreaterThan(0);
  for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
}
test('keyboard settings, all-workspace light theme, model bounds and mobile layout', async ({
  page,
}) => {
  const external: string[] = [];
  page.on('request', (r) => {
    if (!r.url().startsWith('http://127.0.0.1:') && !r.url().startsWith('data:'))
      external.push(r.url());
  });
  await page.goto('/');
  await expect(page.getByText('Monaco ready', { exact: false })).toBeVisible();
  const link = page.getByRole('link', { name: '본문으로 이동' });
  await link.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#active-workspace')).toBeFocused();
  await toggleSettings(page);
  await page.getByLabel('테마', { exact: true }).selectOption('light');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await checkTextContrast(page);
  await expect(page.locator('.editor-area .monaco-editor.vs').first()).toBeVisible();
  const background = await page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );
  expect(Number(background.match(/\d+/)![0])).toBeGreaterThan(220);
  const width = page.getByLabel('분석 패널 너비');
  await width.focus();
  await page.keyboard.press('End');
  await expect(page.locator('.changes')).toHaveCSS('width', '480px');
  const height = page.getByLabel('편집기 높이');
  await height.focus();
  await page.keyboard.press('End');
  await expect(page.locator('.editor-area')).toHaveCSS('height', '900px');
  await page.getByRole('checkbox', { name: 'MiniMap', exact: true }).check();
  await expect(page.locator('.editor-area .editor.modified .minimap')).toBeVisible();
  await page.getByRole('button', { name: '패널 크기 초기화' }).click();
  await expect(page.locator('.changes')).toHaveCSS('width', '280px');
  await toggleSettings(page);
  await page.screenshot({ path: 'docs/phase8-light-desktop.png', fullPage: true });
  for (const workspace of [
    'JSON Tools',
    'Field Mapping',
    'Patch Export',
    'Folder Compare',
    'Syntax Compare',
  ]) {
    await page.getByRole('button', { name: workspace, exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await expect(page.locator('#active-workspace')).toBeVisible();
    await expect(page.locator('#active-workspace h1')).toBeVisible();
    if (workspace === 'JSON Tools') {
      await toggleSettings(page);
      await page.getByLabel('데이터 원본 패널 비율').focus();
      await page.keyboard.press('End');
      const ratio = await page
        .locator('.json-grid')
        .evaluate(
          (element) =>
            element.querySelector('.json-source')!.getBoundingClientRect().width /
            element.getBoundingClientRect().width,
        );
      expect(ratio).toBeGreaterThan(0.57);
      expect(ratio).toBeLessThan(0.62);
      await page.getByLabel('편집기 높이').focus();
      await page.keyboard.press('Home');
      await expect(page.locator('.json-editor').first()).toHaveCSS('height', '400px');
      await page.getByRole('button', { name: '패널 크기 초기화' }).click();
      await toggleSettings(page);
    }
  }
  await toggleSettings(page);
  const resource = page.getByLabel('로컬 처리 현황');
  const count = () =>
    resource.innerText().then((text) => Number(text.match(/편집 모델 (\d+)/)![1]));
  const baseline = await count();
  expect(baseline).toBeLessThanOrEqual(12);
  for (let round = 0; round < 3; round++)
    for (const workspace of ['Code Compare', 'JSON Tools', 'Field Mapping', 'Syntax Compare'])
      await page.getByRole('button', { name: workspace, exact: true }).click();
  expect(await count()).toBe(baseline);
  await page.getByLabel('테마', { exact: true }).selectOption('dark');
  await toggleSettings(page);
  await page.getByRole('button', { name: 'Code Compare', exact: true }).click();
  await checkTextContrast(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await toggleSettings(page);
  const settingsBounds = await page.locator('.display-controls').boundingBox();
  expect(settingsBounds!.x).toBeGreaterThanOrEqual(0);
  expect(settingsBounds!.x + settingsBounds!.width).toBeLessThanOrEqual(390);
  await page.getByLabel('테마', { exact: true }).selectOption('light');
  await page.getByLabel('테마', { exact: true }).selectOption('dark');
  await toggleSettings(page);
  for (const workspace of [
    'Code Compare',
    'JSON Tools',
    'Field Mapping',
    'Patch Export',
    'Folder Compare',
    'Syntax Compare',
  ]) {
    await page.getByRole('button', { name: workspace, exact: true }).click();
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
      .toBe(true);
  }
  await page.getByRole('button', { name: 'Code Compare', exact: true }).click();
  await expect(page.getByLabel('비교 보기')).toHaveValue('unified');
  await expect(page.locator('.editor-area .editor.modified .minimap')).toBeHidden();
  await page.screenshot({ path: 'docs/phase8-dark-mobile.png', fullPage: true });
  expect(external).toEqual([]);
});
test('running work is terminated on cancel and never overwrites a newer snapshot', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByLabel('다음 변경')).toBeEnabled();
  const lines = Array.from({ length: 50000 }, (_, i) => `old_${i}\n`).join('');

  await upload(page, lines, lines.replaceAll('old_', 'new_'));
  await expect
    .poll(() => page.workers().filter((worker) => worker.url().includes('compute.worker')).length, {
      intervals: [20, 50],
    })
    .toBe(1);
  const worker = page.workers().find((worker) => worker.url().includes('compute.worker'))!;
  const closed = worker.waitForEvent('close');
  await page.getByRole('button', { name: '비교 취소', exact: true }).click();
  await closed;
  await expect(page.getByText('비교가 취소되었습니다.', { exact: true })).toBeVisible();
  await expect(page.getByText('비교 취소됨', { exact: true })).toBeVisible();
  await upload(page, 'small old\r\n', 'small new\r\n');
  await expect(page.locator('.green')).toHaveText('+1');
  await expect(page.locator('.red')).toHaveText('−1');
  await expect(page.locator('.change-list')).toContainText('small old');
  for (const [index, side] of ['Original', 'Modified'].entries()) {
    const pending = page.waitForEvent('download');
    await page.getByLabel(`${side} 코드 다운로드`).click();
    const download = await pending;
    expect(await readFile((await download.path())!, 'utf8')).toBe(
      index ? 'small new\r\n' : 'small old\r\n',
    );
  }
  await page.getByRole('button', { name: 'Patch Export', exact: true }).click();
  await toggleSettings(page);
  await expect(page.getByLabel('로컬 처리 현황')).toContainText('계산 Worker 0개');
});
test('worker loading errors are visible and retry restores comparison', async ({ page }) => {
  await page.route('**/*compute.worker*', (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('.error[role=alert]')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Monaco ready', { exact: false })).toBeVisible();
  await page.unroute('**/*compute.worker*');
  await page.getByRole('button', { name: '다시 비교', exact: true }).click();
  await expect(page.getByLabel('다음 변경')).toBeEnabled();
  await expect(page.locator('.error[role=alert]')).toHaveCount(0);
});
test('large change lists stay paginated and keyboard navigation follows selection', async ({
  page,
}) => {
  await page.goto('/');
  const lines = Array.from({ length: 1500 }, (_, i) => `line_${i}\n`);
  await upload(
    page,
    lines.join(''),
    lines.map((line, i) => (i % 3 === 0 ? `changed_${i}\n` : line)).join(''),
  );
  await expect(page.locator('.green')).toHaveText('+500');
  await expect(page.locator('.code-change-page .change')).toHaveCount(100);
  await page.getByRole('button', { name: '다음 결과 페이지', exact: true }).click();
  await page.locator('.code-change-page .change').first().click();
  await expect(page.getByRole('heading', { name: '변경 #101 상세' })).toBeVisible();
  await page.getByLabel('다음 변경').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: '변경 #102 상세' })).toBeVisible();
});

test('pending JSON transforms disable saving and cannot replace newer input', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'JSON Tools', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Minify', exact: true })).toBeEnabled();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/*compute.worker*', async (route) => {
    await gate;
    await route.continue().catch(() => {});
  });
  try {
    await page.getByRole('button', { name: 'Minify', exact: true }).click();
    await expect(page.getByRole('button', { name: 'JSON 저장', exact: true })).toBeDisabled();
    await page.getByLabel('JSON 파일 업로드', { exact: true }).setInputFiles({
      name: 'fresh.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"fresh":true}'),
    });
    await expect(page.locator('.json-source .view-lines')).toContainText('fresh');
    release();
    await page.unroute('**/*compute.worker*');
    await expect(page.locator('.json-valid')).toHaveText('유효한 표준 JSON');
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'JSON 저장', exact: true }).click();
    const download = await pending;
    expect(await readFile((await download.path())!, 'utf8')).toBe('{"fresh":true}');
  } finally {
    release();
    await page.unroute('**/*compute.worker*');
  }
});
