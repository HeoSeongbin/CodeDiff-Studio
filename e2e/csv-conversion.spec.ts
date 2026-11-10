import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fromCsv } from '../src/core/json/csv';

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
  await page.getByRole('button', { name: 'JSON Tools', exact: true }).click();
  await page.getByRole('button', { name: 'JSON ↔ CSV', exact: true }).click();
  await expect(page.getByRole('button', { name: '변환 실행', exact: true })).toBeEnabled();
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));

async function source(page: Page, text: string) {
  await page.getByLabel('JSON 파일 업로드', { exact: true }).setInputFiles({
    name: 'source.json',
    mimeType: 'application/json',
    buffer: Buffer.from(text),
  });
  await expect(page.locator('.json-source .view-lines')).toContainText(text);
  await expect(page.getByRole('button', { name: '변환 실행', exact: true })).toBeEnabled();
}
async function download(page: Page, name: string) {
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name, exact: true }).click();
  const file = await pending;
  return { name: file.suggestedFilename(), text: await readFile((await file.path())!, 'utf8') };
}
async function convert(page: Page) {
  await page.getByRole('button', { name: '변환 실행', exact: true }).click();
  await expect(page.getByLabel('생성 결과', { exact: true })).toBeVisible();
  const output = (await page.getByLabel('생성 결과', { exact: true }).textContent())!;
  const saved = await download(page, '결과 저장');
  expect(saved.text).toBe(output);
  return saved;
}
async function csvMode(page: Page) {
  await page.getByLabel('CSV 변환 방향').selectOption('toJson');
  await expect(page.getByRole('heading', { name: 'Source CSV', exact: true })).toBeVisible();
  await expect(page.getByLabel('JSON 파일 업로드', { exact: true })).toBeHidden();
}

test('Flatten retains negative scalar types and string formula protection, with exact source downloads', async ({
  page,
}) => {
  const text = '[{"amount":-12,"nested":{"n":-3,"b":false,"nil":null},"literal":"-12"}]';
  await source(page, text);
  const normal = await convert(page);
  expect(fromCsv(normal.text, ',', true)).toMatchObject([{ amount: -12, literal: "'-12" }]);
  await page.getByLabel('중첩 Flatten', { exact: true }).check();
  await expect(page.getByLabel('생성 결과', { exact: true })).toHaveCount(0);
  const flat = await convert(page);
  expect(flat.name).toBe('result.csv');
  expect(fromCsv(flat.text, ',', true)).toEqual([
    {
      '/amount': -12,
      '/nested/n': -3,
      '/nested/b': false,
      '/nested/nil': null,
      '/literal': "'-12",
    },
  ]);
  expect((await download(page, 'JSON 저장')).text).toBe(text);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'docs/csv-conversion-fixed.png', fullPage: true });
});

for (const input of ['[]', '[{}]']) {
  test(`empty export ${input} displays an actionable error`, async ({ page }) => {
    await source(page, input);
    await page.getByRole('button', { name: '변환 실행', exact: true }).click();
    await expect(page.locator('.json-workspace .error[role=alert]')).toContainText('데이터나 컬럼');
    await expect(page.getByRole('button', { name: '결과 저장', exact: true })).toHaveCount(0);
    expect((await download(page, 'JSON 저장')).text).toBe(input);
  });
}
for (const input of ['[{"":1}]', '[{"  ":1}]']) {
  test(`invalid export header ${input} is rejected consistently`, async ({ page }) => {
    await source(page, input);
    await page.getByRole('button', { name: '변환 실행', exact: true }).click();
    await expect(page.locator('.json-workspace .error[role=alert]')).toContainText('Header');
    await expect(page.getByLabel('생성 결과', { exact: true })).toHaveCount(0);
  });
}
for (const delimiter of [',', ';', '\t']) {
  test(`CSV input with delimiter ${JSON.stringify(delimiter)} preserves quotes, Unicode, multiline and inference`, async ({
    page,
  }) => {
    await csvMode(page);
    await page.getByLabel('CSV 구분자').selectOption(delimiter);
    const input =
      ['name', 'age', 'note'].join(delimiter) +
      '\r\n' +
      [`"홍${delimiter}길동"`, '30', '"hello\n서울"'].join(delimiter) +
      '\r\n';
    await page.getByLabel('CSV 입력').fill(input);
    const strings = await convert(page);
    expect(strings.name).toBe('result.json');
    expect(JSON.parse(strings.text)).toEqual([
      { name: `홍${delimiter}길동`, age: '30', note: 'hello\n서울' },
    ]);
    await page.getByLabel('타입 추론', { exact: true }).check();
    const inferred = await convert(page);
    expect(JSON.parse(inferred.text)[0].age).toBe(30);
    // Textarea edits use LF. Uploaded CRLF is separately verified without edits.
    expect((await download(page, 'CSV 저장')).text).toBe(input.replace(/\r\n/g, '\n'));
    await page.getByRole('button', { name: 'CSV 샘플 불러오기', exact: true }).click();
    expect(JSON.parse((await convert(page)).text)).toEqual([
      { name: 'Hong', age: 30 },
      { name: 'Heo', age: 28 },
    ]);
  });
}

test('optional blank-record skipping preserves quoted empty cells and source', async ({ page }) => {
  await csvMode(page);
  const input = 'a,b\n1,2\n\n"",x\n,\n3,4\n';
  await page.getByLabel('CSV 입력').fill(input);
  await expect(page.getByLabel('빈 행 건너뛰기', { exact: true })).not.toBeChecked();
  await page.getByRole('button', { name: '변환 실행', exact: true }).click();
  await expect(page.locator('.json-workspace .error[role=alert]')).toContainText('레코드 3');
  await page.getByLabel('빈 행 건너뛰기', { exact: true }).check();
  expect(JSON.parse((await convert(page)).text)).toEqual([
    { a: '1', b: '2' },
    { a: '', b: 'x' },
    { a: '', b: '' },
    { a: '3', b: '4' },
  ]);
  expect((await download(page, 'CSV 저장')).text).toBe(input);
  await page.getByLabel('빈 행 건너뛰기', { exact: true }).uncheck();
  await expect(page.getByLabel('생성 결과', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '변환 실행', exact: true }).click();
  await expect(page.locator('.json-workspace .error[role=alert]')).toContainText('컬럼 수');
});

test('conversion direction shows its own input and retains independent JSON source', async ({
  page,
}) => {
  await source(page, '{broken');
  await expect(page.locator('.json-parse-error')).toBeVisible();
  await csvMode(page);
  await expect(page.locator('.json-parse-error')).toBeHidden();
  await page.getByLabel('CSV 입력').fill('id,big,flag\n001,9007199254740993,true');
  await page.getByLabel('타입 추론', { exact: true }).check();
  expect(JSON.parse((await convert(page)).text)).toEqual([
    { id: '001', big: '9007199254740993', flag: true },
  ]);
  await page.getByRole('button', { name: 'Editor / Formatter', exact: true }).click();
  await expect(page.locator('.json-parse-error')).toBeVisible();
  expect((await download(page, 'JSON 저장')).text).toBe('{broken');
});

for (const input of ['a,a\n1,2', 'a,b\n1', 'a\n"unterminated']) {
  test(`invalid CSV ${JSON.stringify(input)} cannot leave a downloadable stale result`, async ({
    page,
  }) => {
    await csvMode(page);
    await page.getByLabel('CSV 입력').fill('a,b\n1,2');
    await convert(page);
    await page.getByLabel('CSV 입력').fill(input);
    await expect(page.getByLabel('생성 결과', { exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: '변환 실행', exact: true }).click();
    await expect(page.locator('.json-workspace .error[role=alert]')).toBeVisible();
    await expect(page.getByRole('button', { name: '결과 저장', exact: true })).toHaveCount(0);
  });
}

test('new CSV input cancels a delayed conversion and cannot receive an old result', async ({
  page,
}) => {
  await csvMode(page);
  await page.getByLabel('CSV 입력').fill('name\nOld');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/*compute.worker*', async (route) => {
    await gate;
    await route.continue().catch(() => {});
  });
  try {
    await page.getByRole('button', { name: '변환 실행', exact: true }).click();
    await expect(page.getByRole('button', { name: '변환 실행', exact: true })).toBeDisabled();
    await page.getByLabel('CSV 입력').fill('name\nNew');
    release();
    await page.unroute('**/*compute.worker*');
    await expect(page.getByRole('button', { name: '변환 실행', exact: true })).toBeEnabled();
    await expect(page.getByLabel('생성 결과', { exact: true })).toHaveCount(0);
    expect(JSON.parse((await convert(page)).text)).toEqual([{ name: 'New' }]);
  } finally {
    release();
    await page.unroute('**/*compute.worker*');
  }
});

test('CSV-specific JSON sample and column order work without changing other tools samples', async ({
  page,
}) => {
  await page.getByRole('button', { name: '변환 실행', exact: true }).click();
  await expect(page.locator('.json-workspace .error[role=alert]')).toContainText('객체 배열');
  await page.getByRole('button', { name: 'JSON 샘플 불러오기', exact: true }).click();
  await expect(page.locator('.csv-columns')).toContainText('amount');
  await page
    .locator('.csv-columns')
    .getByRole('checkbox', { name: /^age(?: \(#\d+\))?$/ })
    .check();
  await page
    .locator('.csv-columns')
    .getByRole('checkbox', { name: /^name(?: \(#\d+\))?$/ })
    .check();
  expect((await convert(page)).text.startsWith('age,name\r\n')).toBe(true);
  await page.getByRole('button', { name: 'Editor / Formatter', exact: true }).click();
  await page.getByRole('button', { name: 'JSON 샘플 불러오기', exact: true }).click();
  expect(JSON.parse((await download(page, 'JSON 저장')).text).userId).toBe(1001);
});

test('CSV upload and conversion fit a mobile viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await csvMode(page);
  await page.getByLabel('CSV 파일 업로드').setInputFiles({
    name: 'data.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('\uFEFFname,age\r\n홍,30\r\n'),
  });
  await expect(page.getByLabel('CSV 입력')).toHaveValue('name,age\n홍,30\n');
  expect((await download(page, 'CSV 저장')).text).toBe('name,age\r\n홍,30\r\n');
  const result = await convert(page);
  expect(JSON.parse(result.text)).toEqual([{ name: '홍', age: '30' }]);
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'docs/csv-conversion-mobile.png', fullPage: true });
});

test('empty input error appears beside the conversion button on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await source(page, '[]');
  await page.getByRole('button', { name: '변환 실행', exact: true }).click();
  const error = page.locator('.json-tool-panel .error[role=alert]');
  await expect(error).toBeVisible();
  const bounds = await error.boundingBox();
  expect(bounds!.y).toBeGreaterThanOrEqual(72);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
  await expect(page.getByRole('button', { name: '결과 저장', exact: true })).toHaveCount(0);
});
