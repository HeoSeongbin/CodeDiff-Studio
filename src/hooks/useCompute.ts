import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { ComputeClient } from '../workers/client';
import type { Job, Results } from '../workers/protocol';
export const WorkspaceActive = createContext(true);
export function useComputeClient() {
  const client = useMemo(() => new ComputeClient(), []);
  const active = useContext(WorkspaceActive);
  useEffect(() => {
    if (!active) client.cancel();
    return () => client.cancel();
  }, [active, client]);
  return client;
}
export function useCompute<K extends Job['kind']>(job: Extract<Job, { kind: K }>, delay = 250) {
  const client = useComputeClient();
  const active = useContext(WorkspaceActive);
  const [snapshot, setSnapshot] = useState<{
    job: Job;
    result?: Results[K];
    error?: string;
    cancelled?: boolean;
  }>();
  const [retry, setRetry] = useState(0);
  const version = useRef(0);
  const cancel = () => {
    ++version.current;
    client.cancel();
    setSnapshot({ job, cancelled: true });
  };
  useEffect(() => {
    if (!active) return;
    const generation = ++version.current;
    const timer = setTimeout(() => {
      client.run(job).then(
        (result) => {
          if (generation === version.current) setSnapshot({ job, result });
        },
        (error) => {
          if (generation === version.current && error.name !== 'AbortError')
            setSnapshot({ job, error: error.message });
        },
      );
    }, delay);
    return () => {
      ++version.current;
      clearTimeout(timer);
      client.cancel();
    };
  }, [client, job, delay, retry, active]);
  const current = snapshot?.job === job ? snapshot : undefined;
  return {
    result: current?.result,
    error: current?.error ?? '',
    busy: active && !current,
    cancelled: !!current?.cancelled,
    cancel,
    retry: () => {
      setSnapshot(undefined);
      setRetry((value) => value + 1);
    },
  };
}
