import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
async function openJson(page: import('@playwright/test').Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'JSON Tools', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'JSON을 탐색하고, 변환하세요.' })).toBeVisible();
}
async function source(page: import('@playwright/test').Page, text: string) {
  await page.getByLabel('JSON 파일 업로드', { exact: true }).setInputFiles({
    name: 'sample.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
}
async function tab(page: import('@playwright/test').Page, name: string) {
  await page
    .getByRole('navigation', { name: 'JSON 도구' })
    .getByRole('button', { name, exact: true })
    .click();
}
test('Phase 3 formatting, precision errors, state persistence and raw downloads', async ({
  page,
  baseURL,
}) => {
  const external: string[] = [];
  const errors: string[] = [];
  page.on('request', (r) => {
    if (
      !r.url().startsWith(baseURL!) &&
      !r.url().startsWith('blob:') &&
      !r.url().startsWith('data:')
    )
      external.push(r.url());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  await openJson(page);
  await source(page, '{"z":2,"a":{"b":true}}');
  await page.getByRole('button', { name: 'Key Sorting', exact: true }).click();
  await page.getByRole('button', { name: 'Minify', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON 저장', exact: true }).click();
  expect(await readFile((await (await pending).path())!, 'utf8')).toBe('{"a":{"b":true},"z":2}');
  await page.getByRole('button', { name: 'Code Compare', exact: true }).click();
  await expect(page.getByRole('heading', { name: '코드의 차이를, 명확하게.' })).toBeVisible();
  await page.getByRole('button', { name: 'JSON Tools', exact: true }).click();
  await source(page, '{"n":9007199254740993}');
  await expect(page.locator('.json-parse-error')).toContainText('정밀도');
  await page.getByRole('button', { name: 'Pretty Print', exact: true }).click();
  await expect(page.locator('.error')).toContainText('정밀도');
  const raw = page.waitForEvent('download');
  await page.getByRole('button', { name: 'JSON 저장', exact: true }).click();
  expect(await readFile((await (await raw).path())!, 'utf8')).toBe('{"n":9007199254740993}');
  await source(page, '{"broken":}');
  await expect(page.locator('.json-parse-error')).toBeVisible();
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
});
test('Phase 3 tree virtualization, safe JSONPath and structural diff', async ({ page }) => {
  await openJson(page);
  await source(
    page,
    JSON.stringify({
      users: Array.from({ length: 5000 }, (_, id) => ({ id, name: `user ${id}` })),
    }),
  );
  await tab(page, 'Tree Viewer');
  await page.getByRole('button', { name: '전체 펼치기', exact: true }).click();
  await expect(page.getByRole('treeitem')).toHaveCount(24);
  await expect(page.getByText('15,002개 노드 · 화면 행만 렌더링')).toBeVisible();
  await page.getByLabel('JSON 트리 검색', { exact: true }).fill('user 4999');
  await expect(page.getByRole('treeitem')).toHaveCount(1);
  await source(page, '{"users":[{"id":1,"name":"Hong"},{"id":2,"name":"Heo"}]}');
  await tab(page, 'JSONPath');
  await page.getByLabel('JSONPath 표현식').fill('$.users[*].name');
  await page.getByRole('button', { name: '검색 실행', exact: true }).click();
  await expect(page.getByText('2개 일치', { exact: true })).toBeVisible();
  await page.locator('.json-change-list button').last().click();
  await expect(
    page.getByRole('treeitem', { selected: true }).getByText('Heo', { exact: false }),
  ).toBeVisible();
  await page.getByLabel('JSONPath 표현식').fill('$[?(@.id)]');
  await page.getByRole('button', { name: '검색 실행', exact: true }).click();
  await expect(page.locator('.error')).toContainText('실행하지 않습니다');
  await tab(page, 'Structural Diff');
  await page.getByLabel('JSON 수정본 업로드').setInputFiles({
    name: 'after.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{"users":[{"id":"1","name":"Hong"}]}'),
  });
  await expect(page.locator('.json-change-list')).toContainText('TYPE_CHANGED');
  await expect(page.locator('.json-change-list')).toContainText('FIELD_REMOVED');
  await page.getByRole('button', { name: '다음 JSON 변경', exact: true }).click();
  await page.getByLabel('변경 항목만 보기', { exact: true }).check();
  await expect(page.getByRole('treeitem').filter({ hasText: 'Hong' })).toHaveCount(0);
  await page.screenshot({ path: 'docs/phase3-json-diff.png', fullPage: true });
});
test('Phase 3 Schema, types, CSV conversion and mobile', async ({ page }) => {
  await openJson(page);
  await source(
    page,
    '[{"id":1,"name":"Hong","profile":{"city":"서울"}},{"id":2,"name":null,"profile":{"city":"부산"}}]',
  );
  await tab(page, 'JSON Schema');
  await page.getByRole('button', { name: 'Schema 생성', exact: true }).click();
  await page.getByRole('button', { name: 'Schema 검증', exact: true }).click();
  await expect(page.locator('.validation-result')).toHaveText('Schema 검증 통과');
  await page.getByLabel('JSON Schema 편집').fill('{"type":"string"}');
  await page.getByRole('button', { name: 'Schema 검증', exact: true }).click();
  await expect(page.locator('.validation-result')).toContainText('must be string');
  await tab(page, 'TypeScript');
  await page.getByRole('button', { name: '타입 생성', exact: true }).click();
  await expect(page.getByLabel('생성 결과')).toContainText('export interface');
  await expect(page.getByLabel('생성 결과')).toContainText('string | null');
  await page.getByLabel('TypeScript 타입명').fill('class');
  await page.getByRole('button', { name: '타입 생성', exact: true }).click();
  await expect(page.locator('.error')).toContainText('식별자');
  await tab(page, 'JSON ↔ CSV');
  await page.getByLabel('중첩 Flatten', { exact: true }).check();
  await page.getByRole('button', { name: '변환 실행', exact: true }).click();
  await expect(page.getByLabel('생성 결과')).toContainText('/profile/city');
  await page.getByLabel('CSV 변환 방향').selectOption('toJson');
  await page.getByLabel('CSV 입력').fill('name,age\n"홍,길동",30');
  await page.getByLabel('타입 추론', { exact: true }).check();
  await page.getByRole('button', { name: '변환 실행', exact: true }).click();
  await expect(page.getByLabel('생성 결과')).toContainText('"age": 30');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: 'docs/phase3-json-mobile.png', fullPage: true });
});

test('Phase 3 direct editing, result paging and generated downloads', async ({ page }) => {
  await openJson(page);
  await source(page, '{"a":1}');
  const input = page.locator('.json-source .json-editor .monaco-editor textarea').first();
  await input.focus();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('x');
  await expect(page.locator('.json-parse-error')).toBeVisible();
  await page.keyboard.press('Control+z');
  await expect(page.locator('.json-valid')).toBeVisible();
  await source(page, JSON.stringify(Array.from({ length: 250 }, (_, id) => ({ id }))));
  await tab(page, 'JSONPath');
  await page.getByLabel('JSONPath 표현식').fill('$[*]');
  await page.getByRole('button', { name: '검색 실행', exact: true }).click();
  await expect(page.locator('.json-change-list button')).toHaveCount(100);
  await page.getByRole('button', { name: '다음 결과 페이지', exact: true }).click();
  await expect(page.locator('.json-change-list button').first()).toContainText('$[100]');
  await page.getByRole('button', { name: '다음 결과 페이지', exact: true }).click();
  await expect(page.locator('.json-change-list button')).toHaveCount(50);
  await tab(page, 'TypeScript');
  await page.getByRole('button', { name: '타입 생성', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '결과 저장', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('result.ts');
  expect(await readFile((await download.path())!, 'utf8')).toContain(
    'export interface RootValueItem',
  );
  await source(page, '[{"name":"=1+1","empty":""}]');
  await tab(page, 'JSON ↔ CSV');
  await page.getByRole('button', { name: '변환 실행', exact: true }).click();
  await expect(page.getByLabel('생성 결과')).toContainText("'=1+1");
  const csvDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: '결과 저장', exact: true }).click();
  expect(await readFile((await (await csvDownload).path())!, 'utf8')).toContain("'=1+1");
  await page.getByLabel('CSV 변환 방향').selectOption('toJson');
  await page.getByLabel('CSV 파일 업로드').setInputFiles({
    name: 'input.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name,age\nHeo,30'),
  });
  await page.getByRole('button', { name: '변환 실행', exact: true }).click();
  await expect(page.getByLabel('생성 결과')).toContainText('Heo');
});
