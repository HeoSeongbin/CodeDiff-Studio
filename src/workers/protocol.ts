import type { compareText, compareInline, DiffOptions } from '../core/diff';
import type { SyntaxLanguage, SyntaxResult } from '../core/syntax/compare';
import type { Json, structuralDiff } from '../core/json/value';
import type { MappingDraft } from '../core/mapping/drafts';
import type { MappingResult } from '../core/mapping/engine';
import type { PatchInput, VerifiedPatch } from '../core/patch/patch';
export type Job =
  | { kind: 'patchVerify'; original: string; modified: string; text: string }
  | {
      kind: 'jsonAction';
      action:
        | 'format'
        | 'sort'
        | 'query'
        | 'schemaGenerate'
        | 'schemaValidate'
        | 'types'
        | 'toCsv'
        | 'fromCsv';
      source: string;
      schema?: string;
      expression?: string;
      indent?: number;
      typeName?: string;
      alias?: boolean;
      exported?: boolean;
      flatten?: boolean;
      columns?: string[];
      delimiter?: string;
      infer?: boolean;
    }
  | { kind: 'text'; original: string; modified: string; options: DiffOptions }
  | { kind: 'inline'; original: string; modified: string; unit: 'word' | 'character' }
  | { kind: 'syntax'; original: string; modified: string; language: SyntaxLanguage }
  | { kind: 'json'; source: string; target: string; diff: boolean; flatten: boolean }
  | { kind: 'mapping'; source: string; rules: MappingDraft[] }
  | { kind: 'patch'; input: PatchInput };
export interface ParsedJson {
  value?: Json;
  error: string;
}
export interface Results {
  patchVerify: ReturnType<typeof import('../core/patch/patch').verifyRawPatch>;
  jsonAction: {
    text: string;
    query?: ReturnType<typeof import('../core/json/query').queryJson>;
    validation?: ReturnType<typeof import('../core/json/schema').validateSchema>;
  };
  text: ReturnType<typeof compareText>;
  inline: ReturnType<typeof compareInline>;
  syntax: SyntaxResult;
  json: {
    parsed: ParsedJson;
    target: ParsedJson;
    changes: ReturnType<typeof structuralDiff>;
    available: string[];
  };
  mapping: {
    parsed: ParsedJson;
    result: MappingResult;
    exportedRules?: string;
    exportError?: string;
  };
  patch: VerifiedPatch;
}
export interface Reply {
  id: number;
  result?: Results[keyof Results];
  error?: string;
  elapsed: number;
}
