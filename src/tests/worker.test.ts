import { afterEach, describe, expect, it, vi } from 'vitest';
import { ComputeClient, computeWorkerCount, type WorkerPort } from '../workers/client';
import { executeJob } from '../workers/execute';
import { compareText, compareInline } from '../core/diff';
import { toDraft } from '../core/mapping/drafts';
import type { Job, Reply, Results } from '../workers/protocol';
class FakeWorker implements WorkerPort {
  onmessage: WorkerPort['onmessage'] = null;
  onerror: WorkerPort['onerror'] = null;
  onmessageerror: WorkerPort['onmessageerror'] = null;
  messages: { id: number; job: Job }[] = [];
  terminated = false;
  postMessage(message: { id: number; job: Job }) {
    this.messages.push(message);
  }
  terminate() {
    this.terminated = true;
  }
  reply(reply: Partial<Reply> = {}) {
    this.onmessage?.({
      data: {
        id: this.messages.at(-1)!.id,
        result: { hunks: [], added: 0, removed: 0, totalLines: 0, duration: 0 },
        elapsed: 0,
        ...reply,
      },
    } as MessageEvent<Reply>);
  }
}
const job = {
  kind: 'text' as const,
  original: 'a\r\n',
  modified: 'b\r\n',
  options: { ignoreWhitespace: false, ignoreCase: false, ignoreEol: false },
};
const clients: ComputeClient[] = [];
afterEach(() => {
  clients.forEach((client) => client.cancel());
  clients.length = 0;
  vi.useRealTimers();
  expect(computeWorkerCount()).toBe(0);
});
function fixture() {
  const workers: FakeWorker[] = [];
  const client = new ComputeClient(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  clients.push(client);
  return { client, workers };
}
describe('worker request lifecycle', () => {
  it('reuses one idle worker and expires it after 30 seconds', async () => {
    vi.useFakeTimers();
    const { client, workers } = fixture();
    const first = client.run(job);
    workers[0].reply();
    await first;
    const second = client.run(job);
    workers[0].reply();
    await second;
    expect(workers).toHaveLength(1);
    expect(computeWorkerCount()).toBe(1);
    await vi.advanceTimersByTimeAsync(30000);
    expect(workers[0].terminated).toBe(true);
    expect(computeWorkerCount()).toBe(0);
  });
  it('terminates active CPU work on supersession and rejects the old request', async () => {
    const { client, workers } = fixture();
    const first = client.run(job);
    const rejected = expect(first).rejects.toMatchObject({ name: 'AbortError' });
    const second = client.run(job);
    await rejected;
    expect(workers[0].terminated).toBe(true);
    workers[0].reply({ result: { hunks: [], added: 999, removed: 0, totalLines: 0, duration: 0 } });
    workers[1].reply();
    expect((await second).added).toBe(0);
  });
  it('ignores unrelated IDs until the correct reply arrives', async () => {
    const { client, workers } = fixture();
    const result = client.run(job);
    let done = false;
    void result.then(() => {
      done = true;
    });
    workers[0].reply({ id: 999 });
    await Promise.resolve();
    expect(done).toBe(false);
    workers[0].reply();
    await result;
  });
  it('aborts through AbortSignal and does not start an already aborted job', async () => {
    const { client, workers } = fixture();
    const abort = new AbortController();
    const result = client.run(job, { signal: abort.signal });
    const rejected = expect(result).rejects.toMatchObject({ name: 'AbortError' });
    abort.abort();
    await rejected;
    expect(workers[0].terminated).toBe(true);
    await expect(client.run(job, { signal: abort.signal })).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(workers).toHaveLength(1);
  });
  it('enforces a wall timeout even if the worker cannot reply', async () => {
    vi.useFakeTimers();
    const { client, workers } = fixture();
    const result = client.run(job, { timeout: 50 });
    const rejected = expect(result).rejects.toThrow('시간 제한');
    await vi.advanceTimersByTimeAsync(50);
    await rejected;
    expect(workers[0].terminated).toBe(true);
    const next = client.run(job);
    workers[1].reply();
    await next;
  });
  it('reports a worker crash and permits a fresh retry', async () => {
    const { client, workers } = fixture();
    const result = client.run(job);
    const rejected = expect(result).rejects.toThrow('crashed');
    const preventDefault = vi.fn();
    workers[0].onerror?.({ message: 'crashed', preventDefault } as unknown as ErrorEvent);
    await rejected;
    expect(preventDefault).toHaveBeenCalled();
    const next = client.run(job);
    workers[1].reply();
    await next;
  });
  it('reports clone/transport failure without falling back to main-thread execution', async () => {
    const client = new ComputeClient(() => {
      throw new Error('Worker unavailable');
    });
    clients.push(client);
    await expect(client.run(job)).rejects.toThrow('Worker unavailable');
    const { client: other, workers } = fixture();
    const next = other.run(job);
    workers[0].onmessageerror?.({} as MessageEvent);
    await expect(next).rejects.toThrow('결과를 읽을 수 없습니다');
  });
});
describe('worker engine integration and raw-source fidelity', () => {
  it('keeps text line positions and option semantics identical to the core', async () => {
    for (const original of ['\r\na \t\r\n한글\r', 'x\ny\n', ''])
      for (const options of [
        job.options,
        { ignoreWhitespace: true, ignoreCase: true, ignoreEol: true, ignoreBlankLines: true },
      ]) {
        const input = { ...job, original, modified: 'A\n한글\n', options };
        const expected = compareText(input.original, input.modified, options);
        const result = (await executeJob(input)) as Results['text'];
        expect({ ...result, duration: 0 }).toEqual({ ...expected, duration: 0 });
        expect(input.original).toBe(original);
      }
  });
  it('runs inline raw details with the original safety limit', async () => {
    expect(
      await executeJob({ kind: 'inline', original: 'a b', modified: 'a c', unit: 'word' }),
    ).toEqual(compareInline('a b', 'a c', 'word'));
  });
  it('keeps JSON null, missing, unsafe integers and prototype-like keys distinct', async () => {
    const result = (await executeJob({
      kind: 'json',
      source: '{"x":null,"__proto__":1}',
      target: '{"__proto__":2}',
      diff: true,
      flatten: false,
    })) as Results['json'];
    expect(result.changes.map((c) => c.kind)).toEqual(['FIELD_REMOVED', 'VALUE_MODIFIED']);
    expect(Object.hasOwn(result.parsed.value as object, '__proto__')).toBe(true);
    const invalid = (await executeJob({
      kind: 'json',
      source: '{"n":9007199254740993}',
      target: 'null',
      diff: true,
      flatten: false,
    })) as Results['json'];
    expect(invalid.parsed.error).toContain('정밀도');
    expect(invalid.changes).toEqual([]);
  });
  it('runs asynchronous JSON transforms without evaluating expressions', async () => {
    expect(
      await executeJob({ kind: 'jsonAction', action: 'sort', source: '{"z":1,"a":2}', indent: 0 }),
    ).toEqual({ text: '{"a":2,"z":1}' });
    await expect(
      executeJob({ kind: 'jsonAction', action: 'query', source: '{}', expression: '$[?(@.x)]' }),
    ).rejects.toThrow();
    const csv = (await executeJob({
      kind: 'jsonAction',
      action: 'fromCsv',
      source: 'a,b\r\n1,2',
      infer: true,
    })) as Results['jsonAction'];
    expect(JSON.parse(csv.text)).toEqual([{ a: 1, b: 2 }]);
  });
  it('keeps mapping compilation errors and successful values atomic', async () => {
    const rule = toDraft({ id: 'x', sourcePath: '$.a', targetPath: '$.b', transform: 'number' });
    const source = '{"a":"2"}';
    const result = (await executeJob({
      kind: 'mapping',
      source,
      rules: [rule],
    })) as Results['mapping'];
    expect(result.result.value).toEqual({ b: 2 });
    expect(source).toBe('{"a":"2"}');
    const invalid = (await executeJob({
      kind: 'mapping',
      source,
      rules: [{ ...rule, targetPath: '$.__proto__.x' }],
    })) as Results['mapping'];
    expect(invalid.result.value).toBeUndefined();
    expect(invalid.result.errors.length).toBeGreaterThan(0);
  });
  it('retains exact CRLF patch application verification', async () => {
    const result = (await executeJob({
      kind: 'patch',
      input: {
        original: '한글\r\n',
        modified: '새 값\r\n',
        filePath: 'src/a.txt',
        context: 3,
        operation: 'modify',
      },
    })) as Results['patch'];
    expect(result.verified).toBe(true);
    expect(result.text).toContain('-한글\r\n');
  });
});

import { decodeFile, lineCount } from '../core/file';
describe('allocation-free file scans retain Unicode and physical line semantics', () => {
  it('counts mixed and trailing line terminators including empty last lines', () => {
    expect(lineCount('')).toBe(0);
    expect(lineCount('😀')).toBe(1);
    expect(lineCount('a\r\nb\rc\n')).toBe(4);
    expect(lineCount('\r\n\r\n')).toBe(3);
  });
  it('accepts astral text and allowed tabs/newlines but rejects control bytes', () => {
    const text = '😀한글\t\r\nvalue\r';
    expect(decodeFile(new TextEncoder().encode(text)).text).toBe(text);
    expect(() => decodeFile(new TextEncoder().encode('😀\u0008'))).toThrow('바이너리');
  });
  it('keeps 50000-line changes at their actual physical positions', () => {
    const original = 'same\r\n'.repeat(50000),
      modified = 'same\r\n'.repeat(25000) + 'new\r\n' + 'same\r\n'.repeat(24999);
    const result = compareText(original, modified, job.options);
    expect(result).toMatchObject({ added: 1, removed: 1, totalLines: 100000 });
    expect(
      result.hunks.some((h) =>
        h.lines.some((line) => line.operation === 'added' && line.newLineNumber === 25001),
      ),
    ).toBe(true);
  });
});

it('verifies existing raw patches inside the worker boundary', async () => {
  const patch = (await executeJob({
    kind: 'patch',
    input: {
      original: 'a\r\n',
      modified: 'b\r\n',
      filePath: 'a.txt',
      context: 3,
      operation: 'modify',
    },
  })) as Results['patch'];
  const verified = (await executeJob({
    kind: 'patchVerify',
    original: 'a\r\n',
    modified: 'b\r\n',
    text: patch.text,
  })) as Results['patchVerify'];
  expect(verified.ok).toBe(true);
});

it('keeps idle expiry armed when an already-aborted request is rejected', async () => {
  vi.useFakeTimers();
  const { client, workers } = fixture();
  const result = client.run(job);
  workers[0].reply();
  await result;
  const abort = new AbortController();
  abort.abort();
  await expect(client.run(job, { signal: abort.signal })).rejects.toMatchObject({
    name: 'AbortError',
  });
  await vi.advanceTimersByTimeAsync(30000);
  expect(workers[0].terminated).toBe(true);
  expect(computeWorkerCount()).toBe(0);
});
