/** Explicit UTF-8 export; preserve current text including its line endings and EOF. */
export function exportBytes(text: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(text);
}
export function downloadText(text: string, name: string) {
  const url = URL.createObjectURL(
    new Blob([exportBytes(text)], { type: 'text/plain;charset=utf-8' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name.replace(/[\\/]/g, '_') || 'code.txt';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
