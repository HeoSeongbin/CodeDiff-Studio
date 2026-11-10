// Isolated compatibility boundary for Monaco 0.52.2's document-diff service.
declare module 'monaco-editor/esm/vs/editor/common/core/lineRange.js' {
  export class LineRange {
    constructor(startLineNumber: number, endLineNumberExclusive: number);
  }
}
declare module 'monaco-editor/esm/vs/editor/common/diff/rangeMapping.js' {
  import type { Range } from 'monaco-editor';
  import type { LineRange } from 'monaco-editor/esm/vs/editor/common/core/lineRange.js';
  export class RangeMapping {
    constructor(original: Range, modified: Range);
  }
  export class DetailedLineRangeMapping {
    constructor(original: LineRange, modified: LineRange, inner?: RangeMapping[]);
  }
}
declare module 'monaco-editor/esm/vs/editor/standalone/browser/standaloneCodeEditor.js' {
  import type { editor } from 'monaco-editor';
  export const StandaloneDiffEditor2: new (
    host: HTMLElement,
    options: editor.IStandaloneDiffEditorConstructionOptions,
  ) => editor.IStandaloneDiffEditor;
}
declare module 'monaco-editor/esm/vs/editor/standalone/browser/standaloneServices.js' {
  export const StandaloneServices: { get<T>(id: unknown): T };
}
declare module 'monaco-editor/esm/vs/platform/instantiation/common/instantiation.js' {
  export const IInstantiationService: unknown;
}
declare module 'monaco-editor/esm/vs/platform/instantiation/common/serviceCollection.js' {
  export class ServiceCollection {
    constructor(...entries: [unknown, unknown][]);
  }
}
declare module 'monaco-editor/esm/vs/editor/browser/widget/diffEditor/diffProviderFactoryService.js' {
  export const IDiffProviderFactoryService: unknown;
}
