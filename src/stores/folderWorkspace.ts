import { create } from 'zustand';
import {
  type FolderSelection,
  type FolderOptions,
  defaultFolderOptions,
} from '../core/folder/engine';
interface FolderState {
  original?: FolderSelection;
  modified?: FolderSelection;
  options: FolderOptions;
  setFolder: (side: 'original' | 'modified', folder: FolderSelection) => void;
  setOptions: (options: FolderOptions) => void;
}
export const useFolderWorkspace = create<FolderState>((set) => ({
  options: { ...defaultFolderOptions, excludes: [...defaultFolderOptions.excludes] },
  setFolder: (side, folder) => set({ [side]: folder }),
  setOptions: (options) => set({ options }),
}));
