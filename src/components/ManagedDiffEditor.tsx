import { useLayoutEffect, useRef, useState } from 'react';
import type { DiffEditorProps } from '@monaco-editor/react';
import * as monaco from 'monaco-editor';

type Props = Pick<
  DiffEditorProps,
  | 'original'
  | 'modified'
  | 'language'
  | 'theme'
  | 'height'
  | 'width'
  | 'options'
  | 'onMount'
  | 'loading'
>;
/** Own source synchronization as well as the editor/model disposal order. */
export function ManagedDiffEditor(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<monaco.editor.IStandaloneDiffEditor>();
  const models = useRef<monaco.editor.IDiffEditorModel>();
  const latest = useRef(props);
  latest.current = props;
  const pending = useRef<ReturnType<typeof setTimeout>>();
  const [ready, setReady] = useState(false);
  useLayoutEffect(() => {
    let cancelled = false;
    let current: monaco.editor.IStandaloneDiffEditor | undefined;
    let pair: monaco.editor.IDiffEditorModel | undefined;
    // StrictMode probes mount/cleanup synchronously. Do not start worker
    // requests for that discarded instance; its models would disappear first.
    queueMicrotask(() => {
      if (cancelled) return;
      const input = latest.current;
      pair = {
        original: monaco.editor.createModel(input.original ?? '', input.language),
        modified: monaco.editor.createModel(input.modified ?? '', input.language),
      };
      models.current = pair;
      current = monaco.editor.createDiffEditor(host.current!, {
        automaticLayout: true,
        ...input.options,
      });
      instance.current = current;
      current.setModel(pair);
      if (input.theme) monaco.editor.setTheme(input.theme);
      setReady(true);
      input.onMount?.(current, monaco);
    });
    return () => {
      cancelled = true;
      clearTimeout(pending.current);
      pending.current = undefined;
      current?.setModel(null);
      current?.dispose();
      pair?.original.dispose();
      pair?.modified.dispose();
      instance.current = undefined;
      models.current = undefined;
    };
  }, []);
  useLayoutEffect(() => {
    const current = instance.current;
    const pair = models.current;
    if (!current || !pair) return;
    if (
      pair.original.getValue() === (props.original ?? '') &&
      pair.modified.getValue() === (props.modified ?? '') &&
      pending.current === undefined
    )
      return;
    clearTimeout(pending.current);
    current.setModel(null);
    // Monaco releases the previous diff view model in a setTimeout(0). Keep
    // its texts alive and unchanged until that cancellation has completed.
    pending.current = setTimeout(() => {
      pending.current = undefined;
      const input = latest.current;
      if (pair.original.getValue() !== (input.original ?? ''))
        pair.original.setValue(input.original ?? '');
      if (pair.modified.getValue() !== (input.modified ?? ''))
        pair.modified.setValue(input.modified ?? '');
      current.setModel(pair);
    }, 0);
  }, [props.original, props.modified]);
  useLayoutEffect(() => {
    instance.current?.updateOptions(props.options ?? {});
  }, [props.options]);
  useLayoutEffect(() => {
    if (models.current && props.language) {
      monaco.editor.setModelLanguage(models.current.original, props.language);
      monaco.editor.setModelLanguage(models.current.modified, props.language);
    }
  }, [props.language]);
  useLayoutEffect(() => {
    if (props.theme) monaco.editor.setTheme(props.theme);
  }, [props.theme]);
  return (
    <div
      style={{ width: props.width ?? '100%', height: props.height ?? '100%', position: 'relative' }}
    >
      {!ready && props.loading}
      <div ref={host} style={{ width: '100%', height: '100%' }} />
    </div>
  );
}
