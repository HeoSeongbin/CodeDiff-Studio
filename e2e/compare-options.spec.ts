import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const labels = ['공백 무시', '줄 끝 공백 무시', '빈 줄 무시', '대소문자 무시', '줄바꿈 형식 무시'];
const cases = [
  {
    id: 'internal-space',
    label: '공백 무시 / 행 내부',
    old: 'const x = 1;\n',
    next: 'const x=1;\n',
    on: [0],
    before: [1, 1],
    after: [0, 0],
  },
  {
    id: 'leading-space',
    label: '공백 무시 / 들여쓰기',
    old: '  value\n',
    next: 'value\n',
    on: [0],
    before: [1, 1],
    after: [0, 0],
  },
  {
    id: 'trailing-space',
    label: '줄 끝 공백 무시 / 후행 공백',
    old: 'value  \n',
    next: 'value\n',
    on: [1],
    before: [1, 1],
    after: [0, 0],
  },
  {
    id: 'leading-under-trailing',
    label: '줄 끝 공백 무시 / 들여쓰기는 보존',
    old: '  value\n',
    next: 'value\n',
    on: [1],
    before: [1, 1],
    after: [1, 1],
  },
  {
    id: 'internal-under-trailing',
    label: '줄 끝 공백 무시 / 행 내부는 보존',
    old: 'a  b\n',
    next: 'a b\n',
    on: [1],
    before: [1, 1],
    after: [1, 1],
  },
  {
    id: 'blank-lines',
    label: '빈 줄 무시',
    old: 'first\n\nlast\n',
    next: 'first\nlast\n',
    on: [2],
    before: [0, 1],
    after: [0, 0],
  },
  {
    id: 'case',
    label: '대소문자 무시',
    old: 'const Name = "Hello";\n',
    next: 'const name = "hello";\n',
    on: [3],
    before: [1, 1],
    after: [0, 0],
  },
  {
    id: 'eol-crlf',
    label: '줄바꿈 형식 무시 / CRLF-LF',
    old: 'first\r\nsecond\r\n',
    next: 'first\nsecond\n',
    on: [4],
    before: [2, 2],
    after: [0, 0],
  },
  {
    id: 'eol-cr',
    label: '줄바꿈 형식 무시 / CR-LF',
    old: 'first\rsecond\r',
    next: 'first\nsecond\n',
    on: [4],
    before: [2, 2],
    after: [0, 0],
  },
  {
    id: 'real-content',
    label: '대소문자 무시 / 실제 다른 내용',
    old: 'Hello\n',
    next: 'Bye\n',
    on: [3],
    before: [1, 1],
    after: [1, 1],
  },
  {
    id: 'combined',
    label: '5개 옵션 조합',
    old: ' A  B \r\n\r\nend\r\n',
    next: 'ab\nend\n',
    on: [0, 1, 2, 3, 4],
    before: [2, 3],
    after: [0, 0],
  },
  {
    id: 'eof',
    label: '줄바꿈 형식 무시 / 마지막 개행 차이 유지',
    old: 'a\n',
    next: 'a',
    on: [4],
    before: [1, 1],
    after: [1, 1],
  },
  {
    id: 'trailing-blank',
    label: '빈 줄 무시 / 파일 끝 빈 줄',
    old: 'a\n\n',
    next: 'a\n',
    on: [2],
    before: [0, 1],
    after: [0, 0],
  },
];

const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page }) => {
  const collected: string[] = [];
  errors.set(page, collected);
  page.on('pageerror', (error) => collected.push(error.message));
});
test.afterEach(async ({ page }) => expect(errors.get(page)).toEqual([]));
async function check(page: Page, counts: number[]) {
  await expect(page.getByLabel('변경 분석', { exact: true })).toHaveAttribute('aria-busy', 'false');
  await expect(page.locator('.green')).toHaveText('+' + counts[0]);
  await expect(page.locator('.red')).toHaveText('−' + counts[1]);
  const highlights = page.locator(
    '.editor-area .line-insert, .editor-area .line-delete, .editor-area .char-insert, .editor-area .char-delete',
  );
  if (counts[0] + counts[1] === 0) await expect(highlights).toHaveCount(0);
  else await expect(highlights).not.toHaveCount(0);
}
for (const mode of ['side', 'unified'])
  for (const item of cases) {
    test(`${mode}: ${item.label} keeps analysis and visual diff consistent`, async ({ page }) => {
      await page.goto('/');
      await expect(page.getByText('Monaco ready', { exact: false })).toBeVisible();
      await page.getByLabel('비교 보기', { exact: true }).selectOption(mode);
      for (const label of labels) await page.getByLabel(label, { exact: true }).uncheck();
      for (const [side, text] of [
        ['Original', item.old],
        ['Modified', item.next],
      ])
        await page.getByLabel(`${side} 파일 업로드`).setInputFiles({
          name: 'options.txt',
          mimeType: 'text/plain',
          buffer: Buffer.from(text),
        });
      await check(page, item.before);
      for (const index of item.on) await page.getByLabel(labels[index], { exact: true }).check();
      await check(page, item.after);
      if (mode === 'side' && item.id === 'case')
        await page.screenshot({ path: 'docs/compare-options-fixed.png', fullPage: true });
      for (const [side, text] of [
        ['Original', item.old],
        ['Modified', item.next],
      ]) {
        const pending = page.waitForEvent('download');
        await page.getByLabel(`${side} 코드 다운로드`).click();
        expect(await readFile((await (await pending).path())!, 'utf8')).toBe(text);
      }
      for (const index of item.on) await page.getByLabel(labels[index], { exact: true }).uncheck();
      await check(page, item.before);
      if (item.id === 'eol-crlf') {
        await expect(page.locator('.diff-eol-marker')).not.toHaveCount(0);
        if (mode === 'side')
          await page.screenshot({ path: 'docs/compare-eol-fixed.png', fullPage: true });
      }
    });
  }

for (const mode of ['side', 'unified']) {
  test(`${mode}: blank-line filtering preserves physical navigation and folding`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByLabel('비교 보기').selectOption(mode);
    const lines = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`);
    const original = [...lines.slice(0, 10), '', ...lines.slice(10)].join('\n') + '\n';
    const modified = lines.join('\n').replace('line 20', 'changed 20') + '\n';
    for (const [side, text] of [
      ['Original', original],
      ['Modified', modified],
    ])
      await page
        .getByLabel(`${side} 파일 업로드`)
        .setInputFiles({ name: 'physical.txt', mimeType: 'text/plain', buffer: Buffer.from(text) });
    await page.getByLabel('빈 줄 무시', { exact: true }).check();
    await check(page, [1, 1]);
    await expect(page.getByText('원본 21 → 수정 20', { exact: true })).toBeVisible();
    await page.getByLabel('다음 변경', { exact: true }).click();
    await page.getByLabel('변경 영역만 보기', { exact: true }).check();
    await page.getByLabel('문맥 줄', { exact: true }).selectOption('3');
    await expect(page.locator('.diff-hidden-lines .center').first()).toBeVisible();
    await page.getByLabel('변경 영역만 보기', { exact: true }).uncheck();
    await expect(page.locator('.diff-hidden-lines')).toHaveCount(0);
    await page.getByLabel('빈 줄 무시', { exact: true }).uncheck();
    await check(page, [1, 2]);
  });
  test(`${mode}: fully ignored blank lines can fold and editing restores a real diff`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByLabel('비교 보기').selectOption(mode);
    const lines = Array.from({ length: 40 }, (_, i) => `line ${i}`);
    for (const [side, text] of [
      ['Original', ['', ...lines.slice(0, 10), '', ...lines.slice(10), ''].join('\n')],
      ['Modified', lines.join('\n')],
    ])
      await page
        .getByLabel(`${side} 파일 업로드`)
        .setInputFiles({ name: 'blanks.txt', mimeType: 'text/plain', buffer: Buffer.from(text) });
    await page.getByLabel('빈 줄 무시', { exact: true }).check();
    // Last nonblank line has a terminator only in Original; ignore format does not ignore EOF.
    // Supply matching final LF to isolate ignored blank lines from final-newline semantics.
    await page.getByLabel('Modified 파일 업로드').setInputFiles({
      name: 'blanks.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(lines.join('\n') + '\n'),
    });
    await check(page, [0, 0]);
    await page.getByLabel('변경 영역만 보기', { exact: true }).check();
    await page.getByLabel('문맥 줄', { exact: true }).selectOption('0');
    await expect(page.getByLabel('다음 변경')).toBeDisabled();
    await page.getByLabel('변경 영역만 보기', { exact: true }).uncheck();
    const editor = page.locator('.editor.modified .monaco-editor textarea');
    await editor.focus();
    await page.keyboard.press('Control+End');
    await page.keyboard.type('new');
    await check(page, [1, 0]);
  });
  for (const [original, modified, added, removed] of [
    ['', '\n', 1, 0],
    ['a', 'a\nnew', 2, 1],
    ['a\n', '', 0, 1],
    ['', 'a\n', 1, 0],
    ['a', 'a\n', 1, 1],
  ] as const) {
    test(`${mode}: safe empty/EOF models ${JSON.stringify([original, modified])}`, async ({
      page,
    }) => {
      await page.goto('/');
      await page.getByLabel('비교 보기').selectOption(mode);
      for (const [side, text] of [
        ['Original', original],
        ['Modified', modified],
      ])
        await page
          .getByLabel(`${side} 파일 업로드`)
          .setInputFiles({ name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.from(text) });
      await check(page, [added, removed]);
      await page.getByLabel('다음 변경').click();
    });
  }
}
for (const mode of ['side', 'unified']) {
  test(`${mode}: folding never hides a changed line after 100 ignored blank lines`, async ({
    page,
  }) => {
    await page.goto('/');
    await page.getByLabel('비교 보기').selectOption(mode);
    const lines = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`);
    const original = [lines[0], ...Array(100).fill(''), ...lines.slice(1)].join('\n') + '\n';
    const modified = lines.join('\n').replace('line 20', 'changed 20') + '\n';
    for (const [side, text] of [
      ['Original', original],
      ['Modified', modified],
    ])
      await page.getByLabel(`${side} 파일 업로드`).setInputFiles({
        name: 'many-blanks.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from(text),
      });
    await page.getByLabel('빈 줄 무시', { exact: true }).check();
    await check(page, [1, 1]);
    await expect(page.getByText('원본 120 → 수정 20', { exact: true })).toBeVisible();
    await page.getByLabel('변경 영역만 보기').check();
    await page.getByLabel('문맥 줄', { exact: true }).selectOption('0');
    await page.getByLabel('다음 변경', { exact: true }).click();
    await expect(
      page.locator('.editor.modified .view-lines:not([monaco-view-zone])'),
    ).toContainText('changed 20');
    await expect(page.locator('.editor-area .line-insert')).not.toHaveCount(0);
    await page.getByLabel('변경 영역만 보기').uncheck();
  });
}
