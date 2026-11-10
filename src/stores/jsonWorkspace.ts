import { create } from 'zustand';
export const jsonSample =
  '{"userId":1001,"name":"Hong","active":true,"roles":["ADMIN"],"profile":{"city":"서울","phone":null}}';
export const csvJsonSample =
  '[{"name":"Hong","age":30,"amount":-12,"profile":{"city":"서울"}},{"name":"Heo","age":28,"amount":-3,"profile":{"city":"부산"}}]';
export const csvSample = 'name,age\nHong,30\nHeo,28';
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
  csv: csvSample,
  tab: 'format',
  set: (patch) => set(patch),
}));
