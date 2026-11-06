import { create } from 'zustand';
import type { DiffOptions } from '../core/diff';
export const sampleOriginal = `public class Greeting {\n    public String greet(String name) {\n        return "Hello, " + name;\n    }\n}\n`;
export const sampleModified = `public class Greeting {\n    public String greet(String name) {\n        if (name == null) {\n            return "Hello, world";\n        }\n        return "Welcome, " + name;\n    }\n}\n`;
export interface InputFile {
  name: string;
  text: string;
  size: number;
  encoding: string;
}
type Side = 'original' | 'modified';
interface Workspace {
  original: InputFile;
  modified: InputFile;
  language: string;
  options: DiffOptions;
  setFile: (side: Side, file: InputFile) => void;
  setText: (side: Side, text: string) => void;
  setLanguage: (language: string) => void;
  setOptions: (options: DiffOptions) => void;
  sample: () => void;
}
const initial = {
  original: {
    name: 'Greeting.java',
    text: sampleOriginal,
    size: new TextEncoder().encode(sampleOriginal).length,
    encoding: 'utf-8',
  },
  modified: {
    name: 'Greeting.java',
    text: sampleModified,
    size: new TextEncoder().encode(sampleModified).length,
    encoding: 'utf-8',
  },
};
export const useWorkspace = create<Workspace>((set) => ({
  ...initial,
  language: 'java',
  options: { ignoreWhitespace: false, ignoreCase: false, ignoreEol: true },
  setFile: (side, file) => set({ [side]: file }),
  setText: (side, text) => set((state) => ({ [side]: { ...state[side], text } })),
  setLanguage: (language) => set({ language }),
  setOptions: (options) => set({ options }),
  sample: () => set({ ...initial, language: 'java' }),
}));
