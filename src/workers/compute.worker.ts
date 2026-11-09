import { executeJob } from './execute';
import type { Job, Reply } from './protocol';
self.onmessage = async ({ data }: MessageEvent<{ id: number; job: Job }>) => {
  const start = performance.now();
  let reply: Reply;
  try {
    reply = { id: data.id, result: await executeJob(data.job), elapsed: performance.now() - start };
  } catch (error) {
    reply = {
      id: data.id,
      error: error instanceof Error ? error.message : '계산 실패',
      elapsed: performance.now() - start,
    };
  }
  self.postMessage(reply);
};
