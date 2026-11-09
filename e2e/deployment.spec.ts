import { test, expect } from '@playwright/test';

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
