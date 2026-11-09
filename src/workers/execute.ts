import type { Job, Results, ParsedJson } from './protocol';
export async function executeJob(job: Job): Promise<Results[keyof Results]> {
  switch (job.kind) {
    case 'patchVerify':
      return (await import('../core/patch/patch')).verifyRawPatch(
        job.original,
        job.modified,
        job.text,
      );
    case 'jsonAction': {
      const { parseJson, stringify, sortKeys } = await import('../core/json/value');
      if (job.action === 'fromCsv') {
        const { fromCsv } = await import('../core/json/csv');
        return { text: stringify(fromCsv(job.source, job.delimiter ?? ',', !!job.infer)) };
      }
      const value = parseJson(job.source);
      switch (job.action) {
        case 'format':
          return { text: stringify(value, job.indent ?? 2) };
        case 'sort':
          return { text: stringify(sortKeys(value), job.indent ?? 2) };
        case 'query':
          return {
            text: '',
            query: (await import('../core/json/query')).queryJson(value, job.expression ?? '$'),
          };
        case 'schemaGenerate':
          return { text: stringify((await import('../core/json/schema')).generateSchema(value)) };
        case 'schemaValidate':
          return {
            text: '',
            validation: (await import('../core/json/schema')).validateSchema(
              value,
              job.schema ?? '',
            ),
          };
        case 'types':
          return {
            text: (await import('../core/json/schema')).generateTypes(
              value,
              job.typeName ?? 'Root',
              !!job.alias,
              job.exported ?? true,
            ),
          };
        case 'toCsv':
          return {
            text: (await import('../core/json/csv')).toCsv(
              value,
              !!job.flatten,
              job.columns,
              job.delimiter ?? ',',
            ),
          };
      }
      throw new Error('지원하지 않는 JSON 작업입니다.');
    }
    case 'text': {
      const { compareText } = await import('../core/diff');
      return compareText(job.original, job.modified, job.options);
    }
    case 'inline': {
      const { compareInline } = await import('../core/diff');
      return compareInline(job.original, job.modified, job.unit);
    }
    case 'syntax': {
      const { loadSyntaxLanguage } = await import('../core/syntax/browser');
      const { compareSyntax } = await import('../core/syntax/compare');
      return compareSyntax(
        job.original,
        job.modified,
        await loadSyntaxLanguage(job.language),
        job.language,
      );
    }
    case 'json': {
      const { parseJson, structuralDiff } = await import('../core/json/value');
      const { csvColumns } = await import('../core/json/csv');
      const parse = (source: string): ParsedJson => {
        try {
          return { value: parseJson(source), error: '' };
        } catch (error) {
          return { error: (error as Error).message };
        }
      };
      const parsed = parse(job.source),
        target = parse(job.target);
      let available: string[] = [];
      try {
        if (parsed.value !== undefined) available = csvColumns(parsed.value, job.flatten).fields;
      } catch {
        /* Non-tabular JSON remains valid JSON. */
      }
      return {
        parsed,
        target,
        available,
        changes:
          job.diff && parsed.value !== undefined && target.value !== undefined
            ? structuralDiff(parsed.value, target.value)
            : [],
      };
    }
    case 'mapping': {
      const { parseJson } = await import('../core/json/value');
      const { compileDrafts } = await import('../core/mapping/drafts');
      const { applyMapping, exportMappingRules } = await import('../core/mapping/engine');
      const compiled = compileDrafts(job.rules);
      let exportedRules: string | undefined, exportError: string | undefined;
      try {
        if (compiled.errors.length)
          throw new Error(
            compiled.errors
              .map((error) => `${error.ruleId ?? '규칙'}: ${error.message}`)
              .join('\n'),
          );
        exportedRules = exportMappingRules(compiled.rules);
      } catch (error) {
        exportError = (error as Error).message;
      }
      try {
        const value = parseJson(job.source);
        return {
          parsed: { value, error: '' },
          exportedRules,
          exportError,
          result: compiled.errors.length
            ? { errors: compiled.errors, applied: 0, skipped: 0, excluded: 0 }
            : applyMapping(value, compiled.rules),
        };
      } catch (error) {
        const message = (error as Error).message;
        return {
          parsed: { error: message },
          exportedRules,
          exportError,
          result: { errors: [{ message }], applied: 0, skipped: 0, excluded: 0 },
        };
      }
    }
    case 'patch':
      return (await import('../core/patch/patch')).generatePatch(job.input);
  }
}
