import { create } from 'zustand';
import { type MappingDraft, toDraft } from '../core/mapping/drafts';
import type { MappingRule } from '../core/mapping/engine';
export const mappingSample = JSON.stringify(
  {
    user: { id: '1001', name: 'Hong', createdAt: '2026-11-06' },
    members: [
      { id: '1', name: 'Kim' },
      { id: '2', name: 'Heo' },
    ],
  },
  null,
  2,
);
export const sampleMappingRules: MappingRule[] = [
  { id: 'account-id', sourcePath: '$.user.id', targetPath: '$.account.id', transform: 'number' },
  {
    id: 'display-name',
    sourcePath: '$.user.name',
    targetPath: '$.account.displayName',
    transform: 'copy',
  },
  {
    id: 'member-ids',
    sourcePath: '$.members[*].id',
    targetPath: '$.members[*].userId',
    transform: 'number',
  },
];
interface MappingState {
  source: string;
  rules: MappingDraft[];
  setSource: (source: string) => void;
  update: (id: string, patch: Partial<MappingDraft>) => void;
  replace: (rules: MappingRule[]) => void;
  add: (sourcePath?: string) => string | undefined;
  remove: (id: string) => void;
  sample: () => void;
}
export const useMappingWorkspace = create<MappingState>((set, get) => ({
  source: mappingSample,
  rules: sampleMappingRules.map(toDraft),
  setSource: (source) => set({ source }),
  update: (id, patch) =>
    set((state) => ({
      rules: state.rules.map((r) => (r.id === id ? { ...r, ...patch, id: r.id } : r)),
    })),
  replace: (rules) => set({ rules: rules.map(toDraft) }),
  add: (sourcePath = '$') => {
    if (get().rules.length >= 100) return undefined;
    const id = crypto.randomUUID();
    set((state) => ({
      rules: [
        ...state.rules,
        toDraft({
          id,
          sourcePath,
          targetPath: `$["field${state.rules.length + 1}"]`,
          transform: 'copy',
        }),
      ],
    }));
    return id;
  },
  remove: (id) => set((state) => ({ rules: state.rules.filter((r) => r.id !== id) })),
  sample: () => set({ source: mappingSample, rules: sampleMappingRules.map(toDraft) }),
}));
