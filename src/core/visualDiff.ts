import { diffChars } from 'diff';
import type { DiffHunk, DiffOptions } from './diff';

export interface TextRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}
export interface VisualChange {
  oldStart: number;
  oldEnd: number;
  newStart: number;
  newEnd: number;
  inner: { original: TextRange; modified: TextRange }[];
}
export interface VisualDiff {
  changes: VisualChange[];
  endings: { side: 'original' | 'modified'; line: number; label: string }[];
  limited: boolean;
}
const body = (text: string) => text.replace(/(?:\r\n|\r|\n)$/, '');
const ending = (text: string) =>
  text.endsWith('\r\n') ? 'CRLF' : text.endsWith('\n') ? 'LF' : text.endsWith('\r') ? 'CR' : 'EOF';

/** Comparison characters retain UTF16 columns into the untouched editor model. */
export function visualCharacters(content: string, options: DiffOptions) {
  const text = body(content);
  const end = options.ignoreTrailingWhitespace
    ? text.replace(/[^\S\r\n]+$/, '').length
    : text.length;
  let key = '';
  const columns: { start: number; end: number }[] = [];
  for (let offset = 0; offset < text.length;) {
    const char = String.fromCodePoint(text.codePointAt(offset)!);
    if (offset < end && !(options.ignoreWhitespace && /[^\S\r\n]/u.test(char))) {
      key += char;
      for (let i = 0; i < char.length; i++)
        columns.push({ start: offset + 1, end: offset + char.length + 1 });
    }
    offset += char.length;
  }
  if (options.ignoreCase) {
    const folded: typeof columns = [];
    let index = 0;
    for (const char of key) {
      for (let i = 0; i < char.toLowerCase().length; i++) folded.push(columns[index]);
      index += char.length;
    }
    // Whole-string casing preserves contextual Unicode casing (e.g. Greek sigma).
    key = key.toLowerCase();
    return { key, columns: folded, length: text.length };
  }
  return { key, columns, length: text.length };
}
const range = (line: number, start: number, end: number): TextRange => ({
  startLineNumber: line,
  startColumn: start,
  endLineNumber: line,
  endColumn: end,
});
function charRange(
  line: number,
  chars: ReturnType<typeof visualCharacters>,
  start: number,
  end: number,
) {
  const first = chars.columns[start]?.start ?? chars.length + 1;
  return range(line, first, end > start ? chars.columns[end - 1].end : first);
}

/** Worker-side projection only; never re-diffs lines or changes source strings. */
export function projectVisualDiff(hunks: readonly DiffHunk[], options: DiffOptions): VisualDiff {
  const result: VisualDiff = { changes: [], endings: [], limited: false };
  const deadline = performance.now() + 100;
  for (const hunk of hunks) {
    const old = hunk.lines.filter((line) => line.operation === 'removed');
    const next = hunk.lines.filter((line) => line.operation === 'added');
    for (let i = 0; i < Math.max(old.length, next.length); i++) {
      const a = old[i],
        b = next[i];
      const oldLine =
        a?.oldLineNumber ??
        (old.at(-1)?.oldLineNumber !== undefined ? old.at(-1)!.oldLineNumber! + 1 : hunk.oldStart);
      const newLine =
        b?.newLineNumber ??
        (next.at(-1)?.newLineNumber !== undefined
          ? next.at(-1)!.newLineNumber! + 1
          : hunk.newStart);
      const change: VisualChange = {
        oldStart: oldLine,
        oldEnd: oldLine + (a ? 1 : 0),
        newStart: newLine,
        newEnd: newLine + (b ? 1 : 0),
        inner: [],
      };
      let compared = false;
      if (a && b && a.content.length + b.content.length <= 20000 && performance.now() < deadline) {
        const left = visualCharacters(a.content, options),
          right = visualCharacters(b.content, options);
        const parts = diffChars(left.key, right.key, { timeout: 20 });
        if (parts) {
          compared = true;
          let x = 0,
            y = 0,
            pending: { x: number; y: number; endX: number; endY: number } | undefined;
          const flush = () => {
            if (pending)
              change.inner.push({
                original: charRange(oldLine, left, pending.x, pending.endX),
                modified: charRange(newLine, right, pending.y, pending.endY),
              });
            pending = undefined;
          };
          for (const part of parts) {
            if (!part.added && !part.removed) {
              flush();
              x += part.value.length;
              y += part.value.length;
            } else {
              pending ??= { x, y, endX: x, endY: y };
              if (part.removed) x += part.value.length;
              if (part.added) y += part.value.length;
              pending.endX = x;
              pending.endY = y;
            }
          }
          flush();
        } else result.limited = true;
      } else if (a && b) result.limited = true;
      if (
        !compared &&
        !change.inner.length &&
        a?.content !== b?.content &&
        (!a || !b || body(a.content) !== body(b.content))
      ) {
        change.inner.push({
          original: range(oldLine, 1, a ? body(a.content).length + 1 : 1),
          modified: range(newLine, 1, b ? body(b.content).length + 1 : 1),
        });
      }
      if (
        a &&
        b &&
        ending(a.content) !== ending(b.content) &&
        !(options.ignoreEol && ending(a.content) !== 'EOF' && ending(b.content) !== 'EOF')
      ) {
        result.endings.push(
          { side: 'original', line: oldLine, label: ending(a.content) },
          { side: 'modified', line: newLine, label: ending(b.content) },
        );
      }
      const previous = result.changes.at(-1);
      if (previous && previous.oldEnd === change.oldStart && previous.newEnd === change.newStart) {
        previous.oldEnd = change.oldEnd;
        previous.newEnd = change.newEnd;
        previous.inner.push(...change.inner);
      } else result.changes.push(change);
    }
  }
  return result;
}
