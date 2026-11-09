export const MAX_BYTES = 5 * 1024 * 1024;
export const languages: Record<string, string> = {
  java: 'java',
  cs: 'csharp',
  py: 'python',
  go: 'go',
  kt: 'kotlin',
  rs: 'rust',
  c: 'c',
  cpp: 'cpp',
  h: 'cpp',
  hpp: 'cpp',
  html: 'html',
  htm: 'html',
  css: 'css',
  scss: 'scss',
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  vue: 'html',
  sql: 'sql',
  json: 'json',
  jsonl: 'plaintext',
  xml: 'xml',
  yml: 'yaml',
  yaml: 'yaml',
  properties: 'ini',
  ini: 'ini',
  conf: 'plaintext',
  env: 'plaintext',
  txt: 'plaintext',
  md: 'markdown',
  log: 'plaintext',
  sh: 'shell',
  ps1: 'powershell',
  bat: 'bat',
};
export function detectLanguage(name: string) {
  return languages[name.split('.').pop()?.toLowerCase() ?? ''] ?? 'plaintext';
}
export function lineCount(text: string) {
  if (!text) return 0;
  let count = 1;
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) === 13) {
      count++;
      if (text.charCodeAt(i + 1) === 10) i++;
    } else if (text.charCodeAt(i) === 10) count++;
  }
  return count;
}
export function decodeFile(bytes: Uint8Array, encoding = 'auto') {
  if (bytes.length > MAX_BYTES) throw new Error('파일 크기 제한은 5 MiB입니다.');
  let label = encoding;
  if (label === 'auto')
    label =
      bytes[0] === 255 && bytes[1] === 254
        ? 'utf-16le'
        : bytes[0] === 254 && bytes[1] === 255
          ? 'utf-16be'
          : 'utf-8';
  let text: string;
  try {
    text = new TextDecoder(label, { fatal: true }).decode(bytes);
  } catch {
    throw new Error('인코딩 오류: 올바른 인코딩을 선택한 뒤 다시 업로드하세요.');
  }
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code <= 8 || (code >= 14 && code <= 31))
      throw new Error('바이너리 또는 지원하지 않는 텍스트 파일입니다.');
  }
  return { text, encoding: label };
}
export async function loadFile(file: File, encoding = 'auto') {
  if (file.size > MAX_BYTES) throw new Error('파일 크기 제한은 5 MiB입니다.');
  return {
    name: file.name,
    size: file.size,
    ...decodeFile(new Uint8Array(await file.arrayBuffer()), encoding),
  };
}
