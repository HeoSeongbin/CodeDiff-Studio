import { test, expect } from '@playwright/test';
import { writeFile, readFile, mkdtemp, mkdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname, basename } from 'node:path';
test('Phase 8 production performance and responsiveness matrix', async ({
  page,
  context,
  browser,
}) => {
  const errors: string[] = [],
    external: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:') && !request.url().startsWith('data:'))
      external.push(request.url());
  });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Performance.enable');
  const memory = async () => {
    await cdp.send('HeapProfiler.collectGarbage');
    const metrics = await cdp.send('Performance.getMetrics');
    return (
      metrics.metrics.find(
        (metric: { name: string; value: number }) => metric.name === 'JSHeapUsedSize',
      )?.value ?? 0
    );
  };
  await page.goto('/');
  await expect(page.getByLabel('다음 변경')).toBeEnabled();
  const baselineHeap = await memory();
  const results: Record<string, unknown>[] = [];
  async function begin() {
    await page.evaluate(() => {
      const probe = { last: performance.now(), gaps: [] as number[], timer: 0 };
      probe.timer = window.setInterval(() => {
        const now = performance.now();
        probe.gaps.push(now - probe.last);
        probe.last = now;
      }, 16);
      (window as unknown as { phase8Probe: typeof probe }).phase8Probe = probe;
    });
    return performance.now();
  }
  async function finish(name: string, started: number, extra: Record<string, unknown>) {
    const wallMs = performance.now() - started;
    const loop = await page.evaluate(() => {
      const probe = (
        window as unknown as { phase8Probe: { last: number; gaps: number[]; timer: number } }
      ).phase8Probe;
      clearInterval(probe.timer);
      const gaps = probe.gaps.sort((a, b) => a - b);
      return {
        samples: gaps.length,
        maxGapMs: Math.max(0, ...gaps),
        p95GapMs: gaps[Math.min(gaps.length - 1, Math.floor(gaps.length * 0.95))] ?? 0,
      };
    });
    const heapBytes = await memory();
    results.push({ name, wallMs, ...loop, mainThreadHeapBytes: heapBytes, ...extra });
    expect(wallMs, `${name} wall time`).toBeLessThan(15000);
    expect(loop.maxGapMs, `${name} event loop stall`).toBeLessThan(1000);
  }
  async function upload(original: string, modified: string, name: string) {
    for (const [index, side] of ['Original', 'Modified'].entries()) {
      const filename = `${name}-${side}.txt`;
      await page.getByLabel(`${side} 파일 업로드`).setInputFiles({
        name: filename,
        mimeType: 'text/plain',
        buffer: Buffer.from(index ? modified : original),
      });
      await expect(page.locator('.file-row strong').nth(index)).toHaveText(filename);
    }
  }
  const textCases: { name: string; original: string; modified: string; changes: number }[] = [];
  for (const lines of [100, 1000, 10000, 50000]) {
    const data = Array.from({ length: lines }, (_, i) => `record_${i} = ${i};\n`);
    textCases.push({
      name: `lines-${lines}`,
      original: data.join(''),
      modified: data
        .map((line, i) => (i === Math.floor(lines / 2) ? `changed_${i};\n` : line))
        .join(''),
      changes: 1,
    });
  }
  textCases.push({
    name: 'single-line-500k',
    original: 'a'.repeat(500000),
    modified: 'a'.repeat(499999) + 'b',
    changes: 1,
  });
  textCases.push({
    name: 'single-line-5MiB',
    original: 'a'.repeat(5 * 1024 * 1024),
    modified: 'a'.repeat(5 * 1024 * 1024 - 1) + 'b',
    changes: 1,
  });
  textCases.push({
    name: 'repeated-50000',
    original: 'repeat();\n'.repeat(50000),
    modified: 'repeat();\n'.repeat(25000) + 'changed();\n' + 'repeat();\n'.repeat(24999),
    changes: 1,
  });
  const many = Array.from({ length: 5000 }, (_, i) => `value_${i};\n`);
  textCases.push({
    name: 'similar-500-changes',
    original: many.join(''),
    modified: many.map((line, i) => (i % 10 === 0 ? `other_${i};\n` : line)).join(''),
    changes: 500,
  });
  for (const item of textCases) {
    const started = await begin();
    await upload(item.original, item.modified, item.name);
    await expect(page.locator('.green')).toHaveText(`+${item.changes}`, { timeout: 12000 });
    await expect(page.locator('.red')).toHaveText(`−${item.changes}`);
    const renderedChanges = await page.locator('.code-change-page .change').count();
    expect(renderedChanges).toBeLessThanOrEqual(100);
    await finish(item.name, started, {
      originalBytes: Buffer.byteLength(item.original),
      modifiedBytes: Buffer.byteLength(item.modified),
      added: item.changes,
      removed: item.changes,
      renderedChanges,
    });
  }
  // A high-edit-distance case must remain cancellable, never become "identical".
  const disjoint = Array.from({ length: 50000 }, (_, i) => `before_${i}\n`).join('');
  const start = await begin();
  await upload(disjoint, disjoint.replaceAll('before_', 'after_'), 'cancel-heavy');
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
  await finish('cancel-50000-disjoint', start, { status: 'cancelled' });
  await upload('small\n', 'small change\n', 'small-after-heavy');
  await expect(page.locator('.green')).toHaveText('+1');
  await page.getByRole('button', { name: 'JSON Tools', exact: true }).click();
  const large = Array.from({ length: 20000 }, (_, i) => i),
    json = JSON.stringify(large);
  let clock = await begin();
  await page
    .getByLabel('JSON 파일 업로드', { exact: true })
    .setInputFiles({ name: 'large.json', mimeType: 'application/json', buffer: Buffer.from(json) });
  await page.getByRole('button', { name: 'Tree Viewer', exact: true }).click();
  await expect(page.locator('.json-tree > small').first()).toContainText('20,001', {
    timeout: 12000,
  });
  const jsonRows = await page.locator('.tree-row').count();
  expect(jsonRows).toBeLessThanOrEqual(40);
  await finish('json-20000-values', clock, {
    bytes: Buffer.byteLength(json),
    renderedRows: jsonRows,
  });
  await page.getByRole('button', { name: 'Structural Diff', exact: true }).click();
  const changed = [...large];
  changed[19999] = -1;
  clock = await begin();
  await page.getByLabel('JSON 수정본 업로드').setInputFiles({
    name: 'changed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(changed)),
  });
  await expect(page.locator('.json-change-list')).toContainText('VALUE_MODIFIED', {
    timeout: 12000,
  });
  await finish('json-20000-structural-diff', clock, { changes: 1 });
  await page.getByRole('button', { name: 'Folder Compare', exact: true }).click();
  const root = resolve(tmpdir()),
    work = await mkdtemp(join(root, 'codediff-perf-'));
  if (dirname(resolve(work)) !== root || !basename(work).startsWith('codediff-perf-'))
    throw new Error('Unsafe cleanup path');
  try {
    const old = join(work, 'old'),
      next = join(work, 'next');
    await mkdir(old);
    await mkdir(next);
    await Promise.all(
      Array.from({ length: 500 }, async (_, i) => {
        await writeFile(join(old, `f${i}.txt`), `value ${i}\n`);
        await writeFile(join(next, `f${i}.txt`), i % 50 === 0 ? `changed ${i}\n` : `value ${i}\n`);
      }),
    );
    clock = await begin();
    await page.getByLabel('Original 폴더 선택', { exact: true }).setInputFiles(old);
    await page.getByLabel('Modified 폴더 선택', { exact: true }).setInputFiles(next);
    await page.getByRole('button', { name: '폴더 비교 실행', exact: true }).click();
    await expect(page.locator('.folder-summary')).toContainText('500', { timeout: 20000 });
    await expect(page.locator('.folder-summary')).toContainText('10');
    const renderedFiles = await page.locator('.folder-tree-row').count();
    expect(renderedFiles).toBeLessThanOrEqual(28);
    expect(await readFile(join(old, 'f0.txt'), 'utf8')).toBe('value 0\n');
    await finish('folder-500-files', clock, {
      filesPerSide: 500,
      modifiedFiles: 10,
      renderedFiles,
    });
  } finally {
    await rm(work, { recursive: true, force: true });
  }
  await page.getByRole('button', { name: '워크스페이스 메뉴', exact: true }).click();
  await page.locator('.display-settings summary').click();
  const modelCount = Number(
    (await page.getByLabel('로컬 처리 현황').innerText()).match(/편집 모델 (\d+)/)![1],
  );
  expect(modelCount).toBeLessThanOrEqual(12);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
  await writeFile(
    'docs/phase8-performance.json',
    JSON.stringify(
      {
        date: new Date().toISOString(),
        browser: browser.version(),
        mode: process.env.CODEDIFF_TEST_PREVIEW === '1' ? 'production-preview' : 'development',
        method:
          'Single Edge browser; one Playwright test worker; wall includes upload/debounce/transfer/render. 16ms heartbeat is event-loop delay, not hardware input latency. CDP main-target JS heap after forced GC excludes Worker/native/GPU memory. One sample per scenario; no cross-device guarantee.',
        limits: {
          fileBytes: 5 * 1024 * 1024,
          jsonValues: 30000,
          workerWallTimeoutMs: 10000,
          textDiffAlgorithmTimeoutMs: 1500,
        },
        baselineMainThreadHeapBytes: baselineHeap,
        finalMainThreadHeapBytes: await memory(),
        finalMonacoModels: modelCount,
        externalRequests: external.length,
        pageErrors: errors.length,
        results,
      },
      null,
      2,
    ) + '\n',
  );
});
