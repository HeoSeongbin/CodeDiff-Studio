import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
async function open(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Field Mapping', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: '필드를 연결하고, 데이터를 변환하세요.' }),
  ).toBeVisible();
  await expect(page.getByLabel('매핑 Target JSON')).toBeVisible();
}
async function source(page: Page, text: string) {
  await page.getByLabel('Mapping Source 파일 업로드').setInputFiles({
    name: 'source.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
}
async function rules(page: Page, value: unknown) {
  const toggle = page.getByRole('button', { name: '규칙 JSON 가져오기', exact: true });
  if ((await toggle.getAttribute('aria-expanded')) === 'false') await toggle.click();
  await page.getByLabel('매핑 규칙 JSON', { exact: true }).fill(JSON.stringify(value));
  await page.getByRole('button', { name: '가져오기 적용', exact: true }).click();
}
async function output(page: Page) {
  return JSON.parse((await page.getByLabel('매핑 Target JSON').textContent())!);
}
test('Phase 4 source tree selection, rule edits, exclusion, downloads and workspace preservation', async ({
  page,
  baseURL,
}) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (
      !r.url().startsWith(baseURL!) &&
      !r.url().startsWith('blob:') &&
      !r.url().startsWith('data:')
    )
      external.push(r.url());
  });
  await open(page);
  await expect
    .poll(() => output(page))
    .toEqual({
      account: { id: 1001, displayName: 'Hong' },
      members: [{ userId: 1 }, { userId: 2 }],
    });
  await page.getByLabel('Mapping Source 트리 검색', { exact: true }).fill('Hong');
  await page.locator('.mapping-source .tree-value').click();
  await expect(page.getByLabel('선택한 Source Path')).toHaveText('$["user"]["name"]');
  await page.getByRole('button', { name: '선택 경로로 규칙 추가', exact: true }).click();
  await expect(page.getByLabel('규칙 4 Source Path', { exact: true })).toHaveValue(
    '$["user"]["name"]',
  );
  await page.getByLabel('규칙 4 Target Path', { exact: true }).fill('$.displayName');
  await expect.poll(() => output(page)).toMatchObject({ displayName: 'Hong' });
  await page.getByLabel('규칙 4 적용', { exact: true }).uncheck();
  await expect.poll(async () => Object.hasOwn(await output(page), 'displayName')).toBe(false);
  await page.getByLabel('규칙 4 삭제', { exact: true }).click();
  await expect(page.getByLabel('매핑 규칙 4', { exact: true })).toHaveCount(0);
  await page.getByLabel('Mapping Target 트리 검색', { exact: true }).fill('Hong');
  await page.locator('.mapping-target .tree-value').click();
  await expect(
    page
      .locator('.mapping-target')
      .getByRole('treeitem', { selected: true })
      .filter({ hasText: 'Hong' }),
  ).toBeVisible();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Target 저장', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('mapped-target.json');
  expect(JSON.parse(await readFile((await download.path())!, 'utf8'))).toEqual(await output(page));
  await page.getByRole('button', { name: 'JSON Tools', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'JSON을 탐색하고, 변환하세요.' })).toBeVisible();
  await page.getByRole('button', { name: 'Code Compare', exact: true }).click();
  await expect(page.getByRole('heading', { name: '코드의 차이를, 명확하게.' })).toBeVisible();
  await page.getByRole('button', { name: 'Field Mapping', exact: true }).click();
  await expect(page.getByLabel('규칙 1 Source Path')).toHaveValue('$.user.id');
  await expect(page.getByLabel('매핑 Target JSON')).toBeVisible();
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await page.screenshot({ path: 'docs/phase4-mapping-desktop.png', fullPage: true });
});
test('Phase 4 transformations, defaults, constants, arrays, atomic errors and source preservation', async ({
  page,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await open(page);
  const text =
    '{"id":"42","active":"false","created":"2026-11-06","null":null,"members":[{"x":"1"},{"x":"2"}]}';
  await source(page, text);
  const list = [
    { id: 'id', sourcePath: '$.id', targetPath: '$.id', transform: 'number' },
    { id: 'flag', sourcePath: '$.active', targetPath: '$.enabled', transform: 'boolean' },
    { id: 'date', sourcePath: '$.created', targetPath: '$.created', transform: 'date' },
    { id: 'label', targetPath: '$.label', transform: 'constant', constantValue: 'hello' },
    {
      id: 'fallback',
      sourcePath: '$.missing',
      targetPath: '$.fallback',
      transform: 'copy',
      defaultValue: 'guest',
    },
    { id: 'array', sourcePath: '$.members[*].x', targetPath: '$.rows[*]', transform: 'number' },
    {
      id: 'null',
      sourcePath: '$.null',
      targetPath: '$.null',
      transform: 'copy',
      defaultValue: 'wrong',
    },
  ];
  await rules(page, { version: 1, rules: list });
  const expected = {
    id: 42,
    enabled: false,
    created: '2026-11-06T00:00:00.000Z',
    label: 'hello',
    fallback: 'guest',
    rows: [1, 2],
    null: null,
  };
  await expect.poll(() => output(page)).toEqual(expected);
  await page.getByRole('button', { name: 'Target 복사', exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe(JSON.stringify(expected, null, 2).replace(/\r?\n/g, '\r\n'));
  await page.getByLabel('규칙 1 Target Path', { exact: true }).fill('$.rows');
  await expect(page.locator('.mapping-errors')).toContainText('충돌');
  await expect(page.getByLabel('매핑 Target JSON')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Target 저장', exact: true })).toBeDisabled();
  await page.getByLabel('규칙 1 Target Path', { exact: true }).fill('$.id');
  await expect.poll(() => output(page)).toEqual(expected);
  await page.getByLabel('규칙 1 Source Path', { exact: true }).fill('$.missing');
  await expect(page.locator('.mapping-errors')).toContainText('없습니다');
  await page.getByLabel('규칙 1 기본값 사용', { exact: true }).check();
  await page.getByLabel('규칙 1 기본값 JSON', { exact: true }).fill('"99"');
  await expect.poll(() => output(page)).toMatchObject({ id: 99 });
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Source 저장', exact: true }).click();
  expect(await readFile((await (await pending).path())!, 'utf8')).toBe(text);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: 'docs/phase4-mapping-mobile.png', fullPage: true });
});
test('Phase 4 rule import validation, export roundtrip and empty/null values', async ({ page }) => {
  await open(page);
  const before = await output(page);
  await rules(page, [
    { id: 'evil', sourcePath: '$', targetPath: '$["__proto__"].polluted', transform: 'copy' },
  ]);
  await expect(page.locator('.mapping-import-error')).toContainText('위험');
  await expect.poll(() => output(page)).toEqual(before);
  expect(await page.evaluate(() => (({}) as Record<string, unknown>).polluted)).toBeUndefined();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: '규칙 내보내기', exact: true }).click();
  const exported = JSON.parse(await readFile((await (await pending).path())!, 'utf8'));
  expect(exported.version).toBe(1);
  expect(exported.rules).toHaveLength(3);
  await page.getByLabel('규칙 3 삭제', { exact: true }).click();
  await expect(page.getByLabel('규칙 3 Target Path')).toHaveCount(0);
  await page.getByLabel('매핑 규칙 파일 업로드', { exact: true }).setInputFiles({
    name: 'rules.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(page.getByLabel('규칙 3 Target Path')).toHaveValue('$.members[*].userId');
  await expect.poll(() => output(page)).toEqual(before);
  await source(page, '{"items":[]}');
  await rules(page, [
    { id: 'items', sourcePath: '$.items[*]', targetPath: '$.items[*]', transform: 'copy' },
  ]);
  await expect.poll(() => output(page)).toEqual({ items: [] });
  await source(page, 'null');
  await rules(page, [{ id: 'root', sourcePath: '$', targetPath: '$', transform: 'copy' }]);
  await expect(page.getByLabel('매핑 Target JSON')).toHaveText('null');
  await rules(page, []);
  await expect(page.getByLabel('매핑 Target JSON')).toHaveText('{}');
  await page.getByRole('button', { name: '규칙 추가', exact: true }).click();
  await expect(page.getByLabel('규칙 1 Target Path')).toBeVisible();
});
