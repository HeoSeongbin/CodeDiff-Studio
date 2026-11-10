import * as monaco from 'monaco-editor';
import { LineRange } from 'monaco-editor/esm/vs/editor/common/core/lineRange.js';
import {
  DetailedLineRangeMapping,
  RangeMapping,
} from 'monaco-editor/esm/vs/editor/common/diff/rangeMapping.js';
import type { VisualDiff, TextRange } from '../core/visualDiff';
import { StandaloneDiffEditor2 } from 'monaco-editor/esm/vs/editor/standalone/browser/standaloneCodeEditor.js';
import { StandaloneServices } from 'monaco-editor/esm/vs/editor/standalone/browser/standaloneServices.js';
import { IInstantiationService } from 'monaco-editor/esm/vs/platform/instantiation/common/instantiation.js';
import { ServiceCollection } from 'monaco-editor/esm/vs/platform/instantiation/common/serviceCollection.js';
import { IDiffProviderFactoryService } from 'monaco-editor/esm/vs/editor/browser/widget/diffEditor/diffProviderFactoryService.js';

interface ScopedServices {
  createChild(services: ServiceCollection): ScopedServices;
  createInstance(
    ctor: typeof StandaloneDiffEditor2,
    host: HTMLElement,
    options: monaco.editor.IStandaloneDiffEditorConstructionOptions,
  ): monaco.editor.IStandaloneDiffEditor;
  dispose(): void;
}

/** The only Monaco-internal compatibility adapter; scoped to Code Compare. */
export class CoreDiffProvider {
  private emitter = new monaco.Emitter<void>();
  private snapshot?: { original: string; modified: string; visual?: VisualDiff };
  private rawOriginal?: string;
  private rawModified?: string;
  readonly onDidChange = this.emitter.event;
  createEditor(host: HTMLElement, options: monaco.editor.IStandaloneDiffEditorConstructionOptions) {
    const factory = {
      createDiffProvider: () => ({
        onDidChange: this.onDidChange,
        computeDiff: (original: monaco.editor.ITextModel, modified: monaco.editor.ITextModel) =>
          this.computeDiff(original, modified),
        dispose() {},
      }),
    };
    // createDiffEditor's override argument only affects the FIRST global initialization.
    // A child service collection keeps this provider local to this editor instance.
    const services = StandaloneServices.get<ScopedServices>(IInstantiationService).createChild(
      new ServiceCollection([IDiffProviderFactoryService, factory]),
    );
    return {
      editor: services.createInstance(StandaloneDiffEditor2, host, options),
      dispose: () => services.dispose(),
    };
  }
  publish(original: string, modified: string, visual?: VisualDiff) {
    this.snapshot = {
      original:
        this.snapshot && original === this.rawOriginal
          ? this.snapshot.original
          : original.replace(/\r\n|\r/g, '\n'),
      modified:
        this.snapshot && modified === this.rawModified
          ? this.snapshot.modified
          : modified.replace(/\r\n|\r/g, '\n'),
      visual,
    };
    this.rawOriginal = original;
    this.rawModified = modified;
    this.emitter.fire();
  }
  private computeDiff = async (
    original: monaco.editor.ITextModel,
    modified: monaco.editor.ITextModel,
  ) => {
    const snapshot = this.snapshot;
    const visual = snapshot?.visual;
    if (
      !visual ||
      original.isDisposed() ||
      modified.isDisposed() ||
      original.getValue(monaco.editor.EndOfLinePreference.LF) !== snapshot.original ||
      modified.getValue(monaco.editor.EndOfLinePreference.LF) !== snapshot.modified
    )
      // Pending/cancelled core work is reported by the workspace, not as a Monaco timeout.
      return { changes: [], moves: [], identical: false, quitEarly: false };
    const convert = (value: TextRange, model: monaco.editor.ITextModel) =>
      model.validateRange(
        new monaco.Range(
          value.startLineNumber,
          value.startColumn,
          value.endLineNumber,
          value.endColumn,
        ),
      );
    return {
      changes: visual.changes.map(
        (change) =>
          new DetailedLineRangeMapping(
            new LineRange(change.oldStart, change.oldEnd),
            new LineRange(change.newStart, change.newEnd),
            change.inner.map(
              (inner) =>
                new RangeMapping(
                  convert(inner.original, original),
                  convert(inner.modified, modified),
                ),
            ),
          ),
      ),
      moves: [],
      identical: !visual.changes.length,
      quitEarly: false,
    };
  };
}
