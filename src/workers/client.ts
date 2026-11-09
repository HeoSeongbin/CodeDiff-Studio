import type { Job, Reply, Results } from './protocol';
let liveWorkers = 0;
const listeners = new Set<() => void>();
export const computeWorkerCount = () => liveWorkers;
export function subscribeComputeWorkers(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
function countWorkers(delta: number) {
  liveWorkers += delta;
  listeners.forEach((listener) => listener());
}
export interface WorkerPort {
  onmessage: ((event: MessageEvent<Reply>) => void) | null;
  onerror: ((event: ErrorEvent) => void) | null;
  onmessageerror: ((event: MessageEvent) => void) | null;
  postMessage(message: { id: number; job: Job }): void;
  terminate(): void;
}
export class ComputeClient {
  private worker?: WorkerPort;
  private pending?: { reject: (reason: Error) => void; cleanup: () => void };
  private idle?: ReturnType<typeof setTimeout>;
  private version = 0;
  constructor(
    private factory: () => WorkerPort = () =>
      new Worker(new URL('./compute.worker.ts', import.meta.url), {
        type: 'module',
        name: 'codediff-compute',
      }),
  ) {}
  cancel() {
    ++this.version;
    clearTimeout(this.idle);
    this.stopWorker();
    const pending = this.pending;
    this.pending = undefined;
    pending?.cleanup();
    pending?.reject(new DOMException('계산이 취소되었습니다.', 'AbortError'));
  }
  private stopWorker() {
    if (!this.worker) return;
    this.worker.terminate();
    this.worker = undefined;
    countWorkers(-1);
  }
  run<K extends Job['kind']>(
    job: Extract<Job, { kind: K }>,
    options: { signal?: AbortSignal; timeout?: number } = {},
  ): Promise<Results[K]> {
    if (this.pending) this.cancel();
    if (options.signal?.aborted)
      return Promise.reject(new DOMException('계산이 취소되었습니다.', 'AbortError'));
    clearTimeout(this.idle);
    const id = ++this.version;
    return new Promise((resolve, reject) => {
      const abort = () => this.cancel();
      const cleanup = () => {
        clearTimeout(timer);
        options.signal?.removeEventListener('abort', abort);
      };
      const fail = (error: Error) => {
        if (id !== this.version) return;
        this.stopWorker();
        this.pending = undefined;
        cleanup();
        reject(error);
      };
      this.pending = { reject, cleanup };
      options.signal?.addEventListener('abort', abort, { once: true });
      const timer = setTimeout(
        () => fail(new Error('계산 시간 제한을 초과했습니다. 입력을 줄이거나 다시 시도하세요.')),
        options.timeout ?? 10_000,
      );
      try {
        if (!this.worker) {
          this.worker = this.factory();
          countWorkers(1);
        }
        this.worker.onmessage = ({ data }) => {
          if (id !== this.version || data.id !== id || !this.pending) return;
          this.pending = undefined;
          cleanup();
          if (data.error) reject(new Error(data.error));
          else resolve(data.result as Results[K]);
          this.idle = setTimeout(() => this.cancel(), 30_000);
        };
        this.worker.onerror = (event) => {
          event.preventDefault();
          fail(new Error(event.message || 'Worker를 시작할 수 없습니다. 다시 시도하세요.'));
        };
        this.worker.onmessageerror = () => fail(new Error('Worker 결과를 읽을 수 없습니다.'));
        this.worker.postMessage({ id, job });
      } catch (error) {
        fail(error instanceof Error ? error : new Error('Worker를 시작할 수 없습니다.'));
      }
    });
  }
}
