import { decodeFile, MAX_BYTES } from '../file';
import { compareText } from '../diff';
export const DEFAULT_EXCLUDES = ['node_modules', '.git', 'dist', 'build', 'target', 'bin', 'obj'];
export const MAX_FOLDER_FILES = 1000,
  MAX_FOLDER_BYTES = 20 * 1024 * 1024,
  MAX_CANDIDATES = 20000;
export interface FolderFile {
  name: string;
  size: number;
  arrayBuffer: () => Promise<ArrayBuffer>;
}
export interface FolderEntry {
  path: string;
  file: FolderFile;
}
export interface FolderSelection {
  name: string;
  files: FolderEntry[];
}
export interface FolderOptions {
  excludes: string[];
  extensions: string[];
  caseSensitive: boolean;
  ignoreWhitespace: boolean;
  encoding: string;
}
export const defaultFolderOptions: FolderOptions = {
  excludes: DEFAULT_EXCLUDES,
  extensions: [],
  caseSensitive: true,
  ignoreWhitespace: false,
  encoding: 'auto',
};
export type FolderStatus =
  'ADDED_FILE' | 'REMOVED_FILE' | 'MODIFIED_FILE' | 'UNCHANGED_FILE' | 'ERROR_FILE';
export interface LoadedFolderFile {
  path: string;
  size: number;
  kind: 'text' | 'binary' | 'error';
  text?: string;
  encoding?: string;
  bom?: string;
  error?: string;
}
export interface FolderRow {
  path: string;
  status: FolderStatus;
  kind: 'text' | 'binary' | 'mixed' | 'error';
  original?: LoadedFolderFile;
  modified?: LoadedFolderFile;
  added?: number;
  removed?: number;
  byteEqual?: boolean;
  ignoredWhitespace?: boolean;
  note?: string;
}
export interface FolderStats {
  added: number;
  removed: number;
  modified: number;
  unchanged: number;
  errors: number;
  binary: number;
  addedLines: number;
  removedLines: number;
  unavailableLineStats: number;
  folders: number;
  total: number;
}
export interface FolderResult {
  rows: FolderRow[];
  stats: FolderStats;
  duration: number;
  excludedOriginal: number;
  excludedModified: number;
  originalName: string;
  modifiedName: string;
  options: FolderOptions;
}
export function normalizeFolderPath(path: string): string {
  if (
    !path ||
    path.length > 1024 ||
    path.startsWith('/') ||
    /[\\:]/.test(path) ||
    Array.from(path).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    path.split('/').some((part) => !part || part === '.' || part === '..') ||
    path.split('/').length > 80
  )
    throw new Error(`지원하지 않는 상대 경로: ${path.slice(0, 120)}`);
  return path;
}
export function browserFolder(
  files: readonly (FolderFile & { webkitRelativePath: string })[],
): FolderSelection {
  if (!files.length)
    throw new Error('선택 폴더에 파일이 없습니다. 빈 폴더로 설정 버튼을 사용하세요.');
  if (files.length > MAX_CANDIDATES)
    throw new Error(`폴더 선택 메타데이터 제한은 ${MAX_CANDIDATES.toLocaleString()}개입니다.`);
  let name = '';
  const entries = files.map((file) => {
    const path = normalizeFolderPath(file.webkitRelativePath),
      slash = path.indexOf('/');
    if (slash < 1) throw new Error('폴더 선택 API의 상대 경로가 필요합니다.');
    const root = path.slice(0, slash);
    if (name && name !== root) throw new Error('한 번에 하나의 최상위 폴더를 선택하세요.');
    name = root;
    return { path: normalizeFolderPath(path.slice(slash + 1)), file };
  });
  return { name, files: entries };
}
export function eligibleFolder(
  selection: FolderSelection,
  options: FolderOptions,
): { entries: Map<string, FolderEntry>; excluded: number } {
  if (selection.files.length > MAX_CANDIDATES)
    throw new Error('폴더 선택 파일 수 제한을 초과했습니다.');
  if (!['auto', 'utf-8', 'utf-16le', 'utf-16be'].includes(options.encoding))
    throw new Error('지원하지 않는 폴더 인코딩입니다.');
  const fold = (text: string) => (options.caseSensitive ? text : text.toLowerCase());
  const excludes = options.excludes.map((value) => normalizeFolderPath(value));
  const extensions = options.extensions.map((value) => value.replace(/^\./, '').toLowerCase());
  const entries = new Map<string, FolderEntry>();
  let excluded = 0,
    bytes = 0;
  for (const entry of selection.files) {
    const path = normalizeFolderPath(entry.path),
      parts = path.split('/'),
      directories = parts.slice(0, -1),
      name = parts.at(-1)!;
    const ignored = excludes.some((exclusion) =>
      exclusion.includes('/')
        ? fold(directories.join('/')).startsWith(fold(exclusion) + '/') ||
          fold(directories.join('/')) === fold(exclusion)
        : directories.some((dir) => fold(dir) === fold(exclusion)),
    );
    const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
    if (ignored || (extensions.length && !extensions.includes(extension))) {
      excluded++;
      continue;
    }
    const key = fold(path);
    if (entries.has(key))
      throw new Error(
        `동일 폴더의 경로 충돌: ${entries.get(key)!.path} / ${path}. 대소문자 옵션을 확인하세요.`,
      );
    if (!Number.isSafeInteger(entry.file.size) || entry.file.size < 0)
      throw new Error(`파일 크기 메타데이터 오류: ${path}`);
    entries.set(key, entry);
    if (entry.file.size <= MAX_BYTES) bytes += entry.file.size;
    if (entries.size > MAX_FOLDER_FILES)
      throw new Error(
        `제외/확장자 필터 후 폴더당 최대 ${MAX_FOLDER_FILES.toLocaleString('en-US')}개 파일입니다.`,
      );
    if (bytes > MAX_FOLDER_BYTES)
      throw new Error('읽을 파일의 합계는 폴더당 20 MiB까지 지원합니다.');
  }
  return { entries, excluded };
}
function binarySignature(bytes: Uint8Array): boolean {
  const starts = (signature: number[]) => signature.every((byte, i) => bytes[i] === byte);
  return [
    [137, 80, 78, 71, 13, 10, 26, 10],
    [255, 216, 255],
    [71, 73, 70, 56, 57, 97],
    [71, 73, 70, 56, 55, 97],
    [37, 80, 68, 70, 45],
    [80, 75, 3, 4],
    [31, 139],
    [55, 122, 188, 175, 39, 28],
    [127, 69, 76, 70],
    [0, 97, 115, 109],
  ].some(starts);
}
interface ReadResult {
  file: LoadedFolderFile;
  bytes?: Uint8Array;
}
async function read(entry: FolderEntry, encoding: string): Promise<ReadResult> {
  const file: LoadedFolderFile = { path: entry.path, size: entry.file.size, kind: 'error' };
  if (entry.file.size > MAX_BYTES)
    return { file: { ...file, error: '파일당 5 MiB 제한 초과: 내용을 읽지 않았습니다.' } };
  try {
    const bytes = new Uint8Array(await entry.file.arrayBuffer());
    if (bytes.length !== entry.file.size) throw new Error('읽은 바이트 수와 파일 크기가 다릅니다.');
    const utf16 = (bytes[0] === 255 && bytes[1] === 254) || (bytes[0] === 254 && bytes[1] === 255);
    const bom = utf16
      ? bytes[0] === 255
        ? 'UTF16LE'
        : 'UTF16BE'
      : bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191
        ? 'UTF8'
        : undefined;
    if (binarySignature(bytes)) return { file: { ...file, kind: 'binary' }, bytes };
    try {
      const decoded = decodeFile(bytes, encoding);
      return {
        file: { ...file, kind: 'text', text: decoded.text, encoding: decoded.encoding, bom },
        bytes,
      };
    } catch (e) {
      const error = (e as Error).message;
      if (error.includes('바이너리') || (!utf16 && encoding === 'auto' && bytes.includes(0)))
        return { file: { ...file, kind: 'binary' }, bytes };
      return { file: { ...file, error }, bytes };
    }
  } catch (e) {
    return { file: { ...file, error: `파일 읽기 오류: ${(e as Error).message}` } };
  }
}
function equalBytes(a: Uint8Array, b: Uint8Array) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}
export async function compareFolders(
  original: FolderSelection,
  modified: FolderSelection,
  options: FolderOptions,
  hooks: {
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
    yieldControl?: () => Promise<void>;
    compare?:
      | typeof compareText
      | ((
          original: string,
          modified: string,
          options: Parameters<typeof compareText>[2],
        ) => Promise<ReturnType<typeof compareText>>);
  } = {},
): Promise<FolderResult> {
  const start = performance.now(),
    left = eligibleFolder(original, options),
    right = eligibleFolder(modified, options),
    keys = [...new Set([...left.entries.keys(), ...right.entries.keys()])].sort(),
    rows: FolderRow[] = [];
  const check = () => {
    if (hooks.signal?.aborted) throw new DOMException('폴더 비교가 취소되었습니다.', 'AbortError');
    if (performance.now() - start > 15000)
      throw new Error('폴더 비교 시간 제한(15초)을 초과했습니다. 필터로 파일 수를 줄여 주세요.');
  };
  hooks.onProgress?.(0, keys.length);
  for (let index = 0; index < keys.length; index++) {
    check();
    const key = keys[index],
      oldEntry = left.entries.get(key),
      newEntry = right.entries.get(key);
    const old = oldEntry ? await read(oldEntry, options.encoding) : undefined;
    check();
    const next = newEntry ? await read(newEntry, options.encoding) : undefined;
    check();
    const path = (newEntry ?? oldEntry)!.path,
      row: FolderRow = {
        path,
        status: old ? 'REMOVED_FILE' : 'ADDED_FILE',
        kind: 'text',
        original: old?.file,
        modified: next?.file,
      };
    if (old?.file.kind === 'error' || next?.file.kind === 'error') {
      row.status = 'ERROR_FILE';
      row.kind = 'error';
      row.note = [old?.file.error, next?.file.error].filter(Boolean).join(' / ');
    } else {
      const kinds = [old?.file.kind, next?.file.kind].filter(Boolean);
      row.kind = kinds.every((kind) => kind === 'text')
        ? 'text'
        : kinds.every((kind) => kind === 'binary')
          ? 'binary'
          : 'mixed';
      if (old && next) row.byteEqual = equalBytes(old.bytes!, next.bytes!);
      if (row.kind === 'text' && old && next && row.byteEqual) {
        row.status = 'UNCHANGED_FILE';
        row.added = 0;
        row.removed = 0;
      } else if (row.kind === 'text') {
        try {
          const diff = await (hooks.compare ?? compareText)(
            old?.file.text ?? '',
            next?.file.text ?? '',
            {
              ignoreWhitespace: options.ignoreWhitespace,
              ignoreCase: false,
              ignoreEol: false,
            },
          );
          row.added = diff.added;
          row.removed = diff.removed;
          if (old && next) {
            const metadataChanged =
              old.file.encoding !== next.file.encoding || old.file.bom !== next.file.bom;
            row.status =
              diff.hunks.length ||
              metadataChanged ||
              (!row.byteEqual && old.file.text === next.file.text)
                ? 'MODIFIED_FILE'
                : 'UNCHANGED_FILE';
            row.ignoredWhitespace = row.status === 'UNCHANGED_FILE' && !row.byteEqual;
            if (metadataChanged) row.note = '텍스트 이외 인코딩/BOM 변경 포함';
            else if (row.ignoredWhitespace) row.note = '공백 옵션에서 동일 · 원본 바이트는 다름';
          }
        } catch (e) {
          if (hooks.signal?.aborted)
            throw new DOMException('폴더 비교가 취소되었습니다.', 'AbortError');
          row.status = 'ERROR_FILE';
          row.kind = 'error';
          row.note = (e as Error).message;
        }
      } else {
        if (old && next) row.status = row.byteEqual ? 'UNCHANGED_FILE' : 'MODIFIED_FILE';
        row.note =
          row.kind === 'mixed'
            ? '텍스트/바이너리 형식 변경 · 줄 통계 제외'
            : '바이너리 바이트 비교 · 텍스트 Diff 미지원';
      }
    }
    rows.push(row);
    hooks.onProgress?.(index + 1, keys.length);
    await (hooks.yieldControl?.() ?? new Promise<void>((resolve) => setTimeout(resolve, 0)));
  }
  check();
  const directories = new Set<string>();
  for (const row of rows) {
    const parts = row.path.split('/');
    for (let i = 1; i < parts.length; i++) directories.add(parts.slice(0, i).join('/'));
  }
  const count = (status: FolderStatus) => rows.filter((row) => row.status === status).length;
  return {
    rows,
    stats: {
      added: count('ADDED_FILE'),
      removed: count('REMOVED_FILE'),
      modified: count('MODIFIED_FILE'),
      unchanged: count('UNCHANGED_FILE'),
      errors: count('ERROR_FILE'),
      binary: rows.filter((row) => row.kind === 'binary' || row.kind === 'mixed').length,
      addedLines: rows.reduce((n, row) => n + (row.added ?? 0), 0),
      removedLines: rows.reduce((n, row) => n + (row.removed ?? 0), 0),
      unavailableLineStats: rows.filter(
        (row) => row.added === undefined || row.removed === undefined,
      ).length,
      folders: directories.size,
      total: rows.length,
    },
    duration: performance.now() - start,
    excludedOriginal: left.excluded,
    excludedModified: right.excluded,
    originalName: original.name,
    modifiedName: modified.name,
    options: { ...options, excludes: [...options.excludes], extensions: [...options.extensions] },
  };
}
export function exportFolderReport(result: FolderResult, rows = result.rows): string {
  const metadata = (file: LoadedFolderFile | undefined) =>
    file
      ? {
          path: file.path,
          size: file.size,
          kind: file.kind,
          encoding: file.encoding,
          bom: file.bom,
          error: file.error,
        }
      : undefined;
  return JSON.stringify(
    {
      version: 1,
      original: result.originalName,
      modified: result.modifiedName,
      options: result.options,
      statsScope: 'all-compared-files',
      stats: result.stats,
      excludedOriginal: result.excludedOriginal,
      excludedModified: result.excludedModified,
      exportedRows: rows.length,
      files: rows.map((row) => ({
        ...row,
        original: metadata(row.original),
        modified: metadata(row.modified),
      })),
    },
    null,
    2,
  );
}
