import { diffArrays, diffChars, diffWordsWithSpace } from 'diff';
export interface DiffOptions {
  ignoreWhitespace: boolean;
  ignoreCase: boolean;
  ignoreEol: boolean;
  ignoreTrailingWhitespace?: boolean;
  ignoreBlankLines?: boolean;
}
export interface DiffLine {
  operation: 'added' | 'removed' | 'unchanged';
  oldLineNumber?: number;
  newLineNumber?: number;
  content: string;
}
export interface DiffHunk {
  id: string;
  oldStart: number;
  newStart: number;
  oldEnd?: number;
  newEnd?: number;
  oldLines: number;
  newLines: number;
  lines: DiffLine[];
  kind: 'added' | 'removed' | 'modified';
}
export function compareText(original: string, modified: string, options: DiffOptions) {
  const start = performance.now();
  const split = (text: string) => text.match(/[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/g) ?? [];
  const normalize = (line: string) => {
    let value = options.ignoreEol ? line.replace(/\r\n|\r/g, '\n') : line;
    if (options.ignoreTrailingWhitespace) value = value.replace(/[^\S\r\n]+(?=\r?\n$|\r$|$)/g, '');
    if (options.ignoreWhitespace) value = value.replace(/[^\S\r\n]+/g, '');
    if (options.ignoreCase) value = value.toLowerCase();
    return value;
  };
  const tokens = (text: string) =>
    split(text)
      .map((content, index) => ({ content, number: index + 1 }))
      .filter(
        (line) =>
          !options.ignoreBlankLines || line.content.replace(/\r\n|\r|\n/g, '').trim() !== '',
      );
  const old = tokens(original),
    next = tokens(modified);
  const parts = diffArrays(old, next, {
    comparator: (a, b) => normalize(a.content) === normalize(b.content),
    timeout: 1500,
  });
  if (!parts) throw new Error('비교 시간 제한을 초과했습니다. 입력을 줄여 주세요.');
  let oldIndex = 0,
    newIndex = 0;
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | undefined;
  for (const part of parts) {
    if (!part.added && !part.removed) {
      oldIndex += part.value.length;
      newIndex += part.value.length;
      current = undefined;
      continue;
    }
    if (!current) {
      current = {
        id: `change-${hunks.length + 1}`,
        oldStart: old[oldIndex]?.number ?? split(original).length + 1,
        newStart: next[newIndex]?.number ?? split(modified).length + 1,
        oldLines: 0,
        newLines: 0,
        lines: [],
        kind: 'added',
      };
      hunks.push(current);
    }
    for (const { content, number } of part.value) {
      if (part.removed) {
        current.lines.push({ operation: 'removed', oldLineNumber: number, content });
        if (!current.oldLines) current.oldStart = number;
        oldIndex++;
        current.oldEnd = number;
        current.oldLines++;
      } else {
        current.lines.push({ operation: 'added', newLineNumber: number, content });
        if (!current.newLines) current.newStart = number;
        newIndex++;
        current.newEnd = number;
        current.newLines++;
      }
    }
    current.kind =
      current.oldLines && current.newLines ? 'modified' : current.oldLines ? 'removed' : 'added';
  }
  return {
    hunks,
    added: hunks.reduce((n, h) => n + h.newLines, 0),
    removed: hunks.reduce((n, h) => n + h.oldLines, 0),
    totalLines: split(original).length + split(modified).length,
    duration: performance.now() - start,
  };
}

export interface InlineChange {
  value: string;
  added?: boolean;
  removed?: boolean;
}
/** Raw text detail: comparison options never rewrite the displayed/downloaded text. */
export function compareInline(original: string, modified: string, unit: 'word' | 'character') {
  const fallback = {
    limited: true,
    changes: [
      { value: original, removed: true },
      { value: modified, added: true },
    ] as InlineChange[],
  };
  if (original.length + modified.length > 20000) return fallback;
  const changes =
    unit === 'word'
      ? diffWordsWithSpace(original, modified, { timeout: 200 })
      : diffChars(original, modified, { timeout: 200 });
  return changes ? { limited: false, changes: changes as InlineChange[] } : fallback;
}
