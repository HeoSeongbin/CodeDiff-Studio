import { create } from 'zustand';
export const usePreferences = create<{
  theme: 'dark' | 'light';
  minimap: boolean;
  analysisWidth: number;
  sourceRatio: number;
  editorHeight: number;
  set: (
    value: Partial<{
      theme: 'dark' | 'light';
      minimap: boolean;
      analysisWidth: number;
      sourceRatio: number;
      editorHeight: number;
    }>,
  ) => void;
}>((set) => ({
  theme: 'dark',
  minimap: false,
  analysisWidth: 280,
  sourceRatio: 45,
  editorHeight: 600,
  set: (value) => set(value),
}));
