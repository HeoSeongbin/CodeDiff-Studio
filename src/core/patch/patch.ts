import { createTwoFilesPatch, parsePatch, applyPatch } from 'diff';
import { MAX_BYTES } from '../file';
export type PatchOperation = 'modify' | 'create' | 'delete';
export interface PatchInput {
  original: string;
  modified: string;
  filePath: string;
  context: number;
  operation: PatchOperation;
}
export interface VerifiedPatch {
  text: string;
  verified: true;
  hunks: number;
  added: number;
  removed: number;
  bytes: number;
  duration: number;
  filePath: string;
  operation: PatchOperation;
}
export const MAX_PATCH_BYTES = 12 * 1024 * 1024;
export function validatePatchPath(path: string): string {
  if (
    !path ||
    path.length > 240 ||
    path.trim() !== path ||
    path.startsWith('/') ||
    /[\\:"<>|?*]/.test(path) ||
    Array.from(path).some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) ||
    path
      .split('/')
      .some(
        (segment) =>
          !segment || segment === '.' || segment === '..' || segment.toLowerCase() === '.git',
      )
  )
    throw new Error(
      'Patch 경로는 안전한 상대 경로여야 합니다 (최대 240자). / 구분자를 사용하고 .., .git, 제어문자, 따옴표, 역슬래시, 절대 경로는 제외하세요.',
    );
  checkText(path);
  return path;
}
function checkText(text: string) {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > MAX_BYTES) throw new Error('Patch 입력은 파일당 5 MiB까지 지원합니다.');
  if (text.includes('\0')) throw new Error('NUL을 포함한 바이너리 Patch는 지원하지 않습니다.');
  if (new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes) !== text)
    throw new Error('잘못된 Unicode 서로게이트가 있습니다. UTF-8로 보존할 수 없는 입력입니다.');
}
export function verifyRawPatch(
  original: string,
  modified: string,
  patch: string,
): { ok: boolean; message: string } {
  try {
    checkText(original);
    checkText(modified);
    if (new TextEncoder().encode(patch).length > MAX_PATCH_BYTES)
      throw new Error('Patch 출력 제한은 12 MiB입니다.');
    if (!patch)
      return {
        ok: original === modified,
        message:
          original === modified
            ? '원문과 수정본이 동일합니다.'
            : '빈 Patch로 변경을 재현할 수 없습니다.',
      };
    const files = parsePatch(patch);
    if (files.length !== 1 || !files[0].hunks.length)
      throw new Error('한 파일의 유효한 Unified Diff 변경 블록이 필요합니다.');
    const applied = applyPatch(original, patch, { autoConvertLineEndings: false, fuzzFactor: 0 });
    const ok = applied !== false && applied === modified;
    return {
      ok,
      message: ok
        ? '원본에 Patch를 적용한 결과가 수정본과 정확히 일치합니다.'
        : 'Patch 적용 결과가 수정본과 일치하지 않습니다.',
    };
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}
export function generatePatch(input: PatchInput): VerifiedPatch {
  const start = performance.now();
  const path = validatePatchPath(input.filePath);
  if (!Number.isInteger(input.context) || input.context < 0 || input.context > 20)
    throw new Error('Patch 문맥 줄 수는 0–20 사이의 정수여야 합니다.');
  if (!['modify', 'create', 'delete'].includes(input.operation))
    throw new Error('지원하지 않는 Patch 작업입니다.');
  checkText(input.original);
  checkText(input.modified);
  if (input.operation === 'create' && input.original !== '')
    throw new Error('파일 생성 Patch는 Original이 비어 있어야 합니다.');
  if (input.operation === 'delete' && input.modified !== '')
    throw new Error('파일 삭제 Patch는 Modified가 비어 있어야 합니다.');
  if (input.original === input.modified) {
    if (input.operation !== 'modify')
      throw new Error('내용 없는 파일의 생성·삭제는 현재 텍스트 Patch 범위에서 지원하지 않습니다.');
    return {
      text: '',
      verified: true,
      hunks: 0,
      added: 0,
      removed: 0,
      bytes: 0,
      duration: performance.now() - start,
      filePath: path,
      operation: input.operation,
    };
  }
  const header = (prefix: string) => {
    const value = `${prefix}/${path}`;
    return /\s/.test(value) ? JSON.stringify(value) : value;
  };
  const text = createTwoFilesPatch(
    input.operation === 'create' ? '/dev/null' : header('a'),
    input.operation === 'delete' ? '/dev/null' : header('b'),
    input.original,
    input.modified,
    undefined,
    undefined,
    {
      context: input.context,
      timeout: 1500,
      ignoreWhitespace: false,
      stripTrailingCr: false,
      headerOptions: { includeIndex: false, includeUnderline: false, includeFileHeaders: true },
    },
  );
  if (text === undefined)
    throw new Error('Patch 계산 시간 제한(1.5초)을 초과했습니다. 입력을 줄여 주세요.');
  const verification = verifyRawPatch(input.original, input.modified, text);
  if (!verification.ok) throw new Error(`적용 검증 실패: ${verification.message}`);
  const hunks = parsePatch(text)[0].hunks;
  return {
    text,
    verified: true,
    hunks: hunks.length,
    added: hunks.reduce((n, h) => n + h.lines.filter((line) => line.startsWith('+')).length, 0),
    removed: hunks.reduce((n, h) => n + h.lines.filter((line) => line.startsWith('-')).length, 0),
    bytes: new TextEncoder().encode(text).length,
    duration: performance.now() - start,
    filePath: path,
    operation: input.operation,
  };
}
