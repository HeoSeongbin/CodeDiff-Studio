import { create } from 'zustand';
export const jsonSample =
  '{"userId":1001,"name":"Hong","active":true,"roles":["ADMIN"],"profile":{"city":"서울","phone":null}}';
interface JsonWorkspaceState {
  source: string;
  target: string;
  schema: string;
  csv: string;
  tab: string;
  set: (
    patch: Partial<Pick<JsonWorkspaceState, 'source' | 'target' | 'schema' | 'csv' | 'tab'>>,
  ) => void;
}
export const useJsonWorkspace = create<JsonWorkspaceState>((set) => ({
  source: jsonSample,
  target:
    '{"userId":1001,"name":"Heo","active":true,"roles":["ADMIN","USER"],"profile":{"city":"서울"}}',
  schema: '{}',
  csv: 'name,age\nHong,30\nHeo,28',
  tab: 'format',
  set: (patch) => set(patch),
}));
