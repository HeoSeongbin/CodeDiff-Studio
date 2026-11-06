import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { applyPatch } from 'diff';
async function upload(
  page: Page,
  side: 'Original' | 'Modified',
  text: string,
  name = 'sample.txt',
) {
  await page
    .getByLabel(`${side} 파일 업로드`)
    .setInputFiles({ name, mimeType: 'text/plain', buffer: Buffer.from(text) });
}
async function openPatch(page: Page) {
  await page.getByRole('button', { name: 'Patch Export', exact: true }).click();
  await expect(page.getByRole('heading', { name: '변경사항을 Patch로 내보내세요.' })).toBeVisible();
}
async function generate(page: Page) {
  await page.getByRole('button', { name: 'Patch 생성 및 검증', exact: true }).click();
  await expect(
    page.getByText('적용 검증 통과 · 수정본과 정확히 일치', { exact: true }),
  ).toBeVisible();
}
test('Phase 5 raw Patch ignores display options and exports exact verified files', async ({
  page,
  baseURL,
  context,
}) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
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
  await page.goto('/');
  const original = 'A \r\n\r\nend\r\n',
    modified = 'a\nend\n';
  await upload(page, 'Original', original, 'before.txt');
  await upload(page, 'Modified', modified, 'after.txt');
  for (const label of ['공백 무시', '빈 줄 무시', '대소문자 무시', '줄바꿈 형식 무시'])
    await page.getByLabel(label, { exact: true }).check();
  await expect(page.getByText('선택한 비교 옵션에서 차이가 없습니다.')).toBeVisible();
  await openPatch(page);
  await page.getByLabel('Patch 대상 경로').fill('src/example.txt');
  await generate(page);
  const preview = await page.getByLabel('Patch 미리보기').textContent();
  expect(preview).toContain('-A \r\n');
  expect(preview).toContain('+a\n');
  for (const extension of ['diff', 'patch']) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: `.${extension} 저장`, exact: true }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe(`example.txt.${extension}`);
    const patch = await readFile((await download.path())!, 'utf8');
    expect(patch).toBe(preview);
    expect(applyPatch(original, patch, { autoConvertLineEndings: false, fuzzFactor: 0 })).toBe(
      modified,
    );
  }
  await page.getByRole('button', { name: 'Patch 복사', exact: true }).click();
  await expect(page.locator('.patch-workspace .notice')).toContainText('Patch를 복사했습니다.');
  expect((await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')).toBe(
    preview!.replace(/\r\n/g, '\n'),
  );
  await page.getByRole('button', { name: 'Patch 적용 재검증', exact: true }).click();
  await expect(page.locator('.patch-workspace .notice')).toContainText('정확히 일치');
  await page.getByLabel('미리보기 CR 문자 표시 (␍)', { exact: true }).check();
  await expect(page.getByLabel('Patch 미리보기')).toContainText('␍');
  await page.getByLabel('Patch 문맥 줄', { exact: true }).selectOption('0');
  await expect(page.getByRole('button', { name: '.patch 저장', exact: true })).toBeDisabled();
  await generate(page);
  await expect(page.locator('.patch-notes code')).toContainText('--unidiff-zero');
  expect(external).toEqual([]);
  expect(errors).toEqual([]);
  await page.screenshot({ path: 'docs/phase5-patch-desktop.png', fullPage: true });
});
test('Phase 5 invalidates stale previews after editing and handles paths and unchanged files', async ({
  page,
}) => {
  await page.goto('/');
  await openPatch(page);
  await generate(page);
  await page.getByRole('button', { name: '코드 비교로 돌아가기', exact: true }).click();
  await expect(page.getByText('Monaco ready', { exact: false })).toBeVisible();
  const editor = page.locator('.monaco-editor textarea').last();
  await editor.focus();
  await page.keyboard.press('Control+End');
  await page.keyboard.type('extra');
  await openPatch(page);
  await expect(page.getByLabel('Patch 미리보기')).toHaveCount(0);
  await expect(page.getByRole('button', { name: '.patch 저장', exact: true })).toBeDisabled();
  await generate(page);
  await expect(page.getByLabel('Patch 미리보기')).toContainText('+extra');
  await page.getByLabel('Patch 대상 경로').fill('../unsafe.txt');
  await page.getByRole('button', { name: 'Patch 생성 및 검증', exact: true }).click();
  await expect(page.locator('.patch-error')).toContainText('안전한 상대 경로');
  await expect(page.getByRole('button', { name: '.diff 저장', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Original 파일명 사용', exact: true }).click();
  await expect(page.getByLabel('Patch 대상 경로')).toHaveValue('Greeting.java');
  await page.getByRole('button', { name: '코드 비교로 돌아가기', exact: true }).click();
  await upload(page, 'Original', 'same\n');
  await upload(page, 'Modified', 'same\n');
  await openPatch(page);
  await page.getByRole('button', { name: 'Patch 생성 및 검증', exact: true }).click();
  await expect(
    page.getByText('원문 동일 · 내보낼 변경사항이 없습니다.', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Patch 복사', exact: true })).toBeDisabled();
});
test('Phase 5 explicit create/delete, Unicode paths, EOF and mobile', async ({ page }) => {
  await page.goto('/');
  await upload(page, 'Original', '');
  await upload(page, 'Modified', '한글\r\n');
  await openPatch(page);
  await page.getByLabel('Patch 대상 경로').fill('folder/환경 설정.txt');
  await page.getByLabel('Patch 파일 작업').selectOption('create');
  await generate(page);
  await expect(page.getByLabel('Patch 미리보기')).toContainText(
    '--- /dev/null\n+++ "b/folder/환경 설정.txt"',
  );
  await page.getByLabel('Patch 파일 작업').selectOption('delete');
  await page.getByRole('button', { name: 'Patch 생성 및 검증', exact: true }).click();
  await expect(page.locator('.patch-error')).toContainText('Modified가 비어');
  await page.getByRole('button', { name: '코드 비교로 돌아가기', exact: true }).click();
  await upload(page, 'Original', '삭제할 내용');
  await upload(page, 'Modified', '');
  await openPatch(page);
  await generate(page);
  await expect(page.getByLabel('Patch 미리보기')).toContainText('+++ /dev/null');
  await expect(page.getByLabel('Patch 미리보기')).toContainText('\\ No newline at end of file');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  await page.screenshot({ path: 'docs/phase5-patch-mobile.png', fullPage: true });
});
