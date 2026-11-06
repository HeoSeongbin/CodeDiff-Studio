import { useLayoutEffect, useRef } from 'react';
import { DiffEditor, type DiffEditorProps } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
/** Detach models before the wrapper's passive cleanup disposes them. */
export function ManagedDiffEditor(props: DiffEditorProps) {
  const instance = useRef<editor.IStandaloneDiffEditor>();
  useLayoutEffect(
    () => () => {
      const current = instance.current;
      if (!current) return;
      const models = current.getModel();
      current.setModel(null);
      models?.original.dispose();
      models?.modified.dispose();
      instance.current = undefined;
    },
    [],
  );
  return (
    <DiffEditor
      {...props}
      onMount={(current, monaco) => {
        instance.current = current;
        props.onMount?.(current, monaco);
      }}
    />
  );
}
